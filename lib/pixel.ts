/**
 * O pixel que vale para um webinario: o dele, ou o da conta. So digitos —
 * e o formato do ID da Meta, e qualquer outra coisa nao chega no navegador.
 */
export function pixelValido(raw: string | null | undefined): string | null {
  const id = raw?.trim() ?? "";
  return /^\d{10,20}$/.test(id) ? id : null;
}

export function pixelDoWebinar(w: { metaPixelId: string | null }): string | undefined {
  return pixelValido(w.metaPixelId) ?? pixelValido(process.env.NEXT_PUBLIC_META_PIXEL_ID) ?? undefined;
}
