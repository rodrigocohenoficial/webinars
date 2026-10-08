"use client";

import type { ApoioDaSala } from "@/lib/apoio";

/**
 * Contato do time e material da aula, fixos na sala. O contato aparece
 * sempre: quem trava no meio da aula precisa de alguem na hora, nao depois.
 * O material pode esperar o minuto em que e ensinado, para nao roubar a
 * atencao do video antes da hora. Sem posicaoAlvo (antes de comecar), so
 * aparece o material marcado para "sempre".
 */
export default function Apoio({
  apoio,
  posicaoAlvo,
  sempre = false,
}: {
  apoio: ApoioDaSala;
  posicaoAlvo?: () => number;
  /** encerramento: o material ja foi ensinado, aparece de qualquer jeito */
  sempre?: boolean;
}) {
  const m = apoio.material;
  const materialNoAr =
    m !== null &&
    (sempre || m.atSec === null || (posicaoAlvo ? posicaoAlvo() >= m.atSec : false));

  if (!materialNoAr && !apoio.suporte) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {materialNoAr && m ? (
        <a
          href={m.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="botao-fantasma flex w-full items-center justify-center gap-2 py-2.5"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          {m.label}
        </a>
      ) : null}
      {apoio.suporte ? (
        <a
          href={apoio.suporte.link}
          target="_blank"
          rel="noopener noreferrer"
          title={apoio.suporte.numero}
          className={`botao-fantasma flex w-full items-center justify-center gap-2 py-2.5 ${materialNoAr ? "" : "sm:col-span-2"}`}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#25D366]" fill="currentColor">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.12c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.27-.68-2.76-1.09-4.5-3.92-4.64-4.1-.13-.18-1.1-1.47-1.1-2.8 0-1.33.7-1.99.95-2.26.24-.27.53-.34.71-.34l.51.01c.16.01.38-.06.6.46.23.54.77 1.87.84 2 .07.14.11.3.02.48-.09.18-.13.29-.27.45-.13.16-.28.35-.4.47-.13.13-.27.28-.12.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.58-.07.16-.18.67-.78.85-1.05.18-.27.36-.22.6-.13.25.09 1.57.74 1.84.88.27.13.45.2.51.31.07.11.07.65-.17 1.32Z" />
          </svg>
          Falar com {apoio.suporte.nome} no WhatsApp
        </a>
      ) : null}
    </div>
  );
}
