/**
 * Normalizacao de numero brasileiro para o WhatsApp: DDI 55, DDD, nono
 * digito em movel. Devolve null quando nao da para confiar no numero —
 * e melhor nao mandar do que mandar para estranho.
 */
export function normalizarTelefoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");

  // 00 de discagem internacional na frente
  if (d.startsWith("00")) d = d.slice(2);
  // ja veio com DDI
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);

  // sobrou DDD + numero
  if (d.length === 11) {
    // movel com nono digito
    if (d[2] !== "9") return null;
    return `55${d}`;
  }
  if (d.length === 10) {
    const ddd = d.slice(0, 2);
    const resto = d.slice(2);
    // fixo comeca em 2..5; movel antigo (6..9) ganha o nono digito
    if (/^[2-5]/.test(resto)) return `55${d}`;
    return `55${ddd}9${resto}`;
  }
  return null;
}

/** "(11) 98765-4321" a partir de 5511987654321, para mostrar em lista. */
export function formatarTelefoneBR(e164: string | null | undefined): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}
