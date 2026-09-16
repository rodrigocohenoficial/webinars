"use client";

import { useActionState, useState } from "react";
import { adicionarRegra, alternarRegra, removerRegra, type EstadoForm } from "../../acoes";

const DIAS = [
  { n: 0, nome: "dom" },
  { n: 1, nome: "seg" },
  { n: 2, nome: "ter" },
  { n: 3, nome: "qua" },
  { n: 4, nome: "qui" },
  { n: 5, nome: "sex" },
  { n: 6, nome: "sab" },
];

export type RegraView = {
  id: string;
  daysOfWeek: number[];
  timeOfDay: string;
  active: boolean;
};

export default function Grade({
  webinarId,
  regras,
  proximos,
}: {
  webinarId: string;
  regras: RegraView[];
  proximos: string[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(adicionarRegra, {});
  const [hora, setHora] = useState("20:00");
  const [dias, setDias] = useState<number[]>([2, 4]);

  function alternarDia(n: number) {
    setDias((atual) => (atual.includes(n) ? atual.filter((d) => d !== n) : [...atual, n].sort()));
  }

  return (
    <section className="cartao space-y-5">
      <div>
        <h2 className="titulo-secao">Grade de horarios</h2>
        <p className="ajuda">
          As regras geram horarios, nao sessoes. Nada e gravado no banco ate alguem se inscrever.
        </p>
      </div>

      {regras.length > 0 ? (
        <ul className="divide-y divide-[var(--borda)]">
          {regras.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className={r.active ? "" : "opacity-45"}>
                <span className="font-medium">{r.timeOfDay}</span>
                <span className="ml-2 text-[13px] text-[var(--texto-2)]">
                  {r.daysOfWeek.map((d) => DIAS[d]?.nome).join(", ")}
                </span>
                {!r.active ? <span className="ml-2 text-[12px] text-[var(--texto-3)]">(desligada)</span> : null}
              </div>
              <div className="flex shrink-0 gap-3 text-[13px]">
                <form action={alternarRegra.bind(null, r.id)}>
                  <button type="submit" className="text-[var(--texto-3)] hover:text-[var(--texto)]">
                    {r.active ? "Desligar" : "Ligar"}
                  </button>
                </form>
                <form action={removerRegra.bind(null, r.id)}>
                  <button type="submit" className="text-[var(--texto-3)] hover:text-[var(--erro)]">
                    Remover
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--texto-3)]">Nenhuma regra ainda.</p>
      )}

      <form action={acao} className="space-y-3 border-t border-[var(--borda)] pt-4">
        <input type="hidden" name="webinarId" value={webinarId} />
        {dias.map((d) => (
          <input key={d} type="hidden" name="dias" value={d} />
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="rotulo" htmlFor="timeOfDay">Horario</label>
            <input
              id="timeOfDay"
              name="timeOfDay"
              className="campo w-28"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              placeholder="20:00"
            />
          </div>
          <div>
            <span className="rotulo">Dias</span>
            <div className="flex gap-1.5">
              {DIAS.map((d) => (
                <button
                  key={d.n}
                  type="button"
                  onClick={() => alternarDia(d.n)}
                  className={`h-10 w-11 rounded-lg border text-[13px] transition ${
                    dias.includes(d.n)
                      ? "border-[var(--acento)] bg-[var(--acento-fraco)] text-[var(--acento)]"
                      : "border-[var(--borda)] text-[var(--texto-3)] hover:text-[var(--texto)]"
                  }`}
                >
                  {d.nome}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="botao-fantasma" disabled={enviando}>
            {enviando ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
        {estado.erro ? <p className="text-[13px] text-[var(--erro)]">{estado.erro}</p> : null}
      </form>

      {proximos.length > 0 ? (
        <div className="border-t border-[var(--borda)] pt-4">
          <p className="titulo-secao mb-2">Proximos horarios calculados agora</p>
          <p className="text-[13px] text-[var(--texto-2)]">{proximos.join("  ·  ")}</p>
        </div>
      ) : null}
    </section>
  );
}
