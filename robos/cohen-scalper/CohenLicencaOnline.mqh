//+------------------------------------------------------------------+
//| CohenLicencaOnline.mqh                                           |
//| Verificacao online da licenca dos robos Cohen.                   |
//|                                                                  |
//| O robo pergunta ao servidor, pelo numero da conta, se pode       |
//| operar. A resposta vem assinada (HMAC-SHA256): servidor falso ou |
//| resposta editada nao passa.                                      |
//|                                                                  |
//| REGRA DE OURO: licenca so decide se o robo ABRE operacao nova.   |
//| Nunca fecha, zera ou abandona posicao aberta por causa disso.    |
//+------------------------------------------------------------------+
#ifndef COHEN_LICENCA_ONLINE_MQH
#define COHEN_LICENCA_ONLINE_MQH

// Segredo compartilhado com o servidor (variavel LIC_SEGREDO_ONLINE na
// Vercel). Fica num arquivo separado que NAO vai para o git.
#include "CohenLicencaSegredo.mqh"

//--- Configuracao. Defina antes do #include para trocar.
#ifndef LIC_URL
#define LIC_URL "https://robos.tradernation.com.br"
#endif
#ifndef LIC_ROBO
#define LIC_ROBO "CohenScalper"     // tem que ser igual ao codigo no painel
#endif
#ifndef LIC_VERSAO
#define LIC_VERSAO "1.0"            // tem que ser igual a "versao atual" no painel
#endif
#ifndef LIC_INTERVALO_SEG
#define LIC_INTERVALO_SEG 600       // licenca ativa: confere a cada 10 min
#endif
#ifndef LIC_INTERVALO_PENDENTE_SEG
#define LIC_INTERVALO_PENDENTE_SEG 120  // sem licenca: confere a cada 2 min
#endif
#ifndef LIC_TOLERANCIA_SEG
#define LIC_TOLERANCIA_SEG 86400    // sem internet: vale a ultima confirmacao por 24h
#endif
#ifndef LIC_TIMEOUT_MS
#define LIC_TIMEOUT_MS 5000
#endif
#ifndef LIC_CONTRATOS_TESTADOR
#define LIC_CONTRATOS_TESTADOR 1    // no testador nao ha verificacao online
#endif

enum ENUM_LIC_ONLINE
  {
   LICON_ATIVA,
   LICON_PENDENTE,
   LICON_BLOQUEADA,
   LICON_EXPIRADA,
   LICON_DESCONHECIDA,   // conta sem licenca
   LICON_SEM_RESPOSTA,   // sem internet, URL nao liberada ou servidor fora
   LICON_TESTADOR
  };

//--- Estado (prefixo g_lon para nao colidir com a licenca offline do robo)
ENUM_LIC_ONLINE g_lonStatus      = LICON_SEM_RESPOSTA;
int             g_lonContratos   = 0;
datetime        g_lonValidade    = 0;
datetime        g_lonUltimaOk    = 0;   // hora do servidor (GMT) da ultima resposta ATIVA
datetime        g_lonUltimaTent  = 0;   // hora local da ultima tentativa
string          g_lonMotivo      = "verificando licenca...";
string          g_lonAviso       = "";  // ultima mensagem ou aviso de atualizacao
bool            g_lonAvisouUrl   = false;
string          g_lonUpdMostrada = "";

//+------------------------------------------------------------------+
//| Utilitarios de bytes                                             |
//+------------------------------------------------------------------+
// Texto -> bytes UTF-8, sem o zero do final.
void LicBytes(const string s,uchar &saida[])
  {
   ArrayResize(saida,0);
   if(StringLen(s)==0)
      return;
   int n=StringToCharArray(s,saida,0,WHOLE_ARRAY,CP_UTF8);
   if(n>0 && saida[n-1]==0)
      n--;
   ArrayResize(saida,n);
  }

