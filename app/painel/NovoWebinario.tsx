"use client";

import { useActionState, useState } from "react";
import { criarWebinar, type EstadoForm } from "./acoes";

export default function NovoWebinario() {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(criarWebinar, {});

  if (!aberto) {
    return (
      <button type="button" className="botao shrink-0" onClick={() => setAberto(true)}>
        Novo webinario
      </button>
    );
  }

  return (
    <form action={acao} className="cartao w-full max-w-sm shrink-0 space-y-3">
      <div>
        <label className="rotulo" htmlFor="novo-title">
          Titulo
        </label>
        <input id="novo-title" name="title" className="campo" autoFocus placeholder="Aula ao vivo: ..." />
      </div>
      {estado.erro ? <p className="text-[13px] text-[var(--erro)]">{estado.erro}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className="botao" disabled={pendente}>
          {pendente ? "Criando..." : "Criar"}
        </button>
        <button type="button" className="botao-fantasma" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
