import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, cookieAdminValido } from "./auth";

export async function estaLogado(): Promise<boolean> {
  const jar = await cookies();
  return cookieAdminValido(jar.get(ADMIN_COOKIE)?.value);
}

/**
 * Armadilha 9.9: sessao expirada volta para o login, nao para uma tela de
 * erro generica com um codigo e nenhuma explicacao.
 */
export async function exigirAdmin(): Promise<void> {
  if (!(await estaLogado())) redirect("/entrar");
}
