import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatSlotLongo } from "@/lib/time";
import LinkPessoal from "./LinkPessoal";
import PixelLead from "./PixelLead";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vaga confirmada",
  robots: { index: false, follow: false },
};

export default async function Obrigado({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const inscricao = await db.registration.findUnique({
    where: { token },
    include: { session: { include: { webinar: true } } },
  });
  if (!inscricao) notFound();

  const w = inscricao.session.webinar;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const link = `${base}/sala/${inscricao.token}`;
  const primeiroNome = inscricao.name.split(" ")[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">
      <PixelLead pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} eventId={inscricao.id} />

      <div className="cartao space-y-6">
        <div>
          <p className="selo bg-[var(--acento-fraco)] text-[var(--acento)]">vaga confirmada</p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">
            Pronto, {primeiroNome}.
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--texto-2)]">
            {w.title}
            <br />
            <strong className="text-[var(--texto)]">{formatSlotLongo(inscricao.session.startsAt)}</strong>
          </p>
        </div>

        <div>
          <p className="rotulo">Seu link de acesso</p>
          <LinkPessoal link={link} />
          <p className="ajuda">
            E so seu. Guarde: na hora marcada, ele abre a sala. Antes disso, mostra a contagem.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={`/api/ics/${inscricao.token}`} className="botao flex-1">
            Colocar na agenda
          </a>
          <a href={link} className="botao-fantasma flex-1">
            Abrir a sala
          </a>
        </div>

        <p className="ajuda border-t border-[var(--borda)] pt-4">
          Mandamos o link no seu e-mail
          {inscricao.phone ? " e no WhatsApp" : ""}, e um lembrete 15 minutos antes de comecar.
        </p>
      </div>
    </main>
  );
}
