// 다이어그램 다듬기 엔진 — 상세 문서(doc.html)·발표 덱(project.html)의 Mermaid 그림을 다시 그림
//   화살표를 수직·수평 직선 + 둥근 모서리로, %% 격자 배치, %% 화살표 지목, classDiagram note for 메모, 같은 변 화살표 자리 나누기.
//   common.js 다음에 불러오면 PF.orthoEdges · PF.mmdText가 생김. doc.js·project-deck.js는 PF.orthoEdges?.(svg, 원문) 처럼
//   있을 때만 부르므로, 이 파일을 빼면 Mermaid 기본 그림으로 돌아감.
//   /portfolio-diagram 스킬(.claude/skills/portfolio-diagram/)이 쓰는 원문 문법은 그 폴더의 SKILL.md에 정리.
(() => {
  if (typeof PF === 'undefined') { console.warn('[diagram-tidy] common.js보다 뒤에 불러와야 합니다'); return; }
  // ── 화살표를 수직·수평 직선 + 둥근 모서리로 다시 그림(흐름도·클래스·상태 그림) ──
  //   칸 배치는 Mermaid(dagre)가 정한 그대로, 화살표 모양만 바꿈. Mermaid가 화살표마다 남기는 지나가는 점(data-points)을 씀.
  //   두 칸이 위아래·좌우로 겹치는 폭이 있으면 한 줄 직선이 먼저, 아니면 짧은 길(꺾임 최대 2번), 다른 칸을 지나면 Mermaid가 피해 간 길을 따라 직각으로.
  //   같은 두 칸을 오가는 화살표 2개는 나란한 직선 두 줄로(글자는 각자 바깥쪽으로), 안 되면 Mermaid가 벌려 둔 길을 따름. 선 위 글자는 새 선 위로 옮김.
  //   레이아웃(getBBox)을 못 재는 숨긴 인쇄용 상자에서는 도형 속성으로 칸 크기를 계산.
  //   원문에서 고르기(Mermaid가 무시하는 %% 주석 줄):
  //     %% 화살표: 곡선                         이 그림은 Mermaid 곡선 그대로(예전처럼 gatherFanIn 손질)
  //     %% 화살표 보내는칸 -> 받는칸: 나감=오른쪽 들어감=오른쪽 거리=20
  //        나감·들어감 = 위/아래/왼쪽/오른쪽(그 변 가운데로), 거리 = 바깥으로 돌아가는 길을 칸에서 몇 px 떨어뜨릴지(기본 24)
  //        곡선 = 이 화살표만 Mermaid 곡선 그대로. 칸 이름은 원문의 id(예: Held, WallFragment). 영어 키도 됨(out= in= gap= curve)
  // 클래스 그림의 note for 줄: Mermaid에는 빼고 그리게 하고(배치에 끼지 않게), orthoEdges가 그 칸 위에 붙여 그림
  const NOTE_RE = /^\s*note\s+for\s+(\S+)\s+"([^"]*)"\s*$/gim;
  const mmdText = (src = '') => (/^\s*classDiagram/m.test(src) ? src.replace(NOTE_RE, '%% (메모는 칸 위에 따로 그림)') : src);
  function orthoEdges(svg, src = '') {
    const type = svg?.getAttribute('aria-roledescription') || '';
    if (!/flowchart|class|state/.test(type)) return false;
    const SIDE = { 위: 't', 아래: 'b', 왼쪽: 'l', 오른쪽: 'r', top: 't', bottom: 'b', left: 'l', right: 'r' };
    const rules = [];
    for (const m of src.matchAll(/^\s*%%\s*(?:화살표|arrow)\s+(\S+)\s*(?:->|-->|→)\s*(\S+?)\s*:\s*(.+)$/gim)) {
      const r = { from: m[1], to: m[2] };
      for (const tok of m[3].split(/[\s,]+/)) {
        const [k, v] = tok.split('=');
        if (/^(?:곡선|curve)$/i.test(k)) r.curve = true;
        else if (/^(?:나감|out)$/i.test(k) && SIDE[v]) r.out = SIDE[v];
        else if (/^(?:들어감|in)$/i.test(k) && SIDE[v]) r.in = SIDE[v];
        else if (/^(?:거리|gap)$/i.test(k) && !isNaN(+v)) r.gap = +v;
      }
      rules.push(r);
    }
    const toRoot = (el) => {
      let m = svg.createSVGMatrix();
      for (let e = el; e && e !== svg; e = e.parentNode) {
        const t = e.transform?.baseVal?.consolidate?.();
        if (t) m = t.matrix.multiply(m);
      }
      return m;
    };
    const tp = (m, p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
    // 칸 크기: getBBox, 못 재면(display:none) 도형 속성으로
    const shapeBox = (g) => {
      try { const b = g.getBBox(); if (b.width && b.height) return b; } catch { /* 숨긴 상자 */ }
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      const addRaw = (x, y) => { if (isFinite(x) && isFinite(y)) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); } };
      g.querySelectorAll(':scope > rect, :scope > circle, :scope > ellipse, :scope > polygon, :scope > path, :scope > g.basic > *, :scope > g > rect').forEach((s) => {
        const sm = s.transform?.baseVal?.consolidate?.()?.matrix;            // 마름모(polygon)는 자기 transform으로 자리를 잡음
        const add = (x, y) => (sm ? addRaw(sm.a * x + sm.c * y + sm.e, sm.b * x + sm.d * y + sm.f) : addRaw(x, y));
        const n = (a) => parseFloat(s.getAttribute(a)) || 0;                // 없는 속성(원의 cx·cy 등)은 0
        if (s.tagName === 'rect') { add(n('x'), n('y')); add(n('x') + n('width'), n('y') + n('height')); }
        else if (s.tagName === 'circle') { add(n('cx') - n('r'), n('cy') - n('r')); add(n('cx') + n('r'), n('cy') + n('r')); }
        else if (s.tagName === 'ellipse') { add(n('cx') - n('rx'), n('cy') - n('ry')); add(n('cx') + n('rx'), n('cy') + n('ry')); }
        else {
          const v = (s.getAttribute(s.tagName === 'polygon' ? 'points' : 'd') || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) || [];
          for (let i = 0; i + 1 < v.length; i += 2) add(v[i], v[i + 1]);
        }
      });
      return x2 > x1 && y2 > y1 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
    };
    placeGrid();
    const noteBoxes = placeNotes();
    // %% 격자: A B | C D — 적은 칸을 줄(|)·열 순서로 바둑판처럼 놓음(같은 줄은 흐름도·상태 그림이면 가운데, 클래스 그림이면 윗변을 맞추고, 같은 열은 가운데를 맞춤)
    //   칸 사이는 선 위 글자가 들어갈 만큼 벌림. 화살표는 마주 보는 변끼리 잇고(같은 줄·열이면 직선),
    //   대각선 자리끼리는 열 사이 빈 곳으로 꺾어 감. 적지 않은 칸은 그대로
    function placeGrid() {
      const gm = /^\s*%%\s*(?:격자|grid)\s*:\s*(.+)$/im.exec(src);
      if (!gm) return;
      const rows = gm[1].split('|').map((r) => r.trim().split(/\s+/).filter(Boolean)).filter((r) => r.length);
      const nodes = [...svg.querySelectorAll('g.node')].map((g) => {
        const b = shapeBox(g);
        if (!b) return null;
        const m = toRoot(g), p1 = tp(m, { x: b.x, y: b.y }), p2 = tp(m, { x: b.x + b.width, y: b.y + b.height });
        return { g, name: (/^(?:flowchart|classId|state)-(.+)-\d+$/.exec(g.id) || [])[1] || g.id, l: Math.min(p1.x, p2.x), r: Math.max(p1.x, p2.x), t: Math.min(p1.y, p2.y), b: Math.max(p1.y, p2.y) };
      }).filter(Boolean);
      const cell = new Map();
      rows.forEach((r, ri) => r.forEach((name, ci) => { const nd = nodes.find((o) => o.name === name); if (nd) cell.set(nd, { ri, ci }); }));
      if (cell.size < 2) return;
      const labs = [...svg.querySelectorAll('g.edgeLabel')].filter((g) => g.textContent.trim()).map((g) => {
        let w = 0, h = 0;
        try { const r = g.getBBox(); w = r.width; h = r.height; } catch { /* 숨긴 상자 */ }
        const fo = g.querySelector('foreignObject');
        if (!w && fo) { w = parseFloat(fo.getAttribute('width')) || 0; h = parseFloat(fo.getAttribute('height')) || 0; }
        return { g, id: g.querySelector('[data-id]')?.getAttribute('data-id'), w, h };
      });
      // 칸 사이: 같은 줄 칸끼리 잇는 선의 글자만 열 사이에, 나머지 선의 글자는 줄 사이에 들어가므로 각자 그만큼만 벌림
      const nodeAt0 = (p) => nodes.filter((o) => p.x >= o.l - 6 && p.x <= o.r + 6 && p.y >= o.t - 6 && p.y <= o.b + 6)
        .sort((a, c) => (a.r - a.l) * (a.b - a.t) - (c.r - c.l) * (c.b - c.t))[0];
      const sameRowEdge = new Map();                                       // 선 id → [시작 열, 끝 열]
      svg.querySelectorAll('path[data-points]').forEach((p) => {
        let pts; try { pts = JSON.parse(atob(p.getAttribute('data-points'))); } catch { return; }
        if (!pts?.length || !p.id) return;
        const m = toRoot(p), c0 = cell.get(nodeAt0(tp(m, pts[0]))), c1 = cell.get(nodeAt0(tp(m, pts.at(-1))));
        if (c0 && c1 && c0.ri === c1.ri) sameRowEdge.set(p.id, [c0.ci, c1.ci]);
      });
      const nc = Math.max(...rows.map((r) => r.length)), colW = Array(nc).fill(0), rowH = rows.map(() => 0);
      cell.forEach(({ ri, ci }, nd) => { colW[ci] = Math.max(colW[ci], nd.r - nd.l); rowH[ri] = Math.max(rowH[ri], nd.b - nd.t); });
      // 묶음(subgraph): 원문의 subgraph … end 안에 적힌 칸을 그 묶음 칸으로 보고, 옮기기 전 테두리와 칸 사이 여백을 재 둠
      const groups = [];
      for (const m of src.matchAll(/^\s*subgraph\s+([^\s\["]+)[^\n]*\n([\s\S]*?)^\s*end\s*$/gim)) {
        const cg = [...svg.querySelectorAll('g.cluster')].find((g) => g.id === m[1]);
        const rect = cg?.querySelector(':scope > rect');
        if (!rect) continue;
        const body = m[2].replace(/"[^"]*"|\|[^|]*\||%%.*$/gm, ' ');
        const members = nodes.filter((o) => new RegExp(`(^|[^\\w])${o.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`, 'm').test(body));
        if (!members.length) continue;
        const rm = toRoot(cg), r1 = tp(rm, { x: +rect.getAttribute('x'), y: +rect.getAttribute('y') });
        const r2 = tp(rm, { x: +rect.getAttribute('x') + +rect.getAttribute('width'), y: +rect.getAttribute('y') + +rect.getAttribute('height') });
        const box = (list) => ({ l: Math.min(...list.map((b) => b.l)), t: Math.min(...list.map((b) => b.t)), r: Math.max(...list.map((b) => b.r)), b: Math.max(...list.map((b) => b.b)) });
        const mb = box(members);
        // 여백: Mermaid가 벌려 둔 여백이 크면 좌우·아래 16px, 위는 이름표 높이 + 12px까지로 줄임
        const lh = cg.querySelector(':scope > g.cluster-label foreignObject')?.getAttribute('height') || 24;
        groups.push({ cg, rect, rm, members, box, pad: { l: Math.min(16, mb.l - r1.x), t: Math.min(+lh + 12, mb.t - r1.y), r: Math.min(16, r2.x - mb.r), b: Math.min(16, r2.y - mb.b) }, label: cg.querySelector(':scope > g.cluster-label'), rx: r1.x, ry: r1.y, rw: r2.x - r1.x });
      }
      // 묶음 경계가 지나는 열·줄 사이: 그 사이를 건너는 선의 글자가 양쪽 묶음 테두리(여백 16px)에 걸리지 않게 더 벌림
      const spans = groups.map((gr) => {
        const cs = gr.members.map((o) => cell.get(o)).filter(Boolean);
        return cs.length ? { c0: Math.min(...cs.map((c) => c.ci)), c1: Math.max(...cs.map((c) => c.ci)), r0: Math.min(...cs.map((c) => c.ri)), r1: Math.max(...cs.map((c) => c.ri)) } : null;
      }).filter(Boolean);
      const colEdge = (i) => spans.some((sp) => sp.c1 === i || sp.c0 === i + 1);
      const rowEdge = (j) => spans.some((sp) => sp.r1 === j || sp.r0 === j + 1);
      const ends = new Map();                                              // 선 id → [시작 칸, 끝 칸]
      svg.querySelectorAll('path[data-points]').forEach((p) => {
        let pts; try { pts = JSON.parse(atob(p.getAttribute('data-points'))); } catch { return; }
        if (!pts?.length || !p.id) return;
        const m = toRoot(p), a = nodeAt0(tp(m, pts[0])), b = nodeAt0(tp(m, pts.at(-1)));
        if (a && b && cell.has(a) && cell.has(b)) ends.set(p.id, [a, b]);
      });
      // 열 사이마다 따로: 바로 옆 열끼리 잇는 같은 줄 선의 글자만큼(최소 40px). 여러 열을 건너는 선의 글자는 사이의 빈 칸 위에 놓임
      const colGaps = Array(Math.max(0, nc - 1)).fill(40);
      labs.forEach((l) => {
        const c = sameRowEdge.get(l.id);
        if (!c || Math.abs(c[0] - c[1]) !== 1) return;
        const i = Math.min(c[0], c[1]);
        let need = l.w + 32;
        const e = ends.get(l.id);
        if (colEdge(i) && e) {
          const [L, R] = cell.get(e[0]).ci < cell.get(e[1]).ci ? e : [e[1], e[0]];
          need = l.w + 72 + Math.abs((colW[i] - (L.r - L.l)) - (colW[i + 1] - (R.r - R.l))) / 2;
        }
        colGaps[i] = Math.max(colGaps[i], need);
      });
      // 줄 사이마다 따로: 기본 40px, 바로 위아래 칸을 잇는 선의 글자가 있으면 그만큼(+묶음 경계면 테두리 여백까지).
      //   격자 칸끼리가 아닌 선의 글자(묶음·칸 밖)는 예전처럼 모든 줄 사이에 반영
      const rowGaps = Array(Math.max(0, rows.length - 1)).fill(40);
      labs.forEach((l) => {
        if (sameRowEdge.has(l.id)) return;
        const e = ends.get(l.id);
        if (!e) { for (let j = 0; j < rowGaps.length; j++) rowGaps[j] = Math.max(rowGaps[j], l.h + 32); return; }
        const r0 = cell.get(e[0]).ri, r1 = cell.get(e[1]).ri;
        if (Math.abs(r0 - r1) !== 1) return;                               // 여러 줄을 건너는 선·꺾인 선의 글자는 빈 칸·긴 토막 위에 놓임
        const j = Math.min(r0, r1);
        rowGaps[j] = Math.max(rowGaps[j], l.h + (rowEdge(j) && cell.get(e[0]).ci === cell.get(e[1]).ci ? 72 : 32));
      });
      const x0 = Math.min(...[...cell.keys()].map((n) => n.l)), y0 = Math.min(...[...cell.keys()].map((n) => n.t));
      const colX = colW.map((_, i) => x0 + colW.slice(0, i).reduce((a, c) => a + c, 0) + colGaps.slice(0, i).reduce((a, c) => a + c, 0));
      const rowY = rowH.map((_, i) => y0 + rowH.slice(0, i).reduce((a, c) => a + c, 0) + rowGaps.slice(0, i).reduce((a, c) => a + c, 0));
      // 흐름도·상태 그림은 줄마다 가운데를 맞춤 — 키가 다른 옆 칸(마름모·여러 줄 칸)과 잇는 선이 꺾이지 않게.
      //   클래스 그림은 칸 위 메모 자리 때문에 윗변을 맞춤(마름모가 있는 줄만 가운데)
      const midRow = rowH.map(() => !/class/.test(type));
      cell.forEach(({ ri }, nd) => { if (nd.g.querySelector(':scope > polygon, :scope > g > polygon')) midRow[ri] = true; });
      const old = new Map(), at = new Map();
      cell.forEach(({ ri, ci }, nd) => {
        old.set(nd, { ...nd });
        const w = nd.r - nd.l, h = nd.b - nd.t, l = colX[ci] + (colW[ci] - w) / 2, t = rowY[ri] + (midRow[ri] ? (rowH[ri] - h) / 2 : 0);
        const dx = l - nd.l, dy = t - nd.t;
        nd.g.setAttribute('transform', `translate(${dx.toFixed(2)},${dy.toFixed(2)}) ${nd.g.getAttribute('transform') || ''}`.trim());
        at.set(nd, { l, t, r: l + w, b: t + h });
      });
      const nodeAt = (p) => nodes.filter((o) => { const b = old.get(o) || o; return p.x >= b.l - 6 && p.x <= b.r + 6 && p.y >= b.t - 6 && p.y <= b.b + 6; })
        .sort((a, c) => (a.r - a.l) * (a.b - a.t) - (c.r - c.l) * (c.b - c.t))[0];
      svg.querySelectorAll('path[data-points]').forEach((p) => {
        let pts; try { pts = JSON.parse(atob(p.getAttribute('data-points'))); } catch { return; }
        if (!pts?.length) return;
        const m = toRoot(p), inv = m.inverse(), R = pts.map((q) => tp(m, q));
        const s0 = nodeAt(R[0]), s1 = nodeAt(R.at(-1));
        if (!s0 || !s1 || s0 === s1 || (!at.has(s0) && !at.has(s1))) return;
        const S = at.get(s0) || old.get(s0) || s0, T = at.get(s1) || old.get(s1) || s1;
        const c0 = cell.get(s0), c1 = cell.get(s1);
        const sameRow = c0 && c1 && c0.ri === c1.ri, sameCol = c0 && c1 && c0.ci === c1.ci;
        const mx = (b) => (b.l + b.r) / 2, my = (b) => (b.t + b.b) / 2;
        let way;
        if (sameCol && !sameRow) {
          const down = T.t >= S.b;
          way = [{ x: mx(S), y: down ? S.b : S.t }, { x: mx(T), y: down ? T.t : T.b }];
        } else {
          const right = T.l >= S.r, down = my(T) > my(S);
          const A = { x: right ? S.r : S.l, y: sameRow ? my(S) : down ? S.b - 16 : S.t + 16 };
          const B = { x: right ? T.l : T.r, y: sameRow ? my(T) : down ? T.t + 16 : T.b - 16 };
          const gx = (A.x + B.x) / 2;
          way = sameRow ? [A, B] : [A, { x: gx, y: A.y }, { x: gx, y: B.y }, B];
        }
        // 화살촉 몫(d 끝점과 지나가는 점의 거리)은 그대로 두고 d를 새 길의 처음·끝으로
        const nums = (p.getAttribute('d') || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) || [];
        const tr = nums.length >= 4 ? [Math.hypot(tp(m, { x: nums[0], y: nums[1] }).x - R[0].x, tp(m, { x: nums[0], y: nums[1] }).y - R[0].y),
          Math.hypot(tp(m, { x: nums.at(-2), y: nums.at(-1) }).x - R.at(-1).x, tp(m, { x: nums.at(-2), y: nums.at(-1) }).y - R.at(-1).y)].map((v) => (v < 30 ? v : 0)) : [0, 0];
        const pull = (a, b, len) => { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: a.x + (b.x - a.x) / L * len, y: a.y + (b.y - a.y) / L * len }; };
        const d0 = pull(way[0], way[1], tr[0]), d1 = pull(way.at(-1), way.at(-2), tr[1]);
        const Lc = (q) => { const r = tp(inv, q); return `${r.x.toFixed(2)},${r.y.toFixed(2)}`; };
        p.setAttribute('data-points', btoa(JSON.stringify(way.map((q) => tp(inv, q)))));
        p.setAttribute('d', `M${Lc(d0)}${way.slice(1, -1).map((q) => ` L${Lc(q)}`).join('')} L${Lc(d1)}`);
        const lab = labs.find((l) => l.id && l.id === p.id);
        if (lab) {
          const mid = way.length === 4 ? { x: way[1].x, y: (way[1].y + way[2].y) / 2 } : { x: (way[0].x + way.at(-1).x) / 2, y: (way[0].y + way.at(-1).y) / 2 };
          const q = tp(toRoot(lab.g.parentNode).inverse(), mid);
          lab.g.setAttribute('transform', `translate(${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
        }
      });
      // 묶음 테두리·이름표를 옮긴 칸에 맞춤(여백은 원래대로, 이름표는 가운데 위)
      //   같은 격자 줄에서 시작하는 묶음끼리는 윗변을 맞춤(나란히 선 클라이언트·서버 묶음 등)
      const firstRow = (gr) => Math.min(...gr.members.map((o) => cell.get(o)?.ri ?? Infinity));
      const nbs = groups.map((gr) => {
        const mb = gr.box(gr.members.map((o) => at.get(o) || o));
        return { l: mb.l - gr.pad.l, t: mb.t - gr.pad.t, r: mb.r + gr.pad.r, b: mb.b + gr.pad.b };
      });
      groups.forEach((gr, i) => {
        const fr = firstRow(gr);
        if (!isFinite(fr)) return;
        const top = Math.min(...groups.map((o, j) => (firstRow(o) === fr ? nbs[j].t : Infinity)));
        nbs[i].t = top;
      });
      const groupBoxes = groups.map((gr, gi) => {
        const nb = nbs[gi];
        const inv = gr.rm.inverse(), p1 = tp(inv, { x: nb.l, y: nb.t }), p2 = tp(inv, { x: nb.r, y: nb.b });
        gr.rect.setAttribute('x', p1.x.toFixed(2)); gr.rect.setAttribute('y', p1.y.toFixed(2));
        gr.rect.setAttribute('width', (p2.x - p1.x).toFixed(2)); gr.rect.setAttribute('height', (p2.y - p1.y).toFixed(2));
        const lt = gr.label?.transform?.baseVal?.consolidate?.()?.matrix;
        if (lt) {
          const lp = tp(gr.rm, { x: lt.e, y: lt.f }), dx = lp.x - (gr.rx + gr.rw / 2), dy = lp.y - gr.ry;
          const q = tp(toRoot(gr.label.parentNode).inverse(), { x: (nb.l + nb.r) / 2 + dx, y: nb.t + dy });
          gr.label.setAttribute('transform', `translate(${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
        }
        return nb;
      });
      // 그림 영역: 놓인 칸·묶음을 다 담게(줄였다 늘렸다)
      const all = nodes.map((o) => at.get(o) || o).concat(groupBoxes);
      const L = Math.min(...all.map((b) => b.l)) - 8, T = Math.min(...all.map((b) => b.t)) - 8, W = Math.max(...all.map((b) => b.r)) + 8 - L, H = Math.max(...all.map((b) => b.b)) + 8 - T;
      svg.setAttribute('viewBox', `${L} ${T} ${W} ${H}`);
      if (svg.style.maxWidth && !svg.style.maxWidth.endsWith('%')) svg.style.maxWidth = `${W}px`;
    }
    if (/^\s*%%\s*(?:화살표|arrows?)\s*:\s*(?:곡선|curve)\s*$/im.test(src)) return false;
    // 클래스 그림의 note for X "글": 그 칸 바로 위에 붙여 그림(Mermaid에는 note 줄을 빼고 그리게 함 — PF.mmdText)
    //   메모가 들어갈 높이만큼 그 칸 윗변부터 아래쪽 전체(칸·화살표 지나가는 점·선 위 글자)를 내려 자리를 만듦
    //   화살표가 칸 옆으로 드나드는 가로 배치(direction LR)에서 칸 위가 비어 있어 잘 맞음
    function placeNotes() {
      if (!/^\s*classDiagram/m.test(src)) return [];
      const notes = [...src.matchAll(NOTE_RE)].map((m) => ({ name: m[1], lines: m[2].split(/<br\s*\/?>|\\n/i).map((t) => t.trim()) }));
      if (!notes.length) return [];
      const tv = (typeof PF.mermaidConfig === 'function' ? PF.mermaidConfig({ print: !!svg.closest('.mmd-print') }) : {}).themeVariables || {};
      const fs = parseFloat(tv.fontSize) || 16, lh = fs * 1.5, ff = tv.fontFamily || 'sans-serif';
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${fs}px ${ff}`;
      const nodes = [...svg.querySelectorAll('g.node')].map((g) => {
        const b = shapeBox(g);
        if (!b) return null;
        const m = toRoot(g), p1 = tp(m, { x: b.x, y: b.y }), p2 = tp(m, { x: b.x + b.width, y: b.y + b.height });
        return { g, name: (/^classId-(.+)-\d+$/.exec(g.id) || [])[1] || g.id, l: Math.min(p1.x, p2.x), r: Math.max(p1.x, p2.x), t: Math.min(p1.y, p2.y), b: Math.max(p1.y, p2.y) };
      }).filter(Boolean);
      const GAP = 4, ROOM = 16;                                               // 메모와 칸 사이, 메모 위 여백
      const list = notes.map((n) => {
        const nd = nodes.find((o) => o.name === n.name);
        if (!nd) return null;
        const w = Math.max(...n.lines.map((t) => ctx.measureText(t).width)) + 24;
        return { ...n, nd, w: Math.max(w, nd.r - nd.l), h: n.lines.length * lh + 12 };
      }).filter(Boolean);
      if (!list.length) return [];
      const cuts = [];
      list.map((n) => ({ y: n.nd.t, H: n.h + GAP + ROOM })).sort((a, c) => a.y - c.y).forEach((c) => {
        const last = cuts.at(-1);
        if (last && c.y - last.y < 2) last.H = Math.max(last.H, c.H); else cuts.push(c);
      });
      const f = (y) => cuts.reduce((sum, c) => sum + (y >= c.y - 0.5 ? c.H : 0), 0);
      const nodeAt = (p) => nodes.filter((o) => p.x >= o.l - 6 && p.x <= o.r + 6 && p.y >= o.t - 6 && p.y <= o.b + 6)
        .sort((a, c) => (a.r - a.l) * (a.b - a.t) - (c.r - c.l) * (c.b - c.t))[0];
      const moveBy = (el, dy) => { if (dy) el.setAttribute('transform', `translate(0,${dy.toFixed(2)}) ${el.getAttribute('transform') || ''}`.trim()); };
      // 화살표: 처음·끝 점은 붙은 칸과 함께, 중간 점은 그 높이의 내림 폭만큼(d의 점도 같은 규칙 — 화살촉 몫 재기가 맞게)
      svg.querySelectorAll('path[data-points]').forEach((p) => {
        let pts; try { pts = JSON.parse(atob(p.getAttribute('data-points'))); } catch { return; }
        if (!pts?.length) return;
        const m = toRoot(p), inv = m.inverse(), R = pts.map((q) => tp(m, q));
        const s0 = nodeAt(R[0]), s1 = nodeAt(R.at(-1));
        // 메모가 붙은 칸의 윗변에 닿는 끝은 메모 윗변으로(메모와 칸을 한 덩어리로)
        const up = (nd, q) => { const n = nd && Math.abs(q.y - nd.t) < 2 && list.find((o) => o.nd === nd); return n ? -(GAP + n.h) : 0; };
        const e0 = up(s0, R[0]), e1 = up(s1, R.at(-1));
        const shift = (q, first, last) => (first && s0 ? f(s0.t) + e0 : last && s1 ? f(s1.t) + e1 : f(q.y));
        p.setAttribute('data-points', btoa(JSON.stringify(R.map((q, i) => tp(inv, { x: q.x, y: q.y + shift(q, i === 0, i === R.length - 1) })))));
        const d = p.getAttribute('d') || '', NUMS = /(-?\d*\.?\d+(?:e-?\d+)?)([\s,]+)(-?\d*\.?\d+(?:e-?\d+)?)/gi;
        const total = [...d.matchAll(NUMS)].length;
        let i = 0;
        p.setAttribute('d', d.replace(NUMS, (all, x, sep, y) => {
          const q = tp(m, { x: +x, y: +y }), k = i++;
          return `${x}${sep}${(+y + shift(q, k === 0, k === total - 1) / (m.d || 1)).toFixed(2)}`;
        }));
      });
      svg.querySelectorAll('g.edgeLabel, g.edgeTerminals').forEach((g) => moveBy(g, f(tp(toRoot(g), { x: 0, y: 0 }).y)));
      nodes.forEach((o) => moveBy(o.g, f(o.t)));
      const NS = 'http://www.w3.org/2000/svg', made = [];
      list.forEach((n) => {
        const cx = (n.nd.l + n.nd.r) / 2, top = n.nd.t + f(n.nd.t) - GAP - n.h, l = cx - n.w / 2;
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'pf-note');
        const rect = document.createElementNS(NS, 'rect');
        Object.entries({ x: l, y: top, width: n.w, height: n.h, fill: tv.noteBkgColor || '#fff5ad', stroke: tv.noteBorderColor || '#aaaa33', 'stroke-width': 1 })
          .forEach(([k, v]) => rect.setAttribute(k, typeof v === 'number' ? v.toFixed(2) : v));
        const text = document.createElementNS(NS, 'text');
        Object.entries({ 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': ff, 'font-size': fs, fill: tv.noteTextColor || tv.textColor || '#333' }).forEach(([k, v]) => text.setAttribute(k, v));
        n.lines.forEach((t, i) => {
          const ts = document.createElementNS(NS, 'tspan');
          ts.setAttribute('x', cx.toFixed(2)); ts.setAttribute('y', (top + 6 + lh * i + lh / 2).toFixed(2));
          ts.textContent = t;
          text.append(ts);
        });
        g.append(rect, text);
        svg.append(g);
        made.push({ name: `note:${n.name}`, l, t: top, r: l + n.w, b: top + n.h, cluster: false, round: false, note: true });
      });
      const vb = svg.viewBox?.baseVal;
      if (vb && vb.width) svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height + f(Infinity)}`);
      return made;
    }
    const boxes = [];
    svg.querySelectorAll('g.node, g.cluster').forEach((g) => {
      const b = shapeBox(g);
      if (!b) return;
      const m = toRoot(g), p1 = tp(m, { x: b.x, y: b.y }), p2 = tp(m, { x: b.x + b.width, y: b.y + b.height });
      const name = (/^(?:flowchart|classId|state)-(.+)-\d+$/.exec(g.id) || [])[1] || g.id;
      const round = !g.classList.contains('cluster') && !!g.querySelector(':scope > polygon, :scope > circle, :scope > ellipse, :scope > g > polygon, :scope > g > circle');
      boxes.push({ name, l: Math.min(p1.x, p2.x), t: Math.min(p1.y, p2.y), r: Math.max(p1.x, p2.x), b: Math.max(p1.y, p2.y), cluster: g.classList.contains('cluster'), round });
    });
    noteBoxes.forEach((nb) => { const b = boxes.find((o) => `note:${o.name}` === nb.name); if (b) { b.t = Math.min(b.t, nb.t); b.l = Math.min(b.l, nb.l); b.r = Math.max(b.r, nb.r); } });   // 메모 + 칸 = 한 덩어리
    const near = (p, pad = 6) => boxes.filter((b) => p.x >= b.l - pad && p.x <= b.r + pad && p.y >= b.t - pad && p.y <= b.b + pad)
      .sort((a, c) => (a.r - a.l) * (a.b - a.t) - (c.r - c.l) * (c.b - c.t))[0];
    const sideOf = (p, b) => [['t', Math.abs(p.y - b.t)], ['b', Math.abs(p.y - b.b)], ['l', Math.abs(p.x - b.l)], ['r', Math.abs(p.x - b.r)]].sort((a, c) => a[1] - c[1])[0][0];
    const sidePoint = (b, s) => (s === 't' ? { x: (b.l + b.r) / 2, y: b.t } : s === 'b' ? { x: (b.l + b.r) / 2, y: b.b } : s === 'l' ? { x: b.l, y: (b.t + b.b) / 2 } : { x: b.r, y: (b.t + b.b) / 2 });
    const axisOf = (s) => (s === 't' || s === 'b' ? 'v' : 'h');
    const edges = [];
    svg.querySelectorAll('path[data-points]').forEach((p) => {
      if (p.classList.contains('edge-thickness-invisible')) return;           // ~~~ 보이지 않는 연결은 그대로
      let pts; try { pts = JSON.parse(atob(p.getAttribute('data-points'))); } catch { return; }
      if (!pts || pts.length < 2) return;
      const m = toRoot(p);
      pts = pts.map((q) => tp(m, q));
      const sb = near(pts[0]), tb = near(pts.at(-1));
      if (!sb || !tb || sb === tb) return;                                 // 제자리로 도는 화살표는 그대로
      // Mermaid는 화살촉 몫만큼 선 끝을 지나가는 점보다 짧게 그림 → 그 길이를 재 두었다가 새 선에도 똑같이 적용
      const nums = (p.getAttribute('d') || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) || [];
      const trim = nums.length >= 4 ? [
        Math.hypot(tp(m, { x: nums[0], y: nums[1] }).x - pts[0].x, tp(m, { x: nums[0], y: nums[1] }).y - pts[0].y),
        Math.hypot(tp(m, { x: nums.at(-2), y: nums.at(-1) }).x - pts.at(-1).x, tp(m, { x: nums.at(-2), y: nums.at(-1) }).y - pts.at(-1).y),
      ].map((v) => (v < 30 ? v : 0)) : [0, 0];
      edges.push({ p, m, pts, sb, tb, trim });
    });
    if (!edges.length) return true;
    let sx = 0, sy = 0;
    edges.forEach(({ pts }) => { sx += Math.abs(pts.at(-1).x - pts[0].x); sy += Math.abs(pts.at(-1).y - pts[0].y); });
    const main = sy >= sx ? 'v' : 'h';
    const hits = (poly, skip) => {
      for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1], c = poly[i];
        const l = Math.min(a.x, c.x), r = Math.max(a.x, c.x), t = Math.min(a.y, c.y), b = Math.max(a.y, c.y);
        if (boxes.some((bx) => !bx.cluster && !skip.includes(bx) && r > bx.l + 2 && l < bx.r - 2 && b > bx.t + 2 && t < bx.b - 2)) return true;
      }
      return false;
    };
    const route = (P, aOut, Q, aIn) => {
      if (Math.abs(P.x - Q.x) < 1.5 || Math.abs(P.y - Q.y) < 1.5) return [Q];
      if (aOut === 'v' && aIn === 'v') { const y = (P.y + Q.y) / 2; return [{ x: P.x, y }, { x: Q.x, y }, Q]; }
      if (aOut === 'h' && aIn === 'h') { const x = (P.x + Q.x) / 2; return [{ x, y: P.y }, { x, y: Q.y }, Q]; }
      if (aOut === 'v') return [{ x: P.x, y: Q.y }, Q];
      return [{ x: Q.x, y: P.y }, Q];
    };
    // 지정한 변에서 나가 지정한 변으로 들어가는 길(같은 쪽 변끼리면 바깥으로 돌아감)
    const sidedRoute = (A, so, B, si, sb, tb, gap) => {
      const out = { t: { x: 0, y: -1 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } };
      if (so === si) {
        if (so === 'r' || so === 'l') { const x = so === 'r' ? Math.max(sb.r, tb.r) + gap : Math.min(sb.l, tb.l) - gap; return [A, { x, y: A.y }, { x, y: B.y }, B]; }
        const y = so === 'b' ? Math.max(sb.b, tb.b) + gap : Math.min(sb.t, tb.t) - gap; return [A, { x: A.x, y }, { x: B.x, y }, B];
      }
      const A2 = { x: A.x + out[so].x * gap / 2, y: A.y + out[so].y * gap / 2 }, B2 = { x: B.x + out[si].x * gap / 2, y: B.y + out[si].y * gap / 2 };
      return [A, A2, ...route(A2, axisOf(so), B2, axisOf(si)), B];
    };
    // 직선 우선: 두 칸이 위아래(또는 좌우)로 겹치는 폭이 있으면 꺾지 않고 한 줄로 이음
    //   네모 칸은 둥근 모서리를 피해 양끝 6px 안쪽, 마름모·원은 가운데에서만(바깥 상자 변이 실제 테두리인 곳)
    //   want: 이 자리(세로선이면 x, 가로선이면 y)로만 이음(오가는 화살표 짝을 나란히 놓을 때)
    const span = (b, v) => (b.round ? [(v ? b.l + b.r : b.t + b.b) / 2, (v ? b.l + b.r : b.t + b.b) / 2] : v ? [b.l + 6, b.r - 6] : [b.t + 6, b.b - 6]);
    const overlapOf = (sb, tb) => {
      for (const v of [true, false]) {
        const fwd = v ? tb.t >= sb.b - 1 : tb.l >= sb.r - 1, back = v ? sb.t >= tb.b - 1 : sb.l >= tb.r - 1;
        if (!fwd && !back) continue;
        const [a1, a2] = span(sb, v), [b1, b2] = span(tb, v), lo = Math.max(a1, b1), hi = Math.min(a2, b2);
        if (hi >= lo - 0.5) return { v, fwd, lo, hi };
      }
      return null;
    };
    const straight = (A, B, sb, tb, want) => {
      const ov = overlapOf(sb, tb);
      if (ov) {
        const { v, fwd, lo, hi } = ov;
        const k = v ? 'x' : 'y', c = (want != null ? [want] : [A[k], B[k], (lo + hi) / 2]).find((x) => x >= lo - 0.5 && x <= hi + 0.5);
        if (c == null) return null;
        const so = v ? (fwd ? 'b' : 't') : (fwd ? 'r' : 'l'), si = v ? (fwd ? 't' : 'b') : (fwd ? 'l' : 'r');
        const edge = (b, s) => (s === 't' ? b.t : s === 'b' ? b.b : s === 'l' ? b.l : b.r);
        // Mermaid가 남긴 끝점이 같은 변에 있으면 그 틈(화살촉 몫)을 그대로 씀
        const at = (P, b, s) => (!b.round && sideOf(P, b) === s ? P[v ? 'y' : 'x'] : edge(b, s));   // 마름모·원은 꼭짓점(바깥 상자 변)으로
        const a = at(A, sb, so), z = at(B, tb, si);
        return v ? [{ x: c, y: a }, { x: c, y: z }] : [{ x: a, y: c }, { x: z, y: c }];
      }
      return null;
    };
    // 다른 화살표의 선 위 글자도 직선이 지나가면 안 되는 자리(글자를 가로지르거나 글자끼리 겹침)
    const labelBoxes = [...svg.querySelectorAll('g.edgeLabel')].filter((g) => g.textContent.trim()).map((g) => {
      const fo = g.querySelector('foreignObject');
      let b = null;
      try { const r = g.getBBox(); if (r.width && r.height) b = r; } catch { /* 숨긴 상자 */ }
      if (!b && fo) { const w = parseFloat(fo.getAttribute('width')) || 0, h = parseFloat(fo.getAttribute('height')) || 0; if (w && h) b = { x: -w / 2, y: -h / 2, width: w, height: h }; }
      if (!b) return null;
      const m = toRoot(g), p1 = tp(m, { x: b.x, y: b.y }), p2 = tp(m, { x: b.x + b.width, y: b.y + b.height });
      return { id: g.querySelector('[data-id]')?.getAttribute('data-id'), l: Math.min(p1.x, p2.x), t: Math.min(p1.y, p2.y), r: Math.max(p1.x, p2.x), b: Math.max(p1.y, p2.y) };
    }).filter(Boolean);
    const crossesLabel = (poly, ...ids) => poly.some((c, i) => i && labelBoxes.some((lb) => {
      if (lb.id && ids.includes(lb.id)) return false;
      const a = poly[i - 1], l = Math.min(a.x, c.x), r = Math.max(a.x, c.x), t = Math.min(a.y, c.y), b = Math.max(a.y, c.y);
      return r > lb.l - 2 && l < lb.r + 2 && b > lb.t - 2 && t < lb.b + 2;
    }));
    // 직선으로 바꾸면 이 화살표의 글자가 새 선 위로 옮겨지는데, 그 자리가 다른 글자·칸과 겹치면 직선을 쓰지 않음
    //   직선을 쓰기로 하면 옮겨질 글자 자리를 기록해 다음 화살표가 그 자리를 피하게 함
    const labelFits = (poly, id) => {
      const own = labelBoxes.find((lb) => lb.id && lb.id === id);
      if (!own) return true;
      const cx = (own.l + own.r) / 2, cy = (own.t + own.b) / 2;
      let best = null, bd = Infinity;
      for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1], c = poly[i], dx = c.x - a.x, dy = c.y - a.y, len = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / len)), q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(q.x - cx, q.y - cy);
        if (d < bd) { bd = d; best = q; }
      }
      const mx = best.x - cx, my = best.y - cy, nb = { l: own.l + mx, r: own.r + mx, t: own.t + my, b: own.b + my };
      const over = (o) => nb.r > o.l + 1 && nb.l < o.r - 1 && nb.b > o.t + 1 && nb.t < o.b - 1;
      if (labelBoxes.some((lb) => lb !== own && over(lb)) || boxes.some((bx) => !bx.cluster && over(bx))) return false;
      Object.assign(own, nb);
      return true;
    };
    const ruleFor = (e) => rules.find((r) => r.from === e.sb.name && r.to === e.tb.name);
    // 같은 두 칸을 잇는 화살표가 여럿이면(오가는 화살표 등) 짧은 길로 모으지 않음 — 선과 글자가 겹치지 않게
    const pairKey = (e) => [boxes.indexOf(e.sb), boxes.indexOf(e.tb)].sort().join('-');
    const pairCount = new Map();
    edges.forEach((e) => pairCount.set(pairKey(e), (pairCount.get(pairKey(e)) || 0) + 1));
    edges.forEach((e) => { e.paired = pairCount.get(pairKey(e)) > 1; });
    // 화살표 하나의 길: A·B(시작·끝 점)를 바꿔 가며 다시 계산할 수 있게 함수로
    const facing = (P, b, o) => {                                         // 끝점이 모서리 근처(원통 뚜껑 등)라 어느 변인지 애매하면, 상대 칸이 통째로 놓인 쪽의 변으로
      const s = sideOf(P, b), dist = { t: Math.abs(P.y - b.t), b: Math.abs(P.y - b.b), l: Math.abs(P.x - b.l), r: Math.abs(P.x - b.r) };
      const toward = o.b <= b.t ? 't' : o.t >= b.b ? 'b' : o.r <= b.l ? 'l' : o.l >= b.r ? 'r' : null;
      return toward && toward !== s && dist[toward] <= 12 ? toward : s;
    };
    const plan = (e, A, B) => {
      const so = facing(A, e.sb, e.tb), si = facing(B, e.tb, e.sb);
      const line = !e.paired && straight(A, B, e.sb, e.tb);
      if (line && !hits(line, [e.sb, e.tb]) && !crossesLabel(line, e.p.id) && labelFits(line, e.p.id)) return line;
      let poly = [A, ...route(A, axisOf(so), B, axisOf(si))];
      if (e.paired || hits(poly, [e.sb, e.tb])) {                         // Mermaid가 피해 간(오가는 화살표는 벌려 둔) 길을 따라
        poly = [A];
        let prev = axisOf(so);
        const way = [...e.pts.slice(1, -1), B];
        // 들어가는 줄(나가는 줄)이 이미 받는(보내는) 칸 폭 안을 지나면 그 줄 그대로 칸에 닿게 — 칸 바로 앞의 작은 꺾임을 없앰
        const align = (P, b, s) => { const v = axisOf(s) === 'v', k = v ? 'x' : 'y', [lo, hi] = span(b, v); return !b.round && P[k] >= lo && P[k] <= hi ? k : null; };
        if (way.length > 1) { const k = align(way[0], e.sb, so); if (k && axisOf(so) === main) poly[0] = { ...A, [k]: way[0][k] }; }
        way.forEach((Q, i) => {
          const lastQ = i === way.length - 1, P = poly.at(-1);
          if (lastQ && axisOf(si) === prev) { const k = align(P, e.tb, si); if (k) Q = { ...Q, [k]: P[k] }; }
          poly.push(...route(P, prev, Q, lastQ ? axisOf(si) : main)); prev = main;
        });
      }
      return poly;
    };
    for (const e of edges) {
      const rule = ruleFor(e);
      if (rule?.curve) { e.skip = true; continue; }
      let A = e.pts[0], B = e.pts.at(-1);
      if (rule?.out || rule?.in) {
        let so = sideOf(A, e.sb), si = sideOf(B, e.tb);
        if (rule.out) { so = rule.out; A = sidePoint(e.sb, so); }
        if (rule.in) { si = rule.in; B = sidePoint(e.tb, si); }
        e.poly = sidedRoute(A, so, B, si, e.sb, e.tb, rule.gap ?? 24);
        e.fixed = true;
        continue;
      }
      e.poly = plan(e, A, B);
    }
    // 같은 칸의 같은 변에서 나가거나(들어오는) 두 화살표가 서로 엇갈리면 두 화살표의 붙는 자리를 맞바꿈
    //   예: 위쪽에서 나간 화살표가 아래 칸으로 꺾이며 옆 화살표를 가로지르면, 아래로 가는 쪽을 아래 자리에서 출발시킴
    //   맞바꾼 뒤 전체 교차가 줄고 다른 칸을 지나지 않을 때만 반영
    const crossCount = (P, Q) => {
      let n = 0;
      for (let i = 1; i < P.length; i++) for (let j = 1; j < Q.length; j++) {
        const a = [P[i - 1], P[i]], b = [Q[j - 1], Q[j]];
        const hz = (s) => Math.abs(s[0].y - s[1].y) < 0.5, vt = (s) => Math.abs(s[0].x - s[1].x) < 0.5;
        const test = (h, v) => {
          const x1 = Math.min(h[0].x, h[1].x), x2 = Math.max(h[0].x, h[1].x), y1 = Math.min(v[0].y, v[1].y), y2 = Math.max(v[0].y, v[1].y);
          return v[0].x > x1 + 1 && v[0].x < x2 - 1 && h[0].y > y1 + 1 && h[0].y < y2 - 1;
        };
        if ((hz(a) && vt(b) && test(a, b)) || (vt(a) && hz(b) && test(b, a))) n++;
      }
      return n;
    };
    const live = () => edges.filter((o) => o.poly && !o.skip);
    const crossTotal = (list) => list.reduce((n, e) => n + live().reduce((m, o) => m + (o !== e ? crossCount(e.poly, o.poly) : 0), 0), 0);
    const ends = (e) => [
      { e, end: 0, box: e.sb, side: sideOf(e.poly[0], e.sb), P: e.poly[0] },
      { e, end: 1, box: e.tb, side: sideOf(e.poly.at(-1), e.tb), P: e.poly.at(-1) },
    ];
    for (let pass = 0; pass < 8; pass++) {
      let improved = false;
      const cand = live().filter((e) => !e.paired && !e.fixed);
      const all = cand.flatMap(ends);
      scan: for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.e === b.e || a.box !== b.box || a.side !== b.side || !crossCount(a.e.poly, b.e.poly)) continue;
        const k = axisOf(a.side) === 'v' ? 'x' : 'y';
        if (Math.abs(a.P[k] - b.P[k]) < 1) continue;
        const keep = [a.e.poly, b.e.poly], saved = labelBoxes.map((lb) => ({ ...lb }));
        const before = crossTotal([a.e, b.e]);
        const swap = (x, y) => { const pts = [x.e.pts[0], x.e.pts.at(-1)]; pts[x.end] = { ...pts[x.end], [k]: y.P[k] }; x.e.poly = plan(x.e, pts[0], pts[1]); };
        swap(a, b); swap(b, a);
        const ok = !hits(a.e.poly, [a.e.sb, a.e.tb]) && !hits(b.e.poly, [b.e.sb, b.e.tb]) && crossTotal([a.e, b.e]) < before;
        if (ok) { improved = true; break scan; }                           // 자리가 바뀌었으니 처음부터 다시 살핌
        [a.e.poly, b.e.poly] = keep;
        saved.forEach((lb, n) => Object.assign(labelBoxes[n], lb));
      }
      if (!improved) break;
    }
    const tidy = (poly) => {
      const out = [poly[0]];
      for (let i = 1; i < poly.length; i++) {
        const c = poly[i], p = out.at(-1);
        if (Math.hypot(c.x - p.x, c.y - p.y) < 0.5) continue;
        if (out.length >= 2) {
          const o = out.at(-2);
          if ((Math.abs(o.x - p.x) < 0.5 && Math.abs(p.x - c.x) < 0.5) || (Math.abs(o.y - p.y) < 0.5 && Math.abs(p.y - c.y) < 0.5)) { out[out.length - 1] = c; continue; }
        }
        out.push(c);
      }
      return out;
    };
    const nearestOn = (poly, q) => {
      let best = null, bd = Infinity;
      for (let i = 1; i < poly.length; i++) {
        const a = poly[i - 1], c = poly[i], dx = c.x - a.x, dy = c.y - a.y, len = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len));
        const p = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < bd) { bd = d; best = p; }
      }
      return { p: best, d: bd };
    };
    // 짝을 정하기 전에, 다른 화살표의 글자가 새 선 위로 옮겨질 자리를 미리 반영
    for (const e of edges) {
      const lb = e.poly && labelBoxes.find((b) => b.id && b.id === e.p.id);
      if (!lb) continue;
      const cx = (lb.l + lb.r) / 2, cy = (lb.t + lb.b) / 2, { p, d } = nearestOn(e.poly, { x: cx, y: cy });
      if (p && d > 2) Object.assign(lb, { l: lb.l + p.x - cx, r: lb.r + p.x - cx, t: lb.t + p.y - cy, b: lb.b + p.y - cy });
    }
    // 지정한 같은 쪽 변끼리 바깥으로 돌아가는 화살표(나감=들어감): 글자를 바깥 줄 가운데에 두고,
    //   거리를 적지 않았으면 그 글자가 다른 글자·칸과 겹치지 않을 만큼(6px 여유) 바깥 줄을 더 벌림
    const clash = (nb, o, pad) => nb.r > o.l - pad && nb.l < o.r + pad && nb.b > o.t - pad && nb.t < o.b + pad;
    for (const e of edges) {
      const rule = e.fixed && ruleFor(e);
      if (!rule || !rule.out || rule.out !== rule.in) continue;
      const lb = labelBoxes.find((b) => b.id && b.id === e.p.id);
      const A = e.poly[0], B = e.poly.at(-1), w = lb ? lb.r - lb.l : 0, h = lb ? lb.b - lb.t : 0;
      for (let gap = rule.gap ?? 24; gap <= 600; gap += 4) {
        const poly = sidedRoute(A, rule.out, B, rule.in, e.sb, e.tb, gap);
        const mid = { x: (poly[1].x + poly[2].x) / 2, y: (poly[1].y + poly[2].y) / 2 };
        const nb = { l: mid.x - w / 2, r: mid.x + w / 2, t: mid.y - h / 2, b: mid.y + h / 2 };
        const free = !lb || (!labelBoxes.some((o) => o !== lb && clash(nb, o, 6)) && !boxes.some((bx) => !bx.cluster && clash(nb, bx, 6)));
        if (free || rule.gap != null || gap + 4 > 600) {
          e.poly = poly;
          if (lb) { Object.assign(lb, nb); e.labelAt = mid; }
          break;
        }
      }
    }
    // 같은 두 칸을 오가는 화살표 2개: 겹치는 폭 안에 나란한 직선 두 줄로, 선 위 글자는 각자 바깥쪽으로 비켜 놓음
    //   (세로선이면 왼쪽 선의 글자는 왼쪽으로, 오른쪽 선의 글자는 오른쪽으로 — 글자가 자기 선은 덮고 옆 선은 덮지 않게)
    const pairs = new Map();
    edges.forEach((e) => { const k = pairKey(e); if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(e); });
    for (const list of pairs.values()) {
      if (list.length !== 2 || list.some((e) => ruleFor(e))) continue;
      const ov = overlapOf(list[0].sb, list[0].tb);
      if (!ov || ov.hi - ov.lo < 12) continue;
      const k = ov.v ? 'x' : 'y', mean = (e) => e.pts.reduce((a, q) => a + q[k], 0) / e.pts.length;
      const pair = [...list].sort((a, c) => mean(a) - mean(c));             // Mermaid가 벌려 둔 쪽(왼·위 / 오른·아래)을 그대로
      const c = (ov.lo + ov.hi) / 2, g = Math.min(24, ov.hi - ov.lo) / 2;
      const lines = pair.map((e, i) => straight(e.pts[0], e.pts.at(-1), e.sb, e.tb, i ? c + g : c - g));
      const ids = pair.map((e) => e.p.id);
      if (lines.some((l, i) => !l || hits(l, [pair[i].sb, pair[i].tb]) || crossesLabel(l, ...ids))) continue;
      const own = pair.map((e) => labelBoxes.find((lb) => lb.id && lb.id === e.p.id));
      const placed = own.map((lb, i) => {
        if (!lb) return null;
        const w = lb.r - lb.l, h = lb.b - lb.t, L = lines[i], mid = ov.v ? (L[0].y + L[1].y) / 2 : (L[0].x + L[1].x) / 2;
        if (ov.v) { const l = i ? c + 3 : c - 3 - w; return { l, r: l + w, t: mid - h / 2, b: mid + h / 2 }; }
        const t = i ? c + 3 : c - 3 - h; return { l: mid - w / 2, r: mid + w / 2, t, b: t + h };
      });
      const over = (nb, o) => nb.r > o.l + 1 && nb.l < o.r - 1 && nb.b > o.t + 1 && nb.t < o.b - 1;
      if (placed.some((nb) => nb && (labelBoxes.some((lb) => !own.includes(lb) && over(nb, lb)) || boxes.some((bx) => !bx.cluster && over(nb, bx))))) continue;
      pair.forEach((e, i) => {
        e.poly = lines[i]; e.pairDone = true;
        if (placed[i]) { Object.assign(own[i], placed[i]); e.labelAt = { x: (placed[i].l + placed[i].r) / 2, y: (placed[i].t + placed[i].b) / 2 }; }
      });
    }
    // 같은 칸 같은 변의 한 점에 화살표가 둘 이상 붙으면(꺾인 선은 늘 변 가운데에 붙으므로 겹쳐 보임) 변을 따라 붙는 자리를 나눔
    //   붙는 점부터 같은 줄로 이어진 토막을 함께 옮겨 수직·수평을 유지. 순서는 선이 꺾여 나가는 쪽(위로 가는 선은 위 자리)
    //   직선(두 칸을 한 줄로 잇는 선)은 옮긴 자리가 상대 칸 폭 밖이면 그대로 둠
    const spots = new Map();
    for (const e of edges) {
      if (e.skip || !e.poly || e.poly.length < 2 || e.pairDone) continue;
      [[0, e.sb], [1, e.tb]].forEach(([end, box]) => {
        if (box.round || box.cluster) return;
        const P = end ? e.poly.at(-1) : e.poly[0], side = sideOf(P, box), k = axisOf(side) === 'v' ? 'x' : 'y';
        const key = `${boxes.indexOf(box)}:${side}:${Math.round(P[k] / 2)}`;
        if (!spots.has(key)) spots.set(key, []);
        spots.get(key).push({ e, end, box, side, k });
      });
    }
    for (const list of spots.values()) {
      if (list.length < 2) continue;
      const { box, k } = list[0], v = k === 'x', [lo, hi] = span(box, v);
      const turnOf = ({ e, end }) => {                                     // 붙는 점과 같은 줄이 끝나고 처음 꺾여 간 자리
        const pts = end ? [...e.poly].reverse() : e.poly, base = pts[0][k];
        return (pts.find((q) => Math.abs(q[k] - base) >= 0.5) || pts.at(-1))[k];
      };
      list.sort((a, c) => turnOf(a) - turnOf(c));
      const gap = Math.min(14, (hi - lo) / (list.length + 1));
      list.forEach((it, i) => {
        const off = (i - (list.length - 1) / 2) * gap;
        if (Math.abs(off) < 0.5) return;
        const pts = it.end ? [...it.e.poly].reverse() : [...it.e.poly], base = pts[0][k], to = base + off;
        let n = 0;
        while (n < pts.length && Math.abs(pts[n][k] - base) < 0.5) n++;
        if (n === pts.length) {                                            // 직선: 상대 칸 폭 안일 때만
          const other = it.end ? it.e.sb : it.e.tb, [olo, ohi] = span(other, v);
          if (other.round || to < olo || to > ohi) return;
        }
        for (let j = 0; j < n; j++) pts[j] = { ...pts[j], [k]: to };
        it.e.poly = it.end ? pts.reverse() : pts;
      });
    }
    for (const e of edges) {
      if (e.skip || !e.poly) continue;
      const poly = tidy(e.poly);
      // 화살촉 몫 줄이기(시작·끝): 마지막(첫) 선분을 따라 안쪽으로
      const cut = (a, b, len) => { const L = Math.hypot(b.x - a.x, b.y - a.y); return len > 0 && L > len + 2 ? { x: b.x + (a.x - b.x) / L * len, y: b.y + (a.y - b.y) / L * len } : b; };
      if (poly.length >= 2) { poly[poly.length - 1] = cut(poly.at(-2), poly.at(-1), e.trim[1]); poly[0] = cut(poly[1], poly[0], e.trim[0]); }
      const inv = e.m.inverse(), L = (q) => { const r = tp(inv, q); return `${r.x.toFixed(2)},${r.y.toFixed(2)}`; };
      let d = `M${L(poly[0])}`;
      for (let i = 1; i < poly.length - 1; i++) {
        const a = poly[i - 1], c = poly[i], n = poly[i + 1];
        const l1 = Math.hypot(c.x - a.x, c.y - a.y), l2 = Math.hypot(n.x - c.x, n.y - c.y), r = Math.min(8, l1 / 2, l2 / 2);
        d += ` L${L({ x: c.x - (c.x - a.x) / l1 * r, y: c.y - (c.y - a.y) / l1 * r })} Q${L(c)} ${L({ x: c.x + (n.x - c.x) / l2 * r, y: c.y + (n.y - c.y) / l2 * r })}`;
      }
      e.p.setAttribute('d', `${d} L${L(poly.at(-1))}`);
      // 선 위 글자: 새 선에서 가장 가까운 자리로
      const id = e.p.id && CSS.escape(e.p.id);
      const lab = id && svg.querySelector(`.edgeLabels [data-id="${id}"]`)?.closest('g.edgeLabel');
      if (lab && lab.textContent.trim() && lab.transform.baseVal.numberOfItems) {
        const here = tp(toRoot(lab), { x: 0, y: 0 }), { p, d: dist } = nearestOn(poly, here);
        let to = e.labelAt || (p && dist > 2 ? p : null);                   // 오가는 짝은 정해 둔 바깥쪽 자리로
        // 옮길 자리에서 글자가 칸과 겹치면(꺾인 선의 끝이 칸 옆일 때) 칸과 겹치지 않는 가장 긴 토막의 가운데로,
        //   그런 토막이 없으면 같은 선을 따라 칸과 4px 이상 떨어진 가장 가까운 자리로
        const own = !e.labelAt && labelBoxes.find((lb) => lb.id && lb.id === e.p.id);
        if (own && (to || p)) {
          const at = to || p, w = own.r - own.l, h = own.b - own.t;
          const boxAt = (c) => ({ l: c.x - w / 2, r: c.x + w / 2, t: c.y - h / 2, b: c.y + h / 2 });
          const hit = (c) => { const nb = boxAt(c); return boxes.some((bx) => !bx.cluster && nb.r > bx.l - 4 && nb.l < bx.r + 4 && nb.b > bx.t - 4 && nb.t < bx.b + 4); };
          if (hit(at)) {
            let best = null, bd = Infinity, bl = 0;
            for (let i = 1; i < poly.length; i++) {
              const a = poly[i - 1], c = poly[i], L = Math.hypot(c.x - a.x, c.y - a.y), mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
              if (L > bl && !hit(mid)) { bl = L; best = mid; }
            }
            for (let i = 1; !best && i < poly.length; i++) {
              const a = poly[i - 1], c = poly[i], L = Math.hypot(c.x - a.x, c.y - a.y);
              for (let s = 0; s <= L; s += 4) {
                const q = { x: a.x + (c.x - a.x) * (s / (L || 1)), y: a.y + (c.y - a.y) * (s / (L || 1)) };
                const dq = Math.hypot(q.x - at.x, q.y - at.y);
                if (dq < bd && !hit(q)) { bd = dq; best = q; }
              }
            }
            if (best) to = best;
          }
        }
        if (to) {
          const q = tp(toRoot(lab.parentNode).inverse(), to);
          lab.setAttribute('transform', `translate(${q.x.toFixed(2)}, ${q.y.toFixed(2)})`);
        }
      }
    }
    // 묶음 안 두 칸을 잇는 선이 묶음 밖으로 돌아 나가면(같은 변 되돌이 등) 그 선과 글자까지 묶음 테두리를 넓힘
    svg.querySelectorAll('g.cluster').forEach((cg) => {
      const rect = cg.querySelector(':scope > rect');
      if (!rect) return;
      const m = toRoot(cg), a = tp(m, { x: +rect.getAttribute('x'), y: +rect.getAttribute('y') });
      const z = tp(m, { x: +rect.getAttribute('x') + +rect.getAttribute('width'), y: +rect.getAttribute('y') + +rect.getAttribute('height') });
      const R0 = { l: Math.min(a.x, z.x), t: Math.min(a.y, z.y), r: Math.max(a.x, z.x), b: Math.max(a.y, z.y) }, R = { ...R0 };
      const inside = (b) => b && !b.cluster && (b.l + b.r) / 2 > R0.l && (b.l + b.r) / 2 < R0.r && (b.t + b.b) / 2 > R0.t && (b.t + b.b) / 2 < R0.b;
      edges.forEach((e) => {
        if (e.skip || !e.poly || !inside(e.sb) || !inside(e.tb)) return;
        e.poly.forEach((q) => { R.l = Math.min(R.l, q.x - 14); R.r = Math.max(R.r, q.x + 14); R.b = Math.max(R.b, q.y + 14); });
        const lb = labelBoxes.find((o) => o.id && o.id === e.p.id);
        if (lb) { R.l = Math.min(R.l, lb.l - 8); R.r = Math.max(R.r, lb.r + 8); R.b = Math.max(R.b, lb.b + 8); }
      });
      if (R.l === R0.l && R.r === R0.r && R.b === R0.b) return;
      const inv = m.inverse(), p1 = tp(inv, { x: R.l, y: R.t }), p2 = tp(inv, { x: R.r, y: R.b });
      rect.setAttribute('x', p1.x.toFixed(2)); rect.setAttribute('y', p1.y.toFixed(2));
      rect.setAttribute('width', (p2.x - p1.x).toFixed(2)); rect.setAttribute('height', (p2.y - p1.y).toFixed(2));
      const lab = cg.querySelector(':scope > g.cluster-label'), lt = lab?.transform?.baseVal?.consolidate?.()?.matrix;
      if (lt) {
        const shift = ((R.l + R.r) - (R0.l + R0.r)) / 2, lp = tp(toRoot(lab.parentNode).inverse(), { x: tp(toRoot(lab.parentNode), { x: lt.e, y: lt.f }).x + shift, y: tp(toRoot(lab.parentNode), { x: lt.e, y: lt.f }).y });
        lab.setAttribute('transform', `translate(${lp.x.toFixed(2)}, ${lp.y.toFixed(2)})`);
      }
      labelBoxes.push({ l: R.l, t: R.t, r: R.r, b: R.b, cluster: true });
    });
    // 바깥으로 돌아간 선·글자가 그림 테두리 밖으로 나가면 그림 영역을 넓힘
    const vb = svg.viewBox?.baseVal;
    if (vb && vb.width) {
      let l = vb.x, t = vb.y, r = vb.x + vb.width, b = vb.y + vb.height;
      edges.forEach((e) => { if (!e.skip && e.poly) e.poly.forEach((q) => { l = Math.min(l, q.x - 4); r = Math.max(r, q.x + 4); t = Math.min(t, q.y - 4); b = Math.max(b, q.y + 4); }); });
      labelBoxes.forEach((lb) => { l = Math.min(l, lb.l - 4); r = Math.max(r, lb.r + 4); t = Math.min(t, lb.t - 4); b = Math.max(b, lb.b + 4); });
      if (l < vb.x - 0.5 || t < vb.y - 0.5 || r > vb.x + vb.width + 0.5 || b > vb.y + vb.height + 0.5) {
        svg.setAttribute('viewBox', `${l} ${t} ${r - l} ${b - t}`);
        svg.dataset.pfGrown = '1';
        if (svg.style.maxWidth && !svg.style.maxWidth.endsWith('%')) svg.style.maxWidth = `${r - l}px`;
      }
    }
    return true;
  }
  PF.mmdText = mmdText;
  PF.orthoEdges = orthoEdges;
})();
