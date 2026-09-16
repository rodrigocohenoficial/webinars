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

// ── Antes do minuto da oferta: nada aparece ─────────────────────────────
const cedo = semear([
  "--minutos", "1", "--token", "oferta-cedo", "--slug", "oferta-teste", "--limpar",
  "--oferta-em", "300", "--oferta-ate", "900",
]);
let page = await abrirSala("oferta-cedo");
await page.waitForSelector("text=Conversa", { timeout: 20000 });
await page.waitForTimeout(1500);
conferir(!(await page.isVisible("text=Quero minha vaga")), "antes do minuto marcado a oferta não aparece");
await page.close();

// ── Dentro da janela: aparece ───────────────────────────────────────────
semear(["--minutos", "7", "--token", "oferta-agora", "--slug", "oferta-teste"]);
page = await abrirSala("oferta-agora");
await page.waitForSelector("text=Quero minha vaga", { timeout: 20000 });
conferir(true, "dentro da janela a oferta aparece");
conferir(await page.isVisible("text=As vagas desta turma abrem agora"), "a chamada acima do botão aparece");

// ── O clique é gravado com o ponto do vídeo ─────────────────────────────
await page.click("text=Quero minha vaga");
await page.waitForTimeout(1500);

const painel = await browser.newPage({ viewport: { width: 1400, height: 900 } });
painel.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", "dev");
await painel.click('button[type=submit]');
await painel.waitForURL(`${BASE}/painel`);
await painel.goto(`${BASE}/painel/w/${cedo.webinarId}/desempenho`);
await painel.waitForSelector("text=Quem clicou na oferta", { timeout: 20000 });
const listaCliques = await painel.innerText("section:has-text('Quem clicou na oferta')");
log("lista:", listaCliques.replace(/\n/g, " · ").slice(0, 200));
conferir(/no 7:\d\d/.test(listaCliques), "o clique foi gravado com o ponto do vídeo (7:xx)");

// ── Só o primeiro clique conta ──────────────────────────────────────────
for (let i = 0; i < 3; i++) {
  await fetch(`${BASE}/api/sala/oferta-agora/oferta`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sec: 42 }),
  });
}
await painel.reload();
await painel.waitForSelector("text=Quem clicou na oferta", { timeout: 20000 });
const depois = await painel.innerText("section:has-text('Quem clicou na oferta')");
conferir(/no 7:\d\d/.test(depois), "cliques repetidos não sobrescrevem o primeiro (continua 7:xx, não 0:42)");
const quantasLinhas = await painel.locator("section:has-text('Quem clicou na oferta') li").count();
conferir(quantasLinhas === 1, `quem clicou três vezes é uma pessoa, não três (${quantasLinhas})`);

// ── Conversão medida sobre quem chegou ao minuto da oferta ──────────────
const cartaoCliques = await painel.locator("div.cartao:has-text('Cliques na oferta')").innerText();
log("cartão:", cartaoCliques.replace(/\n/g, " · "));
conferir(/de quem chegou aos 5:00/.test(cartaoCliques), "a conversão é medida sobre quem chegou ao minuto da oferta");

// ── Depois da janela: some ──────────────────────────────────────────────
semear(["--minutos", "20", "--token", "oferta-tarde", "--slug", "oferta-teste"]);
const tarde = await abrirSala("oferta-tarde");
await tarde.waitForSelector("text=Conversa", { timeout: 20000 });
await tarde.waitForTimeout(1500);
conferir(!(await tarde.isVisible("text=Quero minha vaga")), "passada a janela, a oferta some");
await tarde.close();

// ── A oferta viaja junto do chat, na mesma consulta ─────────────────────
const resposta = await fetch(`${BASE}/api/sala/oferta-agora/chat`).then((r) => r.json());
conferir(
  resposta.oferta && resposta.oferta.atSec === 300 && Array.isArray(resposta.mensagens),
  "a oferta viaja junto do chat, na mesma consulta",
);

await page.close();
await painel.close();
await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 8 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
