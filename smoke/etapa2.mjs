import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const SLUG = process.env.SLUG ?? "o-robo-que-opera-sozinho";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("!! erro de página:", e.message));

await page.goto(`${BASE}/w/${SLUG}`);
await page.waitForSelector("text=Garantir minha vaga");
const horarios = await page.$$eval("input[name=slot]", (els) => els.map((e) => e.value));
log("horários oferecidos:", horarios.length);

// ── O ataque: mandar um timestamp que a grade nunca gerou ────────────────
const forjado = String(Date.parse("2026-09-20T06:17:00.000Z")); // domingo 03:17
// Preencher ANTES: cada digitacao re-renderiza o React e devolveria o valor
// original ao radio. O ataque de verdade e mexer no DOM no ultimo instante.
await page.fill("#name", "Invasor");
await page.fill("#email", "invasor@teste.com");
await page.evaluate((v) => {
  for (const el of document.querySelectorAll("input[name=slot]")) el.value = v;
}, forjado);
const valorNoMomentoDoEnvio = await page.$eval("input[name=slot]", (e) => e.value);
log("valor forjado no formulário no instante do envio:", valorNoMomentoDoEnvio);
await page.click('button[type=submit]');
await page.waitForTimeout(2500);
const corpo = await page.textContent("body");
if (/nao esta mais disponivel/i.test(corpo)) {
  log("5.3 OK: horário forjado recusado pelo servidor");
} else if (/obrigado/.test(page.url())) {
  throw new Error("FALHA DE SEGURANÇA: horário forjado foi aceito → " + page.url());
} else {
  log("?? resposta inesperada ao horário forjado:", page.url());
}

// ── Inscrição de verdade ────────────────────────────────────────────────
await page.goto(`${BASE}/w/${SLUG}`);
await page.click("input[name=slot]");
await page.fill("#name", "Rodrigo Cohen");
await page.fill("#email", "Rodrigo@Teste.com");
await page.fill("#phone", "(48) 99999-8888");
await page.click('button[type=submit]');
await page.waitForURL(/\/obrigado\//, { timeout: 20000 });
const url1 = page.url();
log("inscrição criada →", url1);
await page.waitForSelector("text=vaga confirmada");
const linkSala = await page.inputValue("input[readonly]");
log("link pessoal:", linkSala);

// ── Mesmo e-mail, mesmo horário: devolve o mesmo link ───────────────────
await page.goto(`${BASE}/w/${SLUG}`);
await page.click("input[name=slot]");
await page.fill("#name", "Rodrigo Cohen");
await page.fill("#email", "rodrigo@teste.com");
await page.click('button[type=submit]');
await page.waitForURL(/\/obrigado\//, { timeout: 20000 });
log(page.url() === url1 ? "4.1.6 OK: mesmo e-mail devolveu o link existente" : `FALHA: duplicou → ${page.url()}`);

// ── .ics ────────────────────────────────────────────────────────────────
const token = url1.split("/obrigado/")[1];
const ics = await (await fetch(`${BASE}/api/ics/${token}`)).text();
log("ics:", /DTSTART:\d{8}T\d{6}Z/.test(ics) ? "com DTSTART em UTC ✓" : "SEM DTSTART ✗", "| alarme 15min:", /TRIGGER:-PT15M/.test(ics) ? "✓" : "✗");

// ── Nenhuma palavra proibida na tela do participante (5.6 / 9.10) ───────
for (const rota of [`/w/${SLUG}`, `/obrigado/${token}`]) {
  await page.goto(BASE + rota);
  // textContent do body inclui os <script> do RSC, onde nomes de campo como
  // videoUrl aparecem. O participante nao le isso: so o texto visivel conta.
  const t = (await page.evaluate(() => {
    const c = document.body.cloneNode(true);
    c.querySelectorAll("script,style,template").forEach((n) => n.remove());
    return c.innerText || c.textContent || "";
  })).toLowerCase();
  const proibidas = ["ao vivo", "gravação", "gravacao", "replay", "vídeo", "video"].filter((p) => t.includes(p));
  log(`5.6 ${rota}:`, proibidas.length ? `PALAVRAS PROIBIDAS → ${proibidas.join(", ")}` : "limpo ✓");
}

await browser.close();
console.log("\nETAPA 2 VERIFICADA");
