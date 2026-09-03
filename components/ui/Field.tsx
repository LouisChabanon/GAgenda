interface FieldProps {
  id: string;
  name: string;
  label: string;
  type?: "text" | "password";
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
}

/** Champ de formulaire : label en exergue, input pleine largeur, cible ≥ 44px. */
export function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  required = true,
  defaultValue,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-eyebrow uppercase text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="min-h-12 rounded-lg border border-rule bg-surface px-4 text-[1.0625rem] text-ink transition-colors duration-(--duration-fast) placeholder:text-faint hover:border-rule-strong focus:border-accent"
      />
    </div>
  );
}
