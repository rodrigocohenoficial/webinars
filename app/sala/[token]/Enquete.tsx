"use client";

import { useState } from "react";

export type EnqueteAtiva = {
  id: string;
  pergunta: string;
  meuVoto: string | null;
  opcoes: { id: string; label: string }[];
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
  const [recemVotou, setRecemVotou] = useState(false);
  const [escondida, setEscondida] = useState(false);
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
      if (r.ok) {
        aoVotar(optionId);
        setRecemVotou(true);
        // Um instante para a pessoa ver que foi anotado, e sai da frente.
        setTimeout(() => setEscondida(true), 2200);
      }
    } catch {
      // a proxima consulta traz o estado real
    } finally {
      setEnviando(null);
    }
  }

  // Quem ja votou nao ve mais a enquete: ela cumpriu o papel e some. Se a
  // pessoa recarregar a pagina depois de votar, o voto ja vem marcado do
  // servidor e ela nem chega a aparecer.
  if (escondida || (jaVotou && !recemVotou)) return null;

  return (
    <div className="border-b border-[var(--borda)] bg-[var(--fundo-2)] px-4 py-3">
      <p className="text-[14px] font-medium leading-snug">{enquete.pergunta}</p>

      <ul className="mt-2.5 space-y-1.5">
        {enquete.opcoes.map((o) => {
          const minha = enquete.meuVoto === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => votar(o.id)}
                disabled={enviando !== null || jaVotou}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition ${
                  minha
                    ? "border-[var(--acento)] bg-[var(--acento-fraco)] text-[var(--texto)]"
                    : "border-[var(--borda)] text-[var(--texto-2)] hover:border-[var(--texto-3)]"
                }`}
              >
                <span>{o.label}</span>
                {minha ? (
                  <span className="shrink-0 text-[12px] font-medium text-[var(--acento)]">
                    sua resposta
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="ajuda mt-2">{jaVotou ? "Anotado, obrigado." : "Escolha uma"}</p>
    </div>
  );
}
