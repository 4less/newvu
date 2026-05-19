import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';

/* ══════════════════════════════════════════════════════════════════════════
   FILTER STATE
══════════════════════════════════════════════════════════════════════════ */
let _filters  = [];    // [{col, type, min, max, dataMin, dataMax, values, allValues}]
let _live     = false; // global live-update toggle
let _onChange = null;  // (applyNow: bool) => void — wired by main.js

export function setFilterOnChange(fn) { _onChange = fn; }
export function getFilters()          { return _filters; }
export function hasActiveFilters()    { return _filters.length > 0; }

/* ══════════════════════════════════════════════════════════════════════════
   FILTER LOGIC
══════════════════════════════════════════════════════════════════════════ */
export function computePassingNames(treeState) {
  if (!treeState?._leaves || _filters.length === 0) return null;
  const passing = new Set();
  for (const leaf of treeState._leaves) {
    const row = state.currentMeta?.get(leaf.data.name.trim());
    if (_filters.every(f => _passes(row, f))) passing.add(leaf.data.name);
  }
  return passing;
}

function _passes(row, f) {
  if (f.type === 'numeric') {
    const v = row ? +row[f.col] : NaN;
    return !isNaN(v) && v >= f.min && v <= f.max;
  }
  const v = row ? row[f.col] : undefined;
  return f.values.has(v);
}

/* ══════════════════════════════════════════════════════════════════════════
   MUTATION HELPERS
══════════════════════════════════════════════════════════════════════════ */
function _addFilter(col) {
  if (_filters.find(f => f.col === col) || !state.currentMeta) return;
  const vals = [...state.currentMeta.values()].map(r => r[col]).filter(v => v !== undefined && v !== '');
  const isNum = vals.length > 0 && vals.every(v => !isNaN(+v));
  if (isNum) {
    const nums = vals.map(Number);
    const dMin = Math.min(...nums), dMax = Math.max(...nums);
    _filters.push({ col, type: 'numeric', min: dMin, max: dMax, dataMin: dMin, dataMax: dMax });
  } else {
    const unique = [...new Set(vals)].sort();
    _filters.push({ col, type: 'categorical', values: new Set(unique), allValues: unique });
  }
  _render();
}

function _removeFilter(f) {
  _filters = _filters.filter(x => x !== f);
  _render();
  _onChange?.(true);
}

function _clearAll() {
  _filters = [];
  _render();
  _onChange?.(true);
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL INIT & RE-RENDER
══════════════════════════════════════════════════════════════════════════ */
export function initFilterPanel() {
  const inner = document.getElementById('filter-inner');
  if (!inner) return;
  _render();

  // Toggle open/closed
  document.getElementById('filter-toggle-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('filter-panel');
    const isOpen = panel.classList.toggle('fp-open');
    _updateToggleBtn(isOpen);
  });
}

export function refreshFilterOptions() {
  // Called after metadata loads; rebuilds the "add filter" select options.
  _render();
}

