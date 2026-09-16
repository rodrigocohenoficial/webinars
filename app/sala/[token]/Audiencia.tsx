"use client";

import { useEffect, useState } from "react";
import { formatMinutoSegundo } from "@/lib/time";

type Pessoa = {
  id: string;
  nome: string;
  email: string;
  assistindo: boolean;
  veio: boolean;
  sec: number;
  clicou: boolean;
};

/**
 * O painel do apresentador dentro da propria sala. Nao e interface paralela:
 * e uma faixa a mais na mesma tela que o participante ve.
 */
export default function Audiencia({ token }: { token: string }) {
  const [dados, setDados] = useState<{ assistindo: number; inscritos: number; pessoas: Pessoa[] } | null>(
    null,
  );
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const buscar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/sala/${token}/audiencia`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (vivo) setDados(d);
      } catch {
        // uma leitura perdida nao muda nada: a proxima vem em 15 segundos
      }
    };
    void buscar();
    const t = setInterval(buscar, 15000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [token]);

  return (
    <div className="mb-3 rounded-xl border border-[var(--acento)]/35 bg-[var(--acento-fraco)]/40">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[14px]">
          <strong className="text-[var(--acento)]">{dados?.assistindo ?? "—"}</strong>{" "}
          assistindo agora{" "}
          <span className="ajuda ml-2">de {dados?.inscritos ?? "—"} inscritos nesta sessao</span>
        </span>
        <span className="text-[13px] text-[var(--texto-3)]">{aberto ? "fechar" : "ver quem"}</span>
      </button>

      {aberto ? (
        <ul
          id="lista-audiencia"
          className="rolagem-fina max-h-56 divide-y divide-[var(--borda)] overflow-y-auto border-t border-[var(--borda)]"
        >
          {(dados?.pessoas ?? []).length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-[var(--texto-3)]">Ninguem aqui ainda.</li>
          ) : (
            (dados?.pessoas ?? []).map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 px-4 py-2">
                <span className="min-w-0 truncate text-[13px]">
                  {p.assistindo ? (
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--acento)]" />
                  ) : null}
                  {p.nome}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--texto-3)]">
                  {p.veio ? formatMinutoSegundo(p.sec) : "nao veio"}
                  {p.clicou ? <span className="ml-2 text-[var(--alerta)]">clicou</span> : null}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
