"""Envia mensagens para um grupo de WhatsApp pela Z-API.

Uso: python3 enviar.py <destino-group-id> <payload.json>
payload.json = lista de itens, enviados em ordem:
  {"tipo": "texto",   "texto": "..."}
  {"tipo": "imagem",  "arquivo": "grafico.png", "legenda": "..."}
  {"tipo": "enquete", "pergunta": "...", "opcoes": ["a", "b", "c"]}
Credenciais: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (variáveis de ambiente).
Imprime um JSON com o messageId de cada item; sai com código 1 se algum envio falhar.
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = "https://api.z-api.io/instances/{}/token/{}".format(os.environ["ZAPI_INSTANCE_ID"], os.environ["ZAPI_TOKEN"])
HEAD = {"Client-Token": os.environ["ZAPI_CLIENT_TOKEN"], "Content-Type": "application/json; charset=utf-8"}


def post(rota, corpo):
    dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
    for tentativa in range(2):
        try:
            req = urllib.request.Request(f"{BASE}/{rota}", data=dados, headers=HEAD, method="POST")
            with urllib.request.urlopen(req, timeout=60) as r:
                resp = json.load(r)
            if resp.get("messageId") or resp.get("id"):
                return resp
            erro = resp
        except urllib.error.HTTPError as e:
            erro = f"HTTP {e.code}: {e.read()[:300]!r}"
        except Exception as e:  # rede
            erro = repr(e)
        if tentativa == 0:
            time.sleep(20)
    raise RuntimeError(f"{rota} falhou: {erro}")


def enviar(destino, item):
    tipo = item["tipo"]
    if tipo == "texto":
        return post("send-text", {"phone": destino, "message": item["texto"]})
    if tipo == "imagem":
        with open(item["arquivo"], "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        corpo = {"phone": destino, "image": "data:image/png;base64," + b64}
        if item.get("legenda"):
            corpo["caption"] = item["legenda"]
        return post("send-image", corpo)
    if tipo == "enquete":
        return post("send-poll", {"phone": destino, "message": item["pergunta"],
                                  "poll": [{"name": o} for o in item["opcoes"]], "pollMaxOptions": 1})
    raise ValueError(f"tipo desconhecido: {tipo}")


def main():
    destino, arquivo = sys.argv[1], sys.argv[2]
    itens = json.load(open(arquivo, encoding="utf-8"))
    resultado, falhou = [], False
    for i, item in enumerate(itens):
        try:
            r = enviar(destino, item)
            resultado.append({"item": i, "tipo": item["tipo"], "ok": True, "messageId": r.get("messageId") or r.get("id")})
        except Exception as e:
            falhou = True
            resultado.append({"item": i, "tipo": item["tipo"], "ok": False, "erro": str(e)})
            break  # não manda o resto fora de ordem
        time.sleep(3)
    print(json.dumps(resultado, ensure_ascii=False))
    sys.exit(1 if falhou else 0)


if __name__ == "__main__":
    main()
