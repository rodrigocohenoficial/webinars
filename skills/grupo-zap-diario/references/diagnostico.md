# Quando a mensagem não sai

Cheque nesta ordem e conte à pessoa o que achou, em linguagem simples.

1. **A Rotina rodou?** `list_triggers`: veja `last_run` da Rotina (horário e status). Se não rodou, confira se está `enabled` e o `cron_expression`.
2. **Quanto tempo durou?** Menos de 2 minutos costuma ser parada logo no começo: credencial faltando, permissão bloqueada ou fonte fora do ar. Peça para a pessoa abrir a sessão da Rotina no app e mandar um print da última mensagem dela: é ali que aparece o motivo.
3. **Permissão bloqueada** ("auto mode classifier", "permission denied"): confira se o script de setup do ambiente tem a regra de `references/ambiente.md` e se o comando no prompt está exatamente igual a ela. Não reescreva o prompt para "convencer" o bloqueio.
4. **Credencial**: rode a conferência de variáveis de `ambiente.md` numa sessão nova do mesmo ambiente.
5. **Z-API**: teste com `scripts/enviar.py` mandando "teste" no grupo de teste. Erro 401 ou 403 é token. Erro de "not admin" é o número sem admin no grupo. Instância desconectada se resolve no painel da Z-API (QR code).
6. **Fonte de dados**: teste a URL da B3 ou do Yahoo. Se estiver bloqueada, o prompt já manda seguir sem aquele trecho. Se a Rotina parou mesmo assim, reforce essa instrução no template e regere.

Depois de corrigir, ofereça disparar a Rotina na hora com `fire_trigger` **no grupo de teste**, se ainda fizer sentido no horário.
