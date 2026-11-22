'use client';

import { useEffect } from 'react';
import { preloadRecaptcha } from '@/lib/recaptcha';

export function RecaptchaPreload() {
  useEffect(() => {
    preloadRecaptcha();
  }, []);

  return null;
}
