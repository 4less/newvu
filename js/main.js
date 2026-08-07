import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { createTreeState } from './treeState.js';
import { parseNewick, buildHierarchy, midpointRoot } from './newick.js';
import { loadMeta, rebuildColorScale, rebuildShapeScale } from './meta.js';
import { draw } from './render.js';
import { drawPlotPanel } from './plotPanel.js';
import { buildShareUrl, loadFromUrl } from './share.js';
import { exportZip, exportSvg } from './export.js';
import { initFilterPanel, refreshFilterOptions, computePassingNames, setFilterOnChange } from './filter.js';

/* ══════════════════════════════════════════════════════════════════════════
   DEFAULT DATA
══════════════════════════════════════════════════════════════════════════ */
const DEFAULT_NEWICK = `(s_oseburia_inulinivorans_reference:0.0000011094,((((((((((((sample_100:0.0000011194,((((((sample_35:0.0000011194,sample_51:0.0000011194):0.0000011148,sample_9:0.0000011194):0.0000011173,sample_73:0.0000011156):0.0000011075,(sample_64:0.0000011194,sample_92:0.0000011194):0.0000011025):0.0000011045,sample_36:0.0000011194):0.0000010991,sample_66:0.0000011194):0.0000011042):0.0000010936,sample_83:0.0000011125):0.0000011142,sample_67:0.0000011194):0.0000011142,sample_26:0.0000011194):0.0115890761,((((((sample_10:0.0000011194,((((sample_20:0.0000011194,sample_82:0.0000011124):0.0000010942,((sample_50:0.0000011135,sample_97:0.0000010991):0.0000010910,sample_5:0.0000011194):0.0000010792):0.0000010792,sample_43:0.0000011194):0.0000019793,sample_22:0.0000011194):0.0000016374):0.0067601151,((((((sample_32:0.0000011025,sample_96:0.0000011194):0.0000010818,(sample_48:0.0000011194,(sample_76:0.0000011194,sample_6:0.0000011194):0.0000010787):0.0000010754):0.0000010867,(sample_80:0.0000011194,sample_29:0.0000011194):0.0000010951):0.0000010911,sample_4:0.0000011194):0.0000010810,sample_53:0.0000011194):0.0000013558,sample_1:0.0000011194):0.0062929052):0.0040352210,(((sample_27:0.0000011194,(sample_54:0.0000011169,sample_62:0.0000019299):0.0000019129):0.0000018380,sample_90:0.0000011137):0.0000015754,sample_89:0.0000011194):0.0142478012):0.0016219683,(((((sample_40:0.0000011148,sample_57:0.0000011026):0.0000010891,(sample_23:0.0000011154,sample_56:0.0000011194):0.0000010810):0.0000010937,sample_17:0.0000011194):0.0000016248,sample_98:0.0000011194):0.0000017841,sample_55:0.0000011194):0.0102794744):0.0017027585,(((sample_11:0.0000011194,(((sample_30:0.0000011194,sample_47:0.0000011194):0.0000011120,(sample_33:0.0000011149,sample_65:0.0000011121):0.0000011062):0.0000010977,sample_24:0.0000011141):0.0000010924):0.0000011013,sample_49:0.0000011194):0.0082524421,((sample_19:0.0000011194,((((((sample_41:0.0000011194,sample_84:0.0000011129):0.0000010765,sample_61:0.0000011135):0.0000010730,sample_78:0.0000010859):0.0000011012,sample_99:0.0000011171):0.0000014940,sample_87:0.0000011194):0.0000014942,sample_46:0.0000011194):0.0000014937):0.0000014948,sample_45:0.0000011194):0.0111329347):0.0038405785):0.0017580993,(((((((sample_13:0.0000011128,((sample_18:0.0000011194,sample_37:0.0000011124):0.0000018185,sample_8:0.0000011194):0.0000018150):0.0000011075,sample_74:0.0000011194):0.0000018117,sample_77:0.0000011139):0.0000018135,sample_25:0.0000011194):0.0197597010,(sample_60:0.0000011101,(sample_71:0.0000011138,(sample_88:0.0000011016,sample_94:0.0000011194):0.0000010905):0.0000010985):0.0192757385):0.0063994663,((((((sample_21:0.0000011129,(sample_42:0.0000014138,sample_59:0.0000011030):0.0000010899):0.0000013969,sample_2:0.0000011126):0.0000013867,sample_68:0.0000011194):0.0000013781,(sample_63:0.0000011194,sample_85:0.0000011128):0.0000013761):0.0000013830,sample_34:0.0000011194):0.0000016978,sample_69:0.0000011194):0.0091611355):0.0027335571,(((sample_3:0.0000011194,((sample_72:0.0000011144,sample_75:0.0000011006):0.0000010891,sample_91:0.0000011194):0.0000010851):0.0000010656,sample_52:0.0000011101):0.0000010768,sample_86:0.0000011194):0.0118558417):0.0010433560):0.0023183234):0.0094726826,(sample_12:0.0000011128,((((sample_28:0.0000011065,sample_93:0.0000011194):0.0000011015,sample_38:0.0000011194):0.0000011067,sample_31:0.0000011194):0.0000011067,sample_79:0.0000011194):0.0000011071):0.0000082871):0.0000029664,sample_81:0.0000011194):0.0000010876,sample_7:0.0000011176):0.0000010890,sample_95:0.0000011194):0.0000010971,sample_16:0.0000011194):0.0000010000,sample_70:0.0000011194):0.0000015646,sample_14:0.0000011194):0.0000086807,(sample_39:0.0000011194,sample_44:0.0000011194):0.0000011094);`;

