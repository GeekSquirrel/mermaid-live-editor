/**
 * sha256 hex digest of a string, used as the freshness key when uploading
 * preview SVGs. Returns '' when the Web Crypto API (secure context) is
 * unavailable — callers treat '' as "cannot verify" and skip uploading.
 */
export async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return '';
  }
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
