'use client';

import { PinGate } from '../components/layout/pin-gate';
import { useUIStore } from '../lib/stores/uiStore';

export default function HomePage() {
  const unlocked = useUIStore((s) => s.unlocked);
  return unlocked ? null : <PinGate />;
}