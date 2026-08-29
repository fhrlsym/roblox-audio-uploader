interface S2LogoProps {
  className?: string;
}

export default function S2Logo({ className = 'h-6 w-6' }: S2LogoProps) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Tiles sebagai gelombang suara — pakai currentColor supaya ikut text color parent */}
      <g fill="currentColor">
        <rect x="4" y="13.5" width="3.4" height="9" rx="1.7" />
        <rect x="9.6" y="10" width="3.4" height="16" rx="1.7" />
        <rect x="15.2" y="6.5" width="3.4" height="23" rx="1.7" />
        <rect x="20.8" y="9.5" width="3.4" height="17" rx="1.7" />
        <rect x="26.4" y="13.5" width="3.4" height="9" rx="1.7" />
      </g>
    </svg>
  );
}
