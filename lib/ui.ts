export const CARD =
  'rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.25)]';

export const PANEL =
  'rounded-2xl border border-[var(--line)] bg-[var(--surface)]';

export const INPUT =
  'w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--line)] text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] placeholder:text-[var(--text-35)]';

export const LABEL =
  'text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold px-4 py-2.5 transition duration-150 ease-out hover:brightness-[1.06] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 shadow-sm';

export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent-25)] bg-[var(--accent-10)] text-[var(--accent-strong)] text-sm font-semibold px-4 py-2.5 transition duration-150 ease-out hover:bg-[var(--accent-15)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-80)] text-sm font-medium px-4 py-2.5 transition duration-150 ease-out hover:border-[var(--accent-30)] hover:text-[var(--text)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100';

export const BTN_DANGER =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] text-sm font-medium px-3 py-2 transition duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] active:scale-[0.97]';

export { cleanSongTitle } from './utils';

export const STAGGER_DELAY = 0.04;
