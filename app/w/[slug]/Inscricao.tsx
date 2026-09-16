"use client";

import { useActionState, useEffect, useState } from "react";
import { inscrever, type EstadoInscricao } from "./acoes";

export type SlotView = { valor: string; label: string; destaque?: string };

export default function Inscricao({ slug, slots }: { slug: string; slots: SlotView[] }) {
  const [estado, acao, enviando] = useActionState<EstadoInscricao, FormData>(inscrever, {});

  const [slot, setSlot] = useState(slots[0]?.valor ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [origem, setOrigem] = useState({
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    referrer: "",
  });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setOrigem({
      utmSource: q.get("utm_source") ?? "",
      utmMedium: q.get("utm_medium") ?? "",
      utmCampaign: q.get("utm_campaign") ?? "",
      referrer: document.referrer ?? "",
    });
  }, []);

  return (
    <form action={acao} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="utmSource" value={origem.utmSource} />
      <input type="hidden" name="utmMedium" value={origem.utmMedium} />
      <input type="hidden" name="utmCampaign" value={origem.utmCampaign} />
      <input type="hidden" name="referrer" value={origem.referrer} />

      <fieldset>
        <legend className="rotulo">Escolha o horario</legend>
        <div className="grid gap-2">
          {slots.map((s) => (
            <label
              key={s.valor}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition ${
                slot === s.valor
                  ? "border-[var(--acento)] bg-[var(--acento-fraco)]"
                  : "border-[var(--borda)] hover:border-[var(--texto-3)]"
              }`}
            >
              <input
                type="radio"
                name="slot"
                value={s.valor}
                checked={slot === s.valor}
                onChange={() => setSlot(s.valor)}
                className="h-4 w-4 accent-[var(--acento)]"
              />
              <span className="flex-1 text-[15px]">{s.label}</span>
              {s.destaque ? (
                <span className="selo bg-[var(--acento-fraco)] text-[var(--acento)]">{s.destaque}</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4">
        <div>
          <label className="rotulo" htmlFor="name">Nome</label>
          <input
            id="name"
            name="name"
            className="campo"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            className="campo"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="phone">WhatsApp</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className="campo"
            autoComplete="tel"
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="ajuda">Opcional. E por onde chega o lembrete antes de comecar.</p>
        </div>
      </div>

      {estado.erro ? <p className="text-[13px] text-[var(--erro)]">{estado.erro}</p> : null}

      <button type="submit" className="botao w-full py-3 text-[16px]" disabled={enviando}>
        {enviando ? "Reservando..." : "Garantir minha vaga"}
      </button>
      <p className="ajuda text-center">
        A vaga e sua e o link chega na hora. Nao repassamos seu contato para ninguem.
      </p>
    </form>
  );
}
