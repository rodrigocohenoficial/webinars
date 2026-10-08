"use client";

import { useEffect } from "react";

/**
 * Leva para a sala sozinho. A espera curta nao e enfeite: e o tempo de o
 * pixel registrar o lead antes de a pagina sair.
 */
export default function EntrarJa({ link }: { link: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.location.assign(link), 1500);
    return () => clearTimeout(t);
  }, [link]);
  return null;
}
