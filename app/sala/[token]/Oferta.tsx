"use client";

import { useEffect, useRef, useState } from "react";

export type OfertaConfig = {
  label: string;
  url: string;
  descricao: string | null;
  atSec: number;
  untilSec: number | null;
};

/**
 * A oferta aparece no segundo configurado e some em outro. O clique e
 * gravado com data e com o ponto do video, e so o primeiro conta.
 */
export default function Oferta({
  token,
  config,
  posicaoAlvo,
}: {
  token: string;
  config: OfertaConfig;
  posicaoAlvo: () => number;
}) {
  const [, tique] = useState(0);
  const jaAvisou = useRef(false);

  useEffect(() => {
    const t = setInterval(() => tique((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const posicao = posicaoAlvo();
  const noAr = posicao >= config.atSec && (config.untilSec === null || posicao < config.untilSec);
  if (!noAr) return null;

  function registrar() {
    if (jaAvisou.current) return;
    jaAvisou.current = true;
    const sec = Math.max(0, Math.floor(posicaoAlvo()));
    void fetch(`/api/sala/${token}/oferta`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sec }),
      keepalive: true,
    }).catch(() => undefined);
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--acento)]/40 bg-[var(--acento-fraco)] p-4">
      {config.descricao ? (
        <p className="mb-3 text-[15px] leading-relaxed text-[var(--texto)]">{config.descricao}</p>
      ) : null}
      <a
        href={config.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={registrar}
        onAuxClick={registrar}
        className="botao w-full py-3 text-[16px]"
      >
        {config.label}
      </a>
    </div>
  );
}
