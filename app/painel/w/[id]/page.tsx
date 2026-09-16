import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMinutoSegundo } from "@/lib/time";
import { parseDaysOfWeek, proximosSlots } from "@/lib/schedule";
import { alternarPublicacao, excluirWebinar } from "../../acoes";
import FormularioWebinar, { type WebinarForm } from "./FormularioWebinar";
import Grade from "./Grade";

export const dynamic = "force-dynamic";

export default async function ConfigurarWebinar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const w = await db.webinar.findUnique({
    where: { id },
    include: { rules: { orderBy: [{ timeOfDay: "asc" }] } },
  });
  if (!w) notFound();

  const inicial: WebinarForm = {
    id: w.id,
    slug: w.slug,
    title: w.title,
    subtitle: w.subtitle ?? "",
    hostName: w.hostName ?? "",
    description: w.description ?? "",
    coverUrl: w.coverUrl ?? "",
    videoUrl: w.videoUrl ?? "",
    durationSec: w.durationSec ? formatMinutoSegundo(w.durationSec) : "",
    aspectRatio: w.aspectRatio,
    waitingVideoUrl: w.waitingVideoUrl ?? "",
    published: w.published,
    jitEnabled: w.jitEnabled,
    jitDelayMin: String(w.jitDelayMin),
    joinWindowMin: String(w.joinWindowMin),
    visibleSlots: String(w.visibleSlots),
    chatAoVivo: w.chatAoVivo,
    legendas: w.legendas,
    ctaLabel: w.ctaLabel ?? "",
    ctaUrl: w.ctaUrl ?? "",
    ctaDescription: w.ctaDescription ?? "",
    ctaAtSec: w.ctaAtSec !== null ? formatMinutoSegundo(w.ctaAtSec) : "",
    ctaUntilSec: w.ctaUntilSec !== null ? formatMinutoSegundo(w.ctaUntilSec) : "",
  };

  const proximos = proximosSlots(w.rules, new Date(), 6).map((s) => s.label);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href={`/w/${w.slug}`} className="ajuda hover:text-[var(--texto)]">
          abrir a pagina de inscricao ↗
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <form action={alternarPublicacao.bind(null, w.id)}>
            <button type="submit" className="botao-fantasma">
              {w.published ? "Tirar do ar" : "Publicar"}
            </button>
          </form>
          <form action={excluirWebinar.bind(null, w.id)}>
            <button
              type="submit"
              className="botao-fantasma hover:!border-[var(--erro)] hover:!text-[var(--erro)]"
            >
              Excluir
            </button>
          </form>
        </div>
      </div>

      <Grade
        webinarId={w.id}
        regras={w.rules.map((r) => ({
          id: r.id,
          daysOfWeek: parseDaysOfWeek(r.daysOfWeek),
          timeOfDay: r.timeOfDay,
          active: r.active,
        }))}
        proximos={proximos}
      />

      <FormularioWebinar inicial={inicial} />
    </div>
  );
}
