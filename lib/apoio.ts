import { formatarTelefoneBR } from "./phone";

/** O que a sala precisa para mostrar o contato do time e o material. */
export type ApoioDaSala = {
  suporte: { nome: string; link: string; numero: string } | null;
  material: { label: string; url: string; atSec: number | null } | null;
};

/** O arquivo que ja vem com o sistema. O painel oferece com um clique. */
export const MATERIAL_PADRAO = {
  label: "Baixar o Plano de 1 Página",
  url: "/materiais/plano-de-1-pagina.pdf",
};

type Origem = {
  title: string;
  suporteNome: string | null;
  suporteWhatsapp: string | null;
  materialLabel: string | null;
  materialUrl: string | null;
  materialAtSec: number | null;
};

export function apoioDaSala(w: Origem): ApoioDaSala {
  const nome = w.suporteNome?.trim() || "nosso time";
  // A mensagem ja chega dizendo de onde a pessoa veio: o time nao precisa
  // perguntar, e a conversa comeca pela duvida.
  const texto = `Oi${w.suporteNome ? `, ${w.suporteNome.trim()}` : ""}! Estou no webinário "${w.title}" e tenho uma dúvida.`;

  return {
    suporte: w.suporteWhatsapp
      ? {
          nome,
          link: `https://wa.me/${w.suporteWhatsapp}?text=${encodeURIComponent(texto)}`,
          numero: formatarTelefoneBR(w.suporteWhatsapp),
        }
      : null,
    material: w.materialUrl
      ? {
          label: w.materialLabel?.trim() || "Baixar o material da aula",
          url: w.materialUrl,
          atSec: w.materialAtSec,
        }
      : null,
  };
}
