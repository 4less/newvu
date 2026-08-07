/**
 * Shared application state — metadata, colour/shape/label scales, active tool.
 * Per-tree state (data, zoom, selection …) lives in treeState.js instances.
 */
export const state = {
  /* ── Metadata (shared across all trees) ───── */
  currentMeta:     null,   // Map<tipName, rowObject>
  metaCols:        [],     // column names (excluding key column)
  currentColorCol: null,
  colorScale:      null,   // d3 ordinal or sequential scale
  isLogScale:      false,
  shapeCol:        null,
  shapeScale:      null,
  currentLabelCol: null,
  rawMeta:         null,   // raw TSV/CSV string (for share / export)

  /* ── Plot sidebar ────────────────────────── */
  plotCol:         null,   // metadata column, '__pairwise__' or '__pairwise_comparison__'

  /* ── Tool ────────────────────────────────── */
  activeTool:      'select', // 'pan' | 'select' | 'zoomrect'

  /* ── Active tree (drives stats bar) ─────── */
  activeTree:      null,   // reference to the currently focused treeState

  /* ── Primary tree (always drives the plot) ─ */
  primaryTree:     null,   // always tree1 — set in main.js

  /* ── Secondary tree (for comparison plots) ─ */
  secondaryTree:   null,   // always tree2 — set in main.js

  /* ── Selection-sync hook ─────────────────── */
  onPrimarySelectionChange: null, // () => void, set in main.js

  /* ── Display sizing (shared across trees) ── */
  tipFontSize: 11,   // px — tip label font size
  tipSize:     64,   // d3 symbol area for tip markers
};
