"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { novoToken } from "@/lib/auth";
import { acharSlotPermitido, slotJit } from "@/lib/schedule";
import { texto } from "@/lib/texto";

export type EstadoReinscricao = { erro?: string };

/**
 * Reinscricao em um clique, para quem chegou depois da janela de entrada ou
 * caiu numa sessao ja encerrada. Reaproveita nome, e-mail e telefone — a
 * pessoa ja deu esses dados uma vez.
 *
 * O horario continua sendo revalidado no servidor (regra 5.3): estar
 * logado num token nao autoriza forjar sessao nenhuma.
 */
export async function reinscrever(
  _prev: EstadoReinscricao,
  formData: FormData,
): Promise<EstadoReinscricao> {
  const token = texto(formData.get("token"));
  const escolha = texto(formData.get("slot"));

  const original = await db.registration.findUnique({
    where: { token },
    include: { session: { include: { webinar: { include: { rules: true } } } } },
  });
  if (!original) return { erro: "Nao encontrei sua inscricao." };

  const w = original.session.webinar;
  if (!w.published) return { erro: "Este webinario nao esta com inscricoes abertas." };

  const agora = new Date();
  let startsAt: Date;
  let ruleKey: string;
  let kind: "SCHEDULED" | "JIT";

  if (escolha === "jit") {
    if (!w.jitEnabled) return { erro: "Escolha um dos horarios da lista." };
    const slot = slotJit(agora, w.jitDelayMin);
    startsAt = slot.startsAt;
    ruleKey = slot.ruleKey;
    kind = "JIT";
  } else {
    const slot = acharSlotPermitido(w.rules, agora, Number(escolha));
    if (!slot) return { erro: "Esse horario nao esta mais disponivel. Escolha outro." };
    startsAt = slot.startsAt;
    ruleKey = slot.ruleKey;
    kind = "SCHEDULED";
  }

  const sessao = await db.session.upsert({
    where: { webinarId_startsAt_ruleKey: { webinarId: w.id, startsAt, ruleKey } },
    create: { webinarId: w.id, startsAt, ruleKey, kind },
    update: {},
    select: { id: true },
  });

  const existente = await db.registration.findFirst({
    where: { sessionId: sessao.id, email: original.email, isHost: false },
    select: { token: true },
  });
  if (existente) redirect(`/obrigado/${existente.token}`);

  const nova = await db.registration.create({
    data: {
      sessionId: sessao.id,
      name: original.name,
      email: original.email,
      phone: original.phone,
      token: novoToken(),
      utmSource: original.utmSource,
      utmMedium: original.utmMedium,
      utmCampaign: original.utmCampaign,
      referrer: original.referrer,
    },
    select: { token: true },
  });

  redirect(`/obrigado/${nova.token}`);
}
