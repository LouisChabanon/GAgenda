"use client";

import { useEffect, useRef } from "react";

import { formatHeure, formatJourLong } from "@/lib/date";
import { libelleNature } from "@/lib/ent/nature";
import type { Seance } from "@/lib/ent/types";
import { styleNature } from "./natureStyle";

interface SeanceSheetProps {
  seance: Seance | null;
  onClose: () => void;
}

/**
 * Détail d'une séance.
 *
 * En grille hebdomadaire, une colonne fait une soixantaine de pixels sur
 * téléphone : le bloc ne peut afficher qu'un titre tronqué. Ce panneau rend
 * accessible ce que la grille doit couper — intervenants, salle, site, horaires.
 *
 * Sur `<dialog>` natif : la touche Échap, le piégeage du focus et le fond inerte
 * sont fournis par le navigateur.
 */
export function SeanceSheet({ seance, onClose }: SeanceSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (seance && !element.open) element.showModal();
    if (!seance && element.open) element.close();
  }, [seance]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        // Un clic sur le fond — donc sur le dialog lui-même — referme.
        if (event.target === dialog.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-2xl rounded-t-2xl border border-rule bg-surface p-0 shadow-2xl backdrop:bg-ink/40 sm:mx-auto sm:my-auto sm:rounded-2xl"
    >
      {seance && (
        <article className="pad-safe-bottom flex flex-col gap-4 px-6 pt-6">
          <header className="flex flex-col items-start gap-2">
            <p
              className="text-eyebrow rounded-full px-2.5 py-1.5 uppercase"
              style={{
                background: styleNature(seance.nature).fond,
                color: styleNature(seance.nature).texte,
              }}
            >
              {libelleNature(seance.nature)}
            </p>
            <h2 className="text-title font-bold text-balance text-ink-strong">
              {seance.matiere}
            </h2>
          </header>

          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[0.9375rem]">
            <dt className="text-eyebrow self-center uppercase text-faint">Quand</dt>
            <dd className="tabular">
              {formatJourLong(new Date(seance.debut))}, {formatHeure(new Date(seance.debut))}
              {" – "}
              {formatHeure(new Date(seance.fin))}
            </dd>

            <dt className="text-eyebrow self-center uppercase text-faint">Où</dt>
            <dd>
              {seance.salle ? (
                <>
                  Salle {seance.salle}
                  {seance.site && <span className="text-muted"> · {seance.site}</span>}
                </>
              ) : (
                // Une séance sans salle est à distance : le dire vaut mieux que
                // de masquer la ligne, qui laisserait croire à un oubli.
                <span className="text-muted">Aucune salle — à distance</span>
              )}
            </dd>

            {seance.intervenants.length > 0 && (
              <>
                <dt className="text-eyebrow self-center uppercase text-faint">Qui</dt>
                <dd>{seance.intervenants.join(", ")}</dd>
              </>
            )}
          </dl>

          {seance.commentaire && (
            <p className="rounded-lg bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-muted">
              {seance.commentaire}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mb-4 min-h-12 rounded-lg bg-primary px-5 text-[0.9375rem] font-medium text-on-primary shadow-sm transition-colors duration-(--duration-fast) hover:bg-primary-hover disabled:cursor-progress disabled:opacity-60"
          >
            Fermer
          </button>
        </article>
      )}
    </dialog>
  );
}
