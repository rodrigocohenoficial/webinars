//+------------------------------------------------------------------+
//|                                          CriarSimboloDeTicks.mq5 |
//|  Cria um ativo personalizado com os ticks de uma série contínua  |
//|  (ex.: WDO$N) e barras de 1 minuto montadas a partir desses      |
//|  mesmos ticks. Resolve o "tick prices mismatch ... all the real  |
//|  ticks discarded" do testador, que aparece quando as barras da   |
//|  corretora não batem com os ticks dela.                          |
//+------------------------------------------------------------------+
#property copyright "Rodrigo Cohen"
#property version   "1.00"
#property script_show_inputs

input string   InpOrigem  = "WDO$N";            // Ativo de origem (série sem ajuste)
input string   InpDestino = "WDO_TICKS";        // Nome do ativo personalizado
input datetime InpInicio  = D'2022.01.01';      // Primeiro dia
input datetime InpFim     = D'2026.03.01';      // Até (exclusive)

void OnStart()
  {
   if(!SymbolSelect(InpOrigem, true))
     {
      PrintFormat("Ativo de origem %s não encontrado.", InpOrigem);
      return;
     }

   bool personalizado = false;
   if(!SymbolExist(InpDestino, personalizado))
     {
      // Copia todas as especificações (tick, valor do ponto, margem, execução) da origem.
      if(!CustomSymbolCreate(InpDestino, "CohenScalper", InpOrigem))
        {
         PrintFormat("Não consegui criar %s (erro %d).", InpDestino, GetLastError());
         return;
        }
      PrintFormat("Ativo %s criado a partir de %s.", InpDestino, InpOrigem);
     }
   else if(!personalizado)
     {
      PrintFormat("%s já existe e não é um ativo personalizado. Escolha outro nome.", InpDestino);
      return;
     }
   SymbolSelect(InpDestino, true);

   long totalTicks = 0, totalBarras = 0;
   int  dias = 0, falhas = 0;
   for(datetime dia = InpInicio; dia < InpFim && !IsStopped(); dia += 86400)
     {
      long de  = (long)dia * 1000;
      long ate = (long)(dia + 86400) * 1000 - 1;

      MqlTick ticks[];
      int n = -1;
      for(int tentativa = 0; tentativa < 5 && n < 0; tentativa++)
        {
         n = CopyTicksRange(InpOrigem, ticks, COPY_TICKS_ALL, de, ate);
         if(n < 0)
            Sleep(1000);   // histórico ainda sincronizando
        }
      if(n < 0)
        {
         falhas++;
         PrintFormat("%s: não consegui ler os ticks (erro %d).", TimeToString(dia, TIME_DATE), GetLastError());
         continue;
        }
      if(n == 0)
         continue;   // fim de semana ou feriado

      if(CustomTicksReplace(InpDestino, de, ate, ticks) < 0)
        {
         falhas++;
         PrintFormat("%s: não consegui gravar os ticks (erro %d).", TimeToString(dia, TIME_DATE), GetLastError());
         continue;
        }

      MqlRates barras[];
      int nb = MontarBarras(ticks, barras);
      if(nb > 0 && CustomRatesReplace(InpDestino, dia, dia + 86399, barras) < 0)
        {
         falhas++;
         PrintFormat("%s: não consegui gravar as barras (erro %d).", TimeToString(dia, TIME_DATE), GetLastError());
         continue;
        }

      totalTicks  += n;
      totalBarras += nb;
      dias++;
      if(dias % 20 == 0)
        {
         string progresso = StringFormat("%s: %d dias, %I64d ticks, %I64d barras",
                                         TimeToString(dia, TIME_DATE), dias, totalTicks, totalBarras);
         Print(progresso);
         Comment(InpDestino, " — ", progresso);
        }
     }

   Comment("");
   PrintFormat("Pronto: %s com %d dias, %I64d ticks, %I64d barras de 1 minuto, %d dias com falha.",
               InpDestino, dias, totalTicks, totalBarras, falhas);
  }

// Barras de 1 minuto pelo último negócio (como o gráfico da B3), só com os
// ticks que têm negócio. Assim barra e tick sempre batem no testador.
int MontarBarras(const MqlTick &ticks[], MqlRates &barras[])
  {
   int total = ArraySize(ticks);
   ArrayResize(barras, 0, 600);
   int nb = 0;
   datetime minutoAtual = 0;
   for(int i = 0; i < total; i++)
     {
      if((ticks[i].flags & TICK_FLAG_LAST) == 0 || ticks[i].last <= 0)
         continue;
      datetime minuto = (datetime)(ticks[i].time - ticks[i].time % 60);
      double   preco  = ticks[i].last;
      if(nb == 0 || minuto != minutoAtual)
        {
         nb++;
         ArrayResize(barras, nb, 600);
         minutoAtual = minuto;
         barras[nb - 1].time        = minuto;
         barras[nb - 1].open        = preco;
         barras[nb - 1].high        = preco;
         barras[nb - 1].low         = preco;
         barras[nb - 1].close       = preco;
         barras[nb - 1].tick_volume = 0;
         barras[nb - 1].real_volume = 0;
         barras[nb - 1].spread      = 0;
        }
      barras[nb - 1].high         = MathMax(barras[nb - 1].high, preco);
      barras[nb - 1].low          = MathMin(barras[nb - 1].low, preco);
      barras[nb - 1].close        = preco;
      barras[nb - 1].tick_volume += 1;
      barras[nb - 1].real_volume += (long)ticks[i].volume;
     }
   return nb;
  }
//+------------------------------------------------------------------+
