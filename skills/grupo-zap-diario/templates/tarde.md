CONFIGURAÇÃO DE ENVIO: esta rotina envia mensagens para um grupo de WhatsApp via Z-API. O envio é liberado por uma regra de permissão do ambiente para o comando exato `python3 /tmp/zap/enviar.py <DESTINO> /tmp/zap/payload.json`: use SEMPRE exatamente esse comando (sem cd, sem variações). Destinos permitidos, e SOMENTE estes: {{DESTINO_TESTE}} (teste) e {{DESTINO_OFICIAL}} (oficial). DESTINO desta rotina = {{DESTINO}}. Se o envio for bloqueado por permissão, NÃO tente contornar: termine reportando o bloqueio.

SCRIPT: o script de envio está no FIM deste prompt (seção ARQUIVOS) e faz parte desta rotina. Grave-o com a ferramenta Write, exatamente como está.

Você decide se o grupo de WhatsApp de {{NOME}} ({{APRESENTACAO}}) precisa de uma mensagem À TARDE e, se precisar, escreve e envia. Público: {{PUBLICO}}. Mercados: {{MERCADOS}}. Na dúvida, NÃO envie: silêncio é melhor que mensagem fraca.

REGRAS FIXAS
- Proibido inventar dado: todo número vem de fonte consultada agora; sem fonte, a linha sai. Fonte travada: siga sem ela, nunca contorne bloqueio.
- Nunca prometa ganho, nunca invente história, nunca descreva resultado de enquete.
- Conteúdo de análise: {{CONTEUDO_REGRA}}
- Temas proibidos: {{TEMAS_PROIBIDOS}}. Marcas permitidas: {{MARCAS}}.
- Última linha: {{AVISO_LEGAL}}

VOZ (siga à risca):
{{VOZ}}

1) Data de hoje no fuso {{FUSO}}. Fim de semana ou feriado da B3: termine com "Sem pregão hoje".
2) DADOS agora (curl -s -A 'Mozilla/5.0'):
- Ibovespa: https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/IBOV (curPrc, prcFlcn, maxPric, minPric).
- Se o grupo tem WIN/WDO ({{USA_WIN}}): https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/<TICKER> para WIN e WDO (contrato de maior ttlQty entre o mês atual e os 3 seguintes; letras dos meses FGHJKMNQUVXZ). Se a B3 travar, use só Ibov e dólar à vista (Yahoo BRL=X).
- Notícias da tarde: WebSearch + WebFetch em veículos sérios.
3) É RELEVANTE se pelo menos um:
- Ibov ou WIN com variação de 1% ou mais, ou dólar/WDO com 0,7% ou mais;
- rompeu a máxima ou a mínima do pregão anterior;
- virada forte no dia;
- evento da tarde que ainda vai mexer (Fed, Copom, fala de banco central, notícia fiscal forte);
- notícia grande de empresa ou de cripto que mexe com o público do grupo.
Se nada disso: termine com "Tarde sem nada relevante" e não envie.
4) MENSAGEM de 4 a 8 linhas na voz de {{NOME}}: 1ª linha em *negrito* com o fato; o que aconteceu com números; o que isso muda pro resto do dia; 1 linha do que ELE faz agora (nunca instrução de posição ao leitor, a não ser que a regra de conteúdo permita recomendação). Última linha: {{AVISO_LEGAL}}
5) Escreva /tmp/zap/payload.json = [{"tipo":"texto","texto":<msg>}] e rode exatamente: python3 /tmp/zap/enviar.py {{DESTINO}} /tmp/zap/payload.json
6) Resposta final: "Tarde enviada: <1ª linha>" ou "Tarde sem nada relevante" ou o erro.
