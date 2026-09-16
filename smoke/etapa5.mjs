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

// ── Painel: colar em lote, com relatório linha a linha ───────────────────
const base = semear(["--minutos", "1", "--token", "chat-token", "--slug", "chat-teste", "--limpar"]);
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("!! erro de página:", e.message));

await page.goto(`${BASE}/entrar`);
await page.fill("#senha", "dev");
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/painel`);
await page.goto(`${BASE}/painel/w/${base.webinarId}/roteiro`);
await page.waitForSelector("text=Roteiro do chat");

await page.click("text=Colar em lote");
const lote = [
  "Marcia Rocha | 0:20 | cheguei agora, deu tempo?",
  "Paulo H. | 0:50 | essa parte do risco eu nunca tinha ouvido assim",
  "",
  "linha sem separador nenhum",
  "Fulano | onze e meia | tempo que ninguem entende",
  "Ciclano | 99:00 | isso fica depois do fim do video",
  "| 1:00 | esse nao tem nome",
  "Beltrano | 2:00 | ",
  "Marcia Rocha | 0:20 | cheguei agora, deu tempo?",
  "Ana Paula | 1:30 | o grafico ficou claro agora",
].join("\n");
await page.fill("textarea[name=lote]", lote);
await page.click('button:has-text("Gravar linhas")');
await page.waitForSelector("text=ficou de fora", { timeout: 20000 });

const relatorio = await page.$$eval("li", (lis) =>
  lis.map((l) => l.innerText).filter((t) => /^linha \d/.test(t.trim())),
);
log("relatório:");
for (const r of relatorio) console.log("   ", r.replace(/\n/g, " → "));

// innerText("form") pegaria o primeiro <form> da página, que é o de sair.
const resumo = await page.locator("text=gravadas").first().innerText().catch(() => "");
const noRoteiro = await page.locator("#lista-roteiro > li").count();
conferir(/^3 gravadas$/.test(resumo.trim()), `gravou só as 3 linhas boas (resumo: "${resumo.trim()}")`);
conferir(noRoteiro === 3, `o roteiro ficou com 3 comentários (${noRoteiro})`);
conferir(relatorio.some((r) => /linha 4/.test(r) && /separador/.test(r)), "linha sem separador é reportada com o motivo");
conferir(relatorio.some((r) => /linha 5/.test(r) && /nao entendido/.test(r)), "tempo ilegível é reportado");
conferir(relatorio.some((r) => /linha 6/.test(r) && /depois do fim/.test(r)), "ponto depois do fim do vídeo é reportado");
conferir(relatorio.some((r) => /linha 7/.test(r) && /sem nome/.test(r)), "linha sem nome é reportada");
conferir(relatorio.some((r) => /linha 8/.test(r) && /vazio/.test(r)), "comentário vazio é reportado");
conferir(relatorio.some((r) => /linha 9/.test(r) && /ja estava/.test(r)), "linha repetida é reportada, não duplicada");

const corpos = await page.$$eval("section li p", (ps) => ps.map((p) => p.textContent ?? ""));
conferir(!corpos.some((c) => c.includes("\r")), "9.8 nenhum \\r sobrou no que foi gravado");

// ── A sala revela a trilha conforme o vídeo anda ────────────────────────
const sala = await browser.newPage({ viewport: { width: 1400, height: 900 } });
sala.on("pageerror", (e) => console.log("!! erro de página:", e.message));
await sala.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
await sala.addInitScript(() => { window.__permitirSomAutomatico = true; });

semear(["--minutos", "0.1", "--token", "chat-sala", "--slug", "chat-teste"]);
await sala.goto(`${BASE}/sala/chat-sala`);
await sala.waitForSelector("text=Conversa", { timeout: 20000 });

const visiveis = () => sala.$$eval("aside li p", (ps) => ps.map((p) => (p.textContent ?? "").trim()));
const cedo = await visiveis();
conferir(cedo.length === 0, `no começo a conversa está vazia (${cedo.length} mensagens)`);

await sala.waitForFunction(() => document.querySelectorAll("aside li p").length >= 1, null, { timeout: 40000 });
const depois = await visiveis();
conferir(
  depois.some((t) => /cheguei agora/.test(t)),
  `aos ~20s aparece o comentário ancorado em 0:20 (${depois.length} visível)`,
);
conferir(
  !depois.some((t) => /grafico ficou claro/.test(t)),
  "o comentário de 1:30 ainda NÃO aparece — a trilha é revelada, não despejada",
);

const requisicoes = [];
sala.on("request", (r) => requisicoes.push(r.url()));
await sala.waitForTimeout(6000);
const consultas = requisicoes.filter((u) => /\/api\/(chat|mensagens)/.test(u));
conferir(consultas.length === 0, `a trilha não gera consulta periódica (${consultas.length} chamadas)`);

await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 5 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
