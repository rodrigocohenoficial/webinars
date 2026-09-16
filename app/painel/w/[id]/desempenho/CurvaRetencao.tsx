"use client";

import { formatMinutoSegundo } from "@/lib/time";
import type { PontoCurva } from "@/lib/metricas";
import { useState } from "react";

export default function CurvaRetencao({
  pontos,
  ctaAtSec,
  duracaoSec,
}: {
  pontos: PontoCurva[];
  ctaAtSec: number | null;
  duracaoSec: number;
}) {
  const [emFoco, setEmFoco] = useState<number | null>(null);

  if (pontos.length === 0) {
    return <p className="text-[14px] text-[var(--texto-3)]">Sem duracao de video, nao ha curva.</p>;
  }

  const L = 100;
  const A = 34;
  const x = (i: number) => (i / (pontos.length - 1)) * L;
  const y = (p: number) => A - (p / 100) * A;

  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.percentual).toFixed(2)}`).join(" ");
  const area = `${linha} L${L},${A} L0,${A} Z`;
  const xOferta = ctaAtSec !== null && duracaoSec > 0 ? (ctaAtSec / duracaoSec) * L : null;
  const foco = emFoco !== null ? pontos[emFoco] : null;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${L} ${A}`} className="h-44 w-full" preserveAspectRatio="none">
          {[25, 50, 75].map((g) => (
            <line key={g} x1={0} x2={L} y1={y(g)} y2={y(g)} stroke="var(--borda)" strokeWidth={0.15} />
          ))}
          <path d={area} fill="var(--acento)" opacity={0.13} />
          <path d={linha} fill="none" stroke="var(--acento)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          {xOferta !== null ? (
            <line
              x1={xOferta}
              x2={xOferta}
              y1={0}
              y2={A}
              stroke="var(--alerta)"
              strokeWidth={0.5}
              strokeDasharray="1 1"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>

        {/* faixas invisiveis so para o ponteiro: o SVG e esticado e nao serve */}
        <div className="absolute inset-0 flex">
          {pontos.map((p, i) => (
            <button
              key={p.sec}
              type="button"
              className="h-full flex-1"
              onMouseEnter={() => setEmFoco(i)}
              onFocus={() => setEmFoco(i)}
              onMouseLeave={() => setEmFoco(null)}
              aria-label={`${formatMinutoSegundo(p.sec)}: ${Math.round(p.percentual)}%`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[12px] text-[var(--texto-3)]">
        <span>0:00</span>
        {foco ? (
          <span className="font-medium text-[var(--texto)]">
            {formatMinutoSegundo(foco.sec)} · {foco.quantos} pessoa{foco.quantos === 1 ? "" : "s"} ·{" "}
            {Math.round(foco.percentual)}%
          </span>
        ) : ctaAtSec !== null ? (
          <span className="text-[var(--alerta)]">
            oferta em {formatMinutoSegundo(ctaAtSec)}
          </span>
        ) : null}
        <span>{formatMinutoSegundo(duracaoSec)}</span>
      </div>
    </div>
  );
}
