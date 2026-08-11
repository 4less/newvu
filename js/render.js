import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { buildHierarchy, pruneTree, leafNames } from './newick.js';
import { updateStats, clearSelection } from './stats.js';
import { SHAPES } from './meta.js';

const sym = (type, size = 64) => d3.symbol().type(type).size(size)();

/* ══════════════════════════════════════════════════════════════════════════
   LEGEND  (always renders into #legend — shared across trees)
══════════════════════════════════════════════════════════════════════════ */
function buildLegend() {
  const leg = d3.select('#legend');
  leg.selectAll('*').remove();
  if (!state.colorScale && !state.shapeScale) return;

  if (!state.colorScale && state.shapeScale) {
    state.shapeScale.domain().forEach(val => {
      const item = leg.append('div').attr('class', 'legend-item');
      item.append('svg').attr('width', 14).attr('height', 14)
        .style('flex-shrink', '0').style('overflow', 'visible')
        .append('path')
          .attr('transform', 'translate(7,7)')
          .attr('d', sym(state.shapeScale(val)))
          .attr('fill', '#64748b').attr('opacity', 0.85);
      item.append('span').text(val);
    });
    return;
  }

  if (!state.colorScale || !state.colorScale.domain) return;

  if (typeof state.colorScale.domain()[0] !== 'string') {
    const [lo, hi] = state.colorScale.domain();
    const valAt = t => state.isLogScale ? lo * Math.pow(hi / lo, t) : lo + t * (hi - lo);
    const stops = d3.range(0, 1.01, 0.05).map(t => state.colorScale(valAt(t))).join(', ');
    const wrap = leg.append('div').attr('class', 'legend-gradient');
    wrap.append('div').attr('class', 'legend-gradient-bar')
      .style('background', `linear-gradient(to right, ${stops})`);
    const ticksDiv = wrap.append('div').attr('class', 'legend-gradient-ticks');
    [0, 0.25, 0.5, 0.75, 1].forEach((t, i, arr) => {
      ticksDiv.append('span')
        .style('left', (t * 100) + '%')
        .style('transform', i === 0 ? 'none' : i === arr.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)')
        .text(d3.format('.3g')(valAt(t)));
    });
    return;
  }

  const sameCol = state.shapeScale && state.shapeCol === state.currentColorCol;
  state.colorScale.domain().forEach(val => {
    const item  = leg.append('div').attr('class', 'legend-item');
    const color = state.colorScale(val);
    const shape = sameCol ? state.shapeScale(val) : d3.symbolCircle;
    item.append('svg').attr('width', 14).attr('height', 14)
      .style('flex-shrink', '0').style('overflow', 'visible')
      .append('path')
        .attr('transform', 'translate(7,7)')
        .attr('d', sym(shape))
        .attr('fill', color).attr('opacity', 0.85);
    item.append('span').text(val);
    item.on('click', () => {
      // Legend click selects matching tips in the ACTIVE tree.
      // Match by checking each tree tip directly: either its metadata color
      // column equals val, or its name itself equals val (when tips are named
      // by the color value, e.g. genome accessions in the comparison tree).
      const ts = state.activeTree;
      if (!ts) return;
      const matching = (ts._leaves || [])
        .map(l => l.data.name)
        .filter(name => {
          const row = state.currentMeta?.get(name.trim());
          if (row && state.currentColorCol) return row[state.currentColorCol] === val;
          return name.trim() === val;
        });
      const allSelected = matching.length > 0 && matching.every(n => ts.selectedNames.has(n));
      if (allSelected) matching.forEach(n => ts.selectedNames.delete(n));
      else             matching.forEach(n => ts.selectedNames.add(n));
      if (ts._tipG) ts._tipG.classed('selected', n => ts.selectedNames.has(n.data.name));
      updateStats(ts);
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   TREE RENDER
   treeState  — per-tree state instance (from treeState.js)
   containerId — id of the .tree-canvas <div> ('tree' or 'tree2')
══════════════════════════════════════════════════════════════════════════ */
export function draw(treeState, containerId = 'tree') {
  const circular = treeState.circularLayout;

  const container = document.getElementById(containerId);
  if (!container) return;

  // Full leaf set of the unfiltered tree — filters are always evaluated
  // against this, so relaxing a filter brings tips back.
  treeState._allLeafNames = leafNames(treeState.currentData);

  /* ── Filter: prune the tree, then lay out what is left ──────────────── */
  // Removing tips also removes the branches that led to them; unary internal
  // nodes are collapsed (branch lengths merged), so the layout below is
  // recomputed from scratch on every filter change.
  const fln  = treeState.filteredLeafNames; // Set<name> | null
  const data = fln ? pruneTree(treeState.currentData, fln) : treeState.currentData;

  d3.select(`#${containerId}`).selectAll('svg, .tree-empty').remove();

  if (!data) {
    treeState._leaves = [];
    treeState._tipG   = null;
    container.style.overflow = 'hidden';
    d3.select(`#${containerId}`).append('div')
      .attr('class', 'tree-empty')
      .text('No tips match the current filters');
    buildLegend();
    updateStats(treeState);
    return;
  }

  const root    = buildHierarchy(data);
  const leaves  = root.leaves();
  treeState._leaves = leaves;
  const nLeaves = leaves.length;
  const rawMaxDist = d3.max(leaves, d => d.dist) || 0;
  const maxDist    = rawMaxDist > 0 ? rawMaxDist : 1;  // guard single-tip / zero-length trees

  /* ── Layout ───────────────────────────────────────────────────────────── */
  const spacing = 10;
  let svgW, svgH, initTransform;
  let rScale, aScale, maxR, labelPad, treeW, xScale, yScale;
  let margin = { top: 20, right: 230, bottom: 50, left: 20 };

  if (circular) {
    // Label padding scales with the shorter container dimension so the tree
    // circle and labels shrink proportionally when the panel opens.
    const minDim = Math.min(container.clientWidth, container.clientHeight);
    labelPad = Math.max(60, Math.min(190, minDim * 0.32));
    maxR  = Math.max(40, minDim / 2 - labelPad);
    svgW  = container.clientWidth;
    svgH  = container.clientHeight;
    // Clip instead of scroll — circular trees always fit the container.
    container.style.overflow = 'hidden';
    rScale = d3.scaleLinear().domain([0, maxDist]).range([0, maxR]);
    aScale = d3.scaleLinear().domain([0, nLeaves]).range([-Math.PI / 2, 3 * Math.PI / 2]);
    initTransform = d3.zoomIdentity.translate(svgW / 2, svgH / 2);
  } else {
    // Right margin (label space) is proportional to container width so the tree
    // branches don't collapse to nothing when the panel opens.
    const rightMargin = Math.max(80, Math.min(230, container.clientWidth * 0.42));
    margin = { top: 20, right: rightMargin, bottom: 50, left: 20 };
    container.style.overflow = 'auto';
    treeW = Math.max(80, container.clientWidth - margin.left - margin.right + treeState.treeWidthDelta);
    svgW  = treeW + margin.left + margin.right;
    svgH  = nLeaves * spacing + margin.top + margin.bottom;
    xScale = d3.scaleLinear().domain([0, maxDist]).range([0, treeW]);
    yScale = d3.scaleLinear().domain([0, nLeaves - 1]).range([0, nLeaves * spacing - spacing]);
    initTransform = d3.zoomIdentity.translate(margin.left, margin.top);
  }

  // In circular mode, scale font and tip size proportionally with the container
  // so labels and markers shrink/grow together with the tree circle.
  const _refDim = 600;
  const _scale  = circular ? Math.max(0.3, Math.min(1.5, Math.min(container.clientWidth, container.clientHeight) / _refDim)) : 1;
  const effectiveFontSize = Math.max(4, Math.round(state.tipFontSize * _scale));
  const effectiveTipSize  = Math.max(6, Math.round(state.tipSize  * _scale));

  /* ── Node positions ───────────────────────────────────────────────────── */
  root.each(node => {
    if (circular) {
      node.angle  = aScale(node.slot);
      node.radius = rScale(node.dist);
      node.px = node.radius * Math.cos(node.angle);
      node.py = node.radius * Math.sin(node.angle);
    } else {
      node.px = xScale(node.dist);
      node.py = yScale(node.slot);
    }
  });

  /* ── Link path ────────────────────────────────────────────────────────── */
  const rectLink = d =>
    `M${d.parent.px},${d.parent.py} V${d.py} H${d.px}`;

  const circLink = d => {
    const pR = d.parent.radius, pA = d.parent.angle;
    const cR = d.radius,        cA = d.angle;
    const p1x = pR * Math.cos(pA), p1y = pR * Math.sin(pA);
    const p2x = pR * Math.cos(cA), p2y = pR * Math.sin(cA);
    const p3x = cR * Math.cos(cA), p3y = cR * Math.sin(cA);
    if (pR < 1e-9) return `M0,0 L${p3x},${p3y}`;
    const dA = cA - pA;
    return `M${p1x},${p1y} A${pR},${pR} 0 ${Math.abs(dA) > Math.PI ? 1 : 0},${dA > 0 ? 1 : 0} ${p2x},${p2y} L${p3x},${p3y}`;
  };

  const linkPath = circular ? circLink : rectLink;

  /* ── Tip helpers ──────────────────────────────────────────────────────── */
  // Pre-build a Set of colour-domain values for O(1) look-up inside tipColor.
  const colorDomainSet = (state.colorScale && typeof state.colorScale.domain()[0] === 'string')
    ? new Set(state.colorScale.domain())
    : null;

  function tipColor(name) {
    if (!state.colorScale || !state.currentMeta || !state.currentColorCol) return '#888';

    // Trim whitespace that can sneak in from Newick files.
    const key = name.trim();

    // Primary: look up by the metadata ID column (standard case — tree 1).
    const row = state.currentMeta.get(key);
    if (row) return state.colorScale(row[state.currentColorCol]);

    // Fallback A: tip name is itself a colour-column value (categorical scales only).
    // Covers tree 2 whose tips are named by e.g. genome accession when
    // "Color by: genome" is active — they receive the same colour as the
    // matching samples in tree 1.
    if (colorDomainSet && colorDomainSet.has(key)) return state.colorScale(key);

    // Fallback B: strip trailing version suffix (e.g. ".1") and retry.
    // Handles minor version mismatches between tree file and metadata.
    if (colorDomainSet) {
      const noVersion = key.replace(/\.\d+$/, '');
      if (noVersion !== key) {
        for (const v of colorDomainSet) {
          if (v.replace(/\.\d+$/, '') === noVersion) return state.colorScale(v);
        }
      }
    }

    return '#bbb';
  }

  function tipShape(name) {
    if (!state.shapeScale || !state.shapeCol || !state.currentMeta) return d3.symbolCircle;
    const row = state.currentMeta.get(name);
    if (!row) return d3.symbolCircle;
    return state.shapeScale(row[state.shapeCol]) ?? d3.symbolCircle;
  }

  function tipLabel(name) {
    if (!state.currentMeta || !state.currentLabelCol) return name;
    const row = state.currentMeta.get(name);
    if (!row) return name;
    const val = row[state.currentLabelCol];
    return val !== undefined && val !== '' ? `${val}  (${name})` : name;
  }

  /* ── SVG ──────────────────────────────────────────────────────────────── */
  const svgEl = d3.select(`#${containerId}`).append('svg')
    .attr('width', svgW).attr('height', svgH)
    .classed('circular',      circular)
    .classed('tool-pan',      state.activeTool === 'pan')
    .classed('tool-select',   state.activeTool === 'select')
    .classed('tool-zoomrect', state.activeTool === 'zoomrect');

  const svg = svgEl.append('g');

  /* ── Zoom ─────────────────────────────────────────────────────────────── */
  const zoom = d3.zoom()
    .filter(event => {
      if (event.type === 'wheel')        return event.ctrlKey;
      if (state.activeTool === 'pan')    return !event.button;
      return event.ctrlKey && !event.button;
    })
    .wheelDelta(event => {
      // Touchpad pinch arrives as a ctrl+wheel with small deltas, so it needs
      // a much larger factor than a mouse wheel to feel responsive. The clamp
      // keeps one fast gesture from jumping several octaves at once.
      const perLine = event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002;
      const d = -event.deltaY * (event.ctrlKey ? 0.01 : perLine);
      return Math.max(-0.6, Math.min(0.6, d));
    })
    .scaleExtent([0.1, 10])
    .on('zoom', event => {
      treeState.zoomTransform = event.transform;
      svg.attr('transform', event.transform);
    });

  svgEl.call(zoom).call(zoom.transform, treeState.zoomTransform ?? initTransform);

  /* ── Touchpad: two-finger pan ─────────────────────────────────────────── */
  // A pinch reaches us as a wheel event with ctrlKey set — the zoom filter
  // above takes those. A plain two-finger scroll has no ctrlKey: pan with it,
  // unless the canvas still has native scroll room in that axis (tall
  // rectangular trees), where scrolling is the better behaviour.
  // preventDefault() also stops horizontal swipes from triggering the
  // browser's back-navigation gesture.
  svgEl.on('wheel.pan', function (event) {
    if (event.ctrlKey) return;                       // pinch → handled by zoom
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
    const dx = event.deltaX * unit, dy = event.deltaY * unit;
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const roomY = container.scrollHeight - container.clientHeight > 1;
    const roomX = container.scrollWidth  - container.clientWidth  > 1;
    if (vertical ? roomY : roomX) return;            // let the canvas scroll
    event.preventDefault();
    // Tree follows the fingers (drag-style), rather than scroll-style where
    // the content moves against them.
    const t = treeState.zoomTransform ?? initTransform;
    svgEl.call(zoom.transform, t.translate(dx / t.k, dy / t.k));
  });

  // Remove D3's default dblclick-zoom; replace with full reset
  svgEl.on('dblclick.zoom', null);
  svgEl.on('dblclick', () => {
    treeState.zoomTransform = null;
    svgEl.transition().duration(350).call(zoom.transform, initTransform);
  });

  // Click on empty SVG space → clear selection.
  // Tips and link-hit paths call stopPropagation(), so they never reach here.
  svgEl.on('click.deselect', () => {
    if (state.activeTool !== 'pan') clearSelection(treeState);
  });

  /* ── Brush ────────────────────────────────────────────────────────────── */
  const brushG = svg.insert('g', ':first-child').attr('class', 'brush');

  const brushExtent = circular
    ? [[-maxR - labelPad, -maxR - labelPad], [maxR + labelPad, maxR + labelPad]]
    : [[0, -spacing], [treeW + margin.right, nLeaves * spacing]];

  const brush = d3.brush()
    .filter(event => {
      if (state.activeTool === 'pan')        return false;
      if (event.type === 'wheel')            return false;
      if (event.ctrlKey || event.button)     return false;
      return true;
    })
    .extent(brushExtent)
    .on('end', function(event) {
      if (!event.sourceEvent) return;
      const sel = event.selection;

      if (state.activeTool === 'zoomrect') {
        brushG.call(brush.move, null);
        if (!sel) {
          treeState.zoomTransform = null;
          svgEl.transition().duration(350).call(zoom.transform, initTransform);
          return;
        }
        const [[x0, y0], [x1, y1]] = sel;
        const k = Math.min(svgW / Math.max(x1 - x0, 1), svgH / Math.max(y1 - y0, 1), zoom.scaleExtent()[1]) * 0.85;
        const t = d3.zoomIdentity.translate(svgW / 2 - k * ((x0 + x1) / 2), svgH / 2 - k * ((y0 + y1) / 2)).scale(k);
        treeState.zoomTransform = t;
        svgEl.transition().duration(350).call(zoom.transform, t);
        return;
      }

      // Null selection = single click on empty SVG space. Let click.deselect handle it;
      // removing it here prevents the brush from accidentally undoing legend selections.
      if (!sel) return;
      const [[x0, y0], [x1, y1]] = sel;
      leaves.forEach(l => {
        if (l.px >= x0 && l.px <= x1 && l.py >= y0 && l.py <= y1)
          treeState.selectedNames.add(l.data.name);
      });
      brushG.call(brush.move, null);
      if (treeState._tipG) treeState._tipG.classed('selected', n => treeState.selectedNames.has(n.data.name));
      updateStats(treeState);
    });

  brushG.call(brush);

  /* ── Links ────────────────────────────────────────────────────────────── */
  // The tree is already pruned, so every branch here belongs to the layout.
  const branches = root.descendants().slice(1);

  svg.selectAll('.link')
    .data(branches)
    .join('path').attr('class', 'link').attr('d', linkPath);

  svg.selectAll('.link-hit')
    .data(branches)
    .join('path')
      .attr('class', 'link-hit').attr('d', linkPath)
      .on('click', function(event, d) {
        event.stopPropagation();
        d.leaves().forEach(l => treeState.selectedNames.add(l.data.name));
        if (treeState._tipG) treeState._tipG.classed('selected', n => treeState.selectedNames.has(n.data.name));
        updateStats(treeState);
      });

  /* ── Internal node dots ───────────────────────────────────────────────── */
  svg.selectAll('.inode')
    .data(root.descendants().filter(d => d.children))
    .join('circle')
      .attr('class', 'inode')
      .attr('cx', d => d.px).attr('cy', d => d.py)
      .attr('r', 1.5).attr('fill', '#cbd5e1');

  /* ── Tips ─────────────────────────────────────────────────────────────── */
  const tipG = svg.selectAll('.tip')
    .data(leaves)
    .join('g')
      .attr('class', 'tip')
      .attr('transform', d => `translate(${d.px},${d.py})`);
  treeState._tipG = tipG;

  tipG.append('path')
    .attr('d', d => sym(tipShape(d.data.name), effectiveTipSize))
    .attr('fill', d => tipColor(d.data.name))
    .attr('opacity', 0.85);

  tipG.append('text')
    .attr('class', 'tip-label')
    .style('font-size', effectiveFontSize + 'px')
    .attr('transform', d => {
      if (!circular) return null;
      const deg = d.angle * 180 / Math.PI;
      return `rotate(${deg + (Math.cos(d.angle) < 0 ? 180 : 0)})`;
    })
    .attr('x', d => circular ? (Math.cos(d.angle) < 0 ? -8 : 8) : 8)
    .attr('text-anchor', d => circular && Math.cos(d.angle) < 0 ? 'end' : 'start')
    .attr('fill', d => tipColor(d.data.name))
    .text(d => tipLabel(d.data.name));

  tipG.classed('selected', d => treeState.selectedNames.has(d.data.name));

  tipG.on('click', function(event, d) {
    event.stopPropagation();
    const name = d.data.name;
    if (treeState.selectedNames.has(name)) treeState.selectedNames.delete(name);
    else treeState.selectedNames.add(name);
    d3.select(this).classed('selected', treeState.selectedNames.has(name));
    updateStats(treeState);
  });

  const tooltip = d3.select('#tooltip');

  // Long values are clipped from the LEFT — the tail carries the information
  // (accessions, paths, sample suffixes), so keep the end and drop the head.
  const clipStart = (s, n = 44) => (s.length > n ? '…' + s.slice(-n) : s);

  tipG
    .on('mouseover', function(event, d) {
      const name = d.data.name;
      const row  = state.currentMeta ? state.currentMeta.get(name) : null;
      let html = `<strong>${clipStart(name, 52)}</strong>`;
      if (row && state.metaCols.length) {
        html += '<table>' + state.metaCols.map(col =>
          `<tr><td>${clipStart(col, 24)}</td><td>${clipStart(String(row[col] ?? ''))}</td></tr>`
        ).join('') + '</table>';
      }
      tooltip.html(html).style('display', 'block');
    })
    .on('mousemove', function(event) {
      const x = event.clientX + 14, y = event.clientY - 10;
      const tw = tooltip.node().offsetWidth;
      tooltip
        .style('left', (x + tw > window.innerWidth ? x - tw - 20 : x) + 'px')
        .style('top', y + 'px');
    })
    .on('mouseout', () => tooltip.style('display', 'none'));

  /* ── Scale bar ────────────────────────────────────────────────────────── */
  const scaleVal = +d3.format('.2g')(maxDist * 0.1);
  const barG = svg.append('g').attr('class', 'scalebar').classed('hidden', rawMaxDist <= 0);

  if (circular) {
    const barW = rScale(scaleVal), barY = maxR + 20;
    barG.append('line').attr('x1', -barW / 2).attr('x2', barW / 2).attr('y1', barY).attr('y2', barY);
    barG.append('line').attr('x1', -barW / 2).attr('x2', -barW / 2).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('line').attr('x1',  barW / 2).attr('x2',  barW / 2).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('text').attr('x', 0).attr('y', barY + 14).text(scaleVal);
  } else {
    const barY = nLeaves * spacing + 10, bx = xScale(scaleVal);
    barG.append('line').attr('x1', 0).attr('x2', bx).attr('y1', barY).attr('y2', barY);
    barG.append('line').attr('x1', 0).attr('x2', 0).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('line').attr('x1', bx).attr('x2', bx).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('text').attr('x', bx / 2).attr('y', barY + 14).text(scaleVal);
  }

  buildLegend();
  updateStats(treeState);
}
