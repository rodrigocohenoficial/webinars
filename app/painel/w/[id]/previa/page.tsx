import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { enquetesDoWebinario } from "@/lib/enquetes";
import { trilhaDeReacoes } from "@/lib/reacoes";
import { parseVideoUrl } from "@/lib/video";
import { formatMinutoSegundo } from "@/lib/time";
import Sala, { type DadosSala } from "../../../../sala/[token]/Sala";

export const dynamic = "force-dynamic";

/**
 * Tela 8 do painel: a sala renderizada em qualquer momento da sessao, sem se
 * inscrever e sem gravar nada.
 *
 * Nao e uma copia da sala: e a sala, com um token que nao existe e o modo
 * previa ligado. Copia da sala envelheceria em uma semana.
 */
const MOMENTOS = [
  { rotulo: "4 dias antes", em: -4 * 86400 },
  { rotulo: "10 min antes", em: -600 },
  { rotulo: "30s antes", em: -30 },
  { rotulo: "minuto 0", em: 2 },
  { rotulo: "minuto 5", em: 300 },
  { rotulo: "minuto 15", em: 900 },
];

export default async function Previa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ em?: string }>;
}) {
  const { id } = await params;
  const { em } = await searchParams;

  const w = await db.webinar.findUnique({ where: { id } });
  if (!w) notFound();

  const emSec = Number.isFinite(Number(em)) && em !== undefined ? Number(em) : 300;
  const video = w.videoUrl ? parseVideoUrl(w.videoUrl) : null;
  const videoEspera = w.waitingVideoUrl ? parseVideoUrl(w.waitingVideoUrl) : null;

  const trilha = await db.chatMessage.findMany({
    where: { webinarId: w.id, status: "APPROVED" },
    orderBy: [{ videoTimeSec: "asc" }, { createdAt: "asc" }],
    select: { id: true, authorName: true, body: true, videoTimeSec: true, kind: true },
  });

  const enquetes = await enquetesDoWebinario(w.id);
  const reacoes = await trilhaDeReacoes(w.id);

  const dados: DadosSala = {
    token: "previa",
    titulo: w.title,
    subtitulo: w.subtitle,
    apresentador: w.hostName,
    capaUrl: w.coverUrl,
    inicioMs: Date.now() - emSec * 1000,
    durationSec: w.durationSec,
    aspectRatio: w.aspectRatio,
    legendas: w.legendas,
    joinWindowMin: w.joinWindowMin,
    video: video ? { provider: video.provider, id: video.id, hash: video.hash } : null,
    videoEspera: videoEspera
      ? { provider: videoEspera.provider, id: videoEspera.id, hash: videoEspera.hash }
      : null,
    agoraMs: Date.now(),
    trilha: trilha.map((m) => ({
      id: m.id,
      autor: m.authorName,
      texto: m.body,
      sec: m.videoTimeSec,
      kind: m.kind,
    })),
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
    ofertaNoFim: w.ctaNoFim,
    ehApresentador: false,
    previa: true,
    enquetes,
    reacoes,
  };

  const fim = w.durationSec ? w.durationSec - 20 : null;
  const momentos = [
    ...MOMENTOS,
    ...(w.ctaAtSec !== null ? [{ rotulo: `oferta (${formatMinutoSegundo(w.ctaAtSec)})`, em: w.ctaAtSec + 5 }] : []),
    ...(fim ? [{ rotulo: "fim", em: fim }] : []),
    ...(w.durationSec ? [{ rotulo: "encerrada", em: w.durationSec + 60 }] : []),
  ];

  return (
    <div className="space-y-4">
      <section className="cartao">
        <h2 className="titulo-secao mb-1">Pre-visualizacao</h2>
        <p className="ajuda mb-3">
          A sala de verdade, em qualquer momento da sessao. Nada aqui e gravado: sem presenca, sem
          clique, sem comentario.
        </p>
        <div className="flex flex-wrap gap-2">
          {momentos.map((m) => (
            <Link
              key={m.rotulo}
              href={`/painel/w/${id}/previa?em=${m.em}`}
              className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
                emSec === m.em
                  ? "border-[var(--acento)] bg-[var(--acento-fraco)] text-[var(--acento)]"
                  : "border-[var(--borda)] text-[var(--texto-3)] hover:text-[var(--texto)]"
              }`}
            >
              {m.rotulo}
            </Link>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-dashed border-[var(--borda)]">
        <Sala dados={dados} />
      </div>
    </div>
  );
}
