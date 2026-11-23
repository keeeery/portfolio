// 직접 만든 파일: 같은 페이지 안 이동은 주소를 바꾸지 않고, 새로고침하면 보던 위치 그대로 — 포트폴리오 페이지·슬라이드·상세 문서·자기소개서 공용.
//   ① 같은 페이지 링크(href="#…")를 누르면 브라우저 대신 그 자리로 스크롤만 함(주소 # 이 붙지 않음).
//      대신 방문 기록은 하나 남김(같은 주소, 기록에 스크롤 위치 pfY와 이동 수 pfDepth) → 브라우저 [뒤로]를 누르면 누르기 전 보던 자리로, [앞으로]는 다시 그 절로.
//      기록마다의 위치는 스크롤이 멈출 때마다 그 기록에 적어 둠. 돌아가기 링크(common.js data-pf-back)는 pfDepth만큼 더 뒤로 가 한 번에 앞 페이지로.
//      페이지가 먼저 처리한 클릭(슬라이드 장면 이동 등, preventDefault)은 건드리지 않도록 window 단계(가장 마지막)에서 받음.
//      옮긴 뒤 'pf-anchor' 이벤트(detail.el)를 window에 보냄 — 상세 문서의 제목 도착 강조가 이것을 받음.
//   ② 페이지를 떠날 때(새로고침 포함) 스크롤 위치와 '화면에 보이던 요소'(본문 안 자리 = 자식 순번 경로, 화면 위에서 떨어진 거리)를
//      sessionStorage에 적어 두고, 새로고침·뒤로/앞으로로 다시 열리면 그 요소가 같은 높이에 오도록 맞춤(못 찾으면 숫자 위치).
//      그 요소가 그려져 자리를 맞출 때까지는 본문을 가려 둠(바탕색만 보임, 최대 3초) → 맨 위가 잠깐 보였다가 뛰는 일이 없음.
//      그림·다이어그램이 늦게 들어와 위쪽 높이가 바뀌면 그 요소 기준으로 다시 맞추고(ResizeObserver = 화면에 그리기 전),
//      다 그리고 맞출 자리가 0.5초 그대로이거나 읽는 사람이 움직이면(휠·터치·키·마우스) 놓음. ③의 덮개는 이 위치 맞추기가 끝난 뒤에 걷힘.
//      이때 주소에 남은 #(다른 페이지에서 #으로 들어온 경우)은 지움 — 보던 위치가 # 절보다 우선.
//   ③ 그리는 동안(처음 방문·새로고침 모두) 그레이박스 화면을 덮어 씌움 — 본문 밖(<html> 바로 아래)에 띄우므로 배치·위치 맞추기에 영향 없음.
//      모양: 새로고침·뒤로로 다시 열면 떠나기 전 화면에 보이던 글 줄·그림 자리 그대로(창 폭이 같을 때 — 떠날 때 sessionStorage에 적어 둠).
//            처음 열면 상세 문서·자기소개서는 실제 페이지와 같은 틀(같은 class + 페이지 CSS 사본, shadow DOM 안)에 글 자리만 회색으로,
//            포트폴리오 페이지는 표지 모양(index.html #cover와 같은 배치 규칙), 슬라이드는 장면 틀.
//      페이지를 열자마자 바로 보이고, 렌더러가 그린 뒤 다시 맞추는 일까지 모두 끝나면 흐려지며 사라짐 — 끝 = 페이지의 완료 신호
//      (포트폴리오 페이지·슬라이드 data-pf-ready="yes", 상세 문서·자기소개서 data-doc-ready="1") + 상세 문서 화면 안·위쪽 표의 칸 폭 맞추기 끝(data-pf-fit)
//      + 화면 안·위쪽 그림을 다 받음 + 화면 안 배치(자리·크기)가 0.3초 그대로(렌더러의 재배치 끝 — 떠오름·캡슐 바 같은 꾸밈 움직임은 기다리지 않고 걷힌 뒤 보임)
//      순서: 위치 맞추기 끝 → 덮개가 흐려지며 걷힘(.25초) → 다 걷힌 뒤 페이지 애니메이션(떠오름·캡슐 바 펼침) 시작 — 덮는 동안은 0ms에 멈춰 둠
//   ④ "불러오는 중…" 글(상세 문서·자기소개서 .loading)은 같은 반짝이는 회색 줄로 보이게 함(글은 그대로 두어 화면 읽기·완료 확인에 씀)
//      (새로고침이면 제자리에 맞춰 보여 준 뒤).
//      시간 제한은 없음(느린 네트워크에서 받는 중이면 끝까지 기다림). 대신 스크립트를 받지 못했거나 스크립트 오류가 나면 바로 걷어
//      페이지의 안내 글이 보이게 함(그림을 못 받은 것은 해당 없음).
//      색은 페이지의 --bg·--ink를 섞어 만들어 밝은/어두운 화면 모두 맞음. 움직임 줄이기 설정이면 반짝임 없음. 인쇄에는 나오지 않음.
//   슬라이드는 스크롤 대신 '보던 장면'을 기억하므로(deck-kit.js가 window.__pfOwnPos를 켬) ②의 위치 저장·복원은 하지 않음.
(() => {
  if (window.PFAnchor) return;
  const KEY = `pf-pos:${location.pathname.replace(/\/index\.html$/, '/')}?p=${new URLSearchParams(location.search).get('p') || ''}`;
  const nav = performance.getEntriesByType?.('navigation')[0]?.type;
  const isReturn = nav === 'reload' || nav === 'back_forward';
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const own = () => !!window.__pfOwnPos;
  window.PFAnchor = { KEY, isReturn, read };

  // 새로고침·뒤로로 다시 열렸고 기억한 자리가 있으면 주소의 # 을 먼저 지움(페이지 스크립트가 # 절로 옮기지 않도록)
  const saved = isReturn ? read() : null;
  if (saved && location.hash) try { history.replaceState(history.state, '', location.pathname + location.search); } catch { /* 그대로 */ }

  // ① 같은 페이지 링크
  addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || a.hasAttribute('data-pf-back') || (a.target && a.target !== '_self')) return;
    let id = a.getAttribute('href').slice(1);
    try { id = decodeURIComponent(id); } catch { /* 그대로 */ }
    const el = id ? document.getElementById(id) : null;
    if (!el && id && id !== 'top') return;                       // 모르는 #(예전 주소 꼴 등)은 브라우저·페이지에 맡김
    e.preventDefault();
    if (!own()) try {                                            // 지금 기록에 떠나는 자리를 적고, 같은 주소로 새 기록(도착 자리는 스크롤이 멈추면 적힘)
      const st = history.state || {};
      history.replaceState({ ...st, pfY: Math.round(scrollY) }, '');
      history.pushState({ ...st, pfY: null, pfDepth: (st.pfDepth ?? 0) + 1 }, '', location.pathname + location.search);
    } catch { /* 기록 못 남겨도 이동은 함 */ }
    if (el) el.scrollIntoView({ block: 'start' });               // 부드럽게(페이지 CSS scroll-behavior) · 도착 자리는 제목의 scroll-margin
    else scrollTo({ top: 0 });
    if (e.detail === 0 && el) {                                  // 키보드로 눌렀으면(건너뛰기 링크 등) 초점도 그 자리로
      if (!el.matches('a[href],button,input,select,textarea,[tabindex]')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
    dispatchEvent(new CustomEvent('pf-anchor', { detail: { el, id } }));
  });

  // ② 위치 기억
  try { history.scrollRestoration = 'manual'; } catch { /* 그대로 */ }
  const pathOf = (el) => { const p = []; for (let n = el; n !== document.body; n = n.parentElement) { if (!n?.parentElement) return null; p.unshift([...n.parentElement.children].indexOf(n)); } return p; };
  const byPath = (p) => { let n = document.body; for (const i of p) { n = n?.children[i]; if (!n) return null; } return n; };
  const pinned = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const ps = getComputedStyle(n).position; if (ps === 'fixed' || ps === 'sticky') return true; } return false; };
  const anchor = () => {                                         // 화면 위쪽에 보이는 가장 안쪽 블록(머리 막대·떠 있는 단추처럼 고정된 것은 뺌)
    for (const fy of [0.3, 0.45, 0.6]) {
      for (let el of document.elementsFromPoint(innerWidth / 2, innerHeight * fy)) {
        if (el === document.documentElement || el === document.body || pinned(el)) continue;
        const py = innerHeight * fy;                               // 문단 사이 여백을 짚어 바깥 상자(문서 전체 등)가 걸렸으면 → 그 높이의 안쪽 블록까지 내려감(여백이면 바로 아래 블록)
        for (;;) {
          const c = [...el.children].find((k) => { const r = k.getBoundingClientRect(); return r.height > 0 && r.bottom > py; });
          if (!c || pinned(c)) break;
          el = c;
          if (c.getBoundingClientRect().top > py) break;
        }
        while (el.parentElement !== document.body && getComputedStyle(el).display.startsWith('inline')) el = el.parentElement;
        const path = pathOf(el);
        if (path) return { path, tag: el.tagName, off: Math.round(el.getBoundingClientRect().top) };
      }
    }
    return null;
  };
  const snap = () => {                                           // 떠나기 전 화면 모양: 보이던 글 줄(0)·그림(1)의 자리 — 다시 열 때 그레이박스로 그림
    const W = innerWidth, H = innerHeight, out = [], rg = document.createRange();
    const cut = (r, c) => ({ l: Math.max(r.left, c.l), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r), b: Math.min(r.bottom, c.b) });
    const add = (r, k, c) => { const x = cut(r, c); if (x.r - x.l > 1 && x.b - x.t > 1 && out.length < 600) out.push([Math.round(x.l), Math.round(x.t), Math.round(x.r - x.l), Math.round(x.b - x.t), k]); };
    const walk = (el, c) => {
      if (out.length >= 600 || el.matches('script, style, noscript, template, .pf-sb, .pf-skel, dialog:not([open]), [aria-hidden="true"], .cap, .cap-pill, .hero-pill, .tcap, .cv-screens, .mmd-src')) return;   // 꾸밈(aria-hidden — 배경 번짐·장식)·캡슐 바·표지 대표 화면·다이어그램 원문 접는 상자는 빼기
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
      if (/blur\(/.test(cs.filter)) return;                       // 흐리게 깐 배경 그림(프로젝트 소개 배경·표지 번짐)
      const r = el.getBoundingClientRect();
      if (cs.display !== 'contents') {
        if (cs.position === 'fixed') c = { l: 0, t: 0, r: W, b: H };
        if (r.right <= c.l || r.left >= c.r || r.bottom <= c.t || r.top >= c.b) return;   // 화면(또는 잘리는 상자) 밖
        if (el.matches('img, svg, video, canvas, iframe, picture')) { add(r, 1, c); return; }
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') c = cut(r, c);   // 스크롤 칸 밖으로 밀려난 글(목차 등)은 빼기
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 1) walk(n, c);
        else if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); for (const t of rg.getClientRects()) add(t, 0, c); }
      }
    };
    try { walk(document.body, { l: 0, t: 0, r: W, b: H }); } catch { return null; }
    out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const m = [];                                                // 같은 줄에 붙은 글 조각은 하나로
    for (const x of out) {
      const p = m[m.length - 1];
      if (p && !p[4] && !x[4] && Math.abs(p[1] - x[1]) <= 3 && Math.abs(p[3] - x[3]) <= 4 && x[0] - (p[0] + p[2]) < 10 && x[0] >= p[0]) p[2] = Math.max(p[2], x[0] + x[2] - p[0]);
      else m.push(x);
    }
    return { w: W, h: H, b: m };
  };
  window.PFAnchor.snap = snap;                                  // 점검용: 지금 화면의 모양(새로고침 때 그레이박스로 그릴 자리)
  const save = () => {
    const sk = window.PFAnchor.skeleton;
    if (sk && sk.shown && !sk.finished) return;                  // 아직 그리는 중에 떠나면(새로고침 연타 등) 적지 않음 — 그 전 기록(보던 자리·모양)을 그대로 둠
    if (!own()) try { sessionStorage.setItem(KEY, JSON.stringify({ y: Math.round(scrollY), a: anchor(), s: snap() })); } catch { /* 저장소 막힘 */ }
  };
  addEventListener('pagehide', save);
  let recT = 0;                                                  // 스크롤이 멈추면 지금 기록에 위치를 적어 둠([뒤로]·[앞으로]로 돌아올 자리)
  addEventListener('scroll', () => {
    if (own()) return;
    clearTimeout(recT);
    recT = setTimeout(() => { try { if (history.state?.pfY !== Math.round(scrollY)) history.replaceState({ ...(history.state || {}), pfY: Math.round(scrollY) }, ''); } catch { /* 횟수 제한 등 */ } }, 200);
  }, { passive: true });
  addEventListener('popstate', (e) => {                          // [뒤로]·[앞으로]: 그 기록에 적어 둔 자리로 바로
    const y = e.state?.pfY;
    if (own() || typeof y !== 'number') return;
    clearTimeout(recT);
    scrollTo({ top: y, behavior: 'instant' });
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });

  // ④ "불러오는 중…" 글 → 반짝이는 회색 줄
  {
    const st = document.createElement('style');
    st.textContent = `
@media screen {
  #app > p.loading, #doc > p.loading {
    --sk: color-mix(in srgb, var(--ink, #F4F4F6) 8%, var(--bg, #0A0A0D)); --sk-hi: color-mix(in srgb, var(--ink, #F4F4F6) 15%, var(--bg, #0A0A0D));
    color: transparent !important; user-select: none; box-sizing: content-box; height: 96px; overflow: hidden;
    background: linear-gradient(100deg, var(--sk) 40%, var(--sk-hi) 50%, var(--sk) 60%) 0 0 / 300% 100% !important; animation: pf-skel 1.4s ease-in-out infinite;
    -webkit-mask: linear-gradient(#000 0 0) 0 0 / 96% 13px no-repeat, linear-gradient(#000 0 0) 0 28px / 91% 13px no-repeat,
                  linear-gradient(#000 0 0) 0 56px / 94% 13px no-repeat, linear-gradient(#000 0 0) 0 84px / 58% 12px no-repeat;
    mask: linear-gradient(#000 0 0) 0 0 / 96% 13px no-repeat, linear-gradient(#000 0 0) 0 28px / 91% 13px no-repeat,
          linear-gradient(#000 0 0) 0 56px / 94% 13px no-repeat, linear-gradient(#000 0 0) 0 84px / 58% 12px no-repeat;
    -webkit-mask-origin: content-box; mask-origin: content-box; -webkit-mask-clip: content-box; mask-clip: content-box;
  }
  #app > p.loading { max-width: min(720px, 100% - 48px); margin-inline: auto; }
}
@keyframes pf-skel { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { #app > p.loading, #doc > p.loading { animation: none; } }
/* 그레이박스가 덮고 있는 동안 페이지의 CSS 애니메이션(떠오름·캡슐 바 펼침 등)은 처음 자리에 멈춰 둠 → 걷히는 순간부터 처음부터 보임 */
html.pf-skel-hold body *, html.pf-skel-hold body *::before, html.pf-skel-hold body *::after { animation-play-state: paused !important; }`;
    document.head.append(st);
  }

  // ③ 그레이박스
  const skel = (() => {
    let el = null, over = false;
    const info = (window.PFAnchor.skeleton = { kind: '', shown: 0, finished: 0 });   // 점검용: 어떤 모양으로 언제 보이고 걷혔는지(ms)
    const VARS = '--sk: color-mix(in srgb, var(--ink, #F4F4F6) 8%, var(--bg, #0A0A0D)); --sk-hi: color-mix(in srgb, var(--ink, #F4F4F6) 15%, var(--bg, #0A0A0D));';
    const SHIM = 'linear-gradient(100deg, var(--sk) 40%, var(--sk-hi) 50%, var(--sk) 60%) 0 0 / 300% 100%';
    const KEYS = '@keyframes pf-skel { from { background-position: 100% 0; } to { background-position: 0 0; } }';
    const CSS = `
.pf-skel { position: fixed; inset: 0; z-index: 2147483001; overflow: hidden; background: var(--bg, #0A0A0D); transition: opacity .25s ease; ${VARS} }
.pf-skel.sk-out { opacity: 0; }
.pf-skel i { display: block; height: 14px; border-radius: 6px; margin: 0 0 14px; background: ${SHIM}; animation: pf-skel 1.4s ease-in-out infinite; }
.pf-skel i.sk-s { position: absolute; margin: 0; border-radius: 5px; }       /* 떠나기 전 화면 모양(글 줄) */
.pf-skel i.sk-s.sk-m { border-radius: 10px; }                                 /* 그림 자리 */
/* 포트폴리오 페이지 표지 — index.html #cover와 같은 규칙: 머리 막대 아래(56px)에서 위 여백, 머리말·이름·영문 이름·한 줄 정체성 두 줄,
   대표 화면 줄(넓은 화면 4칸 · 휴대폰은 가운데 한 장 + 양옆이 살짝). 캡슐 바는 그리지 않고 자리만 둠(대표 화면 줄 크기가 실제와 같게) */
.pf-skel .sk-cv { position: absolute; top: 56px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; padding: 64px 20px 0; box-sizing: border-box; }
.pf-skel .sk-ln { display: flex; align-items: center; justify-content: center; width: 100%; }
.pf-skel .sk-cv i { margin: 0; max-width: 100%; }
.pf-skel .sk-l1 { height: 18px; } .pf-skel .sk-l1 i { width: 84px; height: 12px; }
.pf-skel .sk-l2 { height: 60px; margin-top: 24px; } .pf-skel .sk-l2 i { width: 151px; height: 50px; border-radius: 10px; }
.pf-skel .sk-l3 { height: 20px; margin-top: 16px; } .pf-skel .sk-l3 i { width: 122px; height: 12px; }
.pf-skel .sk-l4 { height: 33px; margin-top: 40px; } .pf-skel .sk-l4 i { width: 328px; height: 22px; }
.pf-skel .sk-l5 { height: 33px; } .pf-skel .sk-l5 i { width: 343px; height: 22px; }
.pf-skel .sk-stage { width: 100%; margin-top: 96px; }
.pf-skel .sk-shots { display: flex; justify-content: center; gap: 12px; }
.pf-skel .sk-shots i { flex: 0 0 304px; height: 228px; border-radius: 12px; }
.pf-skel .sk-shots i:nth-child(4) { display: none; }
.pf-skel .sk-shots i { visibility: hidden; }                  /* 대표 화면 4장은 그리지 않고 자리만(실제 떠오름이 걷힌 뒤 보이게) */
.pf-skel .sk-pill { height: 56px; margin-top: 134px; }        /* 캡슐 바 자리(그리지 않음) */
@media (min-width: 760px) {
  .pf-skel .sk-cv { height: calc(100svh - 56px); min-height: 560px;
    padding: clamp(48px, calc(47.5svh - 375.5px), 138px) clamp(32px, 5vw, 120px) clamp(20px, 4.5svh, 48px); }
  .pf-skel .sk-l2 { height: 96px; } .pf-skel .sk-l2 i { width: 242px; height: 80px; border-radius: 14px; }
  .pf-skel .sk-l3 { height: 24px; } .pf-skel .sk-l3 i { width: 139px; height: 14px; }
  .pf-skel .sk-l4 { height: 40px; } .pf-skel .sk-l4 i { width: 689px; height: 28px; }
  .pf-skel .sk-l5 { height: 40px; } .pf-skel .sk-l5 i { width: 317px; height: 28px; }
  .pf-skel .sk-stage { margin-top: 0; flex: 1 1 0; min-height: 0; container-type: size; display: grid; place-items: center; --cv-pad: clamp(48px, 8svh, 96px); }
  .pf-skel .sk-shots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; width: min(100%, max(400px, calc((100cqh - 2 * var(--cv-pad)) * 16 / 3 + 54px))); }
  .pf-skel .sk-shots i, .pf-skel .sk-shots i:nth-child(4) { display: block; height: auto; aspect-ratio: 4 / 3; }
  .pf-skel .sk-pill { height: 64px; margin-top: 0; }
}
.pf-skel .sk-t { height: 30px; width: 58%; margin-bottom: 28px; }
.pf-skel.sk-deck { display: grid; place-items: center; }
.pf-skel .sk-sl { width: min(92vw, (100vh - 96px) * 16 / 9); aspect-ratio: 16 / 9; border-radius: 12px; padding: 5%; box-sizing: border-box;
  border: 1px solid var(--sk); display: flex; flex-direction: column; justify-content: center; }
.pf-skel .sk-sl .sk-t { width: 46%; height: 40px; }
${KEYS}
@media (prefers-reduced-motion: reduce) { .pf-skel i { animation: none; } }
@media print { .pf-skel { display: none !important; } }`;
    const W = (w, c = '') => `<i class="${c}" style="width:${w}%"></i>`;
    const path = location.pathname, isLetter = /\/letter\.html$/.test(path), isDoc = isLetter || /\/doc\.html$/.test(path);
    const railOn = (() => { try { return localStorage.getItem('pf-rail') !== 'off'; } catch { return true; } })();   // 오른쪽 칸을 접어 두었으면 그리지 않음(common.js와 같은 키)

    // 상세 문서·자기소개서: 실제 페이지와 같은 class 구조를 shadow DOM에 만들고 페이지 CSS 사본으로 배치 → 목차·본문·카드 자리가 화면 크기마다 실제와 같음.
    //   글은 줄 높이 안의 회색 막대(.b)로, 색·테두리·바탕은 모두 지우고 오른쪽 카드만 테두리. shadow 안이라 페이지 스크립트의 .toc·.rail 찾기에 걸리지 않음
    const pageCss = () => [...document.styleSheets].map((sh) => {
      let t = '';
      try { t = [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; }   // 다른 출처(글꼴 CDN)는 읽을 수 없음 — 글꼴은 페이지에 이미 있음
      const m = sh.media && sh.media.mediaText;
      return m && m !== 'all' ? `@media ${m} {\n${t}\n}` : t;
    }).join('\n').replace(/(^|[\s,}>])body(?=[\s,{.:#[>])/g, '$1.sk-root');
    const b = (w) => `<span class="b" style="width:${w}"></span>`;
    const lines = (...ws) => ws.map(b).join('<br>');
    const docHtml = () => {
      const crumb = `<header class="doc-head"><div class="doc-head-in"><p class="crumb"><a>${b('5.6em')}</a><span>${b('.5em')}</span><b>${b(isLetter ? '5em' : '13em')}</b></p></div></header>`;
      let toc = '';
      if (isLetter) toc = [[92, 58], [88, 44], [95, 66], [84, 52], [90, 70], [96, 48], [86, 62], [93, 40]].map(([x, y]) => `<a class="h2">${lines(x + '%', y + '%')}</a>`).join('');
      else {
        const h2 = [64, 82, 71, 58, 77, 68], h3 = [52, 66, 44, 78, 58, 70, 47, 62, 84, 55, 40, 73], n = [5, 6, 3, 5, 4, 6];
        let k = 0;
        toc = h2.map((w, g) => `<div class="toc-group"><a class="h2">${b(w + '%')}</a>${Array.from({ length: n[g] }, () => `<a class="h3">${b(h3[k++ % h3.length] + '%')}</a>`).join('')}</div>`).join('');
      }
      const nav = `<nav class="toc fade-host"><p class="toc-title">${b('2.4em')}</p><div class="toc-links fade-list">${toc}</div></nav>`;
      const P = (...ws) => `<p>${lines(...ws.map((w) => w + '%'))}</p>`;
      let main;
      if (isLetter) {
        main = `<div class="doc-intro"><p class="eyebrow">${b('3em')}</p><h1>${b('5em')}</h1></div><article class="md">`
          + `<h2>${b('82%')}</h2>${P(97, 93, 96, 90, 95, 62)}${P(95, 97, 91, 94, 48)}${P(96, 92, 58)}<h2>${b('74%')}</h2>${P(94, 97, 90, 96, 56)}${P(97, 92, 95, 66)}</article>`;
      } else {
        const meta = [['2.2em', '6.6em'], ['2.2em', '11.6em'], ['2.2em', '1.4em'], ['2.2em', '30em']].map(([x, y]) => `<div><dt>${b(x)}</dt><dd>${b(y)}</dd></div>`).join('')
          + `<div class="role"><dt>${b('4.4em')}</dt><dd>${b('88%')}</dd></div>`;
        const row = ([n, ...ws]) => `<tr>${ws.map((w, i) => `<td>${i === 2 ? lines(...Array.from({ length: n }, (_, j) => (j === n - 1 ? 52 : w) + '%')) : b(w + '%')}</td>`).join('')}</tr>`;   // 셋째 칸(설명)은 n줄
        main = `<div class="doc-intro"><p class="eyebrow">${b('8em')}</p><h1>${b('34%')}</h1><p class="tagline">${b('96%')}</p><dl class="meta-line">${meta}</dl>`
          + `<ul class="tags">${['6.6em', '5.6em', '6em', '5.2em', '4.8em'].map((w) => `<li>${b(w)}</li>`).join('')}</ul><details class="glance"${matchMedia('(max-width: 719.98px)').matches ? '' : ' open'}><summary>${b('7em')}</summary>`
          + `<div class="glance-body"><div class="actions">${['4.4em', '9.6em', '6.8em', '4.6em'].map((w) => `<a class="btn"><span class="ln">${b(w)}</span></a>`).join('')}</div><p class="newtab-note">${b('14em')}</p></div></details></div>`
          + `<article class="md"><blockquote><p>${b('96%')}</p><p>${lines('97%', '22%')}</p></blockquote>`
          + `<div class="table-wrap"><table><thead><tr>${[40, 70, 60, 30].map((w) => `<th>${b(w + '%')}</th>`).join('')}</tr></thead><tbody>`
          + [[2, 50, 80, 92, 40], [3, 50, 66, 88, 46], [2, 50, 74, 95, 38], [1, 50, 60, 84, 44], [2, 50, 78, 90, 40], [2, 50, 70, 86, 42]].map(row).join('') + `</tbody></table></div>`
          + `<hr><h2>${b('36%')}</h2><h3>${b('24%')}</h3><p class="pf-figure"><span class="bx"></span></p>${P(97, 94, 96, 60)}</article>`;
      }
      const card = (title, body) => `<section class="rail-card"><p class="rail-title">${b(title)}</p>${body}</section>`;
      const links = (...ws) => `<nav class="rail-links">${ws.map((w) => `<a><span class="ln">${b(w)}</span></a>`).join('')}</nav>`;
      const rail = !railOn ? '' : isLetter ? `<aside class="rail fade-host fade-list"><div class="rail-bar"></div>${card('5em', links('6.2em', '6.2em'))}</aside>`
        : `<aside class="rail fade-host fade-list"><div class="rail-bar"></div>`
          + card('6em', `<dl class="rail-meta">${[['2.2em', '9em'], ['2.2em', '11em'], ['2.2em', '2em'], ['2.2em', '96%<br>60%'], ['4.4em', '96%<br>92%<br>40%']]
            .map(([x, y]) => `<div><dt>${b(x)}</dt><dd>${y.includes('<br>') ? lines(...y.split('<br>')) : b(y)}</dd></div>`).join('')}</dl>`)
          + card('5em', links('5em', '10em', '7.4em', '5.2em', '7em')) + `</aside>`;
      return `<div class="sk-root${railOn ? '' : ' sk-railoff'}">${crumb}<div class="doc-page">${nav}<main class="doc-main">${main}</main>${rail}</div></div>`;
    };
    const DOC_CSS = `
.sk-root { position: absolute; inset: 0; overflow: hidden; ${VARS} }
.sk-root * { color: transparent !important; -webkit-text-fill-color: transparent !important; background: none !important; border-color: transparent !important;
  box-shadow: none !important; text-shadow: none !important; backdrop-filter: none !important; -webkit-mask: none !important; mask: none !important;
  animation: none !important; transition: none !important; }
.sk-root :not(.toc-links) { scrollbar-width: none !important; }                       /* 목차 목록은 실제처럼 막대 자리(scrollbar-gutter)를 남김 */
.sk-root :not(.toc-links)::-webkit-scrollbar { display: none !important; }
.sk-root .toc-links { overflow-y: hidden !important; }
.sk-root .toc-title { height: 30px; box-sizing: border-box; padding-bottom: 10px; line-height: 20px; margin: 0; }
.sk-root .ln { display: flex; align-items: center; height: 1lh; }                     /* flex 링크·단추 안: 막대만으로는 줄 높이가 사라지므로 한 줄 높이 칸에 담음 */
.sk-root *::before, .sk-root *::after { visibility: hidden !important; }
.sk-root .b, .sk-root .bx { background: ${SHIM} !important; animation: pf-skel 1.4s ease-in-out infinite !important; }
.sk-root .b { display: inline-block; max-width: 100%; height: .72em; vertical-align: -.04em; border-radius: 5px; }
.sk-root .bx { display: block; width: 100%; aspect-ratio: 16 / 9; border-radius: 10px; }
.sk-root :is(.rail-card, .glance, .actions .btn) { border-color: var(--sk) !important; background: color-mix(in srgb, var(--ink, #F4F4F6) 3%, var(--bg, #0A0A0D)) !important; }
@media screen and (min-width: 1440px) { .sk-root.sk-railoff .doc-page { grid-template-columns: calc(var(--toc-w) + var(--gap)) minmax(0, 1fr) 0px; } }
${KEYS}
@media (prefers-reduced-motion: reduce) { .sk-root .b, .sk-root .bx { animation: none !important; } }`;

    const snapHtml = () => {                                       // 새로고침·뒤로: 떠나기 전 화면에 보이던 글 줄·그림 자리 그대로(창 폭이 같을 때만)
      const S = saved && saved.s;
      if (!S || !Array.isArray(S.b) || !S.b.length || S.w !== innerWidth) return '';
      return S.b.map(([x, y, w, h, k]) => {
        if (k) return `<i class="sk-s sk-m" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></i>`;
        const th = Math.max(6, Math.round(h * 0.62));               // 글 줄 높이 안에 글자 크기만 한 막대
        return `<i class="sk-s" style="left:${x}px;top:${y + Math.round((h - th) / 2)}px;width:${w}px;height:${th}px"></i>`;
      }).join('');
    };

    const show = () => {
      if (over) return;
      const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
      el = document.createElement('div'); el.setAttribute('aria-hidden', 'true'); el.className = 'pf-skel';
      const snapped = !own() && snapHtml();
      info.kind = snapped ? 'snapshot' : own() ? 'deck' : isDoc ? (isLetter ? 'letter' : 'doc') : 'cover';
      if (snapped) el.innerHTML = snapped;
      else if (own()) { el.className = 'pf-skel sk-deck'; el.innerHTML = `<div class="sk-sl"><i class="sk-t"></i>${W(80)}${W(72)}${W(64)}${W(40)}</div>`; }
      else if (isDoc && el.attachShadow) {
        const sr = el.attachShadow({ mode: 'open' });
        sr.innerHTML = `<style>${pageCss()}\n${DOC_CSS}</style>${docHtml()}`;
      } else {                                                   // 포트폴리오 페이지: 맨 위 표지 모양
        const ln = (n) => `<div class="sk-ln sk-l${n}"><i></i></div>`;
        el.innerHTML = `<div class="sk-cv">${ln(1)}${ln(2)}${ln(3)}${ln(4)}${ln(5)}<div class="sk-stage"><div class="sk-shots"><i></i><i></i><i></i><i></i></div></div><div class="sk-pill"></div></div>`;
      }
      document.documentElement.append(el);                         // 본문 밖: 본문을 가려 둔 동안에도 보이고, 본문 안 경로(위치 기준)를 바꾸지 않음
      document.documentElement.classList.add('pf-skel-hold');      // 덮는 동안 페이지 애니메이션 멈춤(위 ④의 CSS)
      info.shown = Math.round(performance.now());
    };
    show();                                                      // 바로 보임(<html>은 이 스크립트가 돌 때 이미 있음)
    const finish = () => {
      if (over) return;
      over = true;
      info.finished = Math.round(performance.now());
      if (document.getAnimations) {                              // 점검용: 걷히는 순간 페이지 애니메이션이 얼마나 진행돼 있었는지(ms — 멈춰 두었으면 0 근처)
        const run = document.getAnimations().filter((a) => { const t = a.effect && a.effect.target; const e = t && (t instanceof Element ? t : t.element); return e && e.getRootNode() === document && !e.closest('.pf-skel') && a.playState !== 'finished'; });
        info.animsAtLift = run.length; info.maxAnimTimeAtLift = Math.round(Math.max(0, ...run.map((a) => +a.currentTime || 0)));
      }
      dispatchEvent(new Event('pf-skel-lift'));                    // 걷히기 직전(애니메이션은 아직 0ms에 멈춤) — 제자리(읽던 위치)가 정해진 뒤 다시 판단할 일에(포트폴리오 페이지 캡슐 바)
      const play = () => { document.documentElement.classList.remove('pf-skel-hold'); info.played = Math.round(performance.now()); };
      if (!el) { play(); return; }
      el.classList.add('sk-out');                                  // 흐려지며 걷힘(.25초) → 다 걷힌 뒤에 애니메이션 시작(걷히는 동안 함께 움직이지 않게)
      setTimeout(() => { el.remove(); play(); }, 260);
    };
    return { finish };
  })();
  const loading = () => document.readyState === 'loading'
    || [...document.querySelectorAll('#app > .loading, #doc > .loading, #root > .msg, [data-pf-loading]')].some((e) => /불러오는 중/.test(e.textContent));
  let placed = true;                                             // 새로고침 위치 맞추기가 다 끝날 때까지 false(그림이 늦게 들어와 다시 맞추는 일까지 덮개 아래에서)
  const onFail = [];                                             // 오류가 나면 할 일(본문 가림 풀기 등)
  const rendered = () => {                                       // 렌더러가 그린 뒤 다시 맞추는 일까지 끝났다는 페이지의 신호
    const d = document.documentElement.dataset;
    if (d.pfTableFit === 'busy' && [...document.querySelectorAll('table[data-pf-fit="wait"]')].some((t) => !t.closest('.pf-fit-probe, .print-probe') && t.getClientRects().length && t.getBoundingClientRect().top < innerHeight)) return false;
    //   ↑ 상세 문서: 표 칸 폭 맞추기(doc.js fitTables — 완료 신호와 따로 비동기로 돎)가 화면 안·위쪽 표에서 아직 안 끝남(아래쪽 표는 화면을 밀지 않음)
    if (own() || !/\/(doc|letter)\.html$/.test(location.pathname)) return d.pfReady === 'yes';   // 슬라이드·포트폴리오 페이지
    return d.docReady === '1';                                   // 상세 문서·자기소개서
  };
  // 렌더러가 배치를 바꾸는 중인지: 화면 안 요소들의 배치 자리·크기(offsetTop·offsetWidth 등 — transform 움직임은 들어가지 않음)를 재서
  //   0.3초(세 번) 그대로면 끝. 떠오름·캡슐 바처럼 꾸밈으로 움직이는 것(transform·투명도)은 기다리지 않고 걷힌 뒤 보이게 둠
  const SKIP = '.pf-skel, .pf-sb, script, style, noscript, template, svg, [aria-hidden="true"], .cap, .cap-pill, .hero-pill, .tcap, .cv-screens, .pf-fit-probe, .print-probe, [class*="pf-edit"]';   // 화면 밖에서 재는 상자(표 칸 폭)도 빼기
  const layoutSig = () => {
    const H = innerHeight, sy = scrollY, out = [];
    const absTop = (el) => { let t = 0, n = el; while (n) { t += n.offsetTop; if (!n.offsetParent && getComputedStyle(n).position === 'fixed') t += sy; n = n.offsetParent; } return t; };
    const walk = (el) => {
      for (const c of el.children) {
        if (out.length >= 500 || !(c instanceof HTMLElement) || c.matches(SKIP)) continue;
        if (!c.offsetParent && c.offsetWidth === 0 && c.offsetHeight === 0 && getComputedStyle(c).display !== 'contents') continue;   // 숨김(display:none)
        const top = absTop(c) - sy, h = c.offsetHeight;
        if (top + h <= 0 || top >= H) continue;                   // 화면 밖(자식이 밖으로 삐져나오는 일은 드물어 무시)
        out.push(`${c.offsetLeft},${c.offsetWidth},${Math.round(Math.max(top, 0))},${Math.round(Math.min(top + h, H))}`);   // 화면 안에 든 부분만(아래쪽으로 길어지는 것은 보이는 자리를 밀지 않음)
        walk(c);
      }
    };
    walk(document.body);
    return out.join('|');                                       // 페이지 전체 높이는 넣지 않음(화면 아래쪽 변화는 보이는 자리를 밀지 않음)
  };
  let lastSig = '', same = 0;
  const still = () => {
    const sig = layoutSig(), sk = window.PFAnchor.skeleton;
    if (lastSig && sig !== lastSig) sk.layoutChanges = (sk.layoutChanges || 0) + 1;   // 점검용: 기다리는 동안 화면 안 배치가 바뀐 횟수
    same = sig === lastSig ? same + 1 : 0; lastSig = sig; return same >= 3;
  };
  const imgsIn = () => [...document.images].every((i) => i.complete || !i.getClientRects().length || i.getBoundingClientRect().top >= innerHeight);   // 화면 안·위쪽 그림을 다 받음(아래쪽은 화면을 밀지 않음)
  const tryFinish = () => {                                      // 다 그리고 다시 맞춘 뒤 그레이박스를 걷음
    const sk = window.PFAnchor.skeleton;
    sk.waiting = !placed ? 'position' : loading() ? 'loading' : !rendered() ? 'renderer' : !imgsIn() ? 'images' : !still() ? 'layout' : '';   // 점검용: 지금 무엇을 기다리는지
    if (sk.waiting) { (sk.log ||= []).at(-1)?.[0] === sk.waiting || sk.log.push([sk.waiting, Math.round(performance.now())]); return; }
    clearInterval(poll); skel.finish();
  };
  const poll = setInterval(tryFinish, 100);
  addEventListener('error', (e) => {                             // 스크립트를 받지 못함(<script> 요소) · 스크립트 실행 오류(window) → 바로 걷어 안내 글이 보이게
    if (e.target !== window && !(e.target instanceof HTMLScriptElement)) return;   // 그림·글꼴 등은 페이지가 그대로 그려지므로 해당 없음
    clearInterval(poll); onFail.forEach((f) => f()); skel.finish();
  }, true);

  if (!saved || own() || typeof saved.y !== 'number' || saved.y <= 0) return;   // 위치를 맞출 일이 없음
  const y = saved.y, A = saved.a, USER = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'mousedown'], root = document.documentElement;
  const hideCss = document.createElement('style');
  hideCss.textContent = 'html.pf-restoring body { visibility: hidden !important; }';
  document.head.append(hideCss);
  root.classList.add('pf-restoring');
  placed = false;
  const reveal = () => root.classList.remove('pf-restoring');     // 본문을 보이게만 함(덮개는 그대로) — 덮개는 위치 맞추기가 끝나면(stop) 걷음
  onFail.push(() => root.classList.remove('pf-restoring'));
  const target = () => {                                         // 기억한 요소가 그려졌고 그 자리까지 스크롤할 수 있으면 → 그 요소 기준 위치, 아니면 null
    if (!A?.path) return null;
    const el = byPath(A.path);
    if (!el || el.tagName !== A.tag || !el.getClientRects().length) return null;
    const t = Math.round(scrollY + el.getBoundingClientRect().top - A.off);
    return t >= 0 && root.scrollHeight - innerHeight >= t - 1 ? t : null;
  };
  let ro = null, timer = 0, tick = 0, done = false, shown = false;
  const stop = () => { if (done) return; done = true; reveal(); ro?.disconnect(); clearTimeout(timer); clearInterval(tick); USER.forEach((t) => removeEventListener(t, stop, true)); placed = true; window.PFAnchor.skeleton.restored = Math.round(performance.now()); tryFinish(); };
  const fix = (force) => {
    if (done) return;
    let t = target();
    if (t == null) { if (!force && !shown) return; t = y; }      // 요소를 아직 못 찾음: 가려 둔 채 기다림(시간이 다 되면 숫자 위치로)
    if (Math.abs(scrollY - t) > 1) scrollTo({ top: t, behavior: 'instant' });
    if (!shown) { shown = true; reveal(); }
  };
  USER.forEach((t) => addEventListener(t, stop, { capture: true, passive: true }));
  setTimeout(() => fix(true), 3000);                             // 3초 안에 못 맞추면 숫자 위치로 보여 줌
  timer = setTimeout(stop, 20000);                               // 그림·글꼴이 늦게 와도 20초 안에는 맞춤
  const begin = () => {
    if (done) return;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(() => fix()); ro.observe(root); ro.observe(document.body); }
    let lastT = null, still = 0;
    tick = setInterval(() => {                                   // 가려진 창에서는 ResizeObserver가 멈추므로 함께 확인 · 다 그리고(화면 안·위쪽 그림 포함) 맞출 자리가 0.5초 그대로면 끝
      fix();                                                     //   (페이지 전체 높이가 아니라 기억한 요소의 자리로 판단 — 화면 아래쪽 다이어그램·표가 늦게 그려지는 것은 보이는 자리를 밀지 않음)
      const t = target() ?? (shown ? Math.round(scrollY) : null);   // 요소를 끝내 못 찾아 숫자 위치로 보여 준 뒤(3초)에는 그 자리로 판단
      still = t != null && t === lastT ? still + 1 : 0; lastT = t;
      if (still >= 2 && document.readyState === 'complete' && imgsIn() && rendered()) { fix(true); stop(); }
    }, 250);
    fix();
  };
  if (document.body) begin(); else document.addEventListener('DOMContentLoaded', begin, { once: true });
  addEventListener('load', () => fix(), { once: true });
})();
