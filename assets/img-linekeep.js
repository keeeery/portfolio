/* 직접 추가(2026-11-28): 선을 지키는 이미지 축소 — 상세 문서(doc.html)·슬라이드(project.html)
 *
 * 게임 UI 스크린샷의 1px 테두리·칸 선은 브라우저가 이미지를 작게 줄이면(픽셀 평균) 옅어지거나 사라집니다.
 * 늘릴 때도(Retina 등 화면 픽셀이 원본보다 많을 때) 1px 선이 위치에 따라 1px·2px로 달라 보입니다.
 * 이 파일은 원본 픽셀을 캔버스로 읽어 "실제 화면 픽셀 크기"(표시 크기 × 화면 배율)로 직접 줄이거나 늘려 그 결과를 보여 줍니다.
 *   - 원본에서 "길게(RUN px 이상) 곧은 가는(1~3px) 밝은 선"만 먼저 고릅니다. 바탕은 그 선을 지운 그림을 면적 평균으로 줄이거나 늘리고,
 *     선은 「원래 굵기 × 배율」을 반올림한 같은 굵기로 화면 픽셀에 맞춰 다시 그립니다(줄일 때는 밝기 K, 늘릴 때는 그대로).
 *     그래서 칸·테두리 선이 어디서나 같은 굵기로 남고, 글자 획·아이콘·사진은 평소처럼 섞입니다.
 *   - <img>의 src·크기는 그대로 두고 화면에 그리는 내용만 CSS content로 바꿉니다(@media screen).
 *     그래서 배치 계산·확대 창·편집 모드·PPTX 저장·인쇄(PDF)는 원본 이미지를 씁니다.
 *   - 영상(video)·GIF·SVG·작은 그림, 슬라이드 개요 썸네일은 건너뜁니다. 장면·그림마다 끄려면 조상에 data-pf-linekeep="off".
 *   - 끄기: 주소에 ?pf-linekeep=0 · 확인: PFLineKeep.report()
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.ResizeObserver) return;
  try { if (new URLSearchParams(location.search).get('pf-linekeep') === '0') return; } catch (e) { /* 무시 */ }

  const K = 0.75;          // 그 밝기를 살리는 정도(0 = 평균 그대로, 1 = 가장 밝은 픽셀)
  const LINE_DIFF = 40;    // 선으로 볼 픽셀: 수직 방향 양옆보다 이만큼 밝음
  const RUN = 30;          // 선으로 볼 길이(원본 px) — 글자 획·아이콘 무늬보다 길게
  const MAXK = 3;          // 선으로 볼 굵기(원본 px) — 툴팁 테두리처럼 2px인 선도 같은 굵기로
  const SAME_SCALE = 0.02; // 화면 픽셀이 원본과 2% 안쪽으로 같으면 손대지 않음
  const MIN_SIDE = 200;    // 원본이 이보다 작으면 건너뜀(아이콘 등)
  const SKIP_EXT = /\.(gif|svg)(\?|#|$)/i;

  const state = new WeakMap();      // img → { key, url }
  const queue = new Set();
  const stats = { done: 0, skipped: 0, errors: 0, ms: 0 };
  let timer = 0, running = false;

  const style = document.createElement('style');
  // 처리한 그림은 이미 화면 픽셀 크기 — 그림 자리가 소수점(예: 왼쪽 62.375px)이어도 다시 섞지 않고 픽셀 그대로(섞으면 같은 1px 선이 어떤 곳은 옅은 2px로 보임)
  style.textContent = '@media screen { img[data-pf-lk] { content: var(--pf-lk); image-rendering: pixelated; } }';
  document.head.appendChild(style);

  function skip(img) {
    const src = img.currentSrc || img.src || '';
    if (!src || src.startsWith('data:') || src.startsWith('blob:') || SKIP_EXT.test(src)) return true;
    if (img.closest('[data-pf-linekeep="off"], .pf-ov-thumb, .pf-lightbox, [class*="lightbox"]')) return true;
    if (img.naturalWidth && Math.max(img.naturalWidth, img.naturalHeight) < MIN_SIDE) return true;
    return false;
  }

  function clear(img) {
    const s = state.get(img);
    if (s && s.url) URL.revokeObjectURL(s.url);
    state.delete(img);
    img.removeAttribute('data-pf-lk');
    img.style.removeProperty('--pf-lk');
  }

  // 그림이 실제로 그려지는 상자(object-fit: contain이면 안쪽 그림 크기)
  function drawBox(img) {
    const r = img.getBoundingClientRect();
    let w = r.width, h = r.height;
    if (!w || !h) return null;
    const fit = getComputedStyle(img).objectFit;
    const nr = img.naturalWidth / img.naturalHeight, br = w / h;
    if (Math.abs(nr - br) / nr > 0.01) {
      if (fit === 'contain' || fit === 'scale-down') { if (br > nr) w = h * nr; else h = w / nr; }
      else if (fit === 'cover' || fit === 'none') return null;   // 잘려 보이는 그림은 건너뜀
    }
    return { w, h };
  }

  // 원본에서 "길게 곧은 가는 밝은 선"(굵기 1~MAXK px)만 고름 — 가로 선: 띠(위에서 아래로 k줄)의 모든 픽셀이 띠 바로 위·아래보다
  // LINE_DIFF 이상 밝고, 같은 띠가 가로로 RUN 이상 이어짐(세로도 같음). 글자 획·아이콘 무늬는 짧아서 빠짐(글자가 두꺼워지지 않게).
  //   hk[p] = 가로 띠의 맨 위 픽셀이면 그 굵기 k, vk[p] = 세로 띠의 맨 왼쪽 픽셀이면 k, rep[p] = 띠 픽셀을 지울 때 쓸 바깥 바탕 픽셀
  function lineMask(s, W, H) {
    const N = W * H, Lm = new Uint8Array(N);
    for (let p = 0, i = 0; p < N; p++, i += 4) Lm[p] = (s[i] * 77 + s[i + 1] * 151 + s[i + 2] * 28) >> 8;
    const hk = new Uint8Array(N), vk = new Uint8Array(N), rep = new Int32Array(N).fill(-1);
    // 가로 띠: (x, y)가 맨 위, 굵기 k
    const bandH = (x, y, k) => {
      if (y < 1 || y + k >= H) return false;
      const up = Lm[(y - 1) * W + x], dn = Lm[(y + k) * W + x];
      for (let t = 0; t < k; t++) { const v = Lm[(y + t) * W + x]; if (v - up < LINE_DIFF || v - dn < LINE_DIFF) return false; }
      return true;
    };
    const bandV = (x, y, k) => {
      if (x < 1 || x + k >= W) return false;
      const lf = Lm[y * W + x - 1], rt = Lm[y * W + x + k];
      for (let t = 0; t < k; t++) { const v = Lm[y * W + x + t]; if (v - lf < LINE_DIFF || v - rt < LINE_DIFF) return false; }
      return true;
    };
    for (let k = 1; k <= MAXK; k++) {
      for (let y = 1; y + k < H; y++) {
        let run = 0;
        for (let x = 0; x <= W; x++) {
          if (x < W && !hk[y * W + x] && bandH(x, y, k)) { run++; continue; }
          if (run >= RUN) for (let q = x - run; q < x; q++) {
            hk[y * W + q] = k;
            for (let t = 0; t < k; t++) rep[(y + t) * W + q] = (y - 1) * W + q;
          }
          run = 0;
        }
      }
      for (let x = 1; x + k < W; x++) {
        let run = 0;
        for (let y = 0; y <= H; y++) {
          if (y < H && !vk[y * W + x] && bandV(x, y, k)) { run++; continue; }
          if (run >= RUN) for (let q = y - run; q < y; q++) {
            vk[q * W + x] = k;
            for (let t = 0; t < k; t++) if (rep[q * W + x + t] < 0) rep[q * W + x + t] = q * W + x - 1;
          }
          run = 0;
        }
      }
    }
    return { hk, vk, rep };
  }

  function lineKeep(img, w, h) {
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const s = cx.getImageData(0, 0, W, H).data;              // 다른 출처 그림이면 여기서 예외 → 건너뜀
    const { hk, vk, rep } = lineMask(s, W, H);
    const out = new ImageData(w, h), o = out.data;
    // ① 바탕: 선 픽셀을 선 바로 바깥(가로 선은 위, 세로 선은 왼쪽) 바탕 색으로 바꾼 그림을 면적 평균으로 줄이거나 늘림
    const base = new Uint8ClampedArray(s);
    for (let p = 0; p < W * H; p++) {
      const q = rep[p]; if (q < 0) continue;
      const i = p * 4, j = q * 4; base[i] = s[j]; base[i + 1] = s[j + 1]; base[i + 2] = s[j + 2]; base[i + 3] = s[j + 3];
    }
    const axis = (N, n) => {                                   // 화면 칸 하나가 덮는 원본 픽셀과 그 비율
      const st = new Int32Array(n), cnt = new Int32Array(n), wt = [];
      for (let k = 0; k < n; k++) {
        const a0 = k * N / n, a1 = (k + 1) * N / n; st[k] = Math.floor(a0); let c = 0;
        for (let q = st[k]; q < Math.min(N, Math.ceil(a1)); q++, c++) wt.push(Math.min(a1, q + 1) - Math.max(a0, q));
        cnt[k] = c;
      }
      const off = new Int32Array(n); for (let k = 1; k < n; k++) off[k] = off[k - 1] + cnt[k - 1];
      return { st, cnt, off, wt: Float32Array.from(wt) };
    };
    const AX = axis(W, w), AY = axis(H, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, bl = 0, a = 0, ws = 0;
        for (let iy = 0; iy < AY.cnt[y]; iy++) {
          const wy = AY.wt[AY.off[y] + iy], row = (AY.st[y] + iy) * W;
          for (let ix = 0; ix < AX.cnt[x]; ix++) {
            const ww = wy * AX.wt[AX.off[x] + ix], i = (row + AX.st[x] + ix) * 4;
            r += base[i] * ww; g += base[i + 1] * ww; bl += base[i + 2] * ww; a += base[i + 3] * ww; ws += ww;
          }
        }
        const j = (y * w + x) * 4;
        o[j] = r / ws; o[j + 1] = g / ws; o[j + 2] = bl / ws; o[j + 3] = a / ws;
      }
    }
    // ② 선: 굵기 k인 원본 선은 화면에서 n = max(1, round(k × 배율)) 줄로, 선 가운데에 맞춰 같은 굵기로 다시 그림
    //    (늘릴 때 위치에 따라 1·2·3px로 달라지거나, 줄일 때 사라지지 않게)
    const lineL = new Float32Array(w * h).fill(-1), lineC = new Uint8ClampedArray(w * h * 3);
    const fx = w / W, fy = h / H;
    const put = (X, Y, i) => {
      if (X < 0 || Y < 0 || X >= w || Y >= h) return;
      const q = Y * w + X, L = s[i] * 0.3 + s[i + 1] * 0.59 + s[i + 2] * 0.11;
      if (L > lineL[q]) { lineL[q] = L; lineC[q * 3] = s[i]; lineC[q * 3 + 1] = s[i + 1]; lineC[q * 3 + 2] = s[i + 2]; }
    };
    const brightest = (p, k, step) => {                       // 띠 안에서 가장 밝은 픽셀(선 색)
      let best = p * 4, bl = -1;
      for (let t = 0; t < k; t++) { const i = (p + t * step) * 4, L = s[i] * 0.3 + s[i + 1] * 0.59 + s[i + 2] * 0.11; if (L > bl) { bl = L; best = i; } }
      return best;
    };
    for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
      const p = sy * W + sx;
      const kh = hk[p];
      if (kh) {                                               // 가로 선: n줄, 가로로는 빈틈 없이
        const n = Math.max(1, Math.round(kh * fy)), Y0 = Math.round((sy + kh / 2) * fy - n / 2);
        const X0 = Math.floor(sx * fx), X1 = Math.max(X0 + 1, Math.floor((sx + 1) * fx)), i = brightest(p, kh, W);
        for (let Y = Y0; Y < Y0 + n; Y++) for (let X = X0; X < X1; X++) put(X, Y, i);
      }
      const kv = vk[p];
      if (kv) {                                               // 세로 선: n열, 세로로는 빈틈 없이
        const n = Math.max(1, Math.round(kv * fx)), X0 = Math.round((sx + kv / 2) * fx - n / 2);
        const Y0 = Math.floor(sy * fy), Y1 = Math.max(Y0 + 1, Math.floor((sy + 1) * fy)), i = brightest(p, kv, 1);
        for (let X = X0; X < X0 + n; X++) for (let Y = Y0; Y < Y1; Y++) put(X, Y, i);
      }
    }
    const k = fx >= 1 ? 1 : K;                                // 늘릴 때는 선 그대로, 줄일 때는 K만큼(바탕과 조금 섞어 튀지 않게)
    for (let q = 0; q < w * h; q++) {
      if (lineL[q] < 0) continue;
      const j = q * 4, bL = o[j] * 0.3 + o[j + 1] * 0.59 + o[j + 2] * 0.11;
      if (lineL[q] <= bL) continue;
      o[j] += (lineC[q * 3] - o[j]) * k; o[j + 1] += (lineC[q * 3 + 1] - o[j + 1]) * k; o[j + 2] += (lineC[q * 3 + 2] - o[j + 2]) * k;
    }
    const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
    oc.getContext('2d').putImageData(out, 0, 0);
    return new Promise((res) => oc.toBlob(res));
  }

  async function processOne(img) {
    if (!img.isConnected || skip(img)) { clear(img); stats.skipped++; return; }
    if (!img.complete || !img.naturalWidth) return;          // load 이벤트에서 다시
    const box = drawBox(img);
    if (!box) { clear(img); return; }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(box.w * dpr), h = Math.round(box.h * dpr);
    if (w < 2 || h < 2) return;
    if (Math.abs(w / img.naturalWidth - 1) < SAME_SCALE) { clear(img); return; }   // 원래 크기 그대로 그려지면 손대지 않음(줄일 때도 늘릴 때도 처리 — Retina에서는 대개 늘림)
    const key = `${img.currentSrc || img.src}|${w}x${h}`;
    const s = state.get(img);
    if (s && s.key === key) return;
    const t0 = performance.now();
    try {
      const blob = await lineKeep(img, w, h);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      if (s && s.url) URL.revokeObjectURL(s.url);
      state.set(img, { key, url });
      img.style.setProperty('--pf-lk', `url("${url}")`);
      img.setAttribute('data-pf-lk', '');
      stats.done++; stats.ms += performance.now() - t0;
    } catch (e) { stats.errors++; clear(img); if (window.console) console.warn('[img-linekeep]', img.currentSrc || img.src, e); }
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      while (queue.size) {
        const img = queue.values().next().value; queue.delete(img);
        await processOne(img);
        await new Promise((r) => setTimeout(r, 0));          // 한 장씩 — 화면이 멈추지 않게
      }
    } finally { running = false; }
  }

  function schedule(img) { queue.add(img); clearTimeout(timer); timer = setTimeout(run, 120); }

  // 화면 근처에 들어온 그림만 처리(멀리 있는 그림은 들어올 때)
  const visible = new WeakSet();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { visible.add(e.target); schedule(e.target); } else visible.delete(e.target);
  }), { rootMargin: '100% 0px' });
  const ro = new ResizeObserver((es) => es.forEach((e) => { if (visible.has(e.target)) schedule(e.target); }));
  const watched = new WeakSet();

  function watch(img) {
    if (watched.has(img)) return;
    watched.add(img);
    io.observe(img); ro.observe(img);
    img.addEventListener('load', () => { state.delete(img); if (visible.has(img)) schedule(img); });
  }
  function scan(root) {
    if (root.tagName === 'IMG') watch(root);
    else if (root.querySelectorAll) root.querySelectorAll('img').forEach(watch);
  }

  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n))))
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scan(document.body));
  else scan(document.body);

  // 화면 배율이 바뀌면(다른 모니터로 옮김·브라우저 확대) 다시
  (function dprWatch() {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener('change', () => { document.querySelectorAll('img').forEach((i) => visible.has(i) && schedule(i)); dprWatch(); }, { once: true });
  })();

  window.PFLineKeep = {
    refresh() { document.querySelectorAll('img').forEach((i) => { state.delete(i); if (visible.has(i)) schedule(i); }); },
    report() {
      const imgs = [...document.querySelectorAll('img[data-pf-lk]')];
      return { applied: imgs.length, done: stats.done, skipped: stats.skipped, errors: stats.errors, avgMs: stats.done ? Math.round(stats.ms / stats.done) : 0, pending: queue.size + (running ? 1 : 0) };
    },
  };
})();
