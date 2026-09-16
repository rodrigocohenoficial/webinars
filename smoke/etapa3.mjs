import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const DUBLE = readFileSync(new URL("./dubles/youtube.js", import.meta.url), "utf8");
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

function semear(minutos, token) {
  const saida = execFileSync("node", ["smoke/semear.mjs", "--minutos", String(minutos), "--token", token], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
  });
  return JSON.parse(saida.trim().split("\n").pop());
}

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

async function abrirSala(token, { somAutomatico = false } = {}) {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await page.route("**/iframe_api*", (rota) =>
    rota.fulfill({ contentType: "text/javascript", body: DUBLE }),
  );
  await page.addInitScript((v) => {
    window.__permitirSomAutomatico = v;
  }, somAutomatico);
  await page.goto(`${BASE}/sala/${token}`);
  return page;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Sessão em andamento há 12 minutos, navegador recusando som automático
// ─────────────────────────────────────────────────────────────────────────
const live = semear(12, "sala-live");
let page = await abrirSala("sala-live");

await page.waitForFunction(() => window.__espiao?.vars, null, { timeout: 20000 });
const vars = await page.evaluate(() => window.__espiao.vars);
log("playerVars:", JSON.stringify(vars));

const alvoEsperado = 12 * 60;
conferir(
  Math.abs(Number(vars.start) - alvoEsperado) <= 20,
  `4.3 vídeo posicionado em agora-início (start=${vars.start}s, esperado ≈${alvoEsperado}s)`,
);
conferir(Number(vars.controls) === 0, "sem barra de progresso (controls=0)");
conferir(Number(vars.disablekb) === 1, "teclado desabilitado");

// cortina cobrindo a marca do provedor (9.4)
const cortinaNoInicio = await page.isVisible("text=entrando na sessao");
conferir(cortinaNoInicio, "9.4 cortina cobre o player nos primeiros segundos");

// 9.2: recusou com som, caiu para mudo
await page.waitForSelector("text=Toque para ouvir", { timeout: 20000 });
conferir(true, "9.2 som automático recusado → caiu para mudo e ofereceu o toque");
const mudoAgora = await page.evaluate(() => window.__player.isMuted());
conferir(mudoAgora === true, "o player está de fato mudo nesse estado");

// a cortina abre sozinha depois de ~4s
await page.waitForSelector("text=entrando na sessao", { state: "hidden", timeout: 12000 });
conferir(true, "9.4 cortina abre sozinha depois dos primeiros segundos");

// ─────────────────────────────────────────────────────────────────────────
// 2. Armadilha 9.3: ativar o som NÃO pode dar seek
// ─────────────────────────────────────────────────────────────────────────
const seeksAntes = await page.evaluate(() => window.__espiao.seeks.length);
await page.click("text=Toque para ouvir");
await page.waitForTimeout(900);
const seeksDepois = await page.evaluate(() => window.__espiao.seeks.length);
const desmutou = await page.evaluate(() => window.__player.isMuted() === false);
conferir(seeksDepois === seeksAntes, `9.3 nenhum seek no gesto de ativar o som (antes=${seeksAntes}, depois=${seeksDepois})`);
conferir(desmutou, "9.3 o som foi ativado e o vídeo continuou tocando");
await page.waitForSelector("text=Toque para ouvir", { state: "hidden", timeout: 8000 });

// ─────────────────────────────────────────────────────────────────────────
// 3. Deriva: só ressincroniza quando passa de 3 segundos
// ─────────────────────────────────────────────────────────────────────────
await page.evaluate(() => window.__player.__atrasar(1.5));
const seeksPre = await page.evaluate(() => window.__espiao.seeks.length);
await page.waitForTimeout(5000);
const seeksPos = await page.evaluate(() => window.__espiao.seeks.length);
conferir(seeksPos === seeksPre, `deriva de 1,5s é tolerada, sem rebufferizar (seeks=${seeksPos - seeksPre})`);

await page.evaluate(() => window.__player.__atrasar(10));
await page.waitForTimeout(5000);
const seeksFinal = await page.evaluate(() => window.__espiao.seeks);
conferir(
  seeksFinal.length > seeksPos,
  `deriva de 10s é corrigida (${seeksFinal.length - seeksPos} seek)`,
);
if (seeksFinal.length > seeksPos) {
  const ultimo = seeksFinal[seeksFinal.length - 1].segundo;
  conferir(Math.abs(ultimo - (12 * 60 + 25)) < 60, `o seek foi para o ponto do relógio (${Math.round(ultimo)}s)`);
}
await page.close();

// ─────────────────────────────────────────────────────────────────────────
// 4. Navegador que permite som automático: toca direto, sem pedir toque
// ─────────────────────────────────────────────────────────────────────────
semear(3, "sala-live-som");
page = await abrirSala("sala-live-som", { somAutomatico: true });
await page.waitForFunction(() => window.__espiao?.estados?.includes(1), null, { timeout: 20000 });
const pediuToque = await page.isVisible("text=Toque para ouvir");
const mudo2 = await page.evaluate(() => window.__player.isMuted());
conferir(!pediuToque && mudo2 === false, "9.2 quando o som é permitido, toca com som e não pede nada");
await page.close();

// ─────────────────────────────────────────────────────────────────────────
// 5. Nem mudo tocou: entrada manual
// ─────────────────────────────────────────────────────────────────────────
semear(4, "sala-recusa");
page = await browser.newPage();
await page.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
await page.addInitScript(() => {
  window.__bloquearTudo = true;
});
await page.route("**/sala/**", (r) => r.continue());
await page.goto(`${BASE}/sala/sala-recusa`);
await page.waitForFunction(() => window.__player, null, { timeout: 20000 });
await page.evaluate(() => {
  // o dublê passa a recusar até gesto real, inclusive mudo
  window.__player.playVideo = function () {
    window.__espiao.plays++;
  };
});
await page.waitForSelector("text=Entrar na sessao", { timeout: 20000 });
conferir(true, "9.2 quando nem mudo toca, a sala oferece entrada manual");
await page.close();

// ─────────────────────────────────────────────────────────────────────────
// 6. Fases pelo relógio
// ─────────────────────────────────────────────────────────────────────────
semear(-5, "sala-espera");
page = await abrirSala("sala-espera");
await page.waitForSelector("text=Ainda nao comecou", { timeout: 15000 });
conferir(true, "fase WAITING antes do início");
await page.close();

semear(60, "sala-fim");
page = await abrirSala("sala-fim");
await page.waitForSelector("text=encerrada", { timeout: 15000 });
conferir(true, "fase ENDED depois da duração — 5.1 fecha a sessão em vez de deixar o player em branco");
await page.close();

await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 3 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
