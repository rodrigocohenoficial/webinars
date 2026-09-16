import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/**
 * Um administrador so, uma senha, cookie assinado. Nao ha tabela de usuario
 * de proposito: o sistema tem um dono.
 */

export const ADMIN_COOKIE = "painel";
const DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

function segredo(): string {
  return process.env.AUTH_SECRET || "sem-segredo-configurado";
}

function assinar(payload: string): string {
  return createHmac("sha256", segredo()).update(payload).digest("base64url");
}

/** Comparacao que nao vaza tempo, para senha e para assinatura. */
function igual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function senhaConfere(senha: string): boolean {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) return false;
  return igual(senha, esperada);
}

export function criarCookieAdmin(): { value: string; maxAge: number } {
  const expira = Date.now() + DURACAO_MS;
  const payload = `${expira}.${randomBytes(9).toString("base64url")}`;
  return {
    value: `${payload}.${assinar(payload)}`,
    maxAge: Math.floor(DURACAO_MS / 1000),
  };
}

export function cookieAdminValido(value: string | undefined | null): boolean {
  if (!value) return false;
  const corte = value.lastIndexOf(".");
  if (corte < 1) return false;
  const payload = value.slice(0, corte);
  const assinatura = value.slice(corte + 1);
  if (!igual(assinatura, assinar(payload))) return false;
  const expira = Number(payload.split(".")[0]);
  return Number.isFinite(expira) && expira > Date.now();
}

/** Token de participante: o link e a credencial, entao ele precisa ser largo. */
export function novoToken(): string {
  return randomBytes(24).toString("base64url");
}

export function cronSecretConfere(recebido: string | null): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  if (!recebido) return false;
  return igual(recebido, esperado);
}
