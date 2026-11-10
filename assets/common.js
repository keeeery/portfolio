// 포트폴리오 렌더러 공통 유틸 — index.html(포트폴리오 문서) · project.html(발표 덱) · doc.html(상세 문서)가 함께 씁니다.
// 데이터: data/portfolio.json, data/projects/<폴더 이름>.json(/portfolio-build가 생성), src/<폴더>/<기술 문서>.md
// 이 파일은 글을 만들지 않습니다. 화면에 나오는 내용은 모두 위 데이터에서 오고, UI 문구(절 이름·버튼·라벨)는 assets/strings.js의 문구 표(PF.t)에서 옵니다.
// 주석의 설계 근거(docs/design/…의 portfolio-structure·deck-vs-scroll·01 §, R0, 결정 F·Q·# 번호)와 원본 시안(spikes/…)은 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.

// 취소선은 물결 두 개(~~글~~)일 때만. marked의 GFM 규칙은 물결 하나(~글~)도 취소선으로 쳐서, 한국어 문서의 범위 표기
// ("0~100 정수로 … 0~1로")가 한 문단에 두 번 나오면 그 사이가 지워진 것처럼 보입니다. 물결 하나는 글자 그대로 둡니다.
// del 토크나이저가 false가 아닌 값(undefined)을 돌려주면 marked 기본 규칙으로 넘어가지 않고, 물결은 일반 글자로 읽힙니다.
// 상세 문서(doc.html)·발표 덱(project.html)의 원문 해석(md-blocks.js·PF.headingsOf)이 모두 이 설정을 씁니다. marked가 없는 페이지(index.html)는 건너뜀.
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
  // 굵게는 템플릿 원본에 없는 수정 — 기술 문서에서 옮긴 글 조각(개발 의도 등)의 **강조**가 기호째 보이지 않게 함
  const inline = (s) => esc(s).replace(/`([^`]+)`|\*\*(?=\S)([^*]+?)(?<=\S)\*\*/g,
    (m, code, bold) => (code !== undefined ? `<code>${code}</code>` : `<strong>${bold}</strong>`));
  const isUrl = (u) => /^https?:\/\//i.test(u || '');
  const shortUrl = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

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
  // 발표 덱에서 원문 절(section 글자)에 해당하는 장면 id(포트폴리오 문서의 [발표 덱에서 보기]·발표 덱 옛 주소 hl-n 넘기기)
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
  // md → 제목 목록(상세 문서와 같은 파이프라인: marked gfm → 제목 textContent → slugger). 제목 목록이 필요한 곳용(원문 블록까지 필요하면 md-blocks.js의 PF.md.parse)
  //   <template>에 넣는 이유: 그 안의 내용은 비활성이라 문서 속 이미지(GIF 수십 MB)를 받지 않음. div에 넣으면 DOM에 붙이지 않아도 이미지를 받기 시작함
  function headingsOf(md) {
    if (!window.marked) return [];
    const box = document.createElement('template');
    box.innerHTML = marked.parse(md, { gfm: true });
    const slug = slugger();
    return [...box.content.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({ level: +h.tagName[1], text: h.textContent.trim(), id: slug(h.textContent.trim()) }));
  }

  // ── 링크 규칙(F10, portfolio-structure §5): 문서 사이·외부·원문 파일 = 새 탭 + ↗(aria-hidden) + 숨김 "(새 탭)".
  //    같은 문서 안 이동(앵커·목차·건너뛰기·같은 덱 장면)·mailto:·덱 조작 버튼·라이트박스 = 같은 탭(target 없음)
  const ICON = '<svg class="pf-newtab-icon" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="12" height="12"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const NEWTAB = `${ICON}<span class="pf-sr-only pf-newtab-sr">(새 탭)</span>`;
  const NEW_TAB_KINDS = new Set(['external', 'page', 'file']);
  function link({ href, label, kind = 'external', cls = '', attrs = '' }) {
    const nt = NEW_TAB_KINDS.has(kind);
    return `<a${cls ? ` class="${cls}"` : ''} href="${esc(href)}"${nt ? ' target="_blank" rel="noopener"' : ''}${attrs ? ' ' + attrs : ''}>${label}${nt ? NEWTAB : ''}</a>`;
  }
  function markNewTab(a) {                                           // 이미 있는 <a>(md 안 등)에 같은 규칙 적용
    a.target = '_blank'; a.rel = 'noopener';
    if (!a.querySelector('.pf-newtab-icon')) a.insertAdjacentHTML('beforeend', NEWTAB);
  }

  // ── 강조색(profile.md "강조색", theme/theme.css의 --t-accent가 있으면 그 색) → 색 토큰 ──
  //   글자에 쓰는 강조색은 화면 바탕(--t-bg, 없으면 어두운 기본 바탕) 대비 7:1 이상이 되게 바탕 반대쪽(어두운 바탕이면 밝게, 밝은 바탕이면 어둡게)으로,
  //   흰 글자를 올리는 칠은 4.5:1 이상이 되게 어둡게 맞춤. --accent-2 = 강조색의 색상을 보라(285°) 쪽으로 50° 돌린 짝(파랑 → 보라, 주황 → 분홍),
  //   --accent-3 = 같은 쪽으로 95°(광채). theme.css에 --t-accent-2·--t-accent-3이 있으면 그 색
  //   흰 종이에 찍는 A4 인쇄(포트폴리오 문서·상세 문서)는 '-p'가 붙은 값을 씀(portfolio.css·doc.css의 @media print). 발표 덱은 인쇄도 화면 장면 그대로
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
    const T = { '--accent': A, '--accent-ink': lift(A), '--accent-fill': fillOf(A), '--accent-soft': soft, '--accent-chip': chip, '--accent-mid': mid,
                '--accent-2': A2, '--accent-2-ink': lift(A2), '--accent-2-fill': fillOf(A2), '--accent-3': A3,
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
  //   글자 크기는 기본 테마와 같아서(16px) 테마를 바꿔도 그림 크기·발표 덱 배치는 그대로
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
    const h = (c) => rgbHex(c);
    const v = {
      darkMode: dark, background: h(P), fontFamily: base.fontFamily, fontSize: '16px',
      primaryColor: h(node), primaryTextColor: h(INK), primaryBorderColor: h(nodeBorder),
      secondaryColor: h(group2), secondaryTextColor: h(INK), secondaryBorderColor: h(border),
      tertiaryColor: h(group), tertiaryTextColor: h(INK), tertiaryBorderColor: h(border),
      mainBkg: h(node), nodeBorder: h(nodeBorder), nodeTextColor: h(INK), textColor: h(INK), titleColor: h(INK),
      lineColor: h(line), defaultLinkColor: h(line), edgeLabelBackground: h(P),
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

  // ── 화면 모드 전환(어두운 ↔ 밝은) — theme/theme-light.css(:root[data-pf-mode="light"])가 있을 때만 버튼이 생김 ──
  //   처음에는 기기 설정(prefers-color-scheme)을 따르고, 버튼으로 고르면 localStorage 'pf-mode'에 남아 그 뒤로는 기기 설정보다 우선
  //   각 html <head>의 짧은 스크립트가 그리기 전에 모드를 정함(깜빡임 없음). 고른 적이 없으면 페이지를 연 채로 기기 설정이 바뀌어도 따라감
  //   글자 크기·간격은 그대로라 발표 덱 배치 점검에 영향 없음. 인쇄(제출 PDF·상세 문서)는 모드와 상관없이 흰 종이
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
  window.PFMode = { button: modeButton, set: setMode, get: getMode, available: hasLightMode };   // 발표 덱 키트(deck-kit.js)는 PF 이름을 따로 써서 이것으로 부름
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-pf-mode-toggle]'); if (!b) return;
    e.stopPropagation();
    setMode(getMode() === 'light' ? 'dark' : 'light');
  }, true);

  // ── 안내 문구(옛 렌더러와 같은 글) ──
  const FILE_HELP = `<p>이 페이지는 <code>data/</code>와 기술 문서를 불러와 그리기 때문에, 파일을 더블클릭해서는 열리지 않습니다.</p>
      <ol>
        <li>레포 폴더에서 터미널을 열고 아래 명령을 실행한 뒤 <b>http://localhost:4600</b> 접속
          <pre>python -m http.server 4600</pre>(Windows에서 안 되면 <code>py -m http.server 4600</code>)</li>
        <li>또는 JetBrains IDE(Rider·WebStorm)에서 <code>index.html</code> 우클릭 → <b>Open in → Browser</b></li>
        <li>또는 Claude Code에게 "미리보기 띄워줘"라고 요청</li>
      </ol>`;
  const noDataHtml = (err) => `<p>Claude Code에서 아래 명령을 실행하면 <code>src/</code>의 기술 문서·스크린샷을 읽어 데이터를 만듭니다.</p>
      <pre>/portfolio-build</pre>
      <p class="pf-note-err">${esc(err?.message || '')}</p>`;
  const isFile = () => location.protocol === 'file:';
  function notice(root, title, bodyHtml) {
    root.innerHTML = `<div class="notice"><h1>${title}</h1>${bodyHtml}</div>`;
  }
  // file:// 로 열면 fetch가 막힌다 → 로컬 서버 안내(흐르는 페이지용. 덱은 안내 장면으로 보여 줌)
  function guardFileProtocol(root) {
    if (!isFile()) return false;
    notice(root, '로컬 서버로 열어 주세요', FILE_HELP);
    return true;
  }
  function noData(root, err) { notice(root, '아직 포트폴리오 데이터가 없습니다', noDataHtml(err)); }

  // ── 문구 표(assets/strings.js): t(키, 값) · tab(data의 탭 값) · label(data의 카드 라벨 값) · 페이지 시작 때 loadStrings()로 theme/strings.tsv를 읽음 ──
  const { t, tab, label, load: loadStrings, report: stringsReport } = PFStr;

  return { esc, inline, isUrl, shortUrl, loadJSON, loadText, encodePath, srcPath, projectUrl, docUrl, siteBase, visibleUrl, metaValue, teamLabel,
           slugger, normTitle, resolveHeading, keyOk, deckSceneFor, headingsOf, ICON, NEWTAB, link, markNewTab, themeTokens, applyTheme, mermaidConfig, contrast, hexRgb, modeButton, setMode, getMode, hasLightMode,
           FILE_HELP, noDataHtml, isFile, notice, guardFileProtocol, noData, t, tab, label, loadStrings, stringsReport };
})();
