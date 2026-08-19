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
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked
          ? 'border-[var(--accent-30)] bg-[var(--accent-06)]'
          : 'border-[var(--line)] bg-[var(--surface-50)] hover:border-[var(--accent-20)]'
      }`}
    >
      {(label || description) && (
        <span className="text-left">
          {label && <span className={`block text-xs font-semibold ${checked ? 'text-[var(--text)]' : 'text-[var(--text-60)]'}`}>{label}</span>}
          {description && <span className="mt-0.5 block text-[10px] text-[var(--text-40)]">{description}</span>}
        </span>
      )}

      <span
        role={label || description ? 'switch' : undefined}
        aria-checked={label || description ? checked : undefined}
        onClick={label || description ? undefined : () => !disabled && onChange()}
        className={`flex h-5 w-9 shrink-0 items-center rounded-full transition-all ${
          checked ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-[var(--surface-strong)]'
        }`}
      >
        <span className={`mx-0.5 h-4 w-4 rounded-full transition-all ${checked ? 'bg-white shadow-sm' : 'bg-[var(--text-30)]'}`} />
      </span>
    </Wrapper>
  );
}
