"use client";

import { useEffect } from "react";

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** O snippet oficial da Meta, injetado so quando ha pixel configurado. */
const SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');`;

/**
 * PageView em toda pagina que o usa; com leadId, tambem o Lead, com eventID
 * estavel (o id da inscricao): recarregar a pagina nao conta duas vezes.
 * Sem pixel, nao faz nada — como toda integracao deste sistema.
 */
export default function PixelMeta({ pixelId, leadId }: { pixelId?: string; leadId?: string }) {
  useEffect(() => {
    if (!pixelId) return;

    if (!window.fbq) {
      const s = document.createElement("script");
      s.textContent = SNIPPET;
      document.head.appendChild(s);
    }

    window.fbq?.("init", pixelId);
    window.fbq?.("track", "PageView");
    if (leadId) window.fbq?.("track", "Lead", {}, { eventID: leadId });
  }, [pixelId, leadId]);

  return null;
}
