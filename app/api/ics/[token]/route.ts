import { db } from "@/lib/db";
import { toIcsUtc } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Escapa o que o formato .ics exige: virgula, ponto-e-virgula, barra e quebra. */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  const inscricao = await db.registration.findUnique({
    where: { token },
    include: { session: { include: { webinar: true } } },
  });
  if (!inscricao) return new Response("nao encontrado", { status: 404 });

  const { session } = inscricao;
  const w = session.webinar;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const link = `${base}/sala/${inscricao.token}`;
  const fim = new Date(session.startsAt.getTime() + (w.durationSec ?? 3600) * 1000);

  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//webinario//pt-BR//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${inscricao.id}@webinario`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(session.startsAt)}`,
    `DTEND:${toIcsUtc(fim)}`,
    `SUMMARY:${esc(w.title)}`,
    `DESCRIPTION:${esc(`Seu link de acesso: ${link}`)}`,
    `URL:${esc(link)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(w.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Response(linhas.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="webinario.ics"`,
      "cache-control": "no-store",
    },
  });
}
