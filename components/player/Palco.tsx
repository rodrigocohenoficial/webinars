"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Adaptador, PlayerRef } from "./tipos";
import { criarYoutube } from "./youtube";
import { criarVimeo } from "./vimeo";

/** Armadilha 9.4: a marca do provedor aparece nos primeiros segundos. */
const CORTINA_MS = 4000;

/**
 * O provedor tambem pisca a propria marca — titulo, avatar do canal — quando
 * a reproducao muda de estado por comando nosso. Ativar o som e um desses
 * momentos, e a cortina cobre o piscada.
 */
const CORTINA_AO_ATIVAR_SOM_MS = 2600;

/** Armadilha 9.3: so ressincroniza quando a deriva passa disso. */
const DERIVA_TOLERADA_SEG = 3;

/**
 * De quanto em quanto tempo conferimos que a reproducao esta de pe. Curto de
 * proposito: quanto antes a cortina sobe quando o video para, menos marca do
 * provedor aparece. Esta passagem nunca reposiciona — so manda tocar.
 */
const INTERVALO_VIGIA_MS = 700;

/**
 * Depois de reposicionar, o player do provedor demora para reportar a
 * posicao nova: por alguns instantes getCurrentTime ainda devolve a antiga.
 * Sem esta espera, a passagem seguinte le a posicao velha, conclui que ainda
 * esta fora do lugar e manda outro seek — e o video fica em laco nos
 * primeiros segundos, sem nunca assentar.
 */
const ESPERA_APOS_AJUSTE_MS = 4000;

type Estado = "carregando" | "tocando" | "mudo" | "manual" | "erro";

