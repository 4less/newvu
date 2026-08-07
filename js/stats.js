import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { drawPlotPanel } from './plotPanel.js';

/* ══════════════════════════════════════════════════════════════════════════
   SELECTION STATS  (operates on a specific treeState instance)
══════════════════════════════════════════════════════════════════════════ */
export function updateStats(treeState) {
  state.activeTree = treeState;   // track which tree drove the last interaction

  const info  = d3.select('#info');
  const nodes = (treeState._leaves || []).filter(l => treeState.selectedNames.has(l.data.name));

  if (nodes.length === 0) {
    info.html('No tips selected &nbsp;·&nbsp; click a tip, click an edge, or drag a rectangle to select.');
    drawPlotPanel();
    return;
  }
  if (nodes.length === 1) {
    info.html(`<strong>1 tip selected:</strong> ${nodes[0].data.name} &nbsp;·&nbsp; select at least one more to see distances.`);
    drawPlotPanel();
    return;
  }

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
  drawPlotPanel();

  // Sync tree 2 selection whenever tree 1's selection changes (one-way).
  if (treeState === state.primaryTree && typeof state.onPrimarySelectionChange === 'function') {
    state.onPrimarySelectionChange();
  }
}

export function clearSelection(treeState) {
  treeState.selectedNames.clear();
  if (treeState._tipG) treeState._tipG.classed('selected', false);
  updateStats(treeState);
}
