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

const s = semear(["--minutos", "6", "--token", "enq-a", "--slug", "enquete-teste", "--limpar"]);

// ── painel: criar enquete, com campos controlados (9.7) ─────────────────
const painel = await browser.newPage({ viewport: { width: 1400, height: 950 } });
painel.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", "dev");
await painel.click('button[type=submit]');
await painel.waitForURL(`${BASE}/painel`);
await painel.goto(`${BASE}/painel/w/${s.webinarId}/enquetes`);
await painel.waitForSelector("text=Nova enquete", { timeout: 20000 });

// primeiro, um erro de propósito: minuto mal formatado
await painel.fill("#question", "Voce ja opera com robo hoje?");
await painel.fill("#opcoes", "Ja opero\nEstou testando\nNunca operei");
await painel.fill("#atSec", "oito da noite");
await painel.click("button:has-text('Criar enquete')");
await painel.waitForSelector("text=em que ponto do video", { timeout: 20000 });
conferir(
  (await painel.inputValue("#opcoes")).includes("Nunca operei"),
  "9.7 as opções sobrevivem ao erro — digitar a enquete inteira e perder tudo é inaceitável",
);

await painel.fill("#atSec", "5:00");
await painel.fill("#untilSec", "20:00");
await painel.click("button:has-text('Criar enquete')");
await painel.waitForSelector("#lista-enquetes > li", { timeout: 20000 });
conferir(true, "enquete criada com entrada e saída");

// uma enquete que a sessão ainda não alcançou, para o teste de 5.4
await painel.fill("#question", "Segunda pergunta");
await painel.fill("#opcoes", "Sim\nNao");
await painel.fill("#atSec", "40:00");
await painel.fill("#untilSec", "");
await painel.click("button:has-text('Criar enquete')");
await painel.waitForFunction(() => document.querySelectorAll("#lista-enquetes > li").length === 2, null, { timeout: 20000 });

const [noAr, futura] = await db.poll.findMany({ where: { webinarId: s.webinarId }, orderBy: { atSec: "asc" }, include: { options: true } });

// ── a sala mostra a enquete fixada no alto do chat ──────────────────────
const a = await sala("enq-a");
await a.waitForSelector("text=Voce ja opera com robo hoje?", { timeout: 25000 });
conferir(true, "a enquete do minuto aparece na sala");
conferir(
  !(await a.isVisible("text=Segunda pergunta")),
  "5.4 a enquete que a sessão ainda não alcançou não aparece",
);
const dentroDaEsteira = await a.locator("aside ul li:has-text('Voce ja opera')").count();
conferir(dentroDaEsteira === 0, "a enquete fica fixada no alto, fora da esteira de comentários");

// ── votar ───────────────────────────────────────────────────────────────
await a.click("button:has-text('Estou testando')");
await a.waitForSelector("text=pode trocar", { timeout: 15000 });
let voto = await db.pollVote.findFirst({ where: { pollId: noAr.id }, include: { option: true } });
conferir(voto?.option.label === "Estou testando", "o voto foi gravado");

// ── um voto por pessoa, com direito a trocar ────────────────────────────
await a.click("button:has-text('Ja opero')");
await a.waitForTimeout(1500);
const votos = await db.pollVote.findMany({ where: { pollId: noAr.id }, include: { option: true } });
conferir(votos.length === 1, `um voto por pessoa (${votos.length})`);
conferir(votos[0].option.label === "Ja opero", "e com direito a trocar");

// ── 5.4: votar numa enquete fora do ar é recusado ───────────────────────
const foraDoAr = await fetch(`${BASE}/api/sala/enq-a/voto`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ pollId: futura.id, optionId: futura.options[0].id }),
});
conferir(foraDoAr.status === 409, `5.4 conhecer o identificador não basta para votar numa enquete que a sessão não alcançou (${foraDoAr.status})`);
const nenhum = await db.pollVote.count({ where: { pollId: futura.id } });
conferir(nenhum === 0, "e nada foi gravado");

// ── opção de outra enquete é recusada ───────────────────────────────────
const trocada = await fetch(`${BASE}/api/sala/enq-a/voto`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ pollId: noAr.id, optionId: futura.options[0].id }),
});
conferir(trocada.status === 400, `opção que não é da enquete é recusada (${trocada.status})`);

// ── a enquete viaja junto do chat ───────────────────────────────────────
const resposta = await fetch(`${BASE}/api/sala/enq-a/chat`).then((r) => r.json());
conferir(
  resposta.enquete?.id === noAr.id && Array.isArray(resposta.mensagens),
  "a enquete viaja junto do chat, na mesma consulta",
);

// ── apuração em barras no painel ────────────────────────────────────────
await painel.reload();
await painel.waitForSelector("#lista-enquetes > li", { timeout: 20000 });
const apuracao = await painel.innerText("#lista-enquetes");
log("apuração:", apuracao.replace(/\n/g, " · ").slice(0, 160));
conferir(/1 voto/.test(apuracao), "o painel mostra a apuração");
conferir(/100%/.test(apuracao), "com a barra em porcentagem");

// ── 9.11: o apresentador não vota ───────────────────────────────────────
await db.registration.deleteMany({ where: { token: "enq-host" } });
await db.registration.create({
  data: { sessionId: s.sessaoId, name: "Host", email: "h@t.com", token: "enq-host", isHost: true },
});
const tentativaHost = await fetch(`${BASE}/api/sala/enq-host/voto`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ pollId: noAr.id, optionId: noAr.options[0].id }),
});
conferir(tentativaHost.status === 403, `9.11 o apresentador não vota na própria enquete (${tentativaHost.status})`);

await a.close(); await painel.close();
await browser.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 12 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
