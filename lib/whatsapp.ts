import { normalizarTelefoneBR } from "./phone";

/**
 * WhatsApp pela Z-API. Mesma regra do e-mail: sem credencial, devolve
 * { ok: false } e o resto do sistema segue inteiro.
 */

export function whatsappConfigurado(): boolean {
  return Boolean(
    process.env.ZAPI_INSTANCE && process.env.ZAPI_TOKEN && process.env.ZAPI_CLIENT_TOKEN,
  );
}

export async function enviarWhatsapp(
  telefone: string | null,
  mensagem: string,
): Promise<{ ok: boolean; id?: string }> {
  if (!whatsappConfigurado()) return { ok: false };

  const numero = normalizarTelefoneBR(telefone);
  if (!numero) return { ok: false };

  // A base e configuravel para homologacao e para teste.
  const base = process.env.ZAPI_BASE_URL || "https://api.z-api.io";
  const url = `${base}/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}/send-text`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "client-token": process.env.ZAPI_CLIENT_TOKEN as string,
      },
      body: JSON.stringify({ phone: numero, message: mensagem }),
    });
    if (!res.ok) return { ok: false };
    const dados = (await res.json().catch(() => null)) as { messageId?: string; id?: string } | null;
    return { ok: true, id: dados?.messageId ?? dados?.id };
  } catch {
    return { ok: false };
  }
}
