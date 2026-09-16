"use client";

import { useActionState, useEffect, useState } from "react";
import { reinscrever, type EstadoReinscricao } from "./acoes";

type Slot = { valor: string; label: string };

export default function ProximosHorarios({ token }: { token: string }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [estado, acao, enviando] = useActionState<EstadoReinscricao, FormData>(reinscrever, {});
  const [escolhido, setEscolhido] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/proximos/${token}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { slots?: Slot[] }) => {
        if (vivo) setSlots(d.slots ?? []);
      })
      .catch(() => {
        if (vivo) setSlots([]);
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  if (slots === null) return <p className="ajuda mt-5">Procurando os proximos horarios...</p>;
  if (slots.length === 0) return null;

  return (
    <div className="mt-6 border-t border-[var(--borda)] pt-5 text-left">
      <p className="rotulo text-center">Proximos horarios</p>
      <div className="grid gap-2">
        {slots.map((s) => (
          <form key={s.valor} action={acao}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="slot" value={s.valor} />
            <button
              type="submit"
              onClick={() => setEscolhido(s.valor)}
              disabled={enviando}
              className="botao-fantasma w-full justify-between text-left disabled:opacity-60"
            >
              <span>{s.label}</span>
              <span className="text-[var(--acento)]">
                {enviando && escolhido === s.valor ? "reservando..." : "reservar"}
              </span>
            </button>
          </form>
        ))}
      </div>
      {estado.erro ? <p className="mt-3 text-center text-[13px] text-[var(--erro)]">{estado.erro}</p> : null}
      <p className="ajuda mt-3 text-center">Um clique e a vaga e sua. Nao precisa preencher nada de novo.</p>
    </div>
  );
}
