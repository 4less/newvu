import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';

/* ── Tableau-20 palette (saturated + lighter pairs for 20 distinct hues) ── */
export const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
  '#d37295', '#fabfd2', '#8cd17d', '#b6992d', '#499894',
  '#86bcb6', '#f1ce63', '#a0cbe8', '#ffbe7d', '#aecbfa',
];

/* ── Seven D3 symbol types, visually distinct at small sizes ─────────────── */
export const SHAPES = [
  d3.symbolCircle,
  d3.symbolSquare,
  d3.symbolDiamond,
  d3.symbolTriangle,
  d3.symbolStar,
  d3.symbolCross,
  d3.symbolWye,
];

/* ══════════════════════════════════════════════════════════════════════════
   METADATA LOADING
══════════════════════════════════════════════════════════════════════════ */
export function loadMeta(tsvText, defaultColorCol = null) {
  const rows   = d3.tsvParse(tsvText);
  const keycol = rows.columns[0];
  state.currentMeta = new Map(rows.map(r => [r[keycol], r]));
  state.metaCols    = rows.columns.slice(1);

  function populateSel(id, placeholder, cols) {
    const sel = d3.select(id);
    sel.selectAll('option').remove();
    sel.append('option').attr('value', '').text(placeholder);
    cols.forEach(c => sel.append('option').attr('value', c).text(c));
  }

  // Classify columns
  const numCols = state.metaCols.filter(col =>
    [...state.currentMeta.values()].every(r => r[col] !== '' && !isNaN(+r[col]))
  );
  const catCols = state.metaCols.filter(col => !numCols.includes(col));

  populateSel('#color-select', '— none —',    state.metaCols);
  populateSel('#shape-select', '— none —',    catCols);
  populateSel('#label-select', '— tip name —', state.metaCols);

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
      state.colorScale = d3.scaleOrdinal(PALETTE).domain(unique);
    }
  } else {
    state.colorScale = null;
    state.isLogScale = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SHAPE SCALE
══════════════════════════════════════════════════════════════════════════ */
export function rebuildShapeScale() {
  if (state.shapeCol && state.currentMeta) {
    const vals   = [...state.currentMeta.values()].map(r => r[state.shapeCol]);
    const unique = [...new Set(vals)];
    state.shapeScale = d3.scaleOrdinal(SHAPES).domain(unique);
  } else {
    state.shapeScale = null;
  }
}
