import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatSlot } from "@/lib/time";
import Curadoria, { type Aba, type ItemCuradoria } from "./Curadoria";

export const dynamic = "force-dynamic";

const STATUS: Record<Aba, "PENDING" | "APPROVED" | "HIDDEN"> = {
  aguardando: "PENDING",
  replay: "APPROVED",
  ocultos: "HIDDEN",
};

export default async function PaginaCuradoria({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const { aba: abaBruta } = await searchParams;
  const aba: Aba = abaBruta === "replay" || abaBruta === "ocultos" ? abaBruta : "aguardando";

  const w = await db.webinar.findUnique({ where: { id }, select: { id: true } });
  if (!w) notFound();

  // Curadoria e sobre comentario de participante: o roteiro tem tela propria.
  const base = { webinarId: id, kind: "REAL" as const };

  const [itens, aguardando, replay, ocultos] = await Promise.all([
    db.chatMessage.findMany({
      where: { ...base, status: STATUS[aba] },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      select: {
        id: true,
        authorName: true,
        body: true,
        videoTimeSec: true,
        createdAt: true,
        session: { select: { startsAt: true } },
      },
    }),
    db.chatMessage.count({ where: { ...base, status: "PENDING" } }),
    db.chatMessage.count({ where: { ...base, status: "APPROVED" } }),
    db.chatMessage.count({ where: { ...base, status: "HIDDEN" } }),
  ]);

  const lista: ItemCuradoria[] = itens.map((m) => ({
    id: m.id,
    autor: m.authorName,
    texto: m.body,
    sec: m.videoTimeSec,
    quando: formatSlot(m.createdAt),
    sessao: m.session ? formatSlot(m.session.startsAt) : null,
  }));

  return (
    <Curadoria
      webinarId={id}
      aba={aba}
      itens={lista}
      contagens={{ aguardando, replay, ocultos }}
    />
  );
}
