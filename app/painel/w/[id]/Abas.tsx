"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "", nome: "Configuracao" },
  { href: "/roteiro", nome: "Roteiro" },
];

export default function Abas({ id }: { id: string }) {
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
          </Link>
        );
      })}
    </nav>
  );
}
