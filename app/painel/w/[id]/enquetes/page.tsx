import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Enquetes, { type EnqueteView } from "./Enquetes";

export const dynamic = "force-dynamic";

export default async function PaginaEnquetes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const w = await db.webinar.findUnique({ where: { id }, select: { id: true } });
  if (!w) notFound();

  const enquetes = await db.poll.findMany({
    where: { webinarId: id },
    orderBy: { atSec: "asc" },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
    },
  });

  const lista: EnqueteView[] = enquetes.map((e) => ({
    id: e.id,
    question: e.question,
    atSec: e.atSec,
    untilSec: e.untilSec,
    total: e._count.votes,
    opcoes: e.options.map((o) => ({ id: o.id, label: o.label, votos: o._count.votes })),
  }));

  return <Enquetes webinarId={id} enquetes={lista} />;
}
