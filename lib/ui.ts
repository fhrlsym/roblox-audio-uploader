export const CARD =
  'rounded-3xl border border-[var(--accent-15)] bg-gradient-to-br from-[var(--card-from)] via-[var(--card-via)] to-[var(--card-to)] backdrop-blur-xl shadow-2xl';

export const PANEL =
  'rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-md';

export const INPUT =
  'w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--line)] text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-1 focus:ring-[var(--accent-30)] placeholder:text-[var(--text-35)]';

export const LABEL =
  'text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-45)]';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)] text-sm font-semibold px-4 py-2.5 transition duration-150 ease-out hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 shadow-sm';

export const BTN_GHOST =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-80)] text-sm font-medium px-4 py-2.5 transition duration-150 ease-out hover:border-[var(--accent-30)] hover:text-[var(--text)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40';

export const BTN_DANGER =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-300 text-sm font-medium px-3 py-2 transition duration-150 ease-out hover:bg-rose-400/20 active:scale-[0.97]';

/**
 * Cleans song titles by removing speed/volume tags, YouTube metadata junk, and trailing numbers.
 * e.g. "Hindia - Janji Palsu (Official Lyric Video)_2.3x_-4dB.mp3" -> "Hindia - Janji Palsu"
 */
export function cleanSongTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let name = rawTitle;

  // 1. Strip file extension (.mp3, .ogg, .wav, .m4a, .flac, .aac)
  name = name.replace(/\.(mp3|ogg|wav|m4a|flac|aac)$/i, '');

  // 2. Remove speed & volume tags like _2.3x_-4dB, _2.3x, -4dB, _2, _1
  name = name.replace(/_\d+(?:\.\d+)?x(?:_[-+]?\d+dB)?/gi, '');
  name = name.replace(/_[-+]?\d+dB/gi, '');
  name = name.replace(/_\d+$/g, '');

  // 3. Remove YouTube metadata tags in parentheses () or square brackets []
  name = name.replace(/[\(\[](?:Official\s+)?(?:Lyric|Music|HD|4K|Full)?\s*(?:Video|Audio|Lyric|Lyrics|Track|Visualizer|Stream)?[\)\]]/gi, '');

  // 4. Trim extra spaces, dashes, and underscores
  name = name.replace(/[\s\-_]+/g, ' ').trim();

  return name || rawTitle;
}
