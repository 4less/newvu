import { zip, strToU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';
import { state } from './state.js';

/**
 * Download the currently loaded tree and metadata as a ZIP archive.
 */
export function exportZip() {
  if (!state.originalNewick) return;

  const title = document.getElementById('title').textContent.trim();
  const safeName = title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'export';

  const files = {
    [`${safeName}.nwk`]: strToU8(state.originalNewick),
  };
  if (state.rawMeta) {
    const ext = state.rawMeta.includes('\t') ? 'tsv' : 'csv';
    files[`${safeName}_metadata.${ext}`] = strToU8(state.rawMeta);
  }

  zip(files, (err, data) => {
    if (err) { console.error('[export] ZIP failed', err); return; }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
