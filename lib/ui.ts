export const CARD =
  'rounded-xl border-2 border-[var(--text)] bg-[var(--panel)] shadow-[4px_4px_0_0_var(--text)]';

export const PANEL =
  'rounded-xl border-2 border-[var(--text)] bg-[var(--panel)] shadow-[3px_3px_0_0_var(--text)]';

export const INPUT =
  'w-full bg-[var(--bg)] text-[var(--text)] rounded-lg px-4 py-3 border-2 border-[var(--text)] text-sm font-semibold outline-none transition-colors duration-150 focus:border-[var(--accent)] placeholder:text-[var(--text-40)] placeholder:font-normal';

export const LABEL =
  'text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)]';

const BRUTAL_BTN_BASE =
  'inline-flex items-center justify-center gap-2 border-2 border-[var(--text)] rounded-lg text-sm font-bold uppercase tracking-wide px-4 py-2.5 transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--text)] disabled:active:translate-x-0 disabled:active:translate-y-0';

export const BTN_PRIMARY =
  `${BRUTAL_BTN_BASE} bg-[var(--accent)] text-[var(--on-accent)] shadow-[3px_3px_0_0_var(--text)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)]`;

export const BTN_SECONDARY =
  `${BRUTAL_BTN_BASE} bg-[var(--bg)] text-[var(--text)] shadow-[3px_3px_0_0_var(--text)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)]`;

export const BTN_GHOST =
  `${BRUTAL_BTN_BASE} bg-[var(--panel)] text-[var(--text)] shadow-[3px_3px_0_0_var(--text)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)]`;

export const BTN_DANGER =
  `${BRUTAL_BTN_BASE} bg-[var(--danger)] text-white shadow-[3px_3px_0_0_var(--text)] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] px-3 py-2`;

export { cleanSongTitle } from './utils';

export const STAGGER_DELAY = 0.04;
