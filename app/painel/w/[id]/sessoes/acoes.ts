"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/admin";
import { novoToken } from "@/lib/auth";

/**
 * Voce entrando na propria sala.
 *
 * Cria uma inscricao marcada como isHost e manda para exatamente a mesma
 * tela que os participantes veem. Interface paralela para o apresentador
 * dobraria o trabalho de toda alteracao futura.
 *
 * O registro isHost fica fora de toda metrica e de toda lista (9.11), senao
 * voce infla o proprio comparecimento e a propria retencao.
 */
export async function entrarNaSala(sessionId: string): Promise<void> {
  await exigirAdmin();

  const existente = await db.registration.findFirst({
    where: { sessionId, isHost: true },
    select: { token: true },
  });
  if (existente) redirect(`/sala/${existente.token}`);

  const sessao = await db.session.findUnique({
    where: { id: sessionId },
    select: { id: true, webinar: { select: { hostName: true } } },
  });
  if (!sessao) redirect("/painel");

  const nova = await db.registration.create({
    data: {
      sessionId: sessao.id,
      name: sessao.webinar.hostName ?? "Apresentador",
      email: "apresentador@local",
      token: novoToken(),
      isHost: true,
    },
    select: { token: true },
  });

  redirect(`/sala/${nova.token}`);
}
