"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/admin";
import { parseTempo } from "@/lib/time";
import { inteiro, ligado, slugificar, texto, textoOuNulo } from "@/lib/texto";
import { buscarInfoDoVideo, parseVideoUrl, urlCanonica } from "@/lib/video";
import { parseDaysOfWeek } from "@/lib/schedule";

/**
 * Armadilha 9.9: nenhuma destas acoes lanca excecao para erro previsivel.
 * Erro previsivel volta como estado e a tela mostra. Excecao vira
 * "Application error" com um codigo e nenhuma explicacao.
 */
export type EstadoForm = { erro?: string; ok?: string };


export async function criarWebinar(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirAdmin();

  const title = texto(formData.get("title"));
  if (!title) return { erro: "O titulo e obrigatorio." };

  const slugPedido = texto(formData.get("slug"));
  const base = slugificar(slugPedido || title) || "webinario";

  let slug = base;
  for (let i = 2; i < 50; i++) {
    const existe = await db.webinar.findUnique({ where: { slug }, select: { id: true } });
    if (!existe) break;
    slug = `${base}-${i}`;
  }

  const criado = await db.webinar.create({
    data: { slug, title },
    select: { id: true },
  });

  revalidatePath("/painel");
  redirect(`/painel/w/${criado.id}`);
}

export type InfoVideo = {
  erro?: string;
  aviso?: string;
  durationSec?: number;
  aspectRatio?: string;
  coverUrl?: string;
  title?: string;
  videoUrl?: string;
};

/** O botao "detectar" do formulario. Nunca grava nada: so devolve o que achou. */
export async function detectarVideo(urlBruta: string): Promise<InfoVideo> {
  await exigirAdmin();

  const ref = parseVideoUrl(urlBruta || "");
  if (!ref) {
    return { erro: "Nao reconheci esse link. Use um endereco do YouTube ou do Vimeo." };
  }

  const info = await buscarInfoDoVideo(urlBruta);
  if (!info) return { erro: "Nao reconheci esse link." };

  return {
    videoUrl: urlCanonica(ref),
    durationSec: info.durationSec ?? undefined,
    aspectRatio: info.aspectRatio,
    coverUrl: info.thumbnailUrl,
    title: info.title,
    aviso: info.durationSec
      ? undefined
      : `Nao consegui ler a duracao (${info.erro ?? "motivo desconhecido"}). Digite a duracao a mao — sem ela a sessao nunca encerra.`,
  };
}

