# Entrevista de instalação

Faça em blocos curtos. Sempre ofereça uma sugestão padrão entre parênteses que a pessoa possa aceitar com "ok". Não faça todas as perguntas de uma vez.

## Bloco 1 · Quem é

1. Como você quer aparecer nas mensagens? (nome ou apelido que o grupo conhece)
2. Em uma frase, quem é você no mercado? (ex.: "trader de mini índice há 8 anos")
3. Tem alguma certificação ou registro? (CNPI, CNPI-T, CEA, CFP, nenhum) Só registre. Não julgue.

## Bloco 2 · O grupo

4. Pra quem é o grupo? (iniciantes / quem já opera / alunos de um curso / misto)
5. Quais mercados entram? Pode marcar mais de um:
   - mini índice e mini dólar (WIN/WDO)
   - ações brasileiras
   - cripto
   - só macro e notícias
6. Quer o gráfico do último pregão de WIN e WDO na manhã? (só se marcou WIN/WDO; padrão: sim)

## Bloco 3 · Horários

7. Que horas a mensagem da manhã deve chegar? (padrão: 08:20)
8. Quer mensagem à tarde, só quando tiver algo relevante? (padrão: sim, 14:00)
9. Que horas o fechamento? (padrão: 17:30)
10. Fuso horário (padrão: America/Sao_Paulo)

## Bloco 4 · Voz

11. Cole aqui de 5 a 10 mensagens que você já mandou em grupo ou postou. Quanto mais do seu jeito normal, melhor.
12. Tem palavras ou expressões que você sempre usa? E alguma que você odeia ver?
13. Usa emoji? Quais? (padrão: poucos)
14. Tem valores ou temas pessoais que podem aparecer de vez em quando (família, fé, esporte)? E temas proibidos (política, futebol)?

Depois do bloco 4, monte o guia de voz com `voz.md`, mostre um resumo de 5 linhas e peça ajuste.

## Bloco 5 · Conteúdo e responsabilidade

15. Você vai publicar níveis de preço, cenário do dia ou recomendação? (sim / só níveis e cenário / não, só notícia e educação)
    Antes de gravar, mostre o aviso de `compliance.md` e peça confirmação.
16. Qual aviso legal vai no fim das mensagens? (padrão: "_Conteúdo educacional. Não é recomendação de investimento._")
17. Enquete na manhã? (padrão: sim, sobre disciplina e risco do dia)
18. Enquete no fechamento? (padrão: sim, "Como foi seu dia no mercado hj?")

## Bloco 6 · Links e chamada

19. Tem algum link para divulgar na manhã? (sala ao vivo, canal, nada) Se sim, texto curto do convite.
20. Link de convite do próprio grupo, para o "encaminha pra quem tá começando" do fechamento. (sem link, o fechamento pede só para encaminhar)
21. Algum produto, parceiro ou marca que pode ser citado? (padrão: nenhum)

## Bloco 7 · Grupos

22. Rode `scripts/listar_grupos.py` e peça para escolher, pelo nome, o grupo de teste e o oficial.

## Formato do `perfil.json`

```json
{
  "nome_exibicao": "Nome que aparece",
  "apresentacao": "trader de mini índice há 8 anos",
  "registro": "nenhum",
  "publico": "iniciantes",
  "mercados": ["win_wdo", "acoes", "cripto", "macro"],
  "grafico_win_wdo": true,
  "fuso": "America/Sao_Paulo",
  "horarios": {"manha": "08:20", "tarde": "14:00", "fechamento": "17:30"},
  "conteudo_analise": "niveis_e_cenario",
  "aviso_legal": "_Conteúdo educacional. Não é recomendação de investimento._",
  "enquete_manha": true,
  "enquete_fechamento": true,
  "link_manha": {"texto": "Sala ao vivo abre 9h", "url": "https://..."},
  "link_convite_grupo": "https://chat.whatsapp.com/...",
  "marcas_permitidas": [],
  "temas_ok": ["família"],
  "temas_proibidos": ["política partidária"],
  "voz": "GUIA DE VOZ montado com voz.md (texto livre, várias linhas)",
  "destino_teste": "1203630000000000-group",
  "destino_oficial": "1203630000000001-group",
  "modo": "teste"
}
```

Valores de `conteudo_analise`:
- `recomendacao`: pode falar em comprar/vender, alvos e stops, na voz e por conta da pessoa.
- `niveis_e_cenario`: níveis do pregão anterior e um cenário do dia, sem dizer ao leitor o que fazer.
- `so_noticias`: sem níveis e sem cenário. Só notícia, agenda, macro e educação.

`horarios.tarde` pode ser `null` para não ter tarde. `link_manha` e `link_convite_grupo` podem ser `null`.
