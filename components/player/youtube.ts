import type { Adaptador, OpcoesAdaptador } from "./tipos";

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  destroy(): void;
};

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opcoes: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { UNSTARTED: number; ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let carregando: Promise<YTNamespace> | null = null;

function carregarApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (carregando) return carregando;

  carregando = new Promise<YTNamespace>((resolve, reject) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("API do YouTube carregou sem Player"));
    };

    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => reject(new Error("nao consegui carregar a API do YouTube"));
    document.head.appendChild(s);

    setTimeout(() => reject(new Error("a API do YouTube demorou demais")), 15000);
  });

  return carregando;
}

export async function criarYoutube(o: OpcoesAdaptador): Promise<Adaptador> {
  const YT = await carregarApi();

  const player = await new Promise<YTPlayer>((resolve, reject) => {
    const p = new YT.Player(o.elemento, {
      videoId: o.ref.id,
      playerVars: {
        autoplay: 0, // quem decide quando tocar somos nos, para saber se foi recusado
        controls: 0, // sem barra de progresso: nao da para adiantar nem voltar
        disablekb: 1,
        fs: 0,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
        modestbranding: 1,
        cc_load_policy: o.legendas ? 1 : 0,
        cc_lang_pref: "pt",
        start: Math.max(0, Math.floor(o.inicioSec)),
        origin: window.location.origin,
      },
      events: {
        onReady: () => resolve(p),
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) o.aoComecarATocar();
          if (e.data === YT.PlayerState.ENDED) o.aoTerminar();
        },
        onError: () => reject(new Error("o YouTube recusou este video")),
      },
    });
    setTimeout(() => reject(new Error("o player do YouTube nao ficou pronto")), 15000);
  });

  /**
   * Resolve quando esta tocando de fato. O estado BUFFERING conta como
   * caminho para tocar, entao esperamos ele virar PLAYING. Se nada
   * acontecer, o navegador recusou — e e isso que quem chama precisa saber.
   */
  function confirmarQueTocou(prazoMs = 2500): Promise<void> {
    return new Promise((resolve, reject) => {
      const comecou = Date.now();
      const tick = () => {
        const estado = player.getPlayerState();
        if (estado === YT.PlayerState.PLAYING) return resolve();
        if (Date.now() - comecou > prazoMs) return reject(new Error("reproducao recusada"));
        setTimeout(tick, 120);
      };
      tick();
    });
  }

  return {
    async tocar() {
      player.playVideo();
      await confirmarQueTocou();
    },
    pausar: () => player.pauseVideo(),
    posicionar: (s) => player.seekTo(Math.max(0, s), true),
    tempoAtual: () => player.getCurrentTime() || 0,
    mudo: () => player.isMuted(),
    definirMudo: (v) => {
      if (v) player.mute();
      else {
        player.unMute();
        player.setVolume(100);
      }
    },
    destruir: () => {
      try {
        player.destroy();
      } catch {
        // player ja foi embora com o DOM
      }
    },
  };
}
