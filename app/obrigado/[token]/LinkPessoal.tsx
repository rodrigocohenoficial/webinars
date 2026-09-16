"use client";

import { useState } from "react";

export default function LinkPessoal({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Armadilha 9.6: confirmacao otimista mente. So dizemos "copiado"
      // depois que a copia realmente aconteceu.
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="campo font-mono text-[13px]"
      />
      <button type="button" onClick={copiar} className="botao-fantasma shrink-0">
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