string LicHex(const uchar &b[])
  {
   string h="";
   for(int i=0;i<ArraySize(b);i++)
      h+=StringFormat("%02X",b[i]);
   return h;
  }

bool LicSha256(const uchar &dados[],uchar &saida[])
  {
   uchar semChave[];
   return CryptEncode(CRYPT_HASH_SHA256,dados,semChave,saida)==32;
  }

// HMAC-SHA256 (RFC 2104), devolve hexadecimal maiusculo como o servidor.
string LicHmac(const string chave,const string msg)
  {
   uchar k[],m[];
   LicBytes(chave,k);
   LicBytes(msg,m);
   if(ArraySize(k)>64)
     {
      uchar kh[];
      if(!LicSha256(k,kh))
         return "";
      ArrayResize(k,32);
      for(int i=0;i<32;i++)
         k[i]=kh[i];
     }
   int nk=ArraySize(k);
   uchar k64[64];
   for(int i=0;i<64;i++)
      k64[i]=(uchar)(i<nk ? k[i] : 0);

   int nm=ArraySize(m);
   uchar interno[];
   ArrayResize(interno,64+nm);
   for(int i=0;i<64;i++)
      interno[i]=(uchar)(k64[i]^0x36);
   for(int i=0;i<nm;i++)
      interno[64+i]=m[i];
   uchar hi[];
   if(!LicSha256(interno,hi))
      return "";

   uchar externo[96];
   for(int i=0;i<64;i++)
      externo[i]=(uchar)(k64[i]^0x5C);
   for(int i=0;i<32;i++)
      externo[64+i]=hi[i];
   uchar ho[];
   if(!LicSha256(externo,ho))
      return "";
   return LicHex(ho);
  }

string LicUrlEnc(const string s)
  {
   uchar b[];
   LicBytes(s,b);
   string r="";
   for(int i=0;i<ArraySize(b);i++)
     {
      uchar c=b[i];
      if((c>='A' && c<='Z') || (c>='a' && c<='z') || (c>='0' && c<='9') || c=='-' || c=='_' || c=='.' || c=='~')
         r+=CharToString(c);
      else
         r+=StringFormat("%%%02X",c);
     }
   return r;
  }

string LicConta()
  {
   return IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
  }

string LicArquivoCache()
  {
   return "CohenLic_"+LIC_ROBO+"_"+LicConta()+".txt";
  }

// Valor de um campo da resposta ("" se nao veio).
string LicCampo(const string &chaves[],const string &valores[],const string nome)
  {
   for(int i=0;i<ArraySize(chaves);i++)
      if(chaves[i]==nome)
         return valores[i];
   return "";
  }

//+------------------------------------------------------------------+
//| Leitura da resposta                                              |
//+------------------------------------------------------------------+
// Confere a assinatura e devolve os campos. nonce vazio = nao confere nonce
// (usado para o cache, que e uma resposta antiga de proposito).
bool LicLerResposta(const string txt,const string nonce,string &chaves[],string &valores[])
  {
   ArrayResize(chaves,0);
   ArrayResize(valores,0);
   int p=StringFind(txt,"\nsig=");
   if(p<0)
      return false;
   string corpo=StringSubstr(txt,0,p);
   string sig=StringSubstr(txt,p+5);
   StringTrimLeft(sig);
   StringTrimRight(sig);
   if(StringLen(sig)!=64 || LicHmac(LIC_SEGREDO_ONLINE,corpo)!=sig)
      return false;

   string linhas[];
   int n=StringSplit(corpo,'\n',linhas);
   for(int i=0;i<n;i++)
     {
      int e=StringFind(linhas[i],"=");
      if(e<1)
         continue;
      string v=StringSubstr(linhas[i],e+1);
      StringReplace(v,"\\n","\n");
      int k=ArraySize(chaves);
      ArrayResize(chaves,k+1);
      ArrayResize(valores,k+1);
      chaves[k]=StringSubstr(linhas[i],0,e);
      valores[k]=v;
     }
   if(LicCampo(chaves,valores,"v")!="1")
      return false;
   if(LicCampo(chaves,valores,"conta")!=LicConta())
      return false;
   if(nonce!="" && LicCampo(chaves,valores,"nonce")!=nonce)
      return false;
   return true;
  }

