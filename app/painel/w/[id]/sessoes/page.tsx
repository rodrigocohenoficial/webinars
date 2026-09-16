import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMinutoSegundo, formatSlot, formatSlotLongo } from "@/lib/time";
import { proximosSlots } from "@/lib/schedule";
import { assistindoPorSessao } from "@/lib/presenca";
import { formatarTelefoneBR } from "@/lib/phone";
import AtualizaSozinho from "@/components/AtualizaSozinho";
import { entrarNaSala } from "./acoes";

export const dynamic = "force-dynamic";

export default async function Sessoes({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessao?: string }>;
}) {
  const { id } = await params;
  const { sessao: sessaoAberta } = await searchParams;

  const w = await db.webinar.findUnique({
    where: { id },
    include: { rules: true },
  });
  if (!w) notFound();

  const agora = new Date();
  const duracaoMs = (w.durationSec ?? 0) * 1000;

  const sessoes = await db.session.findMany({
    where: { webinarId: id },
    orderBy: { startsAt: "desc" },
    take: 200,
    select: {
      id: true,
      startsAt: true,
      kind: true,
      _count: { select: { registrations: { where: { isHost: false } } } },
    },
  });

  const assistindo = await assistindoPorSessao(id);

  const noAr = (s: { startsAt: Date }) =>
    duracaoMs > 0 &&
    s.startsAt.getTime() <= agora.getTime() &&
    agora.getTime() < s.startsAt.getTime() + duracaoMs;

  const acontecendo = sessoes.filter(noAr);
  const futuras = sessoes.filter((s) => s.startsAt > agora);
  const passadas = sessoes.filter((s) => !noAr(s) && s.startsAt <= agora);

  // A grade futura que ainda nao virou sessao: ninguem se inscreveu nela.
  const comSessao = new Set(sessoes.map((s) => s.startsAt.getTime()));
  const gradeVazia = proximosSlots(w.rules, agora, w.visibleSlots).filter(
    (s) => !comSessao.has(s.startsAt.getTime()),
  );

  const inscritos = sessaoAberta
    ? await db.registration.findMany({
        where: { sessionId: sessaoAberta, isHost: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          firstSeenAt: true,
          watchedUntilSec: true,
          ctaClickedAt: true,
          lastSeenAt: true,
        },
      })
    : [];

  function Linha({
    s,
  }: {
    s: { id: string; startsAt: Date; kind: string; _count: { registrations: number } };
  }) {
    const aberta = sessaoAberta === s.id;
    const vendo = assistindo.get(s.id) ?? 0;
    return (
      <li className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium">{formatSlotLongo(s.startsAt)}</span>
            {noAr(s) ? (
              <span className="selo bg-[var(--acento-fraco)] text-[var(--acento)]">no ar</span>
            ) : null}
            {s.kind !== "SCHEDULED" ? (
              <span className="selo bg-[var(--fundo-2)] text-[var(--texto-3)]">
                {s.kind === "JIT" ? "comeca em N min" : "replay"}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-4 text-[13px] text-[var(--texto-3)]">
            <span className="tabular-nums">
              {s._count.registrations} inscrito{s._count.registrations === 1 ? "" : "s"}
            </span>
            {vendo > 0 ? (
              <span className="tabular-nums text-[var(--acento)]">{vendo} assistindo</span>
            ) : null}
            {noAr(s) ? (
              <form action={entrarNaSala.bind(null, s.id)}>
                <button type="submit" className="font-medium text-[var(--acento)] hover:brightness-125">
                  entrar na sala
                </button>
              </form>
            ) : null}
            <Link
              href={aberta ? `/painel/w/${id}/sessoes` : `/painel/w/${id}/sessoes?sessao=${s.id}`}
              className="hover:text-[var(--texto)]"
            >
              {aberta ? "fechar" : "ver inscritos"}
            </Link>
          </div>
        </div>

        {aberta ? (
          <div className="mt-3 rounded-lg border border-[var(--borda)] bg-[var(--fundo-2)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="titulo-secao">Inscritos</span>
              <a
                href={`/api/painel/${id}/inscritos?sessao=${s.id}`}
                className="text-[13px] text-[var(--texto-3)] hover:text-[var(--texto)]"
              >
                baixar CSV
              </a>
            </div>
            {inscritos.length === 0 ? (
              <p className="text-[13px] text-[var(--texto-3)]">Ninguem aqui.</p>
            ) : (
              <ul className="divide-y divide-[var(--borda)]">
                {inscritos.map((p) => {
                  const online =
                    p.lastSeenAt && agora.getTime() - p.lastSeenAt.getTime() < 75000;
                  return (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <span className="text-[14px]">{p.name}</span>
                        <span className="ajuda ml-2">{p.email}</span>
                        {p.phone ? (
                          <span className="ajuda ml-2">{formatarTelefoneBR(p.phone)}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-[13px] tabular-nums text-[var(--texto-3)]">
                        {online ? (
                          <span className="text-[var(--acento)]">
                            no {formatMinutoSegundo(p.watchedUntilSec)}
                          </span>
                        ) : p.firstSeenAt ? (
                          <span>viu ate {formatMinutoSegundo(p.watchedUntilSec)}</span>
                        ) : (
                          <span>nao veio</span>
                        )}
                        {p.ctaClickedAt ? <span className="text-[var(--alerta)]">clicou</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <AtualizaSozinho ativo={acontecendo.length > 0} />

      {acontecendo.length > 0 ? (
        <section className="cartao">
          <h2 className="titulo-secao mb-1">Acontecendo agora</h2>
          <ul className="divide-y divide-[var(--borda)]">
            {acontecendo.map((s) => (
              <Linha key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="cartao">
        <h2 className="titulo-secao mb-1">Proximas</h2>
        <p className="ajuda mb-2">
          Sessao so existe quando alguem se inscreve nela. Os horarios sem inscrito nao ocupam banco.
        </p>
        {futuras.length === 0 && gradeVazia.length === 0 ? (
          <p className="text-[14px] text-[var(--texto-3)]">Nada marcado.</p>
        ) : (
          <ul className="divide-y divide-[var(--borda)]">
            {futuras.map((s) => (
              <Linha key={s.id} s={s} />
            ))}
            {gradeVazia.map((s) => (
              <li
                key={s.startsAt.getTime()}
                className="flex items-center justify-between py-3 text-[var(--texto-3)]"
              >
                <span className="text-[14px]">{formatSlotLongo(s.startsAt)}</span>
                <span className="text-[13px]">sem inscrito</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {passadas.length > 0 ? (
        <section className="cartao">
          <h2 className="titulo-secao mb-1">Passadas</h2>
          <ul className="divide-y divide-[var(--borda)]">
            {passadas.slice(0, 50).map((s) => (
              <Linha key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="ajuda">Ultima leitura: {formatSlot(agora)}. Com sessao no ar, a pagina se atualiza sozinha.</p>
    </div>
  );
}
