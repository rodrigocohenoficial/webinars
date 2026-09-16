"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/admin";
import { parseTempo, formatMinutoSegundo } from "@/lib/time";
import { normalizarTexto, texto } from "@/lib/texto";

export type EstadoEnquete = { erro?: string; ok?: string };

export async function criarEnquete(
  _prev: EstadoEnquete,
  formData: FormData,
): Promise<EstadoEnquete> {
  await exigirAdmin();

  const webinarId = texto(formData.get("webinarId"));
  const question = texto(formData.get("question"));
  const atSec = parseTempo(texto(formData.get("atSec")));
  const untilSec = parseTempo(texto(formData.get("untilSec")));

  // Armadilha 9.8: a caixa de texto manda \r\n, e quem separa linha procura \n.
  const opcoes = normalizarTexto(String(formData.get("opcoes") ?? ""))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!question) return { erro: "Falta a pergunta." };
  if (atSec === null || atSec < 0) return { erro: "Diga em que ponto do video a enquete entra." };
  if (opcoes.length < 2) return { erro: "Uma enquete precisa de pelo menos duas opcoes." };
  if (opcoes.length > 8) return { erro: "Ate oito opcoes." };
  if (untilSec !== null && untilSec <= atSec) return { erro: "A enquete sai antes de entrar." };

  const w = await db.webinar.findUnique({ where: { id: webinarId }, select: { durationSec: true } });
  if (w?.durationSec && atSec >= w.durationSec) {
    return { erro: `${formatMinutoSegundo(atSec)} fica depois do fim do video. Ninguem veria.` };
  }

  await db.poll.create({
    data: {
      webinarId,
      question,
      atSec,
      untilSec,
      options: { create: opcoes.map((label, order) => ({ label, order })) },
    },
  });

  revalidatePath(`/painel/w/${webinarId}/enquetes`);
  return { ok: `Enquete gravada para ${formatMinutoSegundo(atSec)}.` };
}

export async function removerEnquete(id: string): Promise<void> {
  await exigirAdmin();
  const p = await db.poll.findUnique({ where: { id }, select: { webinarId: true } });
  if (!p) return;
  await db.poll.delete({ where: { id } }).catch(() => null);
  revalidatePath(`/painel/w/${p.webinarId}/enquetes`);
}
