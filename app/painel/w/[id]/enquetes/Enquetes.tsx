"use client";

import { useActionState, useState } from "react";
import { formatMinutoSegundo } from "@/lib/time";
import { criarEnquete, removerEnquete, type EstadoEnquete } from "./acoes";

export type EnqueteView = {
  id: string;
  question: string;
  atSec: number;
  untilSec: number | null;
  opcoes: { id: string; label: string; votos: number }[];
  total: number;
};

export default function Enquetes({
  webinarId,
  enquetes,
}: {
  webinarId: string;
  enquetes: EnqueteView[];
}) {
  const [estado, acao, gravando] = useActionState<EstadoEnquete, FormData>(criarEnquete, {});

  // Armadilha 9.7: campos controlados. Digitar uma enquete inteira e perder
  // tudo por causa de um minuto mal formatado e inaceitavel.
  const [question, setQuestion] = useState("");
  const [opcoes, setOpcoes] = useState("");
  const [atSec, setAtSec] = useState("");
  const [untilSec, setUntilSec] = useState("");

  return (
    <div className="space-y-4">
      <section className="cartao space-y-4">
        <div>
          <h2 className="titulo-secao">Nova enquete</h2>
          <p className="ajuda">
            Entra no minuto que voce marcar e fica fixada no alto do chat, fora da esteira de
            comentarios.
          </p>
        </div>

        <form action={acao} className="space-y-3">
          <input type="hidden" name="webinarId" value={webinarId} />
          <div>
            <label className="rotulo" htmlFor="question">Pergunta</label>
            <input
              id="question"
              name="question"
              className="campo"
              placeholder="Voce ja opera com robo hoje?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="opcoes">Opcoes, uma por linha</label>
            <textarea
              id="opcoes"
              name="opcoes"
              rows={4}
              className="campo resize-y"
              placeholder={"Ja opero\nEstou testando\nNunca operei"}
              value={opcoes}
              onChange={(e) => setOpcoes(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="atSec">Entra em</label>
              <input
                id="atSec"
                name="atSec"
                className="campo"
                placeholder="8:00"
                value={atSec}
                onChange={(e) => setAtSec(e.target.value)}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="untilSec">Sai em</label>
              <input
                id="untilSec"
                name="untilSec"
                className="campo"
                placeholder="deixe vazio para ficar ate o fim"
                value={untilSec}
                onChange={(e) => setUntilSec(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="botao" disabled={gravando}>
              {gravando ? "Gravando..." : "Criar enquete"}
            </button>
            {estado.erro ? <span className="text-[13px] text-[var(--erro)]">{estado.erro}</span> : null}
            {estado.ok ? <span className="text-[13px] text-[var(--acento)]">{estado.ok}</span> : null}
          </div>
        </form>
      </section>

      <section className="cartao">
        <h2 className="titulo-secao mb-3">
          {enquetes.length} enquete{enquetes.length === 1 ? "" : "s"}
        </h2>
        {enquetes.length === 0 ? (
          <p className="text-[14px] text-[var(--texto-3)]">Nenhuma ainda.</p>
        ) : (
          <ul id="lista-enquetes" className="divide-y divide-[var(--borda)]">
            {enquetes.map((e) => (
              <li key={e.id} className="py-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-medium">{e.question}</p>
                    <p className="ajuda">
                      {formatMinutoSegundo(e.atSec)}
                      {e.untilSec !== null ? ` ate ${formatMinutoSegundo(e.untilSec)}` : " ate o fim"}
                      {" · "}
                      {e.total} voto{e.total === 1 ? "" : "s"}
                    </p>
                  </div>
                  <form action={removerEnquete.bind(null, e.id)}>
                    <button type="submit" className="text-[13px] text-[var(--texto-3)] hover:text-[var(--erro)]">
                      Remover
                    </button>
                  </form>
                </div>

                <ul className="space-y-1.5">
                  {e.opcoes.map((o) => {
                    const pct = e.total === 0 ? 0 : (o.votos / e.total) * 100;
                    return (
                      <li key={o.id}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="text-[var(--texto-2)]">{o.label}</span>
                          <span className="tabular-nums text-[var(--texto-3)]">
                            {o.votos} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--fundo-2)]">
                          <div
                            className="h-full rounded-full bg-[var(--acento)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