const DEFAULT_META_TSV = `ID	genome	species	coverage
sample_1	GCF_040095515.1	Roseburia inulinivorans	5.25596
sample_10	GCF_018784035.1	Roseburia inulinivorans	5.00002
sample_100	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_11	GCF_040095095.1	Roseburia inulinivorans	5.39254
sample_12	GCF_020731525.1	Roseburia inulinivorans	8.0637
sample_13	GCF_003470885.1	Roseburia inulinivorans	8.01024
sample_14	GCF_000174195.1	Roseburia inulinivorans	5.00005
sample_15	GCF_020731525.1	Roseburia inulinivorans	5.1421
sample_16	GCF_000174195.1	Roseburia inulinivorans	5.00005
sample_17	GCF_001406855.1	Roseburia inulinivorans	5.00002
sample_18	GCF_003470885.1	Roseburia inulinivorans	12.4695
sample_19	GCF_003458535.1	Roseburia inulinivorans	5.00008
sample_2	GCF_003470035.1	Roseburia inulinivorans	9.31562
sample_20	GCF_018784035.1	Roseburia inulinivorans	5.00002
sample_21	GCF_003470035.1	Roseburia inulinivorans	5.00004
sample_22	GCF_018784035.1	Roseburia inulinivorans	5.0001
sample_23	GCF_001406855.1	Roseburia inulinivorans	5.00002
sample_24	GCF_040095095.1	Roseburia inulinivorans	5.00002
sample_25	GCF_003470885.1	Roseburia inulinivorans	5.20273
sample_26	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_27	GCF_003468625.1	Roseburia inulinivorans	8.62623
sample_28	GCF_020731525.1	Roseburia inulinivorans	17.6316
sample_29	GCF_040095515.1	Roseburia inulinivorans	5.00003
sample_3	GCF_003467265.1	Roseburia inulinivorans	7.8536
sample_30	GCF_040095095.1	Roseburia inulinivorans	5.00002
sample_31	GCF_020731525.1	Roseburia inulinivorans	5.00004
sample_32	GCF_040095515.1	Roseburia inulinivorans	50.8091
sample_33	GCF_040095095.1	Roseburia inulinivorans	19.9382
sample_34	GCF_003470035.1	Roseburia inulinivorans	5.32951
sample_35	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_36	GCF_003457795.1	Roseburia inulinivorans	5.94468
sample_37	GCF_003470885.1	Roseburia inulinivorans	22.2744
sample_38	GCF_020731525.1	Roseburia inulinivorans	7.30648
sample_39	GCF_000174195.1	Roseburia inulinivorans	15.5189
sample_4	GCF_040095515.1	Roseburia inulinivorans	6.09538
sample_40	GCF_001406855.1	Roseburia inulinivorans	7.25474
sample_41	GCF_003458535.1	Roseburia inulinivorans	5.00008
sample_42	GCF_003470035.1	Roseburia inulinivorans	5.00012
sample_43	GCF_018784035.1	Roseburia inulinivorans	5.00002
sample_44	GCF_000174195.1	Roseburia inulinivorans	47.3626
sample_45	GCF_003458535.1	Roseburia inulinivorans	5.00008
sample_46	GCF_003458535.1	Roseburia inulinivorans	8.22697
sample_47	GCF_040095095.1	Roseburia inulinivorans	5.47423
sample_48	GCF_040095515.1	Roseburia inulinivorans	4.99996
sample_49	GCF_040095095.1	Roseburia inulinivorans	5.00002
sample_5	GCF_018784035.1	Roseburia inulinivorans	15.9471
sample_50	GCF_018784035.1	Roseburia inulinivorans	56.7887
sample_51	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_52	GCF_003467265.1	Roseburia inulinivorans	5.00004
sample_53	GCF_040095515.1	Roseburia inulinivorans	5.00003
sample_54	GCF_003468625.1	Roseburia inulinivorans	5.00008
sample_55	GCF_001406855.1	Roseburia inulinivorans	5.0001
sample_56	GCF_001406855.1	Roseburia inulinivorans	5.0001
sample_57	GCF_001406855.1	Roseburia inulinivorans	25.1556
sample_58	GCF_018784035.1	Roseburia inulinivorans	12.2919
sample_59	GCF_003470035.1	Roseburia inulinivorans	5.00004
sample_6	GCF_040095515.1	Roseburia inulinivorans	5.00003
sample_60	GCA_004562005.1	Roseburia inulinivorans	5.00001
sample_61	GCF_003458535.1	Roseburia inulinivorans	5.00008
sample_62	GCF_003468625.1	Roseburia inulinivorans	5.00008
sample_63	GCF_003470035.1	Roseburia inulinivorans	4.92596
sample_64	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_65	GCF_040095095.1	Roseburia inulinivorans	10.3575
sample_66	GCF_003457795.1	Roseburia inulinivorans	6.24584
sample_67	GCF_003457795.1	Roseburia inulinivorans	4.99987
sample_68	GCF_003470035.1	Roseburia inulinivorans	10.9395
sample_69	GCF_003470035.1	Roseburia inulinivorans	5.00004
sample_7	GCF_000174195.1	Roseburia inulinivorans	5.24118
sample_70	GCF_000174195.1	Roseburia inulinivorans	5.00005
sample_71	GCA_004562005.1	Roseburia inulinivorans	5.00001
sample_72	GCF_003467265.1	Roseburia inulinivorans	16.3278
sample_73	GCF_003457795.1	Roseburia inulinivorans	44.0452
sample_74	GCF_003470885.1	Roseburia inulinivorans	5.00001
sample_75	GCF_003467265.1	Roseburia inulinivorans	23.7556
sample_76	GCF_040095515.1	Roseburia inulinivorans	5.00003
sample_77	GCF_003470885.1	Roseburia inulinivorans	5.00001
sample_78	GCF_003458535.1	Roseburia inulinivorans	10.7045
sample_79	GCF_020731525.1	Roseburia inulinivorans	5.00004
sample_8	GCF_003470885.1	Roseburia inulinivorans	9.83367
sample_80	GCF_040095515.1	Roseburia inulinivorans	4.99996
sample_81	GCF_000174195.1	Roseburia inulinivorans	5.00005
sample_82	GCF_018784035.1	Roseburia inulinivorans	5.00002
sample_83	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_84	GCF_003458535.1	Roseburia inulinivorans	5.00008
sample_85	GCF_003470035.1	Roseburia inulinivorans	5.00004
sample_86	GCF_003467265.1	Roseburia inulinivorans	5.00004
sample_87	GCF_003458535.1	Roseburia inulinivorans	17.6119
sample_88	GCA_004562005.1	Roseburia inulinivorans	7.35772
sample_89	GCF_003468625.1	Roseburia inulinivorans	5.00008
sample_9	GCF_003457795.1	Roseburia inulinivorans	5.34036
sample_90	GCF_003468625.1	Roseburia inulinivorans	5.00008
sample_91	GCF_003467265.1	Roseburia inulinivorans	9.43939
sample_92	GCF_003457795.1	Roseburia inulinivorans	5.00003
sample_93	GCF_020731525.1	Roseburia inulinivorans	8.71008
sample_94	GCA_004562005.1	Roseburia inulinivorans	24.9596
sample_95	GCF_000174195.1	Roseburia inulinivorans	5.00005
sample_96	GCF_040095515.1	Roseburia inulinivorans	22.964
sample_97	GCF_018784035.1	Roseburia inulinivorans	17.0822
sample_98	GCF_001406855.1	Roseburia inulinivorans	5.83405
sample_99	GCF_003458535.1	Roseburia inulinivorans	12.5845`;

