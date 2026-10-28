//+------------------------------------------------------------------+
//|                                                 CohenScalper.mq5 |
//|  Scalper de price action: candle de força, entrada no candle     |
//|  seguinte, parcial com stop no 0x0 e alvo final.                 |
//|  v1 - para backtest e conta demo.                                |
//+------------------------------------------------------------------+
// Versão do aluno: compile o arquivo do aluno, que define VERSAO_ALUNO e o nome
// do robô antes de incluir este. Nela a estratégia fica fixa (só a chave e os
// contratos são editáveis) e os logs, os comentários das ordens e a descrição
// não mostram a regra.
#ifdef VERSAO_ALUNO
   #ifndef NOME_ROBO
      #define NOME_ROBO "Robo"
   #endif
   #define PARAM     const
   #define DETALHES  false
   #define COMENT(x) NOME_ROBO
   #property copyright   "Rodrigo Cohen - Trader Nation"
   #property description "Robô de day trade para o mini índice (WIN), gráfico de 5 minutos."
#else
   #define PARAM     input
   #define DETALHES  true
   #define COMENT(x) x
   #define NOME_ROBO "CohenScalper"
   #property copyright   "Rodrigo Cohen"
   #property description "Candle de força + entrada no candle seguinte. Parcial, 0x0 e alvo final."
#endif
#property version   "1.40"

#include <Trade\Trade.mqh>

// Segredo das chaves de licença (LIC_SEGREDO). Fica fora do git: copie o
// CohenLicenca.mqh recebido para a mesma pasta deste arquivo antes de compilar.
#include "CohenLicenca.mqh"

#ifdef VERSAO_ALUNO
// Licença online: o robô pergunta ao painel (robos.tradernation.com.br), pelo
// número da conta, se pode abrir operação e com quantos contratos. A chave
// offline continua valendo quando o painel não tem licença para a conta. O
// segredo fica no CohenLicencaSegredo.mqh, fora do git.
#define LIC_URL    "https://robos.tradernation.com.br"
#define LIC_ROBO   "CohenScalper"
#define LIC_VERSAO "1.1"
#include "CohenLicencaOnline.mqh"
#endif

enum ENUM_FORCA
  {
   FORCA_CORPO          = 0,   // Corpo maior que X% do candle
   FORCA_PONTA          = 1,   // Fechou na ponta (martelo vale)
   FORCA_CORPO_OU_PONTA = 2    // Qualquer um dos dois
  };

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
   RECUO_PONTOS     = 1,    // Pontos
   RECUO_FVG        = 2     // Até a máx/mín do candle anterior ao sinal (fecha o FVG)
  };

enum ENUM_FILTRO_TENDENCIA
  {
   TEND_DESLIGADO    = 0,   // Desligado (qualquer direção)
   TEND_SEMPRE       = 1,   // Só a favor da tendência
   TEND_APOS_HORARIO = 2    // Livre até o horário, depois só a favor
  };

#ifndef VERSAO_ALUNO
input group "Licença"
#endif
#ifdef VERSAO_ALUNO
input string               InpChave         = "";                 // Chave de licença
#else
input string               InpChave         = "";                 // Chave de licença (só conta real; demo e testador são livres)
#endif

#ifndef VERSAO_ALUNO
input group "Sinal"
#endif
PARAM ENUM_TIMEFRAMES      InpTimeframe     = PERIOD_M5;          // Tempo gráfico do sinal
PARAM ENUM_REF_FECHAMENTO  InpRefFechamento = REF_MAXIMA_MINIMA;  // Referência do fechamento
PARAM ENUM_FORCA           InpForca         = FORCA_CORPO_OU_PONTA; // Força do candle sinal
PARAM double               InpCorpoMinPct   = 50.0;               // Corpo maior que X% do candle (50 = corpo > pavios)
PARAM double               InpPontaPct      = 33.0;               // Fechou na ponta: no máximo X% do candle entre o fechamento e a máx (compra) / mín (venda)
PARAM double               InpTamanhoMax    = 1000;               // Tamanho máximo do candle sinal (pontos)
PARAM double               InpTamanhoMin    = 0;                  // Tamanho mínimo do candle sinal (pontos, 0 = sem filtro)

#ifndef VERSAO_ALUNO
input group "Entrada"
#endif
PARAM ENUM_MODO_ENTRADA    InpModoEntrada   = ENTRADA_RETORNO;    // Modo de entrada
PARAM double               InpRecuo         = 10.0;               // Modo retorno: recuo mínimo antes de entrar
PARAM ENUM_UNIDADE_RECUO   InpUnidadeRecuo  = RECUO_PCT_CANDLE;   // Modo retorno: unidade do recuo
PARAM bool                 InpEntrarNoRecuo = false;              // Modo retorno: entrar limitado no ponto do recuo (sem esperar voltar)

#ifndef VERSAO_ALUNO
input group "Tendência (topos e fundos)"
#endif
PARAM ENUM_FILTRO_TENDENCIA InpFiltroTendencia = TEND_DESLIGADO;  // Filtro de tendência
PARAM string               InpHorarioTendencia = "13:00";         // A partir de quando exige tendência (modo "depois do horário")
PARAM int                  InpPivotForca    = 2;                  // Candles de cada lado para confirmar topo/fundo
PARAM int                  InpTendJanela    = 60;                 // Candles analisados para achar topos e fundos

#ifndef VERSAO_ALUNO
input group "Stop e alvos"
#endif
PARAM int                  InpStopFolgaTicks  = 1;                // Stop: ticks além da mín/máx do candle sinal
PARAM double               InpParcialPts      = 60;               // Parcial (pontos, 0 = sem parcial)
PARAM double               InpParcialPct      = 50;               // Tamanho da parcial (% da posição)
PARAM bool                 InpZeroAposParcial = true;             // Stop no 0x0 ao bater a parcial
PARAM double               InpAlvoPts         = 80;               // Alvo final (pontos)
PARAM bool                 InpAlvoLimitado    = true;             // Alvo final como ordem limitada no livro (sai no preço do alvo)

#ifndef VERSAO_ALUNO
input group "Horários"
#endif
PARAM string               InpInicio        = "09:15";            // Início das entradas
PARAM int                  InpUltimaEntrada = 1300;               // Última entrada (HHMM, ex.: 1300 = 13:00; otimizável)
PARAM string               InpZerar         = "17:30";            // Zera posição
PARAM bool                 InpBloquearHorarios = false;           // Não entrar nos horários abaixo
PARAM string               InpHorariosBloq  = "09:30,10:00,10:30,11:00,11:30"; // Horários sem entrada
PARAM int                  InpMargemBloqMin = 5;                  // Minutos antes/depois de cada horário bloqueado

#ifndef VERSAO_ALUNO
input group "Gestão diária"
#endif
input double               InpContratos     = 2;                  // Contratos por entrada
PARAM double               InpMetaDiaPts    = 1500;               // Meta do dia (pontos, 0 = sem meta)
PARAM double               InpLossDiaPts    = 500;                // Loss máximo do dia (pontos, 0 = sem limite)
PARAM int                  InpMaxOperacoes  = 0;                  // Máximo de operações no dia (0 = sem limite)
PARAM int                  InpMaxStopsDia   = 2;                  // Para no dia depois de N stops (perda > 30 pts; 0 = sem limite)
PARAM ulong                InpMagic         = 2026100;            // Número mágico
PARAM bool                 InpRegistrarDecisoes = false;          // Escrever no Diário o motivo de cada candle
PARAM bool                 InpGravarCSV     = false;              // Gravar as operações em CSV (pasta Common/Files)

#ifndef VERSAO_ALUNO
input group "Reentrada"
#endif
PARAM int                  InpMaxReentradas = 0;                  // Reentradas por sinal depois de sair no 0x0 (0 = desligado)
PARAM int                  InpReentradaMin  = 5;                  // Minutos para o preço voltar à entrada

CTrade   trade;
double   g_contratos     = 0;     // contratos por entrada, já limitados pela licença
bool     g_avisouLicenca = false;
long     g_licConta      = 0;     // dados da chave de licença
datetime g_licValidade   = 0;     // último dia de uso (00:00)
int      g_licMax        = 0;
datetime g_ultimoCandle  = 0;
double   g_stopPlanejado = 0;     // stop da entrada em andamento, aplicado assim que a posição abre
bool     g_parcialFeita  = false;
bool     g_avisouSemStop = false;
int      g_retornoDir    = 0;     // modo retorno: 1 compra / -1 venda armada no candle atual
double   g_retornoPreco  = 0;     // abertura do candle, onde a entrada acontece
double   g_retornoRecuo  = 0;     // recuo mínimo, em preço
bool     g_recuou        = false;
bool     g_retornoNoRobo = false;  // ordem stop recusada: o robô entra quando o último voltar à abertura
double   g_retornoExtremo = 0;    // até onde o preço recuou enquanto a entrada estava armada
double   g_precoReferencia = 0;   // preço no envio da ordem, reserva se a posição vier sem preço
int      g_falhasStop    = 0;
bool     g_hedging       = false;
double   g_tick          = 0;
int      g_minInicio, g_minUltima, g_minZerar, g_minTendencia;
int      g_bloqueados[];

