'use client';

import { useUIStore, type ToolId } from '../../lib/stores/uiStore';
import { Music, Copy, FileCode, Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tools: { id: ToolId; label: string; icon: typeof Music; desc: string }[] = [
  { id: 'audio-master', label: 'Audio Master', icon: Music, desc: 'Upload & convert audio' },
  { id: 'spoofer', label: 'Asset Spoofer', icon: Copy, desc: 'Clone Roblox assets' },
  { id: 'dumper', label: 'Script Dumper', icon: FileCode, desc: 'Deobfuscate Luau scripts' },
  { id: 'obfuscator', label: 'Obfuscator', icon: Shield, desc: 'Protect your scripts' },
];

export function Sidebar() {
  const pathname = usePathname();
  const activeTool = pathname === '/' ? 'audio-master' : (pathname.slice(1) as ToolId);
  const setActiveTool = useUIStore((s) => s.setActiveTool);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 border-r border-[var(--line)] bg-[var(--panel)] shrink-0">
        <div className="p-4 border-b border-[var(--line)]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center">
              <Music size={16} className="text-[var(--on-accent)]" />
            </div>
            <span className="font-semibold text-[var(--text)] tracking-tight">S2 Studio</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <Link
                key={tool.id}
                href={tool.id === 'audio-master' ? '/' : `/${tool.id}`}
                onClick={() => {
                  setActiveTool(tool.id);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150 ease-out ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--accent-12)] to-transparent text-[var(--accent-strong)]'
                    : 'text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                }`}
              >
                <Icon size={18} />
                <div>
                  <div>{tool.label}</div>
                  <div className="text-[10px] text-[var(--text-35)] font-normal">{tool.desc}</div>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[var(--line)]">
          <div className="px-3 py-2 rounded-xl bg-[var(--surface-50)]">
            <p className="text-[10px] text-[var(--text-35)]">S2 Studio v2</p>
            <p className="text-[10px] text-[var(--text-35)]">by fhrlsym</p>
          </div>
        </div>
      </aside>

      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-xl bg-[var(--panel)] border border-[var(--line)] text-[var(--text)]"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="relative w-64 h-full bg-[var(--panel)] border-r border-[var(--line)] p-4 pt-16 space-y-1">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <Link
                  key={tool.id}
                  href={tool.id === 'audio-master' ? '/' : `/${tool.id}`}
                  onClick={() => {
                    setActiveTool(tool.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive
                      ? 'bg-[var(--accent-12)] text-[var(--accent-strong)]'
                      : 'text-[var(--text-60)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <Icon size={18} />
                  {tool.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--panel)] border-t border-[var(--line)] safe-area-bottom">
        <div className="flex">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <Link
                key={tool.id}
                href={tool.id === 'audio-master' ? '/' : `/${tool.id}`}
                onClick={() => setActiveTool(tool.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--text-40)]'
                }`}
              >
                <Icon size={18} />
                <span>{tool.label}</span>
                {isActive && <div className="w-6 h-0.5 rounded-full bg-[var(--accent)] mt-0.5" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}