import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { buildHierarchy } from './newick.js';
import { updateStats, clearSelection } from './stats.js';

/* helper — always creates a fresh generator to avoid shared-state mutation */
const sym = (type, size = 64) => d3.symbol().type(type).size(size)();

/* ══════════════════════════════════════════════════════════════════════════
   LEGEND (categorical or continuous colour scale)
══════════════════════════════════════════════════════════════════════════ */
function buildLegend() {
  const leg = d3.select('#legend');
  leg.selectAll('*').remove();
  if (!state.colorScale && !state.shapeScale) return;

  /* shape-only legend (no color column selected) */
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

  /* continuous (gradient) legend */
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

  /* categorical legend — SVG symbol swatches */
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
      const matching = [...state.currentMeta.entries()]
        .filter(([, row]) => row[state.currentColorCol] === val)
        .map(([name]) => name);
      const allSelected = matching.length > 0 && matching.every(n => state.selectedNames.has(n));
      if (allSelected) {
        matching.forEach(n => state.selectedNames.delete(n));
      } else {
        matching.forEach(n => state.selectedNames.add(n));
      }
      if (state._tipG) state._tipG.classed('selected', n => state.selectedNames.has(n.data.name));
      updateStats();
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   TREE RENDER
══════════════════════════════════════════════════════════════════════════ */
export function draw(data) {
  const circular = state.circularLayout;

  const root    = buildHierarchy(data);
  const leaves  = root.leaves();
  state._leaves = leaves;
  const nLeaves = leaves.length;
  const maxDist = d3.max(leaves, d => d.dist);

  const container = document.getElementById('tree');

  /* ── Layout-specific scales & dimensions ─────────────────────────────── */
  let svgW, svgH, initTransform;
  let rScale, aScale, maxR;

  // Store margin / spacing for use in brush extent and scale bar
  const margin  = { top: 20, right: 230, bottom: 50, left: 20 };
  const spacing = 10;
  let treeW, xScale, yScale;

  if (circular) {
    const labelPad = 190;
    maxR   = Math.max(40, Math.min(container.clientWidth, container.clientHeight) / 2 - labelPad);
    svgW   = container.clientWidth;
    svgH   = container.clientHeight;
    rScale = d3.scaleLinear().domain([0, maxDist]).range([0, maxR]);
    aScale = d3.scaleLinear().domain([0, nLeaves]).range([-Math.PI / 2, 3 * Math.PI / 2]);
    initTransform = d3.zoomIdentity.translate(svgW / 2, svgH / 2);
  } else {
    treeW  = Math.max(80, container.clientWidth - margin.left - margin.right + state.treeWidthDelta);
    svgW   = treeW + margin.left + margin.right;
    svgH   = nLeaves * spacing + margin.top + margin.bottom;
    xScale = d3.scaleLinear().domain([0, maxDist]).range([0, treeW]);
    yScale = d3.scaleLinear().domain([0, nLeaves - 1]).range([0, nLeaves * spacing - spacing]);
    initTransform = d3.zoomIdentity.translate(margin.left, margin.top);
  }

  /* ── Pre-compute per-node Cartesian positions ─────────────────────────── */
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
  function rectLink(d) {
    return `M${d.parent.px},${d.parent.py} V${d.py} H${d.px}`;
  }

  function circLink(d) {
    const pR = d.parent.radius, pA = d.parent.angle;
    const cR = d.radius,        cA = d.angle;
    const p1x = pR * Math.cos(pA), p1y = pR * Math.sin(pA);
    const p2x = pR * Math.cos(cA), p2y = pR * Math.sin(cA);
    const p3x = cR * Math.cos(cA), p3y = cR * Math.sin(cA);
    if (pR < 1e-9) return `M0,0 L${p3x},${p3y}`;
    const dA = cA - pA;
    return `M${p1x},${p1y} A${pR},${pR} 0 ${Math.abs(dA) > Math.PI ? 1 : 0},${dA > 0 ? 1 : 0} ${p2x},${p2y} L${p3x},${p3y}`;
  }

  const linkPath = circular ? circLink : rectLink;

  /* ── Tip helpers ──────────────────────────────────────────────────────── */
  function tipColor(name) {
    if (!state.colorScale || !state.currentMeta || !state.currentColorCol) return '#888';
    const row = state.currentMeta.get(name);
    if (!row) return '#bbb';
    return state.colorScale(row[state.currentColorCol]);
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

  /* ── Build SVG ────────────────────────────────────────────────────────── */
  d3.select('#tree').selectAll('svg').remove();
  const svgEl = d3.select('#tree').append('svg')
    .attr('width', svgW).attr('height', svgH)
    .classed('circular',     circular)
    .classed('tool-pan',     state.activeTool === 'pan')
    .classed('tool-select',  state.activeTool === 'select')
    .classed('tool-zoomrect', state.activeTool === 'zoomrect');

  const svg = svgEl.append('g');

  /* ── Zoom (tool-aware filter) ─────────────────────────────────────────── */
  const zoom = d3.zoom()
    .filter(event => {
      if (event.type === 'wheel') return event.ctrlKey;      // scroll only zooms with Ctrl
      if (state.activeTool === 'pan') return !event.button;  // pan: any drag
      return event.ctrlKey && !event.button;                 // others: ctrl+drag
    })
    .wheelDelta(event => -event.deltaY * (event.deltaMode === 1 ? 0.02 : event.deltaMode ? 1 : 0.0005))
    .scaleExtent([0.1, 10])
    .on('zoom', event => {
      state.zoomTransform = event.transform;
      svg.attr('transform', event.transform);
    });

  svgEl.call(zoom)
       .call(zoom.transform, state.zoomTransform ?? initTransform);

  // Double-click resets zoom to initial view
  svgEl.on('dblclick.zoom', null);
  svgEl.on('dblclick', () => {
    state.zoomTransform = null;
    svgEl.transition().duration(350).call(zoom.transform, initTransform);
  });

  /* ── Brush (tool-aware) ───────────────────────────────────────────────── */
  const brushG = svg.insert('g', ':first-child').attr('class', 'brush');

  const brushExtent = circular
    ? [[-maxR - 190, -maxR - 190], [maxR + 190, maxR + 190]]
    : [[0, -spacing], [treeW + margin.right, nLeaves * spacing]];

  const brush = d3.brush()
    .filter(event => {
      if (state.activeTool === 'pan')  return false;  // pan tool owns all drags
      if (event.type === 'wheel')      return false;
      if (event.ctrlKey || event.button) return false;
      return true;
    })
    .extent(brushExtent)
    .on('end', function(event) {
      if (!event.sourceEvent) return;
      const sel = event.selection;

      /* ── Zoom-to-rect tool ── */
      if (state.activeTool === 'zoomrect') {
        brushG.call(brush.move, null);
        if (!sel) {
          // Empty click → reset zoom
          state.zoomTransform = null;
          svgEl.transition().duration(350).call(zoom.transform, initTransform);
          return;
        }
        const [[x0, y0], [x1, y1]] = sel;
        const selW = Math.max(x1 - x0, 1), selH = Math.max(y1 - y0, 1);
        const k   = Math.min(svgW / selW, svgH / selH, zoom.scaleExtent()[1]) * 0.85;
        const cx  = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const t   = d3.zoomIdentity.translate(svgW / 2 - k * cx, svgH / 2 - k * cy).scale(k);
        state.zoomTransform = t;
        svgEl.transition().duration(350).call(zoom.transform, t);
        return;
      }

      /* ── Select tool ── */
      if (!sel) { clearSelection(); return; }
      const [[x0, y0], [x1, y1]] = sel;
      leaves.forEach(l => {
        if (l.px >= x0 && l.px <= x1 && l.py >= y0 && l.py <= y1)
          state.selectedNames.add(l.data.name);
      });
      brushG.call(brush.move, null);
      if (state._tipG) state._tipG.classed('selected', n => state.selectedNames.has(n.data.name));
      updateStats();
    });

  brushG.call(brush);

  /* ── Links ────────────────────────────────────────────────────────────── */
  svg.selectAll('.link')
    .data(root.descendants().slice(1))
    .join('path').attr('class', 'link').attr('d', linkPath);

  svg.selectAll('.link-hit')
    .data(root.descendants().slice(1))
    .join('path')
      .attr('class', 'link-hit').attr('d', linkPath)
      .on('click', function(event, d) {
        event.stopPropagation();
        d.leaves().forEach(l => state.selectedNames.add(l.data.name));
        if (state._tipG) state._tipG.classed('selected', n => state.selectedNames.has(n.data.name));
        updateStats();
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
  state._tipG = tipG;

  tipG.append('path')
    .attr('d', d => sym(tipShape(d.data.name)))
    .attr('fill', d => tipColor(d.data.name))
    .attr('opacity', 0.85);

  tipG.append('text')
    .attr('class', 'tip-label')
    .attr('transform', d => {
      if (!circular) return null;
      const deg  = d.angle * 180 / Math.PI;
      const flip = Math.cos(d.angle) < 0;
      return `rotate(${deg + (flip ? 180 : 0)})`;
    })
    .attr('x', d => circular ? (Math.cos(d.angle) < 0 ? -8 : 8) : 8)
    .attr('text-anchor', d => circular && Math.cos(d.angle) < 0 ? 'end' : 'start')
    .attr('fill', d => tipColor(d.data.name))
    .text(d => tipLabel(d.data.name));

  tipG.classed('selected', d => state.selectedNames.has(d.data.name));

  tipG.on('click', function(event, d) {
    event.stopPropagation();
    const name = d.data.name;
    if (state.selectedNames.has(name)) state.selectedNames.delete(name);
    else state.selectedNames.add(name);
    d3.select(this).classed('selected', state.selectedNames.has(name));
    updateStats();
  });

  const tooltip = d3.select('#tooltip');
  tipG
    .on('mouseover', function(event, d) {
      const name = d.data.name;
      const row  = state.currentMeta ? state.currentMeta.get(name) : null;
      let html = `<strong>${name}</strong>`;
      if (row && state.metaCols.length) {
        html += '<table>' + state.metaCols.map(col =>
          `<tr><td>${col}</td><td>${row[col] ?? ''}</td></tr>`
        ).join('') + '</table>';
      }
      tooltip.html(html).style('display', 'block');
    })
    .on('mousemove', function(event) {
      const x = event.clientX + 14, y = event.clientY - 10;
      const tw = tooltip.node().offsetWidth;
      tooltip
        .style('left',  (x + tw > window.innerWidth ? x - tw - 20 : x) + 'px')
        .style('top',   y + 'px');
    })
    .on('mouseout', () => tooltip.style('display', 'none'));

  /* ── Scale bar ────────────────────────────────────────────────────────── */
  const scaleVal = +d3.format('.2g')(maxDist * 0.1);
  const barG = svg.append('g').attr('class', 'scalebar');

  if (circular) {
    const barW = rScale(scaleVal);
    const barY = maxR + 20;
    barG.append('line').attr('x1', -barW / 2).attr('x2', barW / 2).attr('y1', barY).attr('y2', barY);
    barG.append('line').attr('x1', -barW / 2).attr('x2', -barW / 2).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('line').attr('x1',  barW / 2).attr('x2',  barW / 2).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('text').attr('x', 0).attr('y', barY + 14).text(scaleVal);
  } else {
    const barY = nLeaves * spacing + 10;
    const bx   = xScale(scaleVal);
    barG.append('line').attr('x1', 0).attr('x2', bx).attr('y1', barY).attr('y2', barY);
    barG.append('line').attr('x1', 0).attr('x2', 0).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('line').attr('x1', bx).attr('x2', bx).attr('y1', barY - 4).attr('y2', barY + 4);
    barG.append('text').attr('x', bx / 2).attr('y', barY + 14).text(scaleVal);
  }

  buildLegend();
  updateStats();
}
