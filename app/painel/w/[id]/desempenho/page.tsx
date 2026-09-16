import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDuracao, formatMinutoSegundo, formatSlot } from "@/lib/time";
import {
  agruparOrigem,
  compareceram,
  conversaoDaOferta,
  curvaRetencao,
  tempoMedioSec,
} from "@/lib/metricas";
import CurvaRetencao from "./CurvaRetencao";

export const dynamic = "force-dynamic";

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="cartao">
      <p className="titulo-secao">{rotulo}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{valor}</p>
      {detalhe ? <p className="ajuda">{detalhe}</p> : null}
    </div>
  );
}

export default async function Desempenho({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const w = await db.webinar.findUnique({
    where: { id },
    select: { id: true, durationSec: true, ctaAtSec: true, ctaLabel: true },
  });
  if (!w) notFound();

  // 9.11: o apresentador fora de TODA metrica.
  const pessoas = await db.registration.findMany({
    where: { isHost: false, session: { webinarId: id } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      firstSeenAt: true,
      watchedUntilSec: true,
      ctaClickedAt: true,
      ctaClickedAtSec: true,
      utmSource: true,
      utmCampaign: true,
      referrer: true,
    },
  });

  const presentes = compareceram(pessoas);
  const taxaComparecimento = pessoas.length === 0 ? 0 : (presentes.length / pessoas.length) * 100;
  const curva = curvaRetencao(pessoas, w.durationSec);
  const oferta = conversaoDaOferta(pessoas, w.ctaAtSec);
  const origens = agruparOrigem(pessoas);
  const clicaram = pessoas
    .filter((p) => p.ctaClickedAt)
    .sort((a, b) => (b.ctaClickedAt?.getTime() ?? 0) - (a.ctaClickedAt?.getTime() ?? 0));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Inscritos" valor={String(pessoas.length)} />
        <Numero
          rotulo="Compareceram"
          valor={String(presentes.length)}
          detalhe={`${taxaComparecimento.toFixed(0)}% dos inscritos`}
        />
        <Numero rotulo="Tempo medio assistido" valor={formatDuracao(tempoMedioSec(pessoas))} />
        <Numero
          rotulo="Cliques na oferta"
          valor={String(clicaram.length)}
          detalhe={
            w.ctaAtSec !== null
              ? `${oferta.taxa.toFixed(0)}% de quem chegou aos ${formatMinutoSegundo(w.ctaAtSec)}`
              : "sem oferta configurada"
          }
        />
      </div>

      <section className="cartao">
        <div className="mb-4">
          <h2 className="titulo-secao">Curva de retencao</h2>
          <p className="ajuda">
            Quantos ainda estavam la em cada trecho. A linha pontilhada e o minuto da oferta — se a
            queda vem antes dela, a oferta esta tarde.
          </p>
        </div>
        <CurvaRetencao pontos={curva} ctaAtSec={w.ctaAtSec} duracaoSec={w.durationSec ?? 0} />
      </section>

      <section className="cartao">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="titulo-secao">Quem clicou na oferta</h2>
            <p className="ajuda">A lista mais quente que este sistema produz.</p>
          </div>
          {clicaram.length > 0 ? (
            <a
              href={`/api/painel/${id}/inscritos?cliques=1`}
              className="text-[13px] text-[var(--texto-3)] hover:text-[var(--texto)]"
            >
              baixar CSV
            </a>
          ) : null}
        </div>
        {clicaram.length === 0 ? (
          <p className="text-[14px] text-[var(--texto-3)]">Ninguem clicou ainda.</p>
        ) : (
          <ul className="divide-y divide-[var(--borda)]">
            {clicaram.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <span className="text-[14px] font-medium">{p.name}</span>
                  <span className="ajuda ml-2">{p.email}</span>
                </div>
                <span className="text-[13px] tabular-nums text-[var(--texto-3)]">
                  {p.ctaClickedAtSec !== null ? `no ${formatMinutoSegundo(p.ctaClickedAtSec)}` : ""}
                  {p.ctaClickedAt ? ` · ${formatSlot(p.ctaClickedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="titulo-secao">De onde vieram</h2>
            <p className="ajuda">Origem agrupada, com a taxa de comparecimento de cada uma.</p>
          </div>
          <a
            href={`/api/painel/${id}/inscritos`}
            className="text-[13px] text-[var(--texto-3)] hover:text-[var(--texto)]"
          >
            baixar todos em CSV
          </a>
        </div>
        {origens.length === 0 ? (
          <p className="text-[14px] text-[var(--texto-3)]">Ninguem inscrito ainda.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-wide text-[var(--texto-3)]">
                <th className="py-1.5 font-medium">Origem</th>
                <th className="py-1.5 text-right font-medium">Inscritos</th>
                <th className="py-1.5 text-right font-medium">Compareceram</th>
                <th className="py-1.5 text-right font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--borda)]">
              {origens.map((o) => (
                <tr key={o.chave}>
                  <td className="py-2">{o.chave}</td>
                  <td className="py-2 text-right tabular-nums">{o.inscritos}</td>
                  <td className="py-2 text-right tabular-nums">{o.compareceram}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--texto-2)]">
                    {o.taxa.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
