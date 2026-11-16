# Ambiente na nuvem, credenciais e permissão de envio

As Rotinas rodam em sessões novas, no ambiente da nuvem da pessoa. Três coisas precisam estar lá.

## 1. Rede

O ambiente precisa alcançar: `api.z-api.io`, `cotacao.b3.com.br`, `query1.finance.yahoo.com`, `api.coingecko.com` (se tiver cripto) e os sites de notícia. O jeito mais simples é usar acesso de rede "completo" no ambiente. Se a pessoa preferir restrito, liste esses hosts. Use as ferramentas de ambiente (`get_environment`, `update_environment`) quando estiverem disponíveis. Senão, mande a pessoa em claude.ai/code, no ambiente, em Rede.

## 2. Credenciais da Z-API

A Z-API põe o ID da instância e o token dentro da URL, então eles precisam existir como variáveis de ambiente:

- `ZAPI_INSTANCE_ID`
- `ZAPI_TOKEN`
- `ZAPI_CLIENT_TOKEN` (token de segurança da conta, em Segurança no painel da Z-API)

A **própria pessoa** cadastra essas três no ambiente (claude.ai/code, no ambiente, em Variáveis de ambiente). Diga onde clicar e o nome exato de cada uma. **Nunca peça o valor no chat.** Avise que essas variáveis ficam salvas em texto no ambiente: quem tiver acesso ao ambiente vê. Se um dia vazarem, gere tokens novos na Z-API.

Para conferir sem expor:

```bash
for v in ZAPI_INSTANCE_ID ZAPI_TOKEN ZAPI_CLIENT_TOKEN; do [ -n "${!v}" ] && echo "$v ok" || echo "$v FALTANDO"; done
```

## 3. Permissão do comando de envio

Sessões de Rotina rodam em modo automático. Sem uma regra explícita, o envio de mensagem para fora pode ser bloqueado. A regra fica no script de setup do ambiente. A pessoa cola isto em Script de setup:

```bash
mkdir -p ~/.claude
cat > ~/.claude/settings.json <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(python3 /tmp/zap/enviar.py:*)"
    ]
  }
}
EOF
```

Se o arquivo já existir com outras regras, junte a regra nova sem apagar as antigas.

As Rotinas sempre chamam o envio exatamente assim: `python3 /tmp/zap/enviar.py <DESTINO> /tmp/zap/payload.json`. Não mude esse comando, senão a regra não vale.

## Depois de salvar

Variáveis e script de setup só valem em sessões novas. Peça para a pessoa abrir uma sessão nova com esta skill e continuar a instalação de onde parou (etapa 4 do SKILL.md).
