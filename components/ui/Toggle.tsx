'use client';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  const Wrapper = label || description ? 'button' : 'span';
  return (
    <Wrapper
      type={label || description ? 'button' : undefined}
      onClick={label || description ? () => !disabled && onChange() : undefined}
      disabled={disabled}
      className={`brutal-card-sm flex w-full items-center justify-between gap-3 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-[var(--accent)]/10' : 'bg-[var(--panel)]'}`}
    >
      {(label || description) && (
        <span className="text-left">
          {label && <span className={`block text-xs font-bold uppercase tracking-wide ${checked ? 'text-[var(--text)]' : 'text-[var(--text-60)]'}`}>{label}</span>}
          {description && <span className="mt-0.5 block text-[10px] font-medium text-[var(--text-50)]">{description}</span>}
        </span>
      )}

      <span
        role={label || description ? 'switch' : undefined}
        aria-checked={label || description ? checked : undefined}
        onClick={label || description ? undefined : () => !disabled && onChange()}
        className={`flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-[var(--text)] transition-all ${
          checked ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-[var(--bg)]'
        }`}
      >
        <span className={`mx-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--text)] transition-all ${checked ? 'bg-white' : 'bg-[var(--text)]'}`} />
      </span>
    </Wrapper>
  );
}
