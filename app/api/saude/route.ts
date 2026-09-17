import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Diagnostico em portugues, para quando alguma coisa nao funciona e o
 * sintoma nao aponta para a causa.
 *
 * Nunca devolve o valor de segredo nenhum — so diz se cada variavel esta
 * preenchida. A unica que aparece inteira e NEXT_PUBLIC_SITE_URL, que ja e
 * publica por definicao e e onde mais se erra de digitacao.
 */
export async function GET() {
  const problemas: string[] = [];

  const preenchida = (nome: string) => Boolean(process.env[nome]);

  const obrigatorias = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "ADMIN_PASSWORD",
    "CRON_SECRET",
    "NEXT_PUBLIC_SITE_URL",
  ];
  for (const nome of obrigatorias) {
    if (!preenchida(nome)) problemas.push(`A variavel ${nome} nao esta configurada na Vercel.`);
  }

  let banco = "sem conexao";
  let migracoes = "nao conferido";

  try {
    await db.$queryRaw`SELECT 1`;
    banco = "conectado";
    try {
      const linhas = await db.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
      `;
      const n = Number(linhas[0]?.n ?? 0);
      migracoes = n > 0 ? `${n} aplicadas` : "nenhuma aplicada";
      if (n === 0) {
        problemas.push("As migracoes nao rodaram. Faca um Redeploy na Vercel.");
      }
    } catch {
      migracoes = "tabelas ainda nao criadas";
      problemas.push("As tabelas ainda nao existem. Faca um Redeploy na Vercel.");
    }
  } catch {
    problemas.push(
      "Nao consigo falar com o banco de dados. Confira a DATABASE_URL na Vercel e faca Redeploy.",
    );
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (site && !/^https?:\/\//.test(site)) {
    problemas.push("NEXT_PUBLIC_SITE_URL precisa comecar com https://");
  }
  if (site.endsWith("/")) {
    problemas.push("NEXT_PUBLIC_SITE_URL esta com uma barra sobrando no fim. Tire a barra.");
  }

  const canais = {
    email: preenchida("RESEND_API_KEY") && preenchida("RESEND_FROM_EMAIL"),
    respostaDeEmail: preenchida("RESEND_REPLY_TO"),
    whatsapp:
      preenchida("ZAPI_INSTANCE") && preenchida("ZAPI_TOKEN") && preenchida("ZAPI_CLIENT_TOKEN"),
    pixel: preenchida("NEXT_PUBLIC_META_PIXEL_ID"),
  };

  return Response.json(
    {
      tudoCerto: problemas.length === 0,
      problemas,
      banco,
      migracoes,
      enderecoDoSite: site || "(vazio)",
      obrigatorias: Object.fromEntries(obrigatorias.map((n) => [n, preenchida(n)])),
      canaisOpcionais: canais,
      agendador:
        "chame /api/cron trocando o final por ?secret= mais o valor real da sua variavel CRON_SECRET. 200 e certo; 401 quer dizer que o valor nao bate (colar o texto de exemplo aqui tambem devolve 401).",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
