//+------------------------------------------------------------------+
//|                                                 CohenScalper.mq5 |
//|  Scalper de price action: candle de força, entrada no candle     |
//|  seguinte, parcial com stop no 0x0 e alvo final.                 |
//|  v1 - para backtest e conta demo.                                |
//+------------------------------------------------------------------+
#property copyright "Rodrigo Cohen"
#property version   "1.00"
#property description "Candle de força + entrada no candle seguinte. Parcial, 0x0 e alvo final."

#include <Trade\Trade.mqh>

enum ENUM_REF_FECHAMENTO
  {
   REF_MAXIMA_MINIMA = 0,   // Fechar além da máxima/mínima do anterior
   REF_FECHAMENTO    = 1    // Fechar além do fechamento do anterior
  };

enum ENUM_MODO_ENTRADA
  {
   ENTRADA_ABERTURA = 0,    // A mercado na abertura do candle seguinte
   ENTRADA_RETORNO  = 1     // Espera recuar e voltar à abertura do candle
  };

enum ENUM_UNIDADE_RECUO
  {
   RECUO_PCT_CANDLE = 0,    // % do tamanho do candle sinal
   RECUO_PONTOS     = 1     // Pontos
  };

enum ENUM_FILTRO_TENDENCIA
  {
   TEND_DESLIGADO    = 0,   // Desligado (qualquer direção)
   TEND_SEMPRE       = 1,   // Só a favor da tendência
   TEND_APOS_HORARIO = 2    // Livre até o horário, depois só a favor
  };

input group "Sinal"
input ENUM_TIMEFRAMES      InpTimeframe     = PERIOD_M5;          // Tempo gráfico do sinal
input ENUM_REF_FECHAMENTO  InpRefFechamento = REF_MAXIMA_MINIMA;  // Referência do fechamento
input double               InpCorpoMinPct   = 50.0;               // Corpo maior que X% do candle (50 = corpo > pavios)
input double               InpTamanhoMax    = 500;                // Tamanho máximo do candle sinal (pontos)
input double               InpTamanhoMin    = 0;                  // Tamanho mínimo do candle sinal (pontos, 0 = sem filtro)

input group "Entrada"
input ENUM_MODO_ENTRADA    InpModoEntrada   = ENTRADA_ABERTURA;   // Modo de entrada
input double               InpRecuo         = 10.0;               // Modo retorno: recuo mínimo antes de entrar
input ENUM_UNIDADE_RECUO   InpUnidadeRecuo  = RECUO_PCT_CANDLE;   // Modo retorno: unidade do recuo

input group "Tendência (topos e fundos)"
input ENUM_FILTRO_TENDENCIA InpFiltroTendencia = TEND_DESLIGADO;  // Filtro de tendência
input string               InpHorarioTendencia = "13:00";         // A partir de quando exige tendência (modo "depois do horário")
input int                  InpPivotForca    = 2;                  // Candles de cada lado para confirmar topo/fundo
input int                  InpTendJanela    = 60;                 // Candles analisados para achar topos e fundos

input group "Stop e alvos"
input int                  InpStopFolgaTicks  = 1;                // Stop: ticks além da mín/máx do candle sinal
input double               InpParcialPts      = 40;               // Parcial (pontos, 0 = sem parcial)
input double               InpParcialPct      = 50;               // Tamanho da parcial (% da posição)
input bool                 InpZeroAposParcial = true;             // Stop no 0x0 ao bater a parcial
input double               InpAlvoPts         = 180;              // Alvo final (pontos)

input group "Horários"
input string               InpInicio        = "09:15";            // Início das entradas
input string               InpUltimaEntrada = "13:00";            // Última entrada
input string               InpZerar         = "17:30";            // Zera posição
input string               InpHorariosBloq  = "09:30,10:00,10:30,11:00,11:30"; // Horários sem entrada
input int                  InpMargemBloqMin = 5;                  // Minutos antes/depois de cada horário bloqueado

input group "Gestão diária"
input double               InpContratos     = 2;                  // Contratos por entrada
input double               InpMetaDiaPts    = 500;                // Meta do dia (pontos, 0 = sem meta)
input double               InpLossDiaPts    = 500;                // Loss máximo do dia (pontos, 0 = sem limite)
input int                  InpMaxOperacoes  = 0;                  // Máximo de operações no dia (0 = sem limite)
input ulong                InpMagic         = 2026100;            // Número mágico

