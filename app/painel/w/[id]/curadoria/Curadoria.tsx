"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatMinutoSegundo } from "@/lib/time";
import { mudarStatus, removerComentarios, type EstadoCuradoria } from "./acoes";

export type ItemCuradoria = {
  id: string;
  autor: string;
  texto: string;
  sec: number;
  quando: string;
  sessao: string | null;
};

export type Aba = "aguardando" | "replay" | "ocultos";

const ABAS: { chave: Aba; nome: string }[] = [
  { chave: "aguardando", nome: "Aguardando" },
  { chave: "replay", nome: "No replay" },
  { chave: "ocultos", nome: "Ocultos" },
];

export default function Curadoria({
  webinarId,
  aba,
  itens,
  contagens,
}: {
  webinarId: string;
  aba: Aba;
  itens: ItemCuradoria[];
  contagens: Record<Aba, number>;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [estado, setEstado] = useState<EstadoCuradoria>({});
  const [processando, iniciar] = useTransition();

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function todos() {
    setMarcados((atual) => (atual.size === itens.length ? new Set() : new Set(itens.map((i) => i.id))));
  }

  /**
   * Armadilha 9.6: confirmacao otimista mente. O botao so muda depois que o
   * servidor confirmou — aconteceu com o botao de liberar comentario, o
   * apresentador via "✓ liberado" e o comentario continuava pendente.
   */
  function aplicar(acao: () => Promise<EstadoCuradoria>) {
    setEstado({});
    iniciar(async () => {
      const r = await acao();
      setEstado(r);
      if (r.ok) {
        setMarcados(new Set());
        router.refresh();
      }
    });
  }

  const ids = [...marcados];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ABAS.map((a) => (
          <Link
            key={a.chave}
            href={`/painel/w/${webinarId}/curadoria?aba=${a.chave}`}
            className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
              aba === a.chave
                ? "border-[var(--acento)] bg-[var(--acento-fraco)] text-[var(--acento)]"
                : "border-[var(--borda)] text-[var(--texto-3)] hover:text-[var(--texto)]"
            }`}
          >
            {a.nome}
            <span className="ml-1.5 tabular-nums opacity-70">{contagens[a.chave]}</span>
          </Link>
        ))}
      </div>

      <section className="cartao">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={todos}
            className="text-[13px] text-[var(--texto-3)] hover:text-[var(--texto)]"
            disabled={itens.length === 0}
          >
            {marcados.size === itens.length && itens.length > 0 ? "Desmarcar todos" : "Marcar todos"}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {aba !== "replay" ? (
              <button
                type="button"
                className="botao !py-1.5 text-[13px]"
                disabled={processando || ids.length === 0}
                onClick={() => aplicar(() => mudarStatus(webinarId, "APPROVED", ids))}
              >
                {processando ? "Liberando..." : `Liberar${ids.length ? ` (${ids.length})` : ""}`}
              </button>
            ) : null}
            {aba !== "ocultos" ? (
              <button
                type="button"
                className="botao-fantasma !py-1.5 text-[13px]"
                disabled={processando || ids.length === 0}
                onClick={() => aplicar(() => mudarStatus(webinarId, "HIDDEN", ids))}
              >
                Ocultar
              </button>
            ) : null}
            {aba !== "aguardando" ? (
              <button
                type="button"
                className="botao-fantasma !py-1.5 text-[13px]"
                disabled={processando || ids.length === 0}
                onClick={() => aplicar(() => mudarStatus(webinarId, "PENDING", ids))}
              >
                Devolver para a fila
              </button>
            ) : null}
            <button
              type="button"
              className="botao-fantasma !py-1.5 text-[13px] hover:!border-[var(--erro)] hover:!text-[var(--erro)]"
              disabled={processando || ids.length === 0}
              onClick={() => aplicar(() => removerComentarios(webinarId, ids))}
            >
              Remover
            </button>
          </div>
        </div>

        {estado.erro ? <p className="mb-3 text-[13px] text-[var(--erro)]">{estado.erro}</p> : null}
        {estado.ok ? <p className="mb-3 text-[13px] text-[var(--acento)]">{estado.ok}</p> : null}

        {itens.length === 0 ? (
          <p className="text-[14px] text-[var(--texto-3)]">
            {aba === "aguardando"
              ? "Nada na fila. Comentario de participante cai aqui assim que alguem escreve."
              : "Nada aqui."}
          </p>
        ) : (
          <ul id="lista-curadoria" className="divide-y divide-[var(--borda)]">
            {itens.map((i) => (
              <li key={i.id} className="flex gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={marcados.has(i.id)}
                  onChange={() => alternar(i.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--acento)]"
                />
                <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-[13px] tabular-nums text-[var(--texto-3)]">
                  {formatMinutoSegundo(i.sec)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-medium">{i.autor}</span>
                  <span className="ajuda ml-2">{i.quando}</span>
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--texto-2)]">
                    {i.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="ajuda">
        Liberar e aprovar: o comentario aparece para a sala e entra no replay das proximas sessoes,
        no mesmo minuto em que foi escrito.
      </p>
    </div>
  );
}
