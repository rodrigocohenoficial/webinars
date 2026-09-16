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

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
async function abrir(url) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.addInitScript(() => { window.__permitirSomAutomatico = true; });
  await p.goto(url);
  return p;
}

// sessão que já acabou, com roteiro e oferta
const s = semear([
  "--minutos", "200", "--token", "replay-origem", "--slug", "replay-teste", "--limpar",
  "--oferta-em", "60", "--oferta-ate", "600",
]);
await db.chatMessage.createMany({
  data: [
    { webinarId: s.webinarId, authorName: "Marcia", body: "cheguei agora", videoTimeSec: 15, kind: "FAKE", status: "APPROVED" },
    { webinarId: s.webinarId, authorName: "Paulo", body: "isso mudou meu jogo", videoTimeSec: 900, kind: "FAKE", status: "APPROVED" },
  ],
});

// ── abrir o replay cria sessão começando agora ──────────────────────────
let page = await abrir(`${BASE}/replay/replay-origem`);
await page.waitForURL(/\/sala\//, { timeout: 20000 });
const primeiroLink = page.url();
const tokenReplay = primeiroLink.split("/sala/")[1];
conferir(tokenReplay !== "replay-origem", `o replay manda para uma sala própria (${tokenReplay.slice(0, 10)}...)`);

const sessaoReplay = await db.registration.findUnique({
  where: { token: tokenReplay },
  include: { session: true, replayOf: true },
});
const segundosDesdeInicio = (Date.now() - sessaoReplay.session.startsAt.getTime()) / 1000;
conferir(sessaoReplay.session.kind === "REPLAY", "a sessão nasce marcada como REPLAY");
conferir(segundosDesdeInicio < 30, `a sessão começa no instante em que a pessoa abre (${segundosDesdeInicio.toFixed(0)}s)`);
conferir(sessaoReplay.replayOf?.token === "replay-origem", "a inscrição nova aponta para a original");
conferir(sessaoReplay.email === "teste@teste.com", "nome e e-mail vêm da inscrição original");

// ── herda tudo: chat acumulado e oferta no minuto certo ─────────────────
await page.waitForSelector("text=Conversa", { timeout: 20000 });
await page.waitForFunction(() => document.querySelectorAll("aside li p").length >= 1, null, { timeout: 30000 });
const visiveis = await page.$$eval("aside li p", (ps) => ps.map((p) => p.textContent.trim()));
conferir(visiveis.some((t) => /cheguei agora/.test(t)), "o chat acumulado aparece no minuto certo");
conferir(!visiveis.some((t) => /mudou meu jogo/.test(t)), "o comentário de 15:00 ainda não apareceu");
conferir(!(await page.isVisible("text=Quero minha vaga")), "a oferta de 1:00 ainda não apareceu — ela é do minuto, não da abertura");

// ── 5.6: a tela do replay não se anuncia como replay ────────────────────
const texto = (await page.evaluate(() => {
  const c = document.body.cloneNode(true);
  c.querySelectorAll("script,style,template").forEach((n) => n.remove());
  return c.innerText || "";
})).toLowerCase();
conferir(
  !["ao vivo", "gravaç", "replay", "vídeo", "video"].some((p) => texto.includes(p)),
  "5.6 a sala do replay não diz replay, gravação nem vídeo",
);

// ── reabrir durante a exibição devolve a mesma sessão ───────────────────
const page2 = await abrir(`${BASE}/replay/replay-origem`);
await page2.waitForURL(/\/sala\//, { timeout: 20000 });
conferir(page2.url() === primeiroLink, "reabrir durante a exibição devolve a sessão em curso, não recomeça do zero");
await page2.close();

// ── depois que acabou, reabrir começa uma sessão nova ───────────────────
await db.session.update({
  where: { id: sessaoReplay.sessionId },
  data: { startsAt: new Date(Date.now() - 3 * 3600 * 1000) },
});
const page3 = await abrir(`${BASE}/replay/replay-origem`);
await page3.waitForURL(/\/sala\//, { timeout: 20000 });
conferir(page3.url() !== primeiroLink, "depois que a exibição acaba, reabrir começa do zero numa sessão nova");

// ── a cadeia não cresce ────────────────────────────────────────────────
const tokenTerceiro = page3.url().split("/sala/")[1];
const terceiro = await db.registration.findUnique({ where: { token: tokenTerceiro }, include: { replayOf: true } });
conferir(terceiro.replayOf?.token === "replay-origem", "todo replay aponta para a inscrição de origem, sem cadeia");
await page3.close();

// ── o replay conta como comparecimento próprio, sem mexer no original ──
const original = await db.registration.findUnique({ where: { token: "replay-origem" } });
conferir(original.firstSeenAt === null, "abrir o replay não marca presença na inscrição original");

await page.close();
await browser.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 10 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
