/**
 * A sala num telefone.
 *
 * O recorte que esconde a marca do provedor deixa o player maior que a caixa
 * de propósito — e no Safari do iPhone isso fazia a página inteira deslizar
 * de lado, cortando o título.
 *
 * AVISO SOBRE O ALCANCE DESTE TESTE: ele roda em Chromium, que já clipava
 * certo mesmo antes da correção. Ou seja, ele NÃO reproduz o defeito do
 * Safari — conferimos, e ele passa com e sem a correção. O que ele pega é
 * outra coisa, que também vale: conta errada de largura, título encostando
 * na borda, barra por cima do vídeo, campo de escrever espremido. Para o
 * comportamento do iPhone, só olho em iPhone.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const DUBLE = readFileSync(new URL("./dubles/youtube.js", import.meta.url), "utf8");
const RAIZ = new URL("..", import.meta.url).pathname;
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

execFileSync("node", ["smoke/semear.mjs", "--minutos", "1", "--token", "cel-teste", "--slug", "celular", "--limpar"], { cwd: RAIZ });

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});

for (const [nome, largura, altura] of [
  ["iPhone", 390, 844],
  ["telefone pequeno", 360, 740],
]) {
  const p = await browser.newPage({ viewport: { width: largura, height: altura }, isMobile: true, hasTouch: true });
  p.on("pageerror", (e) => console.log("!! erro de página:", e.message));
  await p.route("**/iframe_api*", (r) => r.fulfill({ contentType: "text/javascript", body: DUBLE }));
  await p.addInitScript(() => { window.__permitirSomAutomatico = true; });
  await p.goto(`${BASE}/sala/cel-teste`);
  await p.waitForSelector("text=Conversa", { timeout: 25000 });
  await p.waitForTimeout(2500);

  const medidas = await p.evaluate(() => {
    const doc = document.documentElement;
    return { largura: doc.clientWidth, rolagem: doc.scrollWidth };
  });
  conferir(
    medidas.rolagem <= medidas.largura,
    `${nome}: a página não desliza de lado (${medidas.rolagem} de ${medidas.largura})`,
  );

  const titulo = await p.locator("h1").boundingBox();
  conferir(titulo.x >= 15, `${nome}: o título não fica cortado na borda (x=${Math.round(titulo.x)})`);

  const player = await p.evaluate(() => {
    const el = document.querySelector('[style*="aspect-ratio"]');
    const c = el?.getBoundingClientRect();
    return c ? { bottom: c.bottom, right: c.right } : null;
  });
  const barra = await p.locator("button[aria-label*='reagir']").first().boundingBox();
  conferir(
    barra.y > player.bottom - 2,
    `${nome}: a barra de reações fica abaixo do vídeo, não por cima do rosto`,
  );

  const escrever = await p.locator("input[placeholder='Escreva aqui']").boundingBox();
  conferir(escrever.width > 120, `${nome}: o campo de escrever cabe na tela (${Math.round(escrever.width)}px)`);

  await p.close();
}

await browser.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nCELULAR VERIFICADO");
process.exit(falhas.length ? 1 : 0);
