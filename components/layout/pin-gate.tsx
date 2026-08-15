'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LockKeyhole, Music } from 'lucide-react';
import { useUIStore } from '../../lib/stores/uiStore';

const CORRECT_PIN = process.env.NEXT_PUBLIC_PIN || '515753';

export function PinGate() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const setUnlocked = useUIStore((s) => s.setUnlocked);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent-06)_0%,transparent_70%)]" />
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle, var(--accent) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-8 shadow-2xl backdrop-blur-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center mb-4 shadow-lg">
              <Music size={28} className="text-[var(--on-accent)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">S2 Studio</h1>
            <p className="text-sm text-[var(--text-50)] mt-1">Audio Master to Roblox</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)] block text-center">
                Access Code
              </label>
              <motion.div
                animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                transition={{ duration: 0.4 }}
              >
                <div className="relative">
                  <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-35)]" />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ''));
                      setError(false);
                    }}
                    placeholder="Enter 6-digit code"
                    className={`w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-2xl py-4 pl-11 pr-4 border text-sm text-center tracking-[0.3em] text-lg font-mono outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] placeholder:tracking-normal placeholder:text-sm placeholder:font-normal ${
                      error ? 'border-[var(--danger)]' : 'border-[var(--line)]'
                    }`}
                    autoFocus
                    aria-invalid={error}
                    aria-describedby={error ? 'pin-error' : undefined}
                  />
                </div>
              </motion.div>
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    id="pin-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-[var(--danger)] text-center"
                  >
                    Incorrect code. Try again.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button
              type="submit"
              disabled={pin.length < 6}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] text-[var(--on-accent)] font-semibold text-sm transition duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-lg shadow-[var(--accent-15)]"
            >
              Unlock Studio
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-[10px] text-[var(--text-30)]">
          Created by fhrlsym
        </p>
      </motion.div>
    </div>
  );
}