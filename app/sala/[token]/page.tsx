import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { enquetesDoWebinario } from "@/lib/enquetes";
import { parseVideoUrl } from "@/lib/video";
import Sala, { type DadosSala } from "./Sala";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sua sessao",
  robots: { index: false, follow: false },
};

export default async function PaginaSala({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const inscricao = await db.registration.findUnique({
    where: { token },
    include: { session: { include: { webinar: true } } },
  });
  if (!inscricao) notFound();

  const w = inscricao.session.webinar;
  const video = w.videoUrl ? parseVideoUrl(w.videoUrl) : null;
  const videoEspera = w.waitingVideoUrl ? parseVideoUrl(w.waitingVideoUrl) : null;

  // A trilha do replay e deterministica: o cliente baixa uma vez e revela
  // conforme o video anda. Nada aqui precisa de consulta periodica.
  const trilha = await db.chatMessage.findMany({
    where: { webinarId: w.id, status: "APPROVED" },
    orderBy: [{ videoTimeSec: "asc" }, { createdAt: "asc" }],
    select: { id: true, authorName: true, body: true, videoTimeSec: true, kind: true },
  });

  const enquetes = await enquetesDoWebinario(w.id);

  const dados: DadosSala = {
    token: inscricao.token,
    titulo: w.title,
    subtitulo: w.subtitle,
    apresentador: w.hostName,
    capaUrl: w.coverUrl,
    inicioMs: inscricao.session.startsAt.getTime(),
    durationSec: w.durationSec,
    aspectRatio: w.aspectRatio,
    legendas: w.legendas,
    joinWindowMin: w.joinWindowMin,
    video: video ? { provider: video.provider, id: video.id, hash: video.hash } : null,
    videoEspera: videoEspera
      ? { provider: videoEspera.provider, id: videoEspera.id, hash: videoEspera.hash }
      : null,
    // primeira pintura; o cliente corrige contra /api/agora logo em seguida
    agoraMs: Date.now(),
    ofertaNoFim: w.ctaNoFim,
    ehApresentador: inscricao.isHost,
    previa: false,
    enquetes,
    oferta:
      w.ctaUrl && w.ctaAtSec !== null
        ? {
            label: w.ctaLabel ?? "Quero saber mais",
            url: w.ctaUrl,
            descricao: w.ctaDescription,
            atSec: w.ctaAtSec,
            untilSec: w.ctaUntilSec,
          }
        : null,
    trilha: trilha.map((m) => ({
      id: m.id,
      autor: m.authorName,
      texto: m.body,
      sec: m.videoTimeSec,
      kind: m.kind,
    })),
  };

  return <Sala dados={dados} />;
}
