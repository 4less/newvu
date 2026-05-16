/**
 * Shared mutable application state.
 * All modules import this object and mutate its properties directly.
 */
export const state = {
  originalData:    null,   // parsed Newick tree (never re-rooted)
  currentData:     null,   // tree currently displayed (may be midpoint-rooted)
  currentMeta:     null,   // Map<tipName, rowObject> from loaded TSV/CSV
  metaCols:        [],     // metadata column names (excluding the key column)
  currentColorCol: null,   // which column drives node/branch colour
  currentLabelCol: null,   // which column replaces tip labels
  colorScale:      null,   // d3 colour scale (ordinal or sequential)
  isLogScale:      false,  // whether the sequential scale uses log spacing
  boxplotCol:      null,   // column (or '__pairwise__') shown in the sidebar
  treeWidthDelta:  0,      // cumulative px adjustment from +/- width buttons
  selectedNames:   new Set(), // Set<string> of currently selected tip names
  _tipG:           null,   // live d3 selection of tip <g> elements (set by draw)
  _leaves:         null,   // live array of hierarchy leaf nodes (set by draw)
};
