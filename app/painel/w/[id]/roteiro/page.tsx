import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Roteiro, { type ComentarioView } from "./Roteiro";

export const dynamic = "force-dynamic";

export default async function PaginaRoteiro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const w = await db.webinar.findUnique({ where: { id }, select: { id: true, durationSec: true } });
  if (!w) notFound();

  const comentarios = await db.chatMessage.findMany({
    where: { webinarId: id, kind: { in: ["FAKE", "HOST"] } },
    orderBy: [{ videoTimeSec: "asc" }, { createdAt: "asc" }],
    select: { id: true, authorName: true, body: true, videoTimeSec: true, kind: true },
  });

  return (
    <Roteiro
      webinarId={w.id}
      duracaoSec={w.durationSec}
      comentarios={comentarios as ComentarioView[]}
    />
  );
}
