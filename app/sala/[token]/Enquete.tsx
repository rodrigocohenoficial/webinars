"use client";

import { useState } from "react";

export type EnqueteAtiva = {
  id: string;
  pergunta: string;
  total: number;
  meuVoto: string | null;
  opcoes: { id: string; label: string; votos: number }[];
};

/**
 * A enquete ativa fica fixada no alto do chat, fora da esteira de
 * comentarios — senao ela sobe junto com a conversa e some.
 */
export default function Enquete({
  token,
  enquete,
  aoVotar,
}: {
  token: string;
  enquete: EnqueteAtiva;
  aoVotar: (optionId: string) => void;
}) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const jaVotou = enquete.meuVoto !== null;

  async function votar(optionId: string) {
    if (enviando) return;
    setEnviando(optionId);
    try {
      const r = await fetch(`/api/sala/${token}/voto`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pollId: enquete.id, optionId }),
      });
      // Armadilha 9.6: so marcamos como votado depois do servidor confirmar.
      if (r.ok) aoVotar(optionId);
    } catch {
      // a proxima consulta traz o estado real
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="border-b border-[var(--borda)] bg-[var(--fundo-2)] px-4 py-3">
      <p className="text-[14px] font-medium leading-snug">{enquete.pergunta}</p>

      <ul className="mt-2.5 space-y-1.5">
        {enquete.opcoes.map((o) => {
          const pct = enquete.total === 0 ? 0 : (o.votos / enquete.total) * 100;
          const minha = enquete.meuVoto === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => votar(o.id)}
                disabled={enviando !== null}
                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-[13px] transition ${
                  minha
                    ? "border-[var(--acento)] text-[var(--texto)]"
                    : "border-[var(--borda)] text-[var(--texto-2)] hover:border-[var(--texto-3)]"
                }`}
              >
                {jaVotou ? (
                  <span
                    className="absolute inset-y-0 left-0 bg-[var(--acento)]/15"
                    style={{ width: `${pct}%` }}
                  />
                ) : null}
                <span className="relative flex items-center justify-between gap-2">
                  <span>{o.label}</span>
                  {jaVotou ? (
                    <span className="tabular-nums text-[12px] text-[var(--texto-3)]">
                      {pct.toFixed(0)}%
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="ajuda mt-2">
        {jaVotou
          ? `${enquete.total} ${enquete.total === 1 ? "voto" : "votos"} · pode trocar`
          : "Escolha uma"}
      </p>
    </div>
  );
}
