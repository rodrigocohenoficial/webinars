/**
 * Apoio na sala: o WhatsApp do time e o material para baixar.
 *
 * O painel recusa numero que nao da para confiar sem perder o que foi
 * digitado, grava o numero normalizado, e a sala mostra o contato em toda
 * fase e o material so a partir do minuto marcado.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const SENHA = process.env.ADMIN_PASSWORD ?? "dev";
const DUBLE = readFileSync(new URL("./dubles/youtube.js", import.meta.url), "utf8");
const RAIZ = new URL("..", import.meta.url).pathname;
const db = new PrismaClient();
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

const semear = (args) =>
  JSON.parse(execFileSync("node", ["smoke/semear.mjs", ...args], { cwd: RAIZ, encoding: "utf8" }).trim().split("\n").pop());

const SLUG = "apoio-teste";
const s = semear(["--minutos", "12", "--token", "apoio-vivo", "--slug", SLUG, "--limpar"]);
await db.webinar.update({
  where: { id: s.webinarId },
  data: { suporteNome: null, suporteWhatsapp: null, materialLabel: null, materialUrl: null, materialAtSec: null },
});

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

// ── painel ───────────────────────────────────────────────────────────────
const painel = await browser.newPage();
painel.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", SENHA);
await painel.click("button[type=submit]");
await painel.waitForURL(`${BASE}/painel`);
await painel.goto(`${BASE}/painel/w/${s.webinarId}`);
await painel.waitForSelector("text=Apoio na sala");

await painel.fill("#suporteNome", "Elaine");
await painel.fill("#suporteWhatsapp", "123");
await painel.click('button[type=submit]:has-text("Salvar")');
await painel.waitForSelector("text=Nao reconheci o WhatsApp", { timeout: 15000 });
conferir(true, "numero que nao da para confiar volta como erro");
conferir((await painel.inputValue("#suporteNome")) === "Elaine", "o erro nao apaga o que foi digitado");

await painel.fill("#suporteWhatsapp", "(11) 98765-4321");
await painel.click('button:has-text("Usar o Plano de 1 Pagina")');
conferir(
  (await painel.inputValue("#materialUrl")) === "/materiais/plano-de-1-pagina.pdf",
  "um clique preenche o Plano de 1 Pagina",
);
await painel.fill("#materialAtSec", "20:00");
await painel.click('button[type=submit]:has-text("Salvar")');
await painel.waitForSelector("text=Salvo", { timeout: 15000 });

const w = await db.webinar.findUnique({ where: { id: s.webinarId } });
conferir(w.suporteWhatsapp === "5511987654321", `numero gravado normalizado (${w.suporteWhatsapp})`);
conferir(w.materialAtSec === 1200, "minuto do material gravado em segundos");
conferir(w.materialLabel === "Baixar o Plano de 1 Página", "texto do botao vem junto");

await painel.reload();
conferir((await painel.inputValue("#suporteWhatsapp")) === "(11) 98765-4321", "o painel mostra o numero formatado");

// ── sala ─────────────────────────────────────────────────────────────────
async function abrir(token, viewport = { width: 1400, height: 950 }) {
  const p = await browser.newPage({ viewport });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.goto(`${BASE}/sala/${token}`);
  return p;
}

// aos 12 minutos: contato sim, material (marcado para 20:00) ainda nao
let sala = await abrir("apoio-vivo");
const zap = sala.locator('a:has-text("Falar com Elaine no WhatsApp")');
await zap.waitFor({ timeout: 25000 });
const href = await zap.getAttribute("href");
conferir(href.startsWith("https://wa.me/5511987654321?text="), "botao abre o WhatsApp da Elaine");
conferir(
  decodeURIComponent(href.split("text=")[1]).includes('webinário "O robô que opera sozinho"'),
  "a mensagem ja diz de qual webinario a pessoa veio",
);
conferir(!(await sala.isVisible("text=Baixar o Plano de 1 Página")), "material escondido antes do minuto marcado");
await sala.close();

// minuto marcado ja passou
await db.webinar.update({ where: { id: s.webinarId }, data: { materialAtSec: 600 } });
sala = await abrir("apoio-vivo");
const material = sala.locator('a:has-text("Baixar o Plano de 1 Página")');
await material.waitFor({ timeout: 25000 });
conferir((await material.getAttribute("href")) === "/materiais/plano-de-1-pagina.pdf", "material aparece depois do minuto");
conferir((await material.getAttribute("download")) !== null, "o link baixa o arquivo");
await sala.close();

const pdf = await fetch(`${BASE}/materiais/plano-de-1-pagina.pdf`);
conferir(
  pdf.status === 200 && (pdf.headers.get("content-type") ?? "").includes("pdf"),
  "o PDF e servido pelo proprio sistema",
);

// celular: nada desliza de lado
sala = await abrir("apoio-vivo", { width: 375, height: 812 });
await sala.locator('a:has-text("Falar com Elaine")').waitFor({ timeout: 25000 });
const vazou = await sala.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
conferir(!vazou, "no celular os botoes nao empurram a pagina de lado");
await sala.close();

// sala de espera: contato sim, material com minuto marcado nao
semear(["--minutos", "-5", "--token", "apoio-espera", "--slug", SLUG]);
sala = await abrir("apoio-espera");
await sala.waitForSelector("text=comeca em", { timeout: 25000 });
conferir(await sala.isVisible("text=Falar com Elaine no WhatsApp"), "contato visivel na sala de espera");
conferir(!(await sala.isVisible("text=Baixar o Plano de 1 Página")), "material marcado nao vaza antes de comecar");
await sala.close();

// encerrada: os dois
semear(["--minutos", "60", "--token", "apoio-fim", "--slug", SLUG]);
sala = await abrir("apoio-fim");
await sala.waitForSelector("text=foi encerrada", { timeout: 25000 });
conferir(await sala.isVisible("text=Falar com Elaine no WhatsApp"), "contato visivel no encerramento");
conferir(await sala.isVisible("text=Baixar o Plano de 1 Página"), "material visivel no encerramento");
await sala.close();

// sem nada configurado, nada aparece
await db.webinar.update({ where: { id: s.webinarId }, data: { suporteWhatsapp: null, materialUrl: null } });
sala = await abrir("apoio-fim");
await sala.waitForSelector("text=foi encerrada", { timeout: 25000 });
conferir(!(await sala.isVisible("text=WhatsApp")) && !(await sala.isVisible("text=Baixar")), "vazio no painel = nada na sala");

await browser.close();
await db.$disconnect();

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s):`, falhas);
  process.exit(1);
}
console.log("\ntudo certo");
