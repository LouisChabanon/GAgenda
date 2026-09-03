"use client";

import { formatHeure } from "@/lib/date";
import { SLOT_MINUTES, type WeekPlacement } from "@/lib/agenda";
import { styleNature } from "./natureStyle";

interface SeanceBlockProps {
  placement: WeekPlacement;
  onSelect: (id: string) => void;
}

/** En dessous, la colonne est trop courte pour autre chose que le titre. */
const MINUTES_POUR_HORAIRE = 50;
const MINUTES_POUR_SALLE = 80;

/**
 * Une séance posée sur la grille — bloc plein, à la manière de Better-Lise.
 *
 * La couleur encode la nature déduite de l'intitulé (CM, TD, TP, examen…) et
 * non `BorderColor`, qui vaut `#FF4000` sur toutes les séances renvoyées par
 * l'ENT et ne distinguerait donc rien.
 */
export function SeanceBlock({ placement, onSelect }: SeanceBlockProps) {
  const { seance, dayIndex, startSlot, slotSpan, lane, laneCount } = placement;
  const minutes = slotSpan * SLOT_MINUTES;
  const { fond, texte, filet, discontinu } = styleNature(seance.nature);

  return (
    <li
      className="flex px-px"
      style={{
        gridColumn: dayIndex + 1,
        gridRow: `${startSlot} / span ${slotSpan}`,
        marginLeft: `${(lane / laneCount) * 100}%`,
        width: `${100 / laneCount}%`,
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(seance.id)}
        style={{
          background: fond,
          color: texte,
          borderColor: filet,
          borderStyle: discontinu ? "dashed" : "solid",
        }}
        // `container-type` autorise les unités `cqi` : le titre se dimensionne
        // sur la largeur du bloc, comme dans Better-Lise.
        className="@container flex h-full w-full flex-col gap-0.5 overflow-hidden rounded-lg border px-1.5 py-1 text-left leading-tight shadow-sm transition-[filter,transform] duration-(--duration-fast) hover:brightness-[0.97] active:scale-[0.99] sm:px-2 sm:py-1.5"
      >
        <span
          className="font-semibold [hyphens:auto] [overflow-wrap:anywhere]"
          style={{
            fontSize: "clamp(0.625rem, 13cqi, 0.875rem)",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: minutes >= MINUTES_POUR_SALLE ? 3 : 2,
            overflow: "hidden",
          }}
        >
          {seance.matiere}
        </span>

        {minutes >= MINUTES_POUR_HORAIRE && (
          <span className="tabular text-[0.5625rem] opacity-80 sm:text-[0.6875rem]">
            {formatHeure(new Date(seance.debut))}
            <span className="hidden sm:inline">
              {" – "}
              {formatHeure(new Date(seance.fin))}
            </span>
          </span>
        )}

        {minutes >= MINUTES_POUR_SALLE && seance.salle && (
          <span className="truncate text-[0.5625rem] opacity-70 sm:text-[0.6875rem]">
            {seance.salle}
            {seance.site && <span className="hidden sm:inline"> · {seance.site}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
