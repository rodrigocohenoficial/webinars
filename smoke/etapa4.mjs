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

async function abrir(token) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await page.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await page.goto(`${BASE}/sala/${token}`);
  return page;
}

// ── WAITING: contagem regressiva que anda ────────────────────────────────
semear(["--minutos", "-3", "--token", "fase-espera", "--slug", "fase-espera", "--com-regra"]);
let page = await abrir("fase-espera");
await page.waitForSelector("text=comeca em");
const c1 = await page.textContent(".font-mono");
await page.waitForTimeout(2200);
const c2 = await page.textContent(".font-mono");
conferir(c1 !== c2, `contagem regressiva anda (${c1.trim()} → ${c2.trim()})`);
conferir(/^0[0-2]:\d\d$/.test(c2.trim()), `contagem mostra o que falta mesmo (${c2.trim()})`);
await page.close();

// ── 9.5: vídeo de ambiente recortado, não esticado ───────────────────────
semear([
  "--minutos", "-10",
  "--token", "fase-espera-video",
  "--slug", "fase-espera-video",
  "--espera", "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
]);
page = await abrir("fase-espera-video");
await page.waitForSelector("iframe[data-duble-youtube]", { timeout: 20000 });
await page.waitForTimeout(600);
const medidas = await page.evaluate(() => {
  const iframe = document.querySelector("iframe[data-duble-youtube]");
  const moldura = iframe.parentElement.parentElement;
  const caixa = moldura.parentElement;
  const m = moldura.getBoundingClientRect();
  const c = caixa.getBoundingClientRect();
  return { molduraL: m.width, molduraA: m.height, caixaL: c.width, caixaA: c.height };
});
log("medidas:", JSON.stringify(medidas));
conferir(
  medidas.molduraL >= medidas.caixaL && medidas.molduraA >= medidas.caixaA,
  "9.5 o player cobre a caixa inteira em vez de caber dentro dela",
);
const proporcao = medidas.molduraL / medidas.molduraA;
conferir(Math.abs(proporcao - 16 / 9) < 0.05, `9.5 o recorte mantém a proporção do vídeo (${proporcao.toFixed(2)})`);
conferir(
  medidas.molduraL > medidas.caixaL * 1.05 || medidas.molduraA > medidas.caixaA * 1.05,
  "9.5 passa além da caixa, escondendo marca no alto e legenda embaixo",
);
await page.close();

// ── LATE: passou da janela de entrada ────────────────────────────────────
semear(["--minutos", "20", "--janela", "5", "--token", "fase-atrasado", "--slug", "fase-atrasado", "--com-regra"]);
page = await abrir("fase-atrasado");
await page.waitForSelector("text=ja comecou", { timeout: 15000 });
// "text=" casa por substring sem diferenciar maiúscula: "Procurando os
// proximos horarios..." também casaria. Esperamos o botão, não o texto.
await page.waitForSelector("button:has-text('reservar')", { timeout: 15000 });
const botoes = await page.locator("button:has-text('reservar')").count();
conferir(botoes > 0, `fase LATE mostra os próximos horários (${botoes})`);

// reinscrição em um clique
await page.click("button:has-text('reservar')");
await page.waitForURL(/\/obrigado\//, { timeout: 20000 });
conferir(true, "reinscrição em um clique, sem preencher nada de novo → " + page.url());
const conteudo = await page.evaluate(() => {
  const c = document.body.cloneNode(true);
  c.querySelectorAll("script,style").forEach((n) => n.remove());
  return c.innerText;
});
conferir(/Participante Teste|Pronto,/.test(conteudo), "a nova inscrição reaproveitou nome e e-mail");
await page.close();

// ── ENDED ────────────────────────────────────────────────────────────────
semear(["--minutos", "120", "--token", "fase-fim", "--slug", "fase-fim", "--com-regra"]);
page = await abrir("fase-fim");
await page.waitForSelector("text=foi encerrada", { timeout: 15000 });
await page.waitForSelector("button:has-text('reservar')", { timeout: 15000 });
const botoesFim = await page.locator("button:has-text('reservar')").count();
conferir(botoesFim > 0, `fase ENDED mostra os próximos horários (${botoesFim})`);
await page.close();

// ── 5.6 em todas as fases ────────────────────────────────────────────────
for (const t of ["fase-espera", "fase-atrasado", "fase-fim"]) {
  page = await abrir(t);
  await page.waitForTimeout(1500);
  const texto = (
    await page.evaluate(() => {
      const c = document.body.cloneNode(true);
      c.querySelectorAll("script,style,template").forEach((n) => n.remove());
      return c.innerText || "";
    })
  ).toLowerCase();
  const proibidas = ["ao vivo", "gravaç", "gravac", "replay", "vídeo", "video"].filter((p) => texto.includes(p));
  conferir(proibidas.length === 0, `5.6 /sala/${t} sem palavra proibida${proibidas.length ? ` (${proibidas})` : ""}`);
  await page.close();
}

await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 4 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
