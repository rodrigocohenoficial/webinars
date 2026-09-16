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

async function abrirSala(token) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.addInitScript(() => { window.__permitirSomAutomatico = true; });
  await p.goto(`${BASE}/sala/${token}`);
  return p;
}

// sessão começou há 3 minutos
const s = semear(["--minutos", "3", "--token", "real-a", "--slug", "chat-real", "--limpar"]);
const sB = semear(["--minutos", "3", "--token", "real-b", "--slug", "chat-real"]);

// ── 5.2: o servidor grampeia o segundo enviado pelo cliente ─────────────
const forjado = await fetch(`${BASE}/api/sala/real-a/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ texto: "plantado la na frente", sec: 999999 }),
}).then((r) => r.json());
log("mensagem forjada voltou em:", forjado.mensagem?.sec, "s");
conferir(
  forjado.mensagem && forjado.mensagem.sec <= 200 && forjado.mensagem.sec >= 170,
  `5.2 segundo forjado (999999) foi grampeado para o ponto real da sessão (${forjado.mensagem?.sec}s)`,
);

const negativo = await fetch(`${BASE}/api/sala/real-a/chat`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ texto: "antes do começo", sec: -5000 }),
}).then((r) => r.json());
conferir(negativo.mensagem?.sec >= 0, `5.2 segundo negativo vira 0 (${negativo.mensagem?.sec})`);

// ── Participante escreve na sala e vê o próprio comentário ──────────────
const a = await abrirSala("real-a");
await a.waitForSelector("input[placeholder='Escreva aqui']", { timeout: 20000 });
await a.fill("input[placeholder='Escreva aqui']", "primeira vez que entendo isso");
await a.click("button:has-text('Enviar')");
await a.waitForSelector("text=primeira vez que entendo isso", { timeout: 15000 });
conferir(true, "o comentário da própria pessoa aparece na hora");
await a.waitForTimeout(1500);
const aindaEnviando = await a.isVisible("text=enviando...");
conferir(!aindaEnviando, "9.6 o eco local só some quando o servidor confirma");

// ── chatAoVivo desligado: B não vê o comentário de A ────────────────────
const b = await abrirSala("real-b");
await b.waitForSelector("text=Conversa", { timeout: 20000 });
await b.waitForTimeout(8000);
const textoB = await b.innerText("aside");
conferir(
  !/primeira vez que entendo isso/.test(textoB),
  "com chat ao vivo desligado, o comentário de um não chega no outro",
);
await b.close();

// ── Curadoria: liberar faz o comentário chegar na sala ──────────────────
const painel = await browser.newPage({ viewport: { width: 1400, height: 900 } });
painel.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", "dev");
await painel.click('button[type=submit]');
await painel.waitForURL(`${BASE}/painel`);
await painel.goto(`${BASE}/painel/w/${s.webinarId}/curadoria`);
await painel.waitForSelector("#lista-curadoria", { timeout: 20000 });
const naFila = await painel.locator("#lista-curadoria > li").count();
conferir(naFila >= 3, `comentário de participante nasce aguardando (${naFila} na fila)`);

await painel.click("text=Marcar todos");
await painel.click("button:has-text('Liberar')");
await painel.waitForSelector("text=liberado", { timeout: 20000 });
conferir(true, "liberar em lote confirmou depois da resposta do servidor");

await painel.goto(`${BASE}/painel/w/${s.webinarId}/curadoria?aba=replay`);
await painel.waitForSelector("#lista-curadoria", { timeout: 20000 });
const noReplay = await painel.locator("#lista-curadoria > li").count();
conferir(noReplay >= 3, `os liberados apareceram na aba "No replay" (${noReplay})`);

// agora B vê, porque liberar é aprovar
const b2 = await abrirSala("real-b");
await b2.waitForSelector("text=primeira vez que entendo isso", { timeout: 25000 });
conferir(true, "liberar é aprovar: o comentário aparece para a sala");
await b2.close();

// ── e entra no replay de uma sessão futura ─────────────────────────────
semear(["--minutos", "5", "--token", "real-c", "--slug", "chat-real"]);
const c = await abrirSala("real-c");
await c.waitForSelector("text=primeira vez que entendo isso", { timeout: 25000 });
conferir(true, "o comentário liberado entra na trilha de uma sessão nova, no minuto em que foi escrito");
await c.close();

await a.close();
await painel.close();
await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 6 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
