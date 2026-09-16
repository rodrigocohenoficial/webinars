export const dynamic = "force-dynamic";

/**
 * Regra 5.2 / secao 4.3: o relogio do servidor manda, sempre.
 *
 * O visitante corrige o proprio relogio contra esta rota ao entrar na sala e
 * toda vez que volta para a aba. Maquina adiantada veria o video
 * dessincronizado do chat.
 */
export function GET() {
  return new Response(JSON.stringify({ agora: Date.now() }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
