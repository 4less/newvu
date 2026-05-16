import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';

/* ══════════════════════════════════════════════════════════════════════════
   METADATA LOADING
══════════════════════════════════════════════════════════════════════════ */
export function loadMeta(tsvText, defaultColorCol = null) {
  const rows   = d3.tsvParse(tsvText);
  const keycol = rows.columns[0];
  state.currentMeta = new Map(rows.map(r => [r[keycol], r]));
  state.metaCols    = rows.columns.slice(1);

  function populateSel(id, placeholder) {
    const sel = d3.select(id);
    sel.selectAll('option').remove();
    sel.append('option').attr('value', '').text(placeholder);
    state.metaCols.forEach(c => sel.append('option').attr('value', c).text(c));
  }
  populateSel('#color-select', '— none —');
  populateSel('#label-select', '— tip name —');

  const numCols = state.metaCols.filter(col =>
    [...state.currentMeta.values()].every(r => r[col] !== '' && !isNaN(+r[col]))
  );
  const bpSel = d3.select('#boxplot-select');
  bpSel.selectAll('option').remove();
  bpSel.append('option').attr('value', '').text('— choose —');
  bpSel.append('option').attr('value', '__pairwise__').text('Pairwise distances');
  numCols.forEach(c => bpSel.append('option').attr('value', c).text(c));
  if (!state.boxplotCol) {
    state.boxplotCol = '__pairwise__';
    bpSel.property('value', '__pairwise__');
  }

  if (defaultColorCol && state.metaCols.includes(defaultColorCol)) {
    state.currentColorCol = defaultColorCol;
    d3.select('#color-select').property('value', defaultColorCol);
    rebuildColorScale();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   COLOUR SCALE
══════════════════════════════════════════════════════════════════════════ */
export function rebuildColorScale() {
  if (state.currentColorCol && state.currentMeta) {
    const vals   = [...state.currentMeta.values()].map(r => r[state.currentColorCol]);
    const unique = [...new Set(vals)];
    const isNum  = unique.every(v => v !== '' && !isNaN(+v));
    if (isNum) {
      const extent = d3.extent(vals, v => +v);
      state.isLogScale = extent[0] > 0;
      state.colorScale = (state.isLogScale ? d3.scaleSequentialLog : d3.scaleSequential)(d3.interpolateTurbo).domain(extent);
    } else {
      state.isLogScale = false;
      state.colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(unique);
    }
  } else {
    state.colorScale = null;
    state.isLogScale = false;
  }
}
