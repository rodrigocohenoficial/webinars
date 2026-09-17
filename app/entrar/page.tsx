import { db } from "@/lib/db";
import Formulario from "./Formulario";

export const dynamic = "force-dynamic";

/**
 * Se o banco nao responde, a senha certa devolveria "senha incorreta" e
 * ninguem descobriria o motivo. Entao a propria tela de entrada diz o que
 * esta faltando, em portugues, antes de qualquer tentativa.
 */
export default async function Entrar() {
  let aviso: string | null = null;

  if (!process.env.ADMIN_PASSWORD) {
    aviso =
      "A variavel ADMIN_PASSWORD nao esta configurada na Vercel. Configure em Settings > Environment Variables e clique em Redeploy.";
  } else {
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      aviso =
        "Nao consigo falar com o banco de dados. Confira a DATABASE_URL na Vercel, em Settings > Environment Variables, e clique em Redeploy.";
    }
  }

  return <Formulario aviso={aviso} />;
}
