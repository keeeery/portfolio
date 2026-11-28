// 프로젝트 상세 문서 — doc.html?p=<폴더>  (portfolio-structure §4, 링크 §5, 결정 F2·F3·F6·F10)
//   흐르는 읽기 문서. 레이아웃 ① 가운데 정렬(spikes/doc-layout/doc.html?layout=1). 출처: spikes/doc-layout/doc.js
//   주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
//   문서 처리 순서: marked 12.0.2(gfm) → 상대경로 → GitHub식 slug(PF.slugger) — 여기까지 md-blocks.js(PF.md.parse, 와 같은 규칙) → 목차 → Mermaid 11.12.0 → highlight.js 11.9.0
//   주소: #<제목 slug>(슬라이드·옛 project.html 조각이 이 형식으로 옴) · #sec=<절 제목>(제목을 찾아 #<slug>로 바꿈)
//   로: 머리 [슬라이드 ↗](같은 탭 — 포트폴리오 안 이동). 예전의 절 머리 칩·목차 ★(덱 장면 연결)는 없앴습니다(결정 G1)
//   내용은 data/projects/<폴더>.json + src/<폴더>/<프로젝트 문서>만 씁니다. UI 문구는 문구 표(PF.t, assets/strings.js + theme/strings.tsv)에서 옵니다.
//   점검: await PFDoc.whenReady() → PFDoc.report() — errors(못 읽은 파일·그리지 못한 다이어그램) · images(깨진·아직 받는 그림) · diagrams · strings(문구 표).
//         whenReady는 문서·Mermaid·코드 처리와 글꼴까지만 기다립니다(그림은 기다리지 않음 → images.pending으로 봄)
//         ?pf-audit=1이면 그림까지 기다린 뒤 #pf-audit에 report()의 base64 JSON(headless용, 슬라이드·포트폴리오 페이지와 같은 형식)
// Mermaid는 불러오자마자 window load 때 자동 run(기본 startOnLoad: true)을 걸어 둠. 아래 ⑦이 .mermaid 상자를 만든 뒤 글꼴을 기다리는 사이에
//   load가 오면 그 자동 run이 상자를 먼저 집어(data-processed) 그리다 실패해 원문 글자로 남음 → load 전에(지금, 동기로) 꺼 둠
try { window.mermaid?.initialize({ startOnLoad: false }); } catch (_) { /* */ }
(async () => {
  const root = document.getElementById('app');
  const html = document.documentElement;
  const errors = [];
  const secRefs = { linked: 0, unresolved: [] };   // 본문 "§번호" → 같은 번호 제목 링크(③-2) 결과 — 직접 고친 부분
  let resolveReady;
  const whenReady = new Promise((r) => { resolveReady = r; });
  const report = () => {
    const imgs = [...document.querySelectorAll('#doc img')];
    const figs = [...document.querySelectorAll('#doc figure.mmd')];
    return {
      page: 'doc', ready: html.dataset.docReady === '1',
      images: { total: imgs.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
                pending: imgs.filter((i) => !i.complete).map((i) => i.getAttribute('src')) },
      diagrams: { total: figs.length, failed: figs.filter((f) => !f.querySelector('.mermaid svg')).map((f) => f.dataset.label || '') },
      errors, strings: PF.stringsReport(),
      sectionRefs: { linked: secRefs.linked, unresolved: [...secRefs.unresolved] },
    };
  };
  window.PFDoc = Object.assign(window.PFDoc || {}, { whenReady: () => whenReady, report });
  // Mermaid가 페이지 load 때 스스로 그리지 않게 맨 먼저 끕니다(아래 await 사이에 load가 오면 기본 설정으로 먼저 그려 버림)
  if (window.mermaid) mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif' });
  if (PF.guardFileProtocol(root)) { errors.push('file:// — 로컬 서버로 열어야 합니다'); return done(); }

  const { esc, inline, link, markNewTab } = PF;
  const T = (k, v) => esc(PF.t(k, v));                                 // HTML에 넣는 문구
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p');
  const srcPath = (rel) => PF.srcPath(id, rel);
  const deckUrl = (sid = '') => PF.projectUrl(id, sid);
  const back = `<p>${link({ href: 'index.html', label: '← 포트폴리오로', kind: 'back', cls: 'btn' })}</p>`;
  const headText = new Map();                                        // 제목 요소 → 원문 제목 글자(링크 표시·각주가 붙기 전)
  const htext = (h) => headText.get(h) ?? h.textContent.trim();
  let releaseHold = null;                                            // 도착한 제목 붙잡기(hold) 해제 함수

  // 표 칸 폭 맞추기(화면만) — 직접 고친 부분.
  //   브라우저 기본 표 배치는 긴 칸에 폭을 몰아 줘서 짧은 칸이 '핵심|A', '§3 ·|§8.1'처럼 한두 글자만 다음 줄로 넘어가는 일이 생김.
  //   칸마다 폭을 바꿔 가며(화면 밖 복제 표, table-layout:fixed) 칸 안 줄 수와 외톨이 줄(마지막 줄이 2.6em 이하이거나 칸 폭의 20% 미만)을 재고,
  //   표 폭 안에서 '줄 수 + 외톨이 벌점'이 가장 작은 폭 나눔을 고름(동점이면 브라우저 기본 나눔에 가까운 쪽). 고른 폭은 <colgroup class="pf-cols">의 --pf-w로,
  //   CSS(doc.css table.pf-fit)는 화면에서만 적용 — 인쇄는 원래 자동 배치(⑥-2 .print-wide)를 그대로 씀. 표 칸 폭이 바뀌면(창 크기) 다시 나눔.
  //   그림·코드 블록·열 합치기(colspan)가 있는 표, 표 폭에 다 들어가거나(줄바꿈 없음) 최소 폭도 넘치는(가로 스크롤) 표는 건드리지 않음.
  //   줄 합치기(rowspan)는 다룸 — 줄마다 칸이 몇 번째 열인지 위에서 내려온 합친 칸을 건너뛰며 셈(colMap), 합친 칸의 줄 수는 한 번만 셈.
  //   코드 이름 하나만 든 칸(예: 셰이더 표의 `TimeFreezeHologram`)이 두 줄로 꺾이면 줄마다 벌점(NAME_WRAP_COST)을 더해, 폭이 되면 이름은 한 줄로 둠
  //   (폭이 모자라면 <wbr> 낱말 경계에서 꺾임 — 휴대폰 폭)
  const nameOnly = (cell) => {                                          // 칸 글이 코드 하나뿐이고 띄어쓰기가 없음
    const codes = cell.querySelectorAll('code');
    if (codes.length !== 1) return false;
    const t = cell.textContent.trim();
    return t === codes[0].textContent.trim() && !/\s/.test(t);
  };
  function colMap(tb) {                                                // 줄마다 [칸 → 열 번호], 표가 고르지 않으면 null
    const n = tb.rows[0]?.cells.length || 0, busy = new Array(n).fill(0), map = [];
    for (const row of tb.rows) {
      const cols = []; let c = 0;
      for (const cell of row.cells) {
        while (c < n && busy[c] > 0) c++;
        if (c >= n || cell.colSpan !== 1) return null;
        cols.push(c); busy[c] = cell.rowSpan > 1 ? cell.rowSpan : 1; c++;
      }
      if (busy.some((b) => b === 0)) return null;                       // 빈 열이 있는 줄(칸 수가 모자람)
      map.push(cols);
      for (let i = 0; i < n; i++) busy[i]--;
    }
    return map;
  }
  function fitTables(scope) {
    const ORPHAN_EM = 2.6, ORPHAN_RATIO = 0.2, ORPHAN_COST = 3, NAME_WRAP_COST = 6, MAX_STEPS = 120;
    const tables = [...scope.querySelectorAll('.table-wrap > table')].filter((tb) =>
      !tb.querySelector('img, video, iframe, pre, table, .mmd') && tb.rows.length &&
      [...tb.rows[0].cells].every((c) => c.rowSpan === 1) && colMap(tb) &&
      tb.rows[0].cells.length >= 2);
    if (!tables.length) return;
    const lineInfo = (cell) => {                                      // 칸 안 줄 수·마지막 줄 폭(px)
      const fs = parseFloat(getComputedStyle(cell).fontSize) || 14;
      const r = document.createRange(); r.selectNodeContents(cell);
      const lines = [];
      for (const q of [...r.getClientRects()].sort((a, b) => a.top - b.top)) {
        if (q.width < 0.5 || q.height < 0.5 || q.height > fs * 2.2) continue;   // 여러 줄을 감싸는 블록 상자는 빼고 줄 조각만
        const cy = (q.top + q.bottom) / 2;
        const L = lines.find((l) => Math.abs(l.cy - cy) < fs * 0.6);
        if (L) { L.l = Math.min(L.l, q.left); L.r = Math.max(L.r, q.right); } else lines.push({ cy, l: q.left, r: q.right });
      }
      if (lines.length < 2) return { n: lines.length, orphan: false };
      const cs = getComputedStyle(cell);
      const inner = cell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const last = lines.reduce((a, b) => (b.cy > a.cy ? b : a));
      const w = last.r - last.l;
      return { n: lines.length, orphan: w <= fs * ORPHAN_EM || w < inner * ORPHAN_RATIO };
    };
    const measure = (tb, box) => {                                    // 칸마다 폭(4px 남짓 간격)별 비용표
      const t = tb.cloneNode(true);
      t.classList.remove('pf-fit'); t.querySelector(':scope > colgroup.pf-cols')?.remove(); delete t.dataset.pfFit;   // 재기용 복제본에는 '기다리는 중' 표시를 넘기지 않음
      t.style.cssText = 'min-width:0 !important;width:auto;table-layout:auto';
      box.replaceChildren(t);
      const n = t.rows[0].cells.length;
      const widths = () => [...t.rows[0].cells].map((c) => c.getBoundingClientRect().width);
      box.style.width = '1px'; const minC = widths();               // 최소 폭(낱말 단위 줄바꿈, 머리 칸은 한 줄)
      box.style.width = '100000px'; const maxC = widths();          // 한 줄 폭
      const range = Math.max(...maxC.map((m, i) => m - minC[i]));
      if (range < 1) return null;
      const u = Math.max(4, Math.ceil(range / MAX_STEPS));
      const K = maxC.map((m, i) => Math.ceil((m - minC[i]) / u));
      const cg = document.createElement('colgroup');
      const cols = Array.from({ length: n }, () => cg.appendChild(document.createElement('col')));
      t.prepend(cg); t.style.tableLayout = 'fixed';
      // 고정 배치에서 col 폭과 실제 칸 폭의 차이(안쪽 여백·테두리 계산 방식)를 한 번 재서 맞춤
      cols.forEach((c, i) => { c.style.width = `${minC[i]}px`; });
      t.style.width = `${minC.reduce((a, b) => a + b, 0)}px`;
      const adj = widths().map((w, i) => minC[i] - w);
      const cmap = colMap(t);
      const names = [...t.rows].map((row) => [...row.cells].map(nameOnly));
      const cost = minC.map(() => []);
      for (let s = 0; s <= Math.max(...K); s++) {
        const ws = minC.map((m, i) => m + Math.min(s, K[i]) * u);
        cols.forEach((c, i) => { c.style.width = `${ws[i] + adj[i]}px`; });
        t.style.width = `${ws.reduce((a, b) => a + b, 0)}px`;
        for (let i = 0; i < n; i++) if (s <= K[i]) cost[i][s] = 0;
        [...t.rows].forEach((row, r) => [...row.cells].forEach((cell, j) => {
          const i = cmap[r][j];
          if (s > K[i]) return;
          const { n: ln, orphan } = lineInfo(cell);
          cost[i][s] += ln + (orphan ? ORPHAN_COST : 0) + (names[r][j] && ln > 1 ? NAME_WRAP_COST : 0);   // 한 줄→두 줄에만 벌점(좁은 화면에서 이름 칸이 다른 칸을 짓누르지 않게)
        }));
      }
      return { n, minC, maxC, u, K, cost, adj };
    };
    const solve = (m, T) => {                                         // 표 폭 T를 칸에 나눔(동적 계획법)
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      const R = T - sum(m.minC);
      if (R < 0 || R >= sum(m.maxC) - sum(m.minC) - 0.5) return null;
      const B = Math.floor(R / m.u);
      const share = R / (sum(m.maxC) - sum(m.minC));                  // 브라우저 기본 나눔 어림(최소 폭 + 남는 폭을 칸의 여유만큼)
      const cAt = (i, k) => m.cost[i][Math.min(k, m.K[i])];
      let dp = new Array(B + 1).fill(Infinity); dp[0] = 0;
      const pick = [];
      for (let i = 0; i < m.n; i++) {
        const nd = new Array(B + 1).fill(Infinity), pk = new Array(B + 1).fill(0);
        const ideal = (m.maxC[i] - m.minC[i]) * share / m.u;
        for (let b = 0; b <= B; b++) {
          if (dp[b] === Infinity) continue;
          for (let k = 0; b + k <= B; k++) {
            const v = dp[b] + cAt(i, k) * 1e5 + Math.abs(k - ideal);
            if (v < nd[b + k]) { nd[b + k] = v; pk[b + k] = k; }
          }
        }
        dp = nd; pick.push(pk);
      }
      const ks = []; let b = B;
      for (let i = m.n - 1; i >= 0; i--) { ks[i] = pick[i][b]; b -= ks[i]; }
      const ws = m.minC.map((v, i) => v + ks[i] * m.u);
      const big = ws.indexOf(Math.max(...ws));
      ws[big] += T - sum(ws);                                         // 4px 미만 나머지는 가장 넓은 칸에
      return ws;
    };
    const apply = (tb) => {
      const m = tb._pfFit, T = tb.parentElement.clientWidth;
      if (!m || !T || T === tb._pfFitW) return;
      tb._pfFitW = T;
      const ws = solve(m, T);
      if (!ws) { tb.classList.remove('pf-fit'); return; }
      let cg = tb.querySelector(':scope > colgroup.pf-cols');
      if (!cg) {
        cg = document.createElement('colgroup'); cg.className = 'pf-cols';
        for (let i = 0; i < m.n; i++) cg.appendChild(document.createElement('col'));
        tb.prepend(cg);
      }
      const set = () => [...cg.children].forEach((c, i) => c.style.setProperty('--pf-w', `${ws[i] + m.adj[i]}px`));
      set(); tb.classList.add('pf-fit');
      const over = tb.getBoundingClientRect().width - tb.parentElement.clientWidth;   // 겹친 테두리 반쪽만큼 넘치면(가로 스크롤 막대가 생김) 가장 넓은 칸에서 뺌
      if (over > 0) { const big = ws.indexOf(Math.max(...ws)); ws[big] -= Math.ceil(over); set(); }
    };
    const ro = new ResizeObserver((es) => es.forEach((e) => apply(e.target.querySelector(':scope > table'))));
    let gen = 0;
    const run = async () => {
      const my = ++gen;
      document.documentElement.dataset.pfTableFit = 'busy';         // 직접 추가: 표 칸 폭을 맞추는 중 — 로딩 그레이박스(page-anchor.js)가 화면 안·위쪽 표(data-pf-fit="wait")가 끝날 때까지 기다림
      tables.forEach((tb) => { tb.dataset.pfFit = 'wait'; });
      performance.mark?.('pf-table-fit-start');
      const probe = document.createElement('div');
      probe.className = 'md pf-fit-probe'; probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:absolute;left:-200000px;top:0;visibility:hidden;max-width:none;width:auto';
      probe.innerHTML = '<div class="table-wrap" style="min-width:0 !important;max-width:none !important;margin:0 !important;overflow:visible"></div>';
      document.body.appendChild(probe);
      for (const tb of tables) {
        if (my !== gen) break;
        try { tb._pfFit = measure(tb, probe.firstChild); } catch (err) { tb._pfFit = null; console.warn('[doc] 표 칸 폭 재기 오류:', err); }
        tb._pfFitW = 0;
        apply(tb); ro.observe(tb.parentElement);
        delete tb.dataset.pfFit;                                     // 이 표는 끝
        await new Promise((ok) => setTimeout(ok, 0));                // 표 사이에 잠깐 쉬어 화면이 멈추지 않게(탭이 뒤에 있어도 진행)
      }
      probe.remove();
      if (my !== gen) return;                                        // 더 새로 시작한 재기가 남은 표를 맡음(그쪽이 끝낼 때 done)
      document.documentElement.dataset.pfTableFit = 'done'; performance.mark?.('pf-table-fit-done');
    };
    run();
    document.fonts?.addEventListener('loadingdone', run);             // 글꼴이 늦게 들어오면 다시 잼
  }

  if (!id) { errors.push('no-project: 주소에 ?p=<폴더 이름>이 없습니다'); PF.notice(root, '프로젝트를 고르세요', `<p>주소 끝에 <code>?p=폴더이름</code>을 붙여 주세요.</p>${back}`); return done(); }
  const [pf] = await Promise.all([PF.loadJSON('data/portfolio.json').catch(() => ({})), PF.loadStrings()]);
  // profile.md 페이지 설정 "- 발표 덱 빼기: 폴더, …"에 이 폴더가 있으면 슬라이드 버튼·인쇄 주소를 뺌(포트폴리오 페이지 카드와 같은 설정)
  const noDeck = await fetch('profile.md', { cache: 'no-cache' }).then((r) => (r.ok ? r.text() : '')).then((md) => {
    const m = md.replace(/<!--[\s\S]*?-->/g, '').match(/^\s*-\s*발표 덱 빼기\s*[:：](.*)$/m);
    return !!m && m[1].split(',').map((x) => x.trim()).includes(id);
  }).catch(() => false);
  PF.applyTheme(pf.settings?.accent);
  document.querySelector('.skip-link')?.replaceChildren(PF.t('ui.skip'));
  let p;
  try {
    p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`);
  } catch (err) {
    errors.push(`data/projects/${id}.json: ${err && err.message || err}`);
    PF.notice(root, '프로젝트를 찾을 수 없습니다', `<p>${esc(err.message)}</p>${back}`);
    return done();
  }
  const name = pf.profile?.name || '';
  document.title = `${p.title} — ${PF.t('name.doc')}${name ? ' · ' + name : ''}`;

  // ── 뼈대 ──
  const metaRows = (p.meta || []).map((m) => `<div><dt>${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`).join('') +
    (p.team?.role ? `<div class="role"><dt>${T('name.role')}</dt><dd>${inline(p.team.role)}</dd></div>` : '');
  // 프로젝트 링크 순서(2026-11-27, 사용자 지정): 영상 → GitHub → 그 밖의 링크 → 슬라이드 → 원문 마크다운(오른쪽 칸 카드만)
  const linkSet = (cls) => [
    PF.isUrl(p.links?.video) && link({ href: p.links.video, label: PF.videoName(p), kind: 'external', cls }),
    ...PF.repoLinks(p).map((r) => link({ href: r.url, label: esc(r.label), kind: 'external', cls })),   // 저장소가 둘 이상이면 'GitHub(역할)'
    ...PF.otherLinks(p).map((l) => link({ href: l.url, label: esc(l.label), kind: 'external', cls })),
    !noDeck && link({ href: deckUrl(), label: T('name.deck'), kind: 'page', cls }),
  ].filter(Boolean);
  // 제목 아래 [한눈에 · 링크] 상자의 버튼: 첫 버튼만 파란 강조(포트폴리오 캡슐 바와 같게)
  const actionBtns = linkSet('btn').map((h, i) => (i === 0 ? h.replace('class="btn"', 'class="btn primary"') : h));
  // 프로젝트 링크: 오른쪽 칸 '링크' 카드에 글자 링크로(doc.css '레일 링크'), 오른쪽 칸이 기본으로 없는 폭은 제목 아래 [한눈에] 상자에도
  const railLinks = [
    ...linkSet(undefined),
    link({ href: srcPath(p.doc), label: T('doc.raw-md'), kind: 'file' }),   // 원문 마크다운은 맨 아래
  ].filter(Boolean);
  const tags = (p.tags || []).length ? `<ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';

  root.innerHTML = `
    <header class="doc-head">
      <div class="doc-head-in">
        <p class="crumb">${link({ href: 'index.html', label: T('ui.back'), kind: 'back' })}<span aria-hidden="true">›</span><b>${esc(p.title)} — ${T('name.doc')}</b></p>
        ${PF.modeButton('btn')}
      </div>
    </header>
    <div class="print-only print-urls"></div>
    <div class="doc-page">
      <nav class="toc" id="toc" aria-label="문서 목차"><p class="toc-title">${T('name.toc')}</p><div class="toc-links" id="toc-links"></div></nav>
      <main class="doc-main" id="main" tabindex="-1">
        <div class="doc-intro">
          <p class="eyebrow">${T('doc.eyebrow')}</p>
          <h1>${esc(p.title)}</h1>
          ${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}
          <dl class="meta-line">${metaRows}</dl>
          ${tags}
          <details class="glance" id="glance"><summary>${T('doc.glance')}</summary>
            <div class="glance-body"><div class="actions">${actionBtns.join('')}</div>
            <p class="newtab-note">${T('doc.deck-note')}</p></div>
          </details>
        </div>
        <article class="md" id="doc"><p class="loading">프로젝트 문서를 불러오는 중…</p></article>
      </main>
      <aside class="rail" aria-label="프로젝트 정보">
        <section class="rail-card"><p class="rail-title">${T('doc.rail-project')}</p><dl class="rail-meta">${metaRows}</dl></section>
        <section class="rail-card"><p class="rail-title">${T('doc.rail-links')}</p><nav class="rail-links" aria-label="프로젝트 링크">${railLinks.join('')}</nav></section>
      </aside>
    </div>
    <div class="doc-fab" role="group" aria-label="빠른 이동"><button type="button" class="fab-toc" aria-haspopup="dialog">${T('name.toc')}</button></div>
    <dialog class="toc-dialog" aria-label="문서 목차"><div class="toc-dialog-head"><p class="toc-title">${T('name.toc')}</p><button type="button" class="btn dlg-close">${T('ui.close')}</button></div><div class="toc-links"></div></dialog>`;

  // 직접 수정: 본문 끝 다른 프로젝트 상세 문서 링크 + 맨 아래 띠(세 줄) — 예전 본문 맨 아래 세 줄을 옮김(common.js docEnd)
  PF.docEnd(root.querySelector('.doc-page'), { pf, name, current: id });

  // 좁은 화면(< 720px)에서는 "한눈에" 상자를 접어 둠
  document.getElementById('glance').open = !matchMedia('(max-width: 719.98px)').matches;

  const zoom = lightbox();
  try { await renderDoc(); ready(); }
  catch (err) {                                                       // 그리다 멈추면 "불러오는 중…"에 머물지 않게 이유를 보이고 준비 신호는 냄
    errors.push(String(err && err.stack || err));
    console.error('[doc] 프로젝트 문서를 그리지 못함:', err);
    const doc = document.getElementById('doc');
    if (doc?.querySelector('.loading')) doc.innerHTML = `<p class="error">프로젝트 문서를 그리지 못했습니다 (${esc(err && err.message || err)}).</p>`;
  }
  PF.topCap(PF.t('doc.top'));
  PF.railToggle();
  done();

  // ───────────────────────────────────────────────────────────────
  async function renderDoc() {
    const doc = document.getElementById('doc');
    let md;
    try { md = await PF.loadText(srcPath(p.doc)); }
    catch (err) { errors.push(`doc: ${err.message}`); doc.innerHTML = `<p class="error">프로젝트 문서를 불러오지 못했습니다 (${esc(err.message)}).</p>`; return; }
    // ①② md HTML은 먼저 비활성 <template>에 넣고(그 안의 그림은 받지 않음) 상대경로·제목 id를 고친 뒤에 문서에 붙임(PF.md.parse, 와 같은 규칙).
    //    제목 id는 GitHub 규칙(PF.slugger), 링크 분류(↗ 표시)·인쇄 각주([n])가 섞이기 전의 원문 제목 글자로 계산하고, 그 글자를 목차·레일에도 씀
    const { frag, headings: hs } = PF.md.parse(md, id);
    const { isRelative, decode } = PF.md;
    const headings = hs.map((h) => { headText.set(h.el, h.text); return h.el; });

    // ③ 링크 분류(§5-2)
    frag.querySelectorAll('a[href]').forEach((a) => classifyMdLink(a, isRelative, decode));
    doc.replaceChildren(frag);

    // ③-2 본문의 절 참조 "§2.6"·"§10" → 같은 번호로 시작하는 제목(H2·H3 "2.6 …"·"10. …")으로 가는 링크 — 직접 고친 부분.
    //   원문 md는 그대로 두고 화면에서만 잇습니다. 번호가 맞는 제목이 없으면 글자 그대로 두고 report().sectionRefs.unresolved에 남김.
    //   코드·다이어그램·제목·이미 링크인 글자는 건드리지 않음. "§2.1~2.4"처럼 § 없는 뒤 번호는 잇지 않음
    linkSectionRefs(doc, headings);

    // ④ 제목 찾기(#sec=<절 제목> 딥링크용, PF.resolveHeading: 정확히 일치 → 앞부분 양방향 일치, 여럿이면 문서 순서상 첫 번째)
    const list = headings.map((h) => ({ text: htext(h), el: h }));
    const resolve = (title) => PF.resolveHeading(list, title)?.el || null;
    window.PFDoc = Object.assign(window.PFDoc || {}, { resolve });

    // 직접 수정: 장(h2)마다 그 아래 절(h3)과 함께 .toc-group 묶음으로 — 묶음마다 왼쪽 세로줄, 묶음 사이 간격
    let tocHtml = '', open = false;
    headings.filter((h) => h.tagName === 'H2' || h.tagName === 'H3').forEach((h) => {
      if (h.tagName === 'H2' || !open) { if (open) tocHtml += '</div>'; tocHtml += '<div class="toc-group">'; open = true; }
      tocHtml += `<a class="${h.tagName.toLowerCase()}" href="#${esc(h.id)}">${esc(htext(h))}</a>`;
    });
    if (open) tocHtml += '</div>';
    document.querySelectorAll('.toc-links').forEach((el) => { el.innerHTML = tocHtml; });

    // ⑥ 표 → .table-wrap(스크롤 영역), 그림만 있는 문단 → .pf-figure
    let nTable = 0;
    doc.querySelectorAll('table').forEach((tb) => {
      const w = document.createElement('div');
      w.className = 'table-wrap';
      w.setAttribute('role', 'region'); w.tabIndex = 0; w.setAttribute('aria-label', `표 ${++nTable}`);
      tb.replaceWith(w); w.appendChild(tb);
    });
    // 표 칸 안 코드 이름은 낱말 경계(소문자·숫자 뒤 대문자, . _ / ( 뒤)에서만 줄바꿈 — 직접 고친 부분.
    //   <wbr>로 줄바꿈 자리를 주고, doc.css(.md :is(th, td) code)가 글자 중간 줄바꿈을 막음 → 'TimeFreezeHolo|gram' 대신 'TimeFreeze|Hologram'
    doc.querySelectorAll(':is(th, td) code').forEach((code) => {
      const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      const texts = []; for (let n = walk.nextNode(); n; n = walk.nextNode()) texts.push(n);
      for (const t of texts) {
        const parts = t.data.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[._/(])(?=[^\s._/()])/);
        if (parts.length < 2) continue;
        const frag = document.createDocumentFragment();
        parts.forEach((s, i) => { if (i) frag.appendChild(document.createElement('wbr')); frag.appendChild(document.createTextNode(s)); });
        t.replaceWith(frag);
      }
    });
    doc.querySelectorAll('p').forEach((para) => {
      const kids = [...para.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
      const only = kids.length === 1 && kids[0].nodeType === 1 ? kids[0] : null;
      const img = only && (only.tagName === 'IMG' ? only : (only.tagName === 'A' && only.children.length >= 1 && [...only.childNodes].every((n) => n.nodeType === 1 ? n.tagName === 'IMG' || n.classList.contains('pf-newtab-icon') || n.classList.contains('pf-newtab-sr') : !n.textContent.trim()) ? only.querySelector('img') : null));
      if (img) para.classList.add('pf-figure');
      // 한 줄에 그림만 여러 장(`![a](x) ![b](y)`) → 테두리·머리 칸 없이 나란히 — 직접 고친 부분
      else if (kids.length >= 2 && kids.every((n) => n.nodeType === 1 && n.tagName === 'IMG')) {
        para.classList.add('pf-figure', 'pf-figure-row');
        // 비율이 다른 그림도 높이가 같게 — 칸 폭을 그림 비율(폭/높이)에 비례해 나눔(원본 이미지는 그대로) — 직접 고친 부분(2026-11-27)
        kids.forEach((im) => {
          const fit = () => { if (im.naturalWidth > 0 && im.naturalHeight > 0) im.style.flexGrow = String(im.naturalWidth / im.naturalHeight); };
          if (im.complete) fit(); else im.addEventListener('load', fit, { once: true });
        });
      }
    });
    // 세로 그림(앱 화면 등) → .pf-tall(폭을 한 줄 두 장의 한 칸만큼 줄여 가운데) — 직접 고친 부분.
    //   그림 크기를 알아야 하므로 불러온 뒤 정함
    doc.querySelectorAll(':scope > p.pf-figure:not(.pf-figure-row)').forEach((para) => {
      const im = para.querySelector('img');
      const mark = () => {
        if (!(im.naturalWidth > 0 && im.naturalHeight >= im.naturalWidth * 1.15)) return;
        para.classList.add('pf-tall');
      };
      if (im.complete) mark(); else im.addEventListener('load', mark, { once: true });
    });

    // ⑦ Mermaid (securityLevel loose). 글꼴을 먼저 받아 글자 폭을 맞춤
    //   색은 PF.mermaidConfig — 화면용(.mmd-screen, 테마 손잡이 · 밝은/어두운 화면을 따름)과 인쇄용(.mmd-print, 흰 종이)을 따로 그림.
    //   인쇄 직전에는 비동기로 다시 그릴 수 없어서 인쇄용을 미리 그려 두고 CSS(@media print)로 바꿔 보임
    let n = 0;
    const figs = [];
    doc.querySelectorAll('code.language-mermaid').forEach((code) => {
      const fig = document.createElement('figure');
      fig.className = 'mmd';
      const div = document.createElement('div');
      div.className = 'mermaid mmd-screen';
      div.id = `mmd-${n}`;
      div.textContent = PF.mmdText ? PF.mmdText(code.textContent) : code.textContent;   // note for 줄은 빼고 그림(칸 위 메모는 orthoEdges가)
      const pdiv = document.createElement('div');
      pdiv.className = 'mermaid mmd-print';
      pdiv.dataset.svgId = `mmd-p-${n++}`;
      pdiv.setAttribute('aria-hidden', 'true');
      fig._mmdSrc = code.textContent;
      const acc = /^\s*accTitle\s*:\s*(.+)$/m.exec(code.textContent)?.[1]?.trim();
      fig.dataset.label = acc || PF.t('doc.diagram-n', { n });
      fig.append(div, pdiv);
      fig.insertAdjacentHTML('beforeend', `<div class="mmd-bar"><details class="mmd-src"><summary>${T('doc.diagram-src')}</summary><pre><code>${esc(code.textContent)}</code></pre></details></div>`);
      (code.closest('pre') || code).replaceWith(fig);
      figs.push(fig);
    });
    // 「<!-- 나란히 -->」 표시 바로 뒤 두 블록(표·다이어그램·그림 등)을 가로로 나란히(.pf-side) — 직접 고친 부분(2026-11-28).
    //   다이어그램을 그리기 전에 옮겨서 칸 폭에 맞춰 그려지게 함. 좁은 화면에서는 doc.css가 위아래로 되돌림
    [...doc.childNodes].filter((n) => n.nodeType === 8 && n.data.trim() === '나란히').forEach((c) => {
      const pair = [];
      for (let n = c.nextSibling; n && pair.length < 2; n = n.nextSibling) if (n.nodeType === 1) pair.push(n);
      if (pair.length < 2) return;
      const row = document.createElement('div');
      row.className = 'pf-side';
      c.after(row); row.append(...pair);
    });
    try { await Promise.race([Promise.all([document.fonts.load('16px Pretendard'), document.fonts.load('700 16px Pretendard')]), sleep(4000)]); } catch { /* 글꼴 없이 진행 */ }

    // ⑥-2 인쇄(A4 글줄 680px)에서 낱말 단위 줄바꿈으로는 들어가지 않는 표에만 .print-wide → 인쇄 CSS가 그 표에서만 낱말 중간 줄바꿈을 허용
    //   (모든 표에 허용하면 짧은 칸의 한글 낱말이 '방|식'처럼 끊김). 인쇄와 같은 표 규칙(doc.css .md.print-probe)으로 잼.
    //   목록·인용 안의 표는 조상의 좌우 안쪽 여백·테두리만큼 좁은 폭으로(인쇄에서도 같은 px). 그림·iframe 등은 불러오지 않게 빼고 잼.
    //   글꼴이 늦게 들어오면 다시 잼(대체 글꼴 폭으로 잰 결과가 남지 않게)
    const markPrintWide = () => {
      const probe = document.createElement('div');
      probe.className = 'md print-probe'; probe.setAttribute('aria-hidden', 'true');
      // 인라인 !important: 인쇄 중에 다시 재도 인쇄 규칙 .md > * { width:auto !important … }에 지지 않게
      probe.innerHTML = '<div class="table-wrap" style="min-width:0 !important;max-width:none !important;margin:0 !important;overflow:visible"></div>';
      document.body.appendChild(probe);
      const box = probe.firstChild;
      doc.querySelectorAll('.table-wrap > table').forEach((tb) => {
        let inset = 0;
        for (let el = tb.parentElement.parentElement; el && el !== doc; el = el.parentElement) {
          const cs = getComputedStyle(el);
          inset += parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
        }
        const t = document.createElement('template'); t.innerHTML = tb.outerHTML;
        t.content.querySelectorAll('img, video, picture, source').forEach((e) => e.remove());
        t.content.querySelectorAll('iframe, object, embed, audio').forEach((e) => ['src', 'srcdoc', 'data'].forEach((a) => e.removeAttribute(a)));
        box.style.setProperty('width', `${680 - inset}px`, 'important');
        box.replaceChildren(t.content);
        tb.parentElement.classList.toggle('print-wide', box.firstElementChild.getBoundingClientRect().width > 680 - inset + 0.5);
      });
      probe.remove();
    };
    markPrintWide();
    document.fonts?.addEventListener('loadingdone', markPrintWide);
    fitTables(doc);
    const finishSvg = (fig, box) => {
      const svg = box.querySelector('svg');
      if (!svg) { box.classList.add('pf-mmd-error'); return; }
      const ortho = PF.orthoEdges?.(svg, fig._mmdSrc);                    // 화살표를 수직·수평 직선 + 둥근 모서리로(원문 %% 화살표 줄로 고르기)
      if (fig._mmdSrc.includes('%% folk-sack-architecture')) PF.routeFolkSackTerrain?.(svg);
      if (!ortho) PF.gatherFanIn?.(svg);                                  // 곡선 그대로인 그림: 한 상자로 모이는 화살표를 한 변 가운데로
      // 가운데 맞춤 글자(선 글자·흐름도 칸 글자): Mermaid는 글자 폭만 한 칸(table-cell)을 foreignObject 왼쪽에 둠.
      //   페이지에서 그림이 줄면 브라우저 최소 글자 크기 때문에 글자가 넓게 그려지고 그 폭으로 상자를 잡아서,
      //   크게 보기(실제 크기)에서는 글자가 상자보다 좁아져 왼쪽으로 쏠림 → 칸을 상자 폭에 채우고 그 안에서 가운데로
      svg.querySelectorAll('foreignObject > div').forEach((d) => {
        if (d.style.textAlign === 'center' && d.style.display === 'table-cell') Object.assign(d.style, { display: 'block', width: '100%' });
      });
      const natural = svg.viewBox?.baseVal?.width || parseFloat(svg.style.maxWidth) || 0;
      if (natural) { svg.setAttribute('width', String(Math.ceil(natural))); svg.style.maxWidth = '100%'; svg.removeAttribute('height'); }
      svg.dataset.naturalWidth = String(natural);
      if (box.classList.contains('mmd-print')) { svg.setAttribute('aria-hidden', 'true'); return; }
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', fig.dataset.label);
      svg.querySelectorAll('a[href], a[*|href]').forEach((a) => {           // Mermaid click 링크에도 같은 분류
        const h = a.getAttribute('href') || a.getAttribute('xlink:href') || '';
        if (/^https?:/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }   // 외부만 새 탭(링크 규칙)
      });
    };
    // 배포 직후 브라우저가 새 doc.js와 옛 common.js(캐시, 최대 10분)를 섞어 쓰면 PF.mermaidConfig가 없음 → 기본 색으로라도 그림(원문 글자로 남지 않게)
    const mmdCfg = (o) => (typeof PF.mermaidConfig === 'function' ? PF.mermaidConfig(o) : { startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif' });
    const runMermaid = async (sel, cfg) => {
      mermaid.initialize(cfg);
      try { await mermaid.run({ nodes: doc.querySelectorAll(sel) }); }
      catch (err) { console.warn('[doc] Mermaid 렌더 오류:', err); errors.push(`mermaid: ${String(err?.message || err).split('\n')[0].slice(0, 160)}`); }
    };
    if (!window.mermaid && figs.length) errors.push('mermaid: 다이어그램 라이브러리(Mermaid)를 불러오지 못했습니다');
    if (window.mermaid && figs.length) {
      // 인쇄용: 화면에 보이지 않는 상자에서는 글자 폭을 잴 수 없어서 mermaid.render(본문 밖 임시 자리)로 그려 넣음
      mermaid.initialize({ ...mmdCfg({ print: true }), suppressErrorRendering: true });
      for (const fig of figs) {
        const box = fig.querySelector('.mmd-print');
        try { box.innerHTML = (await mermaid.render(box.dataset.svgId, PF.mmdText ? PF.mmdText(fig._mmdSrc) : fig._mmdSrc)).svg; } catch { box.replaceChildren(); }
      }
      await runMermaid('.mmd-screen', mmdCfg());
    }
    figs.forEach((fig) => fig.querySelectorAll('.mermaid').forEach((box) => finishSvg(fig, box)));
    // 화면 모드(☀/☾)를 바꾸면 화면용 그림만 새 색으로 다시 그림(인쇄용은 그대로)
    let mmdQueue = Promise.resolve();
    if (window.mermaid && figs.length) window.addEventListener('pf-mode', () => {
      mmdQueue = mmdQueue.then(async () => {
        figs.forEach((fig) => {
          const box = fig.querySelector('.mmd-screen');
          box.removeAttribute('data-processed'); box.classList.remove('pf-mmd-error');
          box.textContent = PF.mmdText ? PF.mmdText(fig._mmdSrc) : fig._mmdSrc;
        });
        await runMermaid('.mmd-screen', mmdCfg());
        figs.forEach((fig) => finishSvg(fig, fig.querySelector('.mmd-screen')));
      });
    });

    // ⑧ 코드 하이라이트 + 접근성 (다이어그램 원문 pre는 제외)
    if (window.hljs && !hljs.getLanguage('hlsl')) { try { hljs.registerAliases('hlsl', { languageName: 'cpp' }); } catch (_) { /* */ } }  // HLSL은 C 계열이라 C++ 색을 빌림
    const LANG = { csharp: 'C#', cs: 'C#', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML', css: 'CSS', python: 'Python', py: 'Python', bash: 'Shell', sh: 'Shell', powershell: 'PowerShell', hlsl: 'HLSL', shader: 'Shader', cpp: 'C++', c: 'C', lua: 'Lua' };
    doc.querySelectorAll('pre > code').forEach((el) => {
      if (el.closest('.mmd-src')) return;
      if (window.hljs) { try { hljs.highlightElement(el); PF.hlMore?.(el); } catch (_) { /* */ } }   // 타입·메서드 호출도 색
      const lang = /language-([\w+#-]+)/.exec(el.className)?.[1]?.toLowerCase();
      const pre = el.parentElement;
      pre.tabIndex = 0; pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', lang && LANG[lang] ? `코드 (${LANG[lang]})` : '코드');
    });

    // ⑨ 인쇄용: 바깥 링크 각주 번호 + 문서 끝 링크 목록(§4-8). 화면에는 보이지 않음. ?pf-footnotes=0이면 끔
    if (Q.get('pf-footnotes') !== '0') {
      const urls = [];
      doc.querySelectorAll('a[href^="http"]').forEach((a) => {
        if (a.closest('.mmd')) return;
        let k = urls.indexOf(a.href);
        if (k < 0) { urls.push(a.href); k = urls.length - 1; }
        a.insertAdjacentHTML('afterend', `<sup class="print-only fn">[${k + 1}]</sup>`);
      });
      if (urls.length) doc.insertAdjacentHTML('beforeend', `<section class="print-only link-list"><p class="ll-title">${T('doc.links-list')}</p><ol>${urls.map((u) => `<li>${esc(u)}</li>`).join('')}</ol></section>`);
    }
    const here = new URL(location.href); here.hash = '';
    const deckAbs = new URL(deckUrl(), location.href).href;
    document.querySelector('.print-urls').innerHTML = `<p>${T('doc.print-web')}: ${esc(here.href)}</p>${noDeck ? '' : `<p>${T('name.deck')}: ${esc(deckAbs)}</p>`}`;

    // ⑩ 목차 현재 위치(스크롤 기준)
    trackSection(headings.filter((h) => h.tagName === 'H2' || h.tagName === 'H3'));
    PF.fitSides();

    // ⑪ 이미지 크게 보기, 다이어그램 크게 보기(같은 페이지 dialog) — 다이어그램은 그림을 누르거나 [크게 보기] 단추로(단추는 키보드용)
    doc.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (img && !img.closest('a')) return zoom({ src: img.currentSrc || img.src, caption: img.alt, video: img.dataset.pfVidBase });
      const hit = (!e.target.closest('a') && e.target.closest('.mmd-screen'));   // 다이어그램 안 링크(click)는 그대로 열림
      if (hit) { const fig = hit.closest('.mmd'), svg = fig.querySelector('.mmd-screen svg'); if (svg) zoom({ svg, caption: fig.dataset.label }); }
    });
    // 다이어그램 원문 패널: 그림 폭(fit-content)이 아니라 본문 칸 폭(코드 블록과 같은 폭·위치)으로 펼침
    const sizeSrc = (d) => {
      const pre = d.querySelector(':scope > pre');
      if (!pre) return;
      if (!d.open) { pre.style.width = pre.style.marginLeft = ''; return; }
      const md = d.closest('.md'), cs = getComputedStyle(md), r = md.getBoundingClientRect();
      const inner = md.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const measure = parseFloat(cs.getPropertyValue('--measure')) * parseFloat(getComputedStyle(document.documentElement).fontSize) || inner;
      const colW = Math.min(measure, inner), colL = r.left + parseFloat(cs.paddingLeft) + (inner - colW) / 2;
      pre.style.width = `${colW}px`;
      pre.style.marginLeft = `${colL - d.getBoundingClientRect().left}px`;
    };
    doc.addEventListener('toggle', (e) => { if (e.target.matches?.('.mmd-src')) sizeSrc(e.target); }, true);
    addEventListener('resize', () => doc.querySelectorAll('.mmd-src[open]').forEach(sizeSrc));
    // 코드 오른쪽 흐림 표시: 가로로 더 있을 때만
    const fade = (pre) => pre.classList.toggle('fade-r', pre.scrollWidth > pre.clientWidth + 1 && pre.scrollLeft + pre.clientWidth < pre.scrollWidth - 1);
    const pres = [...doc.querySelectorAll('pre')].filter((x) => !x.closest('.mmd-src'));
    pres.forEach((pre) => { fade(pre); pre.addEventListener('scroll', () => fade(pre), { passive: true }); });
    addEventListener('resize', () => pres.forEach(fade));
  }

  function linkSectionRefs(doc, headings) {
    const byNum = new Map();
    headings.forEach((h) => {
      if (h.tagName !== 'H2' && h.tagName !== 'H3') return;
      const m = /^(\d+(?:\.\d+)*)\.?\s/.exec(htext(h));
      if (m && !byNum.has(m[1])) byNum.set(m[1], h);
    });
    const SKIP = 'a,code,pre,h1,h2,h3,h4,h5,h6,.mermaid,svg,script,style';
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.includes('§') && !n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const RE = /§\s?(\d+(?:\.\d+)*)/g;
    nodes.forEach((node) => {
      const text = node.nodeValue;
      const out = document.createDocumentFragment();
      let last = 0, any = false, m;
      RE.lastIndex = 0;
      while ((m = RE.exec(text))) {
        const h = byNum.get(m[1]);
        if (!h) { if (!secRefs.unresolved.includes(m[0])) secRefs.unresolved.push(m[0]); continue; }
        out.append(text.slice(last, m.index));
        const a = document.createElement('a');
        a.className = 'sec-ref';
        a.href = `#${h.id}`;
        a.textContent = m[0];
        a.title = htext(h);
        out.append(a);
        last = m.index + m[0].length; any = true; secRefs.linked++;
      }
      if (!any) return;
      out.append(text.slice(last));
      node.replaceWith(out);
    });
  }

  function classifyMdLink(a, isRelative, decode) {
    const h = a.getAttribute('href') || '';
    if (/^mailto:/i.test(h)) return;                                  // 메일: target 없음
    if (h.startsWith('#')) return;                                    // 같은 문서 안: 같은 탭
    if (/^https?:/i.test(h) || /^[a-z][a-z0-9+.-]*:/i.test(h)) return markNewTab(a);   // 외부
    if (h.startsWith('/')) return markNewTab(a);
    if (!isRelative(h)) return;
    const k = h.indexOf('#');
    const path = decode(k < 0 ? h : h.slice(0, k)).replace(/^\.\//, '');
    const frag = k < 0 ? '' : h.slice(k);
    if (!path || path === p.doc) { a.setAttribute('href', frag || '#top'); return; }      // 자기 문서: 같은 문서 안 앵커
    const other = /^\.\.\/([^/]+)\/[^/]+\.md$/i.exec(path);
    if (other) { a.setAttribute('href', `${PF.docUrl(other[1])}${frag}`); return markNewTab(a); }   // 다른 프로젝트의 문서 → 그 상세 문서
    a.setAttribute('href', srcPath(path) + frag);                      // 그 밖의 상대 파일: 원문 파일
    markNewTab(a);
  }

  function trackSection(list) {
    const links = new Map([...document.querySelectorAll('#toc-links a')].map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const tocBox = document.getElementById('toc-links');                // 직접 수정: 목차에서 스크롤하는 것은 목록 칸(doc.css '목차')
    let cur, t = 0;   // 직접 수정: 오른쪽 칸 '지금 읽는 절' 카드 없앰(목차 강조와 겹침)
    // 직접 수정: 목차·본문 링크로 고른 제목(pin)은 누른 순간부터 강조 — 이동하는 동안(travel)에도 30% 선 계산을 쓰지 않아,
    //   장 제목을 누르면 지나가는 첫 절이 잠깐 강조됐다가 장 제목으로 바뀌는 일이 없음. 스크롤이 멈추면(settle: 150ms 동안 스크롤 없음 · 늦어도 4초)
    //   그 자리(pin.y)를 기억하고, 손으로 스크롤해 그 자리를 벗어나면 다시 30% 선 기준. 맨 아래라 제목이 맨 위까지 오지 못해도 멈춘 자리에서는 고른 제목 그대로
    let pin = null, settleT = 0, capT = 0;
    const settle = () => { clearTimeout(settleT); if (!pin || pin.settled) return; clearTimeout(capT); pin.settled = true; pin.y = scrollY; cur = undefined; update(); };
    const armSettle = () => { clearTimeout(settleT); settleT = setTimeout(settle, 150); };
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a) return;
      let id = a.hash.slice(1); try { id = decodeURIComponent(id); } catch { /* 그대로 */ }
      const el = document.getElementById(id);
      pin = list.includes(el) ? { el, settled: false, y: 0 } : null;
      if (pin) { armSettle(); clearTimeout(capT); capT = setTimeout(settle, 4000); cur = undefined; update(); }   // 누른 순간 강조
    });
    const update = () => {
      t = 0;
      let c = null;
      for (const h of list) { if (h.getBoundingClientRect().top <= innerHeight * 0.3) c = h; else break; }   // 화면 위 30% 선을 지난 마지막 제목
      if (list.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 2) c = list[list.length - 1];   // 맨 아래까지 내리면 마지막 제목(짧은 마지막 절은 30% 선에 닿지 못함)
      if (pin) { if (!pin.settled || Math.abs(scrollY - pin.y) <= 4) c = pin.el; else pin = null; }   // 이동 중·멈춘 자리 = 고른 제목, 손으로 벗어나면 놓음
      if (c === cur && cur !== undefined) return;
      cur = c;
      links.forEach((a) => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
      if (!c) return;
      const a = links.get(c.id);
      if (a) {
        a.classList.add('active'); a.setAttribute('aria-current', 'location');
        if (tocBox && tocBox.scrollHeight > tocBox.clientHeight) {
          const top = a.offsetTop, bottom = top + a.offsetHeight;
          // 직접 수정: 목록이 지금 절로 순간 이동하지 않고 부드럽게 따라감(움직임 줄이기 설정이면 바로)
          const tail = +document.documentElement.dataset.sideTail || 0;   // 직접 수정: 맨 아래 띠가 덮는 아래 높이는 피함(common.js fitSides)
          if (top < tocBox.scrollTop + 40 || bottom > tocBox.scrollTop + tocBox.clientHeight - 40 - tail) tocBox.scrollTo({ top: Math.max(0, top - tocBox.clientHeight / 3), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }
      }
    };
    addEventListener('scroll', () => { if (pin && !pin.settled) armSettle(); if (!t) t = setTimeout(update, 60); }, { passive: true });   // rAF 대신 setTimeout(가려진 창에서도 동작)
    addEventListener('resize', () => { cur = undefined; update(); });
    update();
  }

  // 직접 수정(2026-11-27): 확대 창 닫기 버튼 글자 = 슬라이드 개요 창 안내(deck-kit.js ovHintHTML)와 같은 표기 — 기능 글자 + 단축키 회색, mac은 Esc를 ⎋로
  function closeHTML() {
    const raw = PF.t('ui.close-esc').trim(), m = raw.match(/^(\S+)\s+([\s\S]+)$/);
    if (!m) return PF.esc(raw);
    const keys = /Mac|iPhone|iPad/.test(navigator.platform) ? m[2].replace(/\bEsc\b/g, '⎋') : m[2];
    return `${PF.esc(m[1])} <span class="k">${PF.esc(keys)}</span>`;
  }

  function lightbox() {
    const dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', '크게 보기');
    dlg.innerHTML = `<div class="lb-stage"></div><p class="lb-cap"></p><button type="button" class="btn lb-close">${closeHTML()}</button>`;
    dlg.addEventListener('click', (e) => {
      const pb = e.target.closest('.pf-vid-btn');   // 확대 창의 영상: 일시정지·재생 버튼만 영상을 멈춤·재생(영상을 누르면 닫힘)
      if (pb) { const v = dlg.querySelector('video'); if (v) { const stop = !v.paused; if (stop) v.pause(); else v.play().catch(() => {}); pb.innerHTML = PF.videoIcon(stop); pb.setAttribute('aria-label', PF.t(stop ? 'ui.video-play' : 'ui.video-pause')); } return; }
      if (e.target === dlg || e.target.closest('.lb-close') || e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || (e.target.closest('.lb-svg svg') && !e.target.closest('a'))) dlg.close();
    });
    dlg.addEventListener('close', () => { dlg.querySelector('.lb-stage').innerHTML = ''; });   // 영상은 닫으면 멈춤
    document.body.appendChild(dlg);
    return ({ src, svg, caption, video }) => {
      const st = dlg.querySelector('.lb-stage');
      st.className = svg ? 'lb-stage lb-svg' : 'lb-stage';
      st.innerHTML = '';
      if (svg) {
        // mermaid 색 규칙은 SVG id(#mmd-n …)에 묶여 있어서, 복제본은 새 id로 바꾸고 규칙의 id도 같이 바꿈(id를 지우면 색이 빠져 검게 보임)
        const c = svg.cloneNode(true), old = svg.id;
        c.id = 'mmd-lightbox';
        if (old) { const re = new RegExp(`#${old.replace(/[^\w-]/g, '\\$&')}(?![\\w-])`, 'g'); c.querySelectorAll('style').forEach((s) => { s.textContent = s.textContent.replace(re, '#mmd-lightbox'); }); }
        c.removeAttribute('aria-hidden'); c.style.maxWidth = 'none'; st.appendChild(c);
      }
      else if (video) {   // 움직이는 이미지(영상): 크게 틀고, 일시정지·재생 버튼은 오른쪽 아래
        const w = document.createElement('div'); w.className = 'lb-vid';
        w.innerHTML = `<video autoplay muted loop playsinline poster="${PF.esc(src)}" aria-label="${PF.esc(caption || '')}">${PF.videoSources(video)}</video><button type="button" class="pf-vid-btn" aria-label="${T('ui.video-pause')}">${PF.videoIcon(false)}</button>`;
        w.querySelector('video').muted = true; st.appendChild(w);
      }
      else { const im = new Image(); im.src = src; im.alt = caption || ''; st.appendChild(im); }
      dlg.querySelector('.lb-cap').textContent = caption || '';
      dlg.showModal();
    };
  }

  function ready() {
    // 목차 서랍(< 1280px): 같은 탭, 고르면 닫힘
    const dlg = document.querySelector('.toc-dialog');
    document.querySelector('.fab-toc').addEventListener('click', () => dlg.showModal());
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.dlg-close') || e.target.closest('a')) dlg.close(); });

    // 딥링크: #sec=<절 제목> → 정규 앵커 #<slug>로 바꾸고 도착 강조, 그냥 #<slug>(슬라이드·옛 주소)도 도착 강조
    const flash = (el) => { el.classList.add('arrive'); setTimeout(() => el.classList.remove('arrive'), 2100); };
    const arrive = (el) => {
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
      flash(el); hold(el);
    };
    const hashText = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } };
    const raw = hashText();
    if (raw.startsWith('sec=')) {
      const el = window.PFDoc?.resolve(raw.slice(4));
      if (el) { history.replaceState(history.state, '', `#${el.id}`); arrive(el); } else console.warn('[doc] #sec= 제목을 찾지 못함 → 맨 위:', raw.slice(4));
    } else if (raw) {
      const el = document.getElementById(raw);
      if (el) arrive(el); else if (raw !== 'top') console.warn('[doc] 조각에 맞는 제목이 없음 → 맨 위:', raw);
    }
    // 같은 문서 안 이동(목차·앵커): 브라우저가 옮긴 뒤 도착 강조 + 붙잡기
    addEventListener('hashchange', () => { const el = document.getElementById(hashText()); if (el && el.matches('h1,h2,h3,h4,h5,h6')) { flash(el); hold(el); } });
    addEventListener('pf-anchor', (e) => { const el = e.detail?.el; if (el && el.matches('h1,h2,h3,h4,h5,h6')) { flash(el); hold(el); } });   // 직접 추가: 주소를 바꾸지 않는 이동(page-anchor.js)도 같은 도착 강조
  }

  // 도착한 제목 붙잡기 — md 그림에는 크기 정보가 없어서, 제목에 도착한 뒤 위쪽 그림이 늦게 들어오면 제목이 화면 아래로 밀립니다
  //   (브라우저 스크롤 고정이 바로 위 그림 문단을 기준으로 잡을 때. doc.css의 overflow-anchor: none과 함께 막음. 스크롤 고정이 없는 브라우저도 이것으로 막음).
  //   그림이 들어오거나 본문 높이가 바뀔 때마다 제목을 제자리로 되돌리고, 읽는 사람이 직접 움직이면(휠·터치·키·마우스) 바로 놓습니다.
  //   그림이 다 들어오면 또는 30초가 지나면 끝. rAF를 쓰지 않음(가려진 창에서도 동작).
  function hold(el) {
    releaseHold?.();
    const md = document.getElementById('doc');
    if (!md) return;
    const pending = () => [...md.querySelectorAll('img')].some((i) => !i.complete);
    if (!pending()) return;
    const USER = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'mousedown'];
    let ro = null, timer = 0;
    const stop = () => {
      md.removeEventListener('load', onMedia, true); md.removeEventListener('error', onMedia, true);
      ro?.disconnect(); clearTimeout(timer);
      USER.forEach((t) => removeEventListener(t, stop, true));
      releaseHold = null;
    };
    const fix = () => {
      const want = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      if (Math.abs(el.getBoundingClientRect().top - want) > 1) el.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (!pending()) stop();
    };
    function onMedia(e) { if (e.target instanceof HTMLImageElement) fix(); }
    md.addEventListener('load', onMedia, true); md.addEventListener('error', onMedia, true);
    if ('ResizeObserver' in window) {                                  // 첫 알림(관찰 시작)은 건너뜀 → 목차 클릭의 부드러운 스크롤을 끊지 않음
      let first = true;
      ro = new ResizeObserver(() => { if (first) { first = false; return; } fix(); });
      ro.observe(md);
    }
    USER.forEach((t) => addEventListener(t, stop, { capture: true, passive: true }));
    timer = setTimeout(stop, 30000);
    releaseHold = stop;
  }

  // 준비 신호(점검 하네스용): 문서·Mermaid·코드 처리와 글꼴이 끝난 뒤
  function done() {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      html.dataset.docReady = '1'; performance.mark?.('pf-doc-ready'); resolveReady(report());
      if (new URLSearchParams(location.search).get('pf-audit') === '1') writeAudit();
    });
  }
  // ?pf-audit=1(headless 점검용): 그림까지 받은 뒤(최대 15초) #pf-audit에 report()의 base64 JSON — 슬라이드·포트폴리오 페이지와 같은 형식
  async function writeAudit() {
    const imgs = [...document.querySelectorAll('#doc img')];
    imgs.forEach((i) => { i.loading = 'eager'; });
    await Promise.race([Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }))), sleep(15000)]);
    let pre = document.getElementById('pf-audit');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'pf-audit'; pre.hidden = true; pre.style.display = 'none'; document.body.appendChild(pre); }
    const bytes = new TextEncoder().encode(JSON.stringify(report()));
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    pre.textContent = btoa(bin);
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
})();