/* ══════════════════════════════════════════════════════════════════════════
   TREE INSTANCES
══════════════════════════════════════════════════════════════════════════ */
const tree1 = createTreeState();
const tree2 = createTreeState();
state.activeTree    = tree1;
state.primaryTree   = tree1; // the plot panel always reflects the left (primary) tree
state.secondaryTree = tree2; // comparison tree for pairwise distance scatter plot

/* ══════════════════════════════════════════════════════════════════════════
   TREE-2 SELECTION SYNC
   When tips are selected in tree 1, automatically select every tip in tree 2
   whose name matches the colour-column value (e.g. genome accession) of a
   selected tree-1 tip.  One-directional: tree 1 → tree 2.
══════════════════════════════════════════════════════════════════════════ */
function syncTree2Selection() {
  const panel = document.getElementById('tree2-panel');
  if (panel.classList.contains('hidden') || !tree2._leaves) return;

  // Collect colour-column values (e.g. genome accessions) for each selected tree-1 tip.
  const targets = new Set();
  for (const name of tree1.selectedNames) {
    const key = name.trim();
    const row = state.currentMeta?.get(key);
    if (row && state.currentColorCol) {
      const v = row[state.currentColorCol];
      if (v) targets.add(v.trim());
    } else if (state.colorScale &&
               typeof state.colorScale.domain()[0] === 'string' &&
               state.colorScale.domain().includes(key)) {
      // Tree-1 tip name is itself a colour-domain value — use it directly.
      targets.add(key);
    }
  }

  // Rebuild tree-2 selection: select every leaf whose name (or whose metadata
  // colour-column value) matches one of the collected genome identifiers.
  tree2.selectedNames.clear();
  if (targets.size > 0) {
    for (const leaf of tree2._leaves) {
      const n = leaf.data.name.trim();
      if (targets.has(n)) {
        tree2.selectedNames.add(leaf.data.name);
        continue;
      }
      // Fallback: tree-2 tips are sample IDs — look up their genome.
      const row = state.currentMeta?.get(n);
      if (row && state.currentColorCol) {
        const v = row[state.currentColorCol];
        if (v && targets.has(v.trim())) tree2.selectedNames.add(leaf.data.name);
      }
    }
  }

  // Update tree-2 visual state without a full redraw.
  if (tree2._tipG) {
    tree2._tipG.classed('selected', d => tree2.selectedNames.has(d.data.name));
  }
}

