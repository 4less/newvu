import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { state } from './state.js';
import { parseNewick, buildHierarchy, midpointRoot } from './newick.js';
import { loadMeta, rebuildColorScale } from './meta.js';
import { draw } from './render.js';
import { drawBoxplot } from './boxplot.js';
import { buildShareUrl, loadFromUrl } from './share.js';
import { exportZip } from './export.js';

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
   SPLIT PANEL
══════════════════════════════════════════════════════════════════════════ */
const DEFAULT_PANEL_W = 300;
let leftPanelW = 0;

function setLeftPanelWidth(w) {
  leftPanelW = Math.max(0, w);
  document.getElementById('left-panel').style.width = leftPanelW + 'px';
  document.getElementById('toggle-btn').textContent = leftPanelW > 10 ? '▶' : '◀';
  drawBoxplot();
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
   FILE UPLOADS & CONTROLS
══════════════════════════════════════════════════════════════════════════ */
d3.select('#nwk-upload').on('change', function() {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.originalNewick = e.target.result.trim();
    state.originalData = parseNewick(state.originalNewick);
    d3.select('#title').text(file.name.replace(/\.[^.]+$/, ''));
    d3.select('#midpoint-chk').property('checked', false);
    state.currentData = state.originalData;
    draw(state.currentData);
  };
  reader.readAsText(file);
});

d3.select('#meta-upload').on('change', function() {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    state.rawMeta = e.target.result;
    state.currentColorCol = null;
    state.currentLabelCol = null;
    state.colorScale = null;
    loadMeta(state.rawMeta);
    draw(state.currentData);
  };
  reader.readAsText(file);
});

d3.select('#color-select').on('change', function() {
  state.currentColorCol = this.value || null;
  rebuildColorScale();
  draw(state.currentData);
});

d3.select('#label-select').on('change', function() {
  state.currentLabelCol = this.value || null;
  draw(state.currentData);
});

d3.select('#width-plus') .on('click', () => { state.treeWidthDelta += 80; draw(state.currentData); });
d3.select('#width-minus').on('click', () => { state.treeWidthDelta -= 80; draw(state.currentData); });
d3.select('#width-reset').on('click', () => { state.treeWidthDelta = 0;  draw(state.currentData); });

d3.select('#boxplot-select').on('change', function() {
  state.boxplotCol = this.value || null;
  drawBoxplot();
});

d3.select('#midpoint-chk').on('change', function() {
  if (this.checked) {
    state.currentData = midpointRoot(buildHierarchy(state.originalData));
  } else {
    state.currentData = state.originalData;
  }
  draw(state.currentData);
});

// Ctrl held → show grab cursor so the pan mode change is obvious
document.addEventListener('keydown', e => { if (e.key === 'Control') d3.select('#tree svg').classed('panning', true);  });
document.addEventListener('keyup',   e => { if (e.key === 'Control') d3.select('#tree svg').classed('panning', false); });

/* ── Export button ───────────────────────────────────────────────────────── */
document.getElementById('export-btn').addEventListener('click', () => exportZip());

/* ── Share button ────────────────────────────────────────────────────────── */
document.getElementById('share-btn').addEventListener('click', async () => {
  const url = buildShareUrl();
  await navigator.clipboard.writeText(url);
  const btn = document.getElementById('share-btn');
  const prev = btn.textContent;
  btn.textContent = 'Copied!';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 1800);
});

/* ── Initial render ──────────────────────────────────────────────────────── */
const shared = loadFromUrl();
if (shared) {
  state.originalNewick = shared.nwk;
  state.originalData   = parseNewick(shared.nwk);
  state.currentData    = state.originalData;
  if (shared.title) d3.select('#title').text(shared.title);
  if (shared.meta) {
    state.rawMeta = shared.meta;
    loadMeta(shared.meta, shared.color || null);
    if (shared.label) {
      state.currentLabelCol = shared.label;
      d3.select('#label-select').property('value', shared.label);
    }
  }
} else {
  state.originalNewick = DEFAULT_NEWICK;
  state.originalData   = parseNewick(DEFAULT_NEWICK);
  state.currentData    = state.originalData;
  state.rawMeta        = DEFAULT_META_TSV;
  loadMeta(DEFAULT_META_TSV, 'genome');
}
draw(state.currentData);

let _rafPending = false;
new ResizeObserver(() => {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; draw(state.currentData); });
}).observe(document.getElementById('tree'));
