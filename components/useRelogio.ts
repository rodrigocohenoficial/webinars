"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Regra 5.2: o relogio do servidor manda.
 *
 * Corrige o relogio do visitante contra o servidor na entrada e toda vez que
 * ele volta para a aba — notebook que dormiu volta com o relogio parado, e
 * maquina adiantada veria o video dessincronizado do chat.
 */
export function useRelogio(agoraInicialMs: number) {
  const desvioRef = useRef(agoraInicialMs - Date.now());
  const [pronto, setPronto] = useState(false);
  const [, forcar] = useState(0);

  const sincronizar = useCallback(async () => {
    const antes = Date.now();
    try {
      const res = await fetch("/api/agora", { cache: "no-store" });
      if (!res.ok) return;
      const { agora } = (await res.json()) as { agora: number };
      const depois = Date.now();
      // metade da ida e volta e a estimativa de quando o servidor respondeu
      desvioRef.current = agora + (depois - antes) / 2 - depois;
      setPronto(true);
      forcar((n) => n + 1);
    } catch {
      // sem rede, seguimos com o desvio que ja tinhamos
    }
  }, []);

  const agora = useCallback(() => Date.now() + desvioRef.current, []);

  useEffect(() => {
    void sincronizar();

    const aoVoltar = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    const periodico = setInterval(() => void sincronizar(), 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      clearInterval(periodico);
    };
  }, [sincronizar]);

  return { agora, sincronizar, pronto };
}

/** Um contador que re-renderiza a cada intervalo, para telas que contam tempo. */
export function useTique(intervaloMs = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
}
