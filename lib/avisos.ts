import { db } from "./db";
import { enviarEmail } from "./mail";
import { enviarWhatsapp } from "./whatsapp";
import {
  ANTECEDENCIA_PARA_LEMBRETE_MIN,
  comecou,
  confirmacao,
  convite,
  lembrete,
  type Contexto,
} from "./mensagens";

/**
 * Os quatro momentos da secao 4.2.
 *
 * A trava contra reenvio sao os carimbos de data no proprio inscrito, nunca a
 * frequencia do agendador. O agendador so define a precisao do "minuto zero" —
 * trocar de uma vez por minuto para uma vez a cada dez nao reenvia nada.
 */

/** O lembrete pega sessoes que comecam nos proximos 16 minutos. */
const JANELA_LEMBRETE_MIN = 16;

/**
 * O aviso de inicio pega da virada ate 4 minutos depois. A folga cobre atraso
 * do agendador; dizer "comecou agora" antes da hora seria falso.
 */
const ATRASO_TOLERADO_INICIO_MIN = 4;

/** O convite de replay tem piso e teto: entre 1h e 6h depois do fim. */
const CONVITE_DEPOIS_DE_H = 1;
/**
 * Sem o teto, ligar a rotina dispara convite para todo no-show historico do
 * banco de uma vez so.
 */
const CONVITE_ATE_H = 6;

const LOTE = 200;

export type Resultado = {
  lembretes: number;
  inicios: number;
  convites: number;
  semEnvio: number;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

/** Webinario sem video publicado nao dispara aviso nenhum: levaria a pessoa a um quadro vazio. */
const WEBINAR_PRONTO = {
  published: true,
  videoUrl: { not: null },
  durationSec: { not: null },
} as const;

type InscricaoComSessao = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  token: string;
  session: { startsAt: Date; webinar: { title: string; hostName: string | null } };
};

function contexto(i: InscricaoComSessao, caminho: "sala" | "replay"): Contexto {
  return {
    nome: i.name,
    titulo: i.session.webinar.title,
    inicio: i.session.startsAt,
    apresentador: i.session.webinar.hostName,
    link: `${siteUrl()}/${caminho}/${i.token}`,
  };
}

/**
 * Manda pelos dois canais. Um canal entregue ja cumpre o aviso — se os dois
 * falharem, nao carimbamos e a proxima passagem tenta de novo.
 */
async function mandarPelosDois(
  i: InscricaoComSessao,
  ctx: Contexto,
  modelo: {
    assunto: (c: Contexto) => string;
    html: (c: Contexto) => string;
    whatsapp: (c: Contexto) => string;
  },
): Promise<{ entregue: boolean; whatsappId?: string }> {
  const [email, zap] = await Promise.all([
    enviarEmail({ para: i.email, assunto: modelo.assunto(ctx), html: modelo.html(ctx) }),
    i.phone
      ? enviarWhatsapp(i.phone, modelo.whatsapp(ctx))
      : Promise.resolve<{ ok: boolean; id?: string }>({ ok: false }),
  ]);
  return { entregue: email || zap.ok, whatsappId: zap.ok ? zap.id : undefined };
}

const SELECAO = {
  id: true,
  name: true,
  email: true,
  phone: true,
  token: true,
  session: { select: { startsAt: true, webinar: { select: { title: true, hostName: true } } } },
} as const;

/** Momento 1: na inscricao. Chamado direto pela acao de inscrever. */
export async function enviarConfirmacao(registrationId: string): Promise<void> {
  const i = await db.registration.findUnique({
    where: { id: registrationId },
    select: { ...SELECAO, confirmationSentAt: true, session: { select: { startsAt: true, webinar: { select: { title: true, hostName: true, published: true, videoUrl: true, durationSec: true } } } } },
  });
  if (!i || i.confirmationSentAt) return;

  const w = i.session.webinar;
  if (!w.published || !w.videoUrl || !w.durationSec) return;

  const dados = i as unknown as InscricaoComSessao;
  const r = await mandarPelosDois(dados, contexto(dados, "sala"), confirmacao);
  if (!r.entregue) return;

  await db.registration.update({
    where: { id: registrationId },
    data: {
      confirmationSentAt: new Date(),
      ...(r.whatsappId ? { whatsappSentAt: new Date(), whatsappSentId: r.whatsappId } : {}),
    },
  });
}