CTrade   trade;
datetime g_ultimoCandle  = 0;
double   g_stopPlanejado = 0;     // stop da entrada em andamento, aplicado assim que a posição abre
bool     g_parcialFeita  = false;
bool     g_avisouSemStop = false;
int      g_retornoDir    = 0;     // modo retorno: 1 compra / -1 venda armada no candle atual
double   g_retornoPreco  = 0;     // abertura do candle, onde a entrada acontece
double   g_retornoRecuo  = 0;     // recuo mínimo, em preço
bool     g_recuou        = false;
double   g_precoReferencia = 0;   // preço no envio da ordem, reserva se a posição vier sem preço
int      g_falhasStop    = 0;
bool     g_hedging       = false;
double   g_tick          = 0;
int      g_minInicio, g_minUltima, g_minZerar, g_minTendencia;
int      g_bloqueados[];

//+------------------------------------------------------------------+
int OnInit()
  {
   g_tick = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(g_tick <= 0)
     {
      Print("Tick size inválido para ", _Symbol);
      return INIT_FAILED;
     }

   g_minInicio = ParseHora(InpInicio);
   g_minUltima = ParseHora(InpUltimaEntrada);
   g_minZerar  = ParseHora(InpZerar);
   g_minTendencia = ParseHora(InpHorarioTendencia);
   if(g_minInicio < 0 || g_minUltima < 0 || g_minZerar < 0 || g_minTendencia < 0)
     {
      Print("Horário inválido. Use o formato HH:MM.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(InpPivotForca < 1 || InpTendJanela <= 2 * InpPivotForca)
     {
      Print("Força do pivô precisa ser >= 1 e a janela maior que o dobro dela.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(!ParseHorariosBloqueados(InpHorariosBloq))
      return INIT_PARAMETERS_INCORRECT;

   if(AjustarVolume(InpContratos) <= 0 || InpAlvoPts <= 0 || InpStopFolgaTicks < 0)
     {
      Print("Contratos, alvo ou folga do stop inválidos.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(MathMod(AjustarVolume(InpContratos), 2) != 0)
     {
      Print("Contratos precisam ser pares.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(InpModoEntrada == ENTRADA_RETORNO && InpRecuo <= 0)
     {
      Print("O recuo do modo retorno precisa ser maior que zero.");
      return INIT_PARAMETERS_INCORRECT;
     }

   g_hedging = (AccountInfoInteger(ACCOUNT_MARGIN_MODE) == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING);
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetTypeFillingBySymbol(_Symbol);

   // Não entra no meio de um candle já aberto: espera o próximo.
   g_ultimoCandle = iTime(_Symbol, InpTimeframe, 0);

   // Se o robô reiniciar com a posição já reduzida, a parcial já foi feita.
   ulong t; long tipo; double vol, preco, sl, tp;
   if(BuscarPosicao(t, tipo, vol, preco, sl, tp) && vol < AjustarVolume(InpContratos))
      g_parcialFeita = true;

   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   int minutoAgora = MinutoDoDia(TimeCurrent());

   GerenciarPosicao(minutoAgora);
   if(minutoAgora >= g_minZerar)
     {
      CancelarPendentes();
      g_retornoDir = 0;
     }

   datetime abertura = iTime(_Symbol, InpTimeframe, 0);
   if(abertura == 0)
      return;
   if(g_ultimoCandle == 0)
      g_ultimoCandle = abertura;
   else if(abertura != g_ultimoCandle)
     {
      g_ultimoCandle = abertura;
      NovoCandle(abertura);   // a entrada por retorno de um candle não passa para o seguinte
      return;
     }

   MonitorarRetorno();
  }

//+------------------------------------------------------------------+
//| Roda uma vez na abertura de cada candle                          |
//+------------------------------------------------------------------+
void NovoCandle(datetime abertura)
  {
   CancelarPendentes();   // a entrada por retorno só vale durante um candle
   g_retornoDir = 0;

   ulong t; long tipo; double vol, preco, sl, tp;
   if(BuscarPosicao(t, tipo, vol, preco, sl, tp))
      return;             // uma operação por vez

   int minuto = MinutoDoDia(abertura);
   if(minuto < g_minInicio || minuto > g_minUltima || minuto >= g_minZerar)
      return;
   if(HorarioBloqueado(minuto))
      return;

   // Candle sinal (1) e anterior (2) precisam ser do mesmo pregão.
   datetime t1 = iTime(_Symbol, InpTimeframe, 1);
   datetime t2 = iTime(_Symbol, InpTimeframe, 2);
   if(t1 == 0 || t2 == 0 || !MesmoDia(t1, t2) || !MesmoDia(t1, abertura))
      return;

   double pontosDia;
   int    operacoes;
   ResultadoDoDia(pontosDia, operacoes);
   if(InpMetaDiaPts > 0 && pontosDia >= InpMetaDiaPts)
      return;
   if(InpLossDiaPts > 0 && pontosDia <= -InpLossDiaPts)
      return;
   if(InpMaxOperacoes > 0 && operacoes >= InpMaxOperacoes)
      return;

   int direcao = Sinal();
   if(direcao == 0)
      return;

   bool exigeTendencia = (InpFiltroTendencia == TEND_SEMPRE) ||
                         (InpFiltroTendencia == TEND_APOS_HORARIO && minuto >= g_minTendencia);
   if(exigeTendencia && Tendencia() != direcao)
      return;

   Entrar(direcao);
   GerenciarPosicao(MinutoDoDia(TimeCurrent()));   // coloca stop e alvo sem esperar o próximo tick
  }

//+------------------------------------------------------------------+
//| Tendência por topos e fundos: 1 = alta, -1 = baixa, 0 = sem      |
//| tendência clara. Alta = últimos 2 topos e 2 fundos ascendentes.  |
//+------------------------------------------------------------------+
int Tendencia()
  {
   double topos[2], fundos[2];
   int    nTopos = 0, nFundos = 0;

   // [0] é o mais recente. Começa em força+1: o pivô precisa de candles fechados dos dois lados.
   for(int i = InpPivotForca + 1; i <= InpTendJanela && (nTopos < 2 || nFundos < 2); i++)
     {
      if(nTopos < 2 && EhTopo(i))
         topos[nTopos++] = iHigh(_Symbol, InpTimeframe, i);
      if(nFundos < 2 && EhFundo(i))
         fundos[nFundos++] = iLow(_Symbol, InpTimeframe, i);
     }
   if(nTopos < 2 || nFundos < 2)
      return 0;

   if(topos[0] > topos[1] && fundos[0] > fundos[1])
      return 1;
   if(topos[0] < topos[1] && fundos[0] < fundos[1])
      return -1;
   return 0;
  }

// Topo: máxima maior que a dos N candles de cada lado.
bool EhTopo(int i)
  {
   double h = iHigh(_Symbol, InpTimeframe, i);
   for(int k = 1; k <= InpPivotForca; k++)
      if(iHigh(_Symbol, InpTimeframe, i - k) >= h || iHigh(_Symbol, InpTimeframe, i + k) > h)
         return false;
   return true;
  }

// Fundo: mínima menor que a dos N candles de cada lado.
bool EhFundo(int i)
  {
   double l = iLow(_Symbol, InpTimeframe, i);
   for(int k = 1; k <= InpPivotForca; k++)
      if(iLow(_Symbol, InpTimeframe, i - k) <= l || iLow(_Symbol, InpTimeframe, i + k) < l)
         return false;
   return true;
  }

//+------------------------------------------------------------------+
//| 1 = compra, -1 = venda, 0 = sem sinal                            |
//+------------------------------------------------------------------+
int Sinal()
  {
   double o1 = iOpen(_Symbol, InpTimeframe, 1);
   double h1 = iHigh(_Symbol, InpTimeframe, 1);
   double l1 = iLow(_Symbol, InpTimeframe, 1);
   double c1 = iClose(_Symbol, InpTimeframe, 1);
   double h2 = iHigh(_Symbol, InpTimeframe, 2);
   double l2 = iLow(_Symbol, InpTimeframe, 2);
   double c2 = iClose(_Symbol, InpTimeframe, 2);

   double tamanho = h1 - l1;
   if(tamanho <= 0)
      return 0;
   if(InpTamanhoMax > 0 && tamanho > InpTamanhoMax)
      return 0;
   if(InpTamanhoMin > 0 && tamanho < InpTamanhoMin)
      return 0;

   double corpo = MathAbs(c1 - o1);
   if(corpo * 100.0 <= InpCorpoMinPct * tamanho)
      return 0;

   if(c1 > o1)
     {
      double ref = (InpRefFechamento == REF_MAXIMA_MINIMA) ? h2 : c2;
      if(c1 > ref)
         return 1;
     }
   if(c1 < o1)
     {
      double ref = (InpRefFechamento == REF_MAXIMA_MINIMA) ? l2 : c2;
      if(c1 < ref)
         return -1;
     }
   return 0;
  }

//+------------------------------------------------------------------+
void Entrar(int direcao)
  {
   double h1    = iHigh(_Symbol, InpTimeframe, 1);
   double l1    = iLow(_Symbol, InpTimeframe, 1);
   double folga = InpStopFolgaTicks * g_tick;
   double stop  = (direcao > 0) ? ArredondarPreco(l1 - folga) : ArredondarPreco(h1 + folga);
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double vol   = AjustarVolume(InpContratos);

   g_parcialFeita  = false;
   g_avisouSemStop = false;
   g_falhasStop    = 0;

   if(InpModoEntrada == ENTRADA_ABERTURA)
     {
      double preco = (direcao > 0) ? ask : bid;
      if((direcao > 0 && preco <= stop) || (direcao < 0 && preco >= stop))
         return;   // abriu com gap além do stop
      g_stopPlanejado   = stop;
      g_precoReferencia = preco;
      if(direcao > 0)
         trade.Buy(vol, _Symbol, 0, 0, 0, "abertura");
      else
         trade.Sell(vol, _Symbol, 0, 0, 0, "abertura");
      return;
     }

   // Retorno: arma a entrada. MonitorarRetorno espera o candle recuar e
   // coloca a ordem stop na abertura dele (= fechamento do candle sinal).
   double recuo = (InpUnidadeRecuo == RECUO_PCT_CANDLE) ? (h1 - l1) * InpRecuo / 100.0 : InpRecuo;
   g_stopPlanejado = stop;
   g_retornoDir    = direcao;
   g_retornoPreco  = ArredondarPreco(iOpen(_Symbol, InpTimeframe, 0));
   g_retornoRecuo  = MathMax(ArredondarPreco(recuo), g_tick);
   g_precoReferencia = g_retornoPreco;
   g_recuou        = false;
   MonitorarRetorno();
  }

//+------------------------------------------------------------------+
//| Modo retorno: recuou o mínimo -> ordem stop na abertura do candle |
//+------------------------------------------------------------------+
void MonitorarRetorno()
  {
   if(g_retornoDir == 0)
      return;

   ulong t; long tipo; double vol, preco, sl, tp;
   if(BuscarPosicao(t, tipo, vol, preco, sl, tp))
     {
      g_retornoDir = 0;   // entrou
      return;
     }

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   // Perdeu o candle sinal antes de entrar: setup invalidado.
   if((g_retornoDir > 0 && bid <= g_stopPlanejado) || (g_retornoDir < 0 && ask >= g_stopPlanejado))
     {
      CancelarPendentes();
      g_retornoDir = 0;
      return;
     }

   if(g_recuou)
      return;   // ordem stop já está na abertura

   bool recuou = (g_retornoDir > 0) ? bid <= g_retornoPreco - g_retornoRecuo
                                    : ask >= g_retornoPreco + g_retornoRecuo;
   if(!recuou)
      return;

   g_recuou = true;
   double volume = AjustarVolume(InpContratos);
   if(g_retornoDir > 0)
     {
      if(ask >= g_retornoPreco)
         trade.Buy(volume, _Symbol, 0, 0, 0, "retorno");
      else
         trade.BuyStop(volume, g_retornoPreco, _Symbol, 0, 0, TipoValidade(), 0, "retorno");
     }
   else
     {
      if(bid <= g_retornoPreco)
         trade.Sell(volume, _Symbol, 0, 0, 0, "retorno");
      else
         trade.SellStop(volume, g_retornoPreco, _Symbol, 0, 0, TipoValidade(), 0, "retorno");
     }
  }

//+------------------------------------------------------------------+
//| Stop e alvo, parcial, 0x0 e zeragem por horário                  |
//+------------------------------------------------------------------+
void GerenciarPosicao(int minutoAgora)
  {
   ulong ticket; long tipo; double volume, preco, sl, tp;
   if(!BuscarPosicao(ticket, tipo, volume, preco, sl, tp))
     {
      g_parcialFeita = false;
      return;
     }

   if(minutoAgora >= g_minZerar)
     {
      trade.PositionClose(ticket);
      return;
     }

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   // Stop e alvo entram logo após a execução, a partir do preço executado.
   if(sl == 0 && tp == 0)
     {
      if(g_stopPlanejado <= 0)
        {
         if(!g_avisouSemStop)
            Print("Posição sem stop e sem stop planejado. Coloque o stop manualmente.");
         g_avisouSemStop = true;
         return;
        }
      if((tipo == POSITION_TYPE_BUY && bid <= g_stopPlanejado) ||
         (tipo == POSITION_TYPE_SELL && ask >= g_stopPlanejado))
        {
         trade.PositionClose(ticket);   // executou além do stop
         return;
        }
      double alvo = (tipo == POSITION_TYPE_BUY) ? preco + InpAlvoPts : preco - InpAlvoPts;
      bool ok = preco > 0 && trade.PositionModify(ticket, g_stopPlanejado, ArredondarPreco(alvo)) &&
                trade.ResultRetcode() == TRADE_RETCODE_DONE;
      if(!ok && ++g_falhasStop >= 5)
        {
         // Posição sem stop não fica aberta.
         PrintFormat("Não consegui colocar stop e alvo (preço de entrada %.2f). Zerando por segurança.", preco);
         trade.PositionClose(ticket);
        }
      return;
     }

   // Na B3 o stop/alvo da posição nem sempre é executado pelo MT5 (no testador,
   // o preço passou pelos dois e a posição ficou aberta). O robô confere a cada
   // tick e zera a mercado. O stop/alvo da posição fica como proteção extra.
   bool bateuStop = (tipo == POSITION_TYPE_BUY) ? bid <= sl : ask >= sl;
   bool bateuAlvo = tp > 0 && ((tipo == POSITION_TYPE_BUY) ? bid >= tp : ask <= tp);
   if((sl > 0 && bateuStop) || bateuAlvo)
     {
      trade.PositionClose(ticket);
      return;
     }

   if(g_parcialFeita || InpParcialPts <= 0)
      return;

   bool bateuParcial = (tipo == POSITION_TYPE_BUY) ? bid >= preco + InpParcialPts
                                                   : ask <= preco - InpParcialPts;
   if(!bateuParcial)
      return;

   double volParcial = AjustarVolume(AjustarVolume(InpContratos) * InpParcialPct / 100.0);
   if(volParcial > 0 && volParcial < volume)
      if(!FecharParcial(ticket, tipo, volParcial))
         return;   // tenta de novo no próximo tick

   g_parcialFeita = true;
   if(InpZeroAposParcial)
      trade.PositionModify(ticket, ArredondarPreco(preco), tp);
  }

//+------------------------------------------------------------------+
bool FecharParcial(ulong ticket, long tipo, double vol)
  {
   if(g_hedging)
      return trade.PositionClosePartial(ticket, vol);
   // Netting (B3): a ordem contrária reduz a posição.
   if(tipo == POSITION_TYPE_BUY)
      return trade.Sell(vol, _Symbol, 0, 0, 0, "parcial");
   return trade.Buy(vol, _Symbol, 0, 0, 0, "parcial");
  }

//+------------------------------------------------------------------+
//| Resultado do dia em pontos, só das posições abertas pelo robô    |
//+------------------------------------------------------------------+
void ResultadoDoDia(double &pontos, int &operacoes)
  {
   pontos    = 0;
   operacoes = 0;
   if(!HistorySelect(InicioDoDia(TimeCurrent()), TimeCurrent() + 60))
      return;

   long ids[];
   int  total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0 || HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;
      if(HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN &&
         (ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) == InpMagic)
        {
         int n = ArraySize(ids);
         ArrayResize(ids, n + 1);
         ids[n] = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
         operacoes++;
        }
     }

   // R$ por ponto por contrato (WIN: 0,20 / WDO: 10,00)
   double valorPonto = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE) / g_tick;
   if(valorPonto <= 0)
      return;

   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0 || HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;
      if(HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
         continue;
      long id = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
      for(int k = 0; k < ArraySize(ids); k++)
         if(ids[k] == id)
           {
            pontos += HistoryDealGetDouble(deal, DEAL_PROFIT) / valorPonto;
            break;
           }
     }

   // Pontos pelo preço médio: parcial de 40 + final de 180 = 110.
   pontos /= AjustarVolume(InpContratos);
  }

//+------------------------------------------------------------------+
//| Utilitários                                                      |
//+------------------------------------------------------------------+
bool BuscarPosicao(ulong &ticket, long &tipo, double &volume, double &preco, double &sl, double &tp)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0 || PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      ticket = t;
      tipo   = PositionGetInteger(POSITION_TYPE);
      volume = PositionGetDouble(POSITION_VOLUME);
      preco  = PositionGetDouble(POSITION_PRICE_OPEN);
      sl     = PositionGetDouble(POSITION_SL);
      tp     = PositionGetDouble(POSITION_TP);
      // Na série contínua da B3 a posição pode vir com preço de abertura zerado.
      // Busca o preço no negócio de entrada e, em último caso, usa o preço do envio.
      if(preco <= 0)
         preco = PrecoDaEntrada(PositionGetInteger(POSITION_IDENTIFIER));
      if(preco <= 0)
         preco = g_precoReferencia;
      return true;
     }
   return false;
  }

double PrecoDaEntrada(long idPosicao)
  {
   if(!HistorySelectByPosition(idPosicao))
      return 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal > 0 && HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
        {
         double p = HistoryDealGetDouble(deal, DEAL_PRICE);
         if(p > 0)
            return p;
        }
     }
   return 0;
  }

void CancelarPendentes()
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong t = OrderGetTicket(i);
      if(t == 0 || OrderGetString(ORDER_SYMBOL) != _Symbol)
         continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) == InpMagic)
         trade.OrderDelete(t);
     }
  }

