"use client";

import { useEffect, useRef } from "react";

/** Batida a cada 30 segundos. O numero de "quem esta assistindo" usa o dobro
 *  disso mais uma folga (75s), entao 30 e o que sustenta aquele numero. */
export const INTERVALO_PRESENCA_MS = 30000;

export function usePresenca(token: string, posicaoAlvo: () => number, ativo: boolean) {
  const alvoRef = useRef(posicaoAlvo);
  alvoRef.current = posicaoAlvo;

  useEffect(() => {
    if (!ativo) return;

    const bater = () => {
      if (document.visibilityState !== "visible") return;
      const sec = Math.max(0, Math.floor(alvoRef.current()));
      void fetch(`/api/sala/${token}/presenca`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sec }),
        keepalive: true,
      }).catch(() => undefined);
    };

    bater();
    const t = setInterval(bater, INTERVALO_PRESENCA_MS);

    // Ao fechar a aba, um beacon manda a ultima posicao. fetch normal seria
    // cancelado com a pagina; sendBeacon sobrevive.
    const aoSair = () => {
      const sec = Math.max(0, Math.floor(alvoRef.current()));
      try {
        navigator.sendBeacon(`/api/sala/${token}/presenca`, JSON.stringify({ sec }));
      } catch {
        // navegador sem sendBeacon: a ultima batida ja valeu
      }
    };
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") aoSair();
    });

    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", aoSair);
    };
  }, [token, ativo]);
}
