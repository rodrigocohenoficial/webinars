/**
 * Invariante 5.1: duracao nao e conveniencia.
 *
 * Sem duracao a sessao nunca encerra e, passado o fim do video, o player
 * recebe um pedido de um segundo que nao existe e fica em branco, sem erro
 * nenhum. Entao: detectamos aqui, e quem salva recusa video sem duracao.
 *
 * O oEmbed do Vimeo informa duracao. O do YouTube nao — a duracao sai da
 * pagina do video, no campo "lengthSeconds".
 */

export type Provedor = "youtube" | "vimeo";

export type VideoRef = {
  provider: Provedor;
  id: string;
  /** hash de video nao listado do Vimeo (vimeo.com/123456789/abc123) */
  hash?: string;
};

export type VideoInfo = VideoRef & {
  durationSec: number | null;
  aspectRatio: "16/9" | "9/16";
  title?: string;
  thumbnailUrl?: string;
  /** por que a duracao nao veio, para a mensagem do painel */
  erro?: string;
};

export function parseVideoUrl(raw: string): VideoRef | null {
  const url = raw.trim();
  if (!url) return null;

  const yt =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(
      url,
    );
  if (yt) return { provider: "youtube", id: yt[1] };

  const vimeoPlayer = /player\.vimeo\.com\/video\/(\d+)(?:\?[^#]*\bh=([A-Za-z0-9]+))?/.exec(url);
  if (vimeoPlayer) {
    return { provider: "vimeo", id: vimeoPlayer[1], hash: vimeoPlayer[2] || undefined };
  }
  const vimeo = /vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([A-Za-z0-9]+))?/.exec(
    url,
  );
  if (vimeo) return { provider: "vimeo", id: vimeo[1], hash: vimeo[2] || undefined };

  return null;
}

/** A URL canonica que guardamos, ja limpa de parametros de rastreio. */
export function urlCanonica(ref: VideoRef): string {
  if (ref.provider === "youtube") return `https://www.youtube.com/watch?v=${ref.id}`;
  return ref.hash ? `https://vimeo.com/${ref.id}/${ref.hash}` : `https://vimeo.com/${ref.id}`;
}

function proporcao(width?: number, height?: number): "16/9" | "9/16" {
  if (!width || !height) return "16/9";
  return height > width ? "9/16" : "16/9";
}

async function buscar(url: string, timeoutMs = 8000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // sem isso o YouTube devolve uma pagina de consentimento sem lengthSeconds
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9",
      },
      cache: "no-store",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function buscarInfoDoVideo(raw: string): Promise<VideoInfo | null> {
  const ref = parseVideoUrl(raw);
  if (!ref) return null;

  if (ref.provider === "vimeo") {
    const alvo = encodeURIComponent(urlCanonica(ref));
    const res = await buscar(`https://vimeo.com/api/oembed.json?url=${alvo}`);
    if (!res || !res.ok) {
      return { ...ref, durationSec: null, aspectRatio: "16/9", erro: "o Vimeo nao respondeu" };
    }
    const data = (await res.json().catch(() => null)) as
      | { duration?: number; width?: number; height?: number; title?: string; thumbnail_url?: string }
      | null;
    if (!data) {
      return { ...ref, durationSec: null, aspectRatio: "16/9", erro: "resposta do Vimeo ilegivel" };
    }
    return {
      ...ref,
      durationSec: typeof data.duration === "number" && data.duration > 0 ? Math.round(data.duration) : null,
      aspectRatio: proporcao(data.width, data.height),
      title: data.title,
      thumbnailUrl: data.thumbnail_url,
    };
  }

  // YouTube: oEmbed para titulo e capa, pagina do video para a duracao
  const [oembed, pagina] = await Promise.all([
    buscar(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(urlCanonica(ref))}`),
    buscar(`https://www.youtube.com/watch?v=${ref.id}&hl=pt-BR`),
  ]);

  let title: string | undefined;
  let thumbnailUrl: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  if (oembed && oembed.ok) {
    const data = (await oembed.json().catch(() => null)) as
      | { title?: string; thumbnail_url?: string; width?: number; height?: number }
      | null;
    if (data) {
      title = data.title;
      thumbnailUrl = data.thumbnail_url;
      width = data.width;
      height = data.height;
    }
  }

  let durationSec: number | null = null;
  let erro: string | undefined;
  if (pagina && pagina.ok) {
    const html = await pagina.text().catch(() => "");
    const m = /"lengthSeconds":"(\d+)"/.exec(html);
    if (m) durationSec = Number(m[1]);
    if (!durationSec) erro = "a pagina do YouTube nao trouxe a duracao";
    // shorts sao verticais e o oEmbed nem sempre conta isso
    if (/"isShortsEligible":true/.test(html) || /\/shorts\//.test(raw)) { width = 1080; height = 1920; }
  } else {
    erro = "o YouTube nao respondeu";
  }

  return {
    ...ref,
    durationSec: durationSec && durationSec > 0 ? durationSec : null,
    aspectRatio: proporcao(width, height),
    title,
    thumbnailUrl,
    erro: durationSec ? undefined : erro,
  };
}

/** Capa padrao quando o painel nao definiu uma a mao. */
export function capaAutomatica(ref: VideoRef): string | null {
  if (ref.provider === "youtube") return `https://i.ytimg.com/vi/${ref.id}/maxresdefault.jpg`;
  return null;
}
