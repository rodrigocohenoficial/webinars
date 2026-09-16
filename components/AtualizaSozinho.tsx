"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Armadilha 9.12: um numero de audiencia renderizado no servidor e congelado
 * mente ate alguem recarregar. Enquanto houver sessao no ar, a pagina se
 * atualiza sozinha.
 */
export default function AtualizaSozinho({
  ativo,
  intervaloMs = 20000,
}: {
  ativo: boolean;
  intervaloMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervaloMs);
    return () => clearInterval(t);
  }, [ativo, intervaloMs, router]);

  return null;
}
