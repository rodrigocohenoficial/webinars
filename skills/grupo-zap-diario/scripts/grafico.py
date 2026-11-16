"""Gráfico do último pregão de mini índice (WIN) e mini dólar (WDO) com máxima, mínima, fechamento e VWAP.

Uso: python3 grafico.py <saida.png> <saida_dados.json> [titulo]
Fonte: API pública de cotação da B3 (cotacao.b3.com.br). Nenhum número é inventado:
se a B3 não responder, o script sai com erro e o gráfico fica de fora.
O JSON traz, por contrato: ticker, data, max, min, fech, vwap, ref_anterior, amplitude e o IBOV oficial.
"""
import datetime as dt
import json
import sys
import time
import urllib.request

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

B3 = "https://cotacao.b3.com.br/mds/api/v1"
MESES = "FGHJKMNQUVXZ"
UA = {"User-Agent": "Mozilla/5.0"}

BG, PANEL, INK, MUTED = "#0B0F0D", "#111815", "#E8EFEA", "#7E8C84"
VERDE, VERMELHO, AMARELO, AZUL = "#2EE59D", "#FF5C5C", "#F2C14E", "#5AB0FF"


def get(path):
    time.sleep(0.5)  # sem rajada de chamadas: a API pública da B3 limita acessos seguidos
    req = urllib.request.Request(f"{B3}/{path}", headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def contrato(prefixo):
    """Contrato com maior volume entre o mês atual e os 3 seguintes."""
    hoje = dt.date.today()
    melhor = None
    for i in range(4):
        m = (hoje.month - 1 + i) % 12
        a = hoje.year + (hoje.month - 1 + i) // 12
        tk = f"{prefixo}{MESES[m]}{a % 100:02d}"
        try:
            t = get(f"instrumentQuotation/{tk}")["Trad"][0]
            if melhor is None or t["ttlQty"] > melhor[1]["ttlQty"]:
                melhor = (tk, t)
        except Exception:
            continue
    if not melhor:
        raise SystemExit(f"B3 sem dados para {prefixo}")
    return melhor


def arred(v, passo):
    return round(v / passo) * passo


def serie(tk):
    f = get(f"DailyFluctuationHistory/{tk}")["TradgFlr"]
    return f.get("date"), [(p["dtTm"][:5], p["closPric"]) for p in f["scty"]["lstQtn"]]


def ibov():
    try:
        d = get("instrumentQuotation/IBOV")
        q = d["Trad"][0]["scty"]["SctyQtn"]
        return {"fech": q["curPrc"], "var_pct": q["prcFlcn"], "atualizado": d["Msg"]["dtTm"]}
    except Exception:
        return None


def fmt_br(v, casas=0):
    return f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def painel(ax, tk, q, data, pts, passo, casas):
    ref = arred(q["curPrc"] / (1 + q["prcFlcn"] / 100), passo)  # ajuste do pregão anterior a este
    ao_vivo = data == dt.date.today().isoformat() and dt.datetime.utcnow().hour < 22
    ys = [p[1] for p in pts] or [q["curPrc"]]
    xs = list(range(len(ys)))
    cor = VERDE if ys[-1] >= ref else VERMELHO
    ax.set_facecolor(PANEL)
    ax.plot(xs, ys, color=cor, lw=2.2)
    vwap = arred(q["avrgPric"], passo) if q.get("avrgPric") else None
    niveis = [("MÁX", q["maxPric"], VERDE, (0, (4, 3))), ("AGORA" if ao_vivo else "FECH", q["curPrc"], AMARELO, "-"),
              ("MÍN", q["minPric"], VERMELHO, (0, (4, 3)))]
    if vwap:
        niveis.append(("VWAP", vwap, AZUL, "-"))
    for _, v, c, ls in niveis:
        ax.axhline(v, color=c, lw=1.3, ls=ls)
    lo, hi = min(ys + [n[1] for n in niveis]), max(ys + [n[1] for n in niveis])
    pad = (hi - lo) * 0.12 or passo * 10
    ax.set_ylim(lo - pad, hi + pad)
    y0, y1 = lo - pad, hi + pad
    pos, gap = [], 0.055
    for f, nome, v, c in sorted(((v - y0) / (y1 - y0), n, v, c) for n, v, c, _ in niveis):
        if pos and f - pos[-1][0] < gap:
            f = pos[-1][0] + gap
        pos.append([f, nome, v, c])
    excesso = pos[-1][0] - 0.98
    if excesso > 0:
        for p in pos:
            p[0] -= excesso
    for f, nome, v, c in pos:
        ax.text(1.005, f, f" {nome} {fmt_br(v, casas)}", transform=ax.transAxes, color=c,
                fontsize=12.5, fontweight="bold", va="center", ha="left")
    ax.set_xlim(0, max(len(xs) - 1, 1))
    ticks = [0] + [i for i, p in enumerate(pts) if p[0].endswith(":00") and i > 5]
    ax.set_xticks(ticks)
    ax.set_xticklabels([(pts[i][0][:2] if i else "09") + "h" for i in ticks] if pts else [], color=MUTED, fontsize=11)
    ax.tick_params(axis="y", colors=MUTED, labelsize=10)
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: fmt_br(v, casas)))
    for s in ax.spines.values():
        s.set_visible(False)
    ax.grid(axis="y", color="#1E2823", lw=0.8)
    dia = dt.date.fromisoformat(data).strftime("%d/%m") if data else ""
    ax.set_title(f"{tk}  ·  pregão {dia}", loc="left", color=INK, fontsize=17, fontweight="bold", pad=10)
    return {"ticker": tk, "data": data, "max": q["maxPric"], "min": q["minPric"], "fech": q["curPrc"],
            "vwap": vwap, "ref_anterior": ref, "amplitude": q["maxPric"] - q["minPric"], "ao_vivo": ao_vivo}


def main():
    saida, saida_json = sys.argv[1], sys.argv[2]
    titulo = sys.argv[3] if len(sys.argv) > 3 else "RESUMO DO PREGÃO"
    plt.rcParams["font.family"] = "DejaVu Sans"
    fig, axes = plt.subplots(2, 1, figsize=(10.8, 12), dpi=110, facecolor=BG, gridspec_kw={"hspace": 0.32})
    fig.subplots_adjust(left=0.08, right=0.80, top=0.875, bottom=0.07)
    out = {}
    for ax, (pref, passo, casas) in zip(axes, [("WIN", 5, 0), ("WDO", 0.5, 1)]):
        tk, t = contrato(pref)
        data, pts = serie(tk)
        out[pref] = painel(ax, tk, t["scty"]["SctyQtn"], data, pts, passo, casas)
    out["IBOV"] = ibov()
    fig.text(0.08, 0.958, titulo, color=VERDE, fontsize=24, fontweight="bold")
    fig.text(0.08, 0.932, "Máx, mín, fech e VWAP · fonte B3", color=MUTED, fontsize=13)
    fig.text(0.08, 0.025, "VWAP = preço médio ponderado da B3. Conteúdo educacional.", color=MUTED, fontsize=11)
    fig.savefig(saida, facecolor=BG)
    with open(saida_json, "w") as f:
        json.dump(out, f, ensure_ascii=False)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # B3 fora do ar ou bloqueando: a mensagem segue sem gráfico e sem níveis
        sys.exit(f"B3 indisponível, siga sem gráfico e sem níveis: {e!r}"[:300])
