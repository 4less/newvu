import LZString from 'https://esm.sh/lz-string@1.5.0';
import { state } from './state.js';

const BASE_URL = 'https://4less.github.io/newvu/';

/**
 * Encode current tree + metadata into a compressed, URL-safe share link.
 */
export function buildShareUrl() {
  const payload = {
    nwk:   state.originalNewick,
    meta:  state.rawMeta  || null,
    color: state.currentColorCol || null,
    label: state.currentLabelCol || null,
    title: document.getElementById('title').textContent,
  };
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  return `${BASE_URL}?d=${compressed}`;
}

/**
 * If the page URL contains a `?d=` parameter, decompress and return the payload.
 * Returns null if absent or malformed.
 */
export function loadFromUrl() {
  const d = new URLSearchParams(window.location.search).get('d');
  if (!d) return null;
  try {
    return JSON.parse(LZString.decompressFromEncodedURIComponent(d));
  } catch {
    console.warn('[share] Failed to decode URL payload');
    return null;
  }
}
