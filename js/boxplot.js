import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';

/* ══════════════════════════════════════════════════════════════════════════
   BOXPLOT (sidebar panel)
══════════════════════════════════════════════════════════════════════════ */
export function drawBoxplot() {
  const panel     = document.getElementById('left-panel');
  const container = d3.select('#boxplot');
  container.selectAll('*').remove();

  if (panel.offsetWidth < 20) return;

  if (!state.boxplotCol) {
    container.append('div').attr('class', 'bp-placeholder').text('Choose a variable above to plot.');
    return;
  }
  if (state.selectedNames.size === 0) {
    container.append('div').attr('class', 'bp-placeholder').text('Select tips in the tree to see the distribution.');
    return;
  }

  const isCat = state.colorScale && typeof state.colorScale.domain()[0] === 'string' && state.currentColorCol;
  let pts = [];
  let yLabel = state.boxplotCol;

  if (state.boxplotCol === '__pairwise__') {
    yLabel = 'Cophenetic distance';
    const selLeaves = (state._leaves || []).filter(l => state.selectedNames.has(l.data.name));
    if (selLeaves.length < 2) {
      container.append('div').attr('class', 'bp-placeholder').text('Select at least 2 tips to compute pairwise distances.');
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
      container.append('div').attr('class', 'bp-placeholder').text('Load metadata to plot this variable.');
      return;
    }
    pts = [...state.selectedNames].flatMap(name => {
      const row = state.currentMeta.get(name);
      if (!row) return [];
      const val = +row[state.boxplotCol];
      if (isNaN(val)) return [];
      return [{ val, cat: isCat ? (row[state.currentColorCol] || '?') : 'All' }];
    });
  }

  if (!pts.length) {
    container.append('div').attr('class', 'bp-placeholder').text('No data for selected tips.');
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
