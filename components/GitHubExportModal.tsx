'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  FileCode,
  Folder,
  Loader2,
  Plus,
  Tag,
  UploadCloud,
  X,
} from 'lucide-react';
import { INPUT, LABEL, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
import { useToast } from './Toast';

export function GitHubIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export interface ExportableSong {
  assetId: string | number;
  name: string;
  playbackSpeed: number | string;
  originalSpeed?: number;
}

interface GitHubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: ExportableSong[];
  backendUrl?: string;
}

interface EditableItem {
  id: string;
  assetId: number;
  name: string;
  playbackSpeed: number;
  selected: boolean;
}

interface MapOption {
  filename: string;
}

const STORAGE_KEYS = {
  LAST_MAP: 'audioUploader_lastMapFile',
  LAST_GENRE: 'audioUploader_lastGenre',
};

const DEFAULT_REPO = 'fhrlsym/minang-music';
const DEFAULT_COVER = 'rbxassetid://94215284059157';

// Formats file name into clean human readable Map Name (e.g. musicsbjoi.json -> SBJOI)
export function formatMapDisplayName(filename: string): string {
  let clean = filename.replace(/\.json$/i, '');
  clean = clean.replace(/^music[_]?/i, '');
  clean = clean.replace(/[_]/g, ' ').trim();
  return clean ? clean.toUpperCase() : filename;
}

// Converts user friendly new map name into standardized json filename
export function sanitizeMapFilename(name: string): string {
  let s = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = `map_${Date.now()}`;
  return s.startsWith('music') ? `${s}.json` : `music${s}.json`;
}

// Normalizes cover asset ID so user can input either raw numeric ID or rbxassetid://
export function normalizeCoverAssetId(val: string): string {
  let clean = String(val || '').trim();
  if (!clean) return DEFAULT_COVER;
  clean = clean.replace(/^(rbxassetid:\/\/+|rbxassetid:\/+|https?:\/\/)/i, '');
  clean = clean.replace(/^\/+/, '');
  if (/^\d+$/.test(clean)) {
    return `rbxassetid://${clean}`;
  }
  return clean ? `rbxassetid://${clean}` : DEFAULT_COVER;
}

