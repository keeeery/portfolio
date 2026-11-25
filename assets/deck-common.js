// 슬라이드 장면 공통 — project.html(슬라이드)가 common.js 다음에 싣습니다. 출처: spikes/deck/pages/pf-common.js
//   장면 틀 scene()(제목 + 도입 1~2줄, 결정 G7), 측정 후 고르기 pack(), 넘침 처리 shrinkOrClip()(§4-3 원칙 5: 변형 → 축소 → 보이는 잘림 띠),
//   글자 하한(결정 G5: 본문 14 · 코드 12 · 라벨 11px), 세로 가운데(.pf-fill, G8)·채움률, 시각 자료 맞추기(fitVisuals), 프로젝트 소개 장면, 글꼴·이미지 크기 대기
//   주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
(() => {
  const { esc, inline } = PF;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 영문 라벨 글꼴(--display의 첫 이름): 기본 Montserrat, theme/theme.css의 --t-display가 바꿀 수 있음. Pretendard면 따로 받지 않음
  function displayFont() {
    const f = getComputedStyle(document.documentElement).getPropertyValue('--display').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    return f && !/^pretendard$/i.test(f) ? `"${f}"` : null;
  }
  // 글꼴: 굵기마다 load + 각각 catch → fonts.ready, 상한 8초. 실패하면 data-pf-font="fallback"(늦게 들어오면 페이지가 다시 그림)
  async function loadFonts(sample = '가나다ABC123', ms = 8000) {
    const disp = displayFont();
    const want = ['400', '600', '700', '800'].map((w) => `${w} 16px Pretendard`).concat(disp ? [`700 16px ${disp}`, `800 16px ${disp}`] : [], ['400 14px D2Coding', '400 14px "JetBrains Mono"']);   // disp = 영문 라벨(눈썹 글자·목차 머리)
    const errs = [];
    const CODE_SAMPLE = 'public void {}();=<>[]0Oil|';                    // 코드 블록 글자(영문·기호)로도 받음 — 한글 표본만으로는 코드 글꼴 조각이 늦게 올 수 있음
    const all = Promise.all(want.map((f) => document.fonts.load(f, /D2Coding|JetBrains/.test(f) ? sample + CODE_SAMPLE : sample).then((r) => { if (!r.length) errs.push(f + ' (일치 없음)'); }).catch((e) => errs.push(f + ' ' + e))))
      .then(() => document.fonts.ready);
    const timedOut = await Promise.race([all.then(() => false), sleep(ms).then(() => true)]);
    const ok = want.map((f) => document.fonts.check(f, '가'));
    if (timedOut || ok.some((x) => !x)) document.documentElement.dataset.pfFont = 'fallback';
    else delete document.documentElement.dataset.pfFont;
    return { timedOut, errs, check: Object.fromEntries(want.map((f, i) => [f, ok[i]])) };
  }

  // 이미지 크기: data에 media w×h 기록이 아직 없으므로(Q12) 머리만 받아서 잼. rAF·decode() 금지 → setTimeout 폴링
  const dimCache = new Map();
  function imageSize(src) {
    src = PF.videoPoster(src);   // 움직이는 이미지(.mp4)는 대표 화면으로 잼
    if (dimCache.has(src)) return dimCache.get(src);
    const p = new Promise((res) => {
      const im = new Image();
      let done = false;
      const fin = () => { if (done) return; done = true; res(im.naturalWidth ? { w: im.naturalWidth, h: im.naturalHeight } : null); };
      im.onload = fin; im.onerror = fin;
      im.src = src;
      const poll = () => { if (done) return; if (im.naturalWidth) fin(); else setTimeout(poll, 15); };
      poll();
    });
    dimCache.set(src, p);
    return p;
  }

  // 측정용 컨테이너: 이 안의 장면은 배율 1
  let measure = null;
  function measureRoot() {
    if (!measure || !measure.isConnected) { measure = document.createElement('div'); measure.className = 'pf-measure'; measure.setAttribute('aria-hidden', 'true'); document.body.appendChild(measure); }
    return measure;
  }
  function dropMeasure() { measure?.remove(); measure = null; }

  // 장면 틀. kind: 'sum'(eyebrow │ 오른쪽 라벨 줄 + 제목 줄) | 'bare'(머리 없음: 표지·목차·맺음)
  //   id = 안정 장면 id(#s=<id> 공유 주소·장면 안 링크 목적지), sec = HUD·개요의 섹션명, stitle = 낭독·개요용 제목, group = 개요 묶음 이름
  //   lead = 제목 아래 도입 1~2줄(머리 높이가 그만큼 늘고 본문 상자가 줄어듦, 결정 G7). 머리는 축소하지 않음
  //   rhtml = 오른쪽 라벨 자리에 넣을 HTML(직접 고침 2026-11-25: 상세 문서 링크) — rlabel보다 먼저
  function scene({ id = '', tpl, part = 'summary', kind = 'sum', eyebrow = '', rlabel = '', rhtml = '', title = '', sub = '', pill = '', lead = '', cls = '', foot = '', titleTag = 'h2', sec = '', stitle = '', group = '' }) {
    const s = document.createElement('section');
    s.className = `pf-scene pf-${kind} t-${tpl}${cls ? ' ' + cls : ''}`;
    if (id) s.id = id;
    s.dataset.pfTpl = tpl; s.dataset.pfPart = part;
    if (sec) s.dataset.sec = sec;
    if (stitle) s.dataset.title = stitle;
    if (group) s.dataset.group = group;
    const row = (right) => `<div class="pf-headrow"><p class="pf-eyebrow">${esc(eyebrow)}</p>${right}</div>`;
    const head = kind === 'bare' ? ''
      : `<header class="pf-head" data-pf-ui="chrome">${row(rhtml ? `<p class="pf-rlabel">${rhtml}</p>` : rlabel ? `<p class="pf-rlabel">${esc(rlabel)}</p>` : '')}${title ? `<div class="pf-titlerow"><${titleTag} class="pf-title">${inline(title)}${sub ? `<span class="pf-part" data-pf-ui="cont" aria-hidden="true">${esc(sub)}</span>` : ''}</${titleTag}>${pill ? `<span class="pill">${inline(pill)}</span>` : ''}</div>` : ''}${lead ? `<p class="pf-lead">${inline(lead)}</p>` : ''}</header>`;
    s.innerHTML = `${head}<div class="pf-body"></div>` +
      `<footer class="pf-foot" data-pf-ui="chrome"><span>${esc(foot)}</span><span class="pf-num"><span class="pf-n-screen"></span><span class="pf-n-print"></span></span></footer>`;
    return s;
  }
  const body = (s) => s.querySelector(':scope > .pf-body');
  // 장면이 넘치지 않는가(배치용: 이미지 로딩·숨김 검사는 빼고 키트 감사의 배치 항목만)
  const fitsScene = (s) => window.PFScene.sceneIssues(s, { layoutOnly: true }).length === 0;
  const fitsM = (s) => { const M = measureRoot(); M.appendChild(s); const ok = fitsScene(s); s.remove(); return ok; };

  // 측정 후 고르기(§4-3 원칙 1): 항목을 장면에 하나씩 넣어 보고, 우선순위대로 변형을 시험해 넘치지 않는 첫 변형을 씀
  //   build(chunk, variant, i, n) → 장면 요소. variants: [{ name, min, max }]
  function pack(items, variants, build) {
    const M = measureRoot();
    const tryFit = (chunk) => {
      for (const v of variants) {
        if (chunk.length < (v.min || 1) || chunk.length > (v.max || 99)) continue;
        const s = build(chunk, v.name, 0, 1); M.appendChild(s);
        const ok = fitsScene(s); s.remove();
        if (ok) return v.name;
      }
      return null;
    };
    const pages = []; let cur = [];
    for (const it of items) {
      const trial = cur.concat([it]);
      if (tryFit(trial)) { cur = trial; continue; }
      if (cur.length) pages.push(cur);
      cur = [it];
    }
    if (cur.length) pages.push(cur);
    if (pages.length > 1) {                                  // 균형: 마지막 장면이 1개뿐이고 앞 장면이 3개 이상이면 하나 옮김
      const a = pages[pages.length - 2], b = pages[pages.length - 1];
      if (b.length === 1 && a.length >= 3) { const na = a.slice(0, -1), nb = [a[a.length - 1], ...b]; if (tryFit(na) && tryFit(nb)) { pages[pages.length - 2] = na; pages[pages.length - 1] = nb; } }
    }
    return pages.map((chunk) => ({ chunk, variant: tryFit(chunk) }));   // variant null = 가장 넓은 변형에도 안 들어감(원칙 5로)
  }

  // ── 글자 하한(결정 G5): 본문 14 · 코드 12 · 라벨 11px. 장면 본문의 보이는 글자를 셋으로 나눠 가장 작은 크기를 잼 ──
  //   .fit-in(시각 자료 맞추기로 이미 줄인 코드·표)은 data-pf-fz 배율을 곱해 실제 크기로 셈. SVG(다이어그램) 글자는 따로(tiny-diagram 참고)
  const FLOOR = { body: 14, code: 10.5, label: 11 };   // 직접 고침(2026-11-24): 코드 하한 12 → 10.5px — 코드 글꼴이 JetBrains Mono(글자 폭 0.6em)라 같은 폭 기준으로 예전 D2Coding 12px(0.5em)에 해당
  const CODE_SEL = 'pre, code, kbd, .url, .pg, .mono';
  const LABEL_SEL = '.fe-a, .pf-eyebrow, .pf-rlabel, .pf-part, .tags li, .badge, .labelchip, .toc-lb, .nlabel, figcaption, .chip, th, .lb, .lk a, .pc-links b, .cv-lb, .rl, .toc-sub, .kick, .cap, .ix, .lc-k, .meta-k, .fe-k, .num, .toc-list .n';
  function minFonts(root) {
    const m = { body: Infinity, code: Infinity, label: Infinity };
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.data.trim()) continue;
      const e = n.parentElement;
      if (!e || e.closest('svg, .pf-sr-only, [data-pf-ui], .pf-vband') || !e.getClientRects().length) continue;
      const fz = e.closest('[data-pf-fz]');
      const px = parseFloat(getComputedStyle(e).fontSize) * (fz ? +fz.dataset.pfFz : 1);
      const c = e.closest(CODE_SEL) ? 'code' : e.closest(LABEL_SEL) ? 'label' : 'body';
      if (px < m[c]) m[c] = px;
    }
    return m;
  }
  // 줄일 수 있는 가장 작은 배율 = 분류마다 (하한 ÷ 지금 가장 작은 글자) 중 가장 큰 값. 1 이상이면 줄이지 못함
  const minZoom = (root) => { const m = minFonts(root); return Math.max(...Object.keys(FLOOR).map((c) => (m[c] === Infinity ? 0 : FLOOR[c] / m[c]))); };

  // §4-3 원칙 5의 ②③: 장면 본문을 글자 하한까지 비례 축소 → 그래도 넘치면 보이는 잘림 띠 + 리포트
  function shrinkOrClip(s, srcUrl, stats) {
    const b = body(s);
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    let z = 1;
    if (!fitsScene(s)) {
      stats?.push({ tpl: s.dataset.pfTpl, action: 'overflow', issues: window.PFScene.sceneIssues(s, { layoutOnly: true }).slice(0, 4) });
      const zmin = Math.min(1, minZoom(b));
      if (zmin < 1) {                                                    // 이미 하한이면 감싸지 않음(크기 없는 감싸개가 세로 가운데를 깸)
        const w = document.createElement('div'); w.className = 'pf-zoomwrap'; w.append(...b.childNodes); b.appendChild(w);
        const bw = b.clientWidth, bh = b.clientHeight;
        while (!fitsScene(s) && z > zmin + 1e-9) {
          z = Math.max(+(z - 0.01).toFixed(2), zmin);
          Object.assign(w.style, { zoom: String(z), width: `${bw / z}px`, height: `${bh / z}px` });
        }
      }
      stats?.push({ tpl: s.dataset.pfTpl, action: 'shrink', zoom: +z.toFixed(4), floor: +zmin.toFixed(4) });
      if (!fitsScene(s)) note(s.id, 'font-floor', +zmin.toFixed(3), `글자 하한(본문 14·코드 12·라벨 11px)에 닿아 더 줄이지 못함`);
    }
    if (!fitsScene(s)) {
      const c = document.createElement('div');
      c.className = 'pf-clipped'; c.dataset.pfUi = 'clip';
      c.textContent = `내용이 잘렸습니다 → 원문: ${srcUrl}`;
      s.appendChild(c);
      stats?.push({ tpl: s.dataset.pfTpl, action: 'clipped' });
    }
    if (!wasIn) s.remove();
    return s;
  }
  // 맞으면 그대로, 아니면 원칙 5
  const guard = (s, srcUrl, stats) => (fitsM(s) ? s : shrinkOrClip(s, srcUrl, stats));

  // 안내 장면(데이터 없음·file:// 등). 글은 옛 렌더러의 안내 문구
  function msgScene({ id = 'notice', title, html, foot = '', eyebrow = 'PORTFOLIO' }) {
    const s = scene({ id, tpl: 'msg', kind: 'bare', foot, sec: '안내', stitle: title });
    body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(eyebrow)}</span></div><div class="msg"><h1>${esc(title)}</h1><div class="msg-b">${html}</div></div>`;
    return s;
  }

  // 참고 슬라이드 모티프: 점 선(2px 선 + 14px 점)
  const DOT = '<div class="dotrule" aria-hidden="true"><span class="ln"></span><span class="dot"></span></div>';
  const imgTag = (src, alt, d, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${esc(PF.videoPoster(src))}" alt="${esc(alt)}" loading="lazy" decoding="async"${d ? ` width="${d.w}" height="${d.h}"` : ''}>`;

  // 프로젝트 외부 링크(시연 영상 · GitHub · 그 밖의 링크) — data 순서 그대로. type으로 영문 라벨을 고름(보이는 이름은 문구 표에서 바뀔 수 있음)
  const extLinks = (p) => [
    PF.isUrl(p.links?.video) && { type: 'video', label: PF.t('name.video'), url: p.links.video },
    ...PF.repoLinks(p).map((r) => ({ type: 'github', label: r.label, url: r.url })),   // 저장소가 둘 이상이면 'GitHub(역할)'
    ...PF.otherLinks(p).map((l) => ({ type: 'extra', label: l.label, url: l.url, extra: true })),
  ].filter(Boolean);
  const EXT_EN = { video: 'en.gameplay', github: 'en.repo' };
  const extEn = (l) => PF.t(EXT_EN[l.type] || 'en.link');

  // 늦게 들어온 글꼴로 다시 그리기(R0 설계 공백 1: 게이트의 fonts.ready는 그리기만 지키고 측정·나눔은 지키지 못함)
  function refitOnLateFont(render) {
    if (document.documentElement.dataset.pfFont !== 'fallback' || !document.fonts) return;
    let done = false;
    const disp = displayFont();
    document.fonts.addEventListener('loadingdone', () => {
      if (done || !document.fonts.check('700 16px Pretendard', '가') || (disp && !document.fonts.check(`800 16px ${disp}`, 'A')) || !document.fonts.check('400 14px D2Coding', '{}();') || !document.fonts.check('400 14px "JetBrains Mono"', '{}();')) return;
      done = true;
      window.PFScene.track(render().then(() => window.PFScene.refresh()));
    });
  }

  // ── 참고 지표(결정 G8): 빨간 배지·audit에 넣지 않고 report().info.notes에만. {id, type, value, detail} — 장면 번호는 report()가 채움 ──
  //   type: low-fill(채움률 60% 미만) · tiny-diagram(다이어그램 실효 글자 10px 미만) · long-code(30줄 넘어 나뉨) · many-scenes(30장 초과) · auto-mode · font-floor
  function note(id, type, value, detail = '') {
    const info = window.PFScene.info || (window.PFScene.info = {});
    (info.notes || (info.notes = [])).push({ id, type, value, detail });
  }
  // 채움률 = 본문 상자 높이 중 내용이 차지한 비율(배율 1의 측정 컨테이너에서)
  function fillOf(s) {
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    const b = body(s); let f = 1;
    if (b && b.clientHeight) {
      const box = b.querySelector(':scope > .pf-zoomwrap') || b;
      const br = b.getBoundingClientRect(); let top = Infinity, bot = -Infinity;
      for (const k of box.children) { const r = k.getBoundingClientRect(); if (!r.height) continue; top = Math.min(top, r.top); bot = Math.max(bot, r.bottom); }
      f = top === Infinity ? 0 : Math.min(1, (bot - top) / br.height);
    }
    if (!wasIn) s.remove();
    return f;
  }
  // 최종 장면들의 참고 지표: 채움률 60% 미만(표지·목차·장 표지 같은 bare 장면은 레이아웃이 정하므로 빼고), 다이어그램 실효 글자 10px 미만
  //   detail에 원인을 적음(리포트 안내를 원인별로, /portfolio-build SKILL §7-1): 다이어그램은 폭·높이 중 무엇에 막혔는지, 채움률은 장면에 든 것
  const KIND = { mermaid: '다이어그램', table: '표', code: '코드', image: '그림' };
  function noteFill(scenes, { fill = true } = {}) {
    scenes.forEach((s) => {
      s.querySelectorAll('.vbox[data-eff]').forEach((b) => {
        if (b.dataset.split) {                                           // 직접 추가(2026-11-25): 두 도막으로 나눈 다이어그램
          const p = JSON.parse(b.dataset.split);
          note(s.id, 'split-diagram', +(+b.dataset.eff).toFixed(1), `세로로 긴 다이어그램을 두 도막으로 나눔(글자 약 ${Math.round(+b.dataset.eff0)}px → ${Math.round(+b.dataset.eff)}px, 잘린 선 ${p.xs.length}개)`);
        }
        const eff = +b.dataset.eff; if (eff >= 10) return;
        const why = { h: '세로로 긴 그림 — 높이에 막힘', w: '가로로 긴 그림 — 폭에 막힘', multi: '다른 자료와 한 장면 — 나누면 커짐' }[b.dataset.lim] || '';
        note(s.id, 'tiny-diagram', +eff.toFixed(1), `다이어그램 글자가 약 ${Math.round(eff)}px로 작음${why ? `(${why}, ${b.dataset.vb})` : ''}`);
      });
      if (!s.classList.contains('pf-sum')) return;
      const f = fillOf(s);
      s.dataset.pfFill = f.toFixed(2);
      if (fill && f < 0.6 && !s.querySelector('.vbox.err')) {           // 원문을 못 찾은 자리가 있으면 그 문제(감사 visual-*)가 먼저
        const kinds = [...s.querySelectorAll('.vbox[data-kind]')].map((b) => KIND[b.dataset.kind] || b.dataset.kind);
        note(s.id, 'low-fill', +f.toFixed(2), `본문 상자의 ${Math.round(f * 100)}%만 채움(${kinds.length ? [...new Set(kinds)].join('·') : '글만'})`);
      }
    });
  }

  // ── 원문 블록 문제 띠(배포·PDF에도 보임 → 조용히 비지 않음). audit type = data-pf-visual-err ──
  const VBAND = { 'visual-missing': '원문에서 찾지 못했습니다', 'visual-ambiguous': '원문 위치가 여러 곳입니다', 'visual-changed': '원문이 바뀌었습니다' };
  //   edited = 장면 고치기(src/<폴더>/deck-edits.json)로 고친 장면: 빌드가 아니라 /portfolio-edit로 고쳐야 함
  const vband = (type, detail, edited) => `<div class="pf-vband" data-pf-visual-err="${esc(type)}" role="note"><b>${esc(VBAND[type] || type)}</b> → ${edited ? '고친 장면입니다. /portfolio-edit로 고치세요' : '/portfolio-build를 다시 실행하세요'}<span>${esc(detail || '')}</span></div>`;

  // ── 시각 자료 맞추기: .vis 안의 .vbox(그림·다이어그램·코드·표)를 칸에 맞춰 크기를 정함 ──
  //   1) 장면에 .pf-sizing을 붙여 .vis가 쓸 수 있는 칸 크기(W×H)를 잼  2) 한 개/세로로 쌓기/가로로 늘어놓기 중 가장 크게 보이는 배치
  //   3) 크기를 px로 적고 .pf-sizing을 떼면 내용 높이만큼만 차지 → .pf-fill이 세로 가운데로
  //   코드·표는 CSS zoom으로 줄임(글자 하한: 코드 12/14, 표 14/15). 하한 아래로는 줄이지 않고 넘침으로 둠(→ 변형·나눔·잘림 띠)
  //   다이어그램은 줄임(Q9). 실효 글자 = 16px × 표시 폭 ÷ viewBox 폭, 10px 미만이면 tiny-diagram 참고
  //   직접 추가(2026-11-25): 슬라이드 공용 — 세로로 긴 다이어그램의 실효 글자가 SPLIT_EFF 미만이면 칸이 없는 빈 줄에서 위·아래 두 도막으로 잘라
  //   왼쪽(위 도막) → 오른쪽(아래 도막)으로 나란히 놓음(같은 SVG를 두 번, viewBox만 다르게). 글자가 SPLIT_GAIN배 이상 커질 때만. 시퀀스 다이어그램은 제외(참여자 머리가 위에만 있음)
  //   자를 곳은 칸·글자가 없는 빈 줄 중 높이의 35~65% 안, 잘리는 선 SPLIT_CROSS개 이하. 없으면 나누지 않음
  //   잘린 선에는 양쪽 끝에 같은 번호 표시. 상세 문서·원문은 그대로. 나눈 그림은 report().info.notes의 split-diagram
  const GAP = 16;
  const SPLIT_EFF = 12, SPLIT_GAIN = 1.2, SPLIT_SEP = 40, SPLIT_CROSS = 2;   // SPLIT_SEP = 두 도막 사이(viewBox 단위) · SPLIT_CROSS = 잘려도 되는 선 수
  // 그린 SVG(화면에 붙어 있을 때)에서 자를 높이를 고름: 칸·선 글자·묶음이 없는 빈 줄 중 두 도막 높이의 큰 쪽이 가장 작고 잘리는 선이 적은 곳
  function planSplit(svg) {
    const vb = svg.viewBox?.baseVal; if (!vb?.width || !vb?.height || !svg.getScreenCTM()) return null;
    if (svg.getAttribute('aria-roledescription') === 'sequence' || svg.querySelector('.actor')) return null;
    const inv = svg.getScreenCTM().inverse();
    const box = (el) => {                                                // 요소의 bbox → SVG(viewBox) 좌표의 위·아래·왼·오른
      let b; try { b = el.getBBox(); } catch { return null; }
      const ctm = el.getScreenCTM(); if (!ctm || !(b.width || b.height)) return null;
      const m = inv.multiply(ctm), pt = svg.createSVGPoint();
      const ps = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => { pt.x = x; pt.y = y; return pt.matrixTransform(m); });
      return { t: Math.min(...ps.map((p) => p.y)), b: Math.max(...ps.map((p) => p.y)), l: Math.min(...ps.map((p) => p.x)), r: Math.max(...ps.map((p) => p.x)) };
    };
    // 칸으로 보는 것: 선(path·line)이 아닌 모든 도형·글자(흐름도 칸, 상태 그림 메모, 선 글자, 묶음 테두리, 엔진이 그린 메모 상자). 화살촉 정의(defs·marker)는 뺌
    const solid = [...svg.querySelectorAll('g.node, g.cluster, g.note, rect, polygon, circle, ellipse, foreignObject, text, image')]
      .filter((e) => !e.closest('defs, marker, .pf-cont'))
      .map(box).filter((b) => b && b.b - b.t > 0.5 && b.r - b.l > 0.5);
    const paths = [...svg.querySelectorAll('path')].filter((p) => !p.closest('defs, marker') && !p.closest('g.node, g.cluster, g.note'))
      .map((p) => ({ p, bb: box(p) })).filter((x) => x.bb);
    const PAD = 16, top = vb.y, bot = vb.y + vb.height;                  // 자른 곳 위아래 여유 = 번호 표시(자른 곳에서 1~15)가 칸·글자에 닿지 않게
    const occ = solid.map((s) => [s.t - PAD, s.b + PAD]).sort((a, b) => a[0] - b[0]);
    const free = []; let y = top;
    for (const [a, b] of occ) { if (a > y) free.push([y, a]); y = Math.max(y, b); }
    if (y < bot) free.push([y, bot]);
    let best = null;
    for (const [a, b] of free) {
      const lo = Math.max(a, top + vb.height * 0.35), hi = Math.min(b, bot - vb.height * 0.35); if (lo > hi) continue;   // 두 도막이 비슷한 크기일 때만
      const cut = Math.min(hi, Math.max(lo, (top + bot) / 2));
      const cross = paths.filter((x) => x.bb.t < cut - 1 && x.bb.b > cut + 1);
      if (cross.length > SPLIT_CROSS) continue;                          // 잘리는 선이 많으면 번호가 흩어져 오히려 읽기 어려움
      const H = Math.max(cut - top, bot - cut), score = H + cross.length * vb.height * 0.03;
      if (!best || score < best.score) best = { cut, H, cross, score };
    }
    if (!best) return null;
    const xs = best.cross.map(({ p }) => {                               // 선이 자르는 높이를 지나는 x(길이를 따라 훑어 가장 가까운 점)
      const m = inv.multiply(p.getScreenCTM()), pt = svg.createSVGPoint(), L = p.getTotalLength(); let bx = null, bd = Infinity;
      for (let i = 0; i <= 200; i++) { const q = p.getPointAtLength(L * i / 200); pt.x = q.x; pt.y = q.y; const s = pt.matrixTransform(m); const d = Math.abs(s.y - best.cut); if (d < bd) { bd = d; bx = s.x; } }
      return bx;
    }).filter((x) => x !== null).sort((a, b) => a - b);
    // 도막마다 내용이 있는 좌우 범위만(위 도막 = 자른 곳 위의 칸·선, 아래 도막 = 아래의 것). 잘린 선은 자른 곳의 x를 양쪽에 넣음
    const span = (isTop) => {
      let l = Infinity, r = -Infinity;
      const inside = (bb) => (isTop ? bb.b <= best.cut + 1 : bb.t >= best.cut - 1);
      solid.forEach((bb) => { if (inside(bb)) { l = Math.min(l, bb.l); r = Math.max(r, bb.r); } });
      paths.forEach(({ bb }) => { if (inside(bb)) { l = Math.min(l, bb.l); r = Math.max(r, bb.r); } });
      xs.forEach((x) => { l = Math.min(l, x - 12); r = Math.max(r, x + 12); });
      return l === Infinity ? [vb.x, vb.width] : [Math.max(vb.x, l - 8), Math.min(vb.x + vb.width, r + 8) - Math.max(vb.x, l - 8)];
    };
    const [x1, w1] = span(true), [x2, w2] = span(false);
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height, cut: +best.cut.toFixed(1), H: +best.H.toFixed(1), xs: xs.map((x) => +x.toFixed(1)),
      x1: +x1.toFixed(1), w1: +w1.toFixed(1), x2: +x2.toFixed(1), w2: +w2.toFixed(1) };
  }
  // 나눈 모양으로 바꿈(plan = planSplit 결과). 화면 모드를 바꿔 다시 그린 뒤에도 같은 plan으로 다시 부름(PF.splitDiagram)
  function splitDiagram(box, plan) {
    const media = box.querySelector(':scope > .vmedia'), svg = media?.querySelector(':scope > svg'); if (!svg || !plan) return false;
    const part = (y0, first) => {
      const c = first ? svg : svg.cloneNode(true);
      c.setAttribute('viewBox', `${first ? plan.x1 : plan.x2} ${y0} ${first ? plan.w1 : plan.w2} ${first ? plan.cut - plan.y : plan.y + plan.h - plan.cut}`);   // 도막마다 자기 범위만(폭 비율로 칸을 나눠 같은 배율, 위에 붙임)
      c.setAttribute('preserveAspectRatio', 'xMidYMin meet');
      c.style.aspectRatio = `${first ? plan.w1 : plan.w2} / ${first ? plan.cut - plan.y : plan.y + plan.h - plan.cut}`;   // 상자 = 도막 비율(SVG는 상자에서 잘리므로 상자가 길면 자른 곳 너머가 보임)
      c.querySelectorAll(':scope > g.pf-cont').forEach((g) => g.remove());
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'pf-cont');
      plan.xs.forEach((x, i) => {                                         // 잘린 선 끝의 같은 번호(위 도막은 자른 곳 바로 위, 아래 도막은 바로 아래)
        const cy = first ? plan.cut - 8 : plan.cut + 8;
        g.insertAdjacentHTML('beforeend', `<circle cx="${x}" cy="${cy}" r="7"></circle><text x="${x}" y="${cy}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`);
      });
      c.appendChild(g);
      const d = document.createElement('div'); d.className = 'pf-mpart'; d.style.flexGrow = String(first ? plan.w1 : plan.w2); d.appendChild(c); return d;
    };
    const wrap = document.createElement('div'); wrap.className = 'pf-msplit';
    const a = part(plan.y, true), b = part(plan.cut, false);
    wrap.append(a, b);
    media.replaceChildren(wrap);
    box.dataset.split = JSON.stringify(plan);
    return true;
  }
  function unsplitDiagram(box) {
    const media = box.querySelector(':scope > .vmedia'), svg = media?.querySelector('.pf-msplit svg'); if (!svg || !box.dataset.split) return;
    const p = JSON.parse(box.dataset.split);
    svg.setAttribute('viewBox', `${p.x} ${p.y} ${p.w} ${p.h}`); svg.removeAttribute('preserveAspectRatio'); svg.style.aspectRatio = ''; svg.querySelectorAll(':scope > g.pf-cont').forEach((g) => g.remove());
    media.replaceChildren(svg); delete box.dataset.split;
  }
  // 직접 고침(2026-11-25): 슬라이드 전역 — 다이어그램은 실효 글자가 DIAG_MAX_PX(원래 22px) 이하일 때까지만 키움(16px 원본 글자 기준)
  const DIAG_MAX_PX = 15;
  function natOf(box) {
    const k = box.dataset.kind, media = box.querySelector(':scope > .vmedia');
    if (k === 'image') { const w = +box.dataset.w || 0, h = +box.dataset.h || 0; return { k, ar: w && h ? w / h : 16 / 9, max: w ? 1.25 : Infinity, nw: w || 1600 }; }
    if (k === 'mermaid' && box.dataset.split) {
      const p = JSON.parse(box.dataset.split), nw = p.w1 + p.w2 + SPLIT_SEP;
      return { k, ar: nw / p.H, nw, max: DIAG_MAX_PX / 16, split: true };
    }
    if (k === 'mermaid') {
      const svg = media.querySelector('svg'); const vb = svg?.viewBox?.baseVal;
      const w = vb?.width || 400, h = vb?.height || 300;
      return { k, ar: w / h, nw: w, max: DIAG_MAX_PX / 16 };               // 다이어그램 글자는 DIAG_MAX_PX까지만 키움
    }
    const fin = media.querySelector(':scope > .fit-in');
    Object.assign(fin.style, { zoom: '1', width: 'max-content' });
    // 표·코드: 높이는 놓일 폭에 따라 달라지므로 hAt(w)로 잼(배율 1)
    const hAt = (w) => { Object.assign(fin.style, { zoom: '1', width: `${Math.max(1, Math.floor(w))}px` }); return fin.offsetHeight; };
    // 직접 고침(2026-11-25): 코드는 글자 크기 고정(배율 1) — 칸 폭을 넘는 줄은 상세 문서처럼 줄바꿈(deck-theme.css .fit-in pre code)하고, 높이는 그 폭에서 잼
    if (k === 'code') { const nw = fin.offsetWidth, nh = fin.offsetHeight; return { k, code: true, ar: nw / Math.max(1, nh), nw, nh, max: 1, min: 1, hAt }; }
    return { k, table: true, min: 14 / 15, max: 1, hAt };
  }
  // 시각 자료 상자 안에서 그림 말고 차지하는 높이: 캡션 + 원문 문제 띠(visual-changed). 상자 안 간격 6px씩
  const capOf = (box) => [...box.querySelectorAll(':scope > figcaption, :scope > .pf-vband, :scope > .colhead')].reduce((a, c) => a + c.offsetHeight + 6
    + (c.classList.contains('colhead') ? (parseFloat(getComputedStyle(c).marginTop) || 0) + (parseFloat(getComputedStyle(c).marginBottom) || 0) : 0), 0);   // 직접 고침(2026-11-25): 위 소제목(.colhead)은 위아래 여백까지
  // 표: 폭 bw에서 높이 bh 안에 들어가는 가장 큰 배율(하한까지)
  function fitTable(fin, bw, bh, min) {
    const at = (z) => { Object.assign(fin.style, { zoom: String(z), width: `${bw / z}px` }); return fin.offsetHeight * z <= bh + 0.5 && fin.scrollWidth <= bw / z + 1; };
    if (at(1)) return 1;
    if (!at(min)) return min;
    let lo = min, hi = 1;
    for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; }
    at(lo);
    return lo;
  }
  function sizeBoxes(boxes, arr, W, H, capsIn) {
    const nat = boxes.map(natOf), caps = capsIn || boxes.map(capOf), n = boxes.length;
    const out = nat.map(() => ({ w: 0, h: 0 }));
    const contain = (i, w, h) => {
      const t = nat[i];
      if (t.table) return { w: Math.floor(w), h: Math.floor(h) };
      if (t.k === 'code') {                                              // 코드는 칸 폭을 다 쓰고(글자 크기 고정·줄바꿈), 높이는 그 폭에서 잰 값. 받은 높이를 넘으면 over
        const cw = Math.floor(Math.min(w, t.nw)), ch = t.hAt(cw);
        return { w: cw, h: ch, over: ch > h + 0.5 };
      }
      let bw = Math.min(w, h * t.ar);
      const lim = w <= h * t.ar ? 'w' : 'h';                             // 폭에 막힘(가로로 긴 그림) / 높이에 막힘(세로로 긴 그림)
      if (t.max !== Infinity && t.nw) bw = Math.min(bw, t.nw * t.max);
      return { w: Math.max(1, Math.floor(bw)), h: Math.max(1, Math.floor(bw / t.ar)), lim };
    };
    if (arr === 'one' || n === 1) out[0] = contain(0, W, H - caps[0]);
    else if (arr === 'col') {
      // 세로로 쌓기: 표는 똑같이 나눈 몫까지 받되 칸 폭에서의 실제 높이가 더 작으면 그만큼만(남는 높이는 다이어그램·그림에)
      const avail = H - GAP * (n - 1) - caps.reduce((a, c) => a + c, 0);
      const need = nat.map((t) => (t.table ? Math.min(avail / n, t.hAt(W)) : t.k === 'code' ? t.hAt(Math.min(W, t.nw)) : W / t.ar));
      const f = Math.min(1, avail / Math.max(1, need.reduce((a, x) => a + x, 0)));
      // 직접 고침(2026-11-25): 코드는 글자 하한 아래로 줄지 않으므로, 하한에서 필요한 높이를 먼저 떼어 두고 남는 높이를 나머지에 비율대로
      const share = need.map((x) => x * f);
      const codeH = nat.map((t, i) => (t.k === 'code' ? t.hAt(Math.min(W, t.nw)) : 0));   // 코드는 줄일 수 없으므로 그 폭에서의 높이 그대로
      const extra = codeH.reduce((a, h, i) => a + Math.max(0, h - share[i]), 0);
      if (extra > 0) {
        const rest = share.reduce((a, x, i) => a + (nat[i].k === 'code' ? 0 : x), 0);
        const g = rest > 0 ? Math.max(0, (rest - extra) / rest) : 1;
        share.forEach((x, i) => { share[i] = nat[i].k === 'code' ? codeH[i] : x * g; });
      }
      nat.forEach((t, i) => { out[i] = contain(i, W, share[i]); });
    } else {
      const avail = W - GAP * (n - 1);
      const ars = nat.map((t) => (t.table ? 1.6 : t.ar));
      const hh = Math.min(avail / ars.reduce((a, x) => a + x, 0), H - Math.max(...caps));
      nat.forEach((t, i) => { out[i] = contain(i, hh * ars[i], t.k === 'code' ? H - caps[i] : hh); });
    }
    // 표가 받은 칸에서 실제로 몇 배로 보일지(fitTable로 잼) — 배치 점수용. 하한에서도 안 들어가면 0.01(그 배치를 피함)
    nat.forEach((t, i) => {
      if (!t.table) return;
      const fin = boxes[i].querySelector(':scope > .vmedia > .fit-in'), o = out[i];
      const z = fitTable(fin, o.w, o.h, t.min);
      o.z = fin.offsetHeight * z <= o.h + 0.5 && fin.scrollWidth <= o.w / z + 1 ? z : 0.01;
    });
    return { out, nat, caps };
  }
  // 시각 자료가 원래 크기의 몇 배로 보이는가(1 이상은 1). 배치 고르기 점수
  const scaleOf = (t, o) => (t.table ? (o.z ?? 0.9) : t.k === 'code' ? (o.over ? 0.01 : Math.min(1, o.w / t.nw)) : Math.min(1, o.w / (t.nw || 1600)));   // 코드: 칸에 안 들어가면 그 배치를 피하고, 넓을수록(줄바꿈이 적을수록) 좋음
  // 장면 점수 = 시각 자료마다 log(보이는 배율)의 합(PF.fitVisuals 뒤). 클수록 그림·코드가 크게 보임
  const visScore = (s) => [...s.querySelectorAll('.vbox[data-sc]')].reduce((x, b) => x + Math.log(Math.max(0.01, +b.dataset.sc)), 0);
  // 직접 추가(2026-11-25): 슬라이드 전역 규칙 — 본문 내용의 좌우 여백을 같게.
  //   옆 배치(.dk.dk-side: 그림 칸 + 카드·단계 칸)에서 그림(.vbox)이 자기 칸보다 좁으면 그림 칸에 빈 곳이 생겨 한쪽 여백만 넓어짐.
  //   그림 칸 폭을 그림 폭에 맞춰 줄이고, 두 칸 덩어리를 본문 가운데(justify-content: center)에 놓음 → 내용의 왼쪽·오른쪽 여백이 같아짐.
  //   그림·카드 크기와 줄바꿈은 그대로(그림 폭은 PF.fitVisuals가 px로 정해 둠)이고 어떤 상자도 본문 칸 밖으로 나가지 않음.
  //   위아래 배치(그림 한 줄 · 카드 한 줄)는 그림이 이미 가운데라 손대지 않음
  const span = (els) => { const rs = els.map((e) => e.getBoundingClientRect()); return Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left)); };
  function balanceX(s) {
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    for (const dk of s.querySelectorAll('.pf-body .dk.dk-side')) {
      dk.style.gridTemplateColumns = ''; dk.style.justifyContent = '';
      const vis = [...dk.children].find((c) => c.classList.contains('vis'));
      const other = [...dk.children].find((c) => c !== vis && getComputedStyle(c).display !== 'none');
      if (!vis || !other) continue;
      const cols = getComputedStyle(dk).gridTemplateColumns.split(' ').map(parseFloat);
      if (cols.length !== 2 || cols.some((x) => !(x > 0))) continue;
      const vr = vis.getBoundingClientRect(), or = other.getBoundingClientRect();
      const vi = vr.left < or.left ? 0 : 1;                               // 그림 칸이 왼쪽(0)인가 오른쪽(1)인가(flip)
      const kk = vr.width / cols[vi] || 1;                                // 화면 px ÷ 이 칸의 CSS px(장면·확대 배율)
      const boxes = [...vis.children].filter((c) => c.classList.contains('vbox'));
      if (!boxes.length) continue;
      const need = span(boxes) / kk;                                       // 그림이 여럿이면(나란히·위아래) 그 전체 폭
      // 직접 고침(2026-11-25): 표 하나 + 카드(.tfit)는 카드 칸을 83%로 줄이고 둘을 가운데로(--tfit-cw로 비율 조절)
      const cw = dk.matches('.tfit') ? parseFloat(getComputedStyle(dk).getPropertyValue('--tfit-cw')) || 1 : 1;
      if (cw < 1) cols[1 - vi] *= cw;                                      // 표 칸은 그대로(내용 폭), 카드 칸만 줄임
      else {
        if (need >= cols[vi] - 2) continue;                                // 그림이 칸을 거의 다 씀
        cols[vi] = Math.ceil(need);
      }
      // 직접 고침(2026-11-25): 장면별 카드 칸 넓히기 — theme CSS에서 `#d-<key> { --pf-cards-scale: 1.2 }`(그림을 줄여 생긴 폭을 카드에). 본문 폭을 넘지 않음
      const cg = parseFloat(getComputedStyle(dk).getPropertyValue('--pf-cards-scale')) || 1;
      if (cg > 1) cols[1 - vi] = Math.min(cols[1 - vi] * cg, dk.clientWidth - (parseFloat(getComputedStyle(dk).columnGap) || 0) - cols[vi]);
      dk.style.gridTemplateColumns = `${cols[0].toFixed(1)}px ${cols[1].toFixed(1)}px`;
      dk.style.justifyContent = 'center';
    }
    //   화면 장면(.dk.scr-row: 스크린샷 2~3장이 한 줄): 칸마다 그림만 있으면(설명 글이 없으면) 칸 폭을 그림 폭에 맞추고 가운데로.
    //   설명 글이 있는 칸은 줄바꿈이 바뀌므로 손대지 않음
    for (const dk of s.querySelectorAll('.pf-body .dk.scr-row')) {
      dk.style.gridTemplateColumns = ''; dk.style.justifyContent = '';
      const cards = [...dk.children].filter((c) => getComputedStyle(c).display !== 'none');
      const cols = getComputedStyle(dk).gridTemplateColumns.split(' ').map(parseFloat);
      if (!cards.length || cols.length !== cards.length || cols.some((x) => !(x > 0))) continue;
      const only = cards.every((c) => [...c.children].every((x) => x.classList.contains('vis') || !x.textContent.trim() && !x.querySelector('img,svg,video')));
      if (!only) continue;
      const kk = cards[0].getBoundingClientRect().width / cols[0] || 1;
      const need = cards.map((c) => { const b = [...c.querySelectorAll(':scope > .vis > .vbox')]; return b.length ? Math.ceil(span(b) / kk) : 0; });
      if (need.some((w, i) => !w || w > cols[i])) continue;
      if (need.every((w, i) => w >= cols[i] - 2)) continue;
      dk.style.gridTemplateColumns = need.map((w) => `${w}px`).join(' ');
      dk.style.justifyContent = 'center';
    }
    if (s.querySelector('.dk-split')) { fitSplit(s); alignToMedia(s); }   // 직접 고침(2026-11-25): 칸 폭이 바뀌어 오른쪽 칸 높이가 달라졌으면 그림 높이·위아래 맞춤을 다시
    if (!wasIn) s.remove();
    return s;
  }
  function fitVisuals(s) {
    const M = measureRoot(); const wasIn = s.isConnected; if (!wasIn) M.appendChild(s);
    s.classList.add('pf-sizing');
    // 직접 고침(2026-11-25): 장면별 그림 크기 손잡이 — theme CSS에서 `#d-<key> { --pf-vis-scale: .85 }`처럼 주면 그림 영역을 그 비율로 줄여 맞춤(1 이하만)
    const vk = Math.min(1, parseFloat(getComputedStyle(s).getPropertyValue('--pf-vis-scale')) || 1);
    const plans = [...s.querySelectorAll('.vis')].map((vis) => {
      const boxes = [...vis.children].filter((e) => e.classList.contains('vbox') && e.dataset.kind);
      // 원문을 찾지 못한 자리(.vbox.err, 띠만 있음)는 크기를 정하지 않으므로 그 높이를 칸에서 빼고 세로로 쌓음
      const errs = [...vis.children].filter((e) => e.classList.contains('vbox') && !e.dataset.kind);
      const errH = errs.reduce((a, e) => a + e.offsetHeight + GAP, 0);
      return { vis, boxes, W: vis.clientWidth * vk, H: (vis.clientHeight - errH) * vk - 1, col: errs.length > 0 };   // 직접 고침(2026-11-25): -1 = 캡션 높이 소수점 반올림 여유(0.7px 넘쳐 옆 배치가 탈락하던 것)
    });
    for (const { vis, boxes, W, H, col } of plans) {
      if (!boxes.length || !W || H <= 0) continue;
      const arr0 = vis.dataset.arr;
      sizeArea(vis, boxes, W, H, col);
      // 직접 추가(2026-11-25): 세로로 긴 다이어그램이 SPLIT_EFF 미만이면 두 도막으로 나눠 다시 맞춰 봄 → SPLIT_GAIN배 이상 커질 때만 남김
      for (const box of boxes) {
        if (box.dataset.kind !== 'mermaid' || box.dataset.split || !(+box.dataset.eff < SPLIT_EFF)) continue;
        const svg = box.querySelector(':scope > .vmedia > svg'), vb = svg?.viewBox?.baseVal;
        if (!vb || vb.height <= vb.width) continue;
        const plan = planSplit(svg); if (!plan) continue;
        const eff0 = +box.dataset.eff;
        splitDiagram(box, plan);
        if (arr0) vis.dataset.arr = arr0; else delete vis.dataset.arr;
        sizeArea(vis, boxes, W, H, col);
        if (+box.dataset.eff >= eff0 * SPLIT_GAIN) { box.dataset.eff0 = eff0.toFixed(1); continue; }
        unsplitDiagram(box);
        if (arr0) vis.dataset.arr = arr0; else delete vis.dataset.arr;
        sizeArea(vis, boxes, W, H, col);
      }
    }
    s.classList.remove('pf-sizing');
    fitSplit(s);
    alignToMedia(s);
    if (!wasIn) s.remove();
    return s;
  }
    // 직접 고침(2026-11-25): 나눈 옆 배치(.dk-split) — 왼쪽 그림 높이를 오른쪽 칸 내용(카드 위 끝 ~ 아래 그림 끝) 높이에 맞춤 → 위아래 끝이 같게(캡션은 그림 아래로)
  function fitSplit(s) {
    s.querySelectorAll('.dk-split').forEach((dk) => {
      const lv = dk.querySelector(':scope > .vis'), rc = dk.querySelector(':scope > .rcol');
      if (!lv || !rc) return;
      const kids = [...rc.children].filter((c) => c.offsetHeight);
      const gap = parseFloat(getComputedStyle(rc).rowGap) || 0;
      const contentH = kids.reduce((a, c) => a + c.offsetHeight, 0) + gap * Math.max(0, kids.length - 1);
      const boxes = [...lv.children].filter((e) => e.classList.contains('vbox') && e.dataset.kind);
      if (boxes.length !== 1 || !contentH) return;
      sizeArea(lv, boxes, lv.clientWidth, contentH + capOf(boxes[0]), false);
      // 폭에 막혀 그림이 조금 낮으면(8% 이내) 그림 칸을 내용 높이로 채우고 가장자리를 조금 잘라(object-fit: cover) 위아래 끝을 맞춤
      const media = boxes[0].querySelector(':scope > .vmedia'), img = media?.querySelector('img, video');
      const mh = media ? media.offsetHeight : 0;
      if (boxes[0].dataset.kind === 'image' && img && mh && mh < contentH && (contentH - mh) / contentH <= 0.08) {
        media.style.height = `${contentH}px`;
        Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'cover' });
      }
    });
  }
  function sizeArea(vis, boxes, W, H, col) {
    {
      // 직접 고침(2026-11-25): 장면별 그림 쌓는 방향 — theme CSS `#d-<key> { --pf-arr: col }`(위아래) / `row`(나란히)
      const fa = getComputedStyle(vis).getPropertyValue('--pf-arr').trim();
      const arrs = boxes.length === 1 ? ['one'] : col ? ['col'] : (fa === 'col' || fa === 'row') ? [fa] : (vis.dataset.arr ? [vis.dataset.arr] : ['col', 'row']);
      let best = null;
      for (const a of arrs) {
        const r = sizeBoxes(boxes, a, W, H);
        const score = r.out.reduce((x, o, i) => x + Math.log(Math.max(0.01, scaleOf(r.nat[i], o))), 0);   // 모두가 고르게 크게(하나만 크고 하나는 아주 작은 배치를 피함)
        if (!best || score > best.score + 1e-6) best = { ...r, a, score };
      }
      // 캡션·원문 문제 띠는 상자 폭이 정해진 뒤 다시 잼: 세로로 긴 그림은 상자가 좁아 띠가 여러 줄로 꺾여 높아짐 → 그 높이로 다시 배분(최대 3번)
      for (let k = 0; k < 3; k++) {
        boxes.forEach((box, i) => { box.style.width = `${best.out[i].w}px`; });
        const caps = boxes.map(capOf);
        if (!caps.some((c, i) => c > best.caps[i] + 1)) break;
        best = { ...best, ...sizeBoxes(boxes, best.a, W, H, caps.map((c, i) => Math.max(c, best.caps[i]))) };
      }
      vis.dataset.arr = best.a;
      boxes.forEach((box, i) => {
        const o = best.out[i], t = best.nat[i], media = box.querySelector(':scope > .vmedia');
        box.style.width = `${o.w}px`;
        box.dataset.sc = scaleOf(t, o).toFixed(3);
        if (t.k === 'image' || t.k === 'mermaid') {
          Object.assign(media.style, { width: `${o.w}px`, height: `${o.h}px` });
          if (t.k === 'mermaid') {
            const eff = 16 * o.w / t.nw;
            box.dataset.eff = eff.toFixed(1);                                // 참고 지표는 최종 장면에서만(noteFill)
            box.dataset.lim = best.a === 'one' ? o.lim : 'multi';             // 다른 자료와 함께면 막힌 쪽이 아니라 '함께 있어서'가 원인
            box.dataset.vb = `${Math.round(t.nw)}×${Math.round(t.nw / t.ar)}`;
          }
        } else {
          const fin = media.querySelector(':scope > .fit-in');
          let z;
          if (t.k === 'code') { z = 1; Object.assign(fin.style, { zoom: '1', width: `${o.w}px` }); box.dataset.sc = scaleOf(t, o).toFixed(3); }
          else z = fitTable(fin, o.w, o.h, t.min);
          fin.dataset.pfFz = z.toFixed(3);
          if (t.k !== 'code') box.dataset.sc = z.toFixed(3);
        }
      });
    }
  }
  // 직접 추가(2026-11-24): 슬라이드 공용 — 시각 자료와 그 옆의 다른 요소(글 칸·카드 열)는 캡션을 뺀 '자료 영역'(이미지·다이어그램·코드 칸) 기준으로 세로 정렬.
  //   예전에는 캡션까지 합친 상자의 가운데를 기준으로 삼아 캡션 높이의 절반만큼 어긋났음. 두 쪽의 기준점(자료 영역 가운데 / 옆 요소 가운데)을 한 높이에 포개고,
  //   둘 다 칸 높이 안에 들어가게만 가둠(안 들어가면 칸 아래를 그만큼 늘림). 캡션이 없으면 결과가 예전과 같음(가운데)
  function alignToMedia(s) {
    s.querySelectorAll('.dk-side').forEach((dk) => {
      const vis = dk.querySelector(':scope > .vis'), other = [...dk.children].find((c) => c !== vis);
      if (!vis || !other) return;
      [vis, other].forEach((e) => { e.style.alignSelf = ''; e.style.marginTop = ''; }); dk.style.paddingBottom = '';
      if (dk.matches('.tfit') && dk.querySelector('.colhead')) return;   // 직접 고침(2026-11-25): 표 + 카드에 소제목이 있으면 두 칸을 위에서부터(소제목 높이 맞춤, CSS align-items: start)
      const medias = [...vis.querySelectorAll(':scope > .vbox > .vmedia, :scope > .vbox > .colhead')];   // 직접 고침(2026-11-25): 위 소제목도 자료 영역에 넣어 함께 가운데로
      if (!medias.length || !dk.offsetHeight) return;
      const dr = dk.getBoundingClientRect(), k = dr.height / dk.offsetHeight || 1, vr = vis.getBoundingClientRect(), or = other.getBoundingClientRect();
      let top = Infinity, bot = -Infinity;
      medias.forEach((m) => { const r = m.getBoundingClientRect(); top = Math.min(top, r.top); bot = Math.max(bot, r.bottom); });
      const dh = dr.height / k, ha = vr.height / k, hb = or.height / k, ac = ((top + bot) / 2 - vr.top) / k, bc = hb / 2;
      const lo = Math.max(ac, bc), hi = dh - Math.max(ha - ac, hb - bc);
      const y = lo <= hi ? Math.min(hi, Math.max(lo, dh / 2)) : lo;       // 칸 안에 다 안 들어가면(캡션이 아래로 길 때) 위에 붙이고 칸 아래를 그만큼 늘림(장면 안 가운데 배치는 그대로)
      if (lo > hi) dk.style.paddingBottom = `${(lo - hi).toFixed(2)}px`;
      vis.style.alignSelf = 'start'; vis.style.marginTop = `${(y - ac).toFixed(2)}px`;
      other.style.alignSelf = 'start'; other.style.marginTop = `${(y - bc).toFixed(2)}px`;
    });
  }

  // ── 프로젝트 소개 장면(슬라이드 표지, 결정 G4): 큰 대표 이미지 · 메타 격자 · 개발 의도 · 링크 카드 · 태그 ──
  //   글: title · tagline · meta · team.role · intent · tags(data 그대로). 링크: [{ k, label, href, kind, visible }]
  //   메타 이름(data의 meta[].label, 프로젝트 문서의 말) → 영문 라벨 키
  const META_EN = { '장르': 'en.meta-genre', '기간': 'en.meta-duration', '개발 기간': 'en.meta-duration', '인원': 'en.meta-team', '팀': 'en.meta-team', '팀 구성': 'en.meta-team',
                    '환경': 'en.meta-env', '개발 환경': 'en.meta-env', '엔진': 'en.meta-engine', '플랫폼': 'en.meta-platform' };
  const metaEn = (label) => { const k = META_EN[String(label || '').replace(/\s+/g, ' ').trim()]; return k ? PF.t(k) : ''; };
  async function projectIntro(p, { id, titleTag = 'h2', eyebrow = PF.t('en.project'), links = [], foot = '', sec = '', group = '', stats, tpl = 'P1' }) {
    if (!p.cover && p.coverLogo) p = { ...p, cover: p.coverLogo };     // 직접 고친 기능: 플레이 화면 없이 로고만 있으면 슬라이드 표지에 로고
    const d = p.cover ? (p.coverSize?.w ? p.coverSize : await imageSize(PF.srcPath(p.id, p.cover))) : null;
    const ar = d ? d.w / d.h : null;
    const variant = !p.cover || !ar ? 'nocover' : ar < 0.9 ? 'portrait' : 'landscape';
    const meta = (p.meta || []).map((m) => `<div class="mi"><dt class="meta-k">${esc(m.label)}</dt><dd>${inline(m.value)}</dd></div>`);
    if (p.team?.role) meta.push(`<div class="mi wide role"><dt class="meta-k">${esc(PF.t('name.role'))}</dt><dd>${inline(p.team.role)}</dd></div>`);
    const intent = p.intent?.text ? `<div class="intent"><p class="lc-k">${esc(PF.t('name.intent'))}</p><p class="it">${inline(p.intent.text)}</p></div>` : '';
    const cards = links.map((l) => `<div class="lcard${/doc\.html/.test(l.href || '') ? ' primary' : ''}">${PF.link({ href: l.href, kind: l.kind, label: `<span class="lc-k">${esc(l.k)}</span><span class="lc-t">${esc(l.label)}</span><span class="url">${esc(l.visible)}</span>` })}</div>`).join('');
    const tags = (p.tags || []).length ? `<ul class="tags">${p.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    const cover = p.cover ? `<div class="media pi-cover"${ar ? ` style="aspect-ratio:${ar.toFixed(4)}"` : ''}>${imgTag(PF.srcPath(p.id, p.cover), p.title, d)}</div>` : '';
    const head = `<div class="pi-head"><${titleTag} class="pi-t">${esc(p.title)}</${titleTag}>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}</div>`;
    const make = (tight, linksLeft) => {
      const s = scene({ id, tpl, kind: 'bare', cls: `${variant}${tight ? ' pi-tight' : ''}`, foot, sec, group, stitle: p.title });
      const right = `<div class="pi-right">${meta.length ? `<dl class="pi-meta">${meta.join('')}</dl>` : ''}${intent}${tags}${!linksLeft && cards ? `<div class="pi-links">${cards}</div>` : ''}</div>`;   // 직접 고친 기능: 링크 카드는 오른쪽 단 맨 아래(태그 뒤)
      const left = `<div class="pi-left">${cover}${linksLeft && cards ? `<div class="pi-links row">${cards}</div>` : ''}</div>`;
      // 포트폴리오 페이지처럼: 제목·한 줄 소개는 위 전체 폭, 아래는 정보(왼쪽) · 대표 이미지(오른쪽)
      body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(eyebrow)}</span><span class="rl">${esc(PF.teamLabel(p.team))}</span></div>${head}<div class="pi-main">${right}${left}</div>`;
      return s;
    };
    for (const tight of [false, true]) for (const linksLeft of variant === 'nocover' ? [false] : [false, true]) { const s = make(tight, linksLeft); if (fitsM(s)) return s; }
    return shrinkOrClip(make(true, true), window.PFScene.refUrl(id), stats);
  }

  // 원문 절(section 글자) → 슬라이드 장면 id는 PF.deckSceneFor(common.js — 포트폴리오 페이지의 기능 링크도 씀)
  // 슬라이드에 없는 장면 주소(#s=d-<key>·d-<key>-2·ch-<key>: 숨겼거나 다시 빌드로 없어짐) → 가장 가까운 장면(결정 G3 정신):
  //   나뉜 장면의 앞 장면 → 같은 절의 남은 장면 → 그 장 표지 → ''(목차는 부르는 쪽이 정함). has(id) = 그 장면이 슬라이드에 있는가
  function deckSceneNear(p, want, has) {
    const m = /^d-(.+)$/.exec(want);
    if (!m) return '';
    const k = m[1], stem = k.replace(/-(\d+|t\d+)$/, '');
    if (stem !== k && has(`d-${stem}`)) return `d-${stem}`;
    const all = [...(p.deck?.base || []), ...(p.deck?.slides || [])];
    const sl = all.find((x) => x.key === k) || all.find((x) => x.key === stem);
    if (!sl) return '';
    const path = (x) => (x.sectionPath || []).map(PF.normTitle).join(' › ');   // 절 경로 전체(하위 제목 '개요'처럼 여러 절에 같은 이름이 있음)
    const same = (p.deck?.slides || []).find((x) => path(x) === path(sl) && has(`d-${x.key}`));
    if (same) return `d-${same.key}`;
    return sl.chapter && has(`ch-${sl.chapter}`) ? `ch-${sl.chapter}` : '';
  }

  Object.assign(PF, { sleep, loadFonts, imageSize, measureRoot, dropMeasure, scene, body, fitsScene, fitsM, pack, shrinkOrClip, guard, msgScene, DOT, imgTag, extLinks, refitOnLateFont,
                      projectIntro, note, fillOf, noteFill, vband, fitVisuals, balanceX, visScore, splitDiagram, minFonts, deckSceneNear, FLOOR, extEn });
})();