function _updateToggleBtn(open) {
  const btn = document.getElementById('filter-toggle-btn');
  if (!btn) return;
  const n = _filters.length;
  btn.innerHTML =
    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>` +
    ` Filter` +
    (n > 0 ? ` <span class="filter-badge">${n}</span>` : '');
  btn.classList.toggle('fp-active', n > 0);
}

function _render() {
  const inner = document.getElementById('filter-inner');
  if (!inner) return;
  inner.innerHTML = '';

  _filters.forEach(f => inner.appendChild(_buildItem(f)));

  // ── Add-filter row ────────────────────────────────────────────────────────
  const addRow = _el('div', 'fp-add-row');
  const sel = _el('select', 'fp-col-select');
  sel.appendChild(_opt('', '+ Add filter…'));
  (state.metaCols || [])
    .filter(col => !_filters.find(f => f.col === col))
    .forEach(col => sel.appendChild(_opt(col, col)));
  sel.addEventListener('change', () => { if (sel.value) { _addFilter(sel.value); sel.value = ''; } });
  addRow.appendChild(sel);
  inner.appendChild(addRow);

  // ── Action row ────────────────────────────────────────────────────────────
  if (_filters.length > 0) {
    const actions = _el('div', 'fp-actions');

    // Global live-update checkbox
    const liveLbl = _el('label', 'fp-live-lbl');
    const liveChk = Object.assign(document.createElement('input'), { type: 'checkbox', checked: _live });
    liveChk.addEventListener('change', () => { _live = liveChk.checked; if (_live) _onChange?.(true); });
    liveLbl.append(liveChk, document.createTextNode(' Live'));
    actions.appendChild(liveLbl);

    const clearBtn = _btn('Clear', 'fp-btn fp-btn-ghost');
    clearBtn.addEventListener('click', _clearAll);

    const applyBtn = _btn('Apply', 'fp-btn fp-btn-primary');
    applyBtn.addEventListener('click', () => _onChange?.(true));

    actions.append(clearBtn, applyBtn);
    inner.appendChild(actions);
  }

  _updateToggleBtn(document.getElementById('filter-panel')?.classList.contains('fp-open'));
}

/* ══════════════════════════════════════════════════════════════════════════
   FILTER ITEM BUILDERS
══════════════════════════════════════════════════════════════════════════ */
function _buildItem(f) {
  const item = _el('div', 'fp-filter-item');

  // Header: label + remove
  const hdr = _el('div', 'fp-item-hdr');
  hdr.appendChild(Object.assign(_el('span', 'fp-item-lbl'), { textContent: f.col }));
  const rm = Object.assign(_btn('×', 'fp-remove'), { title: 'Remove filter' });
  rm.addEventListener('click', () => _removeFilter(f));
  hdr.appendChild(rm);
  item.appendChild(hdr);

  item.appendChild(f.type === 'numeric' ? _buildNumeric(f) : _buildCategorical(f));
  return item;
}

function _buildNumeric(f) {
  const fmt  = d3.format('.4g');
  const span = f.dataMax - f.dataMin || 1;
  const wrap = _el('div', 'fp-numeric');

  // Current range display
  const valRow  = _el('div', 'fp-val-row');
  const minSpan = Object.assign(_el('span', 'fp-val'), { textContent: fmt(f.min) });
  const maxSpan = Object.assign(_el('span', 'fp-val'), { textContent: fmt(f.max) });
  valRow.append(minSpan, Object.assign(_el('span'), { textContent: '–' }), maxSpan);

  // Dual range slider
  const track = _el('div', 'fp-slider-track');

  const minS = _rangeInput(Math.round((f.min - f.dataMin) / span * 1000));
  const maxS = _rangeInput(Math.round((f.max - f.dataMin) / span * 1000));
  minS.classList.add('fp-slider-min');
  maxS.classList.add('fp-slider-max');

  function sync() {
    let lo = +minS.value, hi = +maxS.value;
    if (lo > hi) { const t = lo; lo = hi; hi = t; minS.value = lo; maxS.value = hi; }
    f.min = f.dataMin + lo / 1000 * span;
    f.max = f.dataMin + hi / 1000 * span;
    minSpan.textContent = fmt(f.min);
    maxSpan.textContent = fmt(f.max);
    track.style.setProperty('--lo', (lo / 10) + '%');
    track.style.setProperty('--hi', (hi / 10) + '%');
    if (_live) _onChange?.(true);
  }

  minS.addEventListener('input', sync);
  maxS.addEventListener('input', sync);
  track.style.setProperty('--lo', (Math.round((f.min - f.dataMin) / span * 1000) / 10) + '%');
  track.style.setProperty('--hi', (Math.round((f.max - f.dataMin) / span * 1000) / 10) + '%');

  track.append(minS, maxS);
  wrap.append(valRow, track);
  return wrap;
}

function _buildCategorical(f) {
  const wrap = _el('div', 'fp-categorical');
  f.allValues.forEach(val => {
    const lbl = _el('label', 'fp-cat-item');
    const chk = Object.assign(document.createElement('input'), { type: 'checkbox', checked: f.values.has(val) });
    chk.addEventListener('change', () => {
      if (chk.checked) f.values.add(val); else f.values.delete(val);
      if (_live) _onChange?.(true);
    });
    lbl.appendChild(chk);
    // Color swatch if column matches active color
    if (state.colorScale && state.currentColorCol === f.col &&
        typeof state.colorScale.domain()[0] === 'string') {
      const sw = _el('span', 'fp-swatch');
      sw.style.background = state.colorScale(val);
      lbl.appendChild(sw);
    }
    lbl.append(document.createTextNode(' ' + val));
    wrap.appendChild(lbl);
  });
  return wrap;
}

/* ══════════════════════════════════════════════════════════════════════════
   TINY DOM HELPERS
══════════════════════════════════════════════════════════════════════════ */
function _el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function _btn(text, cls) {
  const b = _el('button', cls);
  b.textContent = text;
  return b;
}
function _opt(val, text) {
  return Object.assign(document.createElement('option'), { value: val, textContent: text });
}
function _rangeInput(val) {
  return Object.assign(document.createElement('input'), {
    type: 'range', min: 0, max: 1000, step: 1, value: val, className: 'fp-slider',
  });
}
