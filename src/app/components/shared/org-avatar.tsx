'use client';

import { useAuthedImageSrc } from '@flamingo-stack/openframe-frontend-core/hooks';
import Image from 'next/image';
import { useState } from 'react';
import { getFullImageUrl } from '@/lib/image-url';

interface OrgAvatarProps {
  imageUrl?: string | null;
  hash?: string | null;
  name: string;
}

export function OrgAvatar({ imageUrl, hash, name }: OrgAvatarProps) {
  const initials = name.substring(0, 2).toUpperCase() || '??';
  // In bearer-mode native shells the hook swaps the gateway URL for an
  // authed blob URL (plain <img> loads can't carry Authorization);
  // elsewhere it passes the URL through untouched.
  const fullUrl = useAuthedImageSrc(getFullImageUrl(imageUrl, hash));
  const [failedUrl, setFailedUrl] = useState<string | undefined>(undefined);

  const showImage = Boolean(fullUrl) && failedUrl !== fullUrl;

  return (
    <div className="relative flex size-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-ods-border bg-ods-bg">
      {!showImage && <span className="text-[10px] font-medium text-ods-text-secondary">{initials}</span>}
      {showImage && fullUrl && (
        <Image
          src={fullUrl}
          alt={initials}
          width={20}
          height={20}
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailedUrl(fullUrl)}
        />
      )}
    </div>
  );
}
