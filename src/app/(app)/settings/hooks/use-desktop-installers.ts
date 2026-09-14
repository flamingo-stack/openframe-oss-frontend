'use client';

import { useQuery } from '@tanstack/react-query';

const DESKTOP_REPO = 'flamingo-stack/openframe-saas-desktop';

/**
 * Human-facing release list. Also the fallback target for a download button whose
 * installer could not be resolved (request failed, rate limit, renamed asset) — a
 * page the user can finish the job from beats a dead button.
 */
export const DESKTOP_RELEASES_URL = `https://github.com/${DESKTOP_REPO}/releases/latest`;

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  assets: GitHubReleaseAsset[];
}

export interface DesktopInstallers {
  windowsX64: string | null;
  windowsArm64: string | null;
  macos: string | null;
}

function findAssetUrl(assets: GitHubReleaseAsset[], pattern: RegExp): string | null {
  return assets.find(asset => pattern.test(asset.name))?.browser_download_url ?? null;
}

/**
 * Tauri stamps the version into every bundle name
 * (`OpenFrame-Console_0.0.10_x64-setup.exe`), so GitHub's stable
 * `/releases/latest/download/<asset>` shortcut cannot address them — the file names
 * only exist once the release itself has been resolved through the API.
 */
function selectInstallers(release: GitHubRelease): DesktopInstallers {
  // The `.sig` siblings are Tauri updater signatures, never a user download.
  const assets = release.assets.filter(asset => !asset.name.endsWith('.sig'));
  return {
    // Windows ships one installer per architecture with no universal bundle, and a
    // browser cannot read the client's CPU architecture — so both are resolved and
    // the user picks. macOS needs no such choice: its .dmg is already universal.
    windowsX64: findAssetUrl(assets, /x64.*\.exe$/i),
    windowsArm64: findAssetUrl(assets, /arm64.*\.exe$/i),
    // Matched on `universal` rather than any `.dmg`: if the desktop repo ever drops
    // its universal-apple-darwin leg and emits per-arch dmgs, this resolves to null
    // and falls back to the releases page instead of silently handing every Mac
    // whichever architecture GitHub happened to list first.
    macos: findAssetUrl(assets, /universal.*\.dmg$/i),
  };
}

async function fetchDesktopInstallers(signal: AbortSignal): Promise<DesktopInstallers> {
  const response = await fetch(`https://api.github.com/repos/${DESKTOP_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Failed to load the latest desktop release (${response.status})`);
  }
  return selectInstallers(await response.json());
}

/**
 * Resolves the current desktop installers straight from GitHub. The repository is
 * public, so this deliberately does not go through `apiClient`/the gateway.
 *
 * Unauthenticated GitHub API calls are capped at 60/hour per IP, which a shared
 * office egress can burn through — hence the hour-long `staleTime`, a `gcTime` that
 * matches it so leaving and returning to the page reuses the answer instead of
 * refetching, and no retry: the failure this budget produces is a 403, which a
 * second immediate request cannot fix and would only bill twice.
 */
export function useDesktopInstallers() {
  const oneHour = 60 * 60 * 1000;
  return useQuery({
    queryKey: ['desktop-installers'],
    queryFn: ({ signal }) => fetchDesktopInstallers(signal),
    staleTime: oneHour,
    gcTime: oneHour,
    retry: false,
  });
}