state.onPrimarySelectionChange = syncTree2Selection;

/* ══════════════════════════════════════════════════════════════════════════
   FILTER APPLICATION
   Computes passing names for tree1, syncs tree2 to matching genomes, redraws.
══════════════════════════════════════════════════════════════════════════ */
function applyFilters(andRedraw = true) {
  const passing = computePassingNames(tree1);
  tree1.filteredLeafNames = passing;

  // Tree2: retain only genomes represented by at least one passing tree1 tip.
  if (passing !== null && tree2._leaves && tree2._leaves.length > 0) {
    const genomes = new Set();
    for (const name of passing) {
      const genome = state.currentMeta?.get(name.trim())?.[state.currentColorCol]?.trim();
      if (genome) genomes.add(genome);
    }
    if (genomes.size > 0) {
      tree2.filteredLeafNames = new Set(
        tree2._leaves.map(l => l.data.name).filter(n => {
          const t = n.trim();
          if (genomes.has(t)) return true;
          // also try stripping trailing version suffix (e.g. .1)
          const noV = t.replace(/\.\d+$/, '');
          return [...genomes].some(g => g.replace(/\.\d+$/, '') === noV);
        })
      );
      if (tree2.filteredLeafNames.size === 0) tree2.filteredLeafNames = null;
    } else {
      tree2.filteredLeafNames = null;
    }
  } else {
    tree2.filteredLeafNames = null;
  }

  if (andRedraw) { drawAll(); drawPlotPanel(); }
}

