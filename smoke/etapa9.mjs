/**
 * Avisos automáticos. Nada de e-mail de verdade: subimos um servidor local
 * fazendo o papel do Resend e da Z-API (RESEND_API_URL e ZAPI_BASE_URL
 * apontam para ele) e conferimos as REGRAS, que é o que pode quebrar.
 */
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const SEGREDO = process.env.CRON_SECRET ?? "dev-cron";
const db = new PrismaClient();
const log = (...a) => console.log("•", ...a);
const falhas = [];
const conferir = (ok, msg) => (ok ? log(msg, "✓") : (falhas.push(msg), log(msg, "✗ FALHOU")));

// ── o dublê dos provedores ──────────────────────────────────────────────
let enviados = [];
const servidor = createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const dados = JSON.parse(corpo || "{}");
    enviados.push({
      canal: req.url.includes("zapi") ? "whatsapp" : "email",
      para: dados.to?.[0] ?? dados.phone,
      assunto: dados.subject ?? "",
      corpo: dados.html ?? dados.message ?? "",
      responderPara: dados.reply_to ?? null,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg_" + enviados.length, messageId: "zap_" + enviados.length }));
  });
});
await new Promise((r) => servidor.listen(4545, "127.0.0.1", r));
const limpar = () => (enviados = []);
const rodarCron = async () => {
  const r = await fetch(`${BASE}/api/cron?secret=${SEGREDO}`);
  return r.json();
};

// ── cenários ────────────────────────────────────────────────────────────
const min = (n) => new Date(Date.now() + n * 60000);

async function webinario(slug, { comVideo = true } = {}) {
  return db.webinar.upsert({
    where: { slug },
    update: {
      published: true,
      videoUrl: comVideo ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
      durationSec: comVideo ? 1800 : null,
    },
    create: {
      slug,
      title: `Sessao de teste ${slug.replace(/[^a-z]/g, " ").trim()}`,
      published: true,
      videoUrl: comVideo ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
      durationSec: comVideo ? 1800 : null,
    },
  });
}

async function inscrito(w, quando, { criadoEm, compareceu = false, nome, email }) {
  const sessao = await db.session.create({
    data: { webinarId: w.id, startsAt: quando, ruleKey: `aviso:${Math.random()}`, kind: "SCHEDULED" },
  });
  return db.registration.create({
    data: {
      sessionId: sessao.id,
      name: nome,
      email,
      phone: "48999998888",
      token: `av-${Math.random().toString(36).slice(2, 12)}`,
      createdAt: criadoEm,
      firstSeenAt: compareceu ? new Date() : null,
    },
  });
}

await db.registration.deleteMany({ where: { email: { contains: "@avisos.teste" } } });

// os nomes evitam de proposito as palavras que a regra 5.6 proibe: o teste
// varre o texto das mensagens e o titulo entra nele
const wCom = await webinario("avisos-prontos");
const wSem = await webinario("avisos-pendentes", { comVideo: false });

const comAntecedencia = await inscrito(wCom, min(10), { criadoEm: min(-180), nome: "Marcia", email: "marcia@avisos.teste" });
const ultimaHora = await inscrito(wCom, min(10), { criadoEm: min(-5), nome: "Paulo", email: "paulo@avisos.teste" });
const comecando = await inscrito(wCom, min(-2), { criadoEm: min(-120), nome: "Ana", email: "ana@avisos.teste" });
const comecouHaMuito = await inscrito(wCom, min(-12), { criadoEm: min(-120), nome: "Jose", email: "jose@avisos.teste" });
const semVideo = await inscrito(wSem, min(10), { criadoEm: min(-180), nome: "Carla", email: "carla@avisos.teste" });
// sessão de 30min que terminou há 2h → começou há 2h30
const faltou = await inscrito(wCom, min(-150), { criadoEm: min(-400), nome: "Rita", email: "rita@avisos.teste" });
const veio = await inscrito(wCom, min(-150), { criadoEm: min(-400), compareceu: true, nome: "Bruno", email: "bruno@avisos.teste" });
// terminou há 10h: passou do teto
const velho = await inscrito(wCom, min(-640), { criadoEm: min(-900), nome: "Antigo", email: "antigo@avisos.teste" });

