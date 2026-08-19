import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-6 w-6' };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return <Loader2 className={`animate-spin ${SIZES[size]} ${className}`} />;
}

export function ButtonSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
