'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Copy, FileCode, Lock, Music, ShieldCheck, Sparkles, Upload, Zap } from 'lucide-react';
import S2Logo from './S2Logo';

interface LandingSectionProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    id: 'audio-master',
    title: 'Audio Master',
    desc: 'Konversi dari YouTube, SoundCloud, atau file lokal lalu tune ke MP3 siap-upload.',
    icon: Music,
    tag: 'Convert · Tune · Upload',
  },
  {
    id: 'spoofer',
    title: 'Asset Spoofer',
    desc: 'Clone aset Roblox dengan cepat — thumbnail, judul, dan metadata ikut terbawa.',
    icon: Copy,
    tag: 'Clone assets',
  },
  {
    id: 'dumper',
    title: 'Script Dumper',
    desc: 'Inspect & dump script dari game untuk dianalisis, langsung dari workspace.',
    icon: FileCode,
    tag: 'Inspect scripts',
  },
  {
    id: 'obfuscator',
    title: 'Obfuscator',
    desc: 'Lindungi script buatanmu dengan obfuscation sekali klik sebelum di-upload.',
    icon: Lock,
    tag: 'Protect scripts',
  },
];

const STEPS = [
  { icon: Upload, label: 'Input', desc: 'File lokal, YouTube, atau SoundCloud' },
  { icon: Zap, label: 'Tune', desc: 'Speed & amplify dalam satu klik' },
  { icon: ShieldCheck, label: 'Upload', desc: 'Batch upload ke Roblox aman' },
  { icon: Sparkles, label: 'Sync', desc: 'Riwayat tersimpan di cloud' },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as const } },
};

export default function LandingSection({ onEnter }: LandingSectionProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Background ornamen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-12%,var(--accent-12),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      {/* Nav mini */}
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] shadow-lg shadow-[var(--accent-20)]">
            <S2Logo className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none">S2 Studio</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--text-40)]">Roblox audio suite</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEnter}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-80)] transition-all duration-150 hover:border-[var(--accent-30)] hover:text-[var(--text)] active:scale-[0.97]"
        >
          Masuk
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </header>

      <motion.main
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6"
      >
        {/* Hero */}
        <motion.section variants={item} className="pt-14 pb-16 text-center sm:pt-24 sm:pb-20">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent-25)] bg-[var(--accent-08)] px-3.5 py-1.5">
            <Sparkles className="h-3 w-3 text-[var(--accent-strong)]" />
            <span className="text-[11px] font-semibold tracking-wide text-[var(--accent-strong)]">
              S2 Studio — All-in-one Roblox audio suite
            </span>
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            Convert. <span className="gradient-text">Tune.</span> Upload.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[var(--text-50)] sm:text-base">
            Konversi audio dari YouTube, SoundCloud, atau file lokal, tune ke pengaturan Roblox
            yang optimal, lalu batch upload — semua dari satu workspace.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onEnter}
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-b from-[var(--accent-strong)] to-[var(--accent-deep)] px-7 py-4 text-sm font-semibold text-[var(--on-accent)] shadow-lg shadow-[var(--accent-15)] transition-all duration-150 hover:brightness-110 active:scale-[0.98] sm:w-auto"
            >
              Masuk ke Studio
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
            <p className="text-[11px] text-[var(--text-40)]">
              Akses dikunci PIN · cepat &amp; aman
            </p>
          </div>
        </motion.section>

        {/* Fitur */}
        <motion.section variants={item} className="mb-16">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent-30)] hover:shadow-lg"
                >
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 hero-gradient" />
                  <div className="relative">
                    <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-[var(--on-accent)] shadow-md shadow-[var(--accent-20)] transition-transform duration-200 group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-sm font-bold tracking-tight">{feature.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-50)]">{feature.desc}</p>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-soft)]">
                      {feature.tag}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Cara kerja */}
        <motion.section variants={item}>
          <div className="mx-auto max-w-3xl">
            <p className="mb-6 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-40)]">
              Bagaimana cara kerjanya
            </p>
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="relative flex flex-1 flex-col items-center px-2 text-center">
                    {index < STEPS.length - 1 && (
                      <div className="pointer-events-none absolute left-1/2 top-5 hidden h-px w-full bg-gradient-to-r from-[var(--accent-20)] to-[var(--accent-20)] sm:block" />
                    )}
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--accent-25)] bg-[var(--panel)] text-[var(--accent-strong)] shadow-sm">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <p className="mt-3 text-xs font-bold">{step.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-45)]">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>
      </motion.main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--line)] py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-40)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" />
            <span>S2 Studio</span>
          </div>
          <p className="text-[11px] text-[var(--text-35)]">Built by fhrlsym</p>
        </div>
      </footer>
    </div>
  );
}
