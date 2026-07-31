import React from 'react';
import { cn } from '@/lib/utils';

interface GoogleIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  fill?: boolean;
  weight?: number; // 100 to 700
  grade?: number; // -25 to 200
  size?: number; // size in px
  variant?: 'outlined' | 'rounded';
}

export function GoogleIcon({
  name,
  fill = false,
  weight = 400,
  grade = 0,
  size = 24,
  variant = 'rounded',
  className,
  style,
  ...props
}: GoogleIconProps) {
  const fontClass = variant === 'rounded' ? 'material-symbols-rounded' : 'material-symbols-outlined';

  return (
    <span
      className={cn(fontClass, 'inline-block select-none align-middle leading-none', className)}
      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${size}`,
        fontSize: `${size}px`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
