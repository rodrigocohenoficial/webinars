/**
 * Semeia um webinário e uma sessão em qualquer ponto do tempo, para os
 * testes de fumaça poderem olhar a sala em qualquer fase sem esperar.
 *
 *   node smoke/semear.mjs --minutos 12    (sessão começou há 12 minutos)
 *   node smoke/semear.mjs --minutos -5    (começa em 5 minutos)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const arg = (nome, padrao) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : padrao;
};

const minutos = Number(arg("minutos", "12"));
const slug = arg("slug", "sala-teste");
const token = arg("token", "sala-teste-token");
const duracao = Number(arg("duracao", String(48 * 60 + 30)));
const janela = Number(arg("janela", "0"));
const espera = arg("espera", null);
const comRegra = process.argv.includes("--com-regra");
const limpar = process.argv.includes("--limpar");
const ofertaEm = arg("oferta-em", null);
const ofertaAte = arg("oferta-ate", null);

const webinar = await db.webinar.upsert({
  where: { slug },
  update: {
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    durationSec: duracao,
    published: true,
    joinWindowMin: janela,
    waitingVideoUrl: espera,
    aspectRatio: "16/9",
    ...(ofertaEm
      ? {
          ctaLabel: "Quero minha vaga",
          ctaUrl: "https://tradernation.com.br/oferta",
          ctaDescription: "As vagas desta turma abrem agora.",
          ctaAtSec: Number(ofertaEm),
          ctaUntilSec: ofertaAte ? Number(ofertaAte) : null,
        }
      : {}),
  },
  create: {
    slug,
    title: "O robô que opera sozinho",
    hostName: "Rodrigo Cohen",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    durationSec: duracao,
    joinWindowMin: janela,
    waitingVideoUrl: espera,
    published: true,
    ...(ofertaEm
      ? {
          ctaLabel: "Quero minha vaga",
          ctaUrl: "https://tradernation.com.br/oferta",
          ctaDescription: "As vagas desta turma abrem agora.",
          ctaAtSec: Number(ofertaEm),
          ctaUntilSec: ofertaAte ? Number(ofertaAte) : null,
        }
      : {}),
  },
});

if (comRegra) {
  const jaTem = await db.scheduleRule.findFirst({ where: { webinarId: webinar.id } });
  if (!jaTem) {
    await db.scheduleRule.create({
      data: { webinarId: webinar.id, daysOfWeek: "0,1,2,3,4,5,6", timeOfDay: "23:50" },
    });
  }
}

if (limpar) {
  await db.chatMessage.deleteMany({ where: { webinarId: webinar.id } });
  await db.poll.deleteMany({ where: { webinarId: webinar.id } });
}

const startsAt = new Date(Date.now() - minutos * 60000);
const sessao = await db.session.create({
  data: { webinarId: webinar.id, startsAt, ruleKey: `teste:${Date.now()}`, kind: "SCHEDULED" },
});

await db.registration.deleteMany({ where: { token } });
await db.registration.create({
  data: { sessionId: sessao.id, name: "Participante Teste", email: "teste@teste.com", token },
});

console.log(JSON.stringify({ slug, token, webinarId: webinar.id, sessaoId: sessao.id, startsAt: startsAt.toISOString(), duracao }));
await db.$disconnect();
