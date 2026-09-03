"use client";

import { useSyncExternalStore } from "react";

import { positionInWindow, type HourWindow } from "@/lib/agenda";
import { formatHeure } from "@/lib/date";

interface CurrentTimeLineProps {
  window: HourWindow;
  /** Colonne du jour courant (0 = lundi), ou `null` hors de la semaine affichée. */
  dayIndex: number | null;
}

const MS_PER_MINUTE = 60_000;
const JOURS_OUVRES = 5;

/**
 * L'horloge est une source externe mutable : `useSyncExternalStore` est le
 * primitif fait pour ça. L'instantané est la minute écoulée — une valeur stable
 * entre deux ticks, donc pas de rendu en boucle — et l'instantané serveur vaut
 * zéro pour que rien ne soit rendu avant l'hydratation. Afficher l'heure du
 * serveur donnerait un trait faux à qui n'est pas dans son fuseau.
 */
function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, MS_PER_MINUTE);
  return () => clearInterval(timer);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / MS_PER_MINUTE);
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Repère de l'heure courante. Ne s'affiche que si aujourd'hui tombe dans la
 * semaine affichée et dans l'amplitude horaire de la grille.
 */
export function CurrentTimeLine({ window, dayIndex }: CurrentTimeLineProps) {
  const minute = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (minute === 0 || dayIndex === null) return null;

  const now = new Date(minute * MS_PER_MINUTE);
  const position = positionInWindow(now, window);
  if (position === null) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top: `${position}%` }}
    >
      <span className="tabular -ml-8 w-8 pr-1 text-right text-[0.5625rem] font-bold text-emphasis">
        {formatHeure(now)}
      </span>
      <span className="h-px flex-1 bg-emphasis/40" />
      <span
        className="absolute size-1.5 rounded-full bg-emphasis"
        style={{ left: `calc(${(dayIndex / JOURS_OUVRES) * 100}% - 3px)` }}
      />
    </div>
  );
}