// Livro próprio de operações, em pontos pelo preço executado (RESUMO no Diário e CSV opcional).
long     g_posId         = 0;     // posição acompanhada
double   g_posStop       = 0;     // stop inicial dela
double   g_mfe           = 0;     // maior lucro a favor durante a operação (pontos)
double   g_mae           = 0;     // maior recuo contra durante a operação (pontos)
string   g_motivoSaida   = "";
double   g_sinalTamanho  = 0, g_sinalCorpo = 0;
int      g_sinalTendencia = 0;
int      g_arquivo       = INVALID_HANDLE;
string   g_nomeArquivo   = "";
int      g_totalOps = 0, g_ganhos = 0, g_perdas = 0, g_zeros = 0;
double   g_totalPts = 0, g_ptsGanhos = 0, g_ptsPerdas = 0, g_pico = 0, g_maxDD = 0;
double   g_maiorGanho = 0, g_maiorPerda = 0;          // operação, em pontos pelo preço médio
string   g_descMaiorGanho = "", g_descMaiorPerda = "";
int      g_reOps = 0, g_viradas = 0;
double   g_rePts = 0;

// Diagnóstico da série (só mede, não muda nada na operação). Nas séries contínuas
// o último negócio e o bid/ask às vezes vêm de lugares diferentes: a ordem stop
// dispara pelo último e executa pelo bid/ask, a centenas de pontos do gatilho.
int      g_ticksDiag = 0, g_ticksIncoerentes = 0;
double   g_maiorIncoerencia = 0;
datetime g_tMaiorIncoerencia = 0;
int      g_execDiag = 0, g_execLonge = 0, g_execSemOrdem = 0;
double   g_desvioTotal = 0, g_desvioLonge = 0;   // pontos pelo preço médio; + = contra, - = a favor

// Reentrada: saiu no 0x0 depois da parcial e o preço voltou à entrada -> entra de novo,
// mesmo sinal, mesmo stop, mesma parcial e mesmo alvo.
int      g_reDir         = 0;
double   g_rePreco       = 0;
double   g_reStop        = 0;
datetime g_reAte         = 0;
int      g_reRestantes   = 0;
bool     g_entradaReentrada = false;   // a próxima posição é uma reentrada
bool     g_posReentrada  = false;      // a posição acompanhada é uma reentrada

// Saídas sem corrida com o servidor (v1.28).
double   g_volAntesParcial = 0;        // volume quando a parcial foi enviada
datetime g_tParcial      = 0;          // quando a parcial foi enviada
datetime g_tCruzou       = 0;          // desde quando o preço está além do stop/alvo do servidor
int      g_posDir        = 0;          // direção da posição acompanhada
int      g_ultimaDir     = 0;          // direção da última posição fechada
datetime g_tUltimoFechamento = 0;      // quando a última posição fechou
ulong    g_ticketParcial = 0;          // ordem limitada da parcial, pendente no servidor
int      g_falhasParcial = 0;          // recusas da ordem limitada nesta posição
ulong    g_ticketAlvo    = 0;          // ordem limitada do alvo final, pendente no servidor
bool     g_alvoColocado  = false;      // o alvo limitado desta posição já foi colocado
int      g_falhasAlvo    = 0;          // recusas da ordem limitada do alvo nesta posição

//+------------------------------------------------------------------+
int OnInit()
  {
   g_contratos = InpContratos;
#ifdef VERSAO_ALUNO
   // Versão do aluno: nada de testador (os trades mostrariam a regra) e só no
   // contrato vigente do mini índice.
   if(MQLInfoInteger(MQL_TESTER) || MQLInfoInteger(MQL_OPTIMIZATION))
     {
      Print(NOME_ROBO + " não roda no testador de estratégia.");
      return INIT_FAILED;
     }
   if(StringFind(_Symbol, "WIN") != 0 || StringFind(_Symbol, "$") >= 0)
     {
      Alert(NOME_ROBO + ": use o gráfico do mini índice do vencimento atual (ex.: WINZ26), tempo M5.");
      return INIT_FAILED;
     }
#endif
#ifdef VERSAO_ALUNO
   // Sem licença o robô não sai do gráfico: fica parado, mostrando o motivo no
   // canto do gráfico, e confere a licença online a cada 2 minutos.
   int ctChave;
   if(ChaveOffline(ctChave))
      PrintFormat("Chave da conta %I64d válida até %s, até %d contratos.",
                  g_licConta, TimeToString(g_licValidade, TIME_DATE), g_licMax);
   else if(StringLen(InpChave) > 0)
      Print(NOME_ROBO + ": a chave informada não vale para esta conta (inválida, de outra conta ou vencida).");
   LicOnline_Init();
   EventSetTimer(60);
   MostrarLicenca();
#else
   if(LicencaAplica())
     {
      if(!LerChave(InpChave))
        {
         Alert(NOME_ROBO + ": chave de licença inválida. Confira a chave em Parâmetros ou fale com o suporte da Trader Nation.");
         return INIT_FAILED;
        }
      if(AccountInfoInteger(ACCOUNT_LOGIN) != g_licConta)
        {
         Alert(NOME_ROBO + StringFormat(": a chave é da conta %I64d e esta é a conta %I64d. Fale com o suporte da Trader Nation.",
                            g_licConta, AccountInfoInteger(ACCOUNT_LOGIN)));
         return INIT_FAILED;
        }
      if(g_licMax > 0 && g_contratos > g_licMax)
        {
         PrintFormat("Licença permite até %d contratos: operando com %d.", g_licMax, g_licMax);
         g_contratos = g_licMax;
        }
      if(LicencaVencida())
         Alert(NOME_ROBO + StringFormat(": licença vencida em %s. O robô só termina de cuidar da posição aberta e não abre novas operações.",
                            TimeToString(g_licValidade, TIME_DATE)));
      else
         PrintFormat("Licença da conta %I64d válida até %s, até %d contratos.",
                     g_licConta, TimeToString(g_licValidade, TIME_DATE), g_licMax);
     }
   else if(StringLen(InpChave) > 0 && !MQLInfoInteger(MQL_TESTER))
     {
      // Demo: a chave não é exigida, mas é conferida para o cliente testar antes da conta real.
      if(LerChave(InpChave))
         PrintFormat("Conta demo: chave conferida, válida para a conta real %I64d até %s, até %d contratos.",
                     g_licConta, TimeToString(g_licValidade, TIME_DATE), g_licMax);
      else
         Print("Conta demo: a chave informada é inválida (na demo ela não é exigida).");
     }

#endif

   g_tick = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(g_tick <= 0)
     {
      Print("Tick size inválido para ", _Symbol);
      return INIT_FAILED;
     }

   g_minInicio = ParseHora(InpInicio);
   g_minUltima = (InpUltimaEntrada / 100 <= 23 && InpUltimaEntrada % 100 <= 59 && InpUltimaEntrada >= 0)
                 ? (InpUltimaEntrada / 100) * 60 + InpUltimaEntrada % 100 : -1;
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

   if(AjustarVolume(g_contratos) <= 0 || InpAlvoPts <= 0 || InpStopFolgaTicks < 0)
     {
      Print("Contratos, alvo ou folga do stop inválidos.");
      return INIT_PARAMETERS_INCORRECT;
     }
   if(MathMod(AjustarVolume(g_contratos), 2) != 0)
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

   // Ordens que ficaram de uma execução anterior (entrada ou parcial) não valem
   // mais: a parcial é recolocada no próximo tick se ainda houver posição.
   CancelarPendentes();

   // Se o robô reiniciar com a posição já reduzida, a parcial já foi feita.
   ulong t; long tipo; double vol, preco, sl, tp;
   if(BuscarPosicao(t, tipo, vol, preco, sl, tp))
     {
      if(vol < AjustarVolume(g_contratos))
         g_parcialFeita = true;
      // Recompilou ou reiniciou com posição aberta: recupera o stop guardado.
      if(GlobalVariableCheck(NomeStopGuardado()))
        {
         g_stopPlanejado = GlobalVariableGet(NomeStopGuardado());
         PrintFormat("Posição aberta encontrada: stop recuperado em %.0f", g_stopPlanejado);
        }
     }

   AbrirArquivo();
#ifdef VERSAO_ALUNO
   Print(NOME_ROBO + " carregado (versão interna 1.40)");
#else
   Print(NOME_ROBO + " v1.40 carregado");
#endif
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
#ifdef VERSAO_ALUNO
   EventKillTimer();
   Comment("");
#endif
   if(g_arquivo != INVALID_HANDLE)
      FileClose(g_arquivo);
   if(g_totalOps == 0 || !DETALHES)
      return;

   double fator = (g_ptsPerdas < 0) ? g_ptsGanhos / -g_ptsPerdas : 0;
   PrintFormat("RESUMO (pontos pelo preço médio, sem custos): %d operações | total %.0f pts | média %.1f pts | " +
               "ganhos %d, perdas %d, zeradas %d | fator de lucro %.2f | drawdown máximo %.0f pts",
               g_totalOps, g_totalPts, g_totalPts / g_totalOps, g_ganhos, g_perdas, g_zeros, fator, g_maxDD);
   double reaisPorPonto = ReaisPorPonto();
   if(reaisPorPonto > 0)
      PrintFormat("Em R$ com %.0f contratos: resultado %.2f | drawdown máximo %.2f (sem emolumentos)",
                  g_contratos, g_totalPts * reaisPorPonto * g_contratos, g_maxDD * reaisPorPonto * g_contratos);
   PrintFormat("Maior ganho: %s | maior perda: %s", g_descMaiorGanho, g_descMaiorPerda);
   if(g_reOps > 0)
      PrintFormat("Reentradas: %d operações, %.0f pts (já incluídas no total)", g_reOps, g_rePts);
   if(g_viradas > 0)
      PrintFormat("ATENÇÃO: %d posições atravessaram a noite e foram zeradas no dia seguinte", g_viradas);
   PrintFormat("Execução: %d execuções medidas (%d sem preço da ordem) | %d a mais de %.0f pts do preço da ordem, somando %.0f pts contra (negativo = a favor) | " +
               "desvio de todas: %.0f pts | resultado se executasse no preço da ordem: %.0f pts",
               g_execDiag, g_execSemOrdem, g_execLonge, DesvioLimite(), g_desvioLonge, g_desvioTotal, g_totalPts + g_desvioTotal);
   if(g_ticksDiag > 0)
      PrintFormat("Série: %d de %d ticks (%.2f%%) com último negócio fora do bid/ask por mais de %.0f pts | maior: %.0f pts em %s",
                  g_ticksIncoerentes, g_ticksDiag, 100.0 * g_ticksIncoerentes / g_ticksDiag, DesvioLimite(),
                  g_maiorIncoerencia, TimeToString(g_tMaiorIncoerencia, TIME_DATE | TIME_SECONDS));
   if(g_nomeArquivo != "")
      PrintFormat("Operações salvas em %s\\Files\\%s", TerminalInfoString(TERMINAL_COMMONDATA_PATH), g_nomeArquivo);
  }

