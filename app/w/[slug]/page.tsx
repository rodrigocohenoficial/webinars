import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatSlotLongo } from "@/lib/time";
import { proximosSlots } from "@/lib/schedule";
import Inscricao, { type SlotView } from "./Inscricao";

export const dynamic = "force-dynamic";

async function carregar(slug: string) {
  return db.webinar.findUnique({ where: { slug }, include: { rules: true } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const w = await carregar(slug);
  if (!w) return { title: "Webinario" };

  // Armadilha 9.10: a palavra "ao vivo" nao entra aqui tambem. O que
  // dizemos e "webinario online", que e verdade.
  return {
    title: w.title,
    description: w.subtitle ?? w.description ?? "Webinario online",
    openGraph: {
      title: w.title,
      description: w.subtitle ?? w.description ?? "Webinario online",
      images: w.coverUrl ? [w.coverUrl] : undefined,
      type: "website",
    },
  };
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-5 py-10">
      {children}
    </main>
  );
}

export default async function PaginaInscricao({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await carregar(slug);
  if (!w) notFound();

  // Regra 5.6: quem chega aqui nao precisa saber como a sessao e entregue.
  // Fora do ar tem recado proprio, nao erro.
  if (!w.published) {
    return (
      <Moldura>
        <div className="cartao mx-auto max-w-md text-center">
          <h1 className="text-lg font-semibold">{w.title}</h1>
          <p className="mt-2 text-[15px] text-[var(--texto-2)]">
            Estamos finalizando os preparativos desta sessao. Volte em instantes.
          </p>
        </div>
      </Moldura>
    );
  }

  const agora = new Date();
  const slots: SlotView[] = proximosSlots(w.rules, agora, w.visibleSlots).map((s) => ({
    valor: String(s.startsAt.getTime()),
    label: formatSlotLongo(s.startsAt),
  }));

  if (w.jitEnabled) {
    slots.unshift({
      valor: "jit",
      label: `Comeca em ${w.jitDelayMin} minutos`,
      destaque: "mais cedo",
    });
  }

  if (slots.length === 0) {
    return (
      <Moldura>
        <div className="cartao mx-auto max-w-md text-center">
          <h1 className="text-lg font-semibold">{w.title}</h1>
          <p className="mt-2 text-[15px] text-[var(--texto-2)]">
            Estamos finalizando os preparativos desta sessao. Volte em instantes.
          </p>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="grid items-center gap-9 lg:grid-cols-[1.15fr_1fr]">
        <div>
          {w.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={w.coverUrl}
              alt=""
              className="mb-6 aspect-video w-full rounded-xl border border-[var(--borda)] object-cover"
            />
          ) : null}
          <p className="selo mb-3 bg-[var(--fundo-2)] text-[var(--texto-2)]">webinario online</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{w.title}</h1>
          {w.subtitle ? (
            <p className="mt-3 text-[17px] leading-relaxed text-[var(--texto-2)]">{w.subtitle}</p>
          ) : null}
          {w.description ? (
            <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-[var(--texto-2)]">
              {w.description.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
          {w.hostName ? (
            <p className="mt-5 text-[14px] text-[var(--texto-3)]">Com {w.hostName}</p>
          ) : null}
        </div>

        <div className="cartao">
          <Inscricao slug={w.slug} slots={slots} />
        </div>
      </div>
    </Moldura>
  );
}
