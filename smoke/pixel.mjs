/**
 * Pixel da Meta por webinario.
 *
 * O script da Meta e trocado por um duble que so anota as chamadas, e a
 * prova e sobre o que chega nele: PageView na inscricao, Lead com eventID
 * estavel na confirmacao, PageView na sala — sempre com o pixel do proprio
 * webinario. Sem pixel nenhum, nada carrega. O painel recusa ID que nao e
 * so numero.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const SENHA = process.env.ADMIN_PASSWORD ?? "dev";
const DUBLE_YT = readFileSync(new URL("./dubles/youtube.js", import.meta.url), "utf8");
const RAIZ = new URL("..", import.meta.url).pathname;
const PIXEL = "2870327729868266";
const db = new PrismaClient();
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

// fbevents.js de mentira: guarda cada chamada que a fila do fbq recebeu
const DUBLE_FB = `
  window.__fb = [];
  const fila = window.fbq.queue || [];
  const anotar = (args) => window.__fb.push(Array.from(args));
  fila.forEach(anotar);
  window.fbq.callMethod = function () { anotar(arguments); };
`;

const s = JSON.parse(
  execFileSync("node", ["smoke/semear.mjs", "--minutos", "-60", "--token", "pixel-sala", "--slug", "pixel-teste", "--com-regra"], {
    cwd: RAIZ,
    encoding: "utf8",
  }).trim().split("\n").pop(),
);
await db.webinar.update({ where: { id: s.webinarId }, data: { metaPixelId: PIXEL, jitEnabled: true, jitDelayMin: 10 } });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const contexto = await browser.newContext();
let carregouMeta = 0;
await contexto.route("**/fbevents.js", (r) => {
  carregouMeta += 1;
  return r.fulfill({ contentType: "text/javascript", body: DUBLE_FB });
});
await contexto.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE_YT }));

const chamadas = (p) => p.waitForFunction(() => (window.__fb ?? []).length > 0, null, { timeout: 15000 }).then(() => p.evaluate(() => window.__fb));
const tem = (lista, ...esperado) => lista.some((c) => esperado.every((v, i) => c[i] === v));

// inscricao
const p = await contexto.newPage();
await p.goto(`${BASE}/w/pixel-teste`);
let fb = await chamadas(p);
conferir(tem(fb, "init", PIXEL), "inscricao: inicia o pixel do proprio webinario");
conferir(tem(fb, "track", "PageView"), "inscricao: PageView");
conferir(!tem(fb, "track", "Lead"), "inscricao: Lead ainda nao");

// confirmacao
await p.click("input[value=jit]");
await p.fill("#name", "Pixel Teste");
await p.fill("#email", "pixel@teste.com");
await p.click("button[type=submit]");
await p.waitForURL(/\/obrigado\//, { timeout: 25000 });
fb = await chamadas(p);
const insc = await db.registration.findFirst({ where: { email: "pixel@teste.com" }, orderBy: { createdAt: "desc" } });
const lead = fb.find((c) => c[0] === "track" && c[1] === "Lead");
conferir(tem(fb, "init", PIXEL), "confirmacao: mesmo pixel");
conferir(lead?.[3]?.eventID === insc.id, "confirmacao: Lead com eventID = id da inscricao");

// sala
await p.goto(`${BASE}/sala/${insc.token}`);
fb = await chamadas(p);
conferir(tem(fb, "init", PIXEL) && tem(fb, "track", "PageView"), "sala: PageView com o pixel do webinario");
conferir(!tem(fb, "track", "Lead"), "sala: nao repete o Lead");

// sem pixel: nada carrega
await db.webinar.update({ where: { id: s.webinarId }, data: { metaPixelId: null } });
const antes = carregouMeta;
const vazio = await contexto.newPage();
await vazio.goto(`${BASE}/w/pixel-teste`);
await vazio.waitForSelector("text=Garantir minha vaga");
await vazio.waitForTimeout(1500);
conferir(carregouMeta === antes || process.env.NEXT_PUBLIC_META_PIXEL_ID, "sem pixel, o script da Meta nem carrega");

// painel recusa lixo
const painel = await contexto.newPage();
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", SENHA);
await painel.click("button[type=submit]");
await painel.waitForURL(`${BASE}/painel`);
await painel.goto(`${BASE}/painel/w/${s.webinarId}`);
await painel.fill("#metaPixelId", "<script>fbq('init','1')</script>");
await painel.click('button[type=submit]:has-text("Salvar")');
await painel.waitForSelector("text=O ID do pixel e so o numero", { timeout: 15000 });
conferir(true, "painel recusa codigo no lugar do ID");
await painel.fill("#metaPixelId", ` ${PIXEL} `);
await painel.click('button[type=submit]:has-text("Salvar")');
await painel.waitForSelector("text=Salvo", { timeout: 15000 });
const w = await db.webinar.findUnique({ where: { id: s.webinarId } });
conferir(w.metaPixelId === PIXEL, "painel grava o ID limpo");

await browser.close();
await db.$disconnect();

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s):`, falhas);
  process.exit(1);
}
console.log("\nPIXEL VERIFICADO");