ENUM_LIC_ONLINE LicStatusDeTexto(const string s)
  {
   if(s=="ATIVA")
      return LICON_ATIVA;
   if(s=="PENDENTE")
      return LICON_PENDENTE;
   if(s=="BLOQUEADA")
      return LICON_BLOQUEADA;
   if(s=="EXPIRADA")
      return LICON_EXPIRADA;
   return LICON_DESCONHECIDA;
  }

//+------------------------------------------------------------------+
//| Cache em arquivo (MQL5\Files). Guarda a resposta assinada, entao |
//| editar o arquivo invalida a assinatura.                          |
//+------------------------------------------------------------------+
void LicSalvarCache(const uchar &bruto[])
  {
   int h=FileOpen(LicArquivoCache(),FILE_WRITE|FILE_BIN);
   if(h==INVALID_HANDLE)
      return;
   FileWriteArray(h,bruto);
   FileClose(h);
  }

void LicApagarCache()
  {
   if(FileIsExist(LicArquivoCache()))
      FileDelete(LicArquivoCache());
  }

// Usa a ultima confirmacao ATIVA se ela tiver menos de 24h e a licenca
// ainda estiver no prazo.
bool LicUsarCache()
  {
   if(!FileIsExist(LicArquivoCache()))
      return false;
   int h=FileOpen(LicArquivoCache(),FILE_READ|FILE_BIN);
   if(h==INVALID_HANDLE)
      return false;
   uchar bruto[];
   FileReadArray(h,bruto);
   FileClose(h);

   string chaves[],valores[];
   if(!LicLerResposta(CharArrayToString(bruto,0,WHOLE_ARRAY,CP_UTF8),"",chaves,valores))
      return false;
   if(LicCampo(chaves,valores,"status")!="ATIVA")
      return false;

   datetime ts=(datetime)StringToInteger(LicCampo(chaves,valores,"ts"));
   datetime validade=StringToTime(LicCampo(chaves,valores,"validade")+" 23:59:59");
   if(TimeGMT()-ts>LIC_TOLERANCIA_SEG)
      return false;
   if(TimeCurrent()>validade)
      return false;

   g_lonStatus=LICON_ATIVA;
   g_lonContratos=(int)StringToInteger(LicCampo(chaves,valores,"contratos"));
   g_lonValidade=validade;
   g_lonUltimaOk=ts;
   g_lonMotivo="sem contato com o servidor, usando a ultima confirmacao";
   return true;
  }

//+------------------------------------------------------------------+
//| Mensagens e aviso de atualizacao                                 |
//+------------------------------------------------------------------+
void LicMostrarAvisos(const string &chaves[],const string &valores[])
  {
   // Mensagem em massa: cada id aparece uma vez por terminal.
   long msgId=StringToInteger(LicCampo(chaves,valores,"msg_id"));
   string msg=LicCampo(chaves,valores,"msg");
   string gv="CohenLic_msg_"+LIC_ROBO;
   double visto=GlobalVariableCheck(gv) ? GlobalVariableGet(gv) : 0;
   if(msgId>0 && msg!="" && msgId>(long)visto)
     {
      GlobalVariableSet(gv,(double)msgId);
      g_lonAviso=msg;
      Alert("Rodrigo Cohen: ",msg);
     }

   // Atualizacao: uma vez por sessao do MT5.
   string upd=LicCampo(chaves,valores,"upd_versao");
   if(upd!="" && upd!=LIC_VERSAO && upd!=g_lonUpdMostrada)
     {
      g_lonUpdMostrada=upd;
      string notas=LicCampo(chaves,valores,"upd_notas");
      string url=LicCampo(chaves,valores,"upd_url");
      g_lonAviso="Nova versao "+upd+" disponivel. "+notas;
      Alert("Nova versao ",upd," do ",LIC_ROBO," disponivel. ",notas);
      if(url!="")
         Print("Baixe a versao ",upd," aqui: ",url);
     }
  }

