'use client';

import { useState } from 'react';
import { Music, Sparkles, Terminal, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Tool = 'audio-master' | 'spoofer' | 'dumper' | 'obfuscator';

interface SidebarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const tools = [
  { id: 'audio-master' as Tool, label: 'Audio Master', icon: Music, description: 'Convert & upload audio' },
  { id: 'spoofer' as Tool, label: 'Spoofer', icon: Sparkles, description: 'Asset ID spoofer' },
  { id: 'dumper' as Tool, label: 'Dumper', icon: Terminal, description: 'Script deobfuscator' },
  { id: 'obfuscator' as Tool, label: 'Obfuscator', icon: Lock, description: 'Script protection' },
];

export default function Sidebar({ activeTool, onToolChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="sidebar relative flex flex-col h-[calc(100vh-64px)] border-r border-[var(--line)] bg-[var(--panel)]"
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--text)] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 space-y-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          
          return (
            <motion.button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                sidebar-item neon-glow w-full flex items-center gap-3 px-3 py-3 rounded-xl
                transition-all duration-200
                ${isActive ? 'active text-[var(--text)]' : 'text-[var(--text-60)] hover:text-[var(--text)]'}
              `}
            >
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                ${isActive ? 'bg-[var(--accent-20)] text-[var(--accent)]' : 'bg-[var(--surface)] text-[var(--text-60)]'}
              `}>
                <Icon className="w-5 h-5" />
              </div>
              
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 text-left overflow-hidden"
                  >
                    <div className="font-semibold text-sm whitespace-nowrap">{tool.label}</div>
                    <div className="text-xs text-[var(--text-50)] whitespace-nowrap">{tool.description}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom Section - Stats Summary */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 border-t border-[var(--line)]"
          >
            <div className="text-xs text-[var(--text-50)] text-center">
              S2 Studio v2.0
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
