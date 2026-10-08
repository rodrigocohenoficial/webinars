//+------------------------------------------------------------------+
//|                                                   CriarWinBT.mq5 |
//|  Cria um símbolo personalizado (WIN_BT) com os ticks do WIN$N e   |
//|  o valor do ponto correto, para o backtest longo dar resultado    |
//|  em R$. No WIN$N da corretora o valor do tick vem zerado e o      |
//|  testador mostra lucro 0,00 em todas as operações.                |
//|  Rodar uma vez (arrastar para qualquer gráfico).                  |
//+------------------------------------------------------------------+
#property copyright "Rodrigo Cohen"
#property version   "1.01"
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
   // O terminal baixa o histórico antigo sob demanda: dia útil sem ticks
   // pode ser só download em andamento, então espera antes de pular.
   long total = 0;
   int  diasComTicks = 0, diasUteisVazios = 0, barras = 0;
   for(datetime dia = InpDe; dia < ate && !IsStopped(); dia += 86400)
     {
      MqlDateTime d;
      TimeToStruct(dia, d);
      bool diaUtil = (d.day_of_week >= 1 && d.day_of_week <= 5);
      ulong de   = (ulong)dia * 1000;
      ulong ate_ = (ulong)MathMin(dia + 86400, ate) * 1000 - 1;

      MqlTick ticks[];
      int n = -1;
      int tentativas = diaUtil ? 15 : 1;
      for(int tentativa = 0; tentativa < tentativas && n <= 0; tentativa++)
        {
         if(tentativa > 0)
            Sleep(2000);
         n = CopyTicksRange(InpOrigem, ticks, COPY_TICKS_ALL, de, ate_);
        }
      if(n < 0)
        {
         PrintFormat("Falhou ao baixar os ticks de %s (erro %d). Rode o script de novo com 'a partir de' nessa data.",
                     TimeToString(dia, TIME_DATE), GetLastError());
         return;
        }
      if(n == 0)
        {
         if(diaUtil)
           {
            diasUteisVazios++;
            PrintFormat("%s: sem ticks (feriado ou sem histórico na corretora)", TimeToString(dia, TIME_DATE));
           }
         continue;
        }

      if(CustomTicksReplace(InpDestino, (long)de, (long)ate_, ticks) < 0)
        {
         PrintFormat("Falhou ao gravar os ticks de %s (erro %d).", TimeToString(dia, TIME_DATE), GetLastError());
         return;
        }

      // Barras de 1 minuto do mesmo dia, para o gráfico e para o testador.
      MqlRates m1[];
      int nb = CopyRates(InpOrigem, PERIOD_M1, dia, (datetime)(ate_ / 1000), m1);
      if(nb > 0 && CustomRatesReplace(InpDestino, dia, (datetime)(ate_ / 1000), m1) > 0)
         barras += nb;

      total += n;
      diasComTicks++;
      if(diasComTicks % 20 == 0)
         PrintFormat("%s: %d pregões copiados, %I64d ticks", TimeToString(dia, TIME_DATE), diasComTicks, total);
     }

   SymbolSelect(InpDestino, true);
   PrintFormat("Pronto: %s com %d pregões, %I64d ticks e %d barras de 1 minuto (%d dias úteis sem ticks). Use %s no testador.",
               InpDestino, diasComTicks, total, barras, diasUteisVazios, InpDestino);
  }
// Uma configuração que falha não interrompe a cópia: só avisa.
void Configurar(string oque, bool ok)
  {
   if(!ok)
      PrintFormat("Aviso: não consegui ajustar %s (erro %d). Ajuste à mão em Símbolos > %s > Especificação.",
                  oque, GetLastError(), InpDestino);
  }
//+------------------------------------------------------------------+
