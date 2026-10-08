"use client";

import { useEffect, useRef } from "react";

/**
 * A presenca durante a sessao viaja na consulta do chat (a cada 10s, com o
 * segundo do video). Aqui fica so a ultima batida: ao fechar ou esconder a
 * aba, um beacon manda a posicao final. fetch normal seria cancelado com a
 * pagina; sendBeacon sobrevive.
 */
export function usePresenca(token: string, posicaoAlvo: () => number, ativo: boolean) {
  const alvoRef = useRef(posicaoAlvo);
  alvoRef.current = posicaoAlvo;

  useEffect(() => {
    if (!ativo) return;

    const aoSair = () => {
      const sec = Math.max(0, Math.floor(alvoRef.current()));
      try {
        navigator.sendBeacon(`/api/sala/${token}/presenca`, JSON.stringify({ sec }));
      } catch {
        // navegador sem sendBeacon: a ultima consulta do chat ja valeu
      }
    };
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") aoSair();
    };
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", aoEsconder);

    return () => {
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("visibilitychange", aoEsconder);
    };
  }, [token, ativo]);
}