/** Momento 2: 15 minutos antes. */
async function lembretes(agora: Date): Promise<{ enviados: number; pulados: number }> {
  const limite = new Date(agora.getTime() + JANELA_LEMBRETE_MIN * 60000);

  const pendentes = await db.registration.findMany({
    where: {
      isHost: false,
      reminderSentAt: null,
      session: {
        startsAt: { gt: agora, lte: limite },
        webinar: WEBINAR_PRONTO,
      },
    },
    take: LOTE,
    select: { ...SELECAO, createdAt: true },
  });

  let enviados = 0;
  let pulados = 0;

  for (const i of pendentes) {
    const antecedenciaMs = i.session.startsAt.getTime() - i.createdAt.getTime();

    // Inscricao de ultima hora nao recebe lembrete: seria spam. Mas o carimbo
    // e gravado assim mesmo, senao o registro e reavaliado a cada minuto para
    // sempre.
    if (antecedenciaMs < ANTECEDENCIA_PARA_LEMBRETE_MIN * 60000) {
      await db.registration.update({ where: { id: i.id }, data: { reminderSentAt: agora } });
      pulados += 1;
      continue;
    }

    const dados = i as unknown as InscricaoComSessao;
    const r = await mandarPelosDois(dados, contexto(dados, "sala"), lembrete);
    if (!r.entregue) continue;

    await db.registration.update({
      where: { id: i.id },
      data: {
        reminderSentAt: new Date(),
        ...(r.whatsappId ? { whatsappReminderAt: new Date(), whatsappReminderId: r.whatsappId } : {}),
      },
    });
    enviados += 1;
  }

  return { enviados, pulados };
}

/** Momento 3: no minuto do inicio. */
async function avisosDeInicio(agora: Date): Promise<number> {
  const desde = new Date(agora.getTime() - ATRASO_TOLERADO_INICIO_MIN * 60000);

  const pendentes = await db.registration.findMany({
    where: {
      isHost: false,
      startNoticeSentAt: null,
      session: {
        startsAt: { gte: desde, lte: agora },
        webinar: WEBINAR_PRONTO,
      },
    },
    take: LOTE,
    select: SELECAO,
  });

  let enviados = 0;
  for (const i of pendentes) {
    const dados = i as unknown as InscricaoComSessao;
    const r = await mandarPelosDois(dados, contexto(dados, "sala"), comecou);
    if (!r.entregue) continue;
    await db.registration.update({
      where: { id: i.id },
      data: { startNoticeSentAt: new Date() },
    });
    enviados += 1;
  }
  return enviados;
}

/** Momento 4: 1 hora depois do fim, so para quem nunca entrou na sala. */
async function convitesDeReplay(agora: Date): Promise<number> {
  // A duracao varia por webinario, entao filtramos por sessao e conferimos o
  // fim em memoria — o intervalo de sessoes candidatas ja e pequeno.
  const webinarios = await db.webinar.findMany({
    where: WEBINAR_PRONTO,
    select: { id: true, durationSec: true },
  });
  if (webinarios.length === 0) return 0;

  let enviados = 0;

  for (const w of webinarios) {
    const duracaoMs = (w.durationSec ?? 0) * 1000;
    const inicioMin = new Date(agora.getTime() - CONVITE_ATE_H * 3600000 - duracaoMs);
    const inicioMax = new Date(agora.getTime() - CONVITE_DEPOIS_DE_H * 3600000 - duracaoMs);
    if (inicioMax <= inicioMin) continue;

    const pendentes = await db.registration.findMany({
      where: {
        isHost: false,
        replaySentAt: null,
        firstSeenAt: null, // so para quem nunca entrou na sala
        session: { webinarId: w.id, startsAt: { gte: inicioMin, lte: inicioMax } },
      },
      take: LOTE,
      select: SELECAO,
    });

    for (const i of pendentes) {
      const dados = i as unknown as InscricaoComSessao;
      const r = await mandarPelosDois(dados, contexto(dados, "replay"), convite);
      if (!r.entregue) continue;
      await db.registration.update({ where: { id: i.id }, data: { replaySentAt: new Date() } });
      enviados += 1;
    }
  }

  return enviados;
}

export async function rodarAvisos(agora = new Date()): Promise<Resultado> {
  const [l, inicios, convites] = [await lembretes(agora), await avisosDeInicio(agora), await convitesDeReplay(agora)];
  return { lembretes: l.enviados, inicios, convites, semEnvio: l.pulados };
}
