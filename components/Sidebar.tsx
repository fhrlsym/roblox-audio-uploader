'use client';

import { Lock, Music, Sparkles, Terminal } from 'lucide-react';

type Tool = 'audio-master' | 'spoofer' | 'dumper' | 'obfuscator';

interface SidebarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const tools = [
  { id: 'audio-master' as Tool, label: 'Audio', desktopLabel: 'Audio Master', icon: Music },
  { id: 'spoofer' as Tool, label: 'Spoofer', desktopLabel: 'Spoofer', icon: Sparkles },
  { id: 'dumper' as Tool, label: 'Dumper', desktopLabel: 'Dumper', icon: Terminal },
  { id: 'obfuscator' as Tool, label: 'Obfuscator', desktopLabel: 'Obfuscator', icon: Lock },
];

export default function Sidebar({ activeTool, onToolChange }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-[var(--line)] bg-[var(--panel)] lg:flex lg:flex-col">
        <div className="px-5 pb-2 pt-5">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-35)]">Creative tools</p>
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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.98] ${
                  active
                    ? 'bg-[var(--accent-12)] text-[var(--text)]'
                    : 'text-[var(--text-60)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-[var(--accent-15)] text-[var(--accent-strong)]' : 'bg-[var(--surface)] text-[var(--text-50)]'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{tool.desktopLabel}</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--text-40)]">
                    {tool.id === 'audio-master' ? 'Convert & upload' : tool.id === 'spoofer' ? 'Clone assets' : tool.id === 'dumper' ? 'Inspect scripts' : 'Protect scripts'}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-4 border-t border-[var(--line)] bg-[var(--panel)]/95 px-2 backdrop-blur-xl lg:hidden">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onToolChange(tool.id)}
              className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors active:scale-[0.96] ${active ? 'text-[var(--accent-strong)]' : 'text-[var(--text-45)]'}`}
            >
              {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--accent)]" />}
              <Icon className="h-4.5 w-4.5" />
              <span>{tool.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
