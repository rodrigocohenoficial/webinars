"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "", nome: "Configuracao" },
  { href: "/roteiro", nome: "Roteiro" },
  { href: "/curadoria", nome: "Curadoria" },
];

export default function Abas({ id, pendentes = 0 }: { id: string; pendentes?: number }) {
  const caminho = usePathname();
  const base = `/painel/w/${id}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--borda)]">
      {ABAS.map((a) => {
        const href = `${base}${a.href}`;
        const ativa = a.href === "" ? caminho === base : caminho.startsWith(href);
        return (
          <Link
            key={a.href}
            href={href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-[14px] transition ${
              ativa
                ? "border-[var(--acento)] text-[var(--texto)]"
                : "border-transparent text-[var(--texto-3)] hover:text-[var(--texto)]"
            }`}
          >
            {a.nome}
            {a.href === "/curadoria" && pendentes > 0 ? (
              <span className="ml-1.5 rounded-full bg-[var(--alerta)]/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--alerta)]">
                {pendentes}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
