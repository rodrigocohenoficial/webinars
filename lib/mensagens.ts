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

/**
 * Quem se inscreve digita o nome como quiser — e muita gente digita em caixa
 * alta. "Oi, RODRIGO" grita. Ajustamos so quando o nome vem todo maiusculo
 * ou todo minusculo; se a pessoa escreveu "Ana Julia" ou "d'Avila", fica como
 * ela escreveu.
 */
function primeiroNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  if (!primeiro) return "";
  const gritando = primeiro === primeiro.toUpperCase();
  const sussurrando = primeiro === primeiro.toLowerCase();
  if (!gritando && !sussurrando) return primeiro;
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

/**
 * Quem se inscreve com menos que isto de antecedencia nao recebe lembrete —
 * seria spam. Entao a confirmacao tambem nao pode prometer lembrete: quando
 * a sessao comeca em 10 minutos, "mando um lembrete 15 minutos antes" e
 * mentira, e o lembrete de fato nao sai.
 */
export const ANTECEDENCIA_PARA_LEMBRETE_MIN = 20;

function vaiTerLembrete(inicio: Date): boolean {
  return inicio.getTime() - Date.now() >= ANTECEDENCIA_PARA_LEMBRETE_MIN * 60000;
}

function minutosAte(inicio: Date): number {
  return Math.max(1, Math.round((inicio.getTime() - Date.now()) / 60000));
}

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
      <p style="margin:0 0 16px;">Sua vaga em <strong>${c.titulo}</strong> esta confirmada.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;background:#f4f7f5;border-left:3px solid #12b76a;border-radius:0 8px 8px 0;">
        <tr><td style="padding:14px 16px;">
          <p style="margin:0 0 3px;color:#667085;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">Anote ai</p>
          <p style="margin:0;font-size:17px;font-weight:600;color:#14181f;">${formatSlotLongo(c.inicio)}</p>
          <p style="margin:3px 0 0;color:#667085;font-size:13px;">horario de Brasilia</p>
        </td></tr>
      </table>

      <p style="margin:0 0 20px;">Guarde este link. Ele e so seu, e abre a sala na hora marcada.</p>
      <p style="margin:0 0 22px;">${botao(c.link, "Abrir minha sala")}</p>
      <p style="margin:0;color:#667085;font-size:13px;">${
        vaiTerLembrete(c.inicio)
          ? "Mando um lembrete 15 minutos antes."
          : `Comeca em ${minutosAte(c.inicio)} minutos. Deixe a pagina aberta: ela comeca sozinha.`
      }</p>
    `),

  whatsapp: (c: Contexto) =>
    `Oi, ${primeiroNome(c.nome)}. Sua vaga em *${c.titulo}* esta confirmada.\n\n` +
    `Anote ai:\n*${formatSlotLongo(c.inicio)}*\n(horario de Brasilia)\n\n` +
    `Este link e so seu e abre a sala na hora:\n${c.link}\n\n` +
    (vaiTerLembrete(c.inicio)
      ? "Mando um lembrete 15 minutos antes."
      : `Comeca em ${minutosAte(c.inicio)} minutos. Deixe a pagina aberta: ela comeca sozinha.`),
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
