'use client';

import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useState } from 'react';

interface DeviceRelativeTimeSubtitleProps {
  lastUpdated: string | number | Date;
}

// Isolated so the per-second tick only re-renders this small subtitle instead of
// the whole DeviceDetailsView tree (tables/tabs included). Paused while the tab
// is hidden since the desktop shell keeps pages open for days.
export function DeviceRelativeTimeSubtitle({ lastUpdated }: DeviceRelativeTimeSubtitleProps) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (interval) return;
      interval = setInterval(() => {
        forceUpdate({});
      }, 1000);
    };

    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        startInterval();
      }
    };

    if (!document.hidden) {
      startInterval();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopInterval();
    };
  }, []);

  return <>{`Updated ${formatRelativeTime(lastUpdated)}`}</>;
}
