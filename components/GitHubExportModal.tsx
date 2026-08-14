'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileCode,
  Folder,
  Key,
  Loader2,
  Music,
  Plus,
  RefreshCw,
  Settings,
  Tag,
  UploadCloud,
  X,
} from 'lucide-react';
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST } from '../lib/ui';
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
}

interface EditableItem {
  id: string;
  assetId: number;
  name: string;
  playbackSpeed: number;
  selected: boolean;
}

interface GitHubFileEntry {
  name: string;
  path: string;
  type: string;
}

const STORAGE_KEYS = {
  TOKEN: 'audioUploader_githubToken',
  REPO: 'audioUploader_githubRepo',
  BRANCH: 'audioUploader_githubBranch',
  LAST_FILE: 'audioUploader_lastJsonFile',
  LAST_CATEGORY: 'audioUploader_lastCategory',
};

const DEFAULT_COVER = 'rbxassetid://94215284059157';

export default function GitHubExportModal({ isOpen, onClose, songs }: GitHubExportModalProps) {
  const { toast } = useToast();

  // Settings State
  const [githubToken, setGithubToken] = useState('');
  const [githubRepo, setGithubRepo] = useState('fhrlsym/minang-music');
  const [githubBranch, setGithubBranch] = useState('main');
  const [showConfig, setShowConfig] = useState(false);

  // File & Category State
  const [jsonFiles, setJsonFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState('musicsbjoi.json');
  const [customFile, setCustomFile] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [coverAssetId, setCoverAssetId] = useState(DEFAULT_COVER);

  // Editable Songs State
  const [items, setItems] = useState<EditableItem[]>([]);

  // Loading States
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [fetchingCategories, setFetchingCategories] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'commit' | 'snippet'>('commit');

  // Load saved settings from localStorage on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
      const savedRepo = localStorage.getItem(STORAGE_KEYS.REPO) || 'fhrlsym/minang-music';
      const savedBranch = localStorage.getItem(STORAGE_KEYS.BRANCH) || 'main';
      const savedFile = localStorage.getItem(STORAGE_KEYS.LAST_FILE) || 'musicsbjoi.json';
      const savedCategory = localStorage.getItem(STORAGE_KEYS.LAST_CATEGORY) || '';

      setGithubToken(savedToken);
      setGithubRepo(savedRepo);
      setGithubBranch(savedBranch);
      setSelectedFile(savedFile);
      if (savedCategory) setSelectedCategory(savedCategory);

      if (!savedToken) {
        setShowConfig(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initialize editable songs whenever modal opens or songs change
  useEffect(() => {
    if (songs && songs.length > 0) {
      const mapped: EditableItem[] = songs.map((s, index) => {
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
          id: `item_${cleanId || index}_${Date.now()}_${index}`,
          assetId: cleanId || 0,
          name: s.name || `Song_${cleanId}`,
          playbackSpeed: speed,
          selected: false,
        };
      });
      setItems(mapped);
    } else {
      setItems([]);
    }
  }, [songs]);

  // Fetch JSON files list from GitHub repository
  const fetchJsonFiles = async (token: string, repo: string) => {
    if (!token.trim() || !repo.trim()) return;
    setFetchingFiles(true);
    try {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) throw new Error('Format repository harus owner/repo');

      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Gagal membaca file dari GitHub (Status ${res.status})`);
      }

      const data = (await res.json()) as GitHubFileEntry[];
      if (Array.isArray(data)) {
        const jsonList = data
          .filter((f) => f.type === 'file' && f.name.toLowerCase().endsWith('.json'))
          .map((f) => f.name);

        setJsonFiles(jsonList);

        if (jsonList.length > 0 && !jsonList.includes(selectedFile)) {
          setSelectedFile(jsonList[0]);
          fetchCategoriesForFile(token, repo, jsonList[0]);
        } else if (selectedFile) {
          fetchCategoriesForFile(token, repo, selectedFile);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memuat file JSON dari GitHub';
      toast(msg, 'error');
    } finally {
      setFetchingFiles(false);
    }
  };

  // Fetch categories inside a specific JSON file
  const fetchCategoriesForFile = async (token: string, repo: string, filePath: string) => {
    if (!token.trim() || !repo.trim() || !filePath.trim()) return;
    setFetchingCategories(true);
    try {
      const [owner, repoName] = repo.split('/');
      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.ok) {
        const fileData = await res.json();
        const contentStr = decodeBase64Utf8(fileData.content || '');
        const parsed = JSON.parse(contentStr);

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const cats = Object.keys(parsed).filter((k) => k !== 'Cover' && k !== 'Songs');
          setCategories(cats);
          if (cats.length > 0 && (!selectedCategory || !cats.includes(selectedCategory))) {
            setSelectedCategory(cats[0]);
          }
        } else {
          setCategories([]);
        }
      }
    } catch {
      setCategories([]);
    } finally {
      setFetchingCategories(false);
    }
  };

  // Fetch files whenever token or repo changes and modal is open
  useEffect(() => {
    if (isOpen && githubToken && githubRepo) {
      fetchJsonFiles(githubToken, githubRepo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSaveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, githubToken.trim());
      localStorage.setItem(STORAGE_KEYS.REPO, githubRepo.trim());
      localStorage.setItem(STORAGE_KEYS.BRANCH, githubBranch.trim());
      toast('Pengaturan GitHub berhasil disimpan', 'success');
      setShowConfig(false);
      fetchJsonFiles(githubToken, githubRepo);
    } catch {
      toast('Gagal menyimpan ke penyimpanan lokal', 'error');
    }
  };

  const handleSelectFile = (file: string) => {
    setSelectedFile(file);
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_FILE, file);
    } catch {}
    fetchCategoriesForFile(githubToken, githubRepo, file);
  };

  const handleItemNameChange = (id: string, newName: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, name: newName } : item)));
  };

  const handleItemToggle = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
  };

  const decodeBase64Utf8 = (base64: string): string => {
    try {
      const clean = base64.replace(/\s+/g, '');
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch {
      return '';
    }
  };

  const encodeBase64Utf8 = (str: string): string => {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Generate Snippet
  const generateSnippet = () => {
    const selected = items.filter((i) => i.selected);
    const snippetArray = selected.map((i) => ({
      AssetId: i.assetId,
      Name: i.name.trim(),
      PlaybackSpeed: i.playbackSpeed,
    }));
    return JSON.stringify(snippetArray, null, 2);
  };

  const copySnippetToClipboard = () => {
    const text = generateSnippet();
    navigator.clipboard.writeText(text);
    toast('JSON Snippet disalin ke clipboard', 'success');
  };

  const downloadJsonFile = () => {
    const text = generateSnippet();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile || 'music_playlist.json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('File JSON berhasil diunduh', 'success');
  };

  // Main Commit & Push Action
  const handleCommitToGitHub = async () => {
    if (!githubToken.trim()) {
      setShowConfig(true);
      toast('Masukkan GitHub Personal Access Token terlebih dahulu', 'error');
      return;
    }

    const selectedItems = items.filter((i) => i.selected && i.assetId > 0 && i.name.trim());
    if (selectedItems.length === 0) {
      toast('Pilih minimal satu lagu dengan nama yang valid', 'error');
      return;
    }

    const targetFileName = (customFile.trim() || selectedFile.trim()).replace(/^\/+/, '');
    if (!targetFileName) {
      toast('Pilih atau masukkan nama file JSON target', 'error');
      return;
    }

    const targetCategory = (isNewCategory ? newCategoryName.trim() : selectedCategory.trim()).toUpperCase();
    if (!targetCategory) {
      toast('Pilih atau masukkan nama kategori lagu', 'error');
      return;
    }

    setCommitting(true);

    try {
      const [owner, repoName] = githubRepo.split('/');
      if (!owner || !repoName) throw new Error('Format repository harus owner/repo (contoh: fhrlsym/minang-music)');

      // 1. Fetch current file content & SHA
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${targetFileName}?ref=${githubBranch}`, {
        headers: {
          Authorization: `Bearer ${githubToken.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      let currentJson: Record<string, unknown> = {};
      let currentSha: string | undefined = undefined;

      if (getRes.ok) {
        const fileData = await getRes.json();
        currentSha = fileData.sha;
        const decoded = decodeBase64Utf8(fileData.content || '');
        if (decoded.trim()) {
          try {
            currentJson = JSON.parse(decoded);
          } catch {
            currentJson = {};
          }
        }
      } else if (getRes.status === 404) {
        // File does not exist yet; will create new file
        currentJson = {};
      } else {
        const err = await getRes.json().catch(() => ({}));
        throw new Error(err.message || `Gagal membaca file dari GitHub (Status ${getRes.status})`);
      }

      // 2. Merge songs into the selected category
      let categoryObj = (currentJson[targetCategory] || {}) as Record<string, unknown>;
      if (typeof categoryObj !== 'object' || categoryObj === null || Array.isArray(categoryObj)) {
        categoryObj = {
          Cover: coverAssetId.trim() || DEFAULT_COVER,
          Songs: [],
        };
      }

      if (!categoryObj.Cover) {
        categoryObj.Cover = coverAssetId.trim() || DEFAULT_COVER;
      }

      let songsList = (Array.isArray(categoryObj.Songs) ? categoryObj.Songs : []) as Record<string, unknown>[];

      // Add or update selected songs
      for (const item of selectedItems) {
        const existingIndex = songsList.findIndex((s) => Number(s.AssetId) === item.assetId);
        const songEntry = {
          AssetId: item.assetId,
          Name: item.name.trim(),
          PlaybackSpeed: item.playbackSpeed,
        };

        if (existingIndex >= 0) {
          songsList[existingIndex] = { ...songsList[existingIndex], ...songEntry };
        } else {
          songsList.push(songEntry);
        }
      }

      categoryObj.Songs = songsList;
      currentJson[targetCategory] = categoryObj;

      // 3. Encode and commit to GitHub
      const updatedJsonString = JSON.stringify(currentJson, null, 2);
      const encodedContent = encodeBase64Utf8(updatedJsonString);

      const songNamesPreview = selectedItems.slice(0, 2).map((s) => s.name).join(', ');
      const moreCount = selectedItems.length > 2 ? ` (+${selectedItems.length - 2} more)` : '';
      const commitMessage = `feat(music): add ${selectedItems.length} song(s) to ${targetCategory} [${songNamesPreview}${moreCount}]`;

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/${targetFileName}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken.trim()}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage,
          content: encodedContent,
          sha: currentSha,
          branch: githubBranch,
        }),
      });

      if (!putRes.ok) {
        const putErr = await putRes.json().catch(() => ({}));
        throw new Error(putErr.message || `Gagal melakukan commit ke GitHub (Status ${putRes.status})`);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.LAST_CATEGORY, targetCategory);
        localStorage.setItem(STORAGE_KEYS.LAST_FILE, targetFileName);
      } catch {}

      toast(`Berhasil commit & push ${selectedItems.length} lagu ke ${targetFileName} (${targetCategory})!`, 'success');
      onClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal melakukan commit ke GitHub';
      toast(msg, 'error');
    } finally {
      setCommitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-[var(--accent-15)] bg-[var(--panel)] shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--line)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-15)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <GitHubIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">
                Sync ke GitHub (S2 Music)
              </h3>
              <p className="text-xs text-[var(--text-45)]">
                Commit langsung ke repo <code className="font-mono text-[var(--accent-soft)]">{githubRepo}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`p-2 rounded-xl border transition ${
                showConfig
                  ? 'border-[var(--accent-40)] bg-[var(--accent-15)] text-[var(--accent-strong)]'
                  : 'border-[var(--line)] text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
              }`}
              title="Pengaturan GitHub Token"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--text-40)] hover:text-[var(--text)] transition rounded-lg hover:bg-[var(--surface)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* GitHub Settings Drawer */}
        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-[var(--line)] bg-[var(--surface-50)] p-4 space-y-3 shrink-0"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[var(--accent-soft)]" />
                  Konfigurasi GitHub Personal Access Token (PAT)
                </p>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=S2StudioAudioUploader"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[var(--accent-soft)] hover:underline"
                >
                  Buat Token Baru di GitHub
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-semibold uppercase text-[var(--text-40)] mb-1 block">
                    GitHub Token (repo / contents:write)
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className={`${INPUT} text-xs font-mono py-2`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase text-[var(--text-40)] mb-1 block">
                    Repository
                  </label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="fhrlsym/minang-music"
                    className={`${INPUT} text-xs font-mono py-2`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className={`${BTN_PRIMARY} text-xs py-1.5 px-4`}
                >
                  Simpan Pengaturan
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Target File and Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {/* Target JSON Map File */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)] flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-[var(--accent-soft)]" />
                  Target Map (File JSON)
                </label>
                {fetchingFiles && <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-soft)]" />}
              </div>

              {jsonFiles.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={selectedFile}
                    onChange={(e) => handleSelectFile(e.target.value)}
                    className={`${INPUT} text-xs py-2 bg-[var(--surface-focus)]`}
                  >
                    {jsonFiles.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value="__custom__">+ Ketik Nama File Lain</option>
                  </select>
                  {selectedFile === '__custom__' && (
                    <input
                      type="text"
                      value={customFile}
                      onChange={(e) => setCustomFile(e.target.value)}
                      placeholder="contoh: music_padang.json"
                      className={`${INPUT} text-xs py-2 mt-1`}
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  placeholder="musicsbjoi.json"
                  className={`${INPUT} text-xs py-2`}
                />
              )}
            </div>

            {/* Target Category */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[var(--accent-soft)]" />
                  Kategori Playlist
                </label>
                {fetchingCategories && <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-soft)]" />}
              </div>

              {!isNewCategory && categories.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setIsNewCategory(true);
                      } else {
                        setSelectedCategory(e.target.value);
                      }
                    }}
                    className={`${INPUT} text-xs py-2 bg-[var(--surface-focus)]`}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__new__">+ Buat Kategori Baru...</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={isNewCategory ? newCategoryName : selectedCategory}
                      onChange={(e) => {
                        if (isNewCategory) setNewCategoryName(e.target.value.toUpperCase());
                        else setSelectedCategory(e.target.value.toUpperCase());
                      }}
                      placeholder="Contoh: REGGAE, HIPHOP, POP"
                      className={`${INPUT} text-xs py-2 uppercase`}
                    />
                    {categories.length > 0 && isNewCategory && (
                      <button
                        type="button"
                        onClick={() => setIsNewCategory(false)}
                        className="px-2.5 text-xs text-[var(--text-50)] hover:text-[var(--text)]"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                  {isNewCategory && (
                    <input
                      type="text"
                      value={coverAssetId}
                      onChange={(e) => setCoverAssetId(e.target.value)}
                      placeholder="Cover ID: rbxassetid://..."
                      className={`${INPUT} text-[11px] py-1.5 font-mono`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Song List with Inline Editable Names */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className={LABEL}>Daftar Lagu ({selectedCount}/{items.length} Dipilih)</p>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-[11px] text-[var(--accent-soft)] hover:underline"
                >
                  {items.every((i) => i.selected) ? 'Hapus Centang' : 'Pilih Semua'}
                </button>
              </div>
              <span className="text-[10px] text-[var(--text-40)]">
                Ketik langsung pada kotak judul untuk mengubah nama in-game
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-6 text-center rounded-xl border border-dashed border-[var(--line)] text-xs text-[var(--text-40)]">
                Tidak ada lagu untuk di-sync.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
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
                  </div>
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
        <div className="p-5 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface-50)]">
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
