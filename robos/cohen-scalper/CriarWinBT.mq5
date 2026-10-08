//+------------------------------------------------------------------+
//|                                                   CriarWinBT.mq5 |
//|  Cria um símbolo personalizado (WIN_BT) com os ticks do WIN$N e   |
//|  o valor do ponto correto, para o backtest longo dar resultado    |
//|  em R$. No WIN$N da corretora o valor do tick vem zerado e o      |
//|  testador mostra lucro 0,00 em todas as operações.                |
//|  Rodar uma vez (arrastar para qualquer gráfico).                  |
//+------------------------------------------------------------------+
#property copyright "Rodrigo Cohen"
#property version   "1.00"
#property script_show_inputs

input string   InpOrigem     = "WIN$N";            // Série contínua de origem
input string   InpDestino    = "WIN_BT";           // Nome do símbolo personalizado
input datetime InpDe         = D'2025.01.01';      // Copiar ticks a partir de
input datetime InpAte        = 0;                  // Até (0 = agora)
input double   InpTamanhoTick = 5;                 // Tamanho do tick em pontos (WIN: 5 / WDO: 0.5)
input double   InpValorTick  = 1.00;               // R$ por tick por contrato (WIN: 1,00 / WDO: 5,00)

void OnStart()
  {
   if(!SymbolSelect(InpOrigem, true))
     {
      PrintFormat("Não encontrei o símbolo %s na corretora.", InpOrigem);
      return;
     }

   bool personalizado = false;
   if(SymbolExist(InpDestino, personalizado))
     {
      if(!personalizado)
        {
         PrintFormat("Já existe um símbolo da corretora chamado %s. Escolha outro nome.", InpDestino);
         return;
        }
     }
   else if(!CustomSymbolCreate(InpDestino, "Cohen", InpOrigem))   // copia horários e regras da origem
     {
      PrintFormat("Não consegui criar %s (erro %d).", InpDestino, GetLastError());
      return;
     }

   // Já aparece na Observação do Mercado (e no testador), mesmo antes de copiar os ticks.
   SymbolSelect(InpDestino, true);

   // O que falta no WIN$N: valor do ponto e cálculo de futuros da bolsa.
   Configurar("tamanho do tick", CustomSymbolSetDouble(InpDestino, SYMBOL_TRADE_TICK_SIZE, InpTamanhoTick));
   Configurar("valor do tick", CustomSymbolSetDouble(InpDestino, SYMBOL_TRADE_TICK_VALUE, InpValorTick));
   Configurar("tamanho do contrato", CustomSymbolSetDouble(InpDestino, SYMBOL_TRADE_CONTRACT_SIZE, 1));
   Configurar("cálculo de futuros", CustomSymbolSetInteger(InpDestino, SYMBOL_TRADE_CALC_MODE, SYMBOL_CALC_MODE_EXCH_FUTURES));
   Configurar("negociação liberada", CustomSymbolSetInteger(InpDestino, SYMBOL_TRADE_MODE, SYMBOL_TRADE_MODE_FULL));
   PrintFormat("%s criado: valor do tick %.2f a cada %.1f pontos.", InpDestino,
               SymbolInfoDouble(InpDestino, SYMBOL_TRADE_TICK_VALUE), SymbolInfoDouble(InpDestino, SYMBOL_TRADE_TICK_SIZE));

   datetime ate = (InpAte == 0) ? TimeCurrent() : InpAte;
   PrintFormat("Copiando ticks de %s para %s, de %s até %s. Pode demorar.",
               InpOrigem, InpDestino, TimeToString(InpDe, TIME_DATE), TimeToString(ate, TIME_DATE));

   // Um dia por vez: um mês inteiro de ticks do WIN não cabe na memória.
   long total = 0;
   int  diasComTicks = 0;
   for(datetime dia = InpDe; dia < ate && !IsStopped(); dia += 86400)
     {
      ulong de  = (ulong)dia * 1000;
      ulong ate_ = (ulong)MathMin(dia + 86400, ate) * 1000 - 1;

      MqlTick ticks[];
      int n = -1;
      for(int tentativa = 0; tentativa < 10 && n < 0; tentativa++)
        {
         n = CopyTicksRange(InpOrigem, ticks, COPY_TICKS_ALL, de, ate_);
         if(n < 0)
            Sleep(2000);   // a corretora ainda está enviando o histórico
        }
      if(n < 0)
        {
         PrintFormat("Falhou ao baixar os ticks de %s (erro %d). Rode o script de novo a partir dessa data.",
                     TimeToString(dia, TIME_DATE), GetLastError());
         return;
        }
      if(n == 0)
         continue;   // fim de semana ou feriado

      if(CustomTicksReplace(InpDestino, (long)de, (long)ate_, ticks) < 0)
        {
         PrintFormat("Falhou ao gravar os ticks de %s (erro %d).", TimeToString(dia, TIME_DATE), GetLastError());
         return;
        }
      total += n;
      diasComTicks++;
      if(diasComTicks % 20 == 0)
         PrintFormat("%s: %d pregões copiados, %I64d ticks", TimeToString(dia, TIME_DATE), diasComTicks, total);
     }

   // Barras de 1 minuto, para o gráfico e para o testador.
   MqlRates barras[];
   int nb = CopyRates(InpOrigem, PERIOD_M1, InpDe, ate, barras);
   if(nb > 0)
      CustomRatesReplace(InpDestino, InpDe, ate, barras);

   SymbolSelect(InpDestino, true);
   PrintFormat("Pronto: %s com %d pregões, %I64d ticks e %d barras de 1 minuto. Use %s no testador.",
               InpDestino, diasComTicks, total, nb, InpDestino);
  }
// Uma configuração que falha não interrompe a cópia: só avisa.
void Configurar(string oque, bool ok)
  {
   if(!ok)
      PrintFormat("Aviso: não consegui ajustar %s (erro %d). Ajuste à mão em Símbolos > %s > Especificação.",
                  oque, GetLastError(), InpDestino);
  }
//+------------------------------------------------------------------+
