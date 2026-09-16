import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { sair } from "../entrar/acoes";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await exigirAdmin();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--borda)] bg-[var(--fundo)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/painel" className="text-[15px] font-semibold tracking-tight">
            Webinarios
          </Link>
          <form action={sair}>
            <button type="submit" className="text-[13px] text-[var(--texto-3)] hover:text-[var(--texto)]">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
    </div>
  );
}
