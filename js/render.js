import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { buildHierarchy } from './newick.js';
import { updateStats, clearSelection } from './stats.js';

/* ══════════════════════════════════════════════════════════════════════════
   LEGEND (categorical or continuous colour scale)
══════════════════════════════════════════════════════════════════════════ */
function buildLegend() {
  const leg = d3.select('#legend');
  leg.selectAll('*').remove();
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

  state.colorScale.domain().forEach(val => {
    const item = leg.append('div').attr('class', 'legend-item');
    item.append('div').attr('class', 'legend-swatch').style('background', state.colorScale(val));
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
  const margin      = { top: 20, right: 230, bottom: 50, left: 20 };
  const treeWidth   = Math.max(80, document.getElementById('tree').clientWidth - margin.left - margin.right + state.treeWidthDelta);
  const nodeSpacing = 10;

  const root    = buildHierarchy(data);
  const leaves  = root.leaves();
  state._leaves = leaves;
  const nLeaves = leaves.length;
  const maxDist = d3.max(leaves, d => d.dist);

  const svgW = treeWidth + margin.left + margin.right;
  const svgH = nLeaves * nodeSpacing + margin.top + margin.bottom;

  const xScale = d3.scaleLinear().domain([0, maxDist]).range([0, treeWidth]);
  const yScale = d3.scaleLinear()
    .domain([0, nLeaves - 1])
    .range([0, nLeaves * nodeSpacing - nodeSpacing]);

  function tipColor(name) {
    if (!state.colorScale || !state.currentMeta || !state.currentColorCol) return '#888';
    const row = state.currentMeta.get(name);
    if (!row) return '#bbb';
    return state.colorScale(row[state.currentColorCol]);
  }

  function tipLabel(name) {
    if (!state.currentMeta || !state.currentLabelCol) return name;
    const row = state.currentMeta.get(name);
    if (!row) return name;
    const val = row[state.currentLabelCol];
    return val !== undefined && val !== '' ? `${val}  (${name})` : name;
  }

  const linkPath = d => {
    const px = xScale(d.parent.dist), py = yScale(d.parent.slot);
    const cx = xScale(d.dist),        cy = yScale(d.slot);
    return `M${px},${py} V${cy} H${cx}`;
  };

  // Replace SVG
  d3.select('#tree').selectAll('svg').remove();
  const svgEl = d3.select('#tree')
    .append('svg')
      .attr('width',  svgW)
      .attr('height', svgH);

  const svg = svgEl.append('g');

  // ── d3.zoom for Ctrl+drag pan / Ctrl+scroll zoom ──────────────────────────
  const zoom = d3.zoom()
    .filter(event => event.ctrlKey && !event.button)
    .wheelDelta(event => -event.deltaY * (event.deltaMode === 1 ? 0.02 : event.deltaMode ? 1 : 0.0005))
    .scaleExtent([0.1, 10])
    .on('zoom', event => svg.attr('transform', event.transform));

  svgEl
    .call(zoom)
    .call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));

  // ── d3.brush for rectangle selection ─────────────────────────────────────
  const brushG = svg.insert('g', ':first-child').attr('class', 'brush');

  const brush = d3.brush()
    .extent([[0, -nodeSpacing], [treeWidth + margin.right, nLeaves * nodeSpacing]])
    .on('end', function(event) {
      if (!event.sourceEvent) return;
      const sel = event.selection;
      if (!sel) { clearSelection(); return; }

      const [[x0, y0], [x1, y1]] = sel;
      leaves.forEach(l => {
        const tx = xScale(l.dist), ty = yScale(l.slot);
        if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1)
          state.selectedNames.add(l.data.name);
      });

      brushG.call(brush.move, null);
      if (state._tipG) state._tipG.classed('selected', n => state.selectedNames.has(n.data.name));
      updateStats();
    });

  brushG.call(brush);

  // Visible links
  svg.selectAll('.link')
    .data(root.descendants().slice(1))
    .join('path')
      .attr('class', 'link')
      .attr('d', linkPath);

  // Wide transparent hit areas — clicking selects all leaves below
  svg.selectAll('.link-hit')
    .data(root.descendants().slice(1))
    .join('path')
      .attr('class', 'link-hit')
      .attr('d', linkPath)
      .on('click', function(event, d) {
        event.stopPropagation();
        d.leaves().forEach(l => state.selectedNames.add(l.data.name));
        if (state._tipG) state._tipG.classed('selected', n => state.selectedNames.has(n.data.name));
        updateStats();
      });

  // Internal node dots
  svg.selectAll('.inode')
    .data(root.descendants().filter(d => d.children))
    .join('circle')
      .attr('class', 'inode')
      .attr('cx', d => xScale(d.dist))
      .attr('cy', d => yScale(d.slot))
      .attr('r', 1.5)
      .attr('fill', '#bcc9c6');

  // Tips
  const tipG = svg.selectAll('.tip')
    .data(leaves)
    .join('g')
      .attr('class', 'tip')
      .attr('transform', d => `translate(${xScale(d.dist)},${yScale(d.slot)})`);
  state._tipG = tipG;

  tipG.append('circle')
    .attr('r', 4)
    .attr('fill', d => tipColor(d.data.name))
    .attr('opacity', 0.85);

  tipG.append('text')
    .attr('class', 'tip-label')
    .attr('x', 8)
    .attr('fill', d => tipColor(d.data.name))
    .text(d => tipLabel(d.data.name));

  // Restore visual selection state after redraw
  tipG.classed('selected', d => state.selectedNames.has(d.data.name));

  // Tip click: toggle individual tip
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

  // Scale bar
  const scaleVal = +d3.format('.2g')(maxDist * 0.1);
  const barY = nLeaves * nodeSpacing + 10;
  const barG = svg.append('g').attr('class', 'scalebar');
  barG.append('line').attr('x1', 0).attr('x2', xScale(scaleVal)).attr('y1', barY).attr('y2', barY);
  barG.append('line').attr('x1', 0).attr('x2', 0).attr('y1', barY - 4).attr('y2', barY + 4);
  barG.append('line').attr('x1', xScale(scaleVal)).attr('x2', xScale(scaleVal)).attr('y1', barY - 4).attr('y2', barY + 4);
  barG.append('text').attr('x', xScale(scaleVal) / 2).attr('y', barY + 14).text(scaleVal);

  buildLegend();
  updateStats();
}
