// 자기소개서 전문 — letter.html (직접 추가한 페이지)
//   레포 맨 위의 자기소개서.md를 상세 기술문서(doc.js)와 같은 틀로 그립니다: 머리 막대 · 왼쪽 목차 · 가운데 본문 · 오른쪽 레일(≥1440px) · 목차 서랍(<1280px).
//   md 해석은 PF.md.parse(doc.html·발표 덱과 같은 규칙). md 맨 위 # 제목은 페이지 제목(h1)으로 올리고 본문에서는 뺍니다.
//   글을 만들지 않습니다. md를 그대로 보여 줄 뿐입니다. 점검: PFLetter.report()
(async () => {
  const FILE = '자기소개서.md';
  const root = document.getElementById('app');
  const html = document.documentElement;
  window.PFLetter = { report: () => ({ page: 'letter', ready: html.dataset.docReady === '1', strings: PF.stringsReport() }) };
  if (PF.guardFileProtocol(root)) return;

  const { esc, link } = PF;
  const T = (k, v) => esc(PF.t(k, v));
  const [pf] = await Promise.all([PF.loadJSON('data/portfolio.json').catch(() => ({})), PF.loadStrings()]);
  PF.applyTheme(pf.settings?.accent);
  document.querySelector('.skip-link')?.replaceChildren(PF.t('ui.skip'));
  const name = pf.profile?.name || '';

  let md;
  try { md = await PF.loadText(PF.encodePath(FILE)); }
  catch (err) {
    PF.notice(root, '자기소개서를 찾을 수 없습니다', `<p>${esc(err.message)}</p><p>${link({ href: 'index.html', label: '← 포트폴리오로', kind: 'back', cls: 'btn' })}</p>`);
    return done();
  }
  const { frag, headings: hs } = PF.md.parse(md, '');
  const h1 = hs.find((h) => h.level === 1);
  const title = h1?.text || '자기소개서';
  h1?.el.remove();
  const headings = hs.filter((h) => h !== h1);
  document.title = `${title}${name ? ' · ' + name : ''}`;

  root.innerHTML = `
    <header class="doc-head">
      <div class="doc-head-in">
        <p class="crumb">${link({ href: 'index.html', label: T('ui.back'), kind: 'back' })}<span aria-hidden="true">›</span><b>${esc(title)}</b></p>
        ${PF.modeButton('btn')}
      </div>
    </header>
    <div class="doc-page">
      <nav class="toc" id="toc" aria-label="문서 목차"><p class="toc-title">${T('name.toc')}</p><div class="toc-links" id="toc-links"></div></nav>
      <main class="doc-main" id="main" tabindex="-1">
        <div class="doc-intro">
          ${name ? `<p class="eyebrow">${esc(name)}</p>` : ''}
          <h1>${esc(title)}</h1>
        </div>
        <article class="md" id="doc"></article>
      </main>
      <aside class="rail" aria-label="문서 정보">
        <section class="rail-card"><p class="rail-title">${T('doc.rail-links')}</p><nav class="rail-links" id="rail-pdf" aria-label="PDF"></nav></section>
      </aside>
    </div>
    <div class="doc-fab" role="group" aria-label="빠른 이동"><button type="button" class="fab-toc" aria-haspopup="dialog">${T('name.toc')}</button></div>
    <dialog class="toc-dialog" aria-label="문서 목차"><div class="toc-dialog-head"><p class="toc-title">${T('name.toc')}</p><button type="button" class="btn dlg-close">${T('ui.close')}</button></div><div class="toc-links"></div></dialog>`;

  // 직접 수정: 맨 아래 띠(세 줄) — 자기소개서에는 다른 문서 링크 없음 — 예전 본문 맨 아래 세 줄을 옮김(common.js docEnd)
  PF.docEnd(root.querySelector('.doc-page'), { pf, name });

  // PDF: 미리 만든 <이름>-자기소개서.pdf(tools/make-letter-pdf.py)가 있으면 [PDF로 보기 ↗] · [PDF로 저장](내려받기), 없으면 [PDF로 저장](인쇄 창 — doc.css 인쇄 규칙)
  //   파일 이름 규칙은 tools/make-letter-pdf.py의 letter_name()과 같아야 함
  const pdfFile = `${name.replace(/[\\/:*?"<>|]/g, '')}${name ? '-' : ''}자기소개서.pdf`.normalize('NFC');
  const railPdf = document.getElementById('rail-pdf');   // PDF 링크는 오른쪽 칸 '링크' 카드에만(좁은 화면은 [정보]로 열어서)
  // 내려받기 아이콘: 포트폴리오 문서의 [PDF로 저장]과 같은 그림·크기(18px, 선 0.98). 버튼 높이가 늘지 않게 위아래 여백을 음수로
  const SAVE_ICON = '<svg class="pf-save-icon" aria-hidden="true" focusable="false" viewBox="0 0 12 12" width="18" height="18" style="flex:none;margin:-4px -4px -4px 2px" fill="none" stroke="currentColor" stroke-width="0.98" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 2.25v5.25M3.9 5 6.5 7.6 9.1 5M2.75 9.75h7.5"/></svg>';
  const hasPdf = await fetch(encodeURIComponent(pdfFile), { method: 'HEAD', cache: 'no-cache' })
    .then((r) => r.ok && !/text\/html/i.test(r.headers.get('content-type') || '')).catch(() => false);
  if (hasPdf) {
    const href = encodeURIComponent(pdfFile);
    railPdf.innerHTML = link({ href, label: 'PDF로 보기', kind: 'page' }) +
      `<a href="${href}" download="${esc(pdfFile)}">PDF로 저장${SAVE_ICON}</a>`;
  } else {
    railPdf.innerHTML = '<button type="button" data-pdf-print>PDF로 저장' + SAVE_ICON + '</button>';
    document.querySelectorAll('[data-pdf-print]').forEach((b) => b.addEventListener('click', () => window.print()));
  }

  // 본문 링크: 바깥 주소는 새 탭(↗), 같은 문서 안은 같은 탭
  frag.querySelectorAll('a[href]').forEach((a) => { if (/^https?:/i.test(a.getAttribute('href') || '')) PF.markNewTab(a); });
  document.getElementById('doc').replaceChildren(frag);

  const toc = headings.filter((h) => h.level === 2 || h.level === 3);
  const tocHtml = toc.map((h) => `<a class="h${h.level}" href="#${esc(h.id)}">${esc(h.text)}</a>`).join('');
  document.querySelectorAll('.toc-links').forEach((el) => { el.innerHTML = tocHtml; });
  PF.fitSides?.();                                                      // 페이지 끝에서 목차·오른쪽 칸이 머리 줄과 겹치지 않게

  // 목차 서랍(< 1280px): 고르면 닫힘
  const dlg = document.querySelector('.toc-dialog');
  document.querySelector('.fab-toc').addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.dlg-close') || e.target.closest('a')) dlg.close(); });

  // 목차 현재 위치(직접 수정: 오른쪽 칸 '지금 읽는 절' 카드 없앰 — 목차 강조와 겹침)
  const links = new Map([...document.querySelectorAll('#toc-links a')].map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  let cur, t = 0;
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
    pin = toc.some((h) => h.el === el) ? { el, settled: false, y: 0 } : null;
    if (pin) { armSettle(); clearTimeout(capT); capT = setTimeout(settle, 4000); cur = undefined; update(); }   // 누른 순간 강조
  });
  const update = () => {
    t = 0;
    let c = null;
    for (const h of toc) { if (h.el.getBoundingClientRect().top <= innerHeight * 0.3) c = h; else break; }   // 화면 위 30% 선을 지난 마지막 제목
    if (toc.length && innerHeight + scrollY >= document.documentElement.scrollHeight - 2) c = toc[toc.length - 1];   // 맨 아래까지 내리면 마지막 제목(짧은 마지막 절은 30% 선에 닿지 못함)
    if (pin) { if (!pin.settled || Math.abs(scrollY - pin.y) <= 4) c = toc.find((h) => h.el === pin.el); else pin = null; }   // 이동 중·멈춘 자리 = 고른 제목, 손으로 벗어나면 놓음
    if (c === cur && cur !== undefined) return;
    cur = c;
    links.forEach((a) => { a.classList.remove('active'); a.removeAttribute('aria-current'); });
    if (!c) return;
    const a = links.get(c.id);
    if (a) { a.classList.add('active'); a.setAttribute('aria-current', 'location'); }
  };
  addEventListener('scroll', () => { if (pin && !pin.settled) armSettle(); if (!t) t = setTimeout(update, 60); }, { passive: true });
  addEventListener('resize', () => { cur = undefined; update(); });
  update();

  // 주소 끝 #<제목>으로 왔으면 그 절로
  const hash = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } })();
  if (hash && hash !== 'top') document.getElementById(hash)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  PF.topCap(PF.t('doc.top'));
  PF.railToggle();
  done();

  function done() { (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { html.dataset.docReady = '1'; }); }
})();
