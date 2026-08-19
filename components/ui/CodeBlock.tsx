import type { ReactNode } from 'react';

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}

export function CodeBlock({ children, className = '', maxHeight = '550px' }: CodeBlockProps) {
  return (
    <pre
      className={`rounded-xl border border-[var(--line)] bg-black/70 p-4 font-mono text-xs leading-relaxed text-[var(--text)] ${className}`}
      style={{ maxHeight, overflow: 'auto' }}
    >
      {children}
    </pre>
  );
}

interface TerminalProps {
  title?: string;
  children: ReactNode;
  maxHeight?: string;
}

export function Terminal({ title = 'terminal.sh', children, maxHeight = '56' }: TerminalProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-black/70">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 font-mono text-[10px] text-white/50">{title}</span>
      </div>
      <div className={`max-h-${maxHeight} overflow-y-auto p-3 font-mono text-[11px] leading-relaxed`}>
        {children}
      </div>
    </div>
  );
}
