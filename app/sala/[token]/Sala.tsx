"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Palco from "@/components/player/Palco";
import Ambiente from "@/components/player/Ambiente";
import type { PlayerRef } from "@/components/player/tipos";
import { useRelogio } from "@/components/useRelogio";
import { usePresenca } from "@/components/usePresenca";
import { calcularEstado, type Fase } from "@/lib/sala";
import ProximosHorarios from "./ProximosHorarios";
import Chat, { type Mensagem } from "./Chat";
import Oferta, { type OfertaConfig } from "./Oferta";
import Audiencia from "./Audiencia";

export type DadosSala = {
  token: string;
  titulo: string;
  subtitulo: string | null;
  apresentador: string | null;
  capaUrl: string | null;
  inicioMs: number;
  durationSec: number | null;
  aspectRatio: string;
  legendas: boolean;
  joinWindowMin: number;
  video: PlayerRef | null;
  videoEspera: PlayerRef | null;
  agoraMs: number;
  /** a trilha do replay, baixada inteira com a pagina */
  trilha: Mensagem[];
  oferta: OfertaConfig | null;
  /** voce entrando na propria sala: mesma tela, com duas coisas a mais */
  ehApresentador: boolean;
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">{children}</main>
  );
}

function contagem(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${p(h)}:${p(m)}:${p(seg)}`;
  if (h > 0) return `${p(h)}:${p(m)}:${p(seg)}`;
  return `${p(m)}:${p(seg)}`;
}

export default function Sala({ dados }: { dados: DadosSala }) {
  const { agora } = useRelogio(dados.agoraMs);

  // Quem ja entrou nao e mais expulso pela janela de entrada: LATE vale para
  // quem chega tarde, nao para quem esta assistindo.
  const jaEntrouRef = useRef(false);
  const [tique, redesenhar] = useState(0);

  useEffect(() => {
    const t = setInterval(() => redesenhar((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const estado = useMemo(
    () =>
      calcularEstado({
        agoraMs: agora(),
        inicioMs: dados.inicioMs,
        durationSec: dados.durationSec,
        joinWindowMin: dados.joinWindowMin,
        temVideo: dados.video !== null,
        jaEntrou: jaEntrouRef.current,
      }),
    // tique entra de proposito: e ele que faz a fase andar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agora, dados, tique],
  );

  if (estado.fase === "LIVE") jaEntrouRef.current = true;

  const posicaoAlvo = useCallback(() => (agora() - dados.inicioMs) / 1000, [agora, dados.inicioMs]);
  const aoTerminar = useCallback(() => redesenhar((n) => n + 1), []);

  usePresenca(dados.token, posicaoAlvo, estado.fase === "LIVE");

  return (
    <Tela
      fase={estado.fase}
      faltamSec={estado.faltamSec}
      dados={dados}
      posicaoAlvo={posicaoAlvo}
      aoTerminar={aoTerminar}
    />
  );
}

/** Fundo da sala de espera: video de ambiente em laco e mudo, ou a capa. */
function FundoEspera({ dados }: { dados: DadosSala }) {
  if (dados.videoEspera) {
    return (
      <>
        <Ambiente video={dados.videoEspera} aspectRatio="16/9" />
        <div className="absolute inset-0 bg-[#05070a]/72" />
      </>
    );
  }
  if (dados.capaUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dados.capaUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--fundo)]" />
      </>
    );
  }
  return null;
}

function Tela({
  fase,
  faltamSec,
  dados,
  posicaoAlvo,
  aoTerminar,
}: {
  fase: Fase;
  faltamSec: number;
  dados: DadosSala;
  posicaoAlvo: () => number;
  aoTerminar: () => void;
}) {
  // Regra 5.6: nenhuma destas telas diz video, gravacao ou replay.
  if (fase === "SEM_VIDEO") {
    return (
      <Moldura>
        <div className="cartao text-center">
          <h1 className="text-lg font-semibold">{dados.titulo}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--texto-2)]">
            Estamos finalizando os preparativos desta sessao. Deixe esta pagina aberta.
          </p>
        </div>
      </Moldura>
    );
  }

  if (fase === "WAITING") {
    return (
      <div className="relative min-h-dvh overflow-hidden">
        <FundoEspera dados={dados} />
        <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-5 py-10 text-center">
          <p className="selo bg-[var(--fundo-2)]/80 text-[var(--texto-2)]">sua sessao</p>
          <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {dados.titulo}
          </h1>
          {dados.apresentador ? <p className="ajuda mt-2">Com {dados.apresentador}</p> : null}

          <p className="mt-9 text-[13px] uppercase tracking-widest text-[var(--texto-3)]">comeca em</p>
          <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">
            {contagem(faltamSec)}
          </p>

          <p className="mt-9 max-w-sm text-[14px] leading-relaxed text-[var(--texto-2)]">
            Deixe esta pagina aberta. Na hora marcada ela comeca sozinha — voce nao precisa fazer nada.
          </p>
        </main>
      </div>
    );
  }

  if (fase === "LATE") {
    return (
      <Moldura>
        <div className="cartao text-center">
          <h1 className="text-lg font-semibold">Esta sessao ja comecou</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--texto-2)]">
            A entrada desta sessao ja fechou. Escolha outro horario — leva um clique.
          </p>
          <ProximosHorarios token={dados.token} />
        </div>
      </Moldura>
    );
  }

  if (fase === "ENDED") {
    return (
      <Moldura>
        <div className="cartao text-center">
          <h1 className="text-lg font-semibold">Esta sessao foi encerrada</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--texto-2)]">
            Obrigado por ter vindo. Se quiser assistir de novo, escolha um horario.
          </p>
          <ProximosHorarios token={dados.token} />
        </div>
      </Moldura>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5">
      <div className="mb-4">
        <h1 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">{dados.titulo}</h1>
        {dados.apresentador ? <p className="ajuda">Com {dados.apresentador}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {dados.video ? (
            <Palco
              video={dados.video}
              aspectRatio={dados.aspectRatio}
              legendas={dados.legendas}
              posicaoAlvo={posicaoAlvo}
              capaUrl={dados.capaUrl}
              aoTerminar={aoTerminar}
            />
          ) : null}
          {dados.oferta ? (
            <Oferta token={dados.token} config={dados.oferta} posicaoAlvo={posicaoAlvo} />
          ) : null}
        </div>
        <div className="h-[420px] lg:h-[min(70vh,640px)]">
          <Chat
            token={dados.token}
            trilha={dados.trilha}
            posicaoAlvo={posicaoAlvo}
            podeEscrever
            ehApresentador={dados.ehApresentador}
            cabecalho={dados.ehApresentador ? <Audiencia token={dados.token} /> : undefined}
          />
        </div>
      </div>
    </main>
  );
}
