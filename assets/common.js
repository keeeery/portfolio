// 포트폴리오 렌더러 공통 유틸 — index.html(포트폴리오 페이지) · project.html(슬라이드) · doc.html(상세 문서)가 함께 씁니다.
// 데이터: data/portfolio.json, data/projects/<폴더 이름>.json(/portfolio-build가 생성), src/<폴더>/<프로젝트 문서>.md
// 이 파일은 글을 만들지 않습니다. 화면에 나오는 내용은 모두 위 데이터에서 오고, UI 문구(절 이름·버튼·라벨)는 assets/strings.js의 문구 표(PF.t)에서 옵니다.
// 주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.

// 취소선은 물결 두 개(~~글~~)일 때만. marked의 GFM 규칙은 물결 하나(~글~)도 취소선으로 쳐서, 한국어 문서의 범위 표기
// ("0~100 정수로 … 0~1로")가 한 문단에 두 번 나오면 그 사이가 지워진 것처럼 보입니다. 물결 하나는 글자 그대로 둡니다.
// del 토크나이저가 false가 아닌 값(undefined)을 돌려주면 marked 기본 규칙으로 넘어가지 않고, 물결은 일반 글자로 읽힙니다.
// 상세 문서(doc.html)·슬라이드(project.html)의 원문 해석(md-blocks.js·PF.headingsOf)이 모두 이 설정을 씁니다. marked가 없는 페이지(index.html)는 건너뜀.
if (window.marked) {
  marked.use({
    tokenizer: {
      del(src) {
        const m = /^~~(?=[^\s~])([\s\S]*?[^\s~])~~(?=[^~]|$)/.exec(src);
        if (m) return { type: 'del', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
        return undefined;
      },
      // 직접 수정: **굵게**가 문장부호 옆에서 풀리지 않게 — CommonMark 규칙은 닫는 **가 문장부호 뒤·한글 앞이면(설계"**하는, 함수)**를) 닫힘으로 보지 않음.
      // 여는 ** 뒤와 닫는 ** 앞이 공백·별표가 아니면 굵게. 코드·링크는 maskedSrc로 가려 그 안의 **는 짝으로 쓰지 않음. 그 밖(*기울임*·***)은 원래 규칙(false → 기본 처리)
      emStrong(src, maskedSrc) {
        if (!src.startsWith('**')) return false;
        // maskedSrc는 남은 글이 아니라 글 전체 → 지금 위치에 맞춰 자름(marked 기본 emStrong과 같은 방식)
        const m = /^\*\*(?=[^\s*])([\s\S]*?[^\s*])\*\*(?!\*)/.exec(maskedSrc.slice(-src.length));
        if (!m) return false;
        const raw = src.slice(0, m[0].length), text = raw.slice(2, -2);
        return { type: 'strong', raw, text, tokens: this.lexer.inlineTokens(text) };
      },
    },
  });
}

const PF = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 텍스트 필드: HTML 이스케이프 + `백틱` → <code> + **굵게** → <strong>(백틱 안의 별표는 그대로 둠)
  // 굵게는 템플릿 원본에 없는 수정 — 프로젝트 문서에서 옮긴 글 조각(개발 의도 등)의 **강조**가 기호째 보이지 않게 함
  const inline = (s) => esc(s).replace(/`([^`]+)`|\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g,
    (m, code, bold) => (code !== undefined ? `<code>${code}</code>` : `<strong>${bold}</strong>`));
  const isUrl = (u) => /^https?:\/\//i.test(u || '');
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  // 프로젝트 저장소 링크: 저장소가 하나면 'GitHub', 둘 이상이면 모두 'GitHub(역할)'.
  // 주 저장소 = links.github(+ links.githubRole), 나머지 저장소 = links.extra 중 role이 있는 항목. role이 없는 extra는 그 밖의 링크(otherLinks)
  const repoLinks = (p) => {
    const L = p?.links || {};
    const rs = [isUrl(L.github) && { role: L.githubRole, url: L.github }, ...(L.extra || []).filter((l) => l.role && isUrl(l.url))].filter(Boolean);
    return rs.map((r) => ({ label: rs.length > 1 && r.role ? `GitHub(${r.role})` : 'GitHub', url: r.url }));
  };
  const otherLinks = (p) => (p?.links?.extra || []).filter((l) => !l.role && isUrl(l.url));

  // 오류 문구의 경로는 사람이 읽게 디코딩(src/%EA%B8%B0… → src/기술…). 조각마다 encodeURIComponent로 만들었으므로 조각마다 되돌림(#·& 등 포함)
  const shownPath = (path) => String(path).split('/').map((s) => { try { return decodeURIComponent(s); } catch { return s; } }).join('/');
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${shownPath(path)} (HTTP ${res.status})`);
    return res.json();
  }
  async function loadText(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${shownPath(path)} (HTTP ${res.status})`);
    return res.text();
  }

  // src/<폴더>/<상대경로> — 경로 조각마다 인코딩(한글 폴더·파일 이름 대응). 페이지는 모두 레포 루트에 있으므로 상대경로 그대로
  const encodePath = (p) => String(p).split('/').map(encodeURIComponent).join('/');
  const srcPath = (id, rel) => `src/${encodeURIComponent(id)}/${encodePath(String(rel).replace(/^\.\//, ''))}`;
  // ── 움직이는 이미지 = 영상(직접 추가) ──
  // 문서에는 ![설명](images/x.mp4)처럼 H.264 mp4를 적고, 같은 폴더에 x.av1.mp4(AV1, 더 작음)·x.poster.webp(대표 화면)를 둡니다.
  // 페이지에는 대표 화면 <img>를 그대로 두어 배치·PDF·PPTX는 이미지와 같고, 화면에서만 그 위에 영상을 겹쳐 재생합니다(영상은 클릭을 받지 않아 이미지처럼 눌러집니다 — 상세 문서는 확대. 일시정지·재생은 오른쪽 아래 버튼으로만).
  const MP4_RE = /\.mp4(?=$|[?#])/i, POSTER_RE = /\.poster\.webp(?=$|[?#])/i;
  const AV1_TYPE = 'video/mp4; codecs="av01.0.08M.08"';
  const videoSources = (base) => `<source src="${esc(base)}.av1.mp4" type='${AV1_TYPE}'><source src="${esc(base)}.mp4" type="video/mp4">`;   // AV1 먼저, 재생 못 하는 브라우저는 H.264
  // 일시정지·재생 아이콘(글자 기호 대신 직접 그림 — 막대가 가늘고 간격이 넓음)
  const videoIcon = (paused) => paused
    ? '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5.2 3.2v9.6a.5.5 0 0 0 .76.43l7.7-4.8a.5.5 0 0 0 0-.86l-7.7-4.8a.5.5 0 0 0-.76.43z" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><rect x="3.6" y="3" width="2.8" height="10" rx="1" fill="currentColor"/><rect x="9.6" y="3" width="2.8" height="10" rx="1" fill="currentColor"/></svg>';
  const videoPoster = (src) => (src && MP4_RE.test(src) ? String(src).replace(MP4_RE, '.poster.webp') : src);
  function setupVideos() {
    if (typeof IntersectionObserver === 'undefined') return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', setupVideos, { once: true }); return; }
    const st = document.createElement('style');
    st.textContent = `.pf-vid{position:absolute;overflow:hidden;z-index:1;background:transparent;pointer-events:none}
.pf-vid[hidden]{display:none}
.pf-vid video{display:block;width:100%;height:100%;pointer-events:none}
.pf-vid-btn{position:absolute;right:8px;bottom:8px;width:34px;height:34px;padding:0;border:0;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .15s;pointer-events:auto}
img:hover+.pf-vid .pf-vid-btn,.lb-vid:hover .pf-vid-btn,.pf-vid.is-paused .pf-vid-btn,.pf-vid-btn:hover,.pf-vid-btn:focus-visible{opacity:1}
@media (hover:none){.pf-vid-btn{opacity:.8}}
@media print{.pf-vid{display:none!important}}`;
    document.head.append(st);
    const live = new Set();          // 화면에 보이는 영상 칸(자리 맞추기·재생 대상)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // img의 자리(테두리 안쪽)를 영상 칸의 기준 상자(offsetParent) 좌표로. 슬라이드의 확대·축소(transform)와 무관하게 맞음
    function place(v) {
      const was = v.shown;
      v.shown = layout(v);
      if (v.shown !== was) sync(v);                                    // 다른 장면으로 넘어가 숨으면 멈추고, 다시 보이면 재생
    }
    function layout(v) {
      const { img, box, video } = v;
      if (!img.isConnected) { box.remove(); v.io.disconnect(); live.delete(v); return false; }
      const s = getComputedStyle(img);
      if (!img.clientWidth || s.visibility === 'hidden') { box.hidden = true; return false; }
      box.hidden = false;                                             // 숨긴 채로는 offsetParent가 없으므로 먼저 보이게 한 뒤 잼
      if (!box.offsetParent) { box.hidden = true; return false; }
      let x = img.offsetLeft + img.clientLeft, y = img.offsetTop + img.clientTop, p = img.offsetParent;
      const cb = box.offsetParent;
      while (p && p !== cb) { x += p.offsetLeft + p.clientLeft - p.scrollLeft; y += p.offsetTop + p.clientTop - p.scrollTop; p = p.offsetParent; }
      const set = (k, val) => { if (box.style[k] !== val) box.style[k] = val; };
      set('left', `${x}px`); set('top', `${y}px`); set('width', `${img.clientWidth}px`); set('height', `${img.clientHeight}px`);
      set('borderRadius', s.borderRadius);
      if (video.style.objectFit !== s.objectFit) { video.style.objectFit = s.objectFit; video.style.objectPosition = s.objectPosition; }
      return true;
    }
    let raf = 0;
    const tick = () => { raf = 0; live.forEach(place); if (live.size) raf = requestAnimationFrame(tick); };
    function sync(v) {
      const btn = v.box.querySelector('.pf-vid-btn');
      const paused = v.user || !v.vis || !v.shown;
      v.box.classList.toggle('is-paused', !!v.user);
      btn.innerHTML = videoIcon(!!v.user);
      btn.setAttribute('aria-label', v.user ? PFStr.t('ui.video-play') : PFStr.t('ui.video-pause'));
      if (paused) v.video.pause();
      else { const pr = v.video.play(); if (pr && pr.catch) pr.catch((e) => { if (e && e.name === 'NotAllowedError') { v.user = true; sync(v); } }); }   // 자동 재생이 막힌 브라우저면 ▶로 두고 누르면 재생
    }
    function attach(img) {
      const src = img.getAttribute('src');
      if (img.dataset.pfVid || !src || !POSTER_RE.test(src)) return;
      img.dataset.pfVid = '1';
      const base = img.src.replace(POSTER_RE, '');
      const box = document.createElement('div');
      box.className = 'pf-vid'; box.hidden = true;
      box.setAttribute('data-pf-allow-hidden', '');  // 슬라이드 배치 점검: 마우스를 올릴 때만 보이는 버튼은 숨은 글자로 세지 않음
      box.innerHTML = `<video muted loop playsinline disablepictureinpicture preload="none" aria-hidden="true">${videoSources(base)}</video><button type="button" class="pf-vid-btn"></button>`;
      const video = box.querySelector('video');
      video.muted = true; video.poster = img.currentSrc || img.src;
      img.dataset.pfVidBase = base;   // 확대 창(doc.js)이 같은 영상을 크게 틀 때 씀
      img.after(box);
      const v = { img, box, video, user: reduce, vis: false, shown: false };
      box.querySelector('.pf-vid-btn').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); v.user = !v.user; sync(v); });   // 일시정지·재생은 이 버튼으로만(영상 자체는 클릭을 받지 않음)
      video.addEventListener('error', () => box.remove(), true);   // 영상이 없으면 대표 화면 이미지만 남김
      v.io = new IntersectionObserver(([en]) => {
        v.vis = en.isIntersecting;
        if (v.vis) { live.add(v); place(v); if (!raf) raf = requestAnimationFrame(tick); } else live.delete(v);
        sync(v);
      }, { rootMargin: '200px' });
      v.io.observe(img);
      sync(v);
    }
    const scan = (n) => { if (n.nodeType !== 1) return; if (n.localName === 'img') attach(n); else n.querySelectorAll('img').forEach(attach); };
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach(scan);
      if (m.type === 'attributes' && m.target.localName === 'img') attach(m.target);
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    scan(document.body);
  }
  setupVideos();

  // 페이지 사이 주소(상대경로, 앞에 / 없음 — 프로젝트 Pages는 /<레포>/ 아래에 있음)
  const projectUrl = (id, sid = '') => `project.html?p=${encodeURIComponent(id)}${sid ? `#s=${sid}` : ''}`;
  const docUrl = (id, anchor = '') => `doc.html?p=${encodeURIComponent(id)}${anchor ? `#${anchor}` : ''}`;
  // 보이는 주소(PDF에서 그대로 칠 수 있게): 지금 사이트 주소 + 상대경로. 조각(#…)은 넣지 않음(portfolio-structure §5-4)
  const siteBase = () => `${location.host}${location.pathname.replace(/[^/]*$/, '')}`;
  const visibleUrl = (rel) => { let u = siteBase() + String(rel).replace(/#.*$/, ''); try { u = decodeURI(u); } catch { /* 그대로 */ } return u; };

  const metaValue = (p, label) => (p.meta || []).find((m) => m.label === label)?.value || '';
  const teamLabel = (team) => (team?.type === 'team' ? `${PFStr.t('name.team')}${team.size ? ' · ' + team.size : ''}` : PFStr.t('name.solo'));

  // GitHub와 같은 제목 앵커 규칙(github-slugger). slug는 이 함수만 만듭니다(빌드·Claude가 손으로 계산하지 않음)
  function slugger() {
    const seen = Object.create(null);
    return (text) => {
      const base = String(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '').replace(/ /g, '-');
      let slug = base;
      while (seen[slug] !== undefined) { seen[base] += 1; slug = `${base}-${seen[base]}`; }
      seen[slug] = 0;
      return slug;
    };
  }
  // 제목 비교용 정규화 — 백틱·강조 기호·공백 차이 무시
  const normTitle = (t) => String(t || '').replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
  // data의 section(절 제목) → 문서 제목. 규칙(portfolio-structure §3-3): 정규화 → 정확히 일치 → 앞부분 양방향 일치, 여럿이면 문서 순서상 첫 번째
  //   list: [{ text, ... }] 문서 순서. 돌려주는 값: 그 항목 또는 null
  function resolveHeading(list, title) {
    const want = normTitle(title);
    if (!want) return null;
    const norm = list.map((h) => [normTitle(h.text), h]);
    return (norm.find(([t]) => t === want) || norm.find(([t]) => t && (t.startsWith(want) || want.startsWith(t))))?.[1] || null;
  }
  // 슬라이드에서 원문 절(section 글자)에 해당하는 장면 id(포트폴리오 페이지의 [슬라이드 열기]·슬라이드 옛 주소 hl-n 넘기기)
  const KEY_RE = /^[a-z][a-z0-9-]{1,31}$/;
  const keyOk = (k) => KEY_RE.test(k || '') && !/^s-\d+$/.test(k);
  function deckSceneFor(p, section) {
    const want = normTitle(section);
    if (!want || !p.deck?.slides?.length) return '';
    const last = (x) => normTitle((x.sectionPath || []).slice(-1)[0]);
    const find = (list) => list.find((x) => last(x) === want) || list.find((x) => (x.sectionPath || []).some((t) => normTitle(t) === want));
    const sl = find(p.deck.slides);
    if (sl) return keyOk(sl.key) ? `d-${sl.key}` : '';
    // 장면 고치기로 숨긴 장면(빌드 결과 deck.base에만 있음) → 같은 장에 장면이 남아 있으면 그 장 표지
    const hid = find(p.deck.base || []);
    return hid && keyOk(hid.chapter) && p.deck.slides.some((x) => x.chapter === hid.chapter) ? `ch-${hid.chapter}` : '';
  }
  // md → HTML. marked(gfm)를 부르는 곳은 이 함수 하나입니다(프로젝트 상세 문서·슬라이드·제목 목록이 같은 결과를 쓰도록).
  //   한국어 굵은 글씨 보완: CommonMark 규칙은 **"인용"**입니다 · **이름(설명)**와 처럼 닫는 ** 앞이 문장부호이고 바로 뒤에
  //   글자(조사)가 붙으면 굵은 글씨로 보지 않아 별표가 그대로 보입니다. 여는 쪽도 같습니다(글자**"인용"**). 그 두 경우만
  //   굵은 글씨로 받아 주고, 나머지는 marked의 기본 규칙에 맡깁니다(조건에 안 맞으면 아무것도 돌려주지 않음).
  const PUNCT = /[\p{P}\p{S}]/u, WORD = /[^\s\p{P}\p{S}]/u;
  let mdReady = false;
  function mdHtml(md) {
    if (!mdReady) {
      mdReady = true;
      marked.use({ extensions: [{
        name: 'strongKo', level: 'inline',
        start(src) { const i = src.indexOf('**'); return i < 0 ? undefined : i; },
        tokenizer(src, tokens) {
          // ** + 안쪽(줄 안, 코드 조각은 통째로, 양 끝은 공백 아님) + **  — 안쪽에 **가 또 있으면 가장 가까운 곳에서 닫음
          const m = /^\*\*(?!\s)((?:`[^`\n]+`|[^`\n])+?)(?<!\s)\*\*(?!\*)/.exec(src);
          if (!m) return undefined;
          const inner = m[1], after = src[m[0].length] || '';
          const last = tokens && tokens[tokens.length - 1];
          const before = last && last.raw ? last.raw.slice(-1) : '';
          const closeFails = PUNCT.test(inner.slice(-1)) && WORD.test(after);    // 닫는 ** : 앞이 문장부호, 뒤가 글자
          const openFails = PUNCT.test(inner[0]) && WORD.test(before);            // 여는 ** : 앞이 글자, 뒤가 문장부호
          if (!closeFails && !openFails) return undefined;
          return { type: 'strongKo', raw: m[0], text: inner, tokens: this.lexer.inlineTokens(inner) };
        },
        renderer(token) { return `<strong>${this.parser.parseInline(token.tokens)}</strong>`; },
      }] });
    }
    return marked.parse(md, { gfm: true });
  }

  // md → 제목 목록(상세 문서와 같은 파이프라인: marked gfm → 제목 textContent → slugger). 제목 목록이 필요한 곳용(원문 블록까지 필요하면 md-blocks.js의 PF.md.parse)
  //   <template>에 넣는 이유: 그 안의 내용은 비활성이라 문서 속 이미지(GIF 수십 MB)를 받지 않음. div에 넣으면 DOM에 붙이지 않아도 이미지를 받기 시작함
  function headingsOf(md) {
    if (!window.marked) return [];
    const box = document.createElement('template');
    box.innerHTML = mdHtml(md);
    const slug = slugger();
    return [...box.content.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({ level: +h.tagName[1], text: h.textContent.trim(), id: slug(h.textContent.trim()) }));
  }

  // ── 링크 규칙: 포트폴리오 밖(http(s) 주소 — GitHub·영상 등)과 PDF 파일 = 새 탭 + 숨김 "(새 탭)".
  //    포트폴리오 안의 이동(문서 사이·원문 파일·같은 문서 안)은 같은 탭(새 탭이 계속 쌓이지 않게 — 새 탭은 읽는 사람이 휠 클릭으로).
  //    ↗(aria-hidden)는 문서 사이·외부·원문 파일 = "다른 페이지로 감" 표시. 같은 문서 안 이동·mailto:·덱 조작 버튼·라이트박스 = 표시 없음
  const ICON = '<svg class="pf-newtab-icon" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  //    외부(새 탭) = 상자+화살표 아이콘(포트폴리오 페이지의 ext와 같은 모양) · 포트폴리오 안의 다른 페이지·원문 파일 = ↗ · 돌아가기(kind 'back') = 아이콘 없음
  const ICON_EXT = '<svg class="pf-newtab-icon pf-ext-icon" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2.25H3.75a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h5.5a1 1 0 0 0 1-1V7.5"/><path d="M7.25 2.25h3v3M10.25 2.25 6.25 6.25"/></svg>';
  const NEWTAB = ICON;
  const NEWTAB_SR = '<span class="pf-sr-only pf-newtab-sr">(새 탭)</span>';
  const isExternal = (h) => /^https?:\/\//i.test(h || '') || /\.pdf(?:[?#]|$)/i.test(h || '');   // 외부 주소와 PDF 파일 = 새 탭
  const NEW_TAB_KINDS = new Set(['external', 'page', 'file']);
  function link({ href, label, kind = 'external', cls = '', attrs = '' }) {
    const back = kind === 'back', ext = !back && isExternal(href), nt = !back && (NEW_TAB_KINDS.has(kind) || ext);
    return `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}${back ? ' data-pf-back' : ''}${attrs ? ' ' + attrs : ''}>${label}${ext ? ICON_EXT + NEWTAB_SR : nt ? NEWTAB : ''}</a>`;
  }
  // 돌아가기 링크(data-pf-back): 포트폴리오 페이지에서 왔으면 브라우저 '뒤로'처럼 돌아가 읽던 자리로(스크롤 위치 그대로).
  //   같은 페이지 안에서 목차·절 링크(#…)로 옮겨 다닌 기록은 건너뜀 — 이 페이지에 들어온 뒤 쌓인 # 이동 수(pfDepth)를 기록마다 적어 두고 그만큼 더 뒤로.
  //   새 탭에서 열었거나(그 탭에 앞 기록이 없음 — 들어올 때 기록 수가 1이면 pfPrev = false) 다른 곳(슬라이드·주소 직접 입력)에서 왔으면 그냥 href(index.html)로 이동.
  //   휠 클릭·Ctrl/⌘ 클릭은 브라우저 기본 동작(새 탭) 그대로
  let pfDepth = history.state?.pfDepth ?? 0;
  const pfPrev = history.state?.pfPrev ?? history.length > 1;
  if (history.state?.pfDepth == null) history.replaceState({ ...(history.state || {}), pfDepth, pfPrev }, '');
  addEventListener('popstate', (e) => { if (e.state?.pfDepth != null) pfDepth = e.state.pfDepth; });
  addEventListener('hashchange', () => {                             // 새로 # 이동하면 기록에 깊이가 없음 → 하나 더 깊게. 뒤로·앞으로 온 기록은 적어 둔 값
    if (history.state?.pfDepth == null) { pfDepth += 1; history.replaceState({ ...(history.state || {}), pfDepth, pfPrev }, ''); }
    else pfDepth = history.state.pfDepth;
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[data-pf-back]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let ref; try { ref = new URL(document.referrer); } catch { return; }
    const page = (u) => u.pathname.replace(/\/index\.html$/, '/');               // '/' 와 '/index.html'은 같은 페이지
    if (!pfPrev || ref.origin !== location.origin || page(ref) !== page(new URL(a.getAttribute('href'), location.href))) return;
    e.preventDefault(); history.go(-((history.state?.pfDepth ?? pfDepth) + 1));   // 직접 고침: 주소를 바꾸지 않는 이동(page-anchor.js·슬라이드 목차)도 기록의 pfDepth로 셈
  });
  function markNewTab(a) {                                           // 이미 있는 <a>(md 안 등)에 같은 규칙 적용: ↗ 표시 + 외부 주소만 새 탭
    const ext = isExternal(a.getAttribute('href'));
    if (ext) { a.target = '_blank'; a.rel = 'noopener'; } else a.removeAttribute('target');
    if (!a.querySelector('.pf-newtab-icon')) a.insertAdjacentHTML('beforeend', ext ? ICON_EXT + NEWTAB_SR : NEWTAB);
  }

  // ── 상세 문서·자기소개서 오른쪽 칸(.rail) 접기·열기 — 넓은 화면은 접기(남김), 좁은 화면은 떠 있는 카드로 열기(남기지 않음). 모양은 doc.css '오른쪽 칸 접기·열기' ──
  function railToggle() {
    const rail = document.querySelector('.rail');
    if (!rail) return;
    const root = document.documentElement, KEY = 'pf-rail', wide = matchMedia('screen and (min-width: 1440px)');
    rail.id ||= 'pf-rail';
    const head = document.querySelector('.doc-head'), page = document.querySelector('.doc-page');
    let raf = 0;
    // 머리 줄은 화면 맨 위에 늘 붙어 있음(doc.css '머리 줄'). --head-h = 그 높이(목차·오른쪽 칸·제목 도착·캡슐이 그 아래로) · --head-b = 머리 줄 아래 끝 ·
    //   --rail-y = 오른쪽 칸 맨 위 자리(머리 줄 아래 --side-gap — 처음 자리와 붙는 자리가 같음) — 열기·닫기 단추가 늘 이 자리
    const headB = () => {
      raf = 0;
      const h = head ? head.offsetHeight : 0, b = Math.round(head?.getBoundingClientRect().bottom || 0);
      root.style.setProperty('--head-h', `${h}px`);
      root.style.setProperty('--head-b', `${Math.max(0, b)}px`);
      const gap = parseFloat(getComputedStyle(root).getPropertyValue('--side-gap')) || 12;   // 머리 줄과 오른쪽 칸 사이(doc.css --side-gap)
      root.style.setProperty('--rail-y', `${Math.round(Math.max(h, page?.getBoundingClientRect().top ?? h) + gap)}px`);
    };
    addEventListener('scroll', () => { raf ||= requestAnimationFrame(headB); }, { passive: true }); addEventListener('resize', headB); headB();
    try { root.classList.toggle('pf-rail-off', localStorage.getItem(KEY) === 'off'); } catch { /* 저장소 막힘 */ }
    // 열기·닫기 단추 하나: 카드와 함께 사라지지 않고 제자리에 남아 글자만 바뀜 — [카드 닫기 ›] ↔ [카드 열기 ‹](화살표는 늘 글자 오른쪽).
    //   ≥1280px에서 오른쪽 칸 맨 위 자리에 떠 있음(.rail-fab, 카드 묶음 맨 위의 빈 줄 .rail-bar 위 — 1280~1440px은 카드가 떠서 나옴). <1280px은 이 단추 대신 아래 빠른 이동 캡슐의 [바로가기](linksPop)
    //   문구 표 'doc.rail-close'·'doc.rail-open' — 예전 문구 표가 캐시에 남아 키가 그대로 오면 기본 글자
    const word = (k, d) => { const s = t(k); return esc(s === k ? d : s); };
    const label = (on) => `${on ? word('doc.rail-close', '카드 닫기') : word('doc.rail-open', '카드 열기')} <span aria-hidden="true">${on ? '›' : '‹'}</span>`;
    const attrs = `type="button" data-rail-toggle aria-controls="${rail.id}"`;
    rail.insertAdjacentHTML('afterbegin', '<div class="rail-bar" aria-hidden="true"></div>');
    document.body.insertAdjacentHTML('beforeend', `<button class="rail-fab" ${attrs}></button>`);
    const shown = () => (wide.matches ? !root.classList.contains('pf-rail-off') : root.classList.contains('pf-rail-open'));
    const sync = () => {
      const on = shown();
      root.classList.toggle('pf-rail-shown', on);
      document.querySelectorAll('[data-rail-toggle]').forEach((b) => { b.setAttribute('aria-expanded', String(on)); b.innerHTML = label(on); });
      dispatchEvent(new Event('resize'));                              // [맨 위로] 캡슐 자리 등 다시 재기
    };
    const set = (on) => {
      root.classList.add('pf-rail-anim');                              // 처음 그릴 때(남겨 둔 '접음')는 움직이지 않고, 누를 때부터 움직임
      if (wide.matches) { root.classList.toggle('pf-rail-off', !on); try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* 저장소 막힘 */ } }
      else root.classList.toggle('pf-rail-open', on);
      sync();
    };
    document.addEventListener('click', (e) => {
      if (e.target.closest?.('[data-rail-toggle]')) { set(!shown()); return; }
      if (!wide.matches && root.classList.contains('pf-rail-open') && !rail.contains(e.target)) set(false);   // 떠 있는 카드 바깥을 누르면 닫힘
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !wide.matches && root.classList.contains('pf-rail-open')) set(false); });
    let wasWide = wide.matches;
    const onWidth = () => {                                            // 넓은 ↔ 좁은 화면이 바뀌면 떠 있던 카드는 닫고 상태를 다시 맞춤(change 이벤트가 늦게 오는 경우도 resize에서)
      if (wide.matches === wasWide) return;
      wasWide = wide.matches; root.classList.remove('pf-rail-open'); sync();
    };
    wide.addEventListener('change', onWidth); addEventListener('resize', onWidth);
    matchMedia('screen and (min-width: 1280px)').addEventListener('change', () => { root.classList.remove('pf-rail-open'); sync(); });   // <1280px은 단추가 없으니 떠 있던 카드를 닫음
    sync();
    linksPop(rail);
  }

  // ── 좁은 화면(<1280px) 아래 떠 있는 단추: 동그란 [≡](목차 + 바로가기 창) 하나, 그 위에 동그란 [↑](맨 위로 — 위로 스크롤할 때만 빠르게 페이드 인, topCap이 켜고 끔).
  //   [≡]를 누르면 목차 창(.toc-dialog)이 열리고, 목차 목록은 줄어든 칸 안에서 스크롤되며 그 아래에 오른쪽 칸 '바로가기' 카드의 링크가 함께 나옴
  //   (열 때마다 그때의 링크를 복사 — 자기소개서 PDF는 늦게 채워짐. 링크가 없으면 카드도 없음). 모양은 doc.css '떠 있는 동그란 단추'
  const FAB_ICON = {
    menu: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h12M4 10h12M4 14h12"/></svg>',
    close: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>',
    up: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15.5V4.5M5 9.5l5-5 5 5"/></svg>',
  };
  function linksPop(rail) {
    const src = rail.querySelector('.rail-links'), fab = document.querySelector('.doc-fab'), dlg = document.querySelector('.toc-dialog');
    if (!fab) return;
    const toc = fab.querySelector('.fab-toc');
    const word = ((s) => esc(s === 'doc.rail-links' ? '바로가기' : s))(t('doc.rail-links'));
    const tocWord = esc(t('name.toc')), topWord = esc(t('doc.top'));
    if (toc) { const label = src ? `${tocWord} · ${word}` : tocWord; toc.innerHTML = FAB_ICON.menu; toc.setAttribute('aria-label', label); toc.title = label; }
    fab.insertAdjacentHTML('afterbegin', `<a class="fab-top" href="#top" tabindex="-1" aria-label="${topWord}" title="${topWord}">${FAB_ICON.up}</a>`);
    fab.querySelector('.fab-top').addEventListener('click', (e) => e.currentTarget.blur());
    if (!dlg) return;
    //   목차 창 = 화면 전체를 덮는 투명한 창(어두운 막은 ::backdrop) 안에 [≡] 위에 붙어 나오는 패널(.toc-panel) + 눌린 모양의 [≡](.toc-dlg-fab).
    //   눌린 단추는 어두운 막 위에 아래 [≡]와 같은 자리로 다시 그리고 아이콘은 [×] — 이 단추가 닫기를 맡으므로 패널 머리의 [닫기]는 뺌.
    //   누르면 창이 닫힘(.dlg-close — doc.js·letter.js가 닫음). 막(창 빈 곳)을 눌러도 닫힘. 창을 열면 초점은 패널 자체(autofocus — 단추에 초점 테두리가 바로 뜨지 않게, Tab으로 목차 → 링크 → [×])
    const panel = document.createElement('div');
    panel.className = 'toc-panel'; panel.tabIndex = -1; panel.autofocus = true;
    panel.append(...dlg.childNodes);
    panel.querySelector('.toc-dialog-head .dlg-close')?.remove();
    dlg.append(panel);
    const dlgList = panel.querySelector('.toc-links');                  // 직접 수정: 목록을 칸(.toc-scroll)으로 감싸 옆 목차와 같은 끝 흐림 + 화살표 · 가는 막대
    if (dlgList) { const wrap = document.createElement('div'); wrap.className = 'toc-scroll'; dlgList.before(wrap); wrap.append(dlgList); tocEdges(wrap, dlgList); }
    //   (터치) 열려 있는 동안 뒤 페이지 스크롤 막기: 목차 목록(스크롤할 내용이 있을 때) 밖에서의 터치 쓸기는 무시(iPhone Safari는 html overflow:hidden만으로는 막이 뒤로 스크롤을 넘김).
    //   마우스 휠은 막지 않음 — 마우스로 쓰는 좁은 화면은 막 위에서 뒤 페이지가 스크롤돼도 됨
    const scroller = (e) => { const sc = e.target.closest?.('.toc-links'); return sc && sc.scrollHeight > sc.clientHeight + 1; };
    dlg.addEventListener('touchmove', (e) => { if (!scroller(e)) e.preventDefault(); }, { passive: false });
    //   창을 열면 지금 읽는 절(옆 목차 #toc-links의 .active — doc.js·letter.js가 스크롤에 맞춰 붙임)을 창 목차에서도 강조하고, 목록 위에서 1/3쯤에 오게 스크롤
    //   (창은 다음 리스너가 showModal로 여므로 그린 뒤 프레임에서 잼). 열려 있는 동안 뒤 페이지가 스크롤돼(마우스 휠) 지금 절이 바뀌면 바로 따라 바꾸고,
    //   목록에서 벗어나면 다시 보이게 스크롤(옆 목차와 같은 규칙 — 위아래 40px 안쪽)
    const sync = (center) => {
      const list = dlg.querySelector('.toc-links'), cur = document.querySelector('#toc-links a.active');
      if (!list) return;
      list.querySelectorAll('a').forEach((a) => { const on = !!cur && a.hash === cur.hash; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'); });
      const a = list.querySelector('a.active');
      if (!a) { if (center) list.scrollTop = 0; return; }
      const top = a.offsetTop, bottom = top + a.offsetHeight;
      if (center || top < list.scrollTop + 40 || bottom > list.scrollTop + list.clientHeight - 40) list.scrollTop = Math.max(0, top - list.clientHeight / 3);
    };
    toc?.addEventListener('click', () => requestAnimationFrame(() => sync(true)));
    const side = document.getElementById('toc-links');
    if (side) new MutationObserver(() => { if (dlg.open) sync(false); }).observe(side, { subtree: true, attributes: true, attributeFilter: ['class'] });
    const closeWord = esc(t('ui.close'));
    dlg.insertAdjacentHTML('beforeend', `<button type="button" class="toc-dlg-fab dlg-close" aria-label="${tocWord} ${closeWord}" title="${tocWord} ${closeWord}">${FAB_ICON.close}</button>`);
    if (!src) return;
    const card = document.createElement('section');                   // 목차 창 아래 '바로가기' 카드
    card.className = 'toc-dialog-links';
    card.innerHTML = `<p class="rail-title">${word}</p><nav class="rail-links" aria-label="${word}"></nav>`;
    panel.append(card);
    const list = card.querySelector('.rail-links');
    const fill = () => { list.innerHTML = src.innerHTML; card.hidden = !src.textContent.trim(); };
    toc?.addEventListener('click', fill);
    list.addEventListener('click', (e) => {
      if (e.target.closest('[data-pdf-print]')) { dlg.close(); window.print(); }   // 자기소개서 [PDF로 저장](복사본에는 원래 단추의 동작이 없음). 링크는 목차 창이 닫음
    });
    fill();
  }

  function topCap(label) {
    // [맨 위로] 캡슐: 머리 줄([← 돌아가기 › 제목] [화면 모드])은 화면 맨 위에 늘 붙어 있고 숨거나 나오는 움직임이 없음.
    //   캡슐은 맨 위 가까이를 벗어나 위로 스크롤하면 머리 줄 높이(줄 가운데, --cap-top)에 본문 칸 가운데로 위에서 내려옴(오른쪽 칸을 접고 펴면 함께 옮겨 감). 아래로 스크롤하면 다시 화면 위로 빠짐.
    //   [← 돌아가기 › 제목]은 목차가 없는 좁은 화면(<1280px)에서만, 본문 글(본문 칸 첫 요소)의 위 끝이 머리 줄 아래 끝에 닿으면 숨김(.crumb-off) — 투명한 머리 줄에서 본문 글과 겹치지 않게.
    //   화면 모드 단추도 함께 숨김(doc.css). 목차가 보이는 넓은 화면은 둘 다 늘 보임
    const main = document.querySelector('.doc-main');
    const cap = document.createElement('div');
    cap.className = 'tcap';
    cap.innerHTML = `<nav class="cap-pill" aria-label="빠른 이동">
      <div class="cap-row"><a class="btn" href="#top" tabindex="-1">${esc(label)} <span aria-hidden="true">↑</span></a></div></nav>`;
    document.body.append(cap);
    const btn = cap.querySelector('.btn');
    let on = false, lastY = scrollY, pend = 0, quietUntil = 0;
    const root = document.documentElement;
    const head = document.querySelector('.doc-head');
    const measure = () => {                                            // 캡슐 자리 = 화면 모드 단추 위 끝과 같은 높이 · 숨을 때 올라갈 거리 = 자리 + 캡슐 + 그림자 여유 40
      const mode = head?.querySelector('.pf-mode'), ch = cap.firstElementChild.offsetHeight;
      const top = mode?.offsetHeight ? Math.round(mode.getBoundingClientRect().top - head.getBoundingClientRect().top) : 11;   // 화면 모드 단추의 위 끝과 같은 높이(머리 줄 위 끝 기준 — 단추가 없으면 11px)
      root.style.setProperty('--cap-top', `${top}px`);
      root.style.setProperty('--cap-d', `${top + ch + 40}px`);
    };
    const first = main?.firstElementChild;
    let crumbOff = null;
    const withToc = matchMedia('screen and (min-width: 1280px)');      // 목차가 보이는 넓은 화면: 머리 줄 글자는 목차 칸 위라 본문과 겹치지 않으니 늘 보임
    const crumb = () => {                                              // (좁은 화면) 본문 글이 머리 줄에 닿으면 [← 돌아가기 › 제목] 숨김
      if (!head || !first) return;
      const off = !withToc.matches && first.getBoundingClientRect().top <= head.getBoundingClientRect().bottom;
      if (off !== crumbOff) { head.classList.toggle('crumb-off', off); crumbOff = off; }
    };
    addEventListener('scroll', crumb, { passive: true }); addEventListener('resize', crumb); withToc.addEventListener('change', crumb); crumb();
    const place = () => { if (!main) return; const r = main.getBoundingClientRect(); if (r.width) cap.style.left = `${Math.round(r.left + r.width / 2)}px`; };
    // 좁은 화면(<1280px)은 이 캡슐 대신 아래 [≡] 위의 동그란 [↑](.fab-top)가 같은 때에 나타나고 사라짐(html.pf-top-on — doc.css)
    const fabTop = () => document.querySelector('.fab-top');
    const show = () => { if (on) return; on = true; cap.classList.add('on'); btn.removeAttribute('tabindex'); root.classList.add('pf-top-on'); fabTop()?.removeAttribute('tabindex'); };
    const hide = () => { if (!on) return; on = false; cap.classList.remove('on'); btn.setAttribute('tabindex', '-1'); root.classList.remove('pf-top-on'); fabTop()?.setAttribute('tabindex', '-1'); };
    const tick = () => {
      pend = 0;
      const y = scrollY, dy = y - lastY;
      if (performance.now() < quietUntil) { hide(); lastY = y; return; }   // # 이동 중
      if (y < Math.min(innerHeight * .6, 480)) hide();                  // 맨 위 가까이: 캡슐은 필요 없음
      else if (dy < -6) show();
      else if (dy > 6) hide();
      if (Math.abs(dy) > 6 || y < 8) lastY = y;
    };
    addEventListener('scroll', () => { if (!pend) pend = setTimeout(tick, 50); }, { passive: true });   // 50ms마다 한 번 판단
    document.addEventListener('click', (e) => {                         // 목차·절 링크: 부드러운 스크롤이 끝날 때까지 캡슐을 숨긴 채로
      const a = e.target.closest?.('a[href^="#"]');
      if (!a || a === btn || a.getAttribute('href') === '#top') return;
      quietUntil = performance.now() + 900; hide();
    });
    btn.addEventListener('click', () => { btn.blur(); });
    addEventListener('resize', () => { measure(); place(); }); document.fonts?.ready.then(measure);
    if (main && 'ResizeObserver' in window) new ResizeObserver(place).observe(main);   // 오른쪽 칸 접기·펴기 움직임 동안에도 본문 칸 가운데를 따라감
    measure(); place();
  }

  // ── 강조색(profile.md "강조색", theme/theme.css의 --t-accent가 있으면 그 색) → 색 토큰 ──
  //   글자에 쓰는 강조색은 화면 바탕(--t-bg, 없으면 어두운 기본 바탕) 대비 7:1 이상이 되게 바탕 반대쪽(어두운 바탕이면 밝게, 밝은 바탕이면 어둡게)으로,
  //   흰 글자를 올리는 칠은 4.5:1 이상이 되게 어둡게 맞춤. --accent-2 = 강조색의 색상을 보라(285°) 쪽으로 50° 돌린 짝(파랑 → 보라, 주황 → 분홍),
  //   --accent-3 = 같은 쪽으로 95°(광채). theme.css에 --t-accent-2·--t-accent-3이 있으면 그 색
  //   흰 종이에 찍는 A4 인쇄(포트폴리오 페이지·상세 문서)는 '-p'가 붙은 값을 씀(portfolio.css·doc.css의 @media print). 슬라이드는 인쇄도 화면 장면 그대로
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgbHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);           // t = b 쪽 비율
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function hueOf(c) {
    const [r, g, b] = c.map((v) => v / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    if (!d) return null;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  }
  function hueShift(c, deg) {                                             // RGB → HSL에서 색상만 돌리고 채도·밝기는 그대로
    const h0 = hueOf(c);
    if (h0 === null) return c;
    const [r, g, b] = c.map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    const s = (max - min) / (1 - Math.abs(2 * l - 1)), h = ((h0 + deg) % 360 + 360) % 360;
    const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs((h / 60) % 2 - 1)), m = l - C / 2;
    const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
    return [r1 + m, g1 + m, b1 + m].map((v) => v * 255);
  }
  const DARK_BG = [10, 10, 13];                                           // 어두운 기본 바탕(--bg #0A0A0D)
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
  function themeTokens(hex, { bg, a2, a3 } = {}) {
    if (!isHex(hex)) return null;
    const A = hexRgb(hex), WHITE = [255, 255, 255], BLACK = [0, 0, 0];
    const BG = isHex(bg) ? hexRgb(bg) : DARK_BG, far = contrast(BG, WHITE) >= contrast(BG, BLACK) ? WHITE : BLACK;
    const fillOf = (c) => { let f = c; for (let t = 0; t <= 1 && contrast(f, WHITE) < 4.5; t += 0.02) f = mix(c, BLACK, t); return f; };   // 흰 글자를 올리는 칠(표 머리·배지·버튼)
    // 인쇄(흰 종이): 글자용 진한 강조색은 흰 바탕 6.5:1·옅은 칠 6:1 이상(작은 글자 4.5:1에 여유)
    const softP = mix(A, WHITE, 0.91), chipP = mix(A, WHITE, 0.82), midP = mix(A, WHITE, 0.45);
    let inkP = A;
    for (let t = 0; t <= 1 && (contrast(inkP, WHITE) < 6.5 || contrast(inkP, softP) < 6); t += 0.02) inkP = mix(A, BLACK, t);
    // 화면: 글자용 강조색은 바탕 7:1·옅은 칠 6:1 이상(바탕 반대쪽 = far로 섞음)
    const dir = ((285 - (hueOf(A) ?? 285) + 540) % 360) - 180 < 0 ? -1 : 1;
    const A2 = isHex(a2) ? hexRgb(a2) : hueShift(A, 50 * dir), A3 = isHex(a3) ? hexRgb(a3) : hueShift(A, 95 * dir);
    const soft = mix(A, BG, 0.84), chip = mix(A, BG, 0.72), mid = mix(A, BG, 0.35);
    const lift = (c) => { let x = c; for (let t = 0; t <= 1 && (contrast(x, BG) < 7 || contrast(x, soft) < 6); t += 0.02) x = mix(c, far, t); return x; };
    // 직접 수정(2026-11-24): 화면의 강조 글자색 = 강조색 그대로(바탕에 맞춰 밝히거나 어둡게 하지 않음 — 어두운·밝은 화면에서 같은 색). 인쇄용 '-p'는 그대로
    const T = { '--accent': A, '--accent-ink': A, '--accent-fill': fillOf(A), '--accent-soft': soft, '--accent-chip': chip, '--accent-mid': mid,
                '--accent-2': A2, '--accent-2-ink': A2, '--accent-2-fill': fillOf(A2), '--accent-3': A3,
                '--accent-ink-p': inkP, '--accent-fill-p': contrast(A, WHITE) >= 4.5 ? A : inkP, '--accent-soft-p': softP, '--accent-chip-p': chipP, '--accent-mid-p': midP };
    return Object.fromEntries(Object.entries(T).map(([k, v]) => [k, rgbHex(v)]));
  }
  // theme/theme.css의 테마 손잡이(없으면 빈 글자)
  const themeVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let lastAccent;
  function applyTheme(hex) {
    lastAccent = hex;
    const accent = themeVar('--t-accent');
    const t = themeTokens(isHex(accent) ? accent : hex, { bg: themeVar('--t-bg'), a2: themeVar('--t-accent-2'), a3: themeVar('--t-accent-3') });
    if (t) Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    return t;
  }

  // ── 다이어그램(Mermaid) 색 — 페이지의 지금 색(테마 손잡이 · 밝은/어두운 화면)에서 뽑아 mermaid 'base' 테마 변수로 ──
  //   판(--diagram-bg) · 글자(--ink) · 선(--muted) · 테두리(--line-2) · 강조(--accent)를 계산된 색으로 읽어 섞음.
  //   print: true → 흰 종이용(상세 문서 인쇄). 수강생 문서에 %%{init}%%·classDef·style이 있으면 그 값이 이김(mermaid 규칙).
  //   글자 크기는 기본 테마와 같아서(16px) 테마를 바꿔도 그림 크기·슬라이드 배치는 그대로
  let colorProbe, colorCtx;
  function cssRgb(expr, fallback) {                                       // CSS 색 식(var()·color-mix() 포함) → [r, g, b]
    if (!document.body) return fallback;
    if (!colorProbe) {
      colorProbe = document.createElement('span'); colorProbe.setAttribute('aria-hidden', 'true'); colorProbe.style.display = 'none';
      colorCtx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    }
    if (!colorProbe.isConnected) document.body.appendChild(colorProbe);
    colorProbe.style.color = 'rgb(1, 2, 3)'; colorProbe.style.color = expr;
    const c = getComputedStyle(colorProbe).color;
    if (!c || c === 'rgb(1, 2, 3)') return fallback;                     // 읽지 못한 식
    colorCtx.clearRect(0, 0, 1, 1); colorCtx.fillStyle = '#000'; colorCtx.fillStyle = c; colorCtx.fillRect(0, 0, 1, 1);
    return [...colorCtx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }
  function mermaidConfig({ print = false } = {}) {
    const base = { startOnLoad: false, securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif' };
    const WHITE = [255, 255, 255];
    const P = print ? WHITE : cssRgb('var(--diagram-bg)', null);
    if (!P) return { ...base, theme: 'default' };                         // 색을 읽지 못하면 예전처럼 기본 테마
    const INK = print ? [23, 24, 28] : cssRgb('var(--ink)', [23, 24, 28]);
    const MUT = print ? [107, 111, 123] : cssRgb('var(--muted)', mix(P, INK, 0.6));
    const L2 = print ? [213, 215, 221] : cssRgb('var(--line-2)', mix(P, INK, 0.25));
    const A = cssRgb('var(--accent)', [47, 111, 235]);
    const dark = lum(P) < 0.18;
    const reach = (c, min) => { let x = c; for (let t = 0; t <= 1 && contrast(x, P) < min; t += 0.04) x = mix(c, INK, t); return x; };   // 판 위에서 보이게
    const node = mix(P, A, dark ? 0.2 : 0.1);
    const nodeBorder = reach(mix(P, A, dark ? 0.75 : 0.65), 3);
    const line = reach(MUT, 3);
    const border = reach(L2, 1.6);
    const group = mix(P, INK, dark ? 0.06 : 0.035);
    const group2 = mix(P, INK, dark ? 0.1 : 0.06);
    const labelBg = mix(P, INK, dark ? 0.16 : 0.09);                     // 선 위 글자 뒤 배경 — 판과 구분되는 옅은 회색
    const h = (c) => rgbHex(c);
    const v = {
      darkMode: dark, background: h(P), fontFamily: base.fontFamily, fontSize: '16px',
      primaryColor: h(node), primaryTextColor: h(INK), primaryBorderColor: h(nodeBorder),
      secondaryColor: h(group2), secondaryTextColor: h(INK), secondaryBorderColor: h(border),
      tertiaryColor: h(group), tertiaryTextColor: h(INK), tertiaryBorderColor: h(border),
      mainBkg: h(node), nodeBorder: h(nodeBorder), nodeTextColor: h(INK), textColor: h(INK), titleColor: h(INK),
      lineColor: h(line), defaultLinkColor: h(line), edgeLabelBackground: h(labelBg),
      clusterBkg: h(group), clusterBorder: h(border),
      noteBkgColor: h(group2), noteTextColor: h(INK), noteBorderColor: h(border),
      // 시퀀스 다이어그램
      actorBkg: h(node), actorBorder: h(nodeBorder), actorTextColor: h(INK), actorLineColor: h(line),
      signalColor: h(INK), signalTextColor: h(INK), labelBoxBkgColor: h(node), labelBoxBorderColor: h(nodeBorder), labelTextColor: h(INK),
      loopTextColor: h(INK), activationBkgColor: h(group2), activationBorderColor: h(border), sequenceNumberColor: h(P),
      // 상태 다이어그램
      transitionColor: h(line), transitionLabelColor: h(INK), stateLabelColor: h(INK), stateBkg: h(node),
      compositeBackground: h(group), compositeTitleBackground: h(group2), compositeBorder: h(border), altBackground: h(group2),
      specialStateColor: h(line), innerEndBackground: h(nodeBorder), labelColor: h(INK),
    };
    return { ...base, theme: 'base', themeVariables: v };
  }

  // ── highlight.js 다음 손질: IDE처럼 이름의 종류를 나눠 칠함(색은 CSS의 Visual Studio 색표 — doc.css·deck-theme.css) ──
  //   highlight.js는 키워드·숫자·문자열·주석만 칠함. IDE처럼 코드 전체를 분석할 수는 없어서 글자 모양으로 나눔:
  //     이름 바로 뒤에 '(' → 메서드(pf-t-method) · '.' 바로 뒤 → 멤버(속성·필드·enum 값, pf-t-member)
  //     그 밖에 대문자로 시작(소문자 포함) → 타입(pf-t-type) · 나머지(지역 변수·매개변수) → 기본색
  //   이미 칠한 조각(주석·문자열·숫자·키워드·선언 이름) 안은 건드리지 않고, 매개변수 묶음 같은 감싸는 조각 안은 칠함
  const HL_LEAF = /hljs-(comment|string|number|keyword|built_in|literal|title|meta|doctag|regexp|symbol|attr|variable)/;
  function hlMore(code) {
    if (!code || code.dataset.pfHl) return;
    code.dataset.pfHl = '1';
    const RE = /[A-Za-z_]\w*/g;
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    const texts = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n);
    let prev = '';                                                            // 바로 앞의 공백 아닌 글자(조각 경계를 넘어)
    texts.forEach((n) => {
      const t = n.nodeValue;
      let leaf = false;
      for (let e = n.parentElement; e && e !== code; e = e.parentElement) if (HL_LEAF.test(e.className)) { leaf = true; break; }
      if (leaf) { const tt = t.trimEnd(); if (tt) prev = tt.at(-1); return; }
      const frag = document.createDocumentFragment();
      let last = 0, made = false;
      for (const m of t.matchAll(RE)) {
        const before = t.slice(last, m.index), back = (t.slice(0, m.index).trimEnd().at(-1)) ?? prev;
        const after = t.slice(m.index + m[0].length).match(/^\s*(.)/)?.[1] ?? '';
        const call = after === '(' || (after === '<' && /^\s*<[^<>()]*>\s*\(/.test(t.slice(m.index + m[0].length)));   // Foo<T>(…)도 메서드
        const kind = /^\d/.test(m[0]) ? '' : call ? 'method' : back === '.' ? 'member' : /^[A-Z]\w*[a-z]/.test(m[0]) ? 'type' : '';
        if (!kind) continue;
        if (before) frag.append(before);
        const sp = document.createElement('span');
        sp.className = `pf-t-${kind}`;
        sp.textContent = m[0];
        frag.append(sp);
        last = m.index + m[0].length;
        made = true;
      }
      const tt = t.trimEnd(); if (tt) prev = tt.at(-1);
      if (!made) return;
      if (last < t.length) frag.append(t.slice(last));
      n.replaceWith(frag);
    });
  }
  // ── 흐름도(flowchart)에서 여러 화살표가 한 상자로 들어오면(fan-in) 화살촉을 그 상자의 한 변 가운데로 모은다 ──
  //   보내는 상자가 모두 받는 상자의 같은 쪽(왼·오른·위·아래)에 있을 때만. 선 위 글자가 있는 화살표는 글자 자리가 어긋나므로 그대로 둠.
  //   레이아웃(getBBox) 없이 속성·transform만으로 계산 → 숨겨진 인쇄용 상자에서도 같음.
  function gatherFanIn(svg) {
    if (!svg || !/flowchart/.test(svg.getAttribute('aria-roledescription') || svg.getAttribute('class') || '')) return;
    const toRoot = (el) => {                                              // el의 좌표 → svg 루트 좌표
      let m = svg.createSVGMatrix();
      for (let e = el; e && e !== svg; e = e.parentNode) {
        const t = e.transform?.baseVal?.consolidate?.();
        if (t) m = t.matrix.multiply(m);
      }
      return m;
    };
    const boxes = [];
    svg.querySelectorAll('g.node').forEach((g) => {
      const r = g.querySelector(':scope > rect, :scope > g > rect');
      if (!r) return;
      const w = r.width.baseVal.value, h = r.height.baseVal.value;
      if (!w || !h) return;
      const m = toRoot(r), x = m.e + r.x.baseVal.value, y = m.f + r.y.baseVal.value;
      boxes.push({ left: x, top: y, right: x + w, bottom: y + h, cx: x + w / 2, cy: y + h / 2 });
    });
    const near = (p, pad = 12) => boxes.find((b) => p.x >= b.left - pad && p.x <= b.right + pad && p.y >= b.top - pad && p.y <= b.bottom + pad);
    // 선 위 글자: Mermaid는 같은 묶음(.root)의 .edgePaths와 .edgeLabels에 화살표를 같은 순서로 넣음(11.4는 글자에 화살표 id가 없음)
    const labeled = (p) => {
      const ep = p.parentNode, el = ep?.parentNode?.querySelector(':scope > .edgeLabels');
      if (!el || el.children.length !== ep.children.length) return true;   // 짝을 못 지으면 건드리지 않음
      return !!el.children[[...ep.children].indexOf(p)]?.textContent.trim();
    };
    const groups = new Map();
    svg.querySelectorAll('.edgePaths > path').forEach((p) => {
      if (!p.getAttribute('marker-end')) return;                          // 화살촉 없는 선(~~~ 등)은 제외
      if (labeled(p)) return;
      const nums = (p.getAttribute('d') || '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number);
      if (!nums || nums.length < 4) return;
      const m = toRoot(p), pt = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
      const s = pt(nums[0], nums[1]), e = pt(nums[nums.length - 2], nums[nums.length - 1]);
      const from = near(s, 4), to = near(e);
      if (!from || !to || from === to) return;
      if (!groups.has(to)) groups.set(to, []);
      groups.get(to).push({ p, m, s, e, from });
    });
    for (const [to, edges] of groups) {
      if (edges.length < 2) continue;
      const sides = [
        ['left', edges.every((g) => g.from.right <= to.left), to.left - Math.max(...edges.map((g) => g.from.right))],
        ['right', edges.every((g) => g.from.left >= to.right), Math.min(...edges.map((g) => g.from.left)) - to.right],
        ['top', edges.every((g) => g.from.bottom <= to.top), to.top - Math.max(...edges.map((g) => g.from.bottom))],
        ['bottom', edges.every((g) => g.from.top >= to.bottom), Math.min(...edges.map((g) => g.from.top)) - to.bottom],
      ].filter((x) => x[1]).sort((a, b) => b[2] - a[2]);
      if (!sides.length) continue;
      const side = sides[0][0], horiz = side === 'left' || side === 'right', sign = side === 'left' || side === 'top' ? -1 : 1;
      // 화살촉 몫의 틈: 이미 그 변 가운데로 들어오는 화살표의 끝에서 잼(없으면 기본값)
      const gaps = edges.map((g) => (horiz ? Math.abs(g.e.x - (sign < 0 ? to.left : to.right)) : Math.abs(g.e.y - (sign < 0 ? to.top : to.bottom))));
      const gap = Math.min(Math.max(Math.min(...gaps), 0), 10);
      const ex = horiz ? (sign < 0 ? to.left : to.right) + sign * gap : to.cx;
      const ey = horiz ? to.cy : (sign < 0 ? to.top : to.bottom) + sign * gap;
      const curves = edges.map((g) => {
        // 보내는 상자 쪽 시작점: 받는 상자를 향한 변의 가운데
        const sx = horiz ? (sign < 0 ? g.from.right : g.from.left) : g.from.cx;
        const sy = horiz ? g.from.cy : (sign < 0 ? g.from.bottom : g.from.top);
        const k = horiz ? (ex - sx) / 2 : (ey - sy) / 2;
        return { g, pts: [[sx, sy], horiz ? [sx + k, sy] : [sx, sy + k], horiz ? [ex - k, ey] : [ex, ey - k], [ex, ey]] };
      });
      // 새 곡선이 다른 상자를 지나가면(Mermaid가 돌려 그린 긴 화살표) 이 묶음은 원래대로 둠
      const hits = ({ g, pts: [a, b, c, d] }) => {
        for (let i = 1; i < 24; i++) {
          const t = i / 24, u = 1 - t;
          const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0];
          const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1];
          if (boxes.some((bx) => bx !== g.from && bx !== to && x > bx.left - 2 && x < bx.right + 2 && y > bx.top - 2 && y < bx.bottom + 2)) return true;
        }
        return false;
      };
      if (curves.some(hits)) continue;
      for (const { g, pts } of curves) {
        const inv = g.m.inverse(), loc = ([x, y]) => `${(inv.a * x + inv.c * y + inv.e).toFixed(2)},${(inv.b * x + inv.d * y + inv.f).toFixed(2)}`;
        g.p.setAttribute('d', `M${loc(pts[0])} C${loc(pts[1])} ${loc(pts[2])} ${loc(pts[3])}`);
      }
    }
  }

  // 상세 문서·자기소개서: 페이지 끝에서 목차·오른쪽 칸이 밀려 올라가 머리 줄([← 돌아가기 › 제목])과 겹치지 않게
  //   목차(직접 수정): 스크립트로 맞추지 않음 — 목차 칸은 sticky라 페이지 끝(띠 위 끝)에서 브라우저가 목록째 밀어 올리고, 「목차」 제목만 제자리(doc.css '페이지 끝 띠와 함께 움직이는 목차')
  //   오른쪽 칸: 붙는 자리부터 틀 아래 끝(띠가 있으면 띠 위 끝 − 24px)까지 남은 높이(--side-room)로 칸을 줄이고 칸 안에서 스크롤
  function fitSides() {
    const page = document.querySelector('.doc-page'), toc = document.getElementById('toc');
    if (!page) return;
    const root = document.documentElement;
    const rail = document.querySelector('.rail');                       // 직접 수정: 오른쪽 카드 칸도 줄어들면 잘린 쪽 끝을 흐림(카드가 칸 끝에서 뚝 잘려 보이지 않게)
    let raf = 0;
    const run = () => {
      raf = 0;
      const cs = getComputedStyle(root);
      const top = (parseFloat(cs.getPropertyValue('--head-h')) || 56) + (parseFloat(cs.getPropertyValue('--side-gap')) || 12);
      const end = document.querySelector('.doc-end');
      const bottom = end ? end.getBoundingClientRect().top - 24 : page.getBoundingClientRect().bottom;
      const room = Math.max(120, Math.floor(bottom - top));
      if (room >= innerHeight - top - 24) root.style.removeProperty('--side-room');   // 칸 기본 높이(100vh − 붙는 자리 − 24px)보다 넉넉하면 그대로
      else root.style.setProperty('--side-room', `${room}px`);
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(run); };
    addEventListener('scroll', () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } run(); }, { passive: true });   // 직접 수정: 스크롤 때는 바로 잼(rAF를 기다리면 한 프레임 더 늦음)
    addEventListener('resize', ask);
    new ResizeObserver(ask).observe(page);
    run();
    if (toc) {
      tocEdges(toc);
      const et = toc.querySelector(':scope > .toc-edge-t'), title = toc.querySelector(':scope > .toc-title');   // 직접 수정: 위 흐림·˄ 화살표는 「목차」 제목 바로 아래(제목과 함께 제자리 — doc.css)
      if (et && title) title.append(et);
      const sc = toc.querySelector('#toc-links');
      if (sc) tocBar(toc, sc);
    }
    if (rail) tocEdges(rail, rail);
  }

  // 직접 수정: 옆 목차의 스크롤 막대를 따로 그림(doc.css '.toc-bar') — 「목차」 제목 안에 넣어 위 끝은 제자리, 페이지 끝 띠에 목차 칸이 밀려 올라가면 칸이 아래쪽을 잘라 막대 영역이 좁아짐.
  //   목록은 칸과 함께 올라가 위쪽이 제목 밑으로 들어가므로, 들어간 높이(d)만큼 목록 위 여백을 넣고 같은 만큼 스크롤 위치를 더함 — 보이는 글자는 그대로(칸과 함께 움직임)이면서
  //   목록을 맨 위로 올리면 첫 항목이 제목 바로 아래, 맨 아래로 내리면 마지막 항목이 끝선에 붙음(위아래 같은 동작). 손잡이는 보이는 막대 영역(목록 칸 높이 − d) 안에서 그림.
  //   끌기 · 홈 누르기(그 쪽으로 한 화면씩) · 휠은 목록을 스크롤
  function tocBar(toc, sc) {
    const title = toc.querySelector(':scope > .toc-title');
    if (!title) return;
    const bar = document.createElement('div');
    bar.className = 'toc-bar'; bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="toc-bar-thumb"></div>';
    title.append(bar);
    const thumb = bar.firstChild;
    let raf = 0, h = 0, room = 0, max = 0, pad = 0;
    const lift = () => {                                                // 목록이 제목 밑으로 들어간 높이만큼 위 여백 + 스크롤 위치 보정(보이는 자리는 그대로)
      const d = toc.offsetParent ? Math.max(0, Math.round(title.getBoundingClientRect().bottom - sc.getBoundingClientRect().top)) : 0;
      if (d === pad) return;
      const top = sc.scrollTop, delta = d - pad;
      pad = d;
      sc.style.paddingTop = d ? `${d}px` : '';
      sc.scrollTop = top + delta;
    };
    const draw = () => {
      raf = 0;
      lift();
      max = sc.scrollHeight - sc.clientHeight;
      bar.classList.toggle('on', max > 1);
      if (max <= 1) return;
      const track = sc.clientHeight - pad - 6;                          // 보이는 막대 영역 − 위아래 3px(예전 막대 손잡이 테두리와 같은 자리)
      h = Math.max(26, Math.round(track * (sc.clientHeight - pad) / (sc.scrollHeight - pad)));
      room = Math.max(0, track - h);
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translateY(${3 + Math.round(room * Math.min(1, Math.max(0, sc.scrollTop / max)))}px)`;
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(draw); };
    addEventListener('scroll', () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } draw(); }, { passive: true });   // 페이지 스크롤 때는 바로(띠에 밀린 높이가 바뀜)
    sc.addEventListener('scroll', ask, { passive: true });
    new ResizeObserver(ask).observe(sc);
    new MutationObserver(ask).observe(sc, { childList: true, subtree: true });
    addEventListener('resize', ask);
    let grab = null;
    thumb.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      grab = { y: e.clientY, s: sc.scrollTop };
      thumb.setPointerCapture(e.pointerId); bar.classList.add('drag');
    });
    thumb.addEventListener('pointermove', (e) => {
      if (!grab || room <= 0) return;
      sc.scrollTop = grab.s + (e.clientY - grab.y) * max / room;
    });
    const drop = () => { grab = null; bar.classList.remove('drag'); };
    thumb.addEventListener('pointerup', drop); thumb.addEventListener('pointercancel', drop);
    bar.addEventListener('pointerdown', (e) => {
      if (e.target !== bar || e.button !== 0) return;
      e.preventDefault();
      const r = thumb.getBoundingClientRect();
      sc.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * (sc.clientHeight - pad) * 0.9, behavior: 'smooth' });
    });
    bar.addEventListener('wheel', (e) => { e.preventDefault(); sc.scrollBy({ top: e.deltaY, left: 0 }); }, { passive: false });
    draw();
  }

  // 직접 수정: 상세 문서·자기소개서 끝 — ① 본문 맨 끝(본문 칸 안)의 「다른 프로젝트 상세 문서」 제목 + 글자 링크 나열(.doc-pager) ② 페이지 폭 전체의 얇은 하단 띠(.doc-end, 한 줄).
  //   ① 상세 문서만. 순서 = data/portfolio.json의 projects → others, 지금 보는 프로젝트는 뺌. 이름은 data/projects/<id>.json의 title(못 읽으면 그 링크는 뺌). 자기소개서(current 없음)는 링크 없음
  //   ② 왼쪽 「© 이름 · 브라우저 안내」(목차 왼쪽 끝에 맞춤) · 오른쪽 「마지막 업데이트」(카드 칸 오른쪽 끝에 맞춤). 문서 끝까지 내리면 아래에서 살짝 올라오며 나타남(.in)
  async function docEnd(page, { pf = {}, name = '', current = '' } = {}) {
    if (!page) return;
    const foot = document.createElement('footer');
    foot.className = 'doc-end';
    const parts = [name && `© ${name}`, t('page.browser-note')].filter(Boolean);
    const date = pf.generatedAt ? `<p class="doc-end-date">${esc(t('page.last-updated', { date: pf.generatedAt }))}</p>` : '';
    foot.innerHTML = `<div class="doc-end-in"><div class="doc-end-lines">${parts.map((x) => `<p>${esc(x)}</p>`).join('')}</div>${date}</div>`;
    page.after(foot);
    const root = document.documentElement;
    // 띠 안 좌우 끝: 목차가 보이면 왼쪽 = 목차 왼쪽 끝, 오른쪽 = 카드 칸 오른쪽 끝(틀이 가운데라 목차 왼쪽 여백과 같음 — 카드 칸을 닫아도 그대로).
    //   목차가 숨는 폭이면 본문 글줄(.doc-intro) 양 끝. 창 크기·카드 칸 열고 닫기에 따라 다시 잼
    const toc = page.querySelector('.toc'), line = page.querySelector('.doc-intro');
    const align = () => {
      if (!line) return;
      const b = line.getBoundingClientRect(), w = root.clientWidth;
      const tb = toc && toc.offsetParent ? toc.getBoundingClientRect() : null;
      const l = Math.max(0, Math.round(tb && tb.width ? tb.left : b.left)), r = Math.max(0, Math.round(tb && tb.width ? tb.left : w - b.right));
      foot.style.setProperty('--end-l', `${l}px`);
      foot.style.setProperty('--end-r', `${r}px`);
    };
    if (line) new ResizeObserver(align).observe(line);
    addEventListener('resize', align); align();
    const show = () => {                                               // 띠가 화면 아래에서 들어오면 올라옴(한 번만)
      if (foot.getBoundingClientRect().top > innerHeight - Math.min(40, foot.offsetHeight / 2)) return;
      foot.classList.add('in'); removeEventListener('scroll', show); removeEventListener('resize', show);
    };
    addEventListener('scroll', show, { passive: true }); addEventListener('resize', show); requestAnimationFrame(show);
    // ① 다른 프로젝트 상세 문서 링크 — 본문 맨 끝
    const main = page.querySelector('.doc-main');
    const order = [...(pf.projects || []), ...(pf.others || [])].filter((id, i, a) => id && a.indexOf(id) === i);
    if (!current) return;                                              // 자기소개서: 링크 없이 띠만
    const want = order.filter((id) => id !== current);
    if (!main || !want.length) return;
    const list = (await Promise.all(want.map((id) => loadJSON(`data/projects/${encodeURIComponent(id)}.json`).then((p) => ({ id, title: p.title || id })).catch(() => null)))).filter(Boolean);
    if (!list.length) return;
    const head = t('doc.other-docs');
    const nav = document.createElement('nav');
    nav.className = 'doc-pager'; nav.setAttribute('aria-label', head);   // 링크는 포트폴리오 안 다른 페이지 링크와 같이 이름 뒤 ↗(link kind 'page')
    nav.innerHTML = `<p class="pager-label">${esc(head)}</p><div class="pager-all">${list.map((p) => link({ href: `doc.html?p=${encodeURIComponent(p.id)}`, label: esc(p.title), kind: 'page', cls: 'pager-link' })).join('')}</div>`;
    main.append(nav);
  }

  // 직접 수정: 목차 칸이 잘렸으면(안에서 스크롤) 아직 남은 쪽 끝을 흐리고 작은 화살표(˄ ˅) — 포트폴리오 페이지 휴대폰 캡슐 바의 흐림 + 화살표와 같은 뜻.
  //   흐림은 목차 칸에 겹친 띠(.toc-edge)로 그림 — 스크롤 막대 자리는 비워 흐려지지 않음. 위 = .ft, 아래 = .fb (doc.css '목차 끝 흐림')
  //   옆 목차(#toc + #toc-links)와 좁은 화면 목차 창(.toc-scroll + .toc-links — openToc가 감쌈)이 함께 씀
  function tocEdges(toc, sc = toc.querySelector('#toc-links') || toc) {
    if (toc.classList.contains('fade-host')) return;
    toc.classList.add('fade-host'); sc.classList.add('fade-list');     // 스크롤하는 것은 목록 칸(.fade-list), 화살표 띠·.ft/.fb는 감싼 칸(.fade-host)에
    if (toc !== sc) {                                                  // 칸 자체가 스크롤하면(오른쪽 카드 칸) 화살표 없이 흐림만
      toc.insertAdjacentHTML('afterbegin', '<div class="toc-edge toc-edge-t" aria-hidden="true"></div>');
      toc.insertAdjacentHTML('beforeend', '<div class="toc-edge toc-edge-b" aria-hidden="true"></div>');
    }
    let raf = 0;
    const run = () => {
      raf = 0;
      const more = sc.scrollHeight - sc.clientHeight;
      toc.classList.toggle('ft', more > 1 && sc.scrollTop > 2);
      toc.classList.toggle('fb', more > 1 && sc.scrollTop < more - 2);
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(run); };
    sc.addEventListener('scroll', ask, { passive: true });
    new MutationObserver(ask).observe(sc, { childList: true });        // 목록을 다시 그리면(innerHTML) 다시 재기
    addEventListener('resize', ask);
    addEventListener('scroll', ask, { passive: true });               // --side-room이 바뀌어 칸 높이가 달라질 때
    new ResizeObserver(ask).observe(sc);
    run();
  }

  // Folk Sack의 지형 연결을 서버 상태와 방송 수신 행에 맞춘다.
  function routeFolkSackTerrain(svg) {
    const nodeFor = (id) => svg.querySelector(`g.node[id^="flowchart-${id}-"]`);
    const bounds = (id) => {
      const node = nodeFor(id);
      const rect = node?.querySelector(':scope > rect');
      const transform = node?.transform.baseVal.getItem(0)?.matrix;
      if (!rect || !transform) return null;
      const left = transform.e + rect.x.baseVal.value;
      const top = transform.f + rect.y.baseVal.value;
      return { node, left, top, x: transform.e, y: transform.f, right: left + rect.width.baseVal.value, bottom: top + rect.height.baseVal.value };
    };
    const generator = bounds('GEN'), terrain = bounds('TM'), session = bounds('GS'), receiver = bounds('Receive');
    const exploration = bounds('EXP'), input = bounds('Input'), seed = nodeFor('TSV');
    const lobby = bounds('Lobby'), lobbyHub = bounds('LH');
    const seedTransform = seed?.transform.baseVal.getItem(0)?.matrix;
    if (!generator || !terrain || !session || !receiver || !exploration || !input || !seedTransform || !lobby || !lobbyHub) return;

    const edgeFor = (id) => svg.querySelector(`path[id^="L_${id}_"]`);
    const seedEdge = edgeFor('TSV_GEN');
    if (!seedEdge) return;
    const seedBottom = seedEdge.getPointAtLength(0).y + input.y - seedTransform.f;
    const moveToRow = (box, y) => {
      const dy = y - box.y;
      box.node.setAttribute('transform', `translate(${box.x},${y})`);
      box.y = y;
      box.top += dy;
      box.bottom += dy;
    };
    const generatorShiftX = Math.max(0, session.right + 30 - generator.left);
    generator.x += generatorShiftX;
    generator.left += generatorShiftX;
    generator.right += generatorShiftX;
    moveToRow(generator, session.y);
    seed.setAttribute('transform', `translate(${generator.x},${input.y})`);
    moveToRow(terrain, receiver.y);

    const draw = (id, x1, y1, x2, y2) => {
      const length = Math.hypot(x2 - x1, y2 - y1);
      // 화살촉의 길이만큼 선 끝을 상자 경계에서 물린다.
      const offset = 4 / length;
      edgeFor(id)?.setAttribute('d', `M${x1},${y1} L${x2 - (x2 - x1) * offset},${y2 - (y2 - y1) * offset}`);
    };
    const verticalX = (Math.max(generator.left, terrain.left) + Math.min(generator.right, terrain.right)) / 2;
    draw('TSV_GEN', generator.x, seedBottom, generator.x, generator.top);
    draw('GEN_TM', verticalX, generator.bottom, verticalX, terrain.top);
    draw('GEN_GS', generator.left, generator.y, session.right, session.y);
    draw('Receive_TM', receiver.right, receiver.y, terrain.left, terrain.y);
    draw('TM_EXP', terrain.x, terrain.bottom, exploration.x, exploration.top);

    const lobbyShift = 18;
    for (const box of [lobby, lobbyHub]) {
      box.node.setAttribute('transform', `translate(${box.x + lobbyShift},${box.y})`);
    }
    edgeFor('Lobby_LH')?.setAttribute('transform', `translate(${lobbyShift},0)`);
    const { x, y, width, height } = svg.viewBox.baseVal;
    svg.setAttribute('viewBox', `${x} ${y} ${width + lobbyShift} ${height}`);
  }

  // ── 화면 모드 전환(어두운 ↔ 밝은) — theme/theme-light.css(:root[data-pf-mode="light"])가 있을 때만 버튼이 생김 ──
  //   처음에는 기기 설정(prefers-color-scheme)을 따르고, 버튼으로 고르면 localStorage 'pf-mode'에 남아 그 뒤로는 기기 설정보다 우선
  //   각 html <head>의 짧은 스크립트가 그리기 전에 모드를 정함(깜빡임 없음). 고른 적이 없으면 페이지를 연 채로 기기 설정이 바뀌어도 따라감
  //   글자 크기·간격은 그대로라 슬라이드 배치 점검에 영향 없음. 인쇄(제출 PDF·상세 문서)는 모드와 상관없이 흰 종이
  const MODE_KEY = 'pf-mode', root = document.documentElement;
  const getMode = () => (root.dataset.pfMode === 'light' ? 'light' : 'dark');
  let lightOk = null;
  function hasLightMode() {                                              // 밝은 테마 파일이 실제로 바탕색을 바꾸는지
    if (lightOk !== null) return lightOk;
    const cur = root.dataset.pfMode;
    root.dataset.pfMode = 'light'; const a = themeVar('--t-bg');
    root.dataset.pfMode = 'dark'; const b = themeVar('--t-bg');
    if (cur) root.dataset.pfMode = cur; else delete root.dataset.pfMode;
    return (lightOk = isHex(a) && a.toUpperCase() !== b.toUpperCase());
  }
  const SUN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const modeLabel = (m) => (m === 'light' ? '어두운 화면으로' : '밝은 화면으로');
  function syncModeButtons() {
    const m = getMode();
    document.querySelectorAll('[data-pf-mode-toggle]').forEach((b) => {
      b.innerHTML = m === 'light' ? MOON : SUN;                           // 누르면 바뀔 모드의 아이콘
      b.setAttribute('aria-label', modeLabel(m)); b.title = modeLabel(m);
    });
  }
  // 버튼 HTML(밝은 테마 파일이 없으면 빈 글자). cls = 페이지의 버튼 모양 클래스
  function modeButton(cls = '') {
    if (!hasLightMode()) return '';
    const m = getMode();
    return `<button type="button" class="pf-mode ${cls}" data-pf-mode-toggle data-a="mode" aria-label="${modeLabel(m)}" title="${modeLabel(m)}">${m === 'light' ? MOON : SUN}</button>`;
  }
  function setMode(m, { save = true } = {}) {
    if (m === 'light') root.dataset.pfMode = 'light'; else delete root.dataset.pfMode;
    if (save) try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* 저장 못 해도 이번 화면은 바뀜 */ }
    applyTheme(lastAccent);                                               // 강조색 글자 진하기는 바탕 기준이라 다시 계산
    syncModeButtons();
    window.dispatchEvent(new CustomEvent('pf-mode', { detail: m }));
  }
  const savedMode = () => { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } };
  const sysLight = window.matchMedia?.('(prefers-color-scheme: light)');
  sysLight?.addEventListener?.('change', (e) => { if (!savedMode()) setMode(e.matches ? 'light' : 'dark', { save: false }); });   // 고른 적이 없을 때만 기기 설정을 따라감
  window.PFMode = { button: modeButton, set: setMode, get: getMode, available: hasLightMode };   // 슬라이드 키트(deck-kit.js)는 PF 이름을 따로 써서 이것으로 부름
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-pf-mode-toggle]'); if (!b) return;
    e.stopPropagation();
    setMode(getMode() === 'light' ? 'dark' : 'light');
  }, true);

  // ── 안내 문구(옛 렌더러와 같은 글) ──
  const FILE_HELP = `<p>이 페이지는 <code>data/</code>와 프로젝트 문서를 불러와 그리기 때문에, 파일을 더블클릭해서는 열리지 않습니다.</p>
      <ol>
        <li>레포 폴더에서 터미널을 열고 아래 명령을 실행한 뒤 <b>http://localhost:4600</b> 접속
          <pre>python -m http.server 4600</pre>(Windows에서 안 되면 <code>py -m http.server 4600</code>)</li>
        <li>또는 JetBrains IDE(Rider·WebStorm)에서 <code>index.html</code> 우클릭 → <b>Open in → Browser</b></li>
        <li>또는 Claude Code에게 "미리보기 띄워줘"라고 요청</li>
      </ol>`;
  const noDataHtml = (err) => `<p>Claude Code에서 아래 명령을 실행하면 <code>src/</code>의 프로젝트 문서·스크린샷을 읽어 데이터를 만듭니다.</p>
      <pre>/portfolio-build</pre>
      <p class="pf-note-err">${esc(err?.message || '')}</p>`;
  const isFile = () => location.protocol === 'file:';
  function notice(root, title, bodyHtml) {
    root.innerHTML = `<div class="notice"><h1>${title}</h1>${bodyHtml}</div>`;
  }
  // file:// 로 열면 fetch가 막힌다 → 로컬 서버 안내(흐르는 페이지용. 슬라이드는 안내 장면으로 보여 줌)
  function guardFileProtocol(root) {
    if (!isFile()) return false;
    notice(root, '로컬 서버로 열어 주세요', FILE_HELP);
    return true;
  }
  function noData(root, err) { notice(root, '아직 포트폴리오 데이터가 없습니다', noDataHtml(err)); }

  // ── 문구 표(assets/strings.js): t(키, 값) · tab(data의 탭 값) · label(data의 카드 라벨 값) · 페이지 시작 때 loadStrings()로 theme/strings.tsv를 읽음 ──
  const { t, tab, label, load: loadStrings, report: stringsReport } = PFStr;

  return { videoPoster, videoSources, videoIcon, esc, inline, isUrl, shortUrl, repoLinks, otherLinks, loadJSON, loadText, encodePath, srcPath, projectUrl, docUrl, siteBase, visibleUrl, metaValue, teamLabel,
           slugger, normTitle, resolveHeading, keyOk, deckSceneFor, mdHtml, headingsOf, ICON, NEWTAB, link, markNewTab, topCap, railToggle, themeTokens, applyTheme, mermaidConfig, hlMore, routeFolkSackTerrain, gatherFanIn, fitSides, docEnd, contrast, hexRgb, modeButton, setMode, getMode, hasLightMode,
           FILE_HELP, noDataHtml, isFile, notice, guardFileProtocol, noData, t, tab, label, loadStrings, stringsReport };
})();
