import LZString from 'https://esm.sh/lz-string@1.5.0';
import { state } from './state.js';

const BASE_URL = 'https://4less.github.io/newvu/';

/**
 * Encode current state into a compressed, URL-safe share link.
 * Optionally includes a second tree if one is loaded.
 */
export function buildShareUrl(tree1State, tree2State) {
  const payload = {
    nwk:   tree1State.originalNewick,
    meta:  state.rawMeta  || null,
    color: state.currentColorCol || null,
    label: state.currentLabelCol || null,
    title: document.getElementById('title')?.textContent ?? '',
  };
  if (tree2State?.originalNewick) {
    payload.nwk2   = tree2State.originalNewick;
    payload.title2 = document.getElementById('title2')?.textContent ?? '';
  }
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  return `${BASE_URL}?d=${compressed}`;
}

/**
 * If the page URL contains `?d=`, decompress and return the payload.
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
