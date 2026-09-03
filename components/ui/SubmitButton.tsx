"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
}

/**
 * Bouton de soumission conscient de l'état du formulaire parent.
 * `useFormStatus` impose que le bouton soit un enfant du `<form>`.
 */
export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-lg bg-primary px-5 text-[0.9375rem] font-medium text-on-primary shadow-sm transition-colors duration-(--duration-fast) hover:bg-primary-hover disabled:cursor-progress disabled:opacity-60"
    >
      <span className="relative">{pending ? pendingLabel : children}</span>
    </button>
  );
}
