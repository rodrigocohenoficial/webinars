"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Palco from "@/components/player/Palco";
import type { PlayerRef } from "@/components/player/tipos";
import { useRelogio } from "@/components/useRelogio";
import { calcularEstado, type Fase } from "@/lib/sala";

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
  agoraMs: number;
};

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-10">
      {children}
    </main>
  );
}

function Recado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Moldura>
      <div className="cartao text-center">
        <h1 className="text-lg font-semibold">{titulo}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--texto-2)]">{texto}</p>
      </div>
    </Moldura>
  );
}

export default function Sala({ dados }: { dados: DadosSala }) {
  const { agora } = useRelogio(dados.agoraMs);

  // Quem ja entrou nao e mais expulso pela janela de entrada. A fase LATE
  // vale para quem chega tarde, nao para quem esta assistindo.
  const jaEntrouRef = useRef(false);
  const [, redesenhar] = useState(0);

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
    // redesenhar entra de proposito: e o tique que faz a fase andar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agora, dados, redesenhar],
  );

  if (estado.fase === "LIVE") jaEntrouRef.current = true;

  useEffect(() => {
    const t = setInterval(() => redesenhar((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const posicaoAlvo = useCallback(
    () => (agora() - dados.inicioMs) / 1000,
    [agora, dados.inicioMs],
  );

  const aoTerminar = useCallback(() => redesenhar((n) => n + 1), []);

  return <Tela fase={estado.fase} dados={dados} posicaoAlvo={posicaoAlvo} aoTerminar={aoTerminar} />;
}

function Tela({
  fase,
  dados,
  posicaoAlvo,
  aoTerminar,
}: {
  fase: Fase;
  dados: DadosSala;
  posicaoAlvo: () => number;
  aoTerminar: () => void;
}) {
  // Regra 5.6: nenhuma destas telas diz video, gravacao ou replay.
  if (fase === "SEM_VIDEO") {
    return (
      <Recado
        titulo={dados.titulo}
        texto="Estamos finalizando os preparativos desta sessao. Deixe esta pagina aberta."
      />
    );
  }
  if (fase === "WAITING") {
    return <Recado titulo={dados.titulo} texto="Ainda nao comecou. Deixe esta pagina aberta." />;
  }
  if (fase === "LATE") {
    return <Recado titulo={dados.titulo} texto="Esta sessao ja comecou." />;
  }
  if (fase === "ENDED") {
    return <Recado titulo={dados.titulo} texto="Esta sessao foi encerrada." />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl">{dados.titulo}</h1>
        {dados.apresentador ? (
          <p className="ajuda">Com {dados.apresentador}</p>
        ) : null}
      </div>

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
    </main>
  );
}
