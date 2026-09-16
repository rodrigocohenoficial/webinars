/**
 * E-mail pelo Resend, por fetch — sem SDK.
 *
 * Tudo que e integracao funciona ausente: sem RESEND_API_KEY este modulo
 * devolve false e ninguem quebra. Isso nao e elegancia, e o que torna o
 * desenvolvimento local possivel.
 */

/** A URL do provedor e configuravel para homologacao e para teste. */
function endereco(): string {
  return process.env.RESEND_API_URL || "https://api.resend.com/emails";
}

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function enviarEmail(opcoes: {
  para: string;
  assunto: string;
  html: string;
}): Promise<boolean> {
  if (!emailConfigurado()) return false;

  try {
    const res = await fetch(endereco(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [opcoes.para],
        subject: opcoes.assunto,
        html: opcoes.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