// ── a rota é protegida por segredo ──────────────────────────────────────
const semSegredo = await fetch(`${BASE}/api/cron`);
conferir(semSegredo.status === 401, `a rota do agendador exige segredo (${semSegredo.status})`);
const segredoErrado = await fetch(`${BASE}/api/cron?secret=errado`);
conferir(segredoErrado.status === 401, `segredo errado é recusado (${segredoErrado.status})`);

// ── primeira passagem ───────────────────────────────────────────────────
limpar();
const r1 = await rodarCron();
log("resultado:", JSON.stringify(r1));

const para = (e) => enviados.filter((x) => x.para === e || x.para === "5548999998888");
const emailsPara = (e) => enviados.filter((x) => x.canal === "email" && x.para === e);

conferir(emailsPara("marcia@avisos.teste").length === 1, "lembrete sai para quem se inscreveu com antecedência");
conferir(
  enviados.filter((x) => x.canal === "whatsapp").length >= 1,
  "o lembrete também sai pelo WhatsApp de quem deu o número",
);
conferir(emailsPara("paulo@avisos.teste").length === 0, "inscrição de última hora NÃO recebe lembrete");
conferir(emailsPara("ana@avisos.teste").length === 1, 'aviso de "começou agora" sai dentro da folga de 4 minutos');
conferir(emailsPara("jose@avisos.teste").length === 0, "sessão que começou há 12 minutos não dispara mais o aviso de início");
conferir(emailsPara("carla@avisos.teste").length === 0, "webinário sem vídeo publicado não dispara aviso nenhum");
conferir(emailsPara("rita@avisos.teste").length === 1, "convite de replay sai para quem nunca entrou");
conferir(emailsPara("bruno@avisos.teste").length === 0, "quem compareceu não recebe convite de replay");
conferir(emailsPara("antigo@avisos.teste").length === 0, "o teto de 6h impede disparo para todo no-show histórico");

const conviteRita = emailsPara("rita@avisos.teste")[0];
conferir(/\/replay\//.test(conviteRita?.corpo ?? ""), "o convite leva para o link de replay individual");

// quem responder "nao consigo entrar" precisa chegar em alguem
const comResposta = enviados.filter((e) => e.canal === "email" && e.responderPara);
conferir(
  comResposta.length === enviados.filter((e) => e.canal === "email").length &&
    comResposta.length > 0,
  `todo e-mail sai com endereco de resposta (${comResposta[0]?.responderPara})`,
);

// ── o carimbo é a trava, não a frequência do agendador ──────────────────
limpar();
const r2 = await rodarCron();
conferir(enviados.length === 0, `rodar de novo não reenvia nada (${enviados.length} envios) — a trava é o carimbo`);

const pauloDepois = await db.registration.findUnique({ where: { id: ultimaHora.id } });
conferir(
  pauloDepois.reminderSentAt !== null,
  "quem não recebeu lembrete foi carimbado assim mesmo, senão seria reavaliado a cada minuto para sempre",
);

// ── 5.6 nas mensagens ───────────────────────────────────────────────────
limpar();
await db.registration.updateMany({
  where: { id: { in: [comAntecedencia.id, comecando.id, faltou.id] } },
  data: { reminderSentAt: null, startNoticeSentAt: null, replaySentAt: null },
});
await rodarCron();
const proibidas = ["ao vivo", "gravaç", "replay das", "vídeo", "video"];
const sujas = enviados.filter((e) =>
  proibidas.some((p) => (e.assunto + " " + e.corpo.replace(/\/replay\//g, "/x/")).toLowerCase().includes(p)),
);
if (sujas.length) for (const s of sujas) console.log("   suspeita:", s.assunto, "|", s.corpo.slice(0, 160));
conferir(sujas.length === 0, `5.6 nenhuma mensagem diz vídeo, gravação ou "ao vivo" (${sujas.length} suspeitas)`);

servidor.close();
await db.$disconnect();
console.log(falhas.length ? `\n${falhas.length} FALHA(S): ${falhas.join(" | ")}` : "\nETAPA 9 VERIFICADA");
process.exit(falhas.length ? 1 : 0);
