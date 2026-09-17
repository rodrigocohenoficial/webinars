"use client";

import { useActionState, useState, useTransition } from "react";
import { detectarVideo, salvarWebinar, type EstadoForm, type InfoVideo } from "../../acoes";
import { formatMinutoSegundo } from "@/lib/time";

export type WebinarForm = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  hostName: string;
  description: string;
  coverUrl: string;
  videoUrl: string;
  durationSec: string;
  aspectRatio: string;
  waitingVideoUrl: string;
  published: boolean;
  jitEnabled: boolean;
  jitDelayMin: string;
  joinWindowMin: string;
  visibleSlots: string;
  chatAoVivo: boolean;
  legendas: boolean;
  mostrarAudiencia: boolean;
  audienciaMinima: string;
  ctaLabel: string;
  ctaUrl: string;
  ctaDescription: string;
  ctaAtSec: string;
  ctaUntilSec: string;
  ctaNoFim: boolean;
};

function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <section className="cartao space-y-4">
      <div>
        <h2 className="titulo-secao">{titulo}</h2>
        {ajuda ? <p className="ajuda">{ajuda}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Interruptor({
  nome,
  ligado,
  aoMudar,
  titulo,
  ajuda,
}: {
  nome: string;
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  titulo: string;
  ajuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={nome}
        checked={ligado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--acento)]"
      />
      <span>
        <span className="block text-[14px] text-[var(--texto)]">{titulo}</span>
        {ajuda ? <span className="ajuda mt-0.5 block">{ajuda}</span> : null}
      </span>
    </label>
  );
}

