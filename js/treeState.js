/**
 * Per-tree mutable state.
 * One instance per visible tree panel; shared (metadata, colour, shape, label)
 * lives in state.js.
 */
export function createTreeState() {
  return {
    originalData:    null,   // parsed Newick, never re-rooted
    currentData:     null,   // displayed tree (may be midpoint-rooted)
    originalNewick:  null,   // raw Newick string (for share / export)
    zoomTransform:   null,   // preserved d3.ZoomTransform across redraws
    circularLayout:  false,
    treeWidthDelta:  0,      // cumulative px from +/- width buttons
    selectedNames:      new Set(),
    filteredLeafNames:  null,  // Set<name> of tips that pass current filters; null = no filter
    _tipG:           null,   // live d3 selection of tip <g> elements
    _leaves:         null,   // live array of hierarchy leaf nodes (of the PRUNED tree)
    _allLeafNames:   null,   // every leaf name of the unfiltered tree
  };
}