// Critério para a otimização ("Máximo personalizado"): total de pontos.
double OnTester()
  {
   return g_totalPts;
  }

// Stop da operação guardado no terminal: sobrevive a recompilar, trocar
// parâmetros ou reiniciar o MT5 com a posição aberta.
string NomeStopGuardado()
  {
   return StringFormat("CohenScalper_%s_%I64u_stop", _Symbol, InpMagic);
  }

void GuardarStop()
  {
   if(!MQLInfoInteger(MQL_TESTER))
      GlobalVariableSet(NomeStopGuardado(), g_stopPlanejado);
  }

// Valor do ponto por contrato, pela tabela da B3.
double ReaisPorPonto()
  {
   if(StringFind(_Symbol, "WIN") == 0) return 0.20;
   if(StringFind(_Symbol, "WDO") == 0) return 10.00;
   if(StringFind(_Symbol, "IND") == 0) return 1.00;
   if(StringFind(_Symbol, "DOL") == 0) return 50.00;
   return 0;
  }

// Uma linha por operação. No testador recria o arquivo; em conta real acrescenta.
void AbrirArquivo()
  {
   if(!InpGravarCSV || MQLInfoInteger(MQL_OPTIMIZATION))
      return;
   bool testador = (bool)MQLInfoInteger(MQL_TESTER);
   g_nomeArquivo = "CohenScalper_" + _Symbol + (testador ? "_teste" : "") + ".csv";
   int modo = FILE_CSV | FILE_ANSI | FILE_COMMON | FILE_WRITE | (testador ? 0 : FILE_READ);
   g_arquivo = FileOpen(g_nomeArquivo, modo, ';');
   if(g_arquivo == INVALID_HANDLE)
     {
      PrintFormat("Não consegui criar o arquivo de operações (erro %d)", GetLastError());
      g_nomeArquivo = "";
      return;
     }
   if(FileSize(g_arquivo) == 0)
      FileWrite(g_arquivo, "data", "hora_entrada", "hora_saida", "direcao", "entrada", "stop_inicial", "risco_pts",
                "parcial", "saida_final", "motivo", "pontos_medios", "mfe_pts", "mae_pts",
                "tamanho_sinal", "corpo_pct", "tendencia", "modo_entrada");
   FileSeek(g_arquivo, 0, SEEK_END);
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   DiagnosticarTick();
   int minutoAgora = MinutoDoDia(TimeCurrent());

   GerenciarPosicao(minutoAgora);
   if(minutoAgora >= g_minZerar)
     {
      CancelarPendentes();
      g_retornoDir = 0;
      g_reDir = 0;
     }
   MonitorarReentrada(minutoAgora);

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
//| Reentrada no preço da entrada original depois de sair no 0x0     |
//+------------------------------------------------------------------+
void MonitorarReentrada(int minutoAgora)
  {
   if(g_reDir == 0)
      return;

   ulong t; long tipo; double vol, preco, sl, tp;
   if(BuscarPosicao(t, tipo, vol, preco, sl, tp))
     {
      g_reDir = 0;   // já está posicionado (sinal novo ou a própria reentrada)
      return;
     }

   double bid = PrecoRef();
   double ask = bid;
   bool perdeuSinal = (g_reDir > 0) ? bid <= g_reStop : ask >= g_reStop;
   if(TimeCurrent() > g_reAte || perdeuSinal || minutoAgora >= g_minUltima || minutoAgora >= g_minZerar)
     {
      g_reDir = 0;
      return;
     }

   bool voltou = (g_reDir > 0) ? ask <= g_rePreco : bid >= g_rePreco;
   if(!voltou)
      return;

   double pontosDia;
   int    operacoes, stops;
   ResultadoDoDia(pontosDia, operacoes, stops);
   if((InpMetaDiaPts > 0 && pontosDia >= InpMetaDiaPts) ||
      (InpLossDiaPts > 0 && pontosDia <= -InpLossDiaPts) ||
      (InpMaxOperacoes > 0 && operacoes >= InpMaxOperacoes) ||
      (InpMaxStopsDia > 0 && stops >= InpMaxStopsDia))
     {
      g_reDir = 0;
      return;
     }

   int direcao = g_reDir;
   g_reDir = 0;
   g_reRestantes--;
   g_stopPlanejado    = g_reStop;
   GuardarStop();
   g_precoReferencia  = (direcao > 0) ? ask : bid;
   g_parcialFeita     = false;
   g_avisouSemStop    = false;
   g_falhasStop       = 0;
   g_entradaReentrada = true;
   if(!LicencaPermiteEntrada())
     {
      g_reDir = 0;
      g_entradaReentrada = false;
      return;
     }

   Registrar(iTime(_Symbol, InpTimeframe, 0),
             StringFormat("REENTRADA %s em %.0f (voltou à entrada depois do 0x0, restam %d)",
                          direcao > 0 ? "compra" : "venda", g_rePreco, g_reRestantes));
   double volume = AjustarVolume(g_contratos);
   if(direcao > 0)
      trade.Buy(volume, _Symbol, 0, 0, 0, COMENT("reentrada"));
   else
      trade.Sell(volume, _Symbol, 0, 0, 0, COMENT("reentrada"));
   GerenciarPosicao(minutoAgora);
  }

//+------------------------------------------------------------------+
//| Roda uma vez na abertura de cada candle                          |
//+------------------------------------------------------------------+
void NovoCandle(datetime abertura)
  {
   if(g_retornoDir != 0)
      Registrar(abertura - PeriodSeconds(InpTimeframe),
                StringFormat("retorno não completou: abertura %.0f, precisava recuar até %.0f, %s chegou a %.0f%s",
                             g_retornoPreco,
                             g_retornoDir > 0 ? g_retornoPreco - g_retornoRecuo : g_retornoPreco + g_retornoRecuo,
                             g_retornoDir > 0 ? "bid" : "ask", g_retornoExtremo,
                             g_recuou ? " (recuou, mas não voltou à abertura)" : ""));
   CancelarPendentes();   // a entrada por retorno só vale durante um candle
   g_retornoDir = 0;

   // A entrada acontece durante este candle: ele precisa abrir antes da última
   // entrada (com 13:00, o último é o das 12:55 e nada entra a partir das 13:00).
   int minuto = MinutoDoDia(abertura);
   if(minuto < g_minInicio || minuto >= g_minUltima || minuto >= g_minZerar)
      return;             // fora do horário: sem registro no Diário

   ulong t; long tipo; double vol, preco, sl, tp;
   if(BuscarPosicao(t, tipo, vol, preco, sl, tp))
     {
      Registrar(abertura, "sem entrada: já está posicionado");
      return;             // uma operação por vez
     }
   if(HorarioBloqueado(minuto))
     {
      Registrar(abertura, "sem entrada: horário bloqueado");
      return;
     }

   // Candle sinal (1) e anterior (2) precisam ser do mesmo pregão.
   datetime t1 = iTime(_Symbol, InpTimeframe, 1);
   datetime t2 = iTime(_Symbol, InpTimeframe, 2);
   if(t1 == 0 || t2 == 0 || !MesmoDia(t1, t2) || !MesmoDia(t1, abertura))
     {
      Registrar(abertura, "sem entrada: candle sinal ou anterior é de outro pregão");
      return;
     }

   double pontosDia;
   int    operacoes, stops;
   ResultadoDoDia(pontosDia, operacoes, stops);
   if(InpMetaDiaPts > 0 && pontosDia >= InpMetaDiaPts)
     {
      Registrar(abertura, StringFormat("sem entrada: meta do dia atingida (%.0f pts)", pontosDia));
      return;
     }
   if(InpLossDiaPts > 0 && pontosDia <= -InpLossDiaPts)
     {
      Registrar(abertura, StringFormat("sem entrada: loss do dia atingido (%.0f pts)", pontosDia));
      return;
     }
   if(InpMaxOperacoes > 0 && operacoes >= InpMaxOperacoes)
     {
      Registrar(abertura, StringFormat("sem entrada: máximo de %d operações no dia", operacoes));
      return;
     }
   if(InpMaxStopsDia > 0 && stops >= InpMaxStopsDia)
     {
      Registrar(abertura, StringFormat("sem entrada: %d stops no dia", stops));
      return;
     }

   string motivo;
   int direcao = Sinal(motivo);
   if(direcao == 0)
     {
      Registrar(abertura, "sem entrada: " + motivo);
      return;
     }

   bool exigeTendencia = (InpFiltroTendencia == TEND_SEMPRE) ||
                         (InpFiltroTendencia == TEND_APOS_HORARIO && minuto >= g_minTendencia);
   if(exigeTendencia)
     {
      int tend = Tendencia();
      if(tend != direcao)
        {
         Registrar(abertura, StringFormat("sem entrada: %s contra a tendência (%s)", motivo,
                   tend > 0 ? "alta" : tend < 0 ? "baixa" : "sem tendência clara"));
         return;
        }
     }

   Registrar(abertura, motivo + StringFormat(" | dia: %.0f pts | bid %.0f ask %.0f último %.0f", pontosDia,
             SymbolInfoDouble(_Symbol, SYMBOL_BID), SymbolInfoDouble(_Symbol, SYMBOL_ASK),
             SymbolInfoDouble(_Symbol, SYMBOL_LAST)));
   double h1 = iHigh(_Symbol, InpTimeframe, 1), l1 = iLow(_Symbol, InpTimeframe, 1);
   g_sinalTamanho   = h1 - l1;
   g_sinalCorpo     = (h1 > l1) ? MathAbs(iClose(_Symbol, InpTimeframe, 1) - iOpen(_Symbol, InpTimeframe, 1)) * 100.0 / (h1 - l1) : 0;
   g_sinalTendencia = Tendencia();   // registrada mesmo com o filtro desligado, para a análise
   Entrar(direcao);
   GerenciarPosicao(MinutoDoDia(TimeCurrent()));   // coloca stop e alvo sem esperar o próximo tick
  }

// Escreve no Diário a decisão de cada candle, para conferir o robô contra a leitura do trader.
void Registrar(datetime abertura, string texto)
  {
   if(InpRegistrarDecisoes)
      PrintFormat("[%s] %s", TimeToString(abertura, TIME_MINUTES), texto);
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
int Sinal(string &motivo)
  {
   double o1 = iOpen(_Symbol, InpTimeframe, 1);
   double h1 = iHigh(_Symbol, InpTimeframe, 1);
   double l1 = iLow(_Symbol, InpTimeframe, 1);
   double c1 = iClose(_Symbol, InpTimeframe, 1);
   double h2 = iHigh(_Symbol, InpTimeframe, 2);
   double l2 = iLow(_Symbol, InpTimeframe, 2);
   double c2 = iClose(_Symbol, InpTimeframe, 2);
   string hora = TimeToString(iTime(_Symbol, InpTimeframe, 1), TIME_MINUTES);

   double tamanho = h1 - l1;
   double corpo   = MathAbs(c1 - o1);
   motivo = StringFormat("candle %s (A %.0f M %.0f m %.0f F %.0f, %.0f pts, corpo %.0f%%)",
                         hora, o1, h1, l1, c1, tamanho, tamanho > 0 ? corpo * 100.0 / tamanho : 0);

   if(tamanho <= 0)
     {
      motivo += " sem amplitude";
      return 0;
     }
   if(InpTamanhoMax > 0 && tamanho > InpTamanhoMax)
     {
      motivo += StringFormat(" maior que o máximo de %.0f", InpTamanhoMax);
      return 0;
     }
   if(InpTamanhoMin > 0 && tamanho < InpTamanhoMin)
     {
      motivo += StringFormat(" menor que o mínimo de %.0f", InpTamanhoMin);
      return 0;
     }
   if(c1 == o1)
     {
      motivo += " sem corpo (abertura = fechamento)";
      return 0;
     }
   // Força: corpo grande, ou fechamento colado na ponta a favor (martelo /
   // estrela cadente fechando na direção). A direção vem da cor do candle.
   bool   corpoOk  = corpo * 100.0 > InpCorpoMinPct * tamanho;
   double ateAPonta = (c1 > o1) ? h1 - c1 : c1 - l1;
   bool   pontaOk  = ateAPonta * 100.0 <= InpPontaPct * tamanho;
   bool   forcaOk  = (InpForca == FORCA_CORPO) ? corpoOk :
                     (InpForca == FORCA_PONTA) ? pontaOk : (corpoOk || pontaOk);
   if(!forcaOk)
     {
      motivo += (InpForca == FORCA_PONTA)
                ? StringFormat(" não fechou na ponta (%.0f%% do candle até a ponta)", tamanho > 0 ? ateAPonta * 100.0 / tamanho : 0)
                : StringFormat(" corpo não passa de %.0f%%", InpCorpoMinPct);
      return 0;
     }

   bool porMaxMin = (InpRefFechamento == REF_MAXIMA_MINIMA);
   if(c1 > o1)
     {
      double ref = porMaxMin ? h2 : c2;
      if(c1 > ref)
        {
         motivo = "COMPRA: " + motivo;
         return 1;
        }
      motivo += StringFormat(" de alta não fechou acima %s anterior (%.0f)", porMaxMin ? "da máxima" : "do fechamento", ref);
      return 0;
     }
   double ref = porMaxMin ? l2 : c2;
   if(c1 < ref)
     {
      motivo = "VENDA: " + motivo;
      return -1;
     }
   motivo += StringFormat(" de baixa não fechou abaixo %s anterior (%.0f)", porMaxMin ? "da mínima" : "do fechamento", ref);
   return 0;
  }

//+------------------------------------------------------------------+
void Entrar(int direcao)
  {
   if(!LicencaPermiteEntrada())
      return;
   double h1    = iHigh(_Symbol, InpTimeframe, 1);
   double l1    = iLow(_Symbol, InpTimeframe, 1);
   double folga = InpStopFolgaTicks * g_tick;
   double stop  = (direcao > 0) ? ArredondarPreco(l1 - folga) : ArredondarPreco(h1 + folga);
   double ask   = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid   = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double vol   = AjustarVolume(g_contratos);

   g_parcialFeita  = false;
   g_avisouSemStop = false;
   g_falhasStop    = 0;
   g_reDir         = 0;                  // sinal novo: zera a reentrada do anterior
   g_reRestantes   = InpMaxReentradas;
   g_entradaReentrada = false;

   if(InpModoEntrada == ENTRADA_ABERTURA)
     {
      double preco = (direcao > 0) ? ask : bid;
      if((direcao > 0 && preco <= stop) || (direcao < 0 && preco >= stop))
        {
         Registrar(iTime(_Symbol, InpTimeframe, 0), "entrada cancelada: abriu além do stop");
         return;   // abriu com gap além do stop
        }
      g_stopPlanejado   = stop;
      GuardarStop();
      g_precoReferencia = preco;
      if(direcao > 0)
         trade.Buy(vol, _Symbol, 0, 0, 0, COMENT("abertura"));
      else
         trade.Sell(vol, _Symbol, 0, 0, 0, COMENT("abertura"));
      return;
     }

   // Retorno: arma a entrada. MonitorarRetorno espera o candle recuar e
   // coloca a ordem stop na abertura dele (= fechamento do candle sinal).
   double abertura = ArredondarPreco(iOpen(_Symbol, InpTimeframe, 0));
   double recuo;
   if(InpUnidadeRecuo == RECUO_FVG)
     {
      // Fechar o FVG: voltar até a máxima (compra) ou mínima (venda) do candle
      // anterior ao sinal, o nível que o sinal rompeu.
      double nivel = (direcao > 0) ? iHigh(_Symbol, InpTimeframe, 2) : iLow(_Symbol, InpTimeframe, 2);
      if((direcao > 0 && nivel <= stop) || (direcao < 0 && nivel >= stop))
        {
         Registrar(iTime(_Symbol, InpTimeframe, 0), "entrada cancelada: fechar o FVG exigiria passar do stop");
         return;
        }
      recuo = (direcao > 0) ? abertura - nivel : nivel - abertura;
     }
   else
      recuo = (InpUnidadeRecuo == RECUO_PCT_CANDLE) ? (h1 - l1) * InpRecuo / 100.0 : InpRecuo;

   g_stopPlanejado = stop;
   GuardarStop();
   g_retornoDir    = direcao;
   g_retornoPreco  = abertura;
   g_retornoRecuo  = MathMax(ArredondarPreco(recuo), g_tick);
   g_retornoExtremo = 0;
   g_precoReferencia = g_retornoPreco;
   g_recuou        = false;
   g_retornoNoRobo = false;

   if(InpEntrarNoRecuo)
     {
      // Sem confirmação: ordem limitada no ponto do recuo, válida só neste candle.
      double limite = (direcao > 0) ? abertura - g_retornoRecuo : abertura + g_retornoRecuo;
      if((direcao > 0 && limite <= stop) || (direcao < 0 && limite >= stop))
        {
         g_retornoDir = 0;
         return;
        }
      g_precoReferencia = limite;
      g_recuou = true;   // MonitorarRetorno só cuida de cancelar se perder o sinal
      double volume = AjustarVolume(g_contratos);
      if(direcao > 0)
        {
         if(ask <= limite)
            trade.Buy(volume, _Symbol, 0, 0, 0, COMENT("recuo"));
         else
            trade.BuyLimit(volume, limite, _Symbol, 0, 0, TipoValidade(), 0, COMENT("recuo"));
        }
      else
        {
         if(bid >= limite)
            trade.Sell(volume, _Symbol, 0, 0, 0, COMENT("recuo"));
         else
            trade.SellLimit(volume, limite, _Symbol, 0, 0, TipoValidade(), 0, COMENT("recuo"));
        }
      return;
     }
   MonitorarRetorno();
  }

// Como a entrada foi feita, para o arquivo de operações.
string DescreverEntrada()
  {
   if(InpModoEntrada == ENTRADA_ABERTURA)
      return "abertura";
   string recuo = (InpUnidadeRecuo == RECUO_FVG) ? "fvg" : (InpUnidadeRecuo == RECUO_PONTOS) ? "pontos" : "pct";
   return (InpEntrarNoRecuo ? "limitada_" : "retorno_") + recuo;
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

   // Recuo e invalidação pelo livro (bid na compra, ask na venda), como na v1.27,
   // a versão validada: medir pelo último negócio armou mais tarde ou não armou
   // (850 entradas atrasadas, cerca de 12 mil pts a menos de 2022 a 2026).
   // A decisão de entrar continua pelo último negócio.
   double ultimo = PrecoRef();
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(bid <= 0 || ask <= 0)
     {
      bid = ultimo;
      ask = ultimo;
     }

   // Perdeu o candle sinal antes de entrar: setup invalidado.
   if((g_retornoDir > 0 && bid <= g_stopPlanejado) || (g_retornoDir < 0 && ask >= g_stopPlanejado))
     {
      Registrar(iTime(_Symbol, InpTimeframe, 0),
                StringFormat("retorno cancelado: perdeu o candle sinal antes de entrar (bid %.0f ask %.0f stop %.0f)",
                             bid, ask, g_stopPlanejado));
      CancelarPendentes();
      g_retornoDir = 0;
      return;
     }

   if(g_recuou)
     {
      // Ordem stop recusada: o robô entra a mercado quando o último negócio
      // voltar à abertura (é o que a ordem stop faria no servidor).
      if(g_retornoNoRobo && (ultimo - g_retornoPreco) * g_retornoDir >= 0)
        {
         g_retornoNoRobo = false;
         double vol = AjustarVolume(g_contratos);
         if(g_retornoDir > 0)
            trade.Buy(vol, _Symbol, 0, 0, 0, COMENT("retorno"));
         else
            trade.Sell(vol, _Symbol, 0, 0, 0, COMENT("retorno"));
        }
      return;   // ordem stop já está na abertura
     }

   if(g_retornoDir > 0)
      g_retornoExtremo = (g_retornoExtremo == 0) ? bid : MathMin(g_retornoExtremo, bid);
   else
      g_retornoExtremo = MathMax(g_retornoExtremo, ask);

   // O último negócio também precisa estar do outro lado da abertura: com o
   // livro atrasado (conta demo), o recuo do livro sozinho entraria a mercado
   // sem o preço ter recuado de verdade.
   bool recuou = (g_retornoDir > 0) ? bid <= g_retornoPreco - g_retornoRecuo && ultimo < g_retornoPreco
                                    : ask >= g_retornoPreco + g_retornoRecuo && ultimo > g_retornoPreco;
   if(!recuou)
      return;

   g_recuou = true;
   double volume = AjustarVolume(g_contratos);
   // Decide só pelo último negócio. O livro do servidor pode estar atrasado:
   // na v1.28, "livro já na abertura" fez o robô comprar a mercado no meio do
   // recuo, 200 pts abaixo da abertura.
   if((ultimo - g_retornoPreco) * g_retornoDir >= 0)
     {
      if(g_retornoDir > 0)
         trade.Buy(volume, _Symbol, 0, 0, 0, COMENT("retorno"));
      else
         trade.Sell(volume, _Symbol, 0, 0, 0, COMENT("retorno"));
      return;
     }
   bool ok = (g_retornoDir > 0)
             ? trade.BuyStop(volume, g_retornoPreco, _Symbol, 0, 0, TipoValidade(), 0, COMENT("retorno"))
             : trade.SellStop(volume, g_retornoPreco, _Symbol, 0, 0, TipoValidade(), 0, COMENT("retorno"));
   uint rc = trade.ResultRetcode();
   if(!ok || (rc != TRADE_RETCODE_DONE && rc != TRADE_RETCODE_PLACED))
     {
      g_retornoNoRobo = true;
      if(DETALHES) PrintFormat("Ordem stop na abertura recusada (código %u): o robô entra quando o último negócio voltar a %.0f",
                  rc, g_retornoPreco);
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
      if(g_posId != 0)
        {
         RegistrarOperacao(g_posId);   // a posição acabou de fechar
         GlobalVariableDel(NomeStopGuardado());
         g_ultimaDir = g_posDir;
         g_tUltimoFechamento = TimeCurrent();
        }
      g_posId = 0;
      g_parcialFeita = false;
      g_volAntesParcial = 0;
      g_tCruzou = 0;
      g_falhasParcial = 0;
      CancelarParcial();   // sem posição, uma parcial pendente abriria posição contrária
      g_alvoColocado = false;
      g_falhasAlvo = 0;
      CancelarAlvo();      // idem para o alvo limitado
      return;
     }

   // Bid e ask aqui são o último negócio: é por ele que o servidor executa.
   double bid = PrecoRef();
   double ask = bid;
   int    dir = (tipo == POSITION_TYPE_BUY) ? 1 : -1;
   double volCheio = AjustarVolume(g_contratos);

   if(PositionSelectByTicket(ticket))
     {
      long id = PositionGetInteger(POSITION_IDENTIFIER);
      if(id != g_posId)
        {
         if(g_posId != 0)
           {
            // A posição anterior fechou e outra abriu entre dois ticks.
            RegistrarOperacao(g_posId);
            GlobalVariableDel(NomeStopGuardado());
            g_ultimaDir = g_posDir;
            g_tUltimoFechamento = TimeCurrent();
            g_parcialFeita = false;
            g_volAntesParcial = 0;
            g_falhasParcial = 0;
            CancelarParcial();
            g_alvoColocado = false;
            g_falhasAlvo = 0;
            CancelarAlvo();
           }
         g_posId = id;
         g_posDir = dir;
         g_posStop = g_stopPlanejado;
         g_posReentrada = g_entradaReentrada;
         g_entradaReentrada = false;
         g_mfe = 0;
         g_mae = 0;
         g_motivoSaida = "";
         g_tCruzou = 0;

         // Uma saída que chegou depois da posição já zerada abre uma posição
         // no sentido contrário (conta netting). Não é sinal: zera na hora.
         if(g_ultimaDir != 0 && dir == -g_ultimaDir && volume < volCheio &&
            TimeCurrent() - g_tUltimoFechamento <= 10)
           {
            PrintFormat("Posição acidental de %.0f contratos (%s) logo depois de zerar. Zerando.",
                        volume, dir > 0 ? "compra" : "venda");
            g_motivoSaida = "acidental";
            trade.PositionClose(ticket);
            return;
           }
        }
     }
   if(preco > 0)
     {
      double aFavor = (bid - preco) * dir;
      g_mfe = MathMax(g_mfe, aFavor);
      g_mae = MathMax(g_mae, -aFavor);
     }

   if(minutoAgora >= g_minZerar)
     {
      g_motivoSaida = "zerar";
      trade.PositionClose(ticket);
      return;
     }

   // Pregão que acabou antes do horário de zerar deixa a posição para o dia
   // seguinte. Scalper não dorme posicionado: zera no primeiro tick do novo dia.
   if(PositionSelectByTicket(ticket) &&
      PositionGetInteger(POSITION_TIME) / 86400 < (long)TimeCurrent() / 86400)
     {
      g_motivoSaida = "virou_dia";
      PrintFormat("Posição aberta em %s atravessou a noite. Zerando.",
                  TimeToString((datetime)PositionGetInteger(POSITION_TIME)));
      trade.PositionClose(ticket);
      return;
     }

   if(preco <= 0)
      return;
   double alvo = ArredondarPreco(preco + dir * InpAlvoPts);
   // Com parcial, o alvo do servidor só entra depois dela. Com os dois no
   // servidor, um salto de preço executava o alvo e depois a parcial limitada,
   // que abria uma posição contrária (1.373 vezes no teste da v1.33).
   bool usaParcial  = (InpParcialPts > 0 && InpParcialPts < InpAlvoPts);
   // Alvo limitado: fica no livro como ordem limitada e não vai para o T/P da
   // posição. Pelo T/P, a XP manda ordem a mercado quando o preço toca o alvo e,
   // na conta real (23/10), a saída veio em média 9 pts pior que o alvo.
   bool alvoLimitado = InpAlvoLimitado && g_falhasAlvo < 3;
   bool alvoNoServ   = !alvoLimitado && (!usaParcial || g_parcialFeita);

   // Stop (e alvo, se for o caso) entram logo após a execução.
   if(sl == 0 && tp == 0)
     {
      if(g_stopPlanejado <= 0)
        {
         if(!g_avisouSemStop)
            Print("Posição sem stop e sem stop planejado. Coloque o stop manualmente.");
         g_avisouSemStop = true;
         return;
        }
      if((bid - g_stopPlanejado) * dir <= 0)
        {
         g_motivoSaida = "stop";
         trade.PositionClose(ticket);   // executou além do stop
         return;
        }
      if((bid - alvo) * dir >= 0)
        {
         g_motivoSaida = "alvo";   // andou até o alvo antes de dar tempo de colocar stop e alvo
         trade.PositionClose(ticket);
         return;
        }
      bool ok = trade.PositionModify(ticket, g_stopPlanejado, alvoNoServ ? alvo : 0.0) &&
                trade.ResultRetcode() == TRADE_RETCODE_DONE;
      if(!ok && ++g_falhasStop >= 5)
        {
         // Posição sem stop não fica aberta.
         PrintFormat("Não consegui colocar o stop (preço de entrada %.2f). Zerando por segurança.", preco);
         g_motivoSaida = "seguranca";
         trade.PositionClose(ticket);
        }
      return;
     }

   // Parcial como ordem limitada no servidor, colocada logo depois do stop:
   // executa no preço da parcial (a mercado, o preço vinha 15 a 45 pts pior).
   if(usaParcial && !g_parcialFeita)
     {
      if(g_ticketParcial != 0)
        {
         if(volume < volCheio)
           {
            if(DETALHES) PrintFormat("Parcial executada pela ordem limitada: posição de %.0f para %.0f contratos", volCheio, volume);
            CancelarParcial();   // o que sobrou da ordem, se ela executou só em parte
            g_parcialFeita = true;
           }
         else if(!OrderSelect(g_ticketParcial))
           {
            // Saiu das pendentes: executou (a posição ainda não refletiu) ou foi cancelada.
            long estado = HistoryOrderSelect(g_ticketParcial) ?
                          HistoryOrderGetInteger(g_ticketParcial, ORDER_STATE) : -1;
            if(estado == ORDER_STATE_FILLED || estado == ORDER_STATE_PARTIAL)
              {
               g_parcialFeita    = true;     // espera a posição refletir (trava abaixo)
               g_volAntesParcial = volume;
               g_tParcial        = TimeCurrent();
              }
            else
               if(DETALHES) Print("Ordem limitada da parcial não está mais no servidor. O robô assume a parcial.");
            g_ticketParcial = 0;
           }
        }
      else if(g_volAntesParcial == 0 && volume >= volCheio && g_falhasParcial < 3)
        {
         double volParc  = AjustarVolume(volCheio * InpParcialPct / 100.0);
         double precoPar = ArredondarPreco(preco + dir * InpParcialPts);
         if(volParc > 0 && volParc < volume && (precoPar - bid) * dir > 0)
           {
            bool ok = (dir > 0) ? trade.SellLimit(volParc, precoPar, _Symbol, 0, 0, TipoValidade(), 0, COMENT("parcial"))
                                : trade.BuyLimit(volParc, precoPar, _Symbol, 0, 0, TipoValidade(), 0, COMENT("parcial"));
            uint rc = trade.ResultRetcode();
            if(ok && (rc == TRADE_RETCODE_DONE || rc == TRADE_RETCODE_PLACED) && trade.ResultOrder() > 0)
              {
               g_ticketParcial = trade.ResultOrder();
               if(DETALHES) PrintFormat("Parcial limitada: %s %.0f a %.0f", dir > 0 ? "venda" : "compra", volParc, precoPar);
              }
            else if(++g_falhasParcial >= 3)
               if(DETALHES) PrintFormat("Ordem limitada da parcial recusada (código %u). O robô faz a parcial a mercado.", rc);
           }
        }
     }

   // Alvo final como ordem limitada, colocado logo depois do stop, para o que
   // não sai na parcial. Parcial e alvo somam a posição: num salto de preço que
   // execute os dois, a posição só zera, não vira.
   if(alvoLimitado)
     {
      if(g_ticketAlvo != 0 && !OrderSelect(g_ticketAlvo))
         g_ticketAlvo = 0;   // executou ou saiu do livro; sem ela, o robô cuida do alvo
      else if(!g_alvoColocado)
        {
         double volParc = (usaParcial && !g_parcialFeita) ? AjustarVolume(volCheio * InpParcialPct / 100.0) : 0;
         double volAlvo = AjustarVolume(volume - volParc);
         if(volAlvo > 0 && (alvo - bid) * dir > 0)
           {
            bool ok = (dir > 0) ? trade.SellLimit(volAlvo, alvo, _Symbol, 0, 0, TipoValidade(), 0, COMENT("alvo"))
                                : trade.BuyLimit(volAlvo, alvo, _Symbol, 0, 0, TipoValidade(), 0, COMENT("alvo"));
            uint rc = trade.ResultRetcode();
            if(ok && (rc == TRADE_RETCODE_DONE || rc == TRADE_RETCODE_PLACED) && trade.ResultOrder() > 0)
              {
               g_ticketAlvo   = trade.ResultOrder();
               g_alvoColocado = true;
               if(DETALHES) PrintFormat("Alvo limitado: %s %.0f a %.0f", dir > 0 ? "venda" : "compra", volAlvo, alvo);
              }
            else if(++g_falhasAlvo >= 3)
               if(DETALHES) PrintFormat("Ordem limitada do alvo recusada (código %u). O alvo vai para o servidor.", rc);
           }
        }
     }

   // Parcial enviada a mercado e ainda não refletida na posição: não manda outra
   // ordem de saída (venderia a mais). O stop do servidor continua protegendo.
   if(g_parcialFeita && g_volAntesParcial > 0)
     {
      if(volume >= g_volAntesParcial)
        {
         if(TimeCurrent() - g_tParcial < 10)
            return;
         if(DETALHES) PrintFormat("Parcial enviada às %s não apareceu na posição. Tentando de novo.",
                     TimeToString(g_tParcial, TIME_SECONDS));
         g_parcialFeita = false;
         g_volAntesParcial = 0;
         return;
        }
      if(DETALHES) PrintFormat("Parcial executada: posição de %.0f para %.0f contratos", g_volAntesParcial, volume);
      g_volAntesParcial = 0;
     }

   // Depois da parcial: stop no 0x0 (e o alvo do resto no servidor, se não for
   // limitado). Confere a cada tick; enquanto o servidor não aceitar, o robô usa
   // os mesmos níveis.
   if(g_parcialFeita)
     {
      double stopDepois = InpZeroAposParcial ? ArredondarPreco(preco) : sl;
      bool faltaStop = (stopDepois - sl) * dir > g_tick / 2;
      bool faltaAlvo = alvoNoServ && MathAbs(tp - alvo) > g_tick / 2;
      if(faltaStop || faltaAlvo)
        {
         bool podeModificar = (bid - stopDepois) * dir > 0 && (!alvoNoServ || (alvo - bid) * dir > 0);
         if(podeModificar && trade.PositionModify(ticket, stopDepois, alvoNoServ ? alvo : tp) &&
            trade.ResultRetcode() == TRADE_RETCODE_DONE)
            if(DETALHES) PrintFormat("Depois da parcial: stop %.0f, alvo %.0f", stopDepois, alvo);
         // Níveis que o servidor ainda não tem: o robô executa sem esperar.
         if(faltaStop && (bid - stopDepois) * dir <= 0)
           {
            g_motivoSaida = InpZeroAposParcial ? "0x0" : "stop";
            trade.PositionClose(ticket);
            return;
           }
         if(faltaAlvo && (bid - alvo) * dir >= 0)
           {
            g_motivoSaida = "alvo";
            trade.PositionClose(ticket);
            return;
           }
         sl = stopDepois;
         if(alvoNoServ)
            tp = alvo;
        }
     }

   // Saídas do robô: no testador pelo livro (bid na compra, ask na venda), como
   // na v1.27 validada; em conta pelo último negócio, que é o que o servidor usa.
   bool   testador  = (bool)MQLInfoInteger(MQL_TESTER);
   double precoSaida = bid;
   if(testador)
     {
      double livro = (dir > 0) ? SymbolInfoDouble(_Symbol, SYMBOL_BID) : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      if(livro > 0)
         precoSaida = livro;
     }

   // Alvo fora do servidor e sem ordem limitada no livro: o robô executa na hora.
   if(!alvoNoServ && g_ticketAlvo == 0 && (precoSaida - alvo) * dir >= 0)
     {
      g_motivoSaida = "alvo";
      trade.PositionClose(ticket);
      return;
     }

   // Stop/alvo do servidor com o robô de reserva.
   // No testador o servidor da B3 às vezes não executa: o robô zera na hora,
   // pelo livro (bid na compra, ask na venda), como na v1.27 validada.
   // Em conta o servidor executa pelo último negócio em milissegundos: o robô
   // só zera se o último ficar além do nível por 3 s (sem a espera, robô e
   // servidor zerariam juntos e virariam a mão). No testador a espera custou
   // cerca de 13 mil pts em stops piores.
   bool alemStop = sl > 0 && (precoSaida - sl) * dir <= 0;
   bool alemAlvo = tp > 0 && (precoSaida - tp) * dir >= 0;
   if(alemStop || alemAlvo)
     {
      if(g_tCruzou == 0)
         g_tCruzou = TimeCurrent();
      if(testador || TimeCurrent() - g_tCruzou >= 3)
        {
         g_motivoSaida = alemAlvo ? "alvo" : (MathAbs(sl - preco) < g_tick / 2 ? "0x0" : "stop");
         if(!testador || InpRegistrarDecisoes)
            if(DETALHES) PrintFormat("Saída pelo robô: %s, preço %.0f, stop %.0f, alvo %.0f",
                        g_motivoSaida, precoSaida, sl, tp);
         trade.PositionClose(ticket);
        }
      return;
     }
   g_tCruzou = 0;

   if(!usaParcial || g_parcialFeita || g_ticketParcial != 0)
      return;   // com a ordem limitada no servidor, quem faz a parcial é ela

   if((bid - (preco + dir * InpParcialPts)) * dir < 0)
      return;

   double volParcial = AjustarVolume(volCheio * InpParcialPct / 100.0);
   if(volParcial <= 0 || volParcial >= volume)
     {
      g_parcialFeita = true;   // posição já reduzida (robô reiniciado): segue como depois da parcial
      return;
     }
   if(DETALHES) PrintFormat("Parcial: %s %.0f a mercado (último %.0f, entrada %.0f)",
               dir > 0 ? "vendendo" : "comprando", volParcial, bid, preco);
   if(!FecharParcial(ticket, tipo, volParcial))
      return;   // tenta de novo no próximo tick
   g_parcialFeita    = true;
   g_volAntesParcial = volume;
   g_tParcial        = TimeCurrent();
  }

//+------------------------------------------------------------------+
bool FecharParcial(ulong ticket, long tipo, double vol)
  {
   if(g_hedging)
      return trade.PositionClosePartial(ticket, vol);
   // Netting (B3): a ordem contrária reduz a posição.
   if(tipo == POSITION_TYPE_BUY)
      return trade.Sell(vol, _Symbol, 0, 0, 0, COMENT("parcial"));
   return trade.Buy(vol, _Symbol, 0, 0, 0, COMENT("parcial"));
  }

//+------------------------------------------------------------------+
//| Resultado do dia em pontos, só das posições abertas pelo robô.   |
//| Calculado pelos preços executados: no WIN$N o MT5 zera o lucro.  |
//+------------------------------------------------------------------+
// Stop é a operação que perdeu mais de 30 pts; saída no 0x0 com escorregão não conta.
void ResultadoDoDia(double &pontos, int &operacoes, int &stops)
  {
   pontos    = 0;
   operacoes = 0;
   stops     = 0;
   if(!HistorySelect(InicioDoDia(TimeCurrent()), TimeCurrent() + 60))
      return;

   long ids[];
   int  total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0 || HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;
      if(HistoryDealGetInteger(deal, DEAL_ENTRY) != DEAL_ENTRY_IN ||
         (ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != InpMagic)
         continue;
      long id = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
      bool repetido = false;
      for(int k = 0; k < ArraySize(ids) && !repetido; k++)
         repetido = (ids[k] == id);
      if(!repetido)
        {
         int n = ArraySize(ids);
         ArrayResize(ids, n + 1);
         ids[n] = id;
        }
     }
   operacoes = ArraySize(ids);

   for(int k = 0; k < operacoes; k++)
     {
      double pts, entrada, parcial, saida;
      datetime tEntrada, tSaida;
      int dir;
      if(DadosDaPosicao(ids[k], pts, tEntrada, tSaida, dir, entrada, parcial, saida))
        {
         pontos += pts;
         if(pts < -30)
            stops++;
        }
     }
  }

// Resultado de uma posição pelo preço médio: parcial de 60 + final de 80 = 70.
// Só conta o que já saiu; parte ainda aberta não entra.
bool DadosDaPosicao(long id, double &pontos, datetime &tEntrada, datetime &tSaida, int &dir,
                    double &entrada, double &parcial, double &saida)
  {
   pontos = 0; tEntrada = 0; tSaida = 0; dir = 0; entrada = 0; parcial = 0; saida = 0;
   if(!HistorySelectByPosition(id))
      return false;

   double volEntrada = 0, valorEntrada = 0, volSaida = 0, valorSaida = 0;
   int    saidas = 0;
   for(int i = 0; i < HistoryDealsTotal(); i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      double p = HistoryDealGetDouble(deal, DEAL_PRICE);
      double v = HistoryDealGetDouble(deal, DEAL_VOLUME);
      if(HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
        {
         volEntrada   += v;
         valorEntrada += p * v;
         dir = (HistoryDealGetInteger(deal, DEAL_TYPE) == DEAL_TYPE_BUY) ? 1 : -1;
         if(tEntrada == 0)
            tEntrada = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
        }
      else
        {
         volSaida   += v;
         valorSaida += p * v;
         if(saidas == 0)
            parcial = p;
         saida  = p;
         tSaida = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
         saidas++;
        }
     }
   if(volEntrada <= 0)
      return false;
   if(saidas < 2)
      parcial = 0;
   entrada = valorEntrada / volEntrada;
   pontos  = (valorSaida - entrada * volSaida) * dir / volEntrada;
   return true;
  }

// Fecha a conta da operação: estatística do teste e uma linha no arquivo.
void RegistrarOperacao(long id)
  {
   double pts, entrada, parcial, saida;
   datetime tEntrada, tSaida;
   int dir;
   if(!DadosDaPosicao(id, pts, tEntrada, tSaida, dir, entrada, parcial, saida) || tSaida == 0)
      return;

   string motivo = g_motivoSaida;
   g_motivoSaida = "";
   if(motivo == "")
     {
      // O stop/alvo da posição foi executado pelo servidor antes do robô: o motivo sai do preço.
      double resultado = (saida - entrada) * dir;
      motivo = (MathAbs(resultado) < g_tick / 2) ? "0x0" : (resultado >= InpAlvoPts - g_tick / 2) ? "alvo" : "stop";
     }

   if(motivo == "0x0" && g_reRestantes > 0 && g_posStop > 0)
     {
      g_reDir   = dir;
      g_rePreco = ArredondarPreco(entrada);
      g_reStop  = g_posStop;
      g_reAte   = TimeCurrent() + InpReentradaMin * 60;
     }

   MedirExecucao(id);

   g_totalOps++;
   g_totalPts += pts;
   if(pts > 0)      { g_ganhos++; g_ptsGanhos += pts; }
   else if(pts < 0) { g_perdas++; g_ptsPerdas += pts; }
   else             g_zeros++;
   g_pico  = MathMax(g_pico, g_totalPts);
   g_maxDD = MathMax(g_maxDD, g_pico - g_totalPts);
   if(g_posReentrada) { g_reOps++; g_rePts += pts; }
   if(motivo == "virou_dia")
      g_viradas++;
   string desc = StringFormat("%.0f pts em %s (%s, %s%s)", pts, TimeToString(tEntrada),
                              dir > 0 ? "compra" : "venda", motivo, g_posReentrada ? ", reentrada" : "");
   if(pts > g_maiorGanho) { g_maiorGanho = pts; g_descMaiorGanho = desc; }
   if(pts < g_maiorPerda) { g_maiorPerda = pts; g_descMaiorPerda = desc; }

   if(g_arquivo == INVALID_HANDLE)
      return;
   FileWrite(g_arquivo,
             TimeToString(tEntrada, TIME_DATE), TimeToString(tEntrada, TIME_SECONDS), TimeToString(tSaida, TIME_SECONDS),
             dir > 0 ? "compra" : "venda",
             DoubleToString(entrada, _Digits), DoubleToString(g_posStop, _Digits),
             DoubleToString(MathAbs(entrada - g_posStop), _Digits),
             DoubleToString(parcial, _Digits), DoubleToString(saida, _Digits), motivo,
             DoubleToString(pts, 1), DoubleToString(g_mfe, _Digits), DoubleToString(g_mae, _Digits),
             DoubleToString(g_sinalTamanho, _Digits), DoubleToString(g_sinalCorpo, 0),
             g_sinalTendencia > 0 ? "alta" : g_sinalTendencia < 0 ? "baixa" : "sem",
             DescreverEntrada() + (g_posReentrada ? "_reentrada" : ""));
   FileFlush(g_arquivo);
  }

//+------------------------------------------------------------------+
//| Licença                                                          |
//+------------------------------------------------------------------+
// A trava vale em conta real; na versão do aluno, também em conta demo (senão o
// .ex5 rodaria em qualquer demo e bastaria copiar as ordens). Testador livre.
bool LicencaAplica()
  {
   if(MQLInfoInteger(MQL_TESTER) || MQLInfoInteger(MQL_OPTIMIZATION))
      return false;
#ifdef VERSAO_ALUNO
   return true;
#else
   return AccountInfoInteger(ACCOUNT_TRADE_MODE) == ACCOUNT_TRADE_MODE_REAL;
#endif
  }

// Vence no fim do último dia, pelo horário do servidor (não pelo relógio do PC).
bool LicencaVencida()
  {
   return TimeTradeServer() >= g_licValidade + 86400;
  }

// Chave: CONTA-AAAAMMDD-CONTRATOS-ASSINATURA, ex.: 2016720-20261103-2-9F3A1C0B7D2E4F61.
// Assinatura = 16 primeiros hex de HMAC-SHA256(LIC_SEGREDO, "CONTA|AAAAMMDD|CONTRATOS").
bool LerChave(string chave)
  {
   StringTrimLeft(chave);
   StringTrimRight(chave);
   StringToUpper(chave);
   string partes[];
   if(StringSplit(chave, '-', partes) != 4)
      return false;
   if(!SoDigitos(partes[0]) || !SoDigitos(partes[1]) || StringLen(partes[1]) != 8 ||
      !SoDigitos(partes[2]) || StringLen(partes[3]) != 16)
      return false;
   string esperado = StringSubstr(HmacSha256Hex(LIC_SEGREDO, partes[0] + "|" + partes[1] + "|" + partes[2]), 0, 16);
   if(esperado != partes[3])
      return false;
   g_licConta    = StringToInteger(partes[0]);
   g_licValidade = StringToTime(StringSubstr(partes[1], 0, 4) + "." + StringSubstr(partes[1], 4, 2) + "." +
                                StringSubstr(partes[1], 6, 2));
   g_licMax      = (int)StringToInteger(partes[2]);
   return g_licConta > 0 && g_licValidade > 0;
  }

bool SoDigitos(const string s)
  {
   if(StringLen(s) == 0)
      return false;
   for(int i = 0; i < StringLen(s); i++)
     {
      ushort c = StringGetCharacter(s, i);
      if(c < '0' || c > '9')
         return false;
     }
   return true;
  }

string HmacSha256Hex(const string segredo, const string msg)
  {
   uchar chave[], dados[], vazio[], resumo[];
   StringToCharArray(segredo, chave, 0, StringLen(segredo), CP_UTF8);
   StringToCharArray(msg, dados, 0, StringLen(msg), CP_UTF8);
   if(ArraySize(chave) > 64)
     {
      CryptEncode(CRYPT_HASH_SHA256, chave, vazio, resumo);
      ArrayFree(chave);
      ArrayCopy(chave, resumo);
     }
   int n = ArraySize(chave);
   ArrayResize(chave, 64);
   for(int i = n; i < 64; i++)
      chave[i] = 0;

   uchar interno[], externo[], h1[], h2[];
   ArrayResize(interno, 64 + ArraySize(dados));
   ArrayResize(externo, 64);
   for(int i = 0; i < 64; i++)
     {
      interno[i] = (uchar)(chave[i] ^ 0x36);
      externo[i] = (uchar)(chave[i] ^ 0x5C);
     }
   ArrayCopy(interno, dados, 64, 0);
   CryptEncode(CRYPT_HASH_SHA256, interno, vazio, h1);
   ArrayResize(externo, 64 + ArraySize(h1));
   ArrayCopy(externo, h1, 64, 0);
   CryptEncode(CRYPT_HASH_SHA256, externo, vazio, h2);

   string hex = "";
   for(int i = 0; i < ArraySize(h2); i++)
      hex += StringFormat("%02X", h2[i]);
   return hex;
  }

// Chamada só antes de abrir operação nova (sem posição): a licença nunca fecha
// nem abandona posição aberta. Na versão do aluno também define os contratos.
bool LicencaPermiteEntrada()
  {
#ifdef VERSAO_ALUNO
   int ctChave, ct;
   string motivo;
   if(!LicOnline_PodeOperar(ChaveOffline(ctChave), ctChave, ct, motivo))
     {
      MostrarLicenca();
      return false;
     }
   int permitido = (int)MathMin(InpContratos, ct);
   permitido -= permitido % 2;   // a parcial é metade da posição: contratos pares
   if(permitido < 2)
     {
      if(!g_avisouLicenca)
         Print(NOME_ROBO + ": a licença permite 1 contrato; o robô opera com 2 ou mais, em número par.");
      g_avisouLicenca = true;
      return false;
     }
   g_contratos = permitido;
   return true;
#else
   if(!LicencaAplica() || !LicencaVencida())
      return true;
   if(!g_avisouLicenca)
      PrintFormat("Licença vencida em %s: nenhuma operação nova.", TimeToString(g_licValidade, TIME_DATE));
   g_avisouLicenca = true;
   return false;
#endif
  }

#ifdef VERSAO_ALUNO
// Chave offline válida para esta conta e no prazo. Conferida a cada uso porque,
// logo que o MT5 abre, a conta ainda pode não estar conectada.
bool ChaveOffline(int &contratos)
  {
   contratos = 0;
   if(!LerChave(InpChave) || AccountInfoInteger(ACCOUNT_LOGIN) != g_licConta || LicencaVencida())
      return false;
   contratos = g_licMax;
   return true;
  }

// Situação da licença no canto do gráfico.
void MostrarLicenca()
  {
   int ctChave, ct;
   string motivo;
   bool pode = LicOnline_PodeOperar(ChaveOffline(ctChave), ctChave, ct, motivo);
   string txt = NOME_ROBO + "\nLicença: " +
                (pode ? StringFormat("liberado, até %d contratos (%s)", ct, motivo) : "parado (" + motivo + ")");
   string aviso = LicOnline_Aviso();
   if(aviso != "")
      txt += "\n" + QuebrarLinhas("Aviso: " + aviso, 60);
   Comment(txt);
  }

// Quebra o texto em linhas de até "largura" caracteres, nos espaços.
string QuebrarLinhas(string texto, int largura)
  {
   StringReplace(texto, "\n", " ");
   string palavras[];
   int n = StringSplit(texto, ' ', palavras);
   string saida = "", linha = "";
   for(int i = 0; i < n; i++)
     {
      if(palavras[i] == "")
         continue;
      if(linha != "" && StringLen(linha) + 1 + StringLen(palavras[i]) > largura)
        {
         saida += (saida == "" ? "" : "\n") + linha;
         linha = palavras[i];
        }
      else
         linha += (linha == "" ? "" : " ") + palavras[i];
     }
   if(linha != "")
      saida += (saida == "" ? "" : "\n") + linha;
   return saida;
  }

void OnTimer()
  {
   LicOnline_Timer();
   MostrarLicenca();
  }
#endif

//+------------------------------------------------------------------+
//| Preço de referência                                              |
//+------------------------------------------------------------------+
// Na B3 o servidor dispara stop, alvo e ordens stop pelo último negócio. O robô
// decide pelo mesmo preço; bid/ask só entram se ainda não houve negócio.
double PrecoRef()
  {
   MqlTick t;
   if(SymbolInfoTick(_Symbol, t))
     {
      if(t.last > 0)
         return t.last;
      if(t.bid > 0 && t.ask > 0)
         return (t.bid + t.ask) / 2;
     }
   return SymbolInfoDouble(_Symbol, SYMBOL_BID);
  }

//+------------------------------------------------------------------+
//| Diagnóstico da série                                             |
//+------------------------------------------------------------------+
double DesvioLimite()
  {
   return 10 * g_tick;   // 50 pts no WIN
  }

// Último negócio longe do bid/ask: dado incoerente (ou leilão).
void DiagnosticarTick()
  {
   MqlTick t;
   if(!SymbolInfoTick(_Symbol, t) || t.bid <= 0 || t.ask <= 0 || t.last <= 0)
      return;
   g_ticksDiag++;
   double fora = MathMax(t.bid - t.last, t.last - t.ask);
   if(fora <= DesvioLimite())
      return;
   g_ticksIncoerentes++;
   if(fora > g_maiorIncoerencia)
     {
      g_maiorIncoerencia  = fora;
      g_tMaiorIncoerencia = t.time;
     }
  }

// Preço executado contra o preço da ordem (gatilho do stop, alvo, limitada ou
// preço do envio a mercado), em pontos pelo preço médio como o resto do livro.
void MedirExecucao(long id)
  {
   if(!HistorySelectByPosition(id))
      return;
   // Primeiro guarda os negócios; depois busca cada ordem (HistoryOrderSelect
   // troca a lista de ordens selecionadas).
   int n = HistoryDealsTotal();
   ulong    ordens[];
   double   precos[], volumes[], lados[];
   datetime tempos[];
   ArrayResize(ordens, n); ArrayResize(precos, n); ArrayResize(volumes, n);
   ArrayResize(lados, n);  ArrayResize(tempos, n);
   double volEntrada = 0;
   int k = 0;
   for(int i = 0; i < n; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      ordens[k]  = (ulong)HistoryDealGetInteger(deal, DEAL_ORDER);
      precos[k]  = HistoryDealGetDouble(deal, DEAL_PRICE);
      volumes[k] = HistoryDealGetDouble(deal, DEAL_VOLUME);
      lados[k]   = (HistoryDealGetInteger(deal, DEAL_TYPE) == DEAL_TYPE_BUY) ? 1 : -1;
      tempos[k]  = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
      if(HistoryDealGetInteger(deal, DEAL_ENTRY) == DEAL_ENTRY_IN)
         volEntrada += volumes[k];
      k++;
     }
   if(volEntrada <= 0)
      return;

   for(int i = 0; i < k; i++)
     {
      if(ordens[i] == 0 || !HistoryOrderSelect(ordens[i]))
        {
         g_execSemOrdem++;
         continue;
        }
      double precoOrdem = HistoryOrderGetDouble(ordens[i], ORDER_PRICE_OPEN);
      if(precoOrdem <= 0 || precos[i] <= 0)
        {
         g_execSemOrdem++;
         continue;
        }
      double desvio = (precos[i] - precoOrdem) * lados[i];   // + = pior que a ordem
      double pts    = desvio * volumes[i] / volEntrada;
      g_execDiag++;
      g_desvioTotal += pts;
      if(MathAbs(desvio) <= DesvioLimite())
         continue;
      g_execLonge++;
      g_desvioLonge += pts;
      if(g_execLonge <= 10)
         if(DETALHES) PrintFormat("Execução longe da ordem: %s %s ordem %.0f executou %.0f (%.0f pts %s)",
                     TimeToString(tempos[i], TIME_DATE | TIME_SECONDS), lados[i] > 0 ? "compra" : "venda",
                     precoOrdem, precos[i], MathAbs(desvio), desvio > 0 ? "contra" : "a favor");
     }
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

// Ordens de entrada pendentes. A parcial e o alvo da posição aberta ficam.
void CancelarPendentes()
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong t = OrderGetTicket(i);
      if(t == 0 || t == g_ticketParcial || t == g_ticketAlvo || OrderGetString(ORDER_SYMBOL) != _Symbol)
         continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) == InpMagic)
         trade.OrderDelete(t);
     }
  }

void CancelarAlvo()
  {
   if(g_ticketAlvo != 0 && OrderSelect(g_ticketAlvo))
      trade.OrderDelete(g_ticketAlvo);
   g_ticketAlvo = 0;
  }

void CancelarParcial()
  {
   if(g_ticketParcial != 0 && OrderSelect(g_ticketParcial))
      trade.OrderDelete(g_ticketParcial);
   g_ticketParcial = 0;
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
   if(!InpBloquearHorarios)
      return false;
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
