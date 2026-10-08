/**
 * "Comeca agora": com 0 minutos no painel, a pessoa se inscreve e cai na
 * sala sem esperar minuto nenhum.
 *
 * Prova que a opcao aparece com o texto certo, que a sessao comeca em
 * segundos (com folga para a pessoa chegar antes do primeiro segundo), que a
 * confirmacao segue sozinha para a sala, que o aviso de "comecou" nao sai
 * para quem ja esta dentro, e que inscricoes no mesmo instante caem na
 * mesma sessao.
 */
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
  execFileSync("node", ["smoke/semear.mjs", "--minutos", "-60", "--token", "agora-base", "--slug", "comeca-agora", "--com-regra"], {
    cwd: RAIZ,
    encoding: "utf8",
  }).trim().split("\n").pop(),
);
await db.webinar.update({ where: { id: s.webinarId }, data: { jitEnabled: true, jitDelayMin: 0, published: true } });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

async function inscrever(email) {
  const p = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.goto(`${BASE}/w/comeca-agora`);
  await p.waitForSelector("text=Comeca agora", { timeout: 20000 });
  await p.click("input[value=jit]");
  await p.fill("#name", "Participante Agora");
  await p.fill("#email", email);
  const antes = Date.now();
  await p.click("button[type=submit]");
  return { p, antes };
}

const { p, antes } = await inscrever("agora1@teste.com");
await p.waitForURL(/\/obrigado\//, { timeout: 25000 });
conferir(await p.isVisible("text=Comecando agora"), "a confirmacao diz que esta comecando");
conferir(!(await p.isVisible("text=Colocar na agenda")), "sem botao de agenda para quem comeca agora");

await p.waitForURL(/\/sala\//, { timeout: 15000 });
conferir(true, "a confirmacao segue sozinha para a sala");

const r = await db.registration.findFirst({
  where: { email: "agora1@teste.com" },
  orderBy: { createdAt: "desc" },
  include: { session: true },
});
const espera = (r.session.startsAt.getTime() - antes) / 1000;
conferir(espera > 5 && espera <= 25, `a sessao comeca em segundos, nao em minutos (${espera.toFixed(1)}s)`);
conferir(r.session.kind === "JIT", "sessao marcada como JIT");
conferir(r.startNoticeSentAt !== null, "aviso de 'comecou' carimbado: quem esta na sala nao recebe");

await p.waitForSelector("text=comeca em", { timeout: 15000 }).catch(() => null);
const ate = r.session.startsAt.getTime() - Date.now() + 8000;
await p.waitForSelector("text=Conversa", { timeout: Math.max(ate, 8000) }).catch(() => null);
conferir(await p.isVisible("text=Conversa"), "a sala abre sozinha quando a contagem curta acaba");
await p.close();

// duas pessoas no mesmo instante: mesma sala
const [a, b] = await Promise.all([inscrever("agora2@teste.com"), inscrever("agora3@teste.com")]);
await Promise.all([a.p.waitForURL(/\/obrigado\//, { timeout: 25000 }), b.p.waitForURL(/\/obrigado\//, { timeout: 25000 })]);
const [ra, rb] = await Promise.all(
  ["agora2@teste.com", "agora3@teste.com"].map((email) =>
    db.registration.findFirst({ where: { email }, orderBy: { createdAt: "desc" } }),
  ),
);
conferir(ra.sessionId === rb.sessionId, "inscricoes no mesmo instante caem na mesma sessao");
await a.p.close();
await b.p.close();

// painel: 0 grava, vazio volta ao padrao
await db.webinar.update({ where: { id: s.webinarId }, data: { jitDelayMin: 10 } });
const pagina = await browser.newPage();
await pagina.goto(`${BASE}/w/comeca-agora`);
conferir(await pagina.isVisible("text=Comeca em 10 minutos"), "com 10 no painel, volta a ser 'comeca em 10 minutos'");

await browser.close();
await db.$disconnect();

if (falhas.length) {
  console.log(`\n${falhas.length} falha(s):`, falhas);
  process.exit(1);
}
console.log("\nCOMECA AGORA VERIFICADO");
