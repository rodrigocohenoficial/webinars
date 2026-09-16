"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { novoToken } from "@/lib/auth";
import { acharSlotPermitido, slotJit } from "@/lib/schedule";
import { emailValido, texto, textoOuNulo } from "@/lib/texto";
import { normalizarTelefoneBR } from "@/lib/phone";
import { enviarConfirmacao } from "@/lib/avisos";

export type EstadoInscricao = { erro?: string };

export async function inscrever(
  _prev: EstadoInscricao,
  formData: FormData,
): Promise<EstadoInscricao> {
  const slug = texto(formData.get("slug"));
  const nome = texto(formData.get("name"));
  const email = texto(formData.get("email")).toLowerCase();
  const escolha = texto(formData.get("slot"));

  if (!nome) return { erro: "Diga seu nome." };
  if (!emailValido(email)) return { erro: "Confira o e-mail." };
  if (!escolha) return { erro: "Escolha um horario." };

  const webinar = await db.webinar.findUnique({
    where: { slug },
    include: { rules: true },
  });
  if (!webinar || !webinar.published) {
    return { erro: "Este webinario nao esta com inscricoes abertas." };
  }

  const agora = new Date();

  // ── Passo 4 da secao 4.1 / regra 5.3 ──────────────────────────────────
  // O servidor recalcula os horarios permitidos e exige coincidencia exata.
  // Sem isto, da para forjar uma sessao em qualquer hora do dia mandando
  // outro timestamp. O horario do JIT o cliente nem manda: o servidor
  // calcula sozinho.
  let startsAt: Date;
  let ruleKey: string;
  let kind: "SCHEDULED" | "JIT";

  if (escolha === "jit") {
    if (!webinar.jitEnabled) return { erro: "Escolha um dos horarios da lista." };
    const slot = slotJit(agora, webinar.jitDelayMin);
    startsAt = slot.startsAt;
    ruleKey = slot.ruleKey;
    kind = "JIT";
  } else {
    const slot = acharSlotPermitido(webinar.rules, agora, Number(escolha));
    if (!slot) {
      return { erro: "Esse horario nao esta mais disponivel. Escolha outro da lista." };
    }
    startsAt = slot.startsAt;
    ruleKey = slot.ruleKey;
    kind = "SCHEDULED";
  }

  // Uma sessao por (webinario, horario, origem): duas pessoas do mesmo
  // horario caem na mesma sala, que e o ponto do sistema inteiro.
  const sessao = await db.session.upsert({
    where: { webinarId_startsAt_ruleKey: { webinarId: webinar.id, startsAt, ruleKey } },
    create: { webinarId: webinar.id, startsAt, ruleKey, kind },
    update: {},
    select: { id: true },
  });

  // Mesmo e-mail no mesmo horario devolve o link existente, nao duplica.
  const existente = await db.registration.findFirst({
    where: { sessionId: sessao.id, email, isHost: false },
    select: { token: true },
  });
  if (existente) redirect(`/obrigado/${existente.token}`);

  const inscricao = await db.registration.create({
    data: {
      sessionId: sessao.id,
      name: nome,
      email,
      phone: normalizarTelefoneBR(texto(formData.get("phone"))),
      token: novoToken(),
      utmSource: textoOuNulo(formData.get("utmSource")),
      utmMedium: textoOuNulo(formData.get("utmMedium")),
      utmCampaign: textoOuNulo(formData.get("utmCampaign")),
      referrer: textoOuNulo(formData.get("referrer")),
    },
    select: { id: true, token: true },
  });

  // Confirmacao sai na hora, pelos dois canais. Falha de envio nunca derruba
  // a inscricao: a vaga ja esta gravada.
  try {
    await enviarConfirmacao(inscricao.id);
  } catch {
    // nenhum canal e obrigatorio para a pessoa ter vaga
  }

  redirect(`/obrigado/${inscricao.token}`);
}
