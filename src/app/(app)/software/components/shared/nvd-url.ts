/**
 * Where a CVE is read in full when the backend hands no link of its own: NVD is
 * the canonical record every CVE id resolves against.
 */
export function nvdUrl(cveId: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`;
}

/** Opens the CVE's NVD record in a new tab. */
export function openNvd(cveId: string): void {
  window.open(nvdUrl(cveId), '_blank', 'noopener,noreferrer');
}