// Sem resposta valida do servidor.
void LicFalhou(const string motivo)
  {
   // Ja estava ativa nesta sessao e ainda dentro das 24h: segue ativa.
   if(g_lonStatus==LICON_ATIVA && TimeGMT()-g_lonUltimaOk<=LIC_TOLERANCIA_SEG && TimeCurrent()<=g_lonValidade)
     {
      g_lonMotivo="sem contato com o servidor ("+motivo+"), usando a ultima confirmacao";
      return;
     }
   if(LicUsarCache())
      return;
   g_lonStatus=LICON_SEM_RESPOSTA;
   g_lonMotivo=motivo;
  }

//+------------------------------------------------------------------+
//| Consulta ao servidor                                             |
//+------------------------------------------------------------------+
void LicVerificar()
  {
   // Logo que o MT5 abre, a conta pode ainda nao estar conectada (login 0).
   // Nao conta como tentativa: o proximo OnTimer tenta de novo.
   if(AccountInfoInteger(ACCOUNT_LOGIN)==0)
     {
      if(g_lonStatus!=LICON_ATIVA)
         g_lonMotivo="aguardando conexao com a corretora";
      return;
     }
   g_lonUltimaTent=TimeLocal();

   string nonce=IntegerToString((long)GetTickCount64())+"-"+IntegerToString(MathRand())+"-"+IntegerToString(MathRand());
   string corpo="robo="+LicUrlEnc(LIC_ROBO)
                +"&conta="+LicConta()
                +"&nonce="+nonce
                +"&versao="+LicUrlEnc(LIC_VERSAO)
                +"&servidor="+LicUrlEnc(AccountInfoString(ACCOUNT_SERVER))
                +"&real="+(AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL ? "1" : "0")
                +"&titular="+LicUrlEnc(AccountInfoString(ACCOUNT_NAME));

   uchar u[];
   LicBytes(corpo,u);
   char envio[];
   ArrayResize(envio,ArraySize(u));
   for(int i=0;i<ArraySize(u);i++)
      envio[i]=(char)u[i];

   char resposta[];
   string cabecalhos;
   ResetLastError();
   int http=WebRequest("POST",LIC_URL+"/api/v1/licenca",
                       "Content-Type: application/x-www-form-urlencoded\r\n",
                       LIC_TIMEOUT_MS,envio,resposta,cabecalhos);

   if(http==-1)
     {
      int erro=GetLastError();
      if(erro==4014 && !g_lonAvisouUrl)
        {
         g_lonAvisouUrl=true;
         Alert("Para o ",LIC_ROBO," conferir a licenca, libere este endereco no MT5: Ferramentas > Opcoes > Experts > ",
               "marque 'Permitir WebRequest para as URLs listadas' e adicione ",LIC_URL);
        }
      LicFalhou(erro==4014 ? "endereco do servidor nao liberado no MT5" : "sem internet ou servidor fora do ar");
      return;
     }
   if(http!=200)
     {
      LicFalhou("servidor respondeu "+IntegerToString(http));
      return;
     }

   uchar bruto[];
   ArrayResize(bruto,ArraySize(resposta));
   for(int i=0;i<ArraySize(resposta);i++)
      bruto[i]=(uchar)resposta[i];

   string chaves[],valores[];
   if(!LicLerResposta(CharArrayToString(bruto,0,WHOLE_ARRAY,CP_UTF8),nonce,chaves,valores))
     {
      LicFalhou("resposta do servidor com assinatura invalida");
      return;
     }

   string st=LicCampo(chaves,valores,"status");
   g_lonStatus=LicStatusDeTexto(st);
   g_lonContratos=(int)StringToInteger(LicCampo(chaves,valores,"contratos"));
   string v=LicCampo(chaves,valores,"validade");
   g_lonValidade=(v!="" ? StringToTime(v+" 23:59:59") : 0);

   if(g_lonStatus==LICON_ATIVA)
     {
      g_lonUltimaOk=(datetime)StringToInteger(LicCampo(chaves,valores,"ts"));
      g_lonMotivo="licenca ativa ate "+TimeToString(g_lonValidade,TIME_DATE);
      LicSalvarCache(bruto);
     }
   else
     {
      // Decisao do servidor vale mais que o cache.
      LicApagarCache();
      if(g_lonStatus==LICON_PENDENTE)
         g_lonMotivo="aguardando liberacao da conta "+LicConta();
      else if(g_lonStatus==LICON_BLOQUEADA)
         g_lonMotivo="licenca bloqueada. Fale com o suporte";
      else if(g_lonStatus==LICON_EXPIRADA)
         g_lonMotivo="licenca vencida em "+TimeToString(g_lonValidade,TIME_DATE);
      else
         g_lonMotivo="conta "+LicConta()+" sem licenca para o "+LIC_ROBO;
     }

   LicMostrarAvisos(chaves,valores);
  }

