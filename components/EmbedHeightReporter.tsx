"use client";

import { useEffect } from "react";

/**
 * Javlja roditeljskoj stranici visinu sadržaja da bi <iframe> mogao da se
 * automatski prilagodi (bez duplog scroll-a).
 *
 * Roditelj sluša:
 *   window.addEventListener('message', e => {
 *     if (e.data?.type === 'mirav-quiz-height') iframe.style.height = e.data.height + 'px';
 *   });
 */
export default function EmbedHeightReporter() {
  useEffect(() => {
    // Ugrađena verzija ne crta svoju pozadinu (vidi globals.css).
    document.body.dataset.embed = "true";

    let last = 0;
    let frame = 0;

    const send = () => {
      // Mjeri se okvir <body>, a NE documentElement.scrollHeight: kad roditelj
      // primijeni javljenu visinu, viewport iframe-a postaje toliko visok pa
      // scrollHeight nikad ne bi pao ispod njega — visina bi rasla i nikad se
      // ne bi smanjila. Visina <body> zavisi samo od sadržaja.
      const height = Math.ceil(document.body.getBoundingClientRect().height);
      // Šalji samo stvarne promjene — inače se roditelj bespotrebno prekraja.
      if (height > 0 && Math.abs(height - last) > 1) {
        last = height;
        window.parent.postMessage({ type: "mirav-quiz-height", height }, "*");
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(send);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("load", schedule);
      window.removeEventListener("resize", schedule);
      delete document.body.dataset.embed;
    };
  }, []);

  return null;
}
