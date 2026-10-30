//+------------------------------------------------------------------+
//| CohenComando.mqh                                                 |
//| Liga e desliga o robo pelo Trader Nation Terminal (app de mesa). |
//|                                                                  |
//| O app grava um arquivo de comando na pasta comum do MT5          |
//| (Common\Files\TraderNation) e o robo responde com um arquivo de  |
//| estado a cada segundo de pregao (e a cada timer fora dele).      |
//|                                                                  |
//| DESLIGADO = nao abre operacao nova. Posicao aberta continua com  |
//| stop, alvo e saida por horario, como na licenca.                 |
//| Sem arquivo de comando (aluno sem o app), o robo fica LIGADO.    |
//+------------------------------------------------------------------+
#ifndef COHEN_COMANDO_MQH
#define COHEN_COMANDO_MQH

//--- Configuracao. Defina antes do #include para trocar.
#ifndef CMD_ROBO
#define CMD_ROBO "CohenScalper"      // igual ao LIC_ROBO: e o nome que o app procura
#endif
#ifndef CMD_VERSAO
#define CMD_VERSAO ""
#endif

#define CMD_PASTA "TraderNation\\"

bool   g_cmdLigado=true;
uint   g_cmdUltimo=0;       // GetTickCount da ultima rodada
string g_cmdAviso="";       // texto curto que o app mostra (ex.: situacao da licenca)

string CmdArquivo(const string sufixo)
  {
   return StringFormat("%s%s_%I64d_%s.txt",CMD_PASTA,CMD_ROBO,AccountInfoInteger(ACCOUNT_LOGIN),sufixo);
  }

//--- Le "ligado=0/1". Arquivo no meio da gravacao (sem a linha) nao muda nada.
void CmdLer()
  {
   string nome=CmdArquivo("comando");
   if(!FileIsExist(nome,FILE_COMMON))
     {
      g_cmdLigado=true;
      return;
     }
   int h=FileOpen(nome,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE,'\t',CP_UTF8);
   if(h==INVALID_HANDLE)
      return;
   while(!FileIsEnding(h))
     {
      string linha=FileReadString(h);
      StringTrimRight(linha);
      if(StringFind(linha,"ligado=")!=0)
         continue;
      bool novo=(StringSubstr(linha,7)!="0");
      if(novo!=g_cmdLigado)
         PrintFormat("%s %s pelo Trader Nation Terminal.",CMD_ROBO,novo ? "ligado" : "desligado (nao abre operacao nova)");
      g_cmdLigado=novo;
     }
   FileClose(h);
  }

//--- O app considera o robo fora do ar quando a batida fica velha.
void CmdGravar(const string situacao)
  {
   int h=FileOpen(CmdArquivo("estado"),FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ,'\t',CP_UTF8);
   if(h==INVALID_HANDLE)
      return;
   bool algo=(TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)!=0 && MQLInfoInteger(MQL_TRADE_ALLOWED)!=0);
   string aviso=g_cmdAviso;
   StringReplace(aviso,"\n"," ");
   FileWriteString(h,StringFormat("situacao=%s\nligado=%d\nsimbolo=%s\nversao=%s\nalgo=%d\nbatida=%I64d\naviso=%s\n",
                                  situacao,g_cmdLigado ? 1 : 0,_Symbol,CMD_VERSAO,algo ? 1 : 0,(long)TimeGMT(),aviso));
   FileClose(h);
  }

//+------------------------------------------------------------------+
//| API publica                                                      |
//+------------------------------------------------------------------+
// OnInit, depois de saber a conta.
void Comando_Init()
  {
   g_cmdUltimo=0;
   Comando_Atualizar(true);
  }

// No OnTick e no OnTimer. Roda no maximo uma vez por segundo.
void Comando_Atualizar(const bool agora=false)
  {
   uint t=GetTickCount();
   if(!agora && t-g_cmdUltimo<1000)
      return;
   g_cmdUltimo=t;
   if(AccountInfoInteger(ACCOUNT_LOGIN)==0)
      return;
   CmdLer();
   CmdGravar("rodando");
  }

// Antes de abrir operacao nova (e so ai).
bool Comando_Ligado() { return g_cmdLigado; }

// Opcional: texto que aparece no app embaixo do robo.
void Comando_Aviso(const string texto) { g_cmdAviso=texto; }

// OnDeinit: o app passa a mostrar "fora do grafico" na hora.
void Comando_Fim() { CmdGravar("parado"); }

#endif
