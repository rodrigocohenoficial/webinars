"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/admin";
import { parseTempo, formatMinutoSegundo } from "@/lib/time";
import { normalizarTexto, texto } from "@/lib/texto";

export type EstadoRoteiro = { erro?: string; ok?: string };

export type LinhaRelatorio = {
  numero: number;
  original: string;
  motivo: string;
};

export type EstadoLote = {
  erro?: string;
  gravadas?: number;
  ignoradas?: LinhaRelatorio[];
};

async function duracaoDe(webinarId: string): Promise<number | null> {
  const w = await db.webinar.findUnique({ where: { id: webinarId }, select: { durationSec: true } });
  return w?.durationSec ?? null;
}

export async function adicionarComentario(
  _prev: EstadoRoteiro,
  formData: FormData,
): Promise<EstadoRoteiro> {
  await exigirAdmin();

  const webinarId = texto(formData.get("webinarId"));
  const authorName = texto(formData.get("authorName"));
  const body = texto(formData.get("body"));
  const videoTimeSec = parseTempo(texto(formData.get("tempo")));

  if (!authorName) return { erro: "Falta o nome de quem comenta." };
  if (!body) return { erro: "O comentario esta vazio." };
  if (videoTimeSec === null || videoTimeSec < 0) return { erro: "Tempo invalido. Use 12:30 ou 750." };

  const duracao = await duracaoDe(webinarId);
  if (duracao && videoTimeSec >= duracao) {
    return { erro: `Esse ponto (${formatMinutoSegundo(videoTimeSec)}) fica depois do fim. Ninguem veria.` };
  }

  await db.chatMessage.create({
    data: {
      webinarId,
      authorName,
      body,
      videoTimeSec,
      kind: "FAKE",
      // FAKE nasce APPROVED: foi voce que escreveu
      status: "APPROVED",
    },
  });

  revalidatePath(`/painel/w/${webinarId}/roteiro`);
  return { ok: `Comentario gravado em ${formatMinutoSegundo(videoTimeSec)}.` };
}

/**
 * Colar em lote: uma linha por comentario, no formato
 *
 *     nome | tempo | comentario
 *
 * Nada e adivinhado. Toda linha que nao entra volta no relatorio com o
 * motivo, porque colar trinta linhas e descobrir que sumiram quatro sem
 * saber quais e pior do que nao ter o recurso.
 */
export async function colarEmLote(_prev: EstadoLote, formData: FormData): Promise<EstadoLote> {
  await exigirAdmin();

  const webinarId = texto(formData.get("webinarId"));
  const bruto = normalizarTexto(String(formData.get("lote") ?? ""));
  if (!bruto) return { erro: "Cole as linhas primeiro." };

  const duracao = await duracaoDe(webinarId);

  const existentes = await db.chatMessage.findMany({
    where: { webinarId, kind: "FAKE" },
    select: { authorName: true, body: true, videoTimeSec: true },
  });
  const jaExiste = new Set(
    existentes.map((m) => `${m.authorName.toLowerCase()}|${m.videoTimeSec}|${m.body.toLowerCase()}`),
  );

  const ignoradas: LinhaRelatorio[] = [];
  const aGravar: { authorName: string; body: string; videoTimeSec: number }[] = [];

  bruto.split("\n").forEach((linha, i) => {
    const numero = i + 1;
    const conteudo = linha.trim();
    if (!conteudo) return; // linha em branco nao e erro, e respiro

    const partes = conteudo.split("|");
    if (partes.length < 3) {
      ignoradas.push({ numero, original: conteudo, motivo: "faltou separador: use nome | tempo | comentario" });
      return;
    }

    const authorName = partes[0].trim();
    const tempoBruto = partes[1].trim();
    // o comentario pode conter |, entao o resto todo e o comentario
    const body = partes.slice(2).join("|").trim();

    if (!authorName) {
      ignoradas.push({ numero, original: conteudo, motivo: "sem nome de quem comenta" });
      return;
    }
    if (!body) {
      ignoradas.push({ numero, original: conteudo, motivo: "comentario vazio" });
      return;
    }

    const videoTimeSec = parseTempo(tempoBruto);
    if (videoTimeSec === null || videoTimeSec < 0) {
      ignoradas.push({ numero, original: conteudo, motivo: `tempo "${tempoBruto}" nao entendido` });
      return;
    }
    if (duracao && videoTimeSec >= duracao) {
      ignoradas.push({
        numero,
        original: conteudo,
        motivo: `${formatMinutoSegundo(videoTimeSec)} fica depois do fim do video`,
      });
      return;
    }

    const chave = `${authorName.toLowerCase()}|${videoTimeSec}|${body.toLowerCase()}`;
    if (jaExiste.has(chave)) {
      ignoradas.push({ numero, original: conteudo, motivo: "ja estava no roteiro, igualzinho" });
      return;
    }
    jaExiste.add(chave);

    aGravar.push({ authorName, body, videoTimeSec });
  });

  if (aGravar.length > 0) {
    await db.chatMessage.createMany({
      data: aGravar.map((m) => ({ ...m, webinarId, kind: "FAKE" as const, status: "APPROVED" as const })),
    });
  }

  revalidatePath(`/painel/w/${webinarId}/roteiro`);
  return { gravadas: aGravar.length, ignoradas };
}

export async function editarComentario(
  _prev: EstadoRoteiro,
  formData: FormData,
): Promise<EstadoRoteiro> {
  await exigirAdmin();

  const id = texto(formData.get("id"));
  const authorName = texto(formData.get("authorName"));
  const body = texto(formData.get("body"));
  const videoTimeSec = parseTempo(texto(formData.get("tempo")));

  if (!authorName || !body) return { erro: "Nome e comentario nao podem ficar vazios." };
  if (videoTimeSec === null || videoTimeSec < 0) return { erro: "Tempo invalido." };

  const atual = await db.chatMessage.findUnique({ where: { id }, select: { webinarId: true } });
  if (!atual) return { erro: "Esse comentario nao existe mais." };

  const duracao = await duracaoDe(atual.webinarId);
  if (duracao && videoTimeSec >= duracao) {
    return { erro: "Esse ponto fica depois do fim do video." };
  }

  await db.chatMessage.update({ where: { id }, data: { authorName, body, videoTimeSec } });
  revalidatePath(`/painel/w/${atual.webinarId}/roteiro`);
  return { ok: "Alterado." };
}

export async function removerComentario(id: string): Promise<void> {
  await exigirAdmin();
  const m = await db.chatMessage.findUnique({ where: { id }, select: { webinarId: true } });
  if (!m) return;
  await db.chatMessage.delete({ where: { id } }).catch(() => null);
  revalidatePath(`/painel/w/${m.webinarId}/roteiro`);
}
