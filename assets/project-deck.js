// 슬라이드(project.html?p=<폴더 이름>) — 프로젝트 문서를 바탕으로 한 16:9 발표 슬라이드(결정 G1·G2·G6·G11)
//   장면 순서: 표지(cover) → 목차(toc) → [장 표지(ch-<장 key>) → 장면(d-<key>, 나뉘면 d-<key>-2…)] × 장 → 결과와 회고(retro) → 맺음(end)
//   장면 목록은 data/projects/<id>.json의 deck(/portfolio-build가 원문을 읽고 고름). 그림·코드·표·이미지는 원문 md 블록을 가리키기만 하고
//   여기서 원문을 찾아 **그대로** 그립니다(PF.md, 규칙은 .claude/skills/portfolio-build/schema.md 「슬라이드」). 장면 글은 deck의 글 조각뿐입니다.
//   deck이 없는 예전 데이터는 highlights·troubleshooting·screenshots·retro로 자동 구성하고 장면마다 띠로 알립니다.
//   옛 주소(#s=hl-n·ts-n·shots·more, #pf-*)는 가까운 장면으로 넘기고, 옛 프로젝트 문서 제목 앵커는 상세 문서로 보냅니다(결정 G3).
//   상세 문서 링크는 표지와 맺음 장면에만 둡니다(결정 G1). 새 문장·수치를 만들지 않습니다(장면 이름·라벨은 UI 글자 — 문구 표 PF.t).
//   data의 탭·카드 라벨은 PF.tab()·PF.label()로 보여 주기만 바꾸고, 칩 색(FLOW)은 data 값 그대로 판정합니다.
//   주석의 설계 근거(docs/design/…, 결정 F·G·Q 번호)는 템플릿 유지관리용 maintainer 브랜치에 있습니다. 이 레포에 없어도 정상입니다.
(() => {
  const Q = new URLSearchParams(location.search);
  const id = Q.get('p');
  // 직접 고침(2026-11-26): 프로젝트 폴더 이름을 <html data-pf-project>에 — 장면 id(d-arch 등)가 프로젝트마다 겹쳐서, 테마의 장면별 규칙을 그 프로젝트에만 걸 때 씀
  if (id) document.documentElement.dataset.pfProject = id;
  const deck = document.getElementById('deck');
  const info = (PFScene.info = { page: 'project', id, t: {}, summary: {}, overflow: [], errors: [], unresolved: [], notes: [], mode: '' });
  const mark = (k) => { info.t[k] = Math.round(performance.now()); };
  const { esc, inline, shortUrl, DOT, link } = PF;
  const MAXL = 30;                                                     // 코드 한 장면 30줄 안팎, 넘으면 "계속" 장면 — 직접 고침(2026-11-25): 원래 20줄(Q8), ODDITY d-debris-pool(23줄)을 한 장에

  // ── 옛 주소(결정 G3) ──
  //   #s=… · #<숫자> · #s-n · 새 장면 id → 슬라이드가 받음(옛 장면 id는 그린 뒤 remapHash가 바꿈) / #pf-doc → 상세 문서 /
  //   #pf-highlights 등 → 옛 장면 id로 바꾼 뒤 같은 처리 / 그 밖(옛 프로젝트 문서 제목 앵커) → 상세 문서의 같은 조각
  const SCENE = /^(cover|toc|ch-[a-z][a-z0-9-]*|d-[a-z0-9-]+|retro(-\d+)?|end|notice|hl-\d+(-\d+)?|ts-\d+(-\d+)?|shots(-\d+)?|more)$/;
  const LEGACY = { 'pf-highlights': 'hl-1', 'pf-troubleshooting': 'ts-1', 'pf-screenshots': 'shots', 'pf-retro': 'retro' };
  const redirected = (() => {
    if (!id || !location.hash || location.hash === '#') return false;
    const rawEnc = location.hash.slice(1);
    let raw = rawEnc; try { raw = decodeURIComponent(rawEnc); } catch { /* 그대로 */ }
    if (/^s=/.test(raw) || /^-?\d+$/.test(raw) || /^s-\d+$/.test(raw) || SCENE.test(raw)) return false;
    if (raw === 'pf-doc') { location.replace(PF.docUrl(id)); return true; }
    if (LEGACY[raw]) { try { history.replaceState(null, '', `${location.pathname}${location.search}#s=${LEGACY[raw]}`); } catch { /* */ } return false; }
    location.replace(PF.docUrl(id, rawEnc));
    return true;
  })();
  if (redirected) return;

  PFScene.track(start().catch((err) => {
    info.errors.push(String(err && err.stack || err));
    deck.replaceChildren(PF.msgScene({ title: '페이지를 그리지 못했습니다', html: `<p>${esc(err && err.message || err)}</p>` }));
  }).finally(async () => {
    await PF.loadStrings();                                            // 아래 띠(HUD)도 문구 표로 — 안내 장면으로 끝난 경우에도
    info.strings = PF.stringsReport();
    PF.dropMeasure(); mmdHost?.remove();
    PFScene.mount({ deck: '#deck', home: { href: 'index.html', label: esc(PF.t('ui.back')) }, hint: link({ href: id ? PF.docUrl(id) : 'index.html', label: esc(PF.t('deck.mobile-doc')), kind: 'page' }),
      pptx: window.PFPptx && info.meta ? (b) => PFPptx.save(b) : null }); mark('mounted');   // [PPTX로 저장]은 슬라이드를 그렸을 때만(assets/deck-pptx.js)
  }));

  async function start() {
    mark('start');
    if (PF.isFile()) { deck.replaceChildren(PF.msgScene({ title: '로컬 서버로 열어 주세요', html: PF.FILE_HELP })); return; }
    const strings = PF.loadStrings();
    const back = `<p>${link({ href: 'index.html', label: '← 포트폴리오로', kind: 'page' })}</p>`;
    if (!id) { info.errors.push('no-project: 주소에 ?p=<폴더 이름>이 없습니다'); deck.replaceChildren(PF.msgScene({ title: '프로젝트를 고르세요', html: `<p>주소 끝에 <code>?p=폴더이름</code>을 붙여 주세요.</p>${back}` })); return; }
    const pf = await PF.loadJSON('data/portfolio.json').catch(() => ({}));
    PF.applyTheme(pf.settings?.accent);
    let p;
    try { p = await PF.loadJSON(`data/projects/${encodeURIComponent(id)}.json`); }
    catch (err) { info.errors.push(`data/projects/${id}.json: ${err && err.message || err}`); deck.replaceChildren(PF.msgScene({ title: '프로젝트를 찾을 수 없습니다', html: `<p>${esc(err.message)}</p>${back}` })); return; }
    let md = null;
    try { md = await PF.loadText(PF.srcPath(p.id, p.doc)); }
    catch (e) {
      info.errors.push('doc: ' + e.message);
      deck.replaceChildren(PF.msgScene({ title: '프로젝트 문서 파일을 찾지 못했습니다', eyebrow: 'PROJECT',
        html: `<p>데이터에 적힌 프로젝트 문서(<code>src/${esc(p.id)}/${esc(p.doc || '')}</code>)를 열 수 없습니다. <code>src/</code> 폴더를 확인한 뒤 <code>/portfolio-build</code>를 다시 실행해 주세요.</p><p class="pf-note-err">${esc(e.message)}</p>${back}` }));
      return;
    }
    const P = PF.md.parse(md, p.id);
    info.headings = P.headings.length;
    await strings;
    mark('data');
    const render = () => renderAll(pf, p, P);
    await render();
    PF.refitOnLateFont(render);
    // 직접 고침(2026-11-25): 그림이 늦게 들어와 크기가 바뀐 장면도 좌우 여백을 다시 맞춤(PF.balanceX — 장면을 그릴 때도 한 번 함)
    PFScene.whenReady().then(() => deck.querySelectorAll(':scope > .pf-scene').forEach((s) => PF.balanceX(matchQuad(s)))).catch(() => {});   // 2×2 배치 이미지·표 높이도 다시(matchQuad)
  }

  // ── 장면 모델: deck(schemaVersion 2) 또는 자동 구성 ──
  const firstOf = (P, section) => { const hs = PF.md.findSection(P, [section]); return hs.length === 1 ? PF.md.firstVisual(P, hs[0]) : null; };
  function modelOf(p, P) {
    if (p.schemaVersion >= 2 && p.deck?.slides?.length) {
      info.mode = 'deck';
      const chapters = (p.deck.chapters || []).map((c) => ({ ...c, slides: [] }));
      const byKey = new Map(chapters.map((c) => [c.key, c]));
      p.deck.slides.forEach((sl) => {
        let c = byKey.get(sl.chapter);
        if (!c) { c = { key: sl.chapter || 'etc', title: '', sectionPath: [], slides: [] }; byKey.set(c.key, c); chapters.push(c); }
        c.slides.push(sl);
      });
      return chapters.filter((c) => c.slides.length);
    }
    // 예전 데이터 자동 구성(schema.md 「예전 데이터」): 절이 정확히 1곳으로 풀릴 때만 그 절의 첫 그림을 붙임
    info.mode = 'auto';
    const T = (text) => (text ? { text, verbatim: true } : null);
    const vis = (section) => { const v = firstOf(P, section); return v ? [{ ...v, _el: v.el, sectionPath: [section] }] : []; };
    const out = [];
    const hl = p.highlights || [], ts = p.troubleshooting || [], shots = p.screenshots || [];
    if (hl.length) out.push({ key: 'hl', title: '핵심 구현', slides: hl.map((h, i) => ({ key: `hl-${i + 1}`, layout: 'visual', tab: '구현', title: T(h.title), sectionPath: h.section ? [h.section] : [],
      points: [['기능', h.what], ['구현', h.how], ['이유', h.why]].filter(([, t]) => t).map(([label, text]) => ({ label, text })), visuals: h.section ? vis(h.section) : [] })) });
    if (ts.length) out.push({ key: 'ts', title: '이슈 해결', slides: ts.map((t, i) => ({ key: `ts-${i + 1}`, layout: 'problem', tab: '문제 해결', title: T(t.title), sectionPath: t.section ? [t.section] : [],
      points: [['문제', t.problem], ['원인', t.cause], ['해결', t.solution], ['결과', t.result], ['배운 점', t.lesson]].filter(([, x]) => x).map(([label, text]) => ({ label, text })), visuals: t.section ? vis(t.section) : [] })) });
    if (shots.length) {
      const sl = [];
      for (let i = 0; i < shots.length; i += 3) sl.push({ key: i ? `shots-${i / 3 + 1}` : 'shots', layout: 'screens', tab: '화면', title: T('실제 화면'), sectionPath: [],
        points: shots.slice(i, i + 3).map((s) => ({ label: '', text: s.caption || '' })), visuals: shots.slice(i, i + 3).map((s) => ({ kind: 'image', direct: true, src: s.src, w: s.w, h: s.h })) });
      out.push({ key: 'screens', title: '실제 화면', slides: sl });
    }
    return out;
  }

  // ── 원문 블록 → 장면에 넣을 준비(이미지 크기·다이어그램 SVG를 미리 구함) ──
  let mmdHost = null;
  const svgCache = new Map();
  const mmdIdx = new Map();                                              // 원문 블록 → 번호(SVG id dk-mmd-n · 장면 그림의 data-mmd)
  // 색은 PF.mermaidConfig(테마 손잡이 · 밝은/어두운 화면). again = 화면 모드를 바꿔 같은 블록을 새 색으로 다시 그림
  let mmdPass = 0;                                                       // 다시 그릴 때마다 새 id(같은 id의 SVG가 장면·축소 미리보기에 남아 있으면 mermaid가 엉뚱한 곳에 그림)
  async function renderMermaid(els, { again = false } = {}) {
    if (!els.length) return;
    if (!window.mermaid) { els.forEach((el) => svgCache.set(el, { error: 'Mermaid를 불러오지 못했습니다' })); return; }
    mermaid.initialize({ ...(typeof PF.mermaidConfig === 'function' ? PF.mermaidConfig() : { startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'Pretendard, sans-serif' }), suppressErrorRendering: true });   // 옛 common.js 캐시와 섞여도 기본 색으로 그림
    if (!mmdHost) { mmdHost = document.createElement('div'); mmdHost.setAttribute('aria-hidden', 'true'); Object.assign(mmdHost.style, { position: 'absolute', left: '-20000px', top: '0', width: '1280px', visibility: 'hidden' }); }
    if (!mmdHost.isConnected) document.body.appendChild(mmdHost);         // 덱 키트가 장면을 붙인 뒤에는 떨어져 있을 수 있음(떨어진 자리에서는 글자 폭을 못 잼)
    const pass = again ? `-m${++mmdPass}` : '';
    for (const el of els) {
      if (!again && svgCache.has(el)) continue;
      if (!mmdIdx.has(el)) mmdIdx.set(el, mmdIdx.size);
      const text = el.querySelector('code')?.textContent || '';
      try {
        let { svg } = await mermaid.render(`dk-mmd-${mmdIdx.get(el)}${pass}`, PF.mmdText ? PF.mmdText(text) : text, mmdHost);   // note for 줄은 빼고(칸 위 메모는 orthoEdges가)
        const folk = PF.routeFolkSackTerrain && text.includes('%% folk-sack-architecture');
        if (folk || PF.gatherFanIn || PF.orthoEdges) {                                    // 그린 SVG 손질: Folk Sack 지형 연결 · 한 상자로 모이는 화살표를 한 변으로
          mmdHost.innerHTML = svg;
          const s = mmdHost.querySelector('svg');
          const ortho = PF.orthoEdges?.(s, text);                         // 화살표를 수직·수평 직선 + 둥근 모서리로
          if (folk) PF.routeFolkSackTerrain(s);
          if (!ortho) PF.gatherFanIn?.(s);
          svg = mmdHost.innerHTML;
          mmdHost.replaceChildren();
        }
        svgCache.set(el, { svg });
      }
      catch (err) { if (again) { console.warn('[deck] 다이어그램 다시 그리기 오류:', err); continue; } svgCache.set(el, { error: String(err?.message || err).split('\n')[0].slice(0, 120) }); info.errors.push('mermaid: ' + (err?.message || err)); }
    }
    mmdHost.replaceChildren();
  }
  // 화면 모드(☀/☾)를 바꾸면 다이어그램을 새 색으로 다시 그려 장면·축소 미리보기의 그림만 바꿔 끼움(크기·배치는 그대로)
  let mmdQueue = Promise.resolve();
  window.addEventListener('pf-mode', () => {
    mmdQueue = mmdQueue.then(async () => {
      const els = [...mmdIdx.keys()];
      if (!els.length) return;
      await renderMermaid(els, { again: true });
      document.querySelectorAll('.vbox[data-kind="mermaid"][data-mmd]').forEach((f) => {
        const r = svgCache.get(els[+f.dataset.mmd]), m = f.querySelector('.vmedia');
        if (r?.svg && m) { m.innerHTML = r.svg; if (f.dataset.split) PF.splitDiagram?.(f, JSON.parse(f.dataset.split)); }   // 직접 추가: 두 도막으로 나눈 그림은 같은 자리에서 다시 나눔
      });
    }).catch((err) => console.warn('[deck] 다이어그램 다시 그리기 오류:', err));
  });
  async function resolveVisuals(model, P, p) {
    const mm = [];
    for (const c of model) for (const sl of c.slides) {
      sl._v = (await Promise.all((sl.visuals || []).map(async (ref) => {
        if (ref.direct) { const d = ref.w && ref.h ? { w: ref.w, h: ref.h } : await PF.imageSize(PF.srcPath(p.id, ref.src)); return { ref, status: 'ok', src: PF.srcPath(p.id, ref.src), d }; }
        const r = ref._el ? { status: 'ok', el: ref._el } : PF.md.pick(P, ref, sl.sectionPath || []);
        if (r.status === 'missing' || r.status === 'ambiguous') { info.unresolved.push(`${sl.key}: ${r.detail}`); return { ref, ...r }; }
        if (ref.kind === 'mermaid') mm.push(r.el);
        if (ref.kind === 'image') { const src = r.el.getAttribute('src'); const d = ref.w && ref.h ? { w: ref.w, h: ref.h } : await PF.imageSize(src); return { ref, ...r, src, d }; }
        // 표 안 그림: 불러오기 전 높이로 재면 나중에 표가 커져 조용히 잘림 → 크기를 먼저 받아 두고 복제본에 width·height를 적음(vboxHtml)
        if (ref.kind === 'table' && r.el) return { ref, ...r, imgDims: await Promise.all([...r.el.querySelectorAll('img')].map((i) => PF.imageSize(i.getAttribute('src')))) };
        return { ref, ...r };
      }))).map((v) => (sl.edited ? { ...v, edited: true } : v));             // 장면 고치기로 고친 장면: 원문 문제 띠 문구가 다름
    }
    await renderMermaid(mm);
  }

  // ── 시각 자료 HTML(.vbox). 코드는 줄 범위를 잘라 조각마다 강조 ──
  const LANG = { csharp: 'C#', cs: 'C#', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML', css: 'CSS', python: 'Python', py: 'Python', bash: 'Shell', sh: 'Shell', powershell: 'PowerShell', hlsl: 'HLSL', shader: 'Shader', cpp: 'C++', c: 'C', lua: 'Lua' };
  if (window.hljs && !hljs.getLanguage('hlsl')) { try { hljs.registerAliases('hlsl', { languageName: 'cpp' }); } catch { /* */ } }  // HLSL은 C 계열이라 C++ 색을 빌림
  const codeLines = (el) => { const t = (el.querySelector('code')?.textContent || '').replace(/\n$/, ''); return t.split('\n'); };
  // 직접 고침(2026-11-25): 슬라이드 전용 코드(ref.slideText, /portfolio-edit) — 원문 블록은 그대로 찾고(지문 대조) 보이는 글만 이것으로. 상세 문서는 원문 그대로
  const vLines = (v) => (typeof v.ref.slideText === 'string' ? v.ref.slideText.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n') : codeLines(v.el));
  const langOf = (el) => /language-([\w+#-]+)/.exec(el.querySelector('code')?.className || '')?.[1]?.toLowerCase() || '';
  function codeHtml(v, a, b) {
    const lang = langOf(v.el), text = vLines(v).slice(a - 1, b).join('\n');
    const code = document.createElement('code');
    code.textContent = text;
    if (lang && window.hljs && hljs.getLanguage(lang)) { code.className = `language-${lang}`; try { hljs.highlightElement(code); PF.hlMore?.(code); } catch { /* 강조 없이 */ } }   // 타입·메서드 호출도 색
    return code.outerHTML;
  }
  function vboxHtml(v, chunk) {
    if (v.status === 'missing' || v.status === 'ambiguous') return `<figure class="vbox err">${PF.vband(`visual-${v.status}`, v.detail, v.edited)}</figure>`;
    const warn = v.status === 'changed' ? PF.vband('visual-changed', v.detail, v.edited) : '';
    const cap = (t) => (t ? `<figcaption class="cap">${t}</figcaption>` : '');
    const k = v.ref.kind;
    if (k === 'image') {
      const alt = v.ref.caption?.text || v.el?.getAttribute('alt') || '';
      return `<figure class="vbox" data-kind="image"${v.d ? ` data-w="${v.d.w}" data-h="${v.d.h}"` : ''}><div class="vmedia">${PF.imgTag(v.src, alt, v.d)}</div>${cap(inline(alt))}</figure>`;
    }
    if (k === 'mermaid') {
      const r = svgCache.get(v.el) || {};
      if (!r.svg) return `<figure class="vbox err">${PF.vband('visual-missing', `다이어그램을 그리지 못했습니다: ${r.error || ''}`)}</figure>`;
      // 직접 고침(2026-11-25): 다이어그램의 caption도 위 소제목(.colhead)으로 — 표·요점 카드 소제목과 같은 모양
      return `<figure class="vbox" data-kind="mermaid" data-mmd="${mmdIdx.get(v.el)}">${v.ref.caption?.text ? `<p class="colhead">${inline(v.ref.caption.text)}</p>` : ''}<div class="vmedia">${r.svg}</div>${warn}</figure>`;
    }
    if (k === 'code') {
      const all = vLines(v).length, [a, b] = chunk;
      const lang = LANG[langOf(v.el)] || '';
      const part = a > 1 || b < all ? PF.t('deck.code-lines', { a, b, all }) : '';
      return `<figure class="vbox" data-kind="code"${typeof v.ref.slideText === 'string' ? ' data-slide-code="1"' : ''}><div class="vmedia"><div class="fit-in"><pre>${codeHtml(v, a, b)}</pre></div></div>${cap(part ? esc(part) : '')}${warn}</figure>`;   // 직접 고침(2026-11-25): 언어 이름(C# 등) 캡션은 빼고 줄 범위만
    }
    if (k === 'table') {
      const t = v.el.cloneNode(true);
      t.classList.add('md-table');
      t.querySelectorAll('img').forEach((i, n) => {                       // 행을 나누기 전에(원본과 같은 순서로) 크기를 적음
        const d = v.imgDims?.[n];
        if (d) { const h = Math.min(d.h, 120); i.width = Math.round((h * d.w) / d.h); i.height = h; }   // CSS max-height 120px와 같은 크기
        i.loading = 'lazy'; i.decoding = 'async';
      });
      // 직접 고침(2026-11-26): 슬라이드 전용 표 줄바꿈(ref.slideBreakParen, deck-edits.json) — 칸마다 마지막 「(」 앞에서 줄을 나눔(상세 문서는 원문 그대로)
      if (v.ref.slideBreakParen) t.querySelectorAll('td, th').forEach((c) => {
        const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT); let last = null, n;
        while ((n = tw.nextNode())) if (n.nodeValue.includes('(')) last = n;
        if (!last) return;
        const i = last.nodeValue.lastIndexOf('(');
        if (!last.nodeValue.slice(0, i).trim() && last === c.firstChild) return;   // 칸 맨 앞의 괄호는 나누지 않음
        const rest = last.splitText(i); rest.before(document.createElement('br'));
      });
      // 슬라이드 전용: ref.slideBreakAfter(글 배열) — 표 칸에서 그 글 바로 뒤(뒤따르는 공백은 뺌)에서 줄을 나눔
      (v.ref.slideBreakAfter || []).forEach((m) => {
        const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), hit = []; let n;
        while ((n = tw.nextNode())) if (n.nodeValue.includes(m)) hit.push(n);
        hit.forEach((nd) => { const i = nd.nodeValue.indexOf(m) + m.length; const rest = nd.splitText(i); rest.nodeValue = rest.nodeValue.replace(/^\s+/, ''); rest.before(document.createElement('br')); });
      });
      if (chunk) { const rows = [...t.querySelectorAll('tbody tr')]; rows.forEach((r, i) => { if (i < chunk[0] || i >= chunk[1]) r.remove(); }); }
      // 직접 고침(2026-11-25): 표의 caption은 표 위 소제목(.colhead)으로 — 요점 카드 소제목(pointsTitle)과 같은 모양
      return `<figure class="vbox" data-kind="table">${v.ref.caption?.text ? `<p class="colhead">${inline(v.ref.caption.text)}</p>` : ''}<div class="vmedia"><div class="fit-in">${t.outerHTML}</div></div>${warn}</figure>`;
    }
    return '';
  }

  // ── 장면 틀(deck.slides[].layout) ──
  const txt = (t) => (t && typeof t === 'object' ? t.text : t) || '';
  const SEC_NO = /^\s*(\d+(?:\.\d+)*)\.?\s+/;                         // 직접 고침(2026-11-25): 절 제목 앞 번호(「2.2 」·「2. 」)
  const SEC_OVERVIEW = /^개요\s*[—–-]\s*/;                            // 직접 고침(2026-11-27): 번호 뒤 「개요 — 」(「2.1 개요 — 선택 흐름」 → 「선택 흐름」), 슬라이드 화면에서만
  const secTitle = (t) => t.replace(SEC_NO, '').replace(SEC_OVERVIEW, '');
  // 직접 고침(2026-11-25): 요점마다 서로 다른 제목형 라벨(「시간 정지」·「보스」…)이 있으면 번호 칸 대신 라벨을 왼쪽 칸에(.cards.titled).
  //   「이유」·「구현」 같은 종류 라벨은 그대로 번호 + 작은 라벨.
  const KIND_LB = new Set(['기능', '구현', '이유', '문제', '원인', '해결', '결과', '배운 점', '비용']);
  const titledPts = (points) => points.length > 1 && points.every((p) => p.label && !KIND_LB.has(p.label)) && new Set(points.map((p) => p.label)).size === points.length;
  // 직접 고침(2026-11-26): 장면별 번호 끄기 — theme CSS `#d-<key> { --pf-cards: plain }`이면 그 장면의 요점 카드에 번호를 붙이지 않음(fitSlide가 그리기 전에 정함)
  let plainCards = false;
  // 직접 고침(2026-11-26, 슬라이드 규칙 R2·R3 — theme/deck-rules.md): 종류 라벨(KIND_LB)은 「선택」 장면(tab 선택)에서만 보임. 카드가 하나면 그 장면에서도 뺌.
  //   문제 해결 장면(layout problem)은 flowHtml이라 그대로. fitSlide가 그리기 전에 정함
  let keepKind = false;
  const ncards = (points, { row = false, num = true, two = false, head = '', rowTitled = false } = {}) => {
    if (!points.length) return '';
    if (plainCards) num = false;
    if (points.length === 1) num = false;   // 직접 고침(2026-11-26, 규칙 R1): 카드가 하나면 모든 배치에서 번호 없음
    const kindOff = !keepKind || points.length === 1;
    points = points.map((p) => (kindOff && p.label && KIND_LB.has(p.label) && txt(p) ? { ...p, label: '' } : p));
    const titled = num && (!row || rowTitled) && titledPts(points);   // 직접 고침(2026-11-25): rowTitled = 가로 카드 줄에서도 제목형 라벨(2×2 배치) · (2026-11-27) 2열(two)에서도 제목형 라벨
    // 직접 고침(2026-11-26, 규칙 R4·R5): 카드에 원래 라벨(data 값)을 data-lb로 — 테마가 라벨별 색(「AI 활용」 주황, 「이유」·「비용」 등)을 걺
    const dlb = (pt) => (pt.label ? ` data-lb="${esc(pt.label)}"` : '');
    return `<div class="cards${row ? ' row' : ''}${two ? ' two' : ''}${titled ? ' titled' : ''}" style="--n:${Math.min(points.length, 4)}">${head ? `<p class="colhead">${inline(head)}</p>` : ''}${points.map((pt, i) => titled
      ? `<div class="ncard"${dlb(pt)}><span class="num tl">${esc(PF.label(pt.label))}</span><div><p>${inline(txt(pt))}</p></div></div>`
      : `<div class="ncard${num ? '' : ' nonum'}"${dlb(pt)}>${num ? `<span class="num" aria-hidden="true">${i + 1}</span>` : ''}<div>${pt.label ? `<span class="lb">${esc(PF.label(pt.label))}</span>` : ''}<p>${inline(txt(pt))}</p></div></div>`).join('')}</div>`;
  };
  const FLOW = { '문제': '', '원인': '', '해결': 'accent', '결과': 'ok', '배운 점': '' };   // data 값 → 칩 색(보이는 글자만 PF.label로 바뀜)
  const flowHtml = (points, dir) => `<div class="flow ${dir}" style="--n:${Math.min(points.length, 4)}">${points.map((pt) =>
    `<div class="fstep${pt.label === '결과' ? ' res' : ''}">${pt.label ? `<span class="labelchip${FLOW[pt.label] ? ' ' + FLOW[pt.label] : ''}">${esc(PF.label(pt.label))}</span>` : ''}<p>${inline(txt(pt))}</p></div>`).join('')}</div>`;
  function bodyHtml(sl, vs, variant) {
    const points = sl.points || [];
    const vis = (list) => `<div class="vis">${list.join('')}</div>`;
    const tight = variant.tight ? ' tight' : '';
    if (!vs.length) {
      if (sl.layout === 'problem') return `<div class="dk dk-text${tight}">${flowHtml(points, variant.stack || variant.tight ? 'row' : 'col')}</div>`;
      return `<div class="dk dk-text${tight}">${ncards(points, { two: points.length >= 3 && !variant.stack, num: sl.layout !== 'overview' || titledPts(points), head: txt(sl.pointsTitle) })}</div>`;   // 직접 고침(2026-11-27): 글만 있는 장면도 라벨이 모두 제목형이면 라벨 칸 카드
    }
    // 직접 고침(2026-11-26, 슬라이드 규칙 R18 — theme/deck-rules.md): 화면 틀은 「FEATURE 01」 칸 대신 그림을 위에 나란히, 설명은 아래 카드 줄(번호 없음)
    if (sl.layout === 'screens') return `<div class="dk dk-stack scr-cards${tight}"><div class="vis" data-arr="row">${vs.join('')}</div>${ncards(points, { row: true, num: false })}</div>`;
    if (sl.layout === 'screens-legacy') {
      return `<div class="dk scr-row${tight}" style="--n:${vs.length}">${vs.map((v, i) => `<div class="fe-card">${vis([v])}${points[i] ? `<p class="fe-k">${esc(PF.t('en.feature'))} ${String(i + 1).padStart(2, '0')}</p>${points[i].label ? `<h3>${esc(PF.label(points[i].label))}</h3>` : ''}${txt(points[i]) ? `<p>${inline(txt(points[i]))}</p>` : ''}` : ''}</div>`).join('')}</div>`;
    }
    if (sl.layout === 'problem') {
      if (variant.stack || !points.length) return `<div class="dk dk-stack${tight}">${vis(vs)}${points.length ? flowHtml(points, 'row') : ''}</div>`;
      return `<div class="dk dk-side flip${tight}" style="--vw:${variant.vw}fr">${vis(vs)}${flowHtml(points, 'col')}</div>`;
    }
    // 직접 고침(2026-11-25): 2×2 배치 — 시각 자료마다 자기 칸(.vis)에서 크기를 맞추고 카드는 네 번째 칸
    // 직접 고침(2026-11-26): 위 줄 세 칸 배치(--pf-layout: row3) — 시각 자료 3개가 위 줄에 나란히, 카드는 아래 줄에 나란히
    if (variant.row3 && vs.length === 3) return `<div class="dk dk-quad q3${tight}">${vs.map((x) => vis([x])).join('')}${ncards(points, { num: points.length > 1, row: true, rowTitled: true, head: txt(sl.pointsTitle) })}</div>`;   // 카드가 하나면 번호 없이
    if (variant.quad && (vs.length === 3 || vs.length === 2)) return `<div class="dk dk-quad${vs.length === 2 ? ' q2' : ''}${tight}">${vs.map((x) => vis([x])).join('')}${ncards(points, { num: points.length > 1, row: vs.length === 2, rowTitled: true, head: txt(sl.pointsTitle) })}</div>`;   // 요점이 하나면 번호 칸 없는 카드. 시각 자료 2개면 위 줄 두 칸, 카드는 아래 줄에 나란히
    // 요점이 없으면(나눈 장면 등) 옆 칸이 비지 않게 시각 자료를 가로 전체로
    if (sl.layout === 'full' || variant.stack || !points.length) return `<div class="dk dk-stack${tight}">${vis(vs)}${ncards(points, { row: true, num: sl.layout !== 'full', head: txt(sl.pointsTitle) })}</div>`;
    // 직접 고침(2026-11-25): 시각 자료가 표 하나면 표 칸을 내용 폭에 맞추고(.tfit) 남는 폭을 카드에
    const tfit = vs.length === 1 && vs[0].includes('data-kind="table"') ? ' tfit' : '';
    // 직접 고침(2026-11-25): 나눈 옆 배치(--pf-layout: side-split) — 첫 시각 자료만 왼쪽 칸, 오른쪽 칸에 카드 위·나머지 시각 자료 아래(.rcol)
    if (variant.split && vs.length > 1) return `<div class="dk dk-side dk-split${tight}" style="--vw:${variant.vw}fr">${vis(vs.slice(0, 1))}<div class="rcol">${ncards(points, { num: true, head: txt(sl.pointsTitle) })}${vis(vs.slice(1))}</div></div>`;
    return `<div class="dk dk-side${tight}${tfit}" style="--vw:${variant.vw}fr">${vis(vs)}${ncards(points, { num: true, head: txt(sl.pointsTitle) })}</div>`;
  }

  // 장면 하나(나뉠 수 있음): 코드 줄 범위 30줄 단위, 표는 넘치면 행을 반으로
  //   코드 블록마다 자기 줄 범위(ref.lines, 없으면 전체)를 따로 나눕니다 — 한 장면에 코드가 둘이어도 서로의 범위로 잘리지 않게
  function slideScenes(sl, sid, meta) {
    const vis = sl._v || [];
    const ranges = new Map();                                          // 코드 시각 자료 → [[a, b], …]
    vis.forEach((v) => {
      if (v.ref.kind !== 'code' || !(v.status === 'ok' || v.status === 'changed')) return;
      const n = vLines(v).length;
      let [a, b] = Array.isArray(v.ref.lines) && v.ref.lines.length === 2 ? v.ref.lines : [1, n];
      a = Math.max(1, Math.min(a, n)); b = Math.max(a, Math.min(b, n));
      const chunks = [], len = b - a + 1, parts = Math.ceil(len / MAXL);
      for (let i = 0; i < parts; i++) { const s0 = a + Math.round((len * i) / parts), e0 = a + Math.round((len * (i + 1)) / parts) - 1; chunks.push([s0, e0]); }
      if (parts > 1) PF.note(sid, 'long-code', len, `코드 ${len}줄을 장면 ${parts}개로 나눔`);
      ranges.set(v, chunks);
    });
    // 코드 조각을 문서 순서대로 장면에 담습니다. 한 장면의 코드는 모두 합쳐 30줄 안팎 — 넘으면 다음 조각부터 "계속" 장면으로
    const pages = [[]];                                                // 장면마다 [코드 시각 자료, 줄 범위] 목록
    let used = 0, longOne = false;
    vis.forEach((v) => (ranges.get(v) || []).forEach((ch, i, all) => {
      const len = ch[1] - ch[0] + 1;
      let pg = pages[pages.length - 1];
      if (pg.length && (used + len > MAXL || pg.some(([x]) => x === v))) { pg = []; pages.push(pg); used = 0; }
      pg.push([v, ch]); used += len;
      if (all.length > 1) longOne = true;
    }));
    if (pages.length > 1 && !longOne) {
      const total = [...ranges.values()].reduce((a, c) => a + c[0][1] - c[0][0] + 1, 0);
      PF.note(sid, 'long-code', total, `코드 블록 ${ranges.size}개(모두 ${total}줄)를 장면 ${pages.length}개로 나눔`);
    }
    const out = [];
    pages.forEach((pg, ci) => {
      const mine = new Map(pg);
      const part = pages.length > 1 ? `${ci + 1}/${pages.length}` : '';
      const myId = ci ? `${sid}-${ci + 1}` : sid;
      const list = vis.filter((v) => mine.has(v) || (!ci && !ranges.has(v)));       // 나뉜 뒤쪽 장면은 코드만
      const me = { ...sl, points: ci ? [] : sl.points || [], layout: ci ? 'full' : sl.layout };
      out.push(...fitSlide(me, list, myId, part, (v) => mine.get(v) || null, meta));
    });
    return out;
  }
  //   codeChunk(v) = 그 코드의 이번 줄 범위 · tsplit = { v, rows: [a, b) } 행을 나누는 표 하나(다른 표는 그대로 둠)
  // 직접 고침(2026-11-25): 슬라이드 본문(도입·요점·표·캡션)에서 괄호 속 절 표시 「(§2.6)」「(§2.7·§5.1)」를 화면에서만 뺌.
  //   원문·data는 그대로(상세 문서에는 그대로 보임). 코드·다이어그램·링크(머리 오른쪽 「상세 문서 §n ↗」)는 건드리지 않음
  const SEC_REF = /\s*\([^()]*§\s*\d[^()]*\)/g;
  const SEC_IN = /\s*[,·]\s*§\s*\d+(?:\.\d+)*(?:\s*[·,]\s*§?\s*\d+(?:\.\d+)*)*(?=\s*\))/g;
  const SEC_OF = /§\s*\d+(?:\.\d+)*의\s*/g;
  function stripSecRefs(s) {
    const tw = document.createTreeWalker(s, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('pre, code, svg, a, .pf-rlabel, .pf-foot') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const hits = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.includes('§')) hits.push(n);
    hits.forEach((n) => {
      n.nodeValue = n.nodeValue.replace(SEC_IN, '')                     // 「(시연 중 직접 발견, §10.2)」→「(시연 중 직접 발견)」(먼저 — 내용과 섞인 괄호는 절 표시만)
        .replace(SEC_REF, '')                                             // 「(§2.6)」「(성공 연출은 §2.4)」 — 절을 가리키는 괄호는 통째로
        .replace(SEC_OF, '');                                             // 「§5.5의 부위별 …」→「부위별 …」
    });
  }
  // 직접 고침(2026-11-25): 2×2 배치(.dk-quad.q2) — 위 줄 이미지와 표의 높이를 같게(표는 원래 행 높이, 이미지를 그 높이에 맞춤),
  //   위 줄 폭(이미지 + 간격 + 표) = 아래 카드 줄 폭. 표 폭은 카드 글이 본문 폭 전체일 때보다 줄이 늘지 않는 선에서 가장 좁게
  function matchQuad(s) {
    s.querySelectorAll('.dk-quad.q2').forEach((dk) => {
      const boxes = [...dk.querySelectorAll(':scope > .vis > .vbox')];
      const img = boxes.find((b) => b.dataset.kind === 'image'), tb = boxes.find((b) => b.dataset.kind === 'table');
      const im = img?.querySelector(':scope > .vmedia'), table = tb?.querySelector('table');
      const body = s.querySelector('.pf-body'), fill = s.querySelector('.pf-fill');
      // 직접 고침(2026-11-26): 이미지·코드 2칸 — 코드는 글자 크기 고정이라 폭에 따라 높이가 정해짐. 이미지 높이 = 코드 상자 높이, 두 칸 합 = 본문 폭
      // 직접 고침(2026-11-26): 다이어그램·이미지 2칸 — 둘 다 비율이 정해져 있어 같은 높이 H에서 두 칸 합 ≤ 본문 폭, 다이어그램은 원래 크기 이하, 장면에 들어가는 가장 큰 H. 남는 폭은 다이어그램 판에(카드 줄과 같은 폭)
      const db = boxes.find((b) => b.dataset.kind === 'mermaid'), dm = db?.querySelector(':scope > .vmedia'), svg = dm?.querySelector('svg');
      if (im && dm && svg && !table && im.offsetHeight && svg.viewBox?.baseVal?.width) {
        const ar = im.offsetWidth / im.offsetHeight;                     // 이미지 비율은 풀기 전에(맞춤 상자 크기가 풀리면 높이가 0일 수 있음)
        // 두 번째로 부를 때(whenReady 뒤) 앞에서 넣은 크기를 먼저 풀고 잼
        dk.style.gridTemplateColumns = ''; dk.style.justifyContent = ''; db.style.width = ''; img.style.width = '';
        ['width', 'height', 'display', 'alignItems', 'justifyContent'].forEach((k) => { dm.style[k] = ''; im.style[k] = ''; });
        ['width', 'height', 'maxWidth'].forEach((k) => { svg.style[k] = ''; });
        const gap = parseFloat(getComputedStyle(dk).columnGap) || 0, W = dk.clientWidth;
        const vb = svg.viewBox.baseVal, ard = vb.width / vb.height;
        const padX = dm.offsetWidth - svg.clientWidth, padY = dm.offsetHeight - svg.clientHeight;
        const dFirst = boxes.indexOf(db) < boxes.indexOf(img);
        const set = (H, dw) => {
          const sh = H - padY, sw = sh * ard, iw = Math.round(H * ar);
          dw = dw ?? Math.ceil(sw + padX);
          dk.style.gridTemplateColumns = dFirst ? `${dw}px ${iw}px` : `${iw}px ${dw}px`; dk.style.justifyContent = 'center';   // 칸 순서는 장면의 자료 순서대로
          db.style.width = `${dw}px`; Object.assign(dm.style, { width: `${dw}px`, height: `${H}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' });
          Object.assign(svg.style, { width: `${sw}px`, height: `${sh}px`, maxWidth: 'none' });
          img.style.width = `${iw}px`; Object.assign(im.style, { width: `${iw}px`, height: `${H}px` });
          return { dw, iw };
        };
        for (let H = Math.floor(vb.height + padY); H > 120; H -= 2) {
          const sw = (H - padY) * ard, iw = Math.round(H * ar);
          if (Math.ceil(sw + padX) + gap + iw > W) continue;
          const { iw: i2 } = set(H);
          if (fill.offsetHeight > body.clientHeight - 6) continue;       // 아래 6px 여유 — 소수점 높이 때문에 카드 아래 모서리가 잘리지 않게
          set(H, W - gap - i2);                                          // 남는 폭은 다이어그램 판에 — 위 줄 = 카드 줄 폭
          return;
        }
        return;
      }
      const cb = boxes.find((b) => b.dataset.kind === 'code'), cm = cb?.querySelector(':scope > .vmedia');
      if (im && cm && !table && im.offsetHeight) {
        const ar = im.offsetWidth / im.offsetHeight, gap = parseFloat(getComputedStyle(dk).columnGap) || 0, W = dk.clientWidth;
        const setC = (t) => { cb.style.width = `${t}px`; cb.querySelectorAll('.fit-in').forEach((e) => { e.style.width = `${t}px`; e.style.zoom = ''; }); return cm.offsetHeight; };
        let best = null;
        for (let t = Math.round(W * 0.35); t <= W * 0.75; t += 4) {
          const h = setC(t), w = Math.round(h * ar);
          if (w + gap + t <= W && (!best || w + t > best.w + best.t)) best = { t, h, w };
        }
        if (best) {
          const t = W - gap - best.w, h = setC(t);                     // 남는 폭은 코드 상자에(넓어져도 줄이 덜 꺾일 뿐 높이는 그대로이거나 낮아짐)
          const w = Math.round(h * ar);
          dk.style.gridTemplateColumns = `${w}px ${W - gap - w}px`; setC(W - gap - w);
          img.style.width = `${w}px`; Object.assign(im.style, { width: `${w}px`, height: `${cm.offsetHeight}px` });
          // 남는 세로 자리가 있으면 이미지를 키움 — 코드 상자는 같은 높이로 늘리고(글은 가운데), 코드 줄이 더 꺾이지 않는 선까지
          const lines0 = h, fit = () => fill.offsetHeight <= body.clientHeight;
          let ok = { w, h: cm.offsetHeight };
          for (let H = ok.h + 4; H < 900; H += 4) {
            const w2 = Math.round(H * ar), t2 = W - gap - w2;
            cm.style.minHeight = ''; if (setC(t2) > lines0) break;           // 코드 폭이 좁아져 줄이 꺾이면 멈춤
            dk.style.gridTemplateColumns = `${w2}px ${t2}px`; img.style.width = `${w2}px`; Object.assign(im.style, { width: `${w2}px`, height: `${H}px` });
            Object.assign(cm.style, { minHeight: `${H}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center' });
            if (!fit()) break;
            ok = { w: w2, h: H };
          }
          const t3 = W - gap - ok.w; setC(t3);
          dk.style.gridTemplateColumns = `${ok.w}px ${t3}px`; img.style.width = `${ok.w}px`; Object.assign(im.style, { width: `${ok.w}px`, height: `${ok.h}px` });
          Object.assign(cm.style, { minHeight: `${ok.h}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center' });
        }
        return;
      }
      if (!im || !table || !im.offsetHeight || !body || !fill) return;
      const ar = im.offsetWidth / im.offsetHeight;
      const gap = parseFloat(getComputedStyle(dk).columnGap) || 0;
      dk.style.gridTemplateColumns = ''; dk.style.justifyContent = '';
      const W = dk.clientWidth;
      const ps = [...dk.querySelectorAll(':scope > .cards .ncard p')];
      const lines = () => ps.map((p) => Math.round(p.offsetHeight / (parseFloat(getComputedStyle(p).lineHeight) || 24)));
      const set = (w, t, h) => {
        dk.style.gridTemplateColumns = `${w}px ${t}px`; dk.style.justifyContent = 'center';
        img.style.width = `${w}px`; Object.assign(im.style, { width: `${w}px`, height: `${h}px` });
      };
      const setT = (t) => {
        tb.style.width = `${t}px`; table.style.width = '100%'; table.style.height = '';
        tb.querySelectorAll('.vmedia, .fit-in').forEach((e) => { e.style.width = `${t}px`; e.style.zoom = ''; });   // 표 상자 폭도 함께, 축소는 풂(표는 원래 크기)
        return table.offsetHeight;
      };
      const realT = (t) => Math.max(t, Math.ceil(table.getBoundingClientRect().width / ((tb.getBoundingClientRect().width / tb.offsetWidth) || 1)) + 1);   // 소수점 폭까지 올리고 1px 여유(배율에 따라 오른쪽 테두리가 잘리지 않게)   // 칸이 꺾이지 않는 표는 내용 폭보다 좁아지지 않음
      // 기준: 카드 줄이 본문 폭 전체일 때의 줄 수
      dk.style.gridTemplateColumns = `${W / 2 - gap / 2}px ${W / 2 - gap / 2}px`;
      const base = lines();
      for (let t = Math.round(W * 0.3); t <= W; t += 4) {
        let h = setT(t), rt = realT(t);
        if (rt !== t) { h = setT(rt); rt = realT(rt); }                    // 내용 폭으로 다시 잡은 뒤 높이를 다시 잼
        const w = Math.round(h * ar);
        if (w + gap + rt > W) continue;
        set(w, rt, h);
        if (fill.offsetHeight <= body.clientHeight && lines().every((n, k) => n <= base[k])) return;
      }
      dk.style.gridTemplateColumns = ''; dk.style.justifyContent = ''; img.style.width = ''; tb.style.width = ''; table.style.width = '';
    });
    // 직접 고침(2026-11-26): 위 줄 세 칸(.dk-quad.q3) — 세 칸의 그림 높이를 같게(이미지는 칸 폭까지, 다이어그램은 같은 높이의 판 안에 원래 크기 이하로), 장면에 들어가는 가장 큰 높이
    s.querySelectorAll('.dk-quad.q3').forEach((dk) => {
      const body = s.querySelector('.pf-body'), fill = s.querySelector('.pf-fill');
      const items = [...dk.querySelectorAll(':scope > .vis > .vbox')].map((b) => ({ b, m: b.querySelector(':scope > .vmedia'), svg: b.querySelector(':scope > .vmedia svg') }))
        .filter((x) => x.m && (x.b.dataset.kind === 'image' || x.svg));
      if (items.length !== 3) return;
      items.forEach(({ b, m, svg }) => { b.style.width = ''; ['width', 'height', 'display', 'alignItems', 'justifyContent'].forEach((k) => { m.style[k] = ''; }); if (svg) ['width', 'height', 'maxWidth'].forEach((k) => { svg.style[k] = ''; }); });
      const gap = parseFloat(getComputedStyle(dk).columnGap) || 0, colW = Math.floor((dk.clientWidth - 2 * gap) / 3);
      const ars = items.map(({ b, m }) => {
        if (b.dataset.kind !== 'image') return 0;
        const im = m.querySelector('img, video'); const w = +im?.getAttribute('width') || im?.naturalWidth || im?.videoWidth, h = +im?.getAttribute('height') || im?.naturalHeight || im?.videoHeight;
        return w && h ? w / h : 4 / 3;
      });
      const set = (H) => items.forEach(({ b, m, svg }, k) => {
        if (svg) {
          const vb = svg.viewBox?.baseVal; if (!vb?.width) return;
          const pad = 16, sc = Math.min((colW - 2 * pad) / vb.width, (H - 2 * pad) / vb.height, 1);
          Object.assign(m.style, { width: `${colW}px`, height: `${H}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' });
          Object.assign(svg.style, { width: `${vb.width * sc}px`, height: `${vb.height * sc}px`, maxWidth: 'none' });
          b.style.width = `${colW}px`;
        } else {
          const w = Math.min(colW, Math.round(H * ars[k]));
          Object.assign(m.style, { width: `${w}px`, height: `${Math.round(w / ars[k])}px` }); b.style.width = `${colW}px`;
        }
      });
      const Hmax = Math.round(colW / Math.max(...ars.filter(Boolean), 0.01));
      for (let H = Hmax; H > 120; H -= 4) { set(H); if (fill.offsetHeight <= body.clientHeight) return; }
    });
    return s;
  }
  // 장면 id에 걸린 CSS 변수(theme CSS의 `#d-<key> { … }`)를 그리기 전에 읽음 — 빈 장면 껍데기를 잠깐 붙여 계산값을 봄
  const sceneVar = (id, name) => {
    const probe = document.createElement('section'); probe.className = 'pf-scene'; probe.id = id; probe.style.display = 'none';
    document.body.appendChild(probe); const v = getComputedStyle(probe).getPropertyValue(name).trim(); probe.remove(); return v;
  };
  function fitSlide(sl, vis, sid, part, codeChunk, meta, tsplit = null, depth = 0) {
    const vs = vis.map((v) => vboxHtml(v, v.ref.kind === 'code' ? codeChunk(v) : v.ref.kind === 'table' && tsplit && tsplit.v === v ? tsplit.rows : null));
    let V = sl.layout === 'full' || sl.layout === 'screens' ? [{}, { tight: true }]
      : [{ vw: 1.4 }, { vw: 1.7 }, { vw: 1.15 }, { vw: 1.4, tight: true }, { stack: true }, { stack: true, tight: true }];
    // 직접 고침(2026-11-25): 장면별 배치 고정 — theme CSS `#d-<key> { --pf-layout: side }`(그림 칸 + 카드 칸) / `stack`(위아래). 맞는 후보가 없으면 원래 후보로
    const fl = sceneVar(sid, '--pf-layout');
    const plain = sceneVar(sid, '--pf-cards') === 'plain';
    if (fl === 'side' || fl === 'stack') { const f = V.filter((v) => (fl === 'stack') === !!v.stack); if (f.length) V = f; }
    else if (fl === 'side-split' && vis.length > 1) V = [{ vw: 1, split: true }, { vw: 1.2, split: true }, { vw: 0.85, split: true }, { vw: 1, split: true, tight: true }];
    // 직접 고침(2026-11-25): 2×2 배치(--pf-layout: quad) — 시각 자료 3개가 왼쪽 위·오른쪽 위·왼쪽 아래, 카드가 오른쪽 아래
    else if (fl === 'quad' && (vis.length === 3 || vis.length === 2)) V = [{ quad: true }, { quad: true, tight: true }];
    else if (fl === 'row3' && vis.length === 3) V = [{ row3: true }, { row3: true, tight: true }];   // 직접 고침(2026-11-26): 위 줄 세 칸
    const build = (v) => {
      const s = PF.scene({ id: sid, tpl: 'D', eyebrow: meta.eyebrow || meta.chapter, rlabel: meta.rlabel, rhtml: meta.rhtml, title: secTitle(txt(sl.title)) || meta.chapter, sub: part, lead: part && part !== `1/${part.split('/')[1]}` ? '' : txt(sl.lead), foot: meta.foot, sec: meta.chapter, group: meta.chapter, stitle: txt(sl.title) });
      s.classList.add(`l-${sl.layout || 'visual'}`);
      if (meta.err) s.dataset.pfErr = meta.err;
      if (sl.edited) s.dataset.pfEdited = '1';                       // 장면 고치기로 고친 장면(미리보기 개요에 ✎)
      plainCards = plain; keepKind = txt(sl.tab) === '선택';
      try { PF.body(s).innerHTML = `<div class="pf-fill">${bodyHtml(sl, vs, v)}</div>`; } finally { plainCards = false; keepKind = false; }
      stripSecRefs(s);
      if (meta.auto) s.querySelector('.pf-foot > span').insertAdjacentHTML('beforeend', '<span class="pf-autoband" data-pf-ui="note">예전 데이터로 자동 구성 — /portfolio-build를 다시 실행하면 슬라이드가 됩니다</span>');
      return PF.balanceX(matchQuad(PF.fitVisuals(s)));                            // 직접 고침(2026-11-25): 본문 좌우 여백 같게(PF.balanceX)
    };
    // 들어가는 변형 중 시각 자료가 가장 크게 보이는 것(같으면 앞의 것). 가로로 긴 다이어그램은 위아래 배치가, 세로로 긴 것은 옆 배치가 이김
    let best = null;
    for (const v of V) { const s = build(v); if (!PF.fitsM(s)) continue; const sc = PF.visScore(s); if (!best || sc > best.sc + 0.05) best = { s, sc }; }
    if (best) return [best.s];
    // 직접 고침(2026-11-26): 2×2 배치는 표를 나누지 않음 — 그리는 순간 글꼴·이미지가 덜 들어와 잠깐 안 맞아도, whenReady 뒤 matchQuad가 다시 맞춤
    if (V[0]?.quad) return [build(V[V.length - 1])];
    // 표가 하한에서도 안 들어가면 행을 반으로 나눠 "계속" 장면으로
    //   표가 여럿이면 행이 가장 많은 표 하나만 나눕니다(같으면 앞의 것). 나머지 표는 앞 장면에 온전히 남음
    const nrows = (v) => v.el.querySelectorAll('tbody tr').length;
    const tbl = tsplit ? tsplit.v : vis.filter((v) => v.ref.kind === 'table' && v.el).reduce((m, v) => (!m || nrows(v) > nrows(m) ? v : m), null);
    if (tbl && vis.includes(tbl) && depth < 3) {
      const rows = tsplit ? tsplit.rows : [0, nrows(tbl)];
      if (rows[1] - rows[0] >= 4) {
        const mid = rows[0] + Math.ceil((rows[1] - rows[0]) / 2);
        const a = fitSlide(sl, vis, sid, part, codeChunk, meta, { v: tbl, rows: [rows[0], mid] }, depth + 1);
        const b = fitSlide({ ...sl, points: [], lead: null, layout: 'full' }, vis.filter((v) => v === tbl), `${sid}-t${depth + 1}`, part, codeChunk, meta, { v: tbl, rows: [mid, rows[1]] }, depth + 1);
        return [...a, ...b];
      }
    }
    return [PF.shrinkOrClip(build(V[V.length - 1]), PFScene.refUrl(sid), info.overflow)];
  }

  async function renderAll(pf, p, P) {
    info.notes = []; info.overflow = []; info.unresolved = [];
    const name = pf.profile?.name || '';
    const foot = `${name ? name + ' · ' : ''}${p.title}`;
    info.meta = { title: p.title, name };                               // PPTX 파일 이름·작성자(assets/deck-pptx.js)
    document.title = `${p.title} — ${PF.t('name.deck')}${name ? ' · ' + name : ''}`;
    info.fonts = await PF.loadFonts();
    mark('fonts');
    const model = modelOf(p, P);
    await resolveVisuals(model, P, p);
    mark('visuals');
    const auto = info.mode === 'auto';
    const ext = PF.extLinks(p);
    const used = new Set(['cover', 'toc', 'retro', 'end']);

    // 표지 = 프로젝트 소개 템플릿(PF.projectIntro, 결정 G4). 상세 문서 링크는 표지·맺음에만(G1)
    const cards = [
      ...ext.map((l) => ({ k: PF.extEn(l), label: l.label, href: l.url, kind: 'external', visible: shortUrl(l.url) })),
      { k: PF.t('en.techdoc'), label: PF.t('name.doc'), href: PF.docUrl(p.id), kind: 'page', visible: PF.visibleUrl(PF.docUrl(p.id)) },
    ];   // 직접 고친 기능: 포트폴리오로 돌아가는 카드는 표지에서 빼고 아래 띠 맨 왼쪽 버튼으로(맺음 장면 카드는 그대로)
    const cover = await PF.projectIntro(p, { id: 'cover', titleTag: 'h1', eyebrow: PF.t('deck.cover-eyebrow'), links: cards, foot, sec: PF.t('deck.cover'), stats: info.overflow });
    if (auto) cover.querySelector('.pf-foot > span').insertAdjacentHTML('beforeend', '<span class="pf-autoband" data-pf-ui="note">예전 데이터로 자동 구성 — /portfolio-build를 다시 실행하면 슬라이드가 됩니다</span>');

    // 장 → 장 표지 + 장면들
    const chapterScenes = [];
    const tocItems = [];
    model.forEach((c, ci) => {
      const ckey = PF.keyOk(c.key) ? c.key : `c${ci + 1}`;
      let chId = `ch-${ckey}`; if (used.has(chId)) chId = `ch-c${ci + 1}`; used.add(chId);
      const slides = [];
      c.slides.forEach((sl, si) => {
        let sid = PF.keyOk(sl.key) ? `d-${sl.key}` : `d${ci + 1}-${si + 1}`, err = '';
        if (!PF.keyOk(sl.key)) err = `key-invalid: "${sl.key || ''}"`;
        if (used.has(sid)) { err = `key-invalid: "${sl.key}" 중복`; sid = `d${ci + 1}-${si + 1}`; }
        used.add(sid);
        // 직접 고침(2026-11-25): 장면 머리 — 왼쪽 위 「장 제목 · 종류 라벨」, 오른쪽 위는 그 절의 상세 문서 링크(「상세 문서 §2.2 ↗」).
        //   제목 앞 절 번호는 떼고 링크의 §번호로. 번호가 제목에 없으면 sectionPath에서 가장 가까운 번호 붙은 절
        //   직접 고침(2026-11-26): 종류 라벨(구현·구조·흐름…)은 모든 장에서 빼고 장 제목만
        const path = sl.sectionPath || [];
        const eyebrow = c.title || '';
        const num = [txt(sl.title), ...[...path].reverse()].map((t) => (SEC_NO.exec(t || '') || [])[1]).find(Boolean) || '';
        const href = PF.docUrl(p.id, path.length ? `sec=${encodeURIComponent(path[path.length - 1])}` : '');
        const rhtml = PF.link({ href, kind: 'page', cls: 'pf-headlink', label: esc(num ? PF.t('deck.doc-ref', { n: num }) : PF.t('deck.doc-ref-plain')) });
        const scenes = slideScenes(sl, sid, { chapter: c.title || '', eyebrow, rhtml, foot, auto, err });
        scenes.forEach((s) => used.add(s.id));
        slides.push({ sl, scenes });
      });
      const chs = chapterScene(c, ci, chId, slides, foot, auto, p.title);
      chapterScenes.push(chs, ...slides.flatMap((x) => x.scenes));
      tocItems.push({ c, chId, n: slides.reduce((a, x) => a + x.scenes.length, 0), endId: (slides.at(-1)?.scenes.at(-1) || chs).id });
    });
    const retro = buildRetro(p.retro || {}, p, foot, auto);
    const end = endScene(p, foot, ext, auto);
    const toc = tocScene(p, foot, tocItems, retro, auto);
    const all = [cover, toc, ...chapterScenes, ...retro, end];
    PF.noteFill(all, { fill: !auto });                                  // 예전 데이터 자동 구성은 채움률 참고를 내지 않음(다시 빌드 안내 1건만)
    if (auto) PF.note('cover', 'auto-mode', 1, '예전 데이터로 자동 구성(다시 빌드하면 슬라이드)');
    else if (all.length > 30) PF.note('cover', 'many-scenes', all.length, `장면 ${all.length}장(권장 15~30장)`);
    Object.assign(info.summary, { scenes: all.length, chapters: model.length, slides: model.reduce((a, c) => a + c.slides.length, 0), mode: info.mode });
    mark('summary');
    remapHash(p, all, model);
    deck.replaceChildren(...all);
    deck.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('loading')) i.loading = 'lazy'; i.decoding = 'async'; });
    mark('assembled');
  }

  // 옛 장면 id(#s=hl-n …)·없는 장면 id(#s=d-<key>·ch-<key>) → 새 장면 id. 마운트 전에 주소만 바꿈(키트가 그 장면으로 이동)
  function remapHash(p, scenes, model) {
    let raw = location.hash.slice(1); try { raw = decodeURIComponent(raw); } catch { /* */ }
    const m = /^(?:s=)?(.+)$/.exec(raw); if (!m) return;
    const want = m[1];
    if (scenes.some((s) => s.id === want)) return;
    let to = '';
    const hm = /^(hl|ts)-(\d+)/.exec(want);
    if (hm) {
      const list = hm[1] === 'hl' ? p.highlights || [] : p.troubleshooting || [];
      const it = list[+hm[2] - 1];
      to = info.mode === 'auto' ? `d-${hm[1]}-${hm[2]}` : it ? PF.deckSceneFor(p, it.section) : '';
      if (!to && it?.section) {                                          // 같은 장(H2)의 장 표지
        const ch = model.find((c) => (c.slides || []).some((x) => (x.sectionPath || []).some((t) => PF.normTitle(t) === PF.normTitle(it.section))));
        if (ch) to = scenes.find((s) => s.dataset.group === ch.title && s.classList.contains('t-CH'))?.id || '';
      }
    } else if (/^shots/.test(want)) to = scenes.find((s) => s.classList.contains('l-screens'))?.id || '';
    else if (want === 'more') to = 'end';
    else if (/^retro/.test(want)) to = 'retro';
    else if (/^d-/.test(want)) to = PF.deckSceneNear(p, want, (id) => scenes.some((s) => s.id === id));   // 숨겼거나 다시 빌드로 없어진 장면
    if (!to || !scenes.some((s) => s.id === to)) to = /^(hl|ts|shots|more|retro|d-|ch-)/.test(want) ? 'toc' : '';
    if (to) try { history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(to)}`); } catch { /* */ }
  }

  // 목록 한 줄(같은 슬라이드 안 이동 = 같은 탭). 쪽 번호(p.N)는 키트가 채움
  //   ld = 장 표지 넉넉한 변형에서 그 장면의 도입(lead, 데이터의 글 조각 그대로)
  //   endRef = (목차) 이 항목의 마지막 장면 id — 있으면 키트가 쪽 번호를 「p.n — m」으로 채움(직접 고침 2026-11-25)
  const item = (n, t, d, ref, ld = '', endRef = '') => `<li><a href="#${esc(ref)}" data-pf-ref="${esc(ref)}"${endRef ? ` data-pf-ref-end="${esc(endRef)}"` : ''}><span class="n">${esc(n)}</span><span class="tx"><span class="t">${inline(t)}</span>${d ? `<span class="d">${esc(d)}</span>` : ''}${ld ? `<span class="ld">${inline(ld)}</span>` : ''}</span><span class="pg"><span class="pf-n-screen">p.00</span><span class="pf-n-print"></span></span></a></li>`;
  const band = (s, auto) => { if (auto) s.querySelector('.pf-foot > span').insertAdjacentHTML('beforeend', '<span class="pf-autoband" data-pf-ui="note">예전 데이터로 자동 구성</span>'); return s; };

  // 장 표지: 장면이 적으면(4개 이하) 넉넉한 변형 — 목차 크기 목록 + 장면마다 도입(결정 I7). 안 들어가면 보통 → 촘촘
  const ROOMY_MAX = 4;
  function chapterScene(c, ci, chId, slides, foot, auto, ptitle) {
    const make = (mode) => {
      const s = PF.scene({ id: chId, tpl: 'CH', kind: 'bare', cls: mode === 'compact' ? 'compact' : '', foot, sec: c.title, group: c.title, stitle: c.title });
      const roomy = mode === 'roomy';
      // 직접 고침(2026-11-25): 절 목록 제목 앞 번호(「2.2 」) 떼기
      // 직접 고침(2026-11-25): 이어진 같은 절(sectionPath 마지막 제목)의 장면은 한 줄로 묶고, 슬라이드가 둘 이상이면 쪽 번호를 목차처럼 「p.시작 — 끝」으로
      const groups = [];
      // 직접 고침(2026-11-27): 바로 위 줄의 절 아래 하위 제목(예: 3.3 아래 「배치 확정 — …」) 장면도 그 줄에 묶음 — Folk Sack §3.3
      const pathOf = (x) => (x.sl.sectionPath || []).map((t) => PF.normTitle(t));
      slides.forEach((x) => {
        const sec = PF.normTitle((x.sl.sectionPath || []).at(-1) || txt(x.sl.title));
        const path = pathOf(x);
        const g = groups.at(-1);
        const sub = g && g.path.length > 0 && path.length > g.path.length && g.path.every((t, k) => path[k] === t);
        if (g && (g.sec === sec || sub)) g.items.push(x); else groups.push({ sec, path, items: [x] });
      });
      // 직접 고침(2026-11-27): 한 줄에 묶인 장면들의 제목이 서로 다르면 첫 장면 제목 대신 절 이름(번호 뗌)으로 — Folk Sack §2.7 「고민과 선택」(결정·AI 과정)
      const groupTitle = (g) => {
        const x = g.items[0];
        if (g.items.every((y) => txt(y.sl.title) === txt(x.sl.title))) return secTitle(txt(x.sl.title));
        return secTitle((x.sl.sectionPath || []).at(-1) || '') || secTitle(txt(x.sl.title));
      };
      const list = groups.map((g, i) => {
        const x = g.items[0], all = g.items.flatMap((y) => y.scenes);
        return item(String(i + 1), groupTitle(g) || c.title, PF.tab(x.sl.tab), all[0].id, roomy ? txt(x.sl.lead) : '', all.length > 1 ? all.at(-1).id : '');
      }).join('');
      // 직접 고침(2026-11-25): 장 표지 오른쪽 위 「장면 n개」 빼기
      // 직접 고침(2026-11-25): 장 표지 윗줄(프로젝트 이름) 빼기 — 꼬리말 왼쪽에 늘 있음
      PF.body(s).innerHTML = `
        <div class="ch-mid"><div><p class="ch-no">${esc(PF.t('en.chapter'))} ${String(ci + 1).padStart(2, '0')}</p><h2 class="ch-t">${esc(c.title)}</h2>${DOT}</div>
        <div class="ch-list t-P2${mode === 'normal' ? '' : ' ' + mode}"><ol class="toc-list${roomy ? '' : ' sub'}">${list}</ol></div></div>`;
      return band(s, auto);
    };
    const modes = slides.length <= ROOMY_MAX ? ['roomy', 'normal', 'compact'] : ['normal', 'compact'];
    for (const m of modes) { const s = make(m); if (PF.fitsM(s)) return s; }
    return PF.shrinkOrClip(make('compact'), PFScene.refUrl(chId), info.overflow);
  }

  function tocScene(p, foot, items, retro, auto) {
    // 직접 고침(2026-11-25): 장 줄의 「장면 n장」 설명 빼고, 쪽 번호를 「p.시작 — 끝」 범위로(회고·더 보기 줄의 설명은 그대로)
    const rows = [...items.map((x, i) => [String(i + 1).padStart(2, '0'), x.c.title, '', x.chId, '', x.endId]),
      retro.length && [String(items.length + 1).padStart(2, '0'), PF.t('deck.retro'), PF.t('deck.retro-desc'), retro[0].id, '', retro.at(-1).id],
      [String(items.length + (retro.length ? 2 : 1)).padStart(2, '0'), PF.t('deck.more'), PF.t('deck.more-desc'), 'end', '', 'end']].filter(Boolean);
    const make = (compact) => {
      const s = PF.scene({ id: 'toc', tpl: 'P2', kind: 'bare', cls: compact ? 'compact' : '', foot, sec: PF.t('name.toc'), stitle: PF.t('name.toc') });
      // 직접 고침(2026-11-24): 목차 제목은 영문 CONTENTS(en.contents) 대신 「목차」(name.toc, 문구 표에서 바꿀 수 있음)
      // 직접 고침(2026-11-25): 목차 오른쪽 위 프로젝트 이름(toc-sub)·회고 장면 오른쪽 위 프로젝트 이름 빼기 — 꼬리말 왼쪽에 늘 있음
      // 직접 고침(2026-11-24): 슬라이드 공용 — 목차는 한 열에 다 들어가도 늘 2열(항목 2개 이상). 홀수면 왼쪽이 하나 더(올림)
      const two = rows.length > 1, half = two ? Math.ceil(rows.length / 2) : rows.length;
      const col = (list) => `<section><ol class="toc-list">${list.map((r) => item(...r)).join('')}</ol></section>`;
      PF.body(s).innerHTML = `<div class="toc-top"><p class="toc-h">${esc(PF.t('name.toc'))}</p></div>${DOT}<div class="toc-cols${two ? '' : ' one'}">${col(rows.slice(0, half))}${rows.length > half ? col(rows.slice(half)) : ''}</div>`;
      return band(s, auto);
    };
    for (const compact of [false, true]) { const s = make(compact); if (PF.fitsM(s)) return s; }
    return PF.shrinkOrClip(make(true), PFScene.refUrl('toc'), info.overflow);
  }

  // 결과와 회고: ✓ 달성 카드 │ 아쉬운 점 → 개선 계획 표. 안 들어가면 두 장으로
  function buildRetro(r, p, foot, auto) {
    const ach = r.achieved || [], reg = r.regrets || [], plan = r.plans || [];
    if (!ach.length && !reg.length && !plan.length) return [];
    const n = Math.max(reg.length, plan.length);
    const achHtml = ach.length ? `<div class="rt-ach card"><p class="rt-h ok">✓ ${esc(PF.t('deck.achieved'))}</p><ul>${ach.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>` : '';
    const pairHtml = n ? `<table class="mini"><thead><tr><th scope="col">△ ${esc(PF.t('deck.regrets'))}</th><th scope="col">→ ${esc(PF.t('deck.plans'))}</th></tr></thead><tbody>${Array.from({ length: n }, (_, i) => `<tr><td>${inline(reg[i] || '')}</td><td class="p">${inline(plan[i] || '')}</td></tr>`).join('')}</tbody></table>` : '';
    const make = (html, one, i, cnt) => {
      const s = PF.scene({ id: i === 0 ? 'retro' : `retro-${i + 1}`, tpl: 'P6', eyebrow: PF.t('deck.retro-eyebrow'), rlabel: '', title: PF.t('deck.retro'), sub: cnt > 1 ? `${i + 1}/${cnt}` : '', foot,
        sec: PF.t('deck.retro'), group: PF.t('deck.retro') });
      PF.body(s).innerHTML = `<div class="pf-fill"><div class="rt${one ? ' one' : ''}">${html}</div></div>`;
      return band(s, auto);
    };
    const s = make(achHtml + pairHtml, !achHtml || !pairHtml, 0, 1);
    if (PF.fitsM(s)) return [s];
    const two = [achHtml, pairHtml].filter(Boolean).map((h, i, a) => make(h, true, i, a.length));
    return two.map((x) => (PF.fitsM(x) ? x : PF.shrinkOrClip(x, PFScene.refUrl(x.id), info.overflow)));
  }

  // 맺음: 프로젝트 상세 문서(전문) · 바깥 링크 · 포트폴리오. 슬라이드 → 상세 문서 링크는 표지와 여기에만(G1)
  function endScene(p, foot, ext, auto) {
    const card = (k, label, href, kind, visible, primary) => `<div class="lcard${primary ? ' primary' : ''}">${link({ href, kind, label: `<span class="lc-k">${esc(k)}</span><span class="lc-t">${esc(label)}</span><span class="url">${esc(visible)}</span>` })}</div>`;
    const make = () => {
      const s = PF.scene({ id: 'end', tpl: 'EN', kind: 'bare', foot, sec: PF.t('deck.more'), stitle: PF.t('deck.end-title') });
      PF.body(s).innerHTML = `<div class="toprow"><span class="pf-eyebrow">${esc(PF.t('en.more'))}</span><span class="rl">${esc(PF.teamLabel(p.team))}</span></div>
        <div class="en-mid"><div><h2 class="en-t">${esc(p.title)}</h2>${p.tagline ? `<p class="tagline">${inline(p.tagline)}</p>` : ''}${DOT}</div>
        <div class="en-links">${card(PF.t('en.techdoc'), PF.t('deck.end-doc'), PF.docUrl(p.id), 'page', PF.visibleUrl(PF.docUrl(p.id)), true)}
          ${ext.map((l) => card(PF.extEn(l), l.label, l.url, 'external', shortUrl(l.url))).join('')}
          ${card(PF.t('en.portfolio'), PF.t('ui.back'), 'index.html', 'page', PF.visibleUrl(''))}</div></div>`;
      return band(s, auto);
    };
    return PF.guard(make(), PFScene.refUrl('end'), info.overflow);
  }
})();
