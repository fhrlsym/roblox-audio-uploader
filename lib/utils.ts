/**
 * Centralized Utility & Helper Functions
 */

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

/**
 * Formats byte size into human readable string (KB, MB).
 */
export function formatBytes(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats timestamp into relative Indonesian date string (e.g. "2 menit lalu").
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Formats seconds into M:SS duration format.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
