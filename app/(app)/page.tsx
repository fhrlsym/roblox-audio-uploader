'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Copy, FileCode, Shield, Upload, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SkeletonCard } from '../../components/ui/skeleton';
import { useUploadHistory } from '../../lib/queries/useUploadHistory';
import Link from 'next/link';

const tools = [
  { id: 'audio-master' as const, href: '/audio-master', label: 'Audio Master', desc: 'Upload, tune & publish audio to Roblox', icon: Music, color: 'from-[var(--accent)] to-[var(--accent-strong)]' },
  { id: 'spoofer' as const, href: '/spoofer', label: 'Asset Spoofer', desc: 'Clone Roblox assets to your account', icon: Copy, color: 'from-[#8b7cf7] to-[#6a58d6]' },
  { id: 'dumper' as const, href: '/dumper', label: 'Script Dumper', desc: 'Deobfuscate Luau scripts with ease', icon: FileCode, color: 'from-[#34d399] to-[#10b981]' },
  { id: 'obfuscator' as const, href: '/obfuscator', label: 'Obfuscator', desc: 'Protect your scripts from theft', icon: Shield, color: 'from-[#f87171] to-[#ef4444]' },
];

const statusIcons: Record<string, typeof CheckCircle2> = {
  Active: CheckCircle2,
  Pending: Clock,
  Failed: AlertCircle,
  Copyright: AlertCircle,
};

const statusColors: Record<string, string> = {
  Active: 'text-emerald-400',
  Pending: 'text-[var(--accent-strong)]',
  Failed: 'text-rose-400',
  Copyright: 'text-rose-400',
};

export default function DashboardPage() {
  const [webVersion, setWebVersion] = useState('');
  const { data: history, isLoading } = useUploadHistory(true);

  useEffect(() => {
    fetch('/api/version')
      .then((r) => r.json())
      .then((d) => setWebVersion(d.version || ''))
      .catch(() => {});
  }, []);

  const stats = history
    ? {
        total: history.length,
        active: history.filter((h) => h.status === 'Active').length,
        pending: history.filter((h) => h.status === 'Pending').length,
        failed: history.filter((h) => h.status === 'Failed' || h.status === 'Copyright').length,
      }
    : null;

  const recentHistory = history?.slice(0, 5) || [];

  return (
    <div className="space-y-6 stagger-enter">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="hero-gradient rounded-3xl p-6 sm:p-8 -mx-3 sm:-mx-4 mb-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center shadow-lg">
              <Music size={20} className="text-[var(--on-accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text)]">S2 Studio</h1>
              <p className="text-xs text-[var(--text-50)]">Audio Master to Roblox {webVersion ? `· ${webVersion}` : ''}</p>
            </div>
          </div>
          <p className="text-sm text-[var(--text-60)] max-w-xl">
            Upload audio from YouTube, SoundCloud, or your files — tune, amplify, and publish to Roblox in one seamless pipeline.
          </p>
        </div>
      </motion.div>

      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            { label: 'Total Uploads', value: stats.total, icon: Upload, color: 'text-[var(--accent-strong)]' },
            { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-[var(--accent-strong)]' },
            { label: 'Failed', value: stats.failed, icon: AlertCircle, color: 'text-rose-400' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div className="text-2xl font-bold text-[var(--text)]">{stat.value}</div>
                <div className="text-[11px] text-[var(--text-45)] mt-0.5">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <h2 className="text-sm font-semibold text-[var(--text-60)] mb-3">Quick Start</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.id} href={tool.href}>
                <Card hover className="h-full">
                  <CardContent className="p-4 flex flex-col h-full">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-3`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--text)]">{tool.label}</h3>
                    <p className="text-[11px] text-[var(--text-45)] mt-1 flex-1">{tool.desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-[10px] font-medium text-[var(--accent-strong)]">
                      <span>Open</span>
                      <ArrowRight size={12} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-60)]">Recent Uploads</h2>
          {history && history.length > 5 && (
            <Link href="/audio-master" className="text-[10px] font-medium text-[var(--accent-strong)] hover:underline">
              View all
            </Link>
          )}
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : recentHistory.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Upload size={24} className="mx-auto mb-3 text-[var(--text-30)]" />
              <p className="text-sm text-[var(--text-50)]">No uploads yet</p>
              <p className="text-xs text-[var(--text-35)] mt-1">Start by uploading audio from the Audio Master tool</p>
              <Link href="/audio-master">
                <Button variant="secondary" size="sm" className="mt-4">
                  <Music size={14} />
                  Go to Audio Master
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentHistory.map((item) => {
              const StatusIcon = statusIcons[item.status] || Clock;
              return (
                <Card key={item.id}>
                  <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                    <StatusIcon size={16} className={`shrink-0 ${statusColors[item.status] || 'text-[var(--text-40)]'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text)] truncate">{item.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-45)]">
                        <span>{item.robloxPlaybackSpeed.toFixed(2)}x speed</span>
                        {item.accountName && <><span>·</span><span>{item.accountName}</span></>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-medium text-[var(--text-45)]">{item.assetId.slice(0, 8)}...</div>
                      <div className="text-[10px] text-[var(--text-35)]">
                        {new Date(item.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}