"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Enquete, { type EnqueteAtiva } from "./Enquete";

export type Mensagem = {
  id: string;
  autor: string;
  texto: string;
  sec: number;
  kind: "FAKE" | "REAL" | "HOST";
  minha?: boolean;
  aguardando?: boolean;
  enviando?: boolean;
  falhou?: boolean;
};

/** De quanto em quanto tempo a sala pergunta o que ha de novo nesta sessao. */
const INTERVALO_CONSULTA_MS = 6000;

/**
 * O feed e a uniao de tres fontes, deduplicada por id:
 *
 *  1. a trilha do replay — todos os comentarios aprovados do webinario,
 *     baixada inteira com a pagina e revelada conforme o video avanca.
 *     E deterministica, entao nao precisa de consulta nenhuma;
 *  2. os comentarios desta sessao, buscados na consulta periodica;
 *  3. o que a propria pessoa acabou de escrever, mostrado antes da
 *     confirmacao chegar.
 */
export function unir(...fontes: Mensagem[][]): Mensagem[] {
  const porId = new Map<string, Mensagem>();
  for (const fonte of fontes) for (const m of fonte) porId.set(m.id, m);
  return [...porId.values()].sort((a, b) => a.sec - b.sec || a.id.localeCompare(b.id));
}

function Bolha({
  m,
  ehApresentador,
  emAcao,
  aoDecidir,
}: {
  m: Mensagem;
  ehApresentador?: boolean;
  emAcao?: boolean;
  aoDecidir?: (id: string, acao: "liberar" | "ocultar") => void;
}) {
  return (
    <li className={`px-4 py-2 ${m.enviando || m.falhou ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[13px] font-semibold ${
            m.kind === "HOST" ? "text-[var(--acento)]" : "text-[var(--texto)]"
          }`}
        >
          {m.autor}
        </span>
        {m.kind === "HOST" ? (
          <span className="selo bg-[var(--acento-fraco)] px-1.5 py-0.5 text-[10px] text-[var(--acento)]">
            apresentador
          </span>
        ) : null}
        {m.enviando ? <span className="text-[11px] text-[var(--texto-3)]">enviando...</span> : null}
        {m.falhou ? <span className="text-[11px] text-[var(--erro)]">nao enviou</span> : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--texto-2)]">
        {m.texto}
      </p>

      {ehApresentador && m.aguardando && m.kind === "REAL" ? (
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            disabled={emAcao}
            onClick={() => aoDecidir?.(m.id, "liberar")}
            className="text-[12px] font-semibold text-[var(--acento)] disabled:opacity-50"
          >
            {emAcao ? "liberando..." : "Liberar para a sala"}
          </button>
          <button
            type="button"
            disabled={emAcao}
            onClick={() => aoDecidir?.(m.id, "ocultar")}
            className="text-[12px] text-[var(--texto-3)] hover:text-[var(--erro)] disabled:opacity-50"
          >
            Ocultar
          </button>
        </div>
      ) : null}
    </li>
  );
}

