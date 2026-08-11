import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

/* ══════════════════════════════════════════════════════════════════════════
   NEWICK PARSER
══════════════════════════════════════════════════════════════════════════ */
export function parseNewick(s) {
  let pos = 0;
  function ws() { while (pos < s.length && /\s/.test(s[pos])) pos++; }
  function node() {
    ws();
    const n = { name: '', len: 0, children: [] };
    if (s[pos] === '(') {
      pos++;
      n.children.push(node()); ws();
      while (s[pos] === ',') { pos++; n.children.push(node()); ws(); }
      pos++; // ')'
    }
    ws();
    let lbl = '';
    while (pos < s.length && !/[(),;:]/.test(s[pos])) lbl += s[pos++];
    n.name = lbl.trim();
    ws();
    if (s[pos] === ':') {
      pos++;
      let len = '';
      while (pos < s.length && !/[(),;]/.test(s[pos])) len += s[pos++];
      n.len = parseFloat(len) || 0;
    }
    return n;
  }
  return node();
}

/* ══════════════════════════════════════════════════════════════════════════
   D3 HIERARCHY + LAYOUT
══════════════════════════════════════════════════════════════════════════ */
export function buildHierarchy(data) {
  const hier = d3.hierarchy(data, d => d.children.length ? d.children : null);
  hier.each(n => { n.dist = n.parent ? n.parent.dist + n.data.len : 0; });
  let slot = 0;
  hier.eachAfter(n => {
    if (!n.children) n.slot = slot++;
    else             n.slot = d3.mean(n.children, c => c.slot);
  });
  return hier;
}

/* ══════════════════════════════════════════════════════════════════════════
   LEAF NAMES  (plain-data walk — no d3.hierarchy needed)
══════════════════════════════════════════════════════════════════════════ */
export function leafNames(data, out = []) {
  if (!data) return out;
  if (!data.children || data.children.length === 0) { out.push(data.name); return out; }
  data.children.forEach(c => leafNames(c, out));
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   PRUNE
   Returns a new plain-data tree containing only the leaves in `keepNames`.
   Internal nodes that end up with a single child are collapsed and their
   branch length merged into that child, so the remaining topology and all
   root-to-tip distances stay correct.  Returns null if nothing is kept.
══════════════════════════════════════════════════════════════════════════ */
export function pruneTree(data, keepNames) {
  function rec(node) {
    if (!node.children || node.children.length === 0)
      return keepNames.has(node.name) ? { name: node.name, len: node.len, children: [] } : null;

    const kids = [];
    for (const c of node.children) {
      const k = rec(c);
      if (k) kids.push(k);
    }
    if (kids.length === 0) return null;
    if (kids.length === 1) {
      // Unary node — splice it out, adding its branch to the surviving child.
      kids[0].len += node.len;
      return kids[0];
    }
    return { name: node.name, len: node.len, children: kids };
  }
  return rec(data);
}

/* ══════════════════════════════════════════════════════════════════════════
   MIDPOINT ROOTING
   Handles trifurcating roots: when we invert through the original root,
   it keeps all its remaining children (2 if trifurcating → proper bifurcation).
   Degree-1 internal nodes only arise from bifurcating roots; collapse() fixes them.
══════════════════════════════════════════════════════════════════════════ */
export function midpointRoot(hierRoot) {
  // 1. Find the two most-distant leaves using node.ancestors() (native D3)
  const leaves = hierRoot.leaves();
  let maxD = -Infinity, tipA, tipB;
  for (let i = 0; i < leaves.length; i++) {
    const aAncs = new Set(leaves[i].ancestors());
    for (let j = i + 1; j < leaves.length; j++) {
      const lca = leaves[j].ancestors().find(n => aAncs.has(n));
      const d   = leaves[i].dist + leaves[j].dist - 2 * lca.dist;
      if (d > maxD) { maxD = d; tipA = leaves[i]; tipB = leaves[j]; }
    }
  }

  // 2. Walk the path tipA → LCA → tipB; find which edge contains the midpoint
  const half  = maxD / 2;
  const aAncs = new Set(tipA.ancestors());
  const lca   = tipB.ancestors().find(n => aAncs.has(n));

  const edges = [];
  let cur = tipA;
  while (cur !== lca) { edges.push(cur); cur = cur.parent; }

  const bAncs = tipB.ancestors();
  for (let i = bAncs.indexOf(lca) - 1; i >= 0; i--) edges.push(bAncs[i]);

  let acc = 0, splitChild, distFromChild;
  for (const n of edges) {
    const elen = n.data.len;
    if (acc + elen >= half) {
      splitChild    = n;
      // distFromChild = distance from new root to the child (tipA-side) end of the split edge.
      // distFromParent (computed below) = distance from new root to the parent end.
      distFromChild = half - acc;
      break;
    }
    acc += elen;
  }

  // 3. Re-root: build plain-data subtrees on each side of the split edge.
  const _DOWN = Symbol();
  function extract(node, comingFrom, branchLen) {
    const children = [];
    if (node.children) {
      for (const c of node.children) {
        if (c !== comingFrom) children.push(extract(c, _DOWN, c.data.len));
      }
    }
    if (comingFrom !== _DOWN && node.parent && node.parent !== comingFrom) {
      children.push(extract(node.parent, node, node.data.len));
    }
    return { name: node.data.name, len: branchLen, children };
  }

  const splitParent    = splitChild.parent;
  const distFromParent = splitChild.data.len - distFromChild;

  let newRoot = {
    name: '',
    len:  0,
    children: [
      extract(splitChild,  splitParent, distFromChild),
      extract(splitParent, splitChild,  distFromParent),
    ],
  };

  // 4. Collapse degree-1 internal nodes (only arises from a bifurcating original root).
  function collapse(n) {
    if (!n.children || !n.children.length) return n;
    n.children = n.children.map(collapse);
    if (n.children.length === 1) {
      const c = n.children[0];
      c.len += n.len;
      return c;
    }
    return n;
  }

  return collapse(newRoot);
}
