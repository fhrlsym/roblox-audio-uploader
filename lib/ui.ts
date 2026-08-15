export const CARD =
  'rounded-3xl border border-[var(--accent-15)] bg-gradient-to-br from-[var(--card-from)] via-[var(--card-via)] to-[var(--card-to)] backdrop-blur-xl shadow-2xl glass-hover';

export const PANEL =
  'rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-md';

export const INPUT =
  'w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--line)] text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-1 focus:ring-[var(--accent-30)] placeholder:text-[var(--text-35)]';

export const LABEL =
  'text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-45)]';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)] text-sm font-semibold px-4 py-2.5 transition duration-150 ease-out hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 shadow-sm btn-glow';

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-80)] text-sm font-medium px-4 py-2.5 transition duration-150 ease-out hover:border-[var(--accent-30)] hover:text-[var(--text)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40';

export const BTN_DANGER =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300 text-sm font-medium px-3 py-2 transition duration-150 ease-out hover:bg-rose-400/20 active:scale-[0.97]';

export { cleanSongTitle } from './utils';

/** Stagger delay per item index (in seconds) for list entrance animations */
export const STAGGER_DELAY = 0.04;
