/**
 * Regra 5.5: fuso horario explicito, num modulo so.
 *
 * O Brasil nao tem horario de verao desde 2019 e a biblioteca de datas do
 * sistema pode nao saber disso. Entao nao perguntamos a ninguem: o
 * deslocamento e fixo em UTC-3 e toda conversao passa por aqui.
 *
 * Nada no resto do codigo deve chamar getHours(), getDay() ou
 * toLocaleString() com fuso. Se precisar de hora local, e aqui.
 */

export const OFFSET_MINUTES = -180; // America/Sao_Paulo, fixo
const OFFSET_MS = OFFSET_MINUTES * 60 * 1000;

export type LocalParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  dayOfWeek: number; // 0 = domingo ... 6 = sabado
};

/** Instante (UTC) -> partes no fuso do sistema. */
export function toLocal(date: Date): LocalParts {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

/** Partes no fuso do sistema -> instante (UTC). */
export function fromLocal(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - OFFSET_MS);
}

/** Meia-noite local do dia em que o instante cai. */
export function startOfLocalDay(date: Date): Date {
  const p = toLocal(date);
  return fromLocal(p.year, p.month, p.day, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/** "20:00" -> { hour: 20, minute: 0 }. Devolve null se estiver malformado. */
export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const DIAS_LONGOS = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado",
];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "20:00" */
export function formatHora(date: Date): string {
  const p = toLocal(date);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "16/09" */
export function formatDia(date: Date): string {
  const p = toLocal(date);
  return `${pad2(p.day)}/${pad2(p.month)}`;
}

/** "ter, 16/09 as 20:00" */
export function formatSlot(date: Date): string {
  const p = toLocal(date);
  return `${DIAS_CURTOS[p.dayOfWeek]}, ${pad2(p.day)}/${pad2(p.month)} as ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** "quinta-feira, 16 de setembro as 20:00" */
const MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatSlotLongo(date: Date): string {
  const p = toLocal(date);
  return `${DIAS_LONGOS[p.dayOfWeek]}, ${p.day} de ${MESES[p.month - 1]} as ${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function nomeDoDia(dayOfWeek: number): string {
  return DIAS_LONGOS[dayOfWeek] ?? String(dayOfWeek);
}

export function nomeCurtoDoDia(dayOfWeek: number): string {
  return DIAS_CURTOS[dayOfWeek] ?? String(dayOfWeek);
}

/** Formato do .ics e de qualquer coisa que precise de UTC cru: 20260916T230000Z */
export function toIcsUtc(date: Date): string {
  const s = date.toISOString();
  return `${s.slice(0, 4)}${s.slice(5, 7)}${s.slice(8, 10)}T${s.slice(11, 13)}${s.slice(14, 16)}${s.slice(17, 19)}Z`;
}

/** "1h 12min", "12min", "48s" — para durações na interface. */
export function formatDuracao(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

/** "12:34" a partir de um ponto do vídeo em segundos. */
export function formatMinutoSegundo(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(rest)}`;
  return `${m}:${pad2(rest)}`;
}

/**
 * Aceita "90", "1:30", "01:30:00" e devolve segundos. Null quando nao da
 * para ler — quem chama decide se isso e erro ou campo vazio.
 */
export function parseTempo(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  const partes = v.split(":");
  if (partes.length < 2 || partes.length > 3) return null;
  if (!partes.every((p) => /^\d{1,2}$/.test(p.trim()))) return null;
  const n = partes.map((p) => Number(p.trim()));
  const total = partes.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
  return Number.isFinite(total) ? total : null;
}
