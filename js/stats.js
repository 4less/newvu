import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { drawBoxplot } from './boxplot.js';

/* ══════════════════════════════════════════════════════════════════════════
   SELECTION STATS
══════════════════════════════════════════════════════════════════════════ */
export function updateStats() {
  const info  = d3.select('#info');
  const nodes = (state._leaves || []).filter(l => state.selectedNames.has(l.data.name));

  if (nodes.length === 0) {
    info.html('No tips selected &nbsp;·&nbsp; click a tip, click an edge, or drag a rectangle to select.');
    drawBoxplot();
    return;
  }
  if (nodes.length === 1) {
    info.html(`<strong>1 tip selected:</strong> ${nodes[0].data.name} &nbsp;·&nbsp; select at least one more to see distances.`);
    drawBoxplot();
    return;
  }

  // All pairwise tree distances using native node.ancestors() to find LCA
  const dists = [];
  for (let i = 0; i < nodes.length; i++) {
    const aAncs = new Set(nodes[i].ancestors());
    for (let j = i + 1; j < nodes.length; j++) {
      const lca = nodes[j].ancestors().find(n => aAncs.has(n));
      dists.push(nodes[i].dist + nodes[j].dist - 2 * lca.dist);
    }
  }

  const fmt = d3.format('.4g');
  info.html(
    `<strong>${nodes.length} tips</strong> &nbsp;·&nbsp; ${dists.length} pairs &nbsp;·&nbsp; ` +
    `min <strong>${fmt(d3.min(dists))}</strong> &nbsp;·&nbsp; ` +
    `max <strong>${fmt(d3.max(dists))}</strong> &nbsp;·&nbsp; ` +
    `median <strong>${fmt(d3.median(dists))}</strong> &nbsp;·&nbsp; ` +
    `mean <strong>${fmt(d3.mean(dists))}</strong>`
  );
  drawBoxplot();
}

export function clearSelection() {
  state.selectedNames.clear();
  if (state._tipG) state._tipG.classed('selected', false);
  updateStats();
}
