// 직접 만든 파일: 페이지 스크롤 막대를 내용 위에 겹쳐 그림 — 포트폴리오 페이지·슬라이드·상세 문서·자기소개서 공용.
//   브라우저 기본 막대는 자리를 차지해 오른쪽에 빈 띠(바탕색)가 남음 → 마우스를 쓰는 화면에서는 기본 막대를 숨기고(내용이 창 오른쪽 끝까지 참)
//   같은 자리에 불투명 손잡이(.pf-sb — 글자색과 바탕색을 섞은 단색, 뒤 내용이 비치지 않음)를 띄움. 늘 보이고, 끌기·홈 누르기(그 자리로 한 화면씩)·마우스를 올리거나 끌면 색만 진하게(굵기는 그대로).
//   화면이 고정된 채 스크롤만 쓰는 구간(포트폴리오 페이지 기능 소개)에서는 손잡이가 멈춤.
//   터치 화면은 기본(겹쳐 그리는) 막대 그대로. 인쇄에는 나오지 않음. 페이지가 스크롤되지 않으면(슬라이드 한 장씩 보기 등) 숨김.
(() => {
  if (window.__pfSb) return; window.__pfSb = true;
  const fine = matchMedia('(pointer: fine)');
  const css = `
@media screen and (pointer: fine) {
  html { scrollbar-width: none; }
  html::-webkit-scrollbar { display: none; }
  .pf-sb { position: fixed; top: 0; right: 0; bottom: var(--pf-sb-bottom, 0px); width: 14px; z-index: 2147483000; display: none; }
  .pf-sb.on { display: block; }
  .pf-sb-thumb { position: absolute; right: 3px; width: 8px; min-height: 32px; border-radius: 999px; cursor: default;
                 background: color-mix(in srgb, var(--ink, #F4F4F6) 30%, var(--bg, #0A0A0D)); transition: background-color .15s; }
  .pf-sb:hover .pf-sb-thumb, .pf-sb.drag .pf-sb-thumb { background: color-mix(in srgb, var(--ink, #F4F4F6) 50%, var(--bg, #0A0A0D)); }
}
@media print { .pf-sb { display: none !important; } }`;
  const start = () => {
    const st = document.createElement('style'); st.textContent = css; document.head.append(st);
    const bar = document.createElement('div'); bar.className = 'pf-sb'; bar.setAttribute('aria-hidden', 'true'); bar.dataset.pfUi = 'scrollbar';   // 슬라이드 배치 점검(outside-deck)이 화면 조작 요소로 보고 건너뜀
    const thumb = document.createElement('div'); thumb.className = 'pf-sb-thumb'; bar.append(thumb);
    document.body.append(bar);
    const se = () => document.scrollingElement || document.documentElement;
    // 멈춰 있는 구간: 포트폴리오 페이지 기능 소개(.fe)처럼 화면이 고정(sticky .fe-pin)된 채 스크롤만 쓰는 곳은 손잡이를 멈춤.
    //   손잡이는 '화면이 실제로 움직인 거리'를 따라감 — 실제 스크롤 = 보이는 스크롤 + 지나간 멈춤 구간 길이. 손잡이 크기·위치·끌기 모두 이 보이는 거리 기준
    const holds = () => [...document.querySelectorAll('.fe > .fe-pin')].map((pin) => {
      if (getComputedStyle(pin).position !== 'sticky') return null;     // 좁은 화면(고정 없음)은 그대로
      const fe = pin.parentElement, d = fe.offsetHeight - pin.offsetHeight;
      if (d <= 1) return null;
      const start = fe.getBoundingClientRect().top + se().scrollTop - (parseFloat(getComputedStyle(pin).top) || 0);
      return { start, d };
    }).filter(Boolean).sort((a, b) => a.start - b.start);
    let raf = 0, h = 0, room = 0, max = 0, vmax = 0, hs = [];
    const toV = (y) => y - hs.reduce((sum, x) => sum + Math.min(x.d, Math.max(0, y - x.start)), 0);   // 실제 → 보이는 거리
    const toY = (v) => { let y = v; for (const x of hs) { if (y > x.start) y += x.d; } return y; };     // 보이는 거리 → 실제(멈춤 구간에 떨어지면 그 시작)
    const draw = () => {
      raf = 0;
      const el = se(), vh = innerHeight, sh = el.scrollHeight;
      max = sh - vh;
      const on = fine.matches && max > 1;
      bar.classList.toggle('on', on);
      if (!on) return;
      const track = bar.clientHeight || vh;                             // 막대 길이: 페이지가 아래 띠 높이(--pf-sb-bottom)를 주면 그만큼 짧음(켠 뒤에 잼)
      hs = holds();
      vmax = Math.max(1, max - hs.reduce((sum, x) => sum + x.d, 0));
      h = Math.max(32, Math.round(track * vh / (vmax + vh)));
      room = track - h - 6;                                                 // 위아래 3px씩 띄움
      thumb.style.height = `${h}px`;
      thumb.style.top = `${3 + Math.round(room * Math.min(1, Math.max(0, toV(el.scrollTop) / vmax)))}px`;
    };
    const ask = () => { if (!raf) raf = requestAnimationFrame(draw); };
    addEventListener('scroll', ask, { passive: true });
    addEventListener('resize', ask);
    fine.addEventListener?.('change', ask);
    new ResizeObserver(ask).observe(document.body);
    new ResizeObserver(ask).observe(document.documentElement);
    // 끌기: 손잡이를 잡은 자리를 기준으로 따라 움직임(부드러운 스크롤 없이 바로)
    let grab = null;
    thumb.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      grab = { y: e.clientY, v: toV(se().scrollTop) };
      thumb.setPointerCapture(e.pointerId); bar.classList.add('drag');
    });
    thumb.addEventListener('pointermove', (e) => {
      if (!grab || room <= 0) return;
      se().scrollTo({ top: toY(Math.min(vmax, Math.max(0, grab.v + (e.clientY - grab.y) * vmax / room))), behavior: 'instant' });
    });
    const drop = () => { grab = null; bar.classList.remove('drag'); };
    thumb.addEventListener('pointerup', drop); thumb.addEventListener('pointercancel', drop);
    // 홈 누르기: 손잡이 위·아래 쪽으로 한 화면씩
    bar.addEventListener('pointerdown', (e) => {
      if (e.target !== bar || e.button !== 0) return;
      e.preventDefault();
      const r = thumb.getBoundingClientRect();
      se().scrollBy({ top: (e.clientY < r.top ? -1 : 1) * innerHeight * 0.9 });
    });
    draw();
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