export default function GitHubExportModal({ isOpen, onClose, songs, backendUrl = '' }: GitHubExportModalProps) {
  const { toast } = useToast();

  // Target Map (JSON Files) State
  const [mapFiles, setMapFiles] = useState<string[]>([]);
  const [selectedMapFile, setSelectedMapFile] = useState('musicsbjoi.json');
  const [isNewMap, setIsNewMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');

  // Genre (Playlist Category) State
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [isNewGenre, setIsNewGenre] = useState(false);
  const [newGenreName, setNewGenreName] = useState('');
  const [coverAssetId, setCoverAssetId] = useState(DEFAULT_COVER);

  // Editable Songs State
  const [items, setItems] = useState<EditableItem[]>([]);

  // Loading States
  const [fetchingMaps, setFetchingMaps] = useState(false);
  const [fetchingGenres, setFetchingGenres] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'commit' | 'snippet'>('commit');

  // Load saved preferences
  useEffect(() => {
    try {
      const savedMap = localStorage.getItem(STORAGE_KEYS.LAST_MAP) || 'musicsbjoi.json';
      const savedGenre = localStorage.getItem(STORAGE_KEYS.LAST_GENRE) || '';

      setSelectedMapFile(savedMap);
      if (savedGenre) setSelectedGenre(savedGenre);
    } catch {
      // ignore
    }
  }, []);

  // Initialize editable songs whenever modal opens or songs prop changes
  // DEFAULT: selected is FALSE so user can explicitly choose
  useEffect(() => {
    if (songs && songs.length > 0) {
      const mapped: EditableItem[] = songs
        .filter((s) => s.assetId)
        .map((s, index) => {
          const cleanId = typeof s.assetId === 'string' ? parseInt(s.assetId.replace(/\D/g, ''), 10) : Number(s.assetId);
          let speed = Number(s.playbackSpeed);
          if (!speed || isNaN(speed) || speed <= 0) {
            if (s.originalSpeed && s.originalSpeed > 0) {
              speed = parseFloat((1 / s.originalSpeed).toFixed(4));
            } else {
              speed = 0.4348;
            }
          } else {
            speed = parseFloat(Number(speed).toFixed(4));
          }

          return {
            id: `item_${cleanId || index}_${index}`,
            assetId: cleanId || 0,
            name: s.name || `Song_${cleanId}`,
            playbackSpeed: speed,
            selected: false, // Unchecked by default
          };
        });
      setItems(mapped);
    } else {
      setItems([]);
    }
  }, [songs]);

  // Fetch all maps (JSON files)
  const fetchMapFiles = async () => {
    setFetchingMaps(true);
    try {
      let res = await fetch('/api/github/maps');
      if (!res.ok && backendUrl) {
        res = await fetch(`${backendUrl}/api/github/maps`);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Gagal membaca file dari GitHub (Status ${res.status})`);
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.maps)) {
        const list = data.maps.map((map: MapOption) => map.filename);
        setMapFiles(list);
        const current = list.includes(selectedMapFile) ? selectedMapFile : (list[0] || 'musicsbjoi.json');
        setSelectedMapFile(current);
        if (current) fetchGenresForMap(current);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memuat daftar map dari GitHub';
      toast(msg, 'error');
    } finally {
      setFetchingMaps(false);
    }
  };

  // Fetch genres from the selected map file
  const fetchGenresForMap = async (mapFilename: string) => {
    if (!mapFilename.trim()) return;
    setFetchingGenres(true);
    try {
      let res = await fetch(`/api/github/genres?mapFile=${encodeURIComponent(mapFilename)}`);
      if (!res.ok && backendUrl) {
        res = await fetch(`${backendUrl}/api/github/genres?mapFile=${encodeURIComponent(mapFilename)}`);
      }

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.genres)) {
          setGenres(data.genres);
          if (data.genres.length > 0) {
            setSelectedGenre(data.genres[0]);
            setIsNewGenre(false);
          } else {
            setIsNewGenre(true);
          }
          return;
        }
      }
      setGenres([]);
      setIsNewGenre(true);
    } catch {
      setGenres([]);
      setIsNewGenre(true);
    } finally {
      setFetchingGenres(false);
    }
  };

  // Auto fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchMapFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSelectMap = (val: string) => {
    if (val === '__new__') {
      setIsNewMap(true);
      setGenres([]);
      setIsNewGenre(true);
    } else {
      setIsNewMap(false);
      setSelectedMapFile(val);
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_MAP, val);
      } catch {
        // ignore
      }
      fetchGenresForMap(val);
    }
  };

  const handleSelectGenre = (val: string) => {
    if (val === '__new__') {
      setIsNewGenre(true);
      setNewGenreName('');
    } else {
      setIsNewGenre(false);
      setSelectedGenre(val);
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_GENRE, val);
      } catch {
        // ignore
      }
    }
  };

  // Item list selection and inline name editing
  const handleItemToggle = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const handleItemNameChange = (id: string, newName: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name: newName } : item)));
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
  };

  const selectedCount = items.filter((i) => i.selected).length;

  // Generate output JSON snippet
  const generateSnippet = (): string => {
    const effectiveGenre = isNewGenre ? (newGenreName.trim().toUpperCase() || 'GENRE_BARU') : selectedGenre;
    const selectedItems = items.filter((i) => i.selected);

    const songsObj = selectedItems.map((item) => ({
      AssetId: item.assetId,
      Name: item.name,
      PlaybackSpeed: item.playbackSpeed,
    }));

    const result = {
      [effectiveGenre]: {
        Cover: normalizeCoverAssetId(coverAssetId),
        Songs: songsObj,
      },
    };

    return JSON.stringify(result, null, 2);
  };

  // Direct GitHub Commit via API
  const handleCommitToGitHub = async () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      toast('Pilih minimal 1 lagu yang ingin di-sync', 'error');
      return;
    }

    const targetFilename = isNewMap ? sanitizeMapFilename(newMapName) : selectedMapFile;
    if (!targetFilename) {
      toast('Pilih atau ketik nama map tujuan', 'error');
      return;
    }

    const targetGenre = isNewGenre ? newGenreName.trim().toUpperCase() : selectedGenre.trim().toUpperCase();
    if (!targetGenre) {
      toast('Pilih atau ketik nama Genre untuk lagu ini', 'error');
      return;
    }

    const effectiveCover = normalizeCoverAssetId(coverAssetId);

    setCommitting(true);
    toast(`Menghubungkan ke GitHub (${targetFilename})...`, 'info');

    try {
      const payload = {
        mapFilename: targetFilename,
        genre: targetGenre,
        songs: selectedItems.map((i) => ({
          AssetId: i.assetId,
          Name: i.name,
          PlaybackSpeed: i.playbackSpeed,
        })),
        isNewMap,
        newMapName,
        coverAssetId: effectiveCover,
      };

      let res = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok && backendUrl) {
        res = await fetch(`${backendUrl}/api/github/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || `Gagal commit ke GitHub (Status ${res.status})`);
      }

      toast(`Berhasil commit & push ${selectedItems.length} lagu ke map "${formatMapDisplayName(targetFilename)}"!`, 'success');
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Terjadi kesalahan saat commit ke GitHub';
      toast(msg, 'error');
    } finally {
      setCommitting(false);
    }
  };

  const copySnippetToClipboard = () => {
    navigator.clipboard.writeText(generateSnippet());
    toast('JSON berhasil disalin ke clipboard', 'success');
  };

  const downloadJsonFile = () => {
    const filename = isNewMap ? sanitizeMapFilename(newMapName) : selectedMapFile;
    const blob = new Blob([generateSnippet()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`File ${filename} berhasil diunduh`, 'success');
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--line)] shrink-0 bg-[var(--surface-50)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <GitHubIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 id="github-modal-title" className="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                Sync ke GitHub (S2 Music)
              </h3>
              <p className="text-xs text-[var(--text-45)]">
                Otomatis update list lagu ke repository <code className="font-mono text-[var(--accent-soft)]">{DEFAULT_REPO}</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal GitHub"
            className="p-2 text-[var(--text-40)] hover:text-[var(--text)] transition rounded-xl hover:bg-[var(--surface)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-45)]">
                    <Folder className="h-3.5 w-3.5 text-[var(--accent-soft)]" />
                    Pilih Map
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-40)]">Klik kartu tujuan penyimpanan lagu.</p>
                </div>
                {fetchingMaps && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-soft)]" />}
              </div>

              <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1">
                {mapFiles.map((filename) => {
                  const selected = !isNewMap && selectedMapFile === filename;
                  return (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => handleSelectMap(filename)}
                      className={`group flex min-h-16 items-center gap-2.5 rounded-xl border p-3 text-left transition duration-150 ease-out active:scale-[0.98] ${selected ? 'border-[var(--accent-30)] bg-[var(--accent-10)]' : 'border-[var(--line)] bg-[var(--surface-50)] hover:border-[var(--accent-25)]'}`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface-strong)] text-[var(--text-45)]'}`}>
                        {selected ? <Check className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-[var(--text-90)]">{formatMapDisplayName(filename)}</span>
                        <span className="mt-0.5 block truncate font-mono text-[9px] text-[var(--text-35)]">{filename}</span>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleSelectMap('__new__')}
                  className={`flex min-h-16 items-center gap-2.5 rounded-xl border border-dashed p-3 text-left transition duration-150 ease-out active:scale-[0.98] ${isNewMap ? 'border-[var(--accent-30)] bg-[var(--accent-10)]' : 'border-[var(--line)] text-[var(--text-50)] hover:border-[var(--accent-25)] hover:text-[var(--accent-strong)]'}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-strong)]">
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-bold">Map baru</span>
                </button>
              </div>

              {isNewMap && (
                <div className="mt-3 rounded-xl border border-[var(--accent-20)] bg-[var(--accent-06)] p-3">
                  <input
                    type="text"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    placeholder="Nama map baru"
                    className={`${INPUT} py-2 text-xs`}
                    autoFocus
                  />
                  <p className="mt-1.5 text-[10px] text-[var(--text-40)]">File: <span className="font-mono text-[var(--accent-soft)]">{sanitizeMapFilename(newMapName)}</span></p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-45)]">
                    <Tag className="h-3.5 w-3.5 text-[var(--accent-soft)]" />
                    Pilih Genre
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-40)]">Pilih kategori yang paling sesuai.</p>
                </div>
                {fetchingGenres && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-soft)]" />}
              </div>

              {!isNewMap && genres.length > 0 && (
                <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                  {genres.map((genre) => {
                    const selected = !isNewGenre && selectedGenre === genre;
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => handleSelectGenre(genre)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition duration-150 ease-out active:scale-[0.97] ${selected ? 'border-[var(--accent-30)] bg-[var(--accent)] text-[var(--on-accent)]' : 'border-[var(--line)] bg-[var(--surface-50)] text-[var(--text-70)] hover:border-[var(--accent-25)]'}`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {genre}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleSelectGenre('__new__')}
                    className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-[11px] font-bold transition duration-150 ease-out active:scale-[0.97] ${isNewGenre ? 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]' : 'border-[var(--line)] text-[var(--text-50)] hover:border-[var(--accent-25)]'}`}
                  >
                    <Plus className="h-3 w-3" />
                    Genre baru
                  </button>
                </div>
              )}

              {(isNewMap || isNewGenre || genres.length === 0) && (
                <div className="space-y-3 rounded-xl border border-[var(--accent-20)] bg-[var(--accent-06)] p-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--accent-soft)]">Nama genre baru</label>
                    <input
                      type="text"
                      value={newGenreName}
                      onChange={(e) => setNewGenreName(e.target.value.toUpperCase())}
                      placeholder="Contoh: KOPLO, POP, SLOW ROCK"
                      className={`${INPUT} py-2 text-xs font-bold uppercase`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-50)]">Cover Roblox Asset ID</label>
                    <input
                      type="text"
                      value={coverAssetId}
                      onChange={(e) => setCoverAssetId(e.target.value)}
                      placeholder="94215284059157"
                      className={`${INPUT} py-2 font-mono text-xs`}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Song List with Inline Editable Names */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className={LABEL}>Daftar Lagu ({selectedCount}/{items.length} Dipilih)</p>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[11px] text-[var(--accent-soft)] hover:underline font-semibold"
                >
                  {items.length > 0 && items.every((i) => i.selected) ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>
              <span className="text-[10px] text-[var(--text-40)]">
                Judul lagu dapat diedit langsung sebelum di-commit
              </span>
            </div>

            {items.length === 0 ? (
              <div className="empty-state py-8 text-center rounded-xl border border-dashed border-[var(--line)] text-xs text-[var(--text-40)]">
                Belum ada audio dengan status Active yang siap di-sync.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, transform: 'translateY(6px)' }}
                    animate={{ opacity: 1, transform: 'translateY(0)' }}
                    transition={{ duration: 0.18, delay: index * 0.035, ease: [0.23, 1, 0.32, 1] }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                      item.selected
                        ? 'border-[var(--accent-30)] bg-[var(--accent-06)]'
                        : 'border-[var(--line)] bg-[var(--surface-50)] opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => handleItemToggle(item.id)}
                      className="w-4 h-4 rounded border-[var(--line)] accent-[var(--accent)] cursor-pointer shrink-0"
                    />

                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemNameChange(item.id, e.target.value)}
                          placeholder="Nama lagu in-game..."
                          className={`${INPUT} text-xs py-1.5 font-medium`}
                          disabled={!item.selected}
                        />
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 text-right">
                        <span className="font-mono text-[11px] text-[var(--accent-soft)] font-bold">
                          ID: {item.assetId}
                        </span>
                        <span className="rounded bg-[var(--surface-strong)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-60)]">
                          {item.playbackSpeed}x
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Snippet Preview (if tab is snippet) */}
          {activeTab === 'snippet' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={LABEL}>JSON Output Preview</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copySnippetToClipboard}
                    className="text-[11px] text-[var(--accent-soft)] hover:underline flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Salin JSON
                  </button>
                  <button
                    type="button"
                    onClick={downloadJsonFile}
                    className="text-[11px] text-[var(--accent-soft)] hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Unduh .json
                  </button>
                </div>
              </div>
              <pre className="p-3 rounded-xl bg-black/60 border border-[var(--line)] font-mono text-[11px] text-[var(--text-80)] max-h-36 overflow-y-auto">
                {generateSnippet()}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface-50)] shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'commit' ? 'snippet' : 'commit')}
              className={`${BTN_GHOST} text-xs py-2 px-3 w-full sm:w-auto`}
            >
              <FileCode className="w-3.5 h-3.5" />
              {activeTab === 'commit' ? 'Lihat JSON Manual' : 'Kembali ke Mode Commit'}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={committing}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-60)] hover:text-[var(--text)] transition"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleCommitToGitHub}
              disabled={committing || selectedCount === 0}
              className={`${BTN_PRIMARY} text-xs py-2 px-5 font-bold flex-1 sm:flex-none flex items-center justify-center gap-2`}
            >
              {committing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengirim Commit ke GitHub...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  Commit &amp; Push ({selectedCount} Lagu)
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