export default function Chat({
  token,
  trilha,
  posicaoAlvo,
  podeEscrever,
  cabecalho,
  extras = [],
  ehApresentador = false,
  somenteLeitura = false,
  aoSaberAudiencia,
}: {
  token: string;
  trilha: Mensagem[];
  posicaoAlvo: () => number;
  podeEscrever: boolean;
  cabecalho?: React.ReactNode;
  extras?: Mensagem[];
  ehApresentador?: boolean;
  /** pre-visualizacao: so a trilha, sem consulta e sem escrever */
  somenteLeitura?: boolean;
  /** o contador viaja nesta mesma consulta; quem mostra e o cabecalho */
  aoSaberAudiencia?: (quantos: number | null) => void;
}) {
  const [daSessao, setDaSessao] = useState<Mensagem[]>([]);
  const [enquete, setEnquete] = useState<EnqueteAtiva | null>(null);
  const [locais, setLocais] = useState<Mensagem[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [emAcao, setEmAcao] = useState<Set<string>>(new Set());

  const [, tique] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tique((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  // Fonte 2: consulta periodica. Sem conexao persistente: em serverless a
  // funcao tem tempo de execucao limitado e SSE nao se sustenta.
  useEffect(() => {
    if (somenteLeitura) return;
    let vivo = true;
    const consultar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/sala/${token}/chat`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as {
          mensagens?: Mensagem[];
          enquete?: EnqueteAtiva | null;
          assistindo?: number | null;
        };
        if (!vivo) return;
        if (d.mensagens) setDaSessao(d.mensagens);
        // Enquete, oferta e contador viajam junto do chat: sem endpoint proprio.
        setEnquete(d.enquete ?? null);
        aoSaberAudiencia?.(d.assistindo ?? null);
      } catch {
        // uma consulta perdida nao quebra nada: a proxima vem em 6 segundos
      }
    };
    void consultar();
    const t = setInterval(consultar, INTERVALO_CONSULTA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
    // aoSaberAudiencia e estavel por sessao de sala
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, somenteLeitura]);

  const todas = useMemo(() => unir(trilha, daSessao, locais, extras), [trilha, daSessao, locais, extras]);
  const posicao = posicaoAlvo();
  const visiveis = useMemo(() => todas.filter((m) => m.sec <= posicao), [todas, posicao]);

  const esteiraRef = useRef<HTMLUListElement | null>(null);
  const coladoRef = useRef(true);

  useEffect(() => {
    const el = esteiraRef.current;
    if (!el || !coladoRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [visiveis.length]);

  const aoRolar = useCallback(() => {
    const el = esteiraRef.current;
    if (!el) return;
    coladoRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  /**
   * Liberar e aprovar. Armadilha 9.6: o botao vira "liberando..." e so muda
   * de verdade quando o servidor responde — foi exatamente aqui que o
   * apresentador via "✓ liberado" com o comentario ainda pendente.
   */
  async function decidir(id: string, acao: "liberar" | "ocultar") {
    setEmAcao((s) => new Set(s).add(id));
    try {
      const r = await fetch(`/api/sala/${token}/liberar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, acao }),
      });
      if (!r.ok) return;
      setDaSessao((atual) =>
        acao === "ocultar"
          ? atual.filter((m) => m.id !== id)
          : atual.map((m) => (m.id === id ? { ...m, aguardando: false } : m)),
      );
    } catch {
      // a proxima consulta traz o estado real
    } finally {
      setEmAcao((s) => {
        const novo = new Set(s);
        novo.delete(id);
        return novo;
      });
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = rascunho.trim();
    if (!texto || enviando) return;

    const idLocal = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const sec = Math.max(0, Math.floor(posicaoAlvo()));

    setLocais((l) => [...l, { id: idLocal, autor: "Voce", texto, sec, kind: "REAL", minha: true, enviando: true }]);
    setRascunho("");
    setEnviando(true);
    coladoRef.current = true;

    try {
      const r = await fetch(`/api/sala/${token}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto, sec }),
      });
      if (!r.ok) throw new Error("recusado");
      const d = (await r.json()) as { mensagem?: Mensagem };
      // Armadilha 9.6: so trocamos o eco local pela mensagem de verdade
      // depois que o servidor confirmou.
      setLocais((l) => l.filter((m) => m.id !== idLocal));
      if (d.mensagem) setDaSessao((s) => unir(s, [d.mensagem as Mensagem]));
    } catch {
      setLocais((l) => l.map((m) => (m.id === idLocal ? { ...m, enviando: false, falhou: true } : m)));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--borda)] bg-[var(--cartao)]">
      <div className="border-b border-[var(--borda)] px-4 py-3">
        <h2 className="titulo-secao">Conversa</h2>
      </div>

      {cabecalho}

      {enquete ? (
        <Enquete
          token={token}
          enquete={enquete}
          aoVotar={(optionId) =>
            setEnquete((atual) =>
              atual
                ? {
                    ...atual,
                    meuVoto: optionId,
                    // a contagem exata vem na proxima consulta; aqui so
                    // marcamos o proprio voto, que o servidor ja confirmou
                    total: atual.meuVoto === null ? atual.total + 1 : atual.total,
                  }
                : atual,
            )
          }
        />
      ) : null}

      <ul
        ref={esteiraRef}
        onScroll={aoRolar}
        className="rolagem-fina min-h-0 flex-1 divide-y divide-[var(--borda)]/60 overflow-y-auto"
      >
        {visiveis.length === 0 ? (
          <li className="px-4 py-6 text-center text-[13px] text-[var(--texto-3)]">
            A conversa comeca em instantes.
          </li>
        ) : (
          visiveis.map((m) => (
            <Bolha
              key={m.id}
              m={m}
              ehApresentador={ehApresentador}
              emAcao={emAcao.has(m.id)}
              aoDecidir={decidir}
            />
          ))
        )}
      </ul>

      {podeEscrever ? (
        <form onSubmit={enviar} className="flex gap-2 border-t border-[var(--borda)] p-3">
          <input
            className="campo !py-2 text-[14px]"
            placeholder="Escreva aqui"
            maxLength={500}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
          />
          <button type="submit" className="botao shrink-0 !px-3.5 !py-2 text-[14px]" disabled={enviando}>
            Enviar
          </button>
        </form>
      ) : null}
    </aside>
  );
}
