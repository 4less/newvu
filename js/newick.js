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
      distFromChild = elen - (half - acc);
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
