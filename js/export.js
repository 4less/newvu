import { zip, strToU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';
import { state } from './state.js';

/**
 * Export the SVG tree inside a given container as a standalone SVG file.
 * Embeds critical styles so the file renders correctly outside the app.
 */
export function exportSvg(containerId, filename) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  const clone = svgEl.cloneNode(true);

  // Hide interaction-only layers
  clone.querySelectorAll('.brush, .link-hit').forEach(el => el.setAttribute('display', 'none'));

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    .link { fill: none; stroke: #cbd5e1; stroke-width: 0.9px; }
    .link-hit { display: none; }
    .tip-label {
      font-size: ${state.tipFontSize}px;
      dominant-baseline: middle;
      font-family: 'JetBrains Mono', 'Fira Mono', monospace;
    }
    .tip.selected path { stroke: #0f172a; stroke-width: 1.5px; }
    .inode { fill: #cbd5e1; }
    .scalebar line { stroke: #64748b; stroke-width: 1.5px; stroke-linecap: round; }
    .scalebar text {
      font-size: 10px; fill: #64748b; text-anchor: middle;
      font-family: 'JetBrains Mono', 'Fira Mono', monospace;
    }
  `;
  clone.insertBefore(style, clone.firstChild);

  // White background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', clone.getAttribute('width'));
  bg.setAttribute('height', clone.getAttribute('height'));
  bg.setAttribute('fill', 'white');
  clone.insertBefore(bg, style.nextSibling);

  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download the loaded tree(s) and metadata as a ZIP archive.
 * If a second tree is loaded it is included alongside the first.
 */
export function exportZip(tree1State, tree2State) {
  if (!tree1State?.originalNewick) return;

  const safe = str =>
    str.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'export';

  const title1 = document.getElementById('title')?.textContent?.trim() ?? 'tree1';
  const name1  = safe(title1);

  const files = { [`${name1}.nwk`]: strToU8(tree1State.originalNewick) };

  if (state.rawMeta) {
    const ext = state.rawMeta.includes('\t') ? 'tsv' : 'csv';
    files[`metadata.${ext}`] = strToU8(state.rawMeta);
  }

  if (tree2State?.originalNewick) {
    const title2 = document.getElementById('title2')?.textContent?.trim() ?? 'tree2';
    files[`${safe(title2)}.nwk`] = strToU8(tree2State.originalNewick);
  }

  zip(files, (err, data) => {
    if (err) { console.error('[export] ZIP failed', err); return; }
    const url = URL.createObjectURL(new Blob([data], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name1}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