//+------------------------------------------------------------------+
//| API para o robo                                                  |
//+------------------------------------------------------------------+
// Chame no OnInit.
void LicOnline_Init()
  {
   if(MQLInfoInteger(MQL_TESTER) || MQLInfoInteger(MQL_OPTIMIZATION))
     {
      g_lonStatus=LICON_TESTADOR;
      g_lonContratos=LIC_CONTRATOS_TESTADOR;
      g_lonMotivo="testador de estrategia";
      return;
     }
   MathSrand((uint)GetTickCount());
   LicVerificar();
   Print(LIC_ROBO," ",LIC_VERSAO,": ",g_lonMotivo);
  }

// Chame no OnTimer (o robo precisa de EventSetTimer com ate 60s).
// So consulta o servidor quando passa o intervalo.
void LicOnline_Timer()
  {
   if(g_lonStatus==LICON_TESTADOR)
      return;
   int intervalo=(g_lonStatus==LICON_ATIVA ? LIC_INTERVALO_SEG : LIC_INTERVALO_PENDENTE_SEG);
   if(TimeLocal()-g_lonUltimaTent<intervalo)
      return;
   ENUM_LIC_ONLINE antes=g_lonStatus;
   LicVerificar();
   if(g_lonStatus!=antes)
      Print(LIC_ROBO,": ",g_lonMotivo);
  }

ENUM_LIC_ONLINE LicOnline_Status()    { return g_lonStatus; }
int             LicOnline_Contratos() { return g_lonContratos; }
datetime        LicOnline_Validade()  { return g_lonValidade; }
string          LicOnline_Motivo()    { return g_lonMotivo; }
string          LicOnline_Aviso()     { return g_lonAviso; }

// Junta a licenca online com a chave offline antiga.
//   - online ATIVA: opera, com os contratos do painel;
//   - online BLOQUEADA: nao opera, mesmo com chave offline;
//   - qualquer outro caso: vale a chave offline, se houver.
// Use SO antes de abrir operacao nova.
bool LicOnline_PodeOperar(const bool offlineValida,const int offlineContratos,int &contratos,string &motivo)
  {
   motivo=g_lonMotivo;
   if(g_lonStatus==LICON_ATIVA || g_lonStatus==LICON_TESTADOR)
     {
      contratos=g_lonContratos;
      return contratos>0;
     }
   if(g_lonStatus==LICON_BLOQUEADA)
     {
      contratos=0;
      return false;
     }
   if(offlineValida)
     {
      contratos=offlineContratos;
      motivo="chave offline";
      return true;
     }
   contratos=0;
   return false;
  }

#endif
