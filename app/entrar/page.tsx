"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "./acoes";

const inicial: EstadoEntrar = {};

export default function Entrar() {
  const [estado, acao, pendente] = useActionState(entrar, inicial);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form action={acao} className="cartao w-full max-w-sm">
        <h1 className="text-lg font-semibold">Painel</h1>
        <p className="ajuda mb-5">Um administrador, uma senha.</p>

        <label className="rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="campo"
        />

        {estado.erro ? (
          <p className="mt-3 text-[13px] text-[var(--erro)]">{estado.erro}</p>
        ) : null}

        <button type="submit" className="botao mt-5 w-full" disabled={pendente}>
          {pendente ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
