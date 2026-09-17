/**
 * Roda as migracoes no build, mas NUNCA derruba o build.
 *
 * Por que: se a migracao derruba o build, um DATABASE_URL errado deixa o
 * projeto sem nenhuma versao publicada — e ai o dominio devolve 404 em TODAS
 * as paginas, inclusive /painel. O sintoma nao aponta para a causa, e quem
 * nao le log de build fica perdido.
 *
 * Com este script, o site sobe mesmo assim e diz na propria tela o que
 * faltou. Ver tambem /api/saude.
 */
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (r.status === 0) {
  console.log("\n[migracoes] aplicadas com sucesso.\n");
  process.exit(0);
}

console.log(
  [
    "",
    "──────────────────────────────────────────────────────────────",
    "[migracoes] NAO rodaram. O site vai subir assim mesmo, mas o",
    "painel nao vai funcionar ate isto ser resolvido.",
    "",
    "Quase sempre e a variavel DATABASE_URL: ausente, incompleta ou",
    "com a senha errada. Confira em Settings > Environment Variables",
    "na Vercel, corrija, e clique em Redeploy.",
    "",
    "Depois do deploy, abra /api/saude no seu site para ver o estado.",
    "──────────────────────────────────────────────────────────────",
    "",
  ].join("\n"),
);
process.exit(0);
