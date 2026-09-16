import { formatSlotLongo } from "./time";

/**
 * O que a pessoa recebe. Regra 5.6 tambem vale aqui: nenhuma mensagem diz
 * video, gravacao, replay nem "ao vivo". Diz webinario online, que e verdade.
 */

export type Contexto = {
  nome: string;
  titulo: string;
  inicio: Date;
  link: string;
  apresentador?: string | null;
};

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0];

function moldura(corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:28px 26px;color:#14181f;font-size:15px;line-height:1.6;">
      ${corpo}
    </td></tr>
  </table>
  <p style="max-width:520px;margin:14px auto 0;color:#8a94a3;font-size:12px;line-height:1.5;text-align:center;">
    Voce recebeu este e-mail porque reservou uma vaga.
  </p>
</body></html>`;
}

function botao(link: string, texto: string): string {
  return `<a href="${link}" style="display:inline-block;background:#12b76a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:9px;">${texto}</a>`;
}

export const confirmacao = {
  assunto: (c: Contexto) => `Sua vaga esta confirmada — ${c.titulo}`,
  html: (c: Contexto) =>
    moldura(`
      <p style="margin:0 0 14px;font-size:19px;font-weight:600;">Pronto, ${primeiroNome(c.nome)}.</p>
      <p style="margin:0 0 6px;">Sua vaga em <strong>${c.titulo}</strong> esta confirmada.</p>
      <p style="margin:0 0 20px;"><strong>${formatSlotLongo(c.inicio)}</strong></p>
      <p style="margin:0 0 20px;">Guarde este link. Ele e so seu, e abre a sala na hora marcada.</p>
      <p style="margin:0 0 22px;">${botao(c.link, "Abrir minha sala")}</p>
      <p style="margin:0;color:#667085;font-size:13px;">Mando um lembrete 15 minutos antes.</p>
    `),
  whatsapp: (c: Contexto) =>
    `Oi, ${primeiroNome(c.nome)}. Sua vaga em *${c.titulo}* esta confirmada.\n\n` +
    `${formatSlotLongo(c.inicio)}\n\n` +
    `Este link e so seu e abre a sala na hora:\n${c.link}\n\n` +
    `Mando um lembrete 15 minutos antes.`,
};

export const lembrete = {
  assunto: (c: Contexto) => `Comeca em 15 minutos — ${c.titulo}`,
  html: (c: Contexto) =>
    moldura(`
      <p style="margin:0 0 14px;font-size:19px;font-weight:600;">Faltam 15 minutos.</p>
      <p style="margin:0 0 20px;"><strong>${c.titulo}</strong><br>${formatSlotLongo(c.inicio)}</p>
      <p style="margin:0 0 22px;">${botao(c.link, "Entrar na sala")}</p>
      <p style="margin:0;color:#667085;font-size:13px;">Deixe a pagina aberta: ela comeca sozinha.</p>
    `),
  whatsapp: (c: Contexto) =>
    `${primeiroNome(c.nome)}, faltam 15 minutos para *${c.titulo}*.\n\n` +
    `Seu link:\n${c.link}\n\n` +
    `Deixe a pagina aberta. Ela comeca sozinha.`,
};

export const comecou = {
  assunto: (c: Contexto) => `Comecou agora — ${c.titulo}`,
  html: (c: Contexto) =>
    moldura(`
      <p style="margin:0 0 14px;font-size:19px;font-weight:600;">Comecou agora.</p>
      <p style="margin:0 0 22px;"><strong>${c.titulo}</strong></p>
      <p style="margin:0 0 22px;">${botao(c.link, "Entrar agora")}</p>
    `),
  whatsapp: (c: Contexto) => `Comecou agora: *${c.titulo}*\n\nEntre por aqui:\n${c.link}`,
};

export const convite = {
  assunto: (c: Contexto) => `Voce perdeu, mas da para remarcar — ${c.titulo}`,
  html: (c: Contexto) =>
    moldura(`
      <p style="margin:0 0 14px;font-size:19px;font-weight:600;">Senti sua falta, ${primeiroNome(c.nome)}.</p>
      <p style="margin:0 0 20px;">Voce reservou vaga em <strong>${c.titulo}</strong> e nao conseguiu entrar.</p>
      <p style="margin:0 0 22px;">Escolha outro horario em um clique:</p>
      <p style="margin:0 0 22px;">${botao(c.link, "Escolher outro horario")}</p>
    `),
  whatsapp: (c: Contexto) =>
    `${primeiroNome(c.nome)}, voce reservou vaga em *${c.titulo}* e nao conseguiu entrar.\n\n` +
    `Escolha outro horario em um clique:\n${c.link}`,
};
