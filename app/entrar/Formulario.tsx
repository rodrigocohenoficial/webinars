"use client";

import { useActionState } from "react";
import { entrar, type EstadoEntrar } from "./acoes";

const inicial: EstadoEntrar = {};

export default function Formulario({ aviso }: { aviso?: string | null }) {
  const [estado, acao, pendente] = useActionState(entrar, inicial);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form action={acao} className="cartao w-full max-w-sm">
        <h1 className="text-lg font-semibold">Painel</h1>
        <p className="ajuda mb-5">Um administrador, uma senha.</p>

        {aviso ? (
          <div className="mb-5 rounded-lg border border-[var(--alerta)]/40 bg-[var(--alerta)]/10 p-3">
            <p className="text-[13px] leading-relaxed text-[var(--alerta)]">{aviso}</p>
            <a
              href="/api/saude"
              className="ajuda mt-1.5 inline-block underline hover:text-[var(--texto)]"
            >
              ver o diagnostico completo
            </a>
          </div>
        ) : null}

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
