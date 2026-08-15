'use client';

import { useState } from 'react';
import { User, Building2, Palette, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SavedAccount } from '../types/audio';

interface TopBarProps {
  selectedAccount: SavedAccount | null;
  onAccountClick: () => void;
  theme: string;
  onThemeClick: () => void;
}

export default function TopBar({ selectedAccount, onAccountClick, theme, onThemeClick }: TopBarProps) {
  const [showNotification, setShowNotification] = useState(false);

  return (
    <header className="relative h-16 border-b border-[var(--line)] bg-[var(--panel)] overflow-hidden">
      {/* Animated Gradient Background */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            'linear-gradient(90deg, var(--accent-20) 0%, transparent 50%, var(--accent-10) 100%)',
            'linear-gradient(90deg, var(--accent-10) 0%, var(--accent-20) 50%, transparent 100%)',
            'linear-gradient(90deg, transparent 0%, var(--accent-10) 50%, var(--accent-20) 100%)',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* Content */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-deep)] flex items-center justify-center pulse-glow"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-xl font-bold text-[var(--text)]">S2</span>
          </motion.div>
          <div>
            <h1 className="gradient-text text-xl font-bold">S2 Studio</h1>
            <p className="text-xs text-[var(--text-50)]">Premium Roblox Tools</p>
          </div>
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <motion.button
            onClick={() => setShowNotification(!showNotification)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--text-60)] hover:text-[var(--text)] transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--accent)] rounded-full pulse-glow" />
          </motion.button>

          {/* Theme Picker */}
          <motion.button
            onClick={onThemeClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--text-60)] hover:text-[var(--text)] transition-colors"
          >
            <Palette className="w-5 h-5" />
          </motion.button>

          {/* Account Selector */}
          <motion.button
            onClick={onAccountClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--accent-30)] transition-colors"
          >
            {selectedAccount?.thumbnail ? (
              <img
                src={selectedAccount.thumbnail}
                alt={selectedAccount.name}
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-20)] flex items-center justify-center">
                {selectedAccount?.type === 'group' ? (
                  <Building2 className="w-5 h-5 text-[var(--accent)]" />
                ) : (
                  <User className="w-5 h-5 text-[var(--accent)]" />
                )}
              </div>
            )}
            <div className="text-left">
              <div className="text-sm font-semibold text-[var(--text)]">
                {selectedAccount?.name || 'Select Account'}
              </div>
              <div className="text-xs text-[var(--text-50)]">
                {selectedAccount?.type === 'group' ? 'Group' : 'User'}
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
