import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const DUBLE = readFileSync(new URL("./dubles/youtube.js", import.meta.url), "utf8");
const RAIZ = new URL("..", import.meta.url).pathname;
const db = new PrismaClient();
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

const semear = (args) =>
  JSON.parse(execFileSync("node", ["smoke/semear.mjs", ...args], { cwd: RAIZ, encoding: "utf8" }).trim().split("\n").pop());

// sessão de 48min que começou há 60min: acabou, e a oferta saía aos 20:00
const s = semear([
  "--minutos", "60", "--token", "fim-cta", "--slug", "fim-cta-teste", "--limpar",
  "--oferta-em", "300", "--oferta-ate", "1200", "--com-regra",
]);

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
async function abrir(token) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.goto(`${BASE}/sala/${token}`);
  return p;
}

let page = await abrir("fim-cta");
await page.waitForSelector("text=foi encerrada", { timeout: 25000 });
conferir(await page.isVisible("text=Quero minha vaga"), "a oferta reaparece na tela de encerramento");

/**
 * Espera a página ser assumida pelo React antes de clicar.
 *
 * Os próximos horários são buscados pelo cliente, então eles só existem
 * depois da hidratação. Sem esta espera, o clique na oferta acontece na
 * página ainda estática: o <a> navega, o onClick nunca roda e o clique não é
 * gravado. Passa sozinho e falha na bateria inteira, quando o servidor está
 * ocupado — que é exatamente o que aconteceu.
 */
await page.waitForSelector("button:has-text('reservar')", { timeout: 25000 });
conferir(
  await page.isVisible("text=As vagas desta turma abrem agora"),
  "com a mesma chamada da oferta",
);

// o clique conta, com o ponto do vídeo no fim
await page.click("text=Quero minha vaga");
await page.waitForTimeout(1800);
const reg = await db.registration.findUnique({ where: { token: "fim-cta" } });
conferir(reg.ctaClickedAt !== null, "o clique na tela de encerramento é gravado");
conferir(
  reg.ctaClickedAtSec === s.duracao - 1,
  `gravado no fim do vídeo, grampeado pela duração (${reg.ctaClickedAtSec} de ${s.duracao})`,
);
await page.close();

// ── desligado, não aparece ──────────────────────────────────────────────
await db.webinar.update({ where: { id: s.webinarId }, data: { ctaNoFim: false } });
semear(["--minutos", "60", "--token", "fim-cta-off", "--slug", "fim-cta-teste"]);
page = await abrir("fim-cta-off");
await page.waitForSelector("text=foi encerrada", { timeout: 25000 });
await page.waitForSelector("button:has-text('reservar')", { timeout: 25000 });
conferir(!(await page.isVisible("text=Quero minha vaga")), "desligado no painel, a oferta não reaparece no fim");
const quantosHorarios = await page.locator("button:has-text('reservar')").count();
conferir(quantosHorarios > 0, `e os próximos horários continuam ali (${quantosHorarios})`);
await page.close();

// ── a janela do minuto continua valendo durante a sessão ────────────────
await db.webinar.update({ where: { id: s.webinarId }, data: { ctaNoFim: true } });
semear(["--minutos", "1", "--token", "fim-cta-cedo", "--slug", "fim-cta-teste"]);
page = await abrir("fim-cta-cedo");
await page.waitForSelector("text=Conversa", { timeout: 25000 });
await page.waitForTimeout(2000);
conferir(
  !(await page.isVisible("text=Quero minha vaga")),
  "ligar a repetição no fim não faz a oferta aparecer antes do minuto dela",
);
await page.close();

await browser.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nOFERTA NO FIM VERIFICADA");
process.exit(falhas.length ? 1 : 0);
