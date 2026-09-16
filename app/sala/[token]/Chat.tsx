"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Mensagem = {
  id: string;
  autor: string;
  texto: string;
  sec: number;
  kind: "FAKE" | "REAL" | "HOST";
};

/**
 * O feed e a uniao de tres fontes, deduplicada por id:
 *
 *  1. a trilha do replay — todos os comentarios aprovados do webinario,
 *     baixada inteira com a pagina e revelada conforme o video avanca.
 *     E deterministica, entao nao precisa de consulta nenhuma.
 *  2. os comentarios desta sessao (etapa 6);
 *  3. o que a propria pessoa acabou de escrever (etapa 6).
 */
export function unir(...fontes: Mensagem[][]): Mensagem[] {
  const porId = new Map<string, Mensagem>();
  for (const fonte of fontes) for (const m of fonte) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => a.sec - b.sec || a.id.localeCompare(b.id));
}

function Bolha({ m }: { m: Mensagem }) {
  return (
    <li className="px-4 py-2">
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[13px] font-semibold ${
            m.kind === "HOST" ? "text-[var(--acento)]" : "text-[var(--texto)]"
          }`}
        >
          {m.autor}
        </span>
        {m.kind === "HOST" ? (
          <span className="selo bg-[var(--acento-fraco)] px-1.5 py-0.5 text-[10px] text-[var(--acento)]">
            apresentador
          </span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--texto-2)]">
        {m.texto}
      </p>
    </li>
  );
}

export default function Chat({
  trilha,
  extras = [],
  posicaoAlvo,
  rodape,
}: {
  trilha: Mensagem[];
  extras?: Mensagem[];
  posicaoAlvo: () => number;
  rodape?: React.ReactNode;
}) {
  const [, tique] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tique((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const todas = useMemo(() => unir(trilha, extras), [trilha, extras]);
  const posicao = posicaoAlvo();
  const visiveis = useMemo(() => todas.filter((m) => m.sec <= posicao), [todas, posicao]);

  const esteiraRef = useRef<HTMLUListElement | null>(null);
  const coladoRef = useRef(true);

  useEffect(() => {
    const el = esteiraRef.current;
    if (!el || !coladoRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [visiveis.length]);

  function aoRolar() {
    const el = esteiraRef.current;
    if (!el) return;
    // so cola de volta quando a pessoa volta ao fim por vontade propria
    coladoRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
      <div className="border-b border-[var(--borda)] px-4 py-3">
        <h2 className="titulo-secao">Conversa</h2>
      </div>

      <ul
        ref={esteiraRef}
        onScroll={aoRolar}
        className="rolagem-fina min-h-0 flex-1 divide-y divide-[var(--borda)]/60 overflow-y-auto"
      >
        {visiveis.length === 0 ? (
          <li className="px-4 py-6 text-center text-[13px] text-[var(--texto-3)]">
            A conversa comeca em instantes.
          </li>
        ) : (
          visiveis.map((m) => <Bolha key={m.id} m={m} />)
        )}
      </ul>

      {rodape ? <div className="border-t border-[var(--borda)] p-3">{rodape}</div> : null}
    </aside>
  );
}