export default function FormularioWebinar({ inicial }: { inicial: WebinarForm }) {
  // Armadilha 9.7: campos controlados. O React limpa campo nao controlado
  // assim que a server action responde, inclusive quando responde com erro.
  const [f, setF] = useState<WebinarForm>(inicial);
  const set = <K extends keyof WebinarForm>(campo: K, valor: WebinarForm[K]) =>
    setF((atual) => ({ ...atual, [campo]: valor }));

  const [estado, acao, salvando] = useActionState<EstadoForm, FormData>(salvarWebinar, {});
  const [detectando, iniciarDeteccao] = useTransition();
  const [info, setInfo] = useState<InfoVideo | null>(null);

  function detectar() {
    setInfo(null);
    iniciarDeteccao(async () => {
      const r = await detectarVideo(f.videoUrl);
      setInfo(r);
      if (r.erro) return;
      setF((atual) => ({
        ...atual,
        videoUrl: r.videoUrl ?? atual.videoUrl,
        durationSec: r.durationSec ? formatMinutoSegundo(r.durationSec) : atual.durationSec,
        aspectRatio: r.aspectRatio ?? atual.aspectRatio,
        coverUrl: atual.coverUrl || r.coverUrl || "",
      }));
    });
  }

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="id" value={f.id} />
      <input type="hidden" name="aspectRatio" value={f.aspectRatio} />

      <Secao titulo="Identidade" ajuda="O que aparece na pagina de inscricao.">
        <div>
          <label className="rotulo" htmlFor="title">Titulo</label>
          <input
            id="title"
            name="title"
            className="campo"
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="subtitle">Subtitulo</label>
            <input
              id="subtitle"
              name="subtitle"
              className="campo"
              value={f.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="hostName">Quem apresenta</label>
            <input
              id="hostName"
              name="hostName"
              className="campo"
              value={f.hostName}
              onChange={(e) => set("hostName", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="description">Descricao</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            className="campo resize-y"
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="slug">Endereco</label>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] text-[var(--texto-3)]">/w/</span>
              <input
                id="slug"
                name="slug"
                className="campo"
                value={f.slug}
                onChange={(e) => set("slug", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="rotulo" htmlFor="coverUrl">Capa (URL)</label>
            <input
              id="coverUrl"
              name="coverUrl"
              className="campo"
              placeholder="deixe vazio para usar a do video"
              value={f.coverUrl}
              onChange={(e) => set("coverUrl", e.target.value)}
            />
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Video"
        ajuda="YouTube ou Vimeo. A duracao e obrigatoria: sem ela a sessao nunca encerra e o player fica em branco no fim."
      >
        <div>
          <label className="rotulo" htmlFor="videoUrl">Link do video</label>
          <div className="flex gap-2">
            <input
              id="videoUrl"
              name="videoUrl"
              className="campo"
              placeholder="https://www.youtube.com/watch?v=..."
              value={f.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
            />
            <button
              type="button"
              className="botao-fantasma shrink-0"
              onClick={detectar}
              disabled={detectando || !f.videoUrl.trim()}
            >
              {detectando ? "Lendo..." : "Detectar"}
            </button>
          </div>
          {info?.erro ? <p className="mt-2 text-[13px] text-[var(--erro)]">{info.erro}</p> : null}
          {info?.aviso ? <p className="mt-2 text-[13px] text-[var(--alerta)]">{info.aviso}</p> : null}
          {info && !info.erro && !info.aviso ? (
            <p className="mt-2 text-[13px] text-[var(--acento)]">
              {info.title ? `"${info.title}" · ` : ""}duracao lida do provedor.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="durationSec">Duracao</label>
            <input
              id="durationSec"
              name="durationSec"
              className="campo"
              placeholder="48:30"
              value={f.durationSec}
              onChange={(e) => set("durationSec", e.target.value)}
            />
            <p className="ajuda">mm:ss, hh:mm:ss ou segundos.</p>
          </div>
          <div>
            <label className="rotulo" htmlFor="formato">Formato</label>
            <select
              id="formato"
              className="campo"
              value={f.aspectRatio}
              onChange={(e) => set("aspectRatio", e.target.value)}
            >
              <option value="16/9">16/9 deitado</option>
              <option value="9/16">9/16 em pe</option>
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="waitingVideoUrl">Video da sala de espera</label>
            <input
              id="waitingVideoUrl"
              name="waitingVideoUrl"
              className="campo"
              placeholder="opcional"
              value={f.waitingVideoUrl}
              onChange={(e) => set("waitingVideoUrl", e.target.value)}
            />
            <p className="ajuda">Roda em laco e mudo antes de comecar.</p>
          </div>
        </div>
      </Secao>

      <Secao titulo="Entrada" ajuda="Como a pessoa escolhe o horario e ate quando consegue entrar.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="visibleSlots">Horarios visiveis</label>
            <input
              id="visibleSlots"
              name="visibleSlots"
              type="number"
              min={1}
              max={12}
              className="campo"
              value={f.visibleSlots}
              onChange={(e) => set("visibleSlots", e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="joinWindowMin">Janela de entrada (min)</label>
            <input
              id="joinWindowMin"
              name="joinWindowMin"
              type="number"
              min={0}
              className="campo"
              value={f.joinWindowMin}
              onChange={(e) => set("joinWindowMin", e.target.value)}
            />
            <p className="ajuda">0 = pode entrar a qualquer momento.</p>
          </div>
          <div>
            <label className="rotulo" htmlFor="jitDelayMin">&quot;Comeca em&quot; (min)</label>
            <input
              id="jitDelayMin"
              name="jitDelayMin"
              type="number"
              min={1}
              max={120}
              className="campo"
              value={f.jitDelayMin}
              onChange={(e) => set("jitDelayMin", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-3 border-t border-[var(--borda)] pt-4">
          <Interruptor
            nome="jitEnabled"
            ligado={f.jitEnabled}
            aoMudar={(v) => set("jitEnabled", v)}
            titulo="Oferecer a opcao &quot;comeca em N minutos&quot;"
            ajuda="Quem chega agora nao precisa esperar ate o proximo horario da grade."
          />
          <Interruptor
            nome="chatAoVivo"
            ligado={f.chatAoVivo}
            aoMudar={(v) => set("chatAoVivo", v)}
            titulo="Chat ao vivo entre participantes"
            ajuda="Desligado, so voce ve o que eles escrevem — e libera um por um."
          />
          <Interruptor
            nome="legendas"
            ligado={f.legendas}
            aoMudar={(v) => set("legendas", v)}
            titulo="Ligar as legendas do provedor"
          />
          <Interruptor
            nome="mostrarAudiencia"
            ligado={f.mostrarAudiencia}
            aoMudar={(v) => set("mostrarAudiencia", v)}
            titulo="Mostrar quantos estao assistindo"
            ajuda="Numero de verdade: quem deu sinal nos ultimos 75 segundos. E o sinal de sala cheia mais forte que existe, e o unico honesto."
          />
          {f.mostrarAudiencia ? (
            <div className="pl-7">
              <label className="rotulo" htmlFor="audienciaMinima">
                So mostrar a partir de
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="audienciaMinima"
                  name="audienciaMinima"
                  type="number"
                  min={0}
                  max={999}
                  className="campo w-24"
                  value={f.audienciaMinima}
                  onChange={(e) => set("audienciaMinima", e.target.value)}
                />
                <span className="text-[14px] text-[var(--texto-2)]">pessoas</span>
              </div>
              <p className="ajuda">
                Abaixo disso o numero nao aparece. Nao inflamos nada — so nao anunciamos uma sala de
                duas pessoas, que esvazia em vez de encher.
              </p>
            </div>
          ) : null}
        </div>
      </Secao>

      <Secao titulo="Oferta" ajuda="Aparece no minuto que voce marcar e some no outro.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="ctaLabel">Texto do botao</label>
            <input
              id="ctaLabel"
              name="ctaLabel"
              className="campo"
              placeholder="Quero minha vaga"
              value={f.ctaLabel}
              onChange={(e) => set("ctaLabel", e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="ctaUrl">Link</label>
            <input
              id="ctaUrl"
              name="ctaUrl"
              className="campo"
              placeholder="https://..."
              value={f.ctaUrl}
              onChange={(e) => set("ctaUrl", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="rotulo" htmlFor="ctaDescription">Chamada acima do botao</label>
          <input
            id="ctaDescription"
            name="ctaDescription"
            className="campo"
            value={f.ctaDescription}
            onChange={(e) => set("ctaDescription", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="rotulo" htmlFor="ctaAtSec">Aparece em</label>
            <input
              id="ctaAtSec"
              name="ctaAtSec"
              className="campo"
              placeholder="22:00"
              value={f.ctaAtSec}
              onChange={(e) => set("ctaAtSec", e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="ctaUntilSec">Some em</label>
            <input
              id="ctaUntilSec"
              name="ctaUntilSec"
              className="campo"
              placeholder="deixe vazio para ficar ate o fim"
              value={f.ctaUntilSec}
              onChange={(e) => set("ctaUntilSec", e.target.value)}
            />
          </div>
        </div>
        <div className="border-t border-[var(--borda)] pt-4">
          <Interruptor
            nome="ctaNoFim"
            ligado={f.ctaNoFim}
            aoMudar={(v) => set("ctaNoFim", v)}
            titulo="Repetir a oferta na tela de encerramento"
            ajuda="Quem ficou ate o fim e o lead mais quente da sessao. Desligue so se a oferta tiver escassez de minuto."
          />
        </div>
      </Secao>

      <Secao titulo="Publicacao">
        <Interruptor
          nome="published"
          ligado={f.published}
          aoMudar={(v) => set("published", v)}
          titulo="Pagina de inscricao no ar"
          ajuda="Desligada, quem abrir o endereco ve um recado, nao um erro."
        />
      </Secao>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-[var(--borda)] bg-[var(--fundo)]/95 px-1 py-3 backdrop-blur">
        <button type="submit" className="botao" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        {estado.erro ? <p className="text-[13px] text-[var(--erro)]">{estado.erro}</p> : null}
        {estado.ok ? <p className="text-[13px] text-[var(--acento)]">{estado.ok}</p> : null}
      </div>
    </form>
  );
}