setFilterOnChange(applyFilters);

/* ── Draw helpers ─────────────────────────────────────────────────────── */
function drawTree1() {
  if (tree1.currentData) draw(tree1, 'tree');
}
function drawTree2() {
  if (tree2.currentData && !document.getElementById('tree2-panel').classList.contains('hidden'))
    draw(tree2, 'tree2');
}
function drawAll() { drawTree1(); drawTree2(); }

/* ── Compare panel helpers ────────────────────────────────────────────── */
function showTree2() {
  document.getElementById('tree2-panel').classList.remove('hidden');
  document.getElementById('compare-btn').textContent = '− Compare';
  if (tree2.currentData) drawTree2();
}
function hideTree2() {
  document.getElementById('tree2-panel').classList.add('hidden');
  document.getElementById('compare-btn').textContent = '+ Compare';
}

/* ══════════════════════════════════════════════════════════════════════════
   SPLIT PANEL  (plot sidebar)
══════════════════════════════════════════════════════════════════════════ */
const DEFAULT_PANEL_W = 300;
let leftPanelW = 0;

function setLeftPanelWidth(w) {
  leftPanelW = Math.max(0, w);
  document.getElementById('left-panel').style.width = leftPanelW + 'px';
  document.getElementById('toggle-btn').textContent = leftPanelW > 10 ? '▶' : '◀';
  drawPlotPanel();
}

document.getElementById('toggle-btn').addEventListener('click', () => {
  setLeftPanelWidth(leftPanelW > 10 ? 0 : DEFAULT_PANEL_W);
});