ENUM_ORDER_TYPE_TIME TipoValidade()
  {
   int modos = (int)SymbolInfoInteger(_Symbol, SYMBOL_EXPIRATION_MODE);
   return ((modos & SYMBOL_EXPIRATION_DAY) != 0) ? ORDER_TIME_DAY : ORDER_TIME_GTC;
  }

double ArredondarPreco(double p)
  {
   return NormalizeDouble(MathRound(p / g_tick) * g_tick, _Digits);
  }

double AjustarVolume(double v)
  {
   double passo  = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minimo = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   if(passo <= 0)
      passo = 1;
   v = MathFloor(v / passo + 1e-9) * passo;
   if(v < minimo)
      return 0;
   return NormalizeDouble(v, 8);
  }

// Bloqueia entradas de (horário - margem) até antes de (horário + margem).
// Margem 5 em 09:30: não entra 09:25 nem 09:30; 09:35 já pode.
bool HorarioBloqueado(int minuto)
  {
   for(int i = 0; i < ArraySize(g_bloqueados); i++)
      if(minuto >= g_bloqueados[i] - InpMargemBloqMin && minuto < g_bloqueados[i] + InpMargemBloqMin)
         return true;
   return false;
  }

bool ParseHorariosBloqueados(string lista)
  {
   ArrayResize(g_bloqueados, 0);
   StringTrimLeft(lista);
   StringTrimRight(lista);
   if(lista == "")
      return true;

   string itens[];
   int n = StringSplit(lista, ',', itens);
   for(int i = 0; i < n; i++)
     {
      int m = ParseHora(itens[i]);
      if(m < 0)
        {
         PrintFormat("Horário bloqueado inválido: '%s'", itens[i]);
         return false;
        }
      int k = ArraySize(g_bloqueados);
      ArrayResize(g_bloqueados, k + 1);
      g_bloqueados[k] = m;
     }
   return true;
  }

int ParseHora(string s)
  {
   StringTrimLeft(s);
   StringTrimRight(s);
   string p[];
   if(StringSplit(s, ':', p) != 2)
      return -1;
   int h = (int)StringToInteger(p[0]);
   int m = (int)StringToInteger(p[1]);
   if(h < 0 || h > 23 || m < 0 || m > 59)
      return -1;
   return h * 60 + m;
  }

int MinutoDoDia(datetime t)
  {
   MqlDateTime d;
   TimeToStruct(t, d);
   return d.hour * 60 + d.min;
  }

datetime InicioDoDia(datetime t)
  {
   MqlDateTime d;
   TimeToStruct(t, d);
   d.hour = 0;
   d.min  = 0;
   d.sec  = 0;
   return StructToTime(d);
  }

bool MesmoDia(datetime a, datetime b)
  {
   return InicioDoDia(a) == InicioDoDia(b);
  }
//+------------------------------------------------------------------+
