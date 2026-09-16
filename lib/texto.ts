/** Armadilha 9.8: textarea manda \r\n. Normaliza na gravacao, nao na exibicao. */
export function normalizarTexto(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim();
}

export function slugificar(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function textoOuNulo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const v = normalizarTexto(raw);
  return v ? v : null;
}

export function texto(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? normalizarTexto(raw) : "";
}

export function inteiro(raw: FormDataEntryValue | null, padrao: number): number {
  const n = Number(typeof raw === "string" ? raw.trim() : "");
  return Number.isFinite(n) ? Math.trunc(n) : padrao;
}

export function ligado(raw: FormDataEntryValue | null): boolean {
  return raw === "on" || raw === "true" || raw === "1";
}

export function emailValido(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}
