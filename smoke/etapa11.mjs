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
async function sala(url) {
  const p = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.addInitScript(() => { window.__permitirSomAutomatico = true; });
  await p.goto(url);
  return p;
}

const s = semear(["--minutos", "4", "--token", "host-part", "--slug", "host-teste", "--limpar"]);
await db.registration.deleteMany({ where: { sessionId: s.sessaoId, isHost: true } });

// participante entra e escreve
const part = await sala(`${BASE}/sala/host-part`);
await part.waitForSelector("input[placeholder='Escreva aqui']", { timeout: 20000 });
await part.fill("input[placeholder='Escreva aqui']", "isso aqui respondeu minha duvida de meses");
await part.click("button:has-text('Enviar')");
await part.waitForTimeout(1500);

// ── o apresentador entra pelo painel ────────────────────────────────────
const painel = await browser.newPage({ viewport: { width: 1400, height: 950 } });
painel.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await painel.goto(`${BASE}/entrar`);
await painel.fill("#senha", "dev");
await painel.click('button[type=submit]');
await painel.waitForURL(`${BASE}/painel`);
await painel.goto(`${BASE}/painel/w/${s.webinarId}/sessoes`);
await painel.waitForSelector("button:has-text('entrar na sala')", { timeout: 20000 });
await painel.click("button:has-text('entrar na sala')");
await painel.waitForURL(/\/sala\//, { timeout: 20000 });
const tokenHost = painel.url().split("/sala/")[1];
conferir(true, `o painel leva o apresentador para a mesma tela da sala (${tokenHost.slice(0, 8)}...)`);

const reg = await db.registration.findUnique({ where: { token: tokenHost } });
conferir(reg.isHost === true, "a inscrição do apresentador nasce marcada como isHost");

// ── mesma tela, sem interface paralela ──────────────────────────────────
await painel.waitForSelector("text=Conversa", { timeout: 20000 });
conferir(await painel.isVisible("input[placeholder='Escreva aqui']"), "é a mesma sala: o player e o mesmo campo de escrever");
await painel.waitForSelector("text=assistindo agora", { timeout: 20000 });
// a faixa nasce com "—" e só ganha número quando a primeira consulta volta
await painel.waitForFunction(
  () => /\d+\s+assistindo agora/.test(document.body.innerText),
  null,
  { timeout: 25000 },
);
const faixa = await painel.innerText("text=assistindo agora");
log("faixa do apresentador:", faixa.replace(/\n/g, " "));

// ── ele vê quem está assistindo ─────────────────────────────────────────
await painel.click("text=ver quem");
await painel.waitForSelector("#lista-audiencia li", { timeout: 15000 });
const audiencia = await painel.innerText("#lista-audiencia");
conferir(/Participante Teste/.test(audiencia), "a lista traz o nome de quem está na sala");
conferir(/\d+:\d\d/.test(audiencia), "a lista traz em que minuto do vídeo cada um está");

// ── vê o chat inteiro mesmo com chat ao vivo desligado ──────────────────
// a consulta do chat é de 6 em 6 segundos: esperamos ela, não o instante
await painel.waitForSelector("text=respondeu minha duvida", { timeout: 25000 });
conferir(true, "o apresentador vê o comentário aguardando, mesmo com o chat ao vivo desligado");
await painel.waitForSelector("text=Liberar para a sala", { timeout: 15000 });
conferir(true, "e tem o botão de liberar ali mesmo");

// ── o participante ainda não vê ─────────────────────────────────────────
// na MESMA sessão: comentário de uma sessão não viaja para outra, e é a
// trilha (carregada com a página) que leva o aprovado para as seguintes
await db.registration.deleteMany({ where: { token: "host-part2" } });
await db.registration.create({
  data: { sessionId: s.sessaoId, name: "Segunda Pessoa", email: "segunda@teste.com", token: "host-part2" },
});
const part2 = await sala(`${BASE}/sala/host-part2`);
await part2.waitForSelector("text=Conversa", { timeout: 20000 });
await part2.waitForTimeout(7000);
conferir(
  !(await part2.isVisible("text=respondeu minha duvida")),
  "antes de liberar, o comentário não chega em quem está na sala",
);

// ── liberar é aprovar ───────────────────────────────────────────────────
await painel.click("text=Liberar para a sala");
await painel.waitForSelector("text=Liberar para a sala", { state: "hidden", timeout: 20000 });
conferir(true, "9.6 o botão só muda depois que o servidor confirma");

await part2.waitForSelector("text=respondeu minha duvida", { timeout: 25000 });
conferir(true, "liberado, o comentário aparece para a sala");

const msg = await db.chatMessage.findFirst({ where: { body: { contains: "respondeu minha duvida" } } });
conferir(msg.status === "APPROVED", "liberar é aprovar: entra no replay das próximas sessões");

// ── o apresentador escreve: selo e vai para o replay ────────────────────
await painel.fill("input[placeholder='Escreva aqui']", "boa pergunta, vou responder agora");
await painel.click("button:has-text('Enviar')");
await painel.waitForTimeout(2000);
const doHost = await db.chatMessage.findFirst({ where: { body: { contains: "boa pergunta" } } });
conferir(doHost?.kind === "HOST" && doHost?.status === "APPROVED", "o comentário do apresentador nasce com selo e já aprovado");
await part2.waitForSelector("text=boa pergunta", { timeout: 25000 });
const bolha = await part2.innerText("li:has-text('boa pergunta')");
conferir(/apresentador/i.test(bolha), "na sala ele aparece com selo de apresentador");

// ── 9.11: o apresentador fora de tudo ───────────────────────────────────
const audienciaApi = await fetch(`${BASE}/api/sala/${tokenHost}/audiencia`).then((r) => r.json());
conferir(
  !audienciaApi.pessoas.some((p) => p.email === "apresentador@local"),
  "9.11 o apresentador não aparece na própria lista de audiência",
);

await painel.goto(`${BASE}/painel/w/${s.webinarId}/desempenho`);
await painel.waitForSelector("text=Inscritos", { timeout: 20000 });
const inscritos = await painel.locator("div.cartao:has-text('Inscritos') p.text-2xl").first().innerText();
conferir(inscritos.trim() === "2", `9.11 o apresentador não conta como inscrito (${inscritos.trim()} de 2 participantes)`);

// ── só o apresentador pode liberar ──────────────────────────────────────
const tentativa = await fetch(`${BASE}/api/sala/host-part2/liberar`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: msg.id }),
});
conferir(tentativa.status === 403, `participante não pode liberar comentário (${tentativa.status})`);
const espiada = await fetch(`${BASE}/api/sala/host-part2/audiencia`);
conferir(espiada.status === 403, `participante não pode ver a lista de audiência (${espiada.status})`);

await part.close(); await part2.close(); await painel.close();
await browser.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 11 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
