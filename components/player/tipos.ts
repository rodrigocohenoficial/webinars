/**
 * O contrato que o palco conhece. YouTube e Vimeo implementam este mesmo
 * contrato, e o resto da sala nao sabe de qual provedor esta falando.
 *
 * Armadilha 9.2: um <iframe autoplay=1> nao serve. Sem a API oficial do
 * provedor nao da para SABER que a reproducao foi recusada, e sem saber
 * disso nao da para cair para mudo nem oferecer entrada manual.
 */
export type Provedor = "youtube" | "vimeo";

export type PlayerRef = {
  provider: Provedor;
  id: string;
  hash?: string;
};

export type Adaptador = {
  /** toca. Resolve quando esta tocando de fato, rejeita quando foi recusado. */
  tocar(): Promise<void>;
  pausar(): void;
  /** posiciona. Caro: rebufferiza. Nunca chamar junto de desmutar (9.3). */
  posicionar(segundo: number): void;
  tempoAtual(): number;
  /** esta tocando de fato agora? (buffering conta como caminho para tocar) */
  tocando(): boolean;
  mudo(): boolean;
  definirMudo(v: boolean): void;
  destruir(): void;
};

export type OpcoesAdaptador = {
  elemento: HTMLElement;
  ref: PlayerRef;
  inicioSec: number;
  legendas: boolean;
  aoComecarATocar: () => void;
  aoTerminar: () => void;
};
