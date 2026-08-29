import { useId } from 'react';

interface S2LogoProps {
  className?: string;
}

export default function S2Logo({ className = 'h-6 w-6' }: S2LogoProps) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="4" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Tiles sebagai gelombang suara */}
      <g fill={`url(#${id})`}>
        <rect x="4" y="13.5" width="3.4" height="9" rx="1.7" />
        <rect x="9.6" y="10" width="3.4" height="16" rx="1.7" />
        <rect x="15.2" y="6.5" width="3.4" height="23" rx="1.7" />
        <rect x="20.8" y="9.5" width="3.4" height="17" rx="1.7" />
        <rect x="26.4" y="13.5" width="3.4" height="9" rx="1.7" />
      </g>
    </svg>
  );
}
