import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Abas from "./Abas";

export const dynamic = "force-dynamic";

export default async function LayoutWebinar({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const w = await db.webinar.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, published: true },
  });
  if (!w) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/painel" className="ajuda hover:text-[var(--texto)]">
          ← todos os webinarios
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight">{w.title}</h1>
          {w.published ? (
            <span className="selo bg-[var(--acento-fraco)] text-[var(--acento)]">no ar</span>
          ) : (
            <span className="selo bg-[var(--fundo-2)] text-[var(--texto-3)]">rascunho</span>
          )}
        </div>
        <p className="ajuda">/w/{w.slug}</p>
      </div>

      <Abas id={w.id} />
      {children}
    </div>
  );
}
