"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { logoutAction } from "@/actions/auth";
import {
  addDays,
  formatMoisAnnee,
  parseDayKey,
  toDayKey,
  weekDays,
} from "@/lib/date";
import type { Seance } from "@/lib/ent/types";
import { SeanceSheet } from "./SeanceSheet";
import { WeekGrid } from "./WeekGrid";

interface AgendaWrapperProps {
  /** Séances de la semaine rendue côté serveur, pour un premier écran immédiat. */
  initialSeances: Seance[];
  /** Lundi de cette semaine, au format `YYYY-MM-DD`. */
  initialSemaine: string;
  today: string;
}

/** Amplitude horizontale à partir de laquelle un geste change de semaine. */
const SWIPE_THRESHOLD = 56;

/**
 * Orchestrateur de l'agenda.
 *
 * Il tient la semaine affichée et va chercher les autres via `/api/edt` sans
 * recharger la page. Les semaines déjà vues restent en mémoire : la navigation
 * aller-retour est instantanée.
 */
export default function AgendaWrapper({
  initialSeances,
  initialSemaine,
  today,
}: AgendaWrapperProps) {
  const [semaine, setSemaine] = useState(initialSemaine);
  const [direction, setDirection] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, Seance[]>>({
    [initialSemaine]: initialSeances,
  });
  // Erreurs indexées par semaine : une semaine en échec ne doit pas être
  // re-tentée en boucle, ni masquer les semaines déjà chargées.
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const seances = cache[semaine];
  const erreur = erreurs[semaine] ?? null;
  const chargement = !seances && !erreur;

  const days = useMemo(() => weekDays(parseDayKey(semaine) ?? new Date()), [semaine]);
  const semaineCourante = useMemo(
    () => toDayKey(weekDays(parseDayKey(today) ?? new Date())[0]),
    [today],
  );

  useEffect(() => {
    if (cache[semaine] || erreurs[semaine]) return;

    const controller = new AbortController();

    fetch(`/api/edt?semaine=${semaine}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "Impossible de joindre l'ENT.");
        }
        setCache((previous) => ({ ...previous, [semaine]: payload.seances }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErreurs((previous) => ({
          ...previous,
          [semaine]: error instanceof Error ? error.message : "Erreur inattendue.",
        }));
      });

    return () => controller.abort();
  }, [semaine, cache, erreurs]);

  /** Vide la semaine courante du cache, ce qui relance son chargement. */
  const rafraichir = useCallback(() => {
    const sans = (registre: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(registre).filter(([cle]) => cle !== semaine));

    setCache((previous) => sans(previous) as Record<string, Seance[]>);
    setErreurs((previous) => sans(previous) as Record<string, string>);
  }, [semaine]);

  const changerSemaine = useCallback(
    (delta: number) => {
      const lundi = parseDayKey(semaine);
      if (!lundi) return;

      setDirection(delta);
      setSemaine(toDayKey(addDays(lundi, delta * 7)));
    },
    [semaine],
  );

  const revenirAujourdhui = useCallback(() => {
    setDirection(semaineCourante < semaine ? -1 : 1);
    setSemaine(semaineCourante);
  }, [semaine, semaineCourante]);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Un geste plus vertical qu'horizontal est un défilement, pas un swipe.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;

    changerSemaine(dx < 0 ? 1 : -1);
  };

  const seanceSelectionnee =
    seances?.find((seance) => seance.id === selection) ?? null;

  return (
    <main className="pad-safe-top pad-safe-bottom flex h-dvh w-full flex-col gap-3 px-3">
      <header className="flex flex-none items-center justify-between gap-3">
        <h1 className="text-title font-bold text-ink-strong first-letter:uppercase">
          {formatMoisAnnee(days[0])}
        </h1>

        <nav className="flex items-center gap-1.5" aria-label="Navigation">
          <IconButton label="Semaine précédente" onClick={() => changerSemaine(-1)}>
            ‹
          </IconButton>
          <IconButton
            label="Revenir à aujourd'hui"
            onClick={revenirAujourdhui}
            disabled={semaine === semaineCourante}
          >
            <span className="text-[0.6875rem] font-semibold uppercase">Auj.</span>
          </IconButton>
          <IconButton label="Semaine suivante" onClick={() => changerSemaine(1)}>
            ›
          </IconButton>
          <IconButton label="Actualiser" onClick={rafraichir} disabled={chargement}>
            <span className={chargement ? "animate-spin" : undefined}>↻</span>
          </IconButton>
        </nav>
      </header>

      <section
        className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-2xl border border-rule bg-surface shadow-sm"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {erreur ? (
          <div
            role="alert"
            className="m-4 flex flex-col items-start gap-3 rounded-lg border border-emphasis/20 bg-emphasis-container px-4 py-3 text-sm text-emphasis"
          >
            <p>{erreur}</p>
            <button
              type="button"
              onClick={rafraichir}
              className="text-eyebrow min-h-11 uppercase text-emphasis underline underline-offset-4"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <WeekGrid
            days={days}
            seances={seances ?? []}
            today={today}
            direction={direction}
            weekKey={semaine}
            onSelect={setSelection}
          />
        )}
      </section>

      <footer className="flex flex-none items-center justify-between gap-4 px-1 pb-1">
        <p className="text-[0.6875rem] text-faint">
          {chargement ? "Chargement…" : `${seances?.length ?? 0} cours cette semaine`}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-eyebrow min-h-11 rounded-lg px-2 uppercase text-muted transition-colors duration-(--duration-fast) hover:text-accent"
          >
            Déconnexion
          </button>
        </form>
      </footer>

      <SeanceSheet seance={seanceSelectionnee} onClose={() => setSelection(null)} />
    </main>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function IconButton({ label, onClick, disabled, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-lg border border-rule bg-surface text-lg leading-none text-primary transition-colors duration-(--duration-fast) hover:bg-primary-container disabled:opacity-40 disabled:hover:bg-surface"
    >
      {children}
    </button>
  );
}
