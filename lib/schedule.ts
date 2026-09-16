import { addDays, fromLocal, parseTimeOfDay, startOfLocalDay, toLocal, formatSlot } from "./time";

/**
 * Armadilha 9.1: nao materialize sessoes que ninguem pediu.
 *
 * Os horarios sao calculados na memoria a partir das regras. Nada e gravado
 * ate alguem se inscrever. Este modulo e a unica fonte de verdade sobre que
 * horarios existem — a pagina de inscricao usa ele para mostrar, e o
 * servidor usa ele de novo para validar (regra 5.3).
 */

export type RuleLike = {
  daysOfWeek: string;
  timeOfDay: string;
  active: boolean;
};

export type Slot = {
  startsAt: Date;
  ruleKey: string;
  label: string;
};

/** Quanto tempo a frente a grade existe, para gerar e para validar. */
export const HORIZONTE_DIAS = 30;

/** Um horario que comeca em menos que isso nao e mais oferecido. */
export const ANTECEDENCIA_MINIMA_MIN = 2;

export function parseDaysOfWeek(value: string): number[] {
  return value
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/**
 * A identidade da origem do horario. Nao usamos o id da regra de proposito:
 * assim, editar a regra sem mudar dia e hora mantem as inscricoes na mesma
 * sessao em vez de rachar o publico em duas salas.
 */
export function ruleKeyDe(dayOfWeek: number, timeOfDay: string): string {
  return `${dayOfWeek}|${timeOfDay}`;
}

/**
 * Todos os horarios da grade dentro do horizonte, em ordem.
 * Nao corta pela quantidade: quem corta e quem exibe.
 */
export function gerarSlots(rules: RuleLike[], now: Date): Slot[] {
  const ativas = rules.filter((r) => r.active);
  if (ativas.length === 0) return [];

  const minimo = now.getTime() + ANTECEDENCIA_MINIMA_MIN * 60000;
  const primeiroDia = startOfLocalDay(now);
  const vistos = new Set<string>();
  const slots: Slot[] = [];

  for (let i = 0; i <= HORIZONTE_DIAS; i++) {
    const dia = addDays(primeiroDia, i);
    const p = toLocal(dia);

    for (const rule of ativas) {
      const hora = parseTimeOfDay(rule.timeOfDay);
      if (!hora) continue;
      if (!parseDaysOfWeek(rule.daysOfWeek).includes(p.dayOfWeek)) continue;

      const startsAt = fromLocal(p.year, p.month, p.day, hora.hour, hora.minute);
      if (startsAt.getTime() < minimo) continue;

      const ruleKey = ruleKeyDe(p.dayOfWeek, rule.timeOfDay);
      const chave = `${startsAt.getTime()}|${ruleKey}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      slots.push({ startsAt, ruleKey, label: formatSlot(startsAt) });
    }
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return slots;
}

/** Os primeiros N horarios, que e o que a pagina de inscricao mostra. */
export function proximosSlots(rules: RuleLike[], now: Date, quantidade: number): Slot[] {
  return gerarSlots(rules, now).slice(0, Math.max(0, quantidade));
}

/**
 * Regra 5.3 / passo 4 da secao 4.1: o horario escolhido e revalidado aqui.
 *
 * Validamos contra o horizonte inteiro, nao contra os N visiveis: a pagina
 * pode ter ficado aberta e a lista andado. Mas a coincidencia e exata, entao
 * mandar outro timestamp nao forja sessao nenhuma.
 */
export function acharSlotPermitido(
  rules: RuleLike[],
  now: Date,
  startsAtMs: number,
): Slot | null {
  if (!Number.isFinite(startsAtMs)) return null;
  return gerarSlots(rules, now).find((s) => s.startsAt.getTime() === startsAtMs) ?? null;
}

/**
 * A opcao "comeca em N minutos". O cliente nunca manda a hora: manda so que
 * escolheu JIT, e o servidor decide quando e. Arredondado para o minuto
 * cheio seguinte, senao cada inscrito cai numa sessao propria por causa dos
 * segundos e ninguem encontra ninguem no chat.
 */
export function slotJit(now: Date, delayMin: number): Slot {
  const alvo = now.getTime() + Math.max(1, delayMin) * 60000;
  const startsAt = new Date(Math.ceil(alvo / 60000) * 60000);
  return { startsAt, ruleKey: "jit", label: formatSlot(startsAt) };
}
