import { cronSecretConfere } from "@/lib/auth";
import { rodarAvisos } from "@/lib/avisos";
import { emailConfigurado } from "@/lib/mail";
import { whatsappConfigurado } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A rota do agendador, protegida por segredo. Roda a cada minuto.
 *
 * Nao e ela que impede reenvio — quem impede sao os carimbos no inscrito.
 * O agendador so define a precisao do "minuto zero".
 */
async function executar(req: Request) {
  const url = new URL(req.url);
  const segredo =
    req.headers.get("x-cron-secret") ??
    url.searchParams.get("secret") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");

  if (!cronSecretConfere(segredo)) {
    return Response.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const resultado = await rodarAvisos();

  return Response.json(
    {
      ...resultado,
      canais: { email: emailConfigurado(), whatsapp: whatsappConfigurado() },
      em: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export const GET = executar;
export const POST = executar;
