"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, criarCookieAdmin, senhaConfere } from "@/lib/auth";

export type EstadoEntrar = { erro?: string };

export async function entrar(_prev: EstadoEntrar, formData: FormData): Promise<EstadoEntrar> {
  const senha = String(formData.get("senha") ?? "");

  if (!process.env.ADMIN_PASSWORD) {
    return { erro: "ADMIN_PASSWORD nao esta configurada no servidor." };
  }
  if (!senhaConfere(senha)) {
    return { erro: "Senha incorreta." };
  }

  const cookie = criarCookieAdmin();
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });

  redirect("/painel");
}

export async function sair(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/entrar");
}
