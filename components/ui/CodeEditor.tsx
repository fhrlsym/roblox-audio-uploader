'use client';

import { useRef } from 'react';
import { Copy, Trash2, Upload } from 'lucide-react';
import { Textarea } from './Input';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  heightClass?: string;
  onPasteClipboard?: () => void;
  onLoaded?: (code: string, fileName: string) => void;
  onClear?: () => void;
  footer?: React.ReactNode;
  label?: string;
  actions?: React.ReactNode;
}

export function CodeEditor({
  value,
  onChange,
  placeholder,
  heightClass = 'h-64',
  onPasteClipboard,
  onLoaded,
  onClear,
  footer,
  label,
  actions,
}: CodeEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLoaded) return;
    const reader = new FileReader();
    reader.onload = (ev) => onLoaded(String(ev.target?.result || ''), file.name);
    reader.readAsText(file);
    e.target.value = '';
  };

  const lineCount = value ? value.split(/\r?\n/).length : 0;
  const charCount = value.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {label ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-50)]">{label}</span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          {onPasteClipboard && (
            <button
              type="button"
              onClick={onPasteClipboard}
              className="inline-flex items-center gap-1 rounded-md border-2 border-[var(--text)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text)] transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:translate-y-[1px]"
              title="Paste dari Clipboard"
            >
              <Copy className="h-3 w-3" />
              Paste
            </button>
          )}
          {onLoaded && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border-2 border-[var(--text)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text)] transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:translate-y-[1px]"
                title="Upload File"
              >
                <Upload className="h-3 w-3" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".lua,.luau,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}
          {actions}
          {onClear && value && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border-2 border-[var(--text)] bg-[var(--panel)] p-1 text-[var(--text)] transition hover:bg-[var(--danger)] hover:text-white active:translate-y-[1px]"
              title="Hapus Input"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={`font-mono text-xs ${heightClass} resize-y leading-relaxed p-3.5`}
      />

      {footer ?? (
        <div className="flex items-center justify-between font-mono text-[11px] text-[var(--text-40)]">
          <span>Baris: {lineCount}</span>
          <span>Karakter: {charCount.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
