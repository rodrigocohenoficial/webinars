import Link from "next/link";
import { db } from "@/lib/db";
import { formatDuracao } from "@/lib/time";
import NovoWebinario from "./NovoWebinario";

export const dynamic = "force-dynamic";

export default async function ListaWebinarios() {
  const webinarios = await db.webinar.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      videoUrl: true,
      durationSec: true,
      _count: { select: { sessions: true, rules: true } },
    },
  });

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Webinarios</h1>
          <p className="ajuda">Cada um tem um video, uma grade de horarios e um roteiro de chat.</p>
        </div>
        <NovoWebinario />
      </div>

      {webinarios.length === 0 ? (
        <div className="cartao text-center text-[var(--texto-2)]">
          <p>Nenhum webinario ainda.</p>
          <p className="ajuda">Comece criando um. Video e horarios podem vir depois.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {webinarios.map((w) => (
            <li key={w.id}>
              <Link
                href={`/painel/w/${w.id}`}
                className="cartao flex items-center justify-between gap-4 transition hover:border-[var(--texto-3)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{w.title}</span>
                    {w.published ? (
                      <span className="selo bg-[var(--acento-fraco)] text-[var(--acento)]">no ar</span>
                    ) : (
                      <span className="selo bg-[var(--fundo-2)] text-[var(--texto-3)]">rascunho</span>
                    )}
                  </div>
                  <p className="ajuda truncate">
                    /w/{w.slug}
                    {" · "}
                    {w.videoUrl ? formatDuracao(w.durationSec ?? 0) : "sem video"}
                    {" · "}
                    {w._count.rules} regra{w._count.rules === 1 ? "" : "s"} de grade
                    {" · "}
                    {w._count.sessions} sess{w._count.sessions === 1 ? "ao" : "oes"}
                  </p>
                </div>
                <span className="text-[var(--texto-3)]">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
