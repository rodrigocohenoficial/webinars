import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const DUBLE = readFileSync(new URL("./dubles/youtube.js", import.meta.url), "utf8");
const RAIZ = new URL("..", import.meta.url).pathname;
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

const semear = (args) =>
  JSON.parse(execFileSync("node", ["smoke/semear.mjs", ...args], { cwd: RAIZ, encoding: "utf8" }).trim().split("\n").pop());

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

const s = semear(["--minutos", "8", "--token", "pres-a", "--slug", "presenca-teste", "--limpar"]);

// ── A batida de presença ────────────────────────────────────────────────
const sala = await browser.newPage({ viewport: { width: 1400, height: 900 } });
sala.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await sala.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
await sala.addInitScript(() => { window.__permitirSomAutomatico = true; });

const batidas = [];
sala.on("request", (r) => { if (/\/presenca$/.test(r.url())) batidas.push(Date.now()); });
await sala.goto(`${BASE}/sala/pres-a`);
await sala.waitForSelector("text=Conversa", { timeout: 20000 });
await sala.waitForTimeout(2500);
conferir(batidas.length >= 1, `a sala bate presença ao entrar (${batidas.length})`);

// ── 5.2 também na presença: ponto forjado é grampeado ───────────────────
await fetch(`${BASE}/api/sala/pres-a/presenca`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sec: 999999 }),
});
const painel = await browser.newPage({ viewport: { width: 1400, height: 900 } });
painel.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", "dev");
await painel.click('button[type=submit]');
await painel.waitForURL(`${BASE}/painel`);

await painel.goto(`${BASE}/painel/w/${s.webinarId}/sessoes?sessao=${s.sessaoId}`);
await painel.waitForSelector("text=Inscritos", { timeout: 20000 });
const linhaInscrito = await painel.innerText("li:has-text('Participante Teste')");
log("linha do inscrito:", linhaInscrito.replace(/\n/g, " · "));
conferir(!/2777:/.test(linhaInscrito), "5.2 presença forjada não virou 277 horas assistidas");
conferir(/no \d+:\d\d/.test(linhaInscrito), "o painel mostra em que minuto do vídeo a pessoa está");

// ── 9.12 quem está assistindo ───────────────────────────────────────────
conferir(/assistindo/i.test(await painel.innerText("body")), "a sessão no ar mostra quantos estão assistindo");
// renova a batida: em dev a primeira compilação de cada página pode comer
// mais que a janela de 75s, e aí o sinal expira por fora do que se testa
await fetch(`${BASE}/api/sala/pres-a/presenca`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ sec: 480 }),
});
await painel.goto(`${BASE}/painel`);
await painel.waitForSelector("text=presenca-teste", { timeout: 15000 });
// innerText devolve o texto com o text-transform aplicado: o selo sai
// "1 ASSISTINDO", em caixa alta. Daí o /i.
conferir(/\d+ assistindo/i.test(await painel.innerText("body")), "9.12 a lista de webinários mostra o selo de quem está assistindo");

// ── 9.11 o apresentador fica fora ───────────────────────────────────────
execFileSync("node", ["-e", `
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  const sessao = await db.session.findUnique({ where: { id: ${JSON.stringify(s.sessaoId)} } });
  await db.registration.deleteMany({ where: { token: "host-teste-token" } });
  await db.registration.create({ data: {
    sessionId: sessao.id, name: "Rodrigo (apresentador)", email: "host@teste.com",
    token: "host-teste-token", isHost: true, firstSeenAt: new Date(), lastSeenAt: new Date(),
    watchedUntilSec: 400,
  }});
  await db.$disconnect();
})();`], { cwd: RAIZ, encoding: "utf8" });

await painel.goto(`${BASE}/painel/w/${s.webinarId}/desempenho`);
await painel.waitForSelector("text=Inscritos", { timeout: 20000 });
const corpoDesempenho = await painel.innerText("body");
conferir(!/apresentador\)/.test(corpoDesempenho), "9.11 o apresentador não aparece em nenhuma lista do desempenho");

const inscritosMostrados = await painel.locator("div.cartao:has-text('Inscritos') p.text-2xl").first().innerText();
conferir(inscritosMostrados.trim() === "1", `9.11 o apresentador não conta como inscrito (mostrou ${inscritosMostrados.trim()})`);

await painel.goto(`${BASE}/painel/w/${s.webinarId}/sessoes?sessao=${s.sessaoId}`);
conferir(!/apresentador\)/.test(await painel.innerText("body")), "9.11 o apresentador não aparece na lista de inscritos");

// ── CSV ─────────────────────────────────────────────────────────────────
const cookies = await painel.context().cookies();
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
const csv = await fetch(`${BASE}/api/painel/${s.webinarId}/inscritos`, { headers: { cookie: cookieHeader } }).then((r) => r.text());
log("csv:", csv.split("\r\n").slice(0, 2).join("  ||  ").slice(0, 200));
conferir(/nome;email;whatsapp/.test(csv), "o CSV sai com cabeçalho em ponto-e-vírgula");
conferir(!/apresentador/.test(csv), "9.11 o apresentador não sai no CSV");

const semLogin = await fetch(`${BASE}/api/painel/${s.webinarId}/inscritos`);
conferir(semLogin.status === 401, `o CSV exige login (${semLogin.status})`);

// ── curva de retenção ───────────────────────────────────────────────────
await painel.goto(`${BASE}/painel/w/${s.webinarId}/desempenho`);
await painel.waitForSelector("svg", { timeout: 15000 });
const pontosCurva = await painel.locator("svg + div button").count();
conferir(pontosCurva === 40, `curva de retenção em 40 pontos (${pontosCurva})`);

await sala.close();
await painel.close();
await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 7 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
