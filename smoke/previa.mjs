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

const s = JSON.parse(
  execFileSync("node", ["smoke/semear.mjs", "--minutos", "1", "--token", "previa-tok", "--slug", "previa-teste", "--limpar", "--oferta-em", "300"], { cwd: RAIZ, encoding: "utf8" }).trim().split("\n").pop(),
);
await db.chatMessage.create({
  data: { webinarId: s.webinarId, authorName: "Marcia", body: "cheguei agora", videoTimeSec: 20, kind: "FAKE", status: "APPROVED" },
});

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const p = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
await p.addInitScript(() => { window.__permitirSomAutomatico = true; });

const chamadas = [];
p.on("request", (r) => { if (/\/api\/sala\//.test(r.url())) chamadas.push(r.url()); });

await p.goto(`${BASE}/entrar`);
await p.fill("#senha", "dev");
await p.click('button[type=submit]');
await p.waitForURL(`${BASE}/painel`);

// antes de começar
await p.goto(`${BASE}/painel/w/${s.webinarId}/previa?em=-600`);
await p.waitForSelector("text=comeca em", { timeout: 25000 });
conferir(true, "a prévia mostra a sala de espera 10 minutos antes");

// no minuto 5, com a oferta no ar
await p.goto(`${BASE}/painel/w/${s.webinarId}/previa?em=305`);
await p.waitForSelector("text=Quero minha vaga", { timeout: 25000 });
conferir(true, "no minuto da oferta, a prévia mostra a oferta");
conferir(await p.isVisible("text=cheguei agora"), "e o chat já acumulado até ali");

// encerrada
await p.goto(`${BASE}/painel/w/${s.webinarId}/previa?em=3000`);
await p.waitForSelector("text=foi encerrada", { timeout: 25000 });
conferir(true, "e a tela de encerrada depois da duração");

// ── nada é gravado ──────────────────────────────────────────────────────
await p.goto(`${BASE}/painel/w/${s.webinarId}/previa?em=305`);
await p.waitForSelector("text=Quero minha vaga", { timeout: 25000 });
await p.click("text=Quero minha vaga").catch(() => {});
await p.waitForTimeout(8000);

conferir(chamadas.length === 0, `a prévia não chama nenhuma rota da sala (${chamadas.length}: ${chamadas.slice(0,2).join(", ")})`);
conferir(!(await p.isVisible("input[placeholder='Escreva aqui']")), "a prévia não deixa escrever no chat");

const inscricoes = await db.registration.count({ where: { session: { webinarId: s.webinarId } } });
conferir(inscricoes === 1, `a prévia não cria inscrição (${inscricoes}, só a semeada)`);
const cliques = await db.registration.count({ where: { ctaClickedAt: { not: null }, session: { webinarId: s.webinarId } } });
conferir(cliques === 0, "a prévia não grava clique na oferta");

await browser.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nPRÉVIA VERIFICADA");
process.exit(falhas.length ? 1 : 0);
