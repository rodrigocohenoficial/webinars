/**
 * Roda a bateria inteira, na ordem das etapas, contra um banco limpo.
 *
 *   npm run dev          # em outro terminal
 *   node smoke/todos.mjs
 *
 * Precisa de `npm i -D playwright` e de um servidor local fazendo o papel
 * dos provedores de e-mail e WhatsApp — a etapa 9 sobe ele sozinha.
 */
import { execFileSync } from "node:child_process";

const RAIZ = new URL("..", import.meta.url).pathname;
const ETAPAS = [
  "etapa1.mjs", "etapa2.mjs", "etapa3.mjs", "etapa4.mjs", "etapa5.mjs", "etapa6.mjs",
  "etapa7.mjs", "etapa8.mjs", "etapa9.mjs", "etapa10.mjs", "etapa11.mjs", "etapa12.mjs",
  "previa.mjs",
];

if (process.argv.includes("--limpar-banco")) {
  console.log("── zerando o banco\n");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  await db.$executeRawUnsafe(
    'TRUNCATE "PollVote","PollOption","Poll","ChatMessage","Registration","Session","ScheduleRule","Webinar" CASCADE',
  );
  await db.$disconnect();
}

const falhas = [];
for (const etapa of ETAPAS) {
  console.log(`\n══ ${etapa} ${"═".repeat(Math.max(0, 50 - etapa.length))}`);
  try {
    execFileSync("node", [`smoke/${etapa}`], { cwd: RAIZ, stdio: "inherit" });
  } catch {
    falhas.push(etapa);
  }
}

console.log(
  falhas.length
    ? `\n\n✗ ${falhas.length} etapa(s) com falha: ${falhas.join(", ")}`
    : `\n\n✓ ${ETAPAS.length} etapas verificadas, todas passando`,
);
process.exit(falhas.length ? 1 : 0);
