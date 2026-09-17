"use client";

import { useActionState, useState } from "react";
import { formatMinutoSegundo } from "@/lib/time";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  adicionarComentario,
  colarEmLote,
  editarComentario,
  limparRoteiro,
  removerComentario,
  type EstadoLote,
  type EstadoRoteiro,
} from "./acoes";

export type ComentarioView = {
  id: string;
  authorName: string;
  body: string;
  videoTimeSec: number;
  kind: "FAKE" | "REAL" | "HOST";
};

function Linha({ c }: { c: ComentarioView }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, salvando] = useActionState<EstadoRoteiro, FormData>(editarComentario, {});
  const [autor, setAutor] = useState(c.authorName);
  const [corpo, setCorpo] = useState(c.body);
  const [tempo, setTempo] = useState(formatMinutoSegundo(c.videoTimeSec));

  if (editando) {
    return (
      <li className="py-3">
        <form action={acao} className="space-y-2">
          <input type="hidden" name="id" value={c.id} />
          <div className="flex gap-2">
            <input className="campo w-24" name="tempo" value={tempo} onChange={(e) => setTempo(e.target.value)} />
            <input className="campo" name="authorName" value={autor} onChange={(e) => setAutor(e.target.value)} />
          </div>
          <textarea
            className="campo resize-y"
            name="body"
            rows={2}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button type="submit" className="botao-fantasma !py-1.5 text-[13px]" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              className="text-[13px] text-[var(--texto-3)] hover:text-[var(--texto)]"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </button>
            {estado.erro ? <span className="text-[13px] text-[var(--erro)]">{estado.erro}</span> : null}
            {estado.ok ? <span className="text-[13px] text-[var(--acento)]">{estado.ok}</span> : null}
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex gap-3 py-2.5">
      <span className="w-14 shrink-0 pt-0.5 text-right font-mono text-[13px] tabular-nums text-[var(--texto-3)]">
        {formatMinutoSegundo(c.videoTimeSec)}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-medium text-[var(--texto)]">{c.authorName}</span>
        {c.kind === "HOST" ? (
          <span className="selo ml-2 bg-[var(--acento-fraco)] text-[var(--acento)]">voce</span>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--texto-2)]">
          {c.body}
        </p>
      </div>
      <div className="flex shrink-0 gap-3 text-[13px] opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          className="text-[var(--texto-3)] hover:text-[var(--texto)]"
          onClick={() => setEditando(true)}
        >
          Editar
        </button>
        <form action={removerComentario.bind(null, c.id)}>
          <button type="submit" className="text-[var(--texto-3)] hover:text-[var(--erro)]">
            Remover
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Duas etapas de proposito: apagar o roteiro inteiro nao pode ser um clique
 * distraido. E, armadilha 9.6, so diz que limpou depois que o servidor
 * confirmou.
 */
function BotaoLimpar({ webinarId }: { webinarId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [estado, setEstado] = useState<EstadoRoteiro>({});
  const [limpando, iniciar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-[13px] text-[var(--texto-3)] hover:text-[var(--erro)]"
      >
        Limpar roteiro
      </button>
    );
  }

  return (
    <span className="flex items-center gap-3 text-[13px]">
      <span className="text-[var(--texto-2)]">Apagar todos?</span>
      <button
        type="button"
        disabled={limpando}
        onClick={() =>
          iniciar(async () => {
            const r = await limparRoteiro(webinarId);
            setEstado(r);
            if (r.ok) {
              setConfirmando(false);
              router.refresh();
            }
          })
        }
        className="font-semibold text-[var(--erro)] disabled:opacity-50"
      >
        {limpando ? "apagando..." : "sim, apagar"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-[var(--texto-3)] hover:text-[var(--texto)]"
      >
        cancelar
      </button>
      {estado.erro ? <span className="text-[var(--erro)]">{estado.erro}</span> : null}
    </span>
  );
}

export default function Roteiro({
  webinarId,
  comentarios,
  duracaoSec,
}: {
  webinarId: string;
  comentarios: ComentarioView[];
  duracaoSec: number | null;
}) {
  const [estadoUm, acaoUm, gravandoUm] = useActionState<EstadoRoteiro, FormData>(adicionarComentario, {});
  const [estadoLote, acaoLote, gravandoLote] = useActionState<EstadoLote, FormData>(colarEmLote, {});

  const [autor, setAutor] = useState("");
  const [tempo, setTempo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [lote, setLote] = useState("");
  const [modo, setModo] = useState<"um" | "lote">("um");

  return (
    <div className="space-y-4">
      <section className="cartao space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="titulo-secao">Roteiro do chat</h2>
            <p className="ajuda">
              Cada comentario fica preso ao segundo do video, nunca a hora do relogio. E isso que o faz
              reaparecer no minuto exato em toda sessao.
            </p>
          </div>
          <div className="flex shrink-0 gap-1 rounded-lg border border-[var(--borda)] p-1">
            {(["um", "lote"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`rounded-md px-3 py-1.5 text-[13px] transition ${
                  modo === m ? "bg-[var(--fundo-2)] text-[var(--texto)]" : "text-[var(--texto-3)]"
                }`}
              >
                {m === "um" ? "Um a um" : "Colar em lote"}
              </button>
            ))}
          </div>
        </div>

        {modo === "um" ? (
          <form action={acaoUm} className="space-y-3">
            <input type="hidden" name="webinarId" value={webinarId} />
            <div className="flex gap-2">
              <input
                className="campo w-28"
                name="tempo"
                placeholder="12:30"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
              />
              <input
                className="campo"
                name="authorName"
                placeholder="Nome de quem comenta"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
              />
            </div>
            <textarea
              className="campo resize-y"
              name="body"
              rows={2}
              placeholder="O comentario"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <button type="submit" className="botao" disabled={gravandoUm}>
                {gravandoUm ? "Gravando..." : "Adicionar"}
              </button>
              {estadoUm.erro ? <span className="text-[13px] text-[var(--erro)]">{estadoUm.erro}</span> : null}
              {estadoUm.ok ? <span className="text-[13px] text-[var(--acento)]">{estadoUm.ok}</span> : null}
            </div>
          </form>
        ) : (
          <form action={acaoLote} className="space-y-3">
            <input type="hidden" name="webinarId" value={webinarId} />
            <textarea
              className="campo resize-y font-mono text-[13px]"
              name="lote"
              rows={8}
              placeholder={"Marcia Rocha | 0:45 | cheguei agora, deu tempo?\nPaulo H. | 2:10 | essa parte do risco eu nunca tinha ouvido assim"}
              value={lote}
              onChange={(e) => setLote(e.target.value)}
            />
            <p className="ajuda">
              Uma linha por comentario: <code>nome | tempo | comentario</code>. O tempo aceita 12:30,
              1:02:30 ou 750.
            </p>
            <div className="flex items-center gap-3">
              <button type="submit" className="botao" disabled={gravandoLote}>
                {gravandoLote ? "Lendo..." : "Gravar linhas"}
              </button>
              {estadoLote.erro ? (
                <span className="text-[13px] text-[var(--erro)]">{estadoLote.erro}</span>
              ) : null}
              {estadoLote.gravadas !== undefined ? (
                <span className="text-[13px] text-[var(--acento)]">
                  {estadoLote.gravadas} gravada{estadoLote.gravadas === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {estadoLote.ignoradas && estadoLote.ignoradas.length > 0 ? (
              <div className="rounded-lg border border-[var(--alerta)]/40 bg-[var(--alerta)]/5 p-3">
                <p className="text-[13px] font-medium text-[var(--alerta)]">
                  {estadoLote.ignoradas.length} linha{estadoLote.ignoradas.length === 1 ? "" : "s"} ficou de fora:
                </p>
                <ul className="mt-2 space-y-1.5">
                  {estadoLote.ignoradas.map((l) => (
                    <li key={l.numero} className="text-[13px] leading-relaxed text-[var(--texto-2)]">
                      <span className="font-mono text-[var(--texto-3)]">linha {l.numero}</span> — {l.motivo}
                      <br />
                      <span className="font-mono text-[12px] text-[var(--texto-3)]">{l.original}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>
        )}
      </section>

      <section className="cartao">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="titulo-secao">
            {comentarios.length} comentario{comentarios.length === 1 ? "" : "s"} no roteiro
          </h2>
          <div className="flex items-center gap-4">
            {duracaoSec ? (
              <span className="ajuda">video de {formatMinutoSegundo(duracaoSec)}</span>
            ) : (
              <span className="text-[12px] text-[var(--alerta)]">sem video definido</span>
            )}
            {comentarios.length > 0 ? <BotaoLimpar webinarId={webinarId} /> : null}
          </div>
        </div>
        {comentarios.length === 0 ? (
          <p className="text-[14px] text-[var(--texto-3)]">
            Nada ainda. O primeiro comentario e o que faz a sala nao parecer vazia.
          </p>
        ) : (
          <ul id="lista-roteiro" className="divide-y divide-[var(--borda)]">
            {comentarios.map((c) => (
              <Linha key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
