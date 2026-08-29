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
    span: 'lg:col-span-2',
  },
  {
    id: 'spoofer',
    title: 'Asset Spoofer',
    desc: 'Clone aset Roblox dengan cepat — thumbnail, judul, dan metadata ikut terbawa.',
    icon: Copy,
    tag: 'Clone Assets',
    span: 'lg:col-span-2',
  },
  {
    id: 'dumper',
    title: 'Script Dumper',
    desc: 'Inspect & dump script dari game untuk dianalisis, langsung dari workspace.',
    icon: FileCode,
    tag: 'Inspect Scripts',
    span: 'lg:col-span-2',
  },
  {
    id: 'obfuscator',
    title: 'Obfuscator',
    desc: 'Lindungi script buatanmu dengan obfuscation sekali klik sebelum di-upload.',
    icon: Lock,
    tag: 'Protect Scripts',
    span: 'lg:col-span-2',
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
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.23, 1, 0.32, 1] as const } },
};

export default function LandingSection({ onEnter }: LandingSectionProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Nav mini */}
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="brutal-box flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
            <S2Logo className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-tight leading-none">S2 Studio</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-40)]">Roblox Creator Suite</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEnter}
          className="brutal-btn-flat"
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
        <motion.section variants={item} className="pt-12 pb-12 sm:pt-20 sm:pb-16">
          <div className="brutal-tag mb-6 inline-flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            <span>All-in-one Roblox Creator Suite</span>
          </div>

          <h1 className="text-5xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-7xl">
            Studio untuk<br />
            <span className="brutal-highlight">Roblox Creator</span>
          </h1>
          <p className="mt-6 max-w-lg text-sm font-medium leading-relaxed text-[var(--text-60)] sm:text-base">
            Satu workspace untuk convert & tune audio, clone aset, dump script, dan obfuscate —
            semua tool yang kamu butuh sebagai Roblox creator.
          </p>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onEnter}
              className="brutal-btn-primary group"
            >
              Masuk ke Studio
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-40)]">
              Akses dikunci PIN · cepat &amp; aman
            </p>
          </div>
        </motion.section>

        {/* Bento grid fitur */}
        <motion.section variants={item} className="mb-16">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className={`brutal-card group flex flex-col ${feature.span}`}
                >
                  <span className="brutal-icon-box mb-4 bg-[var(--accent)] text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-extrabold uppercase tracking-tight text-base">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-xs font-medium leading-relaxed text-[var(--text-60)]">
                    {feature.desc}
                  </p>
                  <p className="mt-auto pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                    {feature.tag}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Cara kerja */}
        <motion.section variants={item}>
          <div className="mx-auto max-w-3xl">
            <p className="mb-6 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-40)]">
              Bagaimana cara kerjanya
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="brutal-card-sm flex flex-col items-center p-4 text-center">
                    <span className="brutal-icon-box mb-3 bg-[var(--accent)] text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="text-xs font-extrabold uppercase">{step.label}</p>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-[var(--text-50)]">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>
      </motion.main>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-[var(--text)] py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-[var(--text-60)]">
            <span className="h-2.5 w-2.5 border-2 border-[var(--text)] bg-[var(--emerald)]" />
            <span>S2 Studio</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-40)]">Built by fhrlsym</p>
        </div>
      </footer>
    </div>
  );
}
