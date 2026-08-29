import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  as?: 'div' | 'section';
  hover?: boolean;
}

export function Card({ children, as = 'div', hover = false, className = '', ...props }: CardProps) {
  const Tag = as;
  const hoverCls = hover
    ? 'transition duration-150 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_0_var(--text)]'
    : '';
  return (
    <Tag
      className={`brutal-card ${hoverCls} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
