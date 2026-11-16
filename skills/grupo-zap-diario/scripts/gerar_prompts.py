"""Monta os prompts das Rotinas (manha, tarde, fechamento) a partir do perfil da pessoa.

Uso: python3 gerar_prompts.py <perfil.json> <pasta_saida>
Gera <pasta_saida>/manha.txt, tarde.txt (se houver tarde) e fechamento.txt, cada um com os
scripts necessários embutidos no fim, para a Rotina gravar e rodar sem depender de nada externo.
"""
import json
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
TEMPLATES = os.path.join(AQUI, "..", "templates")

OBRIGATORIOS = ["nome_exibicao", "apresentacao", "publico", "mercados", "fuso", "horarios",
                "conteudo_analise", "aviso_legal", "voz", "destino_teste", "destino_oficial", "modo"]

MERCADOS = {
    "win_wdo": "mini índice (WIN) e mini dólar (WDO) na B3",
    "acoes": "ações brasileiras e Ibovespa",
    "cripto": "cripto (bitcoin e ethereum)",
    "macro": "macro e notícias que mexem com o mercado",
}

CONTEUDO = {
    "recomendacao": ("A pessoa escolheu publicar recomendações, por conta e responsabilidade dela. Pode citar compra, venda, "
                     "alvo e stop na voz dela, sempre com preço de fonte consultada agora e com o aviso legal."),
    "niveis_e_cenario": ("Publique níveis do pregão anterior (máxima, mínima, fechamento, VWAP) e UM cenário curto do dia. "
                         "Nunca diga ao leitor o que fazer com a posição dele."),
    "so_noticias": ("Sem níveis, sem cenário e sem direção de preço. Só notícia, agenda, macro, educação e disciplina."),
}


def erro(msg):
    sys.exit(f"perfil inválido: {msg}")


def validar(p):
    for k in OBRIGATORIOS:
        if k not in p or p[k] in ("", None, []):
            erro(f"campo '{k}' faltando")
    if p["conteudo_analise"] not in CONTEUDO:
        erro("conteudo_analise deve ser recomendacao, niveis_e_cenario ou so_noticias")
    if p["modo"] not in ("teste", "oficial"):
        erro("modo deve ser teste ou oficial")
    for k in ("destino_teste", "destino_oficial"):
        if not re.fullmatch(r"\d{10,25}-group", p[k]):
            erro(f"{k} deve ser um id de grupo terminado em -group")
    for m in p["mercados"]:
        if m not in MERCADOS:
            erro(f"mercado desconhecido: {m}")
    for k, v in p["horarios"].items():
        if v is not None and not re.fullmatch(r"\d{2}:\d{2}", v):
            erro(f"horário {k} deve ser HH:MM")


def lista(v, vazio):
    return ", ".join(v) if v else vazio


def variaveis(p):
    usa_win = "win_wdo" in p["mercados"]
    tem_grafico = usa_win and p.get("grafico_win_wdo", True) and p["conteudo_analise"] != "so_noticias"
    link = p.get("link_manha")
    convite = p.get("link_convite_grupo")
    v = {
        "NOME": p["nome_exibicao"],
        "APRESENTACAO": p["apresentacao"],
        "PUBLICO": p["publico"],
        "MERCADOS": "; ".join(MERCADOS[m] for m in p["mercados"]),
        "FUSO": p["fuso"],
        "HORA_MANHA": p["horarios"]["manha"],
        "HORA_TARDE": p["horarios"].get("tarde") or "",
        "HORA_FECH": p["horarios"]["fechamento"],
        "CONTEUDO_REGRA": CONTEUDO[p["conteudo_analise"]],
        "AVISO_LEGAL": p["aviso_legal"],
        "VOZ": p["voz"].strip(),
        "TEMAS_OK": lista(p.get("temas_ok"), "nenhum tema pessoal"),
        "TEMAS_PROIBIDOS": lista(p.get("temas_proibidos"), "nenhum além das regras fixas"),
        "MARCAS": lista(p.get("marcas_permitidas"), "nenhuma: não cite produto, marca ou parceiro"),
        "DESTINO": p["destino_oficial"] if p["modo"] == "oficial" else p["destino_teste"],
        "DESTINO_TESTE": p["destino_teste"],
        "DESTINO_OFICIAL": p["destino_oficial"],
        "LINK_MANHA": (f'- Logo depois da saudação: "{link["texto"]}" + o link exatamente assim: {link["url"]}'
                       if link and link.get("url") else "- Sem link na manhã."),
        "CONVITE": (f'Conhece alguém que tá começando no mercado? Encaminha essa mensagem pra ele. O link do grupo é {convite} '
                    "(escreva esse convite na voz da pessoa, curto, e mantenha o link exatamente igual)."
                    if convite else
                    "Uma linha pedindo para encaminhar a mensagem para quem está começando no mercado (sem link)."),
        "ENQUETE_MANHA": ("SIM: pergunta curta sobre disciplina ou risco do dia + 3 opções de no máximo 40 caracteres. "
                          "Nunca palpite de preço."
                          if p.get("enquete_manha", True) else "NÃO: não faça enquete na manhã."),
        "ENQUETE_FECH": ('SIM: pergunta "Como foi seu dia no mercado hj?" com as opções "Segui o plano e fechei no lucro", '
                         '"Segui o plano e tomei stop", "Saí do plano", "Hj fiquei de fora" (adapte só o "hj" à voz da pessoa).'
                         if p.get("enquete_fechamento", True) else "NÃO: não faça enquete no fechamento."),
        "GRAFICO": ("SIM" if tem_grafico else "NÃO"),
        "TITULO_GRAFICO": p.get("titulo_grafico") or p["nome_exibicao"].upper(),
        "USA_WIN": "SIM" if usa_win else "NÃO",
    }
    return v, tem_grafico


def preencher(texto, v):
    def troca(m):
        chave = m.group(1)
        if chave not in v:
            erro(f"template usa {{{{{chave}}}}} sem valor")
        return v[chave]
    return re.sub(r"\{\{([A-Z_]+)\}\}", troca, texto)


def anexar(scripts):
    partes = ["", "=== ARQUIVOS ===", ""]
    for destino, nome in scripts:
        with open(os.path.join(AQUI, nome), encoding="utf-8") as f:
            partes += [f"--- {destino} ---", f.read().rstrip(), ""]
    return "\n".join(partes)


def main():
    perfil_path, saida = sys.argv[1], sys.argv[2]
    p = json.load(open(perfil_path, encoding="utf-8"))
    validar(p)
    v, tem_grafico = variaveis(p)
    os.makedirs(saida, exist_ok=True)
    rotinas = [("manha", True), ("tarde", bool(p["horarios"].get("tarde"))), ("fechamento", True)]
    for nome, ativa in rotinas:
        if not ativa:
            continue
        with open(os.path.join(TEMPLATES, f"{nome}.md"), encoding="utf-8") as f:
            texto = preencher(f.read(), v)
        scripts = [("/tmp/zap/enviar.py", "enviar.py")]
        if nome == "manha" and tem_grafico:
            scripts.append(("/tmp/zap/grafico.py", "grafico.py"))
        texto += anexar(scripts)
        with open(os.path.join(saida, f"{nome}.txt"), "w", encoding="utf-8") as f:
            f.write(texto)
        print(f"{nome}.txt: {len(texto)} caracteres")
    print(f"destino em uso: {'OFICIAL' if p['modo'] == 'oficial' else 'TESTE'}")


if __name__ == "__main__":
    main()
