'use client';

import { Copy, FileCode, Lock, Music } from 'lucide-react';

type Tool = 'audio-master' | 'spoofer' | 'dumper' | 'obfuscator';

interface SidebarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const tools = [
  { id: 'audio-master' as Tool, label: 'Audio', desktopLabel: 'Audio Master', icon: Music },
  { id: 'spoofer' as Tool, label: 'Spoofer', desktopLabel: 'Asset Spoofer', icon: Copy },
  { id: 'dumper' as Tool, label: 'Dumper', desktopLabel: 'Script Dumper', icon: FileCode },
  { id: 'obfuscator' as Tool, label: 'Obfuscator', desktopLabel: 'Obfuscator', icon: Lock },
];

export default function Sidebar({ activeTool, onToolChange }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r-2 border-[var(--text)] bg-[var(--panel)] lg:flex lg:flex-col">
        <div className="px-5 pb-2 pt-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-50)]">Creative tools</p>
        </div>
        <nav className="space-y-1.5 p-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onToolChange(tool.id)}
                className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition active:translate-y-[1px] ${
                  active
                    ? 'border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)] shadow-[3px_3px_0_0_var(--text)]'
                    : 'border-transparent text-[var(--text-60)] hover:border-[var(--line)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-[var(--text)] ${active ? 'bg-white/20' : 'bg-[var(--surface)] text-[var(--text-50)]'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold uppercase tracking-wide">{tool.desktopLabel}</span>
                  <span className="mt-0.5 block text-[10px] font-medium opacity-70">
                    {tool.id === 'audio-master' ? 'Convert & upload' : tool.id === 'spoofer' ? 'Clone assets' : tool.id === 'dumper' ? 'Inspect scripts' : 'Protect scripts'}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-2 border-[var(--text)] bg-[var(--panel)] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ height: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        {tools.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onToolChange(tool.id)}
              className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide transition active:translate-y-[1px] ${active ? 'text-[var(--accent)]' : 'text-[var(--text-45)]'}`}
            >
              {active && <span className="absolute inset-x-4 top-0 h-1 bg-[var(--accent)]" />}
              <Icon className="h-4.5 w-4.5" />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