export async function salvarWebinar(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirAdmin();

  const id = texto(formData.get("id"));
  if (!id) return { erro: "Webinario nao identificado." };

  const title = texto(formData.get("title"));
  if (!title) return { erro: "O titulo e obrigatorio." };

  const slug = slugificar(texto(formData.get("slug")) || title);
  if (!slug) return { erro: "O endereco (slug) ficou vazio." };

  // ── Video e duracao: invariante 5.1 ────────────────────────────────────
  const videoBruto = texto(formData.get("videoUrl"));
  let videoUrl: string | null = null;
  let durationSec: number | null = parseTempo(texto(formData.get("durationSec")));
  let aspectRatio = texto(formData.get("aspectRatio")) || "16/9";

  if (videoBruto) {
    const ref = parseVideoUrl(videoBruto);
    if (!ref) {
      return { erro: "Nao reconheci o link do video. Use um endereco do YouTube ou do Vimeo." };
    }
    videoUrl = urlCanonica(ref);

    if (!durationSec || durationSec <= 0) {
      // ultima tentativa antes de recusar
      const info = await buscarInfoDoVideo(videoUrl);
      if (info?.durationSec) {
        durationSec = info.durationSec;
        aspectRatio = info.aspectRatio;
      }
    }

    if (!durationSec || durationSec <= 0) {
      return {
        erro:
          "Nao da para salvar um video sem duracao. Sem ela a sessao nunca encerra e o player fica em branco no fim. Clique em detectar ou digite a duracao a mao.",
      };
    }
  } else {
    durationSec = null;
  }

  const waitingBruto = texto(formData.get("waitingVideoUrl"));
  let waitingVideoUrl: string | null = null;
  if (waitingBruto) {
    const ref = parseVideoUrl(waitingBruto);
    if (!ref) return { erro: "Nao reconheci o link do video da sala de espera." };
    waitingVideoUrl = urlCanonica(ref);
  }

  // ── Oferta ─────────────────────────────────────────────────────────────
  const ctaUrl = textoOuNulo(formData.get("ctaUrl"));
  const ctaAtSec = parseTempo(texto(formData.get("ctaAtSec")));
  const ctaUntilSec = parseTempo(texto(formData.get("ctaUntilSec")));

  if (ctaUrl && ctaAtSec === null) {
    return { erro: "A oferta tem link mas nao tem minuto de entrada. Diga em que ponto do video ela aparece." };
  }
  if (ctaAtSec !== null && ctaUntilSec !== null && ctaUntilSec <= ctaAtSec) {
    return { erro: "A oferta sai antes de entrar. Confira os dois minutos." };
  }
  if (durationSec && ctaAtSec !== null && ctaAtSec >= durationSec) {
    return { erro: "A oferta aparece depois do fim do video. Ninguem veria." };
  }

  const published = ligado(formData.get("published"));
  if (published && !videoUrl) {
    // Nao e proibido: inscricoes podem abrir antes de a gravacao existir.
    // Mas ninguem dispara aviso nem entra na sala, entao avisamos.
  }

  const dados = {
    slug,
    title,
    subtitle: textoOuNulo(formData.get("subtitle")),
    hostName: textoOuNulo(formData.get("hostName")),
    description: textoOuNulo(formData.get("description")),
    coverUrl: textoOuNulo(formData.get("coverUrl")),
    videoUrl,
    durationSec,
    aspectRatio: aspectRatio === "9/16" ? "9/16" : "16/9",
    waitingVideoUrl,
    published,
    jitEnabled: ligado(formData.get("jitEnabled")),
    jitDelayMin: Math.min(120, Math.max(1, inteiro(formData.get("jitDelayMin"), 10))),
    joinWindowMin: Math.max(0, inteiro(formData.get("joinWindowMin"), 0)),
    visibleSlots: Math.min(12, Math.max(1, inteiro(formData.get("visibleSlots"), 4))),
    chatAoVivo: ligado(formData.get("chatAoVivo")),
    legendas: ligado(formData.get("legendas")),
    mostrarAudiencia: ligado(formData.get("mostrarAudiencia")),
    audienciaMinima: Math.min(999, Math.max(0, inteiro(formData.get("audienciaMinima"), 3))),
    ctaLabel: textoOuNulo(formData.get("ctaLabel")),
    ctaUrl,
    ctaDescription: textoOuNulo(formData.get("ctaDescription")),
    ctaAtSec,
    ctaUntilSec,
    ctaNoFim: ligado(formData.get("ctaNoFim")),
  };

  try {
    await db.webinar.update({ where: { id }, data: dados });
  } catch (e) {
    const codigo = (e as { code?: string }).code;
    if (codigo === "P2002") return { erro: `O endereco "${slug}" ja esta em uso por outro webinario.` };
    if (codigo === "P2025") return { erro: "Esse webinario nao existe mais." };
    return { erro: "Nao consegui salvar. Tente de novo." };
  }

  revalidatePath("/painel");
  revalidatePath(`/painel/w/${id}`);
  revalidatePath(`/w/${slug}`);

  const avisoSemVideo =
    published && !videoUrl
      ? "Salvo. A pagina de inscricao esta no ar, mas sem video nenhum aviso automatico e disparado."
      : "Salvo.";

  return { ok: avisoSemVideo };
}

export async function alternarPublicacao(id: string): Promise<void> {
  await exigirAdmin();
  const w = await db.webinar.findUnique({ where: { id }, select: { published: true } });
  if (!w) return;
  await db.webinar.update({ where: { id }, data: { published: !w.published } });
  revalidatePath("/painel");
  revalidatePath(`/painel/w/${id}`);
}

export async function excluirWebinar(id: string): Promise<void> {
  await exigirAdmin();
  await db.webinar.delete({ where: { id } }).catch(() => null);
  revalidatePath("/painel");
  redirect("/painel");
}

// ── Regras de grade ──────────────────────────────────────────────────────

export async function adicionarRegra(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirAdmin();

  const webinarId = texto(formData.get("webinarId"));
  const timeOfDay = texto(formData.get("timeOfDay"));
  const dias = formData.getAll("dias").map((d) => String(d));

  if (!/^\d{1,2}:\d{2}$/.test(timeOfDay)) {
    return { erro: "Horario invalido. Use o formato 20:00." };
  }
  const [h, m] = timeOfDay.split(":").map(Number);
  if (h > 23 || m > 59) return { erro: "Horario invalido. Use o formato 20:00." };

  const daysOfWeek = parseDaysOfWeek(dias.join(","));
  if (daysOfWeek.length === 0) return { erro: "Escolha pelo menos um dia da semana." };

  await db.scheduleRule.create({
    data: {
      webinarId,
      daysOfWeek: daysOfWeek.join(","),
      timeOfDay: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    },
  });

  revalidatePath(`/painel/w/${webinarId}`);
  return { ok: "Regra adicionada." };
}

export async function alternarRegra(id: string): Promise<void> {
  await exigirAdmin();
  const regra = await db.scheduleRule.findUnique({ where: { id } });
  if (!regra) return;
  await db.scheduleRule.update({ where: { id }, data: { active: !regra.active } });
  revalidatePath(`/painel/w/${regra.webinarId}`);
}

export async function removerRegra(id: string): Promise<void> {
  await exigirAdmin();
  const regra = await db.scheduleRule.findUnique({ where: { id } });
  if (!regra) return;
  await db.scheduleRule.delete({ where: { id } }).catch(() => null);
  revalidatePath(`/painel/w/${regra.webinarId}`);
}