export default function Palco({
  video: playerRef,
  aspectRatio,
  legendas,
  posicaoAlvo,
  capaUrl,
  aoTerminar,
}: {
  video: PlayerRef;
  aspectRatio: string;
  legendas: boolean;
  /** sempre consultado, nunca guardado: o alvo anda junto com o relogio */
  posicaoAlvo: () => number;
  capaUrl?: string | null;
  aoTerminar: () => void;
}) {
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const adaptadorRef = useRef<Adaptador | null>(null);
  const alvoRef = useRef(posicaoAlvo);
  alvoRef.current = posicaoAlvo;

  const [estado, setEstado] = useState<Estado>("carregando");
  const [cortina, setCortina] = useState(true);
  const [motivoErro, setMotivoErro] = useState<string | null>(null);

  const abrirCortina = useCallback((emMs = CORTINA_MS) => {
    setTimeout(() => setCortina(false), emMs);
  }, []);

  useEffect(() => {
    let vivo = true;
    const caixa = caixaRef.current;
    if (!caixa) return;

    const alvoElemento = document.createElement("div");
    alvoElemento.style.width = "100%";
    alvoElemento.style.height = "100%";
    caixa.appendChild(alvoElemento);

    const opcoes = {
      elemento: alvoElemento,
      ref: playerRef,
      inicioSec: Math.max(0, alvoRef.current()),
      legendas,
      aoComecarATocar: () => abrirCortina(),
      aoTerminar,
    };

    (async () => {
      let adaptador: Adaptador;
      try {
        adaptador = playerRef.provider === "youtube" ? await criarYoutube(opcoes) : await criarVimeo(opcoes);
      } catch (e) {
        if (!vivo) return;
        setMotivoErro(e instanceof Error ? e.message : "nao consegui preparar a sessao");
        setEstado("erro");
        setCortina(false);
        return;
      }
      if (!vivo) {
        adaptador.destruir();
        return;
      }
      adaptadorRef.current = adaptador;

      /**
       * Armadilha 9.2: tente com som, caia para mudo, e so entao desista.
       * O navegador bloqueia reproducao automatica com som, mas quase nunca
       * a muda.
       */
      try {
        adaptador.definirMudo(false);
        await adaptador.tocar();
        if (!vivo) return;
        setEstado("tocando");
        abrirCortina();
        return;
      } catch {
        // recusado com som: proxima tentativa e muda
      }

      try {
        adaptador.definirMudo(true);
        await adaptador.tocar();
        if (!vivo) return;
        setEstado("mudo");
        abrirCortina();
        return;
      } catch {
        if (!vivo) return;
        // nem mudo tocou: so resta a entrada manual
        setEstado("manual");
        setCortina(false);
      }
    })();

    return () => {
      vivo = false;
      adaptadorRef.current?.destruir();
      adaptadorRef.current = null;
    };
    // playerRef e estavel por sessao de sala; recriar o player seria pior
    // que qualquer mudanca de prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deriva: corrige so quando passa do tolerado. Corrigir sempre rebufferiza
  // e e exatamente o que a armadilha 9.3 descreve como "a transmissao para".
  useEffect(() => {
    if (estado !== "tocando" && estado !== "mudo") return;

    let ultimoAjusteMs = 0;

    const conferir = () => {
      const a = adaptadorRef.current;
      if (!a) return;
      if (document.visibilityState !== "visible") return;

      // A sessao nao para. Se parou — clique que escapou, provedor
      // engasgando, aba que voltou — manda tocar de novo. Sem reposicionar:
      // reposicionar aqui era o que criava o laco, porque parar e voltar
      // acontece justamente nos instantes em que a posicao ainda nao
      // assentou. Quem cuida de posicao e a deriva, la embaixo, com espera.
      //
      // E a cortina sobe junto: parado e exatamente quando o provedor mostra
      // a marca dele (titulo, avatar do canal, "mais videos", logo). Cobrir
      // por tempo fixo nao resolvia, porque o tempo parado nao e fixo.
      if (!a.tocando()) {
        setCortina(true);
        void a.tocar().catch(() => undefined);
        return;
      }

      // Voltou a tocar: a cortina pode descer.
      setCortina((estava) => {
        if (estava) abrirCortina(1200);
        return estava;
      });

      // Deriva: corrige so quando passa do tolerado, e so depois do ajuste
      // anterior ter assentado. Corrigir sempre rebufferiza, e e exatamente
      // o que a armadilha 9.3 descreve como "a transmissao para".
      if (Date.now() - ultimoAjusteMs < ESPERA_APOS_AJUSTE_MS) return;

      const alvo = alvoRef.current();
      const atual = a.tempoAtual();
      if (!Number.isFinite(atual)) return;
      if (Math.abs(atual - alvo) > DERIVA_TOLERADA_SEG) {
        a.posicionar(Math.max(0, alvo));
        ultimoAjusteMs = Date.now();
      }
    };

    // Mais curto que a deriva: quanto antes a cortina sobe, menos marca do
    // provedor aparece.
    const t = setInterval(conferir, INTERVALO_VIGIA_MS);
    const aoVoltar = () => {
      // Notebook que dormiu volta com o relogio parado: confere na hora,
      // sem esperar o proximo intervalo.
      if (document.visibilityState === "visible") setTimeout(conferir, 400);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  /**
   * Armadilha 9.3: NAO da seek ao ativar o som.
   * Desmuta e toca no mesmo gesto. Quem ressincroniza e a deriva, depois,
   * e so se passar de 3 segundos.
   */
  async function ativarSom() {
    const a = adaptadorRef.current;
    if (!a) return;
    setCortina(true);
    a.definirMudo(false);
    try {
      await a.tocar();
      setEstado("tocando");
    } catch {
      setEstado("mudo");
    }
    setTimeout(() => setCortina(false), CORTINA_AO_ATIVAR_SOM_MS);
  }

  async function entrarManualmente() {
    const a = adaptadorRef.current;
    if (!a) return;
    a.definirMudo(false);
    a.posicionar(Math.max(0, alvoRef.current()));
    try {
      await a.tocar();
      setEstado("tocando");
      abrirCortina();
    } catch {
      setMotivoErro("o navegador nao deixou a sessao comecar");
      setEstado("erro");
    }
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-black"
      style={{ aspectRatio: aspectRatio === "9/16" ? "9 / 16" : "16 / 9" }}
    >
      {/*
        pointer-events-none no iframe e o que realmente impede pausar. Um
        <div> por cima nao basta: o clique ainda encontrava o player do
        provedor, que pausava e abria a tela de pausa dele — titulo, avatar,
        "mais videos" e logo. Sem evento de ponteiro, o provedor nunca fica
        sabendo do clique.
      */}
      <div
        ref={caixaRef}
        className="absolute inset-0 [&_iframe]:pointer-events-none [&_iframe]:h-full [&_iframe]:w-full"
      />

      {/* Sem barra de progresso: nao da para adiantar, voltar nem pausar. */}
      <div className="absolute inset-0 z-10" aria-hidden />

      {cortina ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05070a]">
          {capaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capaUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
          ) : null}
          <div className="relative flex items-center gap-2.5 text-[14px] text-[var(--texto-2)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--acento)]" />
            {estado === "mudo" ? "ligando o som" : "entrando na sessao"}
          </div>
        </div>
      ) : null}

      {estado === "mudo" ? (
        <button
          type="button"
          onClick={ativarSom}
          className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 bg-[var(--acento)] py-3 text-[15px] font-semibold text-[#04120a]"
        >
          Toque para ouvir
        </button>
      ) : null}

      {estado === "manual" ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#05070a]/95 px-6 text-center">
          <p className="text-[15px] text-[var(--texto-2)]">Seu navegador pediu um toque para comecar.</p>
          <button type="button" onClick={entrarManualmente} className="botao">
            Entrar na sessao
          </button>
        </div>
      ) : null}

      {estado === "erro" ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#05070a] px-6 text-center">
          <p className="text-[15px] text-[var(--texto-2)]">
            Nao consegui iniciar a sessao aqui{motivoErro ? ` (${motivoErro})` : ""}.
          </p>
          <button type="button" onClick={() => window.location.reload()} className="botao-fantasma">
            Tentar de novo
          </button>
        </div>
      ) : null}
    </div>
  );
}
