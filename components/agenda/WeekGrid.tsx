"use client";

import { hourWindow, placeWeek, SLOT_MINUTES } from "@/lib/agenda";
import { formatJourCourt, numeroJour, toDayKey } from "@/lib/date";
import type { Seance } from "@/lib/ent/types";
import { CurrentTimeLine } from "./CurrentTimeLine";
import { SeanceBlock } from "./SeanceBlock";

interface WeekGridProps {
  days: Date[];
  seances: Seance[];
  today: string;
  /** Sens du dernier changement de semaine, pour l'animation d'entrée. */
  direction: number;
  /** Clé de la semaine : force le rejeu de l'animation à chaque navigation. */
  weekKey: string;
  onSelect: (id: string) => void;
}

/** Hauteur plancher : en dessous, les créneaux courts deviennent illisibles. */
const MIN_GRID_HEIGHT = "40rem";

/**
 * Grille hebdomadaire : cinq colonnes de jours, une rangée par tranche de cinq
 * minutes. Les séances sont posées en `grid-row`, donc positionnées et
 * dimensionnées par le navigateur — les trous entre deux cours restent lisibles.
 */
export function WeekGrid({
  days,
  seances,
  today,
  direction,
  weekKey,
  onSelect,
}: WeekGridProps) {
  const dayKeys = days.map(toDayKey);
  const window = hourWindow(seances);
  const placements = placeWeek(seances, dayKeys, window);
  const todayIndex = dayKeys.indexOf(today);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* En-tête des jours. Hors de la zone de défilement, donc pas de `sticky`. */}
      <div className="flex-none border-b border-rule bg-surface">
        <div className="grid grid-cols-[2rem_repeat(5,1fr)]">
          <div />
          {days.map((day, index) => {
            const estAujourdhui = dayKeys[index] === today;

            return (
              <div key={dayKeys[index]} className="flex flex-col items-center gap-1 py-2">
                <span className="text-eyebrow uppercase text-muted">
                  {formatJourCourt(day)}
                </span>
                <span
                  className={[
                    "tabular flex size-7 items-center justify-center rounded-full text-[0.9375rem]",
                    estAujourdhui ? "bg-primary font-bold text-on-primary" : "text-ink",
                  ].join(" ")}
                >
                  {numeroJour(day)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corps défilant. `flex` + `flex-1` sur la grille la fait remplir la
          hauteur disponible ; le plancher en `min-height` reprend la main dès
          que l'écran est trop court, et c'est alors le défilement qui joue. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* `pt-3` laisse respirer l'étiquette de la première heure, qui déborde
            au-dessus de sa ligne. */}
        <div
          className="grid flex-1 grid-cols-[2rem_1fr] pt-3"
          style={{ minHeight: MIN_GRID_HEIGHT }}
        >
          {/* Gouttière des heures. */}
          <div
            className="grid"
            style={{ gridTemplateRows: `repeat(${window.hours.length}, 1fr)` }}
          >
            {window.hours.map((hour) => (
              <div key={hour} className="relative">
                <span className="tabular absolute -top-1.5 right-1 text-[0.625rem] text-faint">
                  {hour}h
                </span>
              </div>
            ))}
          </div>

          {/* Grille proprement dite. */}
          <div className="relative grid grid-cols-1 grid-rows-1">
            {/* Lignes horaires. */}
            <div
              aria-hidden
              className="col-start-1 row-start-1 grid divide-y divide-rule border-t border-rule"
              style={{ gridTemplateRows: `repeat(${window.hours.length}, 1fr)` }}
            >
              {window.hours.map((hour) => (
                <div key={hour} />
              ))}
            </div>

            {/* Séparateurs de jours. */}
            <div
              aria-hidden
              className="col-start-1 row-start-1 grid grid-cols-5 divide-x divide-rule"
            >
              {days.map((_, index) => (
                <div key={index} />
              ))}
            </div>

            <ol
              key={weekKey}
              className="col-start-1 row-start-1 grid grid-cols-5 [animation:var(--animation-glisser)]"
              style={
                {
                  gridTemplateRows: `repeat(${window.slotCount}, 1fr)`,
                  "--origine": direction >= 0 ? "12%" : "-12%",
                } as React.CSSProperties
              }
            >
              {placements.map((placement) => (
                <SeanceBlock
                  key={placement.seance.id}
                  placement={placement}
                  onSelect={onSelect}
                />
              ))}
            </ol>

            <CurrentTimeLine window={window} dayIndex={todayIndex < 0 ? null : todayIndex} />
          </div>
        </div>
      </div>

      <p className="sr-only">
        Grille de {window.hours.length} heures, par tranches de {SLOT_MINUTES} minutes.
      </p>
    </div>
  );
}