(function () {
  const divider = document.getElementById('divider');
  let dragging = false, startX = 0, startW = 0;
  divider.addEventListener('mousedown', e => {
    if (e.target.id === 'toggle-btn') return;
    dragging = true; startX = e.clientX; startW = leftPanelW;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    setLeftPanelWidth(startW - (e.clientX - startX));
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

/* ══════════════════════════════════════════════════════════════════════════
   FILE UPLOADS
══════════════════════════════════════════════════════════════════════════ */
function loadNewickFile(file, ts, titleId, midpointId) {
  const reader = new FileReader();
  reader.onload = e => {
    ts.originalNewick = e.target.result.trim();
    ts.originalData   = parseNewick(ts.originalNewick);
    ts.currentData    = ts.originalData;
    ts.zoomTransform  = null;
    d3.select(`#${titleId}`).text(file.name.replace(/\.[^.]+$/, ''));
    d3.select(`#${midpointId}`).property('checked', false);
    if (ts === tree1) drawTree1(); else drawTree2();
  };
  reader.readAsText(file);
}

d3.select('#nwk-upload').on('change', function() {
  const f = this.files[0]; if (!f) return;
  loadNewickFile(f, tree1, 'title', 'midpoint-chk');
});
d3.select('#nwk-upload2').on('change', function() {
  const f = this.files[0]; if (!f) return;
  loadNewickFile(f, tree2, 'title2', 'midpoint-chk2');
});

d3.select('#meta-upload').on('change', function() {
  const f = this.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.rawMeta        = e.target.result;
    state.currentColorCol = null;
    state.currentLabelCol = null;
    state.colorScale      = null;
    state.shapeCol        = null;
    state.shapeScale      = null;
    loadMeta(state.rawMeta);
    refreshFilterOptions();
    drawAll();
  };
  reader.readAsText(f);
});

/* ══════════════════════════════════════════════════════════════════════════
   SHARED CONTROLS (colour, shape, label)
══════════════════════════════════════════════════════════════════════════ */
d3.select('#color-select').on('change', function() {
  state.currentColorCol = this.value || null;
  rebuildColorScale();
  drawAll();
});
d3.select('#shape-select').on('change', function() {
  state.shapeCol = this.value || null;
  rebuildShapeScale();
  drawAll();
});
d3.select('#label-select').on('change', function() {
  state.currentLabelCol = this.value || null;
  drawAll();
});

/* ══════════════════════════════════════════════════════════════════════════
   PER-TREE CONTROLS
══════════════════════════════════════════════════════════════════════════ */
function bindTreeControls(ts, ids, drawFn) {
  const { midpoint, circular } = ids;
  d3.select(`#${midpoint}`).on('change', function() {
    ts.currentData   = this.checked ? midpointRoot(buildHierarchy(ts.originalData)) : ts.originalData;
    ts.zoomTransform = null;
    drawFn();
  });
  d3.select(`#${circular}`).on('change', function() {
    ts.circularLayout = this.checked;
    ts.zoomTransform  = null;
    drawFn();
  });
}

bindTreeControls(tree1, { midpoint: 'midpoint-chk',  circular: 'circular-chk'  }, drawTree1);
bindTreeControls(tree2, { midpoint: 'midpoint-chk2', circular: 'circular-chk2' }, drawTree2);

/* ══════════════════════════════════════════════════════════════════════════
   COMPARE BUTTON
══════════════════════════════════════════════════════════════════════════ */
document.getElementById('compare-btn').addEventListener('click', () => {
  document.getElementById('tree2-panel').classList.contains('hidden')
    ? showTree2() : hideTree2();
});
document.getElementById('close-compare-btn').addEventListener('click', hideTree2);

/* ══════════════════════════════════════════════════════════════════════════
   PLOT PANEL
══════════════════════════════════════════════════════════════════════════ */
d3.select('#plot-select').on('change', function() {
  state.plotCol = this.value || null;
  drawPlotPanel();
});

/* ══════════════════════════════════════════════════════════════════════════
   TOOLBOX
══════════════════════════════════════════════════════════════════════════ */
['pan', 'select', 'zoomrect'].forEach(tool => {
  document.getElementById(`tool-${tool}`).addEventListener('click', () => {
    state.activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tool-${tool}`).classList.add('active');
    drawAll();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   FONT & TIP SIZE
══════════════════════════════════════════════════════════════════════════ */
(function () {
  const valEl = document.getElementById('font-size-val');

  function setFontSize(px) {
    state.tipFontSize = Math.min(24, Math.max(4, px));
    valEl.textContent = state.tipFontSize;
    drawAll();
  }

  function setTipSize(delta) {
    state.tipSize = Math.min(256, Math.max(6, state.tipSize + delta));
    drawAll();
  }

  document.getElementById('font-minus').addEventListener('click', () => setFontSize(state.tipFontSize - 1));
  document.getElementById('font-plus') .addEventListener('click', () => setFontSize(state.tipFontSize + 1));
  document.getElementById('tip-minus') .addEventListener('click', () => setTipSize(-16));
  document.getElementById('tip-plus')  .addEventListener('click', () => setTipSize(+16));
})();

/* ══════════════════════════════════════════════════════════════════════════
   EXPORT & SHARE
══════════════════════════════════════════════════════════════════════════ */
document.getElementById('export-btn').addEventListener('click', () => exportZip(tree1, tree2));

document.getElementById('svg-export1').addEventListener('click', () => {
  const name = (document.getElementById('title')?.textContent?.trim() || 'tree1').replace(/\s+/g, '_');
  exportSvg('tree', `${name}.svg`);
});
document.getElementById('svg-export2').addEventListener('click', () => {
  const name = (document.getElementById('title2')?.textContent?.trim() || 'tree2').replace(/\s+/g, '_');
  exportSvg('tree2', `${name}.svg`);
});

document.getElementById('share-btn').addEventListener('click', async () => {
  const url = buildShareUrl(tree1, tree2);
  await navigator.clipboard.writeText(url);
  const btn = document.getElementById('share-btn');
  const prev = btn.textContent;
  btn.textContent = 'Copied!';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
});

/* ══════════════════════════════════════════════════════════════════════════
   CTRL KEY CURSOR
══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'Control' && state.activeTool !== 'pan')
    d3.selectAll('.tree-canvas svg').classed('panning', true);
});
document.addEventListener('keyup', e => {
  if (e.key === 'Control') d3.selectAll('.tree-canvas svg').classed('panning', false);
});

/* ══════════════════════════════════════════════════════════════════════════
   INITIAL RENDER
══════════════════════════════════════════════════════════════════════════ */
const shared = loadFromUrl();
if (shared) {
  tree1.originalNewick = shared.nwk;
  tree1.originalData   = parseNewick(shared.nwk);
  tree1.currentData    = tree1.originalData;
  if (shared.title) d3.select('#title').text(shared.title);
  if (shared.meta) {
    state.rawMeta = shared.meta;
    loadMeta(shared.meta, shared.color || null);
    if (shared.label) {
      state.currentLabelCol = shared.label;
      d3.select('#label-select').property('value', shared.label);
    }
  }
  if (shared.nwk2) {
    tree2.originalNewick = shared.nwk2;
    tree2.originalData   = parseNewick(shared.nwk2);
    tree2.currentData    = tree2.originalData;
    if (shared.title2) d3.select('#title2').text(shared.title2);
    showTree2();
  }
} else {
  tree1.originalNewick = DEFAULT_NEWICK;
  tree1.originalData   = parseNewick(DEFAULT_NEWICK);
  tree1.currentData    = tree1.originalData;
  state.rawMeta        = DEFAULT_META_TSV;
  loadMeta(DEFAULT_META_TSV, 'genome');
}

drawTree1();
initFilterPanel();
refreshFilterOptions();

/* ── Resize observers ─────────────────────────────────────────────────── */
let _raf1 = false, _raf2 = false;
new ResizeObserver(() => {
  if (_raf1) return; _raf1 = true;
  requestAnimationFrame(() => { _raf1 = false; drawTree1(); });
}).observe(document.getElementById('tree'));

new ResizeObserver(() => {
  if (_raf2) return; _raf2 = true;
  requestAnimationFrame(() => { _raf2 = false; drawTree2(); });
}).observe(document.getElementById('tree2'));
