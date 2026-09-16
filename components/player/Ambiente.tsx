"use client";

import { useEffect, useRef } from "react";
import type { Adaptador, PlayerRef } from "./tipos";
import { criarYoutube } from "./youtube";
import { criarVimeo } from "./vimeo";

/**
 * Armadilha 9.5: video de fundo precisa ser recortado.
 *
 * Iframe nao obedece object-fit: cover. Entao medimos a caixa e damos ao
 * player o tamanho que cobre, centralizado. E passamos alem: e nas bordas
 * que ficam a marca do provedor, no alto, e a legenda queimada, embaixo.
 */
const EXCESSO = 1.18;

export default function Ambiente({
  video,
  aspectRatio,
  className = "",
}: {
  video: PlayerRef;
  aspectRatio: string;
  className?: string;
}) {
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const molduraRef = useRef<HTMLDivElement | null>(null);
  const adaptadorRef = useRef<Adaptador | null>(null);

  useEffect(() => {
    const caixa = caixaRef.current;
    const moldura = molduraRef.current;
    if (!caixa || !moldura) return;

    let vivo = true;
    const proporcao = aspectRatio === "9/16" ? 9 / 16 : 16 / 9;

    function redimensionar() {
      const c = caixaRef.current;
      const m = molduraRef.current;
      if (!c || !m) return;
      const { width: W, height: H } = c.getBoundingClientRect();
      if (!W || !H) return;

      let w: number;
      let h: number;
      if (W / H > proporcao) {
        w = W;
        h = W / proporcao;
      } else {
        h = H;
        w = H * proporcao;
      }
      m.style.width = `${w * EXCESSO}px`;
      m.style.height = `${h * EXCESSO}px`;
    }

    redimensionar();
    const observador = new ResizeObserver(redimensionar);
    observador.observe(caixa);

    const alvo = document.createElement("div");
    alvo.style.width = "100%";
    alvo.style.height = "100%";
    moldura.appendChild(alvo);

    (async () => {
      const opcoes = {
        elemento: alvo,
        ref: video,
        inicioSec: 0,
        legendas: false,
        aoComecarATocar: () => undefined,
        // laco: o video de ambiente nunca termina
        aoTerminar: () => {
          const a = adaptadorRef.current;
          if (!a) return;
          a.posicionar(0);
          void a.tocar().catch(() => undefined);
        },
      };

      try {
        const adaptador =
          video.provider === "youtube" ? await criarYoutube(opcoes) : await criarVimeo(opcoes);
        if (!vivo) {
          adaptador.destruir();
          return;
        }
        adaptadorRef.current = adaptador;
        // Mudo sempre: e ambiente, nao conteudo. E mudo o navegador deixa tocar.
        adaptador.definirMudo(true);
        await adaptador.tocar().catch(() => undefined);
      } catch {
        // sem video de ambiente a sala de espera continua funcionando
      }
    })();

    return () => {
      vivo = false;
      observador.disconnect();
      adaptadorRef.current?.destruir();
      adaptadorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={caixaRef} className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        ref={molduraRef}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&_iframe]:h-full [&_iframe]:w-full"
      />
    </div>
  );
}
