import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';

/* ══════════════════════════════════════════════════════════════════════════
   PLOT PANEL  (sidebar — renders whichever plot #plot-select is set to)
   '__pairwise_comparison__' → scatter; anything else → box plot.
══════════════════════════════════════════════════════════════════════════ */
/* The panel always reflects the primary (left) tree — state.primaryTree. */
export function drawPlotPanel() {
  const treeState = state.primaryTree;
  const panel     = document.getElementById('left-panel');
  const container = d3.select('#plot-canvas');
  container.selectAll('*').remove();

  if (panel.offsetWidth < 20) return;

  if (!state.plotCol) {
    container.append('div').attr('class', 'plot-placeholder').text('Choose a variable above to plot.');
    return;
  }

  // Pairwise comparison uses ALL (filtered) tips — no selection required.
  if (state.plotCol === '__pairwise_comparison__') {
    drawPairwiseScatter(container, treeState, panel);
    return;
  }

  // Effective leaf set: if filter active use passing tips, else use selection.
  const fln = treeState.filteredLeafNames;
  const hasFilter = fln !== null;
  const hasSelection = treeState.selectedNames.size > 0;

  if (!hasFilter && !hasSelection) {
    container.append('div').attr('class', 'plot-placeholder').text('Select tips in the tree to see the distribution.');
    return;
  }

  // When filter is active, show all passing tips; otherwise show selected.
  const effectiveLeaves = hasFilter
    ? (treeState._leaves || []).filter(l => fln.has(l.data.name))
    : (treeState._leaves || []).filter(l => treeState.selectedNames.has(l.data.name));

  const isCat = state.colorScale && typeof state.colorScale.domain()[0] === 'string' && state.currentColorCol;
  let pts = [];
  let yLabel = state.plotCol;

  if (state.plotCol === '__pairwise__') {
    yLabel = 'Cophenetic distance';
    const selLeaves = effectiveLeaves;
    if (selLeaves.length < 2) {
      container.append('div').attr('class', 'plot-placeholder').text('Select at least 2 tips to compute pairwise distances.');
      return;
    }
    for (let i = 0; i < selLeaves.length; i++) {
      const aAncs = new Set(selLeaves[i].ancestors());
      for (let j = i + 1; j < selLeaves.length; j++) {
        const lca = selLeaves[j].ancestors().find(n => aAncs.has(n));
        const val = selLeaves[i].dist + selLeaves[j].dist - 2 * lca.dist;
        let cat = 'All';
        if (isCat && state.currentMeta) {
          const catI = state.currentMeta.get(selLeaves[i].data.name)?.[state.currentColorCol] || '?';
          const catJ = state.currentMeta.get(selLeaves[j].data.name)?.[state.currentColorCol] || '?';
          if (catI !== catJ) continue;
          cat = catI;
        }
        pts.push({ val, cat });
      }
    }
  } else {
    if (!state.currentMeta) {
      container.append('div').attr('class', 'plot-placeholder').text('Load metadata to plot this variable.');
      return;
    }
    pts = effectiveLeaves.flatMap(leaf => {
      const name = leaf.data.name;
      const row  = state.currentMeta.get(name);
      if (!row) return [];
      const val = +row[state.plotCol];
      if (isNaN(val)) return [];
      return [{ val, cat: isCat ? (row[state.currentColorCol] || '?') : 'All' }];
    });
  }

  if (!pts.length) {
    container.append('div').attr('class', 'plot-placeholder').text('No data for selected tips.');
    return;
  }

  const groups = d3.groups(pts, d => d.cat).map(([cat, items]) => {
    const vals   = items.map(d => d.val).sort(d3.ascending);
    const q1     = d3.quantile(vals, 0.25);
    const q3     = d3.quantile(vals, 0.75);
    const median = d3.quantile(vals, 0.5);
    const iqr    = q3 - q1;
    const wLo    = Math.max(d3.min(vals), q1 - 1.5 * iqr);
    const wHi    = Math.min(d3.max(vals), q3 + 1.5 * iqr);
    const color  = isCat && cat !== '(between)' ? state.colorScale(cat)
                 : isCat ? '#aaa'
                 : '#4648d4';
    return { cat, n: vals.length, q1, q3, median, wLo, wHi,
             outliers: vals.filter(v => v < wLo || v > wHi), color };
  });

  const margin = { top: 20, right: 16, bottom: groups.length > 1 ? 72 : 36, left: 54 };
  const W = Math.max(panel.offsetWidth - margin.left - margin.right, 20);
  const H = Math.max(panel.offsetHeight - margin.top - margin.bottom - 38, 40);

  const svg = container.append('svg')
    .attr('width',  W + margin.left + margin.right)
    .attr('height', H + margin.top + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const xSc = d3.scaleBand().domain(groups.map(g => g.cat)).range([0, W]).padding(0.35);
  const allV = pts.map(d => d.val);
  const [vLo, vHi] = d3.extent(allV);
  const pad = (vHi - vLo) * 0.06 || 1;
  const ySc = d3.scaleLinear().domain([vLo - pad, vHi + pad]).nice().range([H, 0]);

  svg.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xSc))
    .selectAll('text')
      .attr('transform', 'rotate(-30)')
      .style('text-anchor', 'end')
      .attr('dy', '0.8em');
  svg.append('g').call(d3.axisLeft(ySc).ticks(5).tickSizeOuter(0));

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2).attr('y', -margin.left + 13)
    .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#555')
    .text(yLabel);

  groups.forEach(g => {
    const bx = xSc(g.cat), bw = xSc.bandwidth(), cx = bx + bw / 2;
    const c = g.color, capW = bw * 0.3;

    svg.append('line').attr('x1', cx).attr('x2', cx)
      .attr('y1', ySc(g.wLo)).attr('y2', ySc(g.q1)).attr('stroke', c).attr('stroke-width', 1.5);
    svg.append('line').attr('x1', cx).attr('x2', cx)
      .attr('y1', ySc(g.q3)).attr('y2', ySc(g.wHi)).attr('stroke', c).attr('stroke-width', 1.5);
    [[g.wLo], [g.wHi]].forEach(([v]) =>
      svg.append('line').attr('x1', cx - capW / 2).attr('x2', cx + capW / 2)
        .attr('y1', ySc(v)).attr('y2', ySc(v)).attr('stroke', c).attr('stroke-width', 1.5)
    );
    svg.append('rect').attr('x', bx).attr('y', ySc(g.q3))
      .attr('width', bw).attr('height', Math.max(0, ySc(g.q1) - ySc(g.q3)))
      .attr('fill', c).attr('fill-opacity', 0.22).attr('stroke', c).attr('stroke-width', 1.5);
    svg.append('line').attr('x1', bx).attr('x2', bx + bw)
      .attr('y1', ySc(g.median)).attr('y2', ySc(g.median))
      .attr('stroke', c).attr('stroke-width', 2.5);
    g.outliers.forEach(v =>
      svg.append('circle').attr('cx', cx).attr('cy', ySc(v)).attr('r', 2.5)
        .attr('fill', 'none').attr('stroke', c).attr('stroke-width', 1)
    );
    svg.append('text').attr('x', cx).attr('y', ySc(g.wHi) - 5)
      .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#999')
      .text(`n=${g.n}`);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   PAIRWISE DISTANCE SCATTER PLOT  (prediction vs reference)
   — Matched via metadata colour column (sample → genome).
   — Intra-genome pairs always get reference distance = 0.
══════════════════════════════════════════════════════════════════════════ */
function drawPairwiseScatter(container, treeState, panel) {
  const tree2 = state.secondaryTree;

  if (!tree2 || !tree2._leaves || tree2._leaves.length === 0) {
    container.append('div').attr('class', 'plot-placeholder')
      .text('Load a comparison tree to enable this plot.');
    return;
  }
  if (!state.currentColorCol || !state.currentMeta) {
    container.append('div').attr('class', 'plot-placeholder')
      .text('Select a colour column to match samples to genomes.');
    return;
  }

  // Use all tips that pass the current filter — no selection required.
  const treeLeaves = treeState?._leaves || [];
  if (treeLeaves.length < 2) {
    container.append('div').attr('class', 'plot-placeholder')
      .text('Load a prediction tree first.');
    return;
  }

  const fln       = treeState.filteredLeafNames; // Set<name> | null
  const allLeaves = fln ? treeLeaves.filter(l => fln.has(l.data.name)) : treeLeaves;
  if (allLeaves.length < 2) {
    container.append('div').attr('class', 'plot-placeholder')
      .text('Fewer than 2 tips pass the current filter.');
    return;
  }

  // genome → tree2 leaf node (pre-cached ancestors for LCA), filter-aware
  const fln2  = tree2.filteredLeafNames; // Set<name> | null
  const t2map = new Map();
  for (const leaf of tree2._leaves) {
    if (fln2 && !fln2.has(leaf.data.name)) continue;
    t2map.set(leaf.data.name.trim(), leaf);
  }

  // Pre-cache tree2 ancestors per leaf for O(depth) LCA lookups
  const t2ancs = new Map();
  for (const [name, leaf] of t2map) t2ancs.set(name, new Set(leaf.ancestors()));

  const getGenome = name => state.currentMeta.get(name.trim())?.[state.currentColorCol]?.trim() ?? null;

  // Pre-cache tree1 ancestor sets so inner loop is O(depth) not O(depth²)
  const t1ancs = allLeaves.map(l => new Set(l.ancestors()));

  // Pre-cache tree2 distances between genome pairs (memoised)
  const t2distCache = new Map();
  function t2dist(g1, g2) {
    const key = g1 < g2 ? `${g1}\0${g2}` : `${g2}\0${g1}`;
    if (t2distCache.has(key)) return t2distCache.get(key);
    const l1 = t2map.get(g1), l2 = t2map.get(g2);
    if (!l1 || !l2) { t2distCache.set(key, null); return null; }
    const lca = l2.ancestors().find(n => t2ancs.get(g1).has(n));
    if (!lca) { t2distCache.set(key, null); return null; }
    const d = l1.dist + l2.dist - 2 * lca.dist;
    t2distCache.set(key, d);
    return d;
  }

  const pts = [];
  for (let i = 0; i < allLeaves.length; i++) {
    const g1 = getGenome(allLeaves[i].data.name);
    for (let j = i + 1; j < allLeaves.length; j++) {
      const g2 = getGenome(allLeaves[j].data.name);
      if (!g1 || !g2) continue;

      const lca1 = allLeaves[j].ancestors().find(n => t1ancs[i].has(n));
      if (!lca1) continue;
      const xDist = allLeaves[i].dist + allLeaves[j].dist - 2 * lca1.dist;

      let yDist;
      if (g1 === g2) {
        yDist = 0;
      } else {
        yDist = t2dist(g1, g2);
        if (yDist === null) continue;
      }
      pts.push({ x: xDist, y: yDist, same: g1 === g2 });
    }
  }

  if (!pts.length) {
    container.append('div').attr('class', 'plot-placeholder')
      .text(fln ? 'No matching genome pairs among the filtered tips.'
                : 'No matching genome pairs found between the two trees.');
    return;
  }

  // Pearson r
  const n     = pts.length;
  const xMean = d3.mean(pts, d => d.x);
  const yMean = d3.mean(pts, d => d.y);
  const num   = d3.sum(pts, d => (d.x - xMean) * (d.y - yMean));
  const denX  = Math.sqrt(d3.sum(pts, d => (d.x - xMean) ** 2));
  const denY  = Math.sqrt(d3.sum(pts, d => (d.y - yMean) ** 2));
  const pearsonR = (denX && denY) ? num / (denX * denY) : 0;

  const margin = { top: 28, right: 16, bottom: 48, left: 54 };
  const W = Math.max(panel.offsetWidth  - margin.left - margin.right,  20);
  const H = Math.max(panel.offsetHeight - margin.top  - margin.bottom - 38, 40);

  const svg = container.append('svg')
    .attr('width',  W + margin.left + margin.right)
    .attr('height', H + margin.top  + margin.bottom)
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const [xLo, xHi] = d3.extent(pts, d => d.x);
  const [yLo, yHi] = d3.extent(pts, d => d.y);
  const xPad = (xHi - xLo) * 0.06 || 1e-6;
  const yPad = (yHi - yLo) * 0.06 || 1e-6;

  const xSc = d3.scaleLinear().domain([xLo - xPad, xHi + xPad]).nice().range([0, W]);
  const ySc = d3.scaleLinear().domain([Math.min(0, yLo - yPad), yHi + yPad]).nice().range([H, 0]);

  svg.append('g').attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(xSc).ticks(4).tickSizeOuter(0))
    .selectAll('text').style('font-size', '9px');
  svg.append('g').call(d3.axisLeft(ySc).ticks(5).tickSizeOuter(0))
    .selectAll('text').style('font-size', '9px');

  // Axis labels
  svg.append('text')
    .attr('x', W / 2).attr('y', H + 38)
    .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#555')
    .text('Predicted distance');
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2).attr('y', -margin.left + 13)
    .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#555')
    .text('Reference distance');

  // Many same-genome pairs stack at y=0 — draw inter-genome first (behind),
  // then intra-genome (orange) on top so they're always visible.
  const r   = n > 2000 ? 1.5 : n > 500 ? 2 : 2.5;
  const opa = n > 2000 ? 0.25 : n > 500 ? 0.35 : 0.5;

  svg.selectAll('circle.inter').data(pts.filter(d => !d.same)).join('circle')
    .attr('class', 'inter')
    .attr('cx', d => xSc(d.x)).attr('cy', d => ySc(d.y))
    .attr('r', r).attr('fill', '#4e79a7').attr('fill-opacity', opa).attr('stroke', 'none');

  svg.selectAll('circle.intra').data(pts.filter(d => d.same)).join('circle')
    .attr('class', 'intra')
    .attr('cx', d => xSc(d.x)).attr('cy', d => ySc(d.y))
    .attr('r', r + 0.5).attr('fill', '#f28e2b').attr('fill-opacity', Math.min(1, opa * 1.6)).attr('stroke', 'none');

  // Annotation: correlation + pair counts
  const nSame  = pts.filter(d => d.same).length;
  const nInter = n - nSame;
  svg.append('text')
    .attr('x', W).attr('y', -10)
    .attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#334155')
    .text(`r = ${d3.format('.3f')(pearsonR)}  ·  ${d3.format(',')(n)} pairs  (${d3.format(',')(nSame)} intra-genome)`);

  // Filter indicator: how many tips the plot is built from.
  if (fln) {
    svg.append('text')
      .attr('x', 0).attr('y', -10)
      .attr('font-size', 9).attr('fill', '#b45309')
      .text(`filtered: ${d3.format(',')(allLeaves.length)}/${d3.format(',')(treeLeaves.length)} tips`);
  }
}
