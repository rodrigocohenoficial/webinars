"use client";

import { useEffect, useRef, useState } from "react";
import { REACOES, type ReacaoNaSala } from "@/lib/reacoes";

/** Quantas sobem ao mesmo tempo. Mais que isso vira poluicao, nao vida. */
const MAXIMO_SUBINDO = 14;

/** Quanto tempo cada uma leva para subir e sumir. Casa com a animacao no CSS. */
const DURACAO_SUBIDA_MS = 2600;

/** Intervalo minimo entre duas reacoes da mesma pessoa. */
const ESPERA_ENTRE_TOQUES_MS = 350;

type Subindo = { chave: string; emoji: string; desvio: number; atraso: number };

export default function Reacoes({
  token,
  trilha,
  daSessao,
  posicaoAlvo,
  previa = false,
}: {
  token: string;
  /** reacoes de sessoes anteriores, presas ao segundo do video */
  trilha: ReacaoNaSala[];
  /** as desta sessao, que chegam pela consulta periodica */
  daSessao: ReacaoNaSala[];
  posicaoAlvo: () => number;
  previa?: boolean;
}) {
  const [subindo, setSubindo] = useState<Subindo[]>([]);
  const jaMostradasRef = useRef<Set<string>>(new Set());
  const ultimoToqueRef = useRef(0);
  const montouRef = useRef(false);

  function soltar(emoji: string, quantas = 1) {
    const novas: Subindo[] = Array.from({ length: quantas }, (_, i) => ({
      chave: `${Date.now()}-${Math.random()}-${i}`,
      emoji,
      desvio: Math.round((Math.random() - 0.5) * 46),
      atraso: i * 90,
    }));

    setSubindo((atual) => [...atual, ...novas].slice(-MAXIMO_SUBINDO));
    setTimeout(() => {
      const chaves = new Set(novas.map((n) => n.chave));
      setSubindo((atual) => atual.filter((s) => !chaves.has(s.chave)));
    }, DURACAO_SUBIDA_MS + novas.length * 90);
  }

  // Revela as reacoes conforme o video anda, como a trilha do chat.
  useEffect(() => {
    const todas = [...trilha, ...daSessao];

    // Na primeira passagem, tudo que ja passou entra como visto. Sem isso,
    // quem abre a sala aos 20 minutos levaria vinte minutos de reacoes na
    // cara de uma vez.
    if (!montouRef.current) {
      montouRef.current = true;
      const agora = posicaoAlvo();
      for (const r of todas) if (r.sec <= agora) jaMostradasRef.current.add(r.id);
      return;
    }

    const posicao = posicaoAlvo();
    const novas = todas.filter((r) => r.sec <= posicao && !jaMostradasRef.current.has(r.id));
    if (novas.length === 0) return;

    for (const r of novas) jaMostradasRef.current.add(r.id);
    // Muitas no mesmo segundo viram poucas na tela: a sensacao e a mesma e a
    // tela continua legivel.
    for (const r of novas.slice(-4)) soltar(r.emoji);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trilha, daSessao]);

  // Um tique proprio, para a trilha ser revelada mesmo sem chegar nada novo.
  const [, tique] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tique((n) => n + 1), 700);
    return () => clearInterval(t);
  }, []);

  async function reagir(emoji: string) {
    const agora = Date.now();
    if (agora - ultimoToqueRef.current < ESPERA_ENTRE_TOQUES_MS) return;
    ultimoToqueRef.current = agora;

    // A propria reacao sobe na hora: e o unico eco que nao precisa esperar.
    soltar(emoji);
    if (previa) return;

    try {
      await fetch(`/api/sala/${token}/reacao`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji, sec: Math.max(0, Math.floor(posicaoAlvo())) }),
        keepalive: true,
      });
    } catch {
      // reacao perdida nao machuca ninguem
    }
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-56 overflow-hidden">
        {subindo.map((s) => (
          <span
            key={s.chave}
            className="reacao-subindo absolute bottom-3 right-10 text-2xl"
            style={{ marginRight: `${s.desvio}px`, animationDelay: `${s.atraso}ms` }}
          >
            {s.emoji}
          </span>
        ))}
      </div>

      {/*
        No celular a barra fica embaixo do video, nao por cima: a tela ja e
        apertada e cobrir o rosto de quem fala com quatro emojis e pior do
        que gastar uma linha. No desktop sobra espaco, entao ela flutua no
        canto.
      */}
      <div className="mt-2 flex justify-end gap-0.5 lg:absolute lg:bottom-3 lg:right-3 lg:z-30 lg:mt-0 lg:rounded-full lg:bg-black/45 lg:p-1 lg:backdrop-blur">
        {REACOES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => reagir(emoji)}
            aria-label={`reagir com ${emoji}`}
            className="rounded-full border border-[var(--borda)] px-3 py-1.5 text-[16px] leading-none transition active:scale-90 lg:border-transparent lg:px-2 lg:py-1 lg:hover:scale-125"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
