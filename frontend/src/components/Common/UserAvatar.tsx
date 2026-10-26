import React, { useState } from 'react';

export interface UserAvatarProps {
  name?: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses: Record<NonNullable<UserAvatarProps['size']>, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]' },
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-12 h-12', text: 'text-base' },
  xl: { container: 'w-16 h-16', text: 'text-lg' }
};

export const getInitials = (name?: string): string => {
  if (!name) return 'U';
  const clean = name.trim();
  if (!clean) return 'U';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const resolveImageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const cleanUrl = url.trim();
  if (!cleanUrl) return null;
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }
  const cleanPath = cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  return `http://localhost:5000${cleanPath}`;
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = '',
  src,
  size = 'md',
  className = ''
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = resolveImageUrl(src);
  const initials = getInitials(name);
  const config = sizeClasses[size] || sizeClasses.md;

  if (resolvedSrc && !hasError) {
    return (
      <div
        className={`${config.container} rounded-full overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100 ${className}`}
      >
        <img
          src={resolvedSrc}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover rounded-full"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${config.container} rounded-full bg-blue-600 text-white font-semibold flex items-center justify-center shrink-0 shadow-2xs select-none ${config.text} ${className}`}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
