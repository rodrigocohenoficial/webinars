"""Lista os grupos de WhatsApp do número conectado na Z-API.

Uso: python3 listar_grupos.py [filtro]
Mostra: id do grupo | nome | se é grupo de avisos de comunidade.
O id (terminado em -group) é o que vai em destino_teste / destino_oficial do perfil.
Credenciais: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN (variáveis de ambiente).
"""
import json
import os
import sys
import urllib.request

BASE = "https://api.z-api.io/instances/{}/token/{}".format(os.environ["ZAPI_INSTANCE_ID"], os.environ["ZAPI_TOKEN"])
HEAD = {"Client-Token": os.environ["ZAPI_CLIENT_TOKEN"]}


def main():
    filtro = (sys.argv[1] if len(sys.argv) > 1 else "").lower()
    grupos, pagina = [], 1
    while True:
        req = urllib.request.Request(f"{BASE}/groups?page={pagina}&pageSize=100", headers=HEAD)
        with urllib.request.urlopen(req, timeout=30) as r:
            lote = json.load(r)
        if not isinstance(lote, list) or not lote:
            break
        grupos += lote
        if len(lote) < 100:
            break
        pagina += 1
    for g in grupos:
        nome = g.get("name") or ""
        if filtro and filtro not in nome.lower():
            continue
        aviso = "avisos de comunidade" if g.get("isGroupAnnouncement") else ""
        print(f"{g.get('phone') or g.get('id')} | {nome} | {aviso}")


if __name__ == "__main__":
    main()
