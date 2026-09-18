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
async function sala(token) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.addInitScript(() => { window.__permitirSomAutomatico = true; });
  await p.goto(`${BASE}/sala/${token}`);
  return p;
}

const s = semear(["--minutos", "0.2", "--token", "reag-a", "--slug", "reacoes-teste", "--limpar"]);
await db.reacao.deleteMany({ where: { webinarId: s.webinarId } });

// ── a barra existe e reagir grava ──────────────────────────────────────
const a = await sala("reag-a");
await a.waitForSelector("button[aria-label*='reagir']", { timeout: 25000 });
const quantosBotoes = await a.locator("button[aria-label*='reagir']").count();
conferir(quantosBotoes === 4, `a barra tem os quatro símbolos (${quantosBotoes})`);

await a.click("button[aria-label='reagir com 🔥']");
await a.waitForTimeout(1500);
const gravadas = await db.reacao.findMany({ where: { webinarId: s.webinarId } });
conferir(gravadas.length === 1 && gravadas[0].emoji === "🔥", `a reação foi gravada (${gravadas.map((r) => r.emoji)})`);
conferir(gravadas[0].videoTimeSec < 120, `presa ao segundo do vídeo (${gravadas[0].videoTimeSec}s)`);

// ── ela sobe na tela e some sozinha ────────────────────────────────────
await a.click("button[aria-label='reagir com 👏']");
await a.waitForTimeout(300);
const subindo = await a.locator(".reacao-subindo").count();
conferir(subindo >= 1, `a reação sobe na tela (${subindo})`);
await a.waitForTimeout(3500);
const depois = await a.locator(".reacao-subindo").count();
conferir(depois === 0, `e some sozinha, sem deixar nada (${depois})`);

// ── 5.2: o segundo enviado é grampeado ─────────────────────────────────
const forjada = await fetch(`${BASE}/api/sala/reag-a/reacao`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ emoji: "❤️", sec: 999999 }),
}).then((r) => r.json());
conferir(
  forjada.reacao && forjada.reacao.sec < 200,
  `5.2 segundo forjado é grampeado (${forjada.reacao?.sec})`,
);

// ── só a lista fechada entra ───────────────────────────────────────────
const proibida = await fetch(`${BASE}/api/sala/reag-a/reacao`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ emoji: "🖕", sec: 10 }),
});
conferir(proibida.status === 400, `símbolo fora da lista é recusado (${proibida.status})`);
const total = await db.reacao.count({ where: { webinarId: s.webinarId } });
conferir(total === 3, `e não foi gravado (${total} no banco)`);
await a.close();

// ── a trilha: reação de uma sessão reaparece na seguinte ───────────────
await db.reacao.deleteMany({ where: { webinarId: s.webinarId } });
await db.reacao.create({
  data: { webinarId: s.webinarId, emoji: "🔥", videoTimeSec: 25 },
});
semear(["--minutos", "0.1", "--token", "reag-b", "--slug", "reacoes-teste"]);
const b = await sala("reag-b");
await b.waitForSelector("button[aria-label*='reagir']", { timeout: 25000 });
const noComeco = await b.locator(".reacao-subindo").count();
conferir(noComeco === 0, `no começo nada sobe (${noComeco})`);
await b.waitForFunction(() => document.querySelectorAll(".reacao-subindo").length > 0, null, { timeout: 40000 });
conferir(true, "aos ~25s a reação de outra sessão reaparece, no minuto dela");
await b.close();

// ── quem abre no meio não leva o histórico na cara ─────────────────────
for (let i = 0; i < 20; i++) {
  await db.reacao.create({ data: { webinarId: s.webinarId, emoji: "👏", videoTimeSec: 5 + i } });
}
semear(["--minutos", "5", "--token", "reag-c", "--slug", "reacoes-teste"]);
const c = await sala("reag-c");
await c.waitForSelector("button[aria-label*='reagir']", { timeout: 25000 });
await c.waitForTimeout(2500);
const noMeio = await c.locator(".reacao-subindo").count();
conferir(noMeio === 0, `quem entra aos 5 minutos não leva 20 reações de uma vez (${noMeio})`);
await c.close();

await browser.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nREAÇÕES VERIFICADAS");
process.exit(falhas.length ? 1 : 0);
