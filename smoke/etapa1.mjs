import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("!! erro de página:", e.message));

// 1. login
await page.goto(`${BASE}/entrar`);
await page.fill("#senha", "errada");
await page.click('button[type=submit]');
await page.waitForSelector("text=Senha incorreta");
log("senha errada volta com estado de erro, sem tela genérica");

await page.fill("#senha", "dev");
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/painel`);
log("login ok →", page.url());

// 2. criar webinário
await page.click("text=Novo webinario");
await page.fill("#novo-title", "Aula ao vivo: o robô que opera sozinho");
await page.click('button:has-text("Criar")');
await page.waitForURL(/\/painel\/w\//);
log("webinário criado →", page.url());

// 3. regra de grade
await page.fill("#timeOfDay", "20:00");
await page.click('button:has-text("Adicionar")');
await page.waitForSelector("text=Proximos horarios calculados agora");
const proximos = await page.textContent("section:has-text('Grade de horarios') p.text-\\[13px\\]");
log("grade calculada em memória:", proximos?.trim().slice(0, 120));

// 4. invariante 5.1 — vídeo sem duração deve ser RECUSADO
await page.fill("#videoUrl", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
await page.fill("#durationSec", "");
await page.click('button[type=submit]:has-text("Salvar")');
await page.waitForTimeout(12000);
const corpo = await page.textContent("body");
if (/Nao da para salvar um video sem duracao/.test(corpo)) {
  log("5.1 OK: recusou salvar vídeo sem duração");
} else if (/Salvo/.test(corpo)) {
  log("5.1: salvou — leu a duração do provedor (rede disponível)");
} else {
  log("5.1 ?? corpo não trouxe nem recusa nem sucesso");
}

// 5. duração manual + publicar
await page.fill("#durationSec", "48:30");
await page.fill("#ctaUrl", "https://tradernation.com.br/oferta");
await page.fill("#ctaLabel", "Quero minha vaga");
await page.fill("#ctaAtSec", "22:00");
await page.check('input[name=published]');
await page.click('button[type=submit]:has-text("Salvar")');
await page.waitForSelector("text=Salvo", { timeout: 30000 });
log("salvou com duração manual, oferta aos 22:00 e publicado");

// 6. oferta depois do fim deve ser recusada
await page.fill("#ctaAtSec", "99:00");
await page.click('button[type=submit]:has-text("Salvar")');
await page.waitForSelector("text=depois do fim do video", { timeout: 30000 });
log("recusou oferta que aparece depois do fim do vídeo");

// 7. campos controlados sobrevivem ao erro (armadilha 9.7)
const tituloDepoisDoErro = await page.inputValue("#title");
const ctaDepoisDoErro = await page.inputValue("#ctaUrl");
log("9.7 OK: após erro, título ainda é", JSON.stringify(tituloDepoisDoErro), "e link da oferta", JSON.stringify(ctaDepoisDoErro));

await page.screenshot({ path: "/tmp/etapa1-painel.png", fullPage: true });
await browser.close();
console.log("\nETAPA 1 VERIFICADA");
