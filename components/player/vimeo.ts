import type { Adaptador, OpcoesAdaptador } from "./tipos";

type VimeoPlayer = {
  play(): Promise<void>;
  pause(): Promise<void>;
  setCurrentTime(s: number): Promise<number>;
  getCurrentTime(): Promise<number>;
  setMuted(v: boolean): Promise<boolean>;
  getMuted(): Promise<boolean>;
  setVolume(v: number): Promise<number>;
  on(evento: string, cb: (dados?: { seconds?: number }) => void): void;
  ready(): Promise<void>;
  destroy(): Promise<void>;
};

type VimeoNamespace = {
  Player: new (el: HTMLElement, opcoes: Record<string, unknown>) => VimeoPlayer;
};

declare global {
  interface Window {
    Vimeo?: VimeoNamespace;
  }
}

let carregando: Promise<VimeoNamespace> | null = null;

function carregarApi(): Promise<VimeoNamespace> {
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
  if (carregando) return carregando;

  carregando = new Promise<VimeoNamespace>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://player.vimeo.com/api/player.js";
    s.async = true;
    s.onload = () => {
      if (window.Vimeo?.Player) resolve(window.Vimeo);
      else reject(new Error("API do Vimeo carregou sem Player"));
    };
    s.onerror = () => reject(new Error("nao consegui carregar a API do Vimeo"));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("a API do Vimeo demorou demais")), 15000);
  });

  return carregando;
}

export async function criarVimeo(o: OpcoesAdaptador): Promise<Adaptador> {
  const Vimeo = await carregarApi();

  const player = new Vimeo.Player(o.elemento, {
    id: Number(o.ref.id),
    ...(o.ref.hash ? { h: o.ref.hash } : {}),
    autoplay: false,
    controls: false,
    playsinline: true,
    autopause: false,
    keyboard: false,
    pip: false,
    dnt: true,
    ...(o.legendas ? { texttrack: "pt" } : {}),
  });

  await player.ready();
  await player.setCurrentTime(Math.max(0, o.inicioSec)).catch(() => 0);

  player.on("play", () => o.aoComecarATocar());
  player.on("ended", () => o.aoTerminar());

  let ultimoTempo = Math.max(0, o.inicioSec);
  let estaMudo = false;
  player.on("timeupdate", (d) => {
    if (typeof d?.seconds === "number") ultimoTempo = d.seconds;
  });

  return {
    async tocar() {
      // O Vimeo rejeita a promessa quando o navegador recusa. E exatamente
      // o sinal que a armadilha 9.2 pede.
      await player.play();
    },
    pausar: () => void player.pause().catch(() => undefined),
    posicionar: (s) => void player.setCurrentTime(Math.max(0, s)).catch(() => undefined),
    tempoAtual: () => ultimoTempo,
    mudo: () => estaMudo,
    definirMudo: (v) => {
      estaMudo = v;
      void player.setMuted(v).catch(() => undefined);
      if (!v) void player.setVolume(1).catch(() => undefined);
    },
    destruir: () => {
      void player.destroy().catch(() => undefined);
    },
  };
}
