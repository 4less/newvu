import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';

/* ══════════════════════════════════════════════════════════════════════════
   FILTER STATE
══════════════════════════════════════════════════════════════════════════ */
let _filters  = [];    // [{col, type, min, max, dataMin, dataMax, values, allValues}]
let _live     = true;  // global live-update toggle — re-layout on every change
let _onChange = null;  // (applyNow: bool) => void — wired by main.js

export function setFilterOnChange(fn) { _onChange = fn; }
export function getFilters()          { return _filters; }
export function hasActiveFilters()    { return _filters.length > 0; }

/* ══════════════════════════════════════════════════════════════════════════
   FILTER LOGIC
══════════════════════════════════════════════════════════════════════════ */
export function computePassingNames(treeState) {
  // Always evaluate against the FULL leaf set (`_allLeafNames`), never the
  // currently drawn one — the drawn tree is pruned, so filtering it again
  // would make every change irreversible.
  const all = treeState?._allLeafNames
           ?? (treeState?._leaves || []).map(l => l.data.name);
  if (all.length === 0 || _filters.length === 0) return null;
  const passing = new Set();
  for (const name of all) {
    const row = state.currentMeta?.get(name.trim());
    if (_filters.every(f => _passes(row, f))) passing.add(name);
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

  // Toggle open/closed — the canvas controls slide aside with the card so the
  // filter button stays reachable.
  const setOpen = open => {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    panel.classList.toggle('fp-open', open);
    panel.parentElement?.classList.toggle('fp-shifted', open);
    _updateToggleBtn(open);
  };

  document.getElementById('filter-toggle-btn')?.addEventListener('click', () => {
    setOpen(!document.getElementById('filter-panel')?.classList.contains('fp-open'));
  });
  document.getElementById('filter-close')?.addEventListener('click', () => setOpen(false));
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
    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>` +
    (n > 0 ? `<span class="filter-badge">${n}</span>` : '');
  btn.classList.toggle('fp-active', n > 0 || !!open);
  btn.title = (open ? 'Hide' : 'Show') + ' filters' + (n > 0 ? ` (${n} active)` : '');
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
  const pos  = v => Math.round((v - f.dataMin) / span * 1000);   // value → slider step
  const wrap = _el('div', 'fp-numeric');

  // Editable min / max fields — interchangeable with the slider below
  const valRow = _el('div', 'fp-val-row');
  const minInp = _numInput(f, fmt(f.min));
  const maxInp = _numInput(f, fmt(f.max));
  valRow.append(minInp, Object.assign(_el('span', 'fp-val-dash'), { textContent: '–' }), maxInp);

  // Dual range slider
  const track = _el('div', 'fp-slider-track');
  const minS  = _rangeInput(pos(f.min));
  const maxS  = _rangeInput(pos(f.max));
  minS.classList.add('fp-slider-min');
  maxS.classList.add('fp-slider-max');

  // Reflect f.min / f.max into every control. `typing` skips the field the
  // user is editing so their text isn't reformatted mid-entry.
  function paint(typing = false) {
    minS.value = pos(f.min);
    maxS.value = pos(f.max);
    track.style.setProperty('--lo', (pos(f.min) / 10) + '%');
    track.style.setProperty('--hi', (pos(f.max) / 10) + '%');
    if (!typing) { minInp.value = fmt(f.min); maxInp.value = fmt(f.max); }
  }

  function fromSliders() {
    let lo = +minS.value, hi = +maxS.value;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    f.min = f.dataMin + lo / 1000 * span;
    f.max = f.dataMin + hi / 1000 * span;
    paint();
    if (_live) _onChange?.(true);
  }

  function fromFields() {
    const clamp = v => Math.min(f.dataMax, Math.max(f.dataMin, v));
    let lo = parseFloat(minInp.value), hi = parseFloat(maxInp.value);
    lo = isNaN(lo) ? f.min : clamp(lo);
    hi = isNaN(hi) ? f.max : clamp(hi);
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    f.min = lo;
    f.max = hi;
    paint(true);
    if (_live) _onChange?.(true);
  }

  minS.addEventListener('input', fromSliders);
  maxS.addEventListener('input', fromSliders);
  // `change` fires on Enter / blur — not on every keystroke.
  minInp.addEventListener('change', fromFields);
  maxInp.addEventListener('change', fromFields);
  minInp.addEventListener('blur', () => paint());
  maxInp.addEventListener('blur', () => paint());

  paint();
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
function _numInput(f, val) {
  const span = f.dataMax - f.dataMin || 1;
  return Object.assign(document.createElement('input'), {
    type: 'number',
    className: 'fp-num',
    step: (span / 100).toPrecision(2),
    min: f.dataMin,
    max: f.dataMax,
    value: val,
    title: `${d3.format('.4g')(f.dataMin)} – ${d3.format('.4g')(f.dataMax)}`,
  });
}
function _rangeInput(val) {
  return Object.assign(document.createElement('input'), {
    type: 'range', min: 0, max: 1000, step: 1, value: val, className: 'fp-slider',
  });
}
