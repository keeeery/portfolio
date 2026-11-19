#!/usr/bin/env python3
"""/portfolio-diagram 도구 — 상세 문서(doc.html)·발표 덱(project.html)에 그려진 Mermaid 그림을 재고 비교합니다.

파이썬 표준 라이브러리 + Chrome(또는 Edge)만 씁니다. mac·Windows·리눅스.
레포 맨 위에서 실행합니다(--root로 바꿀 수 있음). 로컬 서버를 잠깐 띄워 headless Chrome으로 페이지를 엽니다.

  measure  <폴더> <표시 글자> [--save 그림.svg]   그림 하나의 크기·칸·선 글자·겹침(칸끼리·칸과 글자·글자끼리·글자와 묶음 테두리)
  audit    <폴더>                                 발표 덱의 미리보기 배치 점검(PFScene.report().audit)
  compare  <전.svg> <후.svg> <결과.png> [--vertical] [--light] [--title-before 글] [--title-after 글]
                                                  전후를 나란히 그린 비교 이미지
  snapshot <이름> [폴더 ...]                      모든 그림의 선 모양·선 글자 자리를 저장(렌더러를 고치기 전후 비교용)
  diffsnap <이름1> <이름2>                        두 스냅샷에서 선 모양이 달라진 그림
  env                                             찾은 Chrome·파이썬
  list     [폴더 ...]                             기술 문서마다 Mermaid 그림 목록(번호·줄·절·종류·첫 칸) — 전체·한 프로젝트 작업의 차례
  findrepo <폴더>                                 기술 문서에 적힌 GitHub 저장소가 이 PC에 받아져 있는지 찾음(origin 주소로 맞춤)
  fetchrepo <GitHub 주소>                         같은 PC에 없을 때 원격 저장소를 임시 폴더에 얕게 받음(읽기 전용으로 씀)

표시 글자: 그 그림에만 있는 칸 글자(예: "CardRuntimeDeck"). 글자가 들어 있는 첫 그림을 잽니다.
결과 파일은 --out-dir(기본: 시스템 임시 폴더 아래 pf-diagram/)에 둡니다. 레포 안에 만들지 않습니다.
"""
import argparse, functools, html, http.server, json, os, platform, re, shutil, socket, subprocess, sys, tempfile, threading, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(tempfile.gettempdir(), 'pf-diagram')

PROBE = r'''<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" style="width:1300px;height:900px;border:0"></iframe>
<script>
const q = new URLSearchParams(location.search), mode = q.get('mode');
const f = document.getElementById('f');
f.src = '/' + (mode === 'audit' ? 'project.html' : 'doc.html') + '?p=' + encodeURIComponent(q.get('p'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (o) => { document.body.innerHTML = '<pre id="out"></pre>'; document.getElementById('out').textContent = JSON.stringify(o); };
f.onload = async () => {
  const w = f.contentWindow, out = {};
  try {
    for (let i = 0; i < 300 && !(w.PFDoc || w.PFScene); i++) await sleep(100);
    if (mode === 'audit') {
      if (!w.PFScene) throw new Error('발표 덱(PFScene)을 찾지 못했습니다');
      await w.PFScene.whenReady(); out.audit = w.PFScene.report().audit; return done(out);
    }
    for (let i = 0; i < 400 && w.document.documentElement.dataset.docReady !== '1'; i++) await sleep(100);
    await sleep(500);
    out.engine = !!w.eval('typeof PF !== "undefined" && PF.orthoEdges');   // PF는 전역 const라 window 속성이 아님
    const svgs = [...w.document.querySelectorAll('.mmd-screen svg')];
    if (mode === 'snapshot') {
      out.list = svgs.map((s, i) => ({ i, t: (s.querySelector('g.node')?.textContent || '').trim().slice(0, 24),
        d: [...s.querySelectorAll('path[data-points]')].map((p) => p.getAttribute('d')).join('|')
          + '#' + [...s.querySelectorAll('g.edgeLabel')].map((g) => g.getAttribute('transform') || '').join('|') }));   // 선 글자 자리도 비교
      return done(out);
    }
    const mark = q.get('m'), svg = svgs.find((s) => s.textContent.includes(mark));
    if (!svg) throw new Error('표시 글자가 들어 있는 그림이 없습니다: ' + mark);
    const R = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, t: el.textContent.trim().slice(0, 30) }; };
    const nodes = [...svg.querySelectorAll('g.node, g.note')].map(R);
    const labels = [...svg.querySelectorAll('g.edgeLabel')].map(R).filter((r) => r.w > 1 && r.t);
    const clusters = [...svg.querySelectorAll('g.cluster')].map((c) => R(c.querySelector('rect') || c));
    const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const hits = [];
    nodes.forEach((a, i) => nodes.forEach((b, j) => { if (i < j && ov(a, b)) hits.push(['칸-칸', a.t, b.t]); }));
    labels.forEach((l) => nodes.forEach((n) => { if (ov(l, n)) hits.push(['글자-칸', l.t, n.t]); }));
    labels.forEach((a, i) => labels.forEach((b, j) => { if (i < j && ov(a, b)) hits.push(['글자-글자', a.t, b.t]); }));
    labels.forEach((l) => clusters.forEach((c) => {
      const inside = l.x >= c.x && l.y >= c.y && l.x + l.w <= c.x + c.w && l.y + l.h <= c.y + c.h;
      if (ov(l, c) && !inside) hits.push(['글자-묶음테두리', l.t, c.t]);
    }));
    const near = [];                                                       // 겹치지는 않지만 6px 안으로 붙은 글자(답답해 보이는 자리)
    const gapOf = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
    labels.forEach((l) => nodes.forEach((n) => { const g = gapOf(l, n); if (g >= 0 && g < 6) near.push([l.t, n.t, Math.round(g * 10) / 10]); }));
    const sb = svg.getBoundingClientRect(), vb = svg.viewBox?.baseVal;
    const rnd = (o) => ({ ...o, x: Math.round(o.x - sb.left), y: Math.round(o.y - sb.top), w: Math.round(o.w), h: Math.round(o.h) });
    Object.assign(out, { shown: { w: Math.round(sb.width), h: Math.round(sb.height) }, natural: vb ? { w: Math.round(vb.width), h: Math.round(vb.height) } : null,
      scale: vb && vb.width ? Math.round(sb.width / vb.width * 100) / 100 : 1, nodes: nodes.map(rnd), labels: labels.map(rnd), clusters: clusters.map(rnd), hits, near });
    const c = svg.cloneNode(true); c.setAttribute('width', sb.width); c.setAttribute('height', sb.height); c.style.maxWidth = 'none';
    out.svg = c.outerHTML;
  } catch (e) { out.error = String(e && e.message || e); }
  done(out);
};
</script>'''


def find_chrome(explicit=None):
    if explicit:
        return explicit
    cands = []
    sysname = platform.system()
    if sysname == 'Darwin':
        cands = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                 '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                 '/Applications/Chromium.app/Contents/MacOS/Chromium']
    elif sysname == 'Windows':
        for base in [os.environ.get('PROGRAMFILES'), os.environ.get('PROGRAMFILES(X86)'), os.environ.get('LOCALAPPDATA')]:
            if base:
                cands += [os.path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                          os.path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]
    for c in cands:
        if os.path.exists(c):
            return c
    for n in ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'msedge']:
        p = shutil.which(n)
        if p:
            return p
    sys.exit('Chrome(또는 Edge)를 찾지 못했습니다. --chrome "<경로>"로 알려 주세요.')


class Server:
    """레포 맨 위를 그대로 보여 주고, /__tidy/ 아래에 도구용 페이지·임시 파일을 보여 주는 로컬 서버"""
    def __init__(self, root):
        os.makedirs(TMP, exist_ok=True)
        files = {'probe.html': PROBE}

        class H(http.server.SimpleHTTPRequestHandler):
            def translate_path(self, path):
                p = urllib.parse.unquote(path.split('?')[0])
                if p.startswith('/__tidy/'):
                    return os.path.join(TMP, os.path.basename(p))
                return super().translate_path(path)

            def do_GET(self):
                p = self.path.split('?')[0]
                if p.startswith('/__tidy/') and p[8:] in files:
                    body = files[p[8:]].encode('utf-8')
                    self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
                return super().do_GET()

            def end_headers(self):
                self.send_header('Cache-Control', 'no-store'); super().end_headers()

            def log_message(self, *a):
                pass
        s = socket.socket(); s.bind(('127.0.0.1', 0)); self.port = s.getsockname()[1]; s.close()
        self.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', self.port), functools.partial(H, directory=root))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def url(self, path):
        return f'http://127.0.0.1:{self.port}{path}'

    def close(self):
        self.httpd.shutdown()


def chrome_args(chrome, extra):
    prof = os.path.join(TMP, 'chrome-profile')
    return [chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            f'--user-data-dir={prof}', '--hide-scrollbars'] + extra


def dump(chrome, url, budget=40000):
    r = subprocess.run(chrome_args(chrome, ['--window-size=1320,950', f'--virtual-time-budget={budget}', '--dump-dom', url]),
                       capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=240)
    m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, re.S)
    if not m:
        sys.exit('페이지에서 결과를 읽지 못했습니다(시간 초과이거나 페이지 오류). 미리보기 주소가 열리는지 확인해 주세요.')
    return json.loads(html.unescape(m.group(1)))


GH_RE = re.compile(r'https://github\.com/([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+?)(?:\.git)?(?=[/)\s#?"\'>\]]|$)')


def tech_docs(root, folders=None):
    """src/<폴더>/의 기술 문서(.md 하나 — _로 시작하는 폴더·파일 제외)"""
    src = os.path.join(root, 'src')
    if not folders:
        folders = sorted(f for f in os.listdir(src) if os.path.isdir(os.path.join(src, f)) and not f.startswith(('_', '.')))
    else:                                                                  # 앞부분만 맞아도 됨(3-Folk → 2-Folk-Sack). 대소문자 무시
        alls = sorted(f for f in os.listdir(src) if os.path.isdir(os.path.join(src, f)) and not f.startswith(('_', '.')))
        picked = []
        for want in folders:
            hit = [f for f in alls if f == want] or [f for f in alls if f.lower().startswith(want.lower())] or [f for f in alls if want.lower() in f.lower()]
            if not hit:
                sys.exit(f'src/ 아래에 "{want}"에 맞는 폴더가 없습니다: {", ".join(alls)}')
            if len(hit) > 1:
                sys.exit(f'"{want}"에 맞는 폴더가 여럿입니다: {", ".join(hit)}')
            picked.append(hit[0])
        folders = picked
    out = []
    for f in folders:
        d = os.path.join(src, f)
        mds = sorted(x for x in os.listdir(d) if x.lower().endswith('.md') and not x.startswith('_')) if os.path.isdir(d) else []
        if mds:
            out.append((f, os.path.join(d, mds[0])))
    return out


def list_diagrams(path):
    lines = open(path, encoding='utf-8').read().split('\n')
    res, heads, i = [], [], 0
    while i < len(lines):
        m = re.match(r'^(#{1,6})\s+(.*)', lines[i])
        if m:
            lv = len(m.group(1)); heads = [h for h in heads if h[0] < lv] + [(lv, m.group(2).strip())]
        if lines[i].startswith('```mermaid'):
            j = i + 1
            while j < len(lines) and not lines[j].startswith('```'):
                j += 1
            body = lines[i + 1:j]
            kind = next((x.strip() for x in body if x.strip() and not x.strip().startswith('%%')), '')
            node = ''
            for x in body:
                mm = re.search(r'\[\(?"?([^\]"()]+)', x) or re.search(r'state\s+"([^"]+)"', x) or re.search(r'class\s+\w+\["([^"]+)"', x)
                if mm and not x.strip().startswith('%%'):
                    node = re.sub(r'<[^>]+>', ' ', mm.group(1)).strip(); break
            res.append({'번호': len(res) + 1, '줄': i + 1, '절': ' › '.join(h[1] for h in heads[1:]) or (heads[0][1] if heads else ''),
                        '종류': kind.split()[0] if kind else '', '첫 칸': node[:30], '격자': any('%% 격자' in x for x in body)})
            i = j
        i += 1
    return res


def norm_remote(u):
    u = (u or '').strip()
    m = re.match(r'git@github\.com:(.+?)(?:\.git)?$', u) or re.match(r'https?://(?:[^@/]+@)?github\.com/(.+?)(?:\.git)?/?$', u)
    return m.group(1).lower() if m else None


SKIP_DIRS = {'node_modules', 'Library', 'Temp', 'obj', 'Logs', 'AppData', 'Build', 'Builds', 'bin', '.git', 'Packages', 'UserSettings'}


def scan_repos(root):
    """레포 옆 폴더·홈의 흔한 폴더를 두 단계까지 보고 git 저장소 목록(경로, 원격 주소들)"""
    home = os.path.expanduser('~')
    bases = [os.path.dirname(root), os.path.dirname(os.path.dirname(root))] + [os.path.join(home, x) for x in
             ['', 'Documents', 'Desktop', 'Projects', 'projects', 'repos', 'GitHub', 'github', 'Documents/GitHub', 'source/repos', 'Unity', 'Unity Projects', 'Unity Repository', 'dev', 'workspace']]
    stop = {os.path.realpath(home), os.path.realpath(root)}
    seen, repos = set(), []
    def visit(d, depth):
        try:
            real = os.path.realpath(d)
        except OSError:
            return
        if real in seen or not os.path.isdir(d):
            return
        seen.add(real)
        if real not in stop and os.path.exists(os.path.join(d, '.git')):
            try:
                out = subprocess.run(['git', '-C', d, 'remote', '-v'], capture_output=True, text=True, timeout=10).stdout
            except Exception:
                out = ''
            repos.append((d, {k for k in (norm_remote(x.split()[1]) for x in out.splitlines() if len(x.split()) > 1) if k}))
            return
        if depth <= 0:
            return
        try:
            subs = [e.path for e in os.scandir(d) if e.is_dir() and not e.name.startswith(('.', '$')) and e.name not in SKIP_DIRS]
        except OSError:
            return
        for s in subs[:400]:
            visit(s, depth - 1)
    for b in bases:
        visit(b, 2)
    return repos


def code_hits(repo, names, limit=60000):
    """저장소 안에 기술 문서가 말한 소스 파일 이름이 몇 개 있는지(Library 등 빌드 폴더 제외)"""
    got, n = {}, 0
    for dp, dns, fns in os.walk(repo):
        dns[:] = [x for x in dns if x not in SKIP_DIRS and not x.startswith('.')]
        for f in fns:
            n += 1
            if f in names:
                got.setdefault(f, os.path.relpath(os.path.join(dp, f), repo))
        if n > limit:
            break
    return got


def svg_size(s):
    w = re.search(r'\swidth="([\d.]+)', s); h = re.search(r'\sheight="([\d.]+)', s)
    return (float(w.group(1)) if w else 600, float(h.group(1)) if h else 400)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['measure', 'audit', 'compare', 'snapshot', 'diffsnap', 'env', 'list', 'findrepo', 'fetchrepo'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--root', default='.')
    ap.add_argument('--chrome')
    ap.add_argument('--save')
    ap.add_argument('--out-dir', default=TMP)
    ap.add_argument('--vertical', action='store_true')
    ap.add_argument('--light', action='store_true')
    ap.add_argument('--title-before', default='수정 전')
    ap.add_argument('--title-after', default='수정 후')
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    root = os.path.abspath(a.root)
    os.makedirs(a.out_dir, exist_ok=True)

    if a.cmd == 'env':
        print(json.dumps({'python': sys.version.split()[0], 'chrome': find_chrome(a.chrome), 'root': root,
                          'doc.html': os.path.exists(os.path.join(root, 'doc.html')),
                          'diagram-tidy.js': os.path.exists(os.path.join(root, 'assets', 'diagram-tidy.js')), 'tmp': TMP}, ensure_ascii=False, indent=1))
        return

    if a.cmd == 'list':
        print(json.dumps({f: list_diagrams(p) for f, p in tech_docs(root, a.args or None)}, ensure_ascii=False, indent=1))
        return

    if a.cmd == 'findrepo':
        if len(a.args) != 1:
            sys.exit('findrepo <폴더>')
        docs = tech_docs(root, a.args)
        if not docs:
            sys.exit(f'src/{a.args[0]}/에 기술 문서가 없습니다')
        folder, path = docs[0]
        text = open(path, encoding='utf-8').read()
        wanted = {}
        for m in GH_RE.finditer(text):
            k = f'{m.group(1)}/{m.group(2)}'.lower()
            wanted.setdefault(k, f'https://github.com/{m.group(1)}/{m.group(2)}')
        here = norm_remote(subprocess.run(['git', '-C', root, 'config', '--get', 'remote.origin.url'], capture_output=True, text=True).stdout)
        wanted.pop(here, None)                                             # 포트폴리오 레포 자신은 빼고
        names = set(re.findall(r'`?([A-Za-z_][A-Za-z0-9_]*\.(?:cs|py|java|kt|js|ts|cpp|h|shader|hlsl))`?', text))
        local, guess = {}, []
        for d, remotes in scan_repos(root):
            for k in remotes & set(wanted):
                local.setdefault(k, []).append(d)
            if names:
                got = code_hits(d, names)
                if len(got) >= max(2, len(names) // 4):
                    guess.append({'경로': d, '원격': sorted(remotes), '맞은 파일': f'{len(got)}/{len(names)}', '예': sorted(got.values())[:4]})
        guess.sort(key=lambda g: -int(g['맞은 파일'].split('/')[0]))
        code = os.path.join(root, 'src', folder, 'code')
        print(json.dumps({'기술 문서': os.path.relpath(path, root),
                          'src 코드': os.path.relpath(code, root) if os.path.isdir(code) else None,
                          '재료집(_intake)': os.path.relpath(os.path.join(root, 'src', folder, '_intake'), root) if os.path.isdir(os.path.join(root, 'src', folder, '_intake')) else None,
                          '저장소': [{'주소': u, '이 PC(원격 주소가 같음)': local.get(k, [])} for k, u in wanted.items()],
                          '소스 파일 이름으로 찾은 후보': guess[:5],
                          '찾은 소스 파일 이름 수': len(names)}, ensure_ascii=False, indent=1))
        return

    if a.cmd == 'fetchrepo':
        if len(a.args) != 1:
            sys.exit('fetchrepo <GitHub 주소>')
        k = norm_remote(a.args[0])
        if not k:
            sys.exit('GitHub 저장소 주소가 아닙니다: ' + a.args[0])
        dest = os.path.join(TMP, 'repos', k.replace('/', '__'))
        if os.path.isdir(os.path.join(dest, '.git')):
            r = subprocess.run(['git', '-C', dest, 'pull', '--quiet', '--ff-only', '--depth', '1'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            r = subprocess.run(['git', 'clone', '--quiet', '--depth', '1', '--single-branch', f'https://github.com/{k}.git', dest], capture_output=True, text=True, encoding='utf-8', errors='replace')
            if r.returncode != 0 and shutil.which('gh'):                    # 비공개 저장소: gh 로그인으로 다시
                r = subprocess.run(['gh', 'repo', 'clone', k, dest, '--', '--quiet', '--depth', '1'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        ok = r.returncode == 0 and os.path.isdir(dest)
        print(json.dumps({'ok': ok, '받은 곳': dest if ok else None, '메시지': (r.stderr or r.stdout).strip()[-400:]}, ensure_ascii=False, indent=1))
        return

    if a.cmd == 'diffsnap':
        if len(a.args) != 2:
            sys.exit('diffsnap <이름1> <이름2>')
        A, B = (json.load(open(os.path.join(a.out_dir, f'snap-{n}.json'), encoding='utf-8')) for n in a.args)
        changed = []
        for p in A:
            for x, y in zip(A[p], B.get(p, [])):
                if x['d'] != y['d']:
                    changed.append({'폴더': p, '번호': x['i'], '첫 칸': x['t']})
            if len(A[p]) != len(B.get(p, [])):
                changed.append({'폴더': p, '그림 수': [len(A[p]), len(B.get(p, []))]})
        print(json.dumps({'달라진 그림': changed, '전체': sum(len(v) for v in A.values())}, ensure_ascii=False, indent=1))
        return

    if a.cmd in ('measure', 'audit') and a.args:                         # 폴더 이름은 앞부분만 적어도 됨
        a.args[0] = tech_docs(root, [a.args[0]])[0][0]
    chrome = find_chrome(a.chrome)
    srv = Server(root)
    try:
        if a.cmd == 'measure':
            if len(a.args) != 2:
                sys.exit('measure <폴더> <표시 글자>')
            d = dump(chrome, srv.url('/__tidy/probe.html?mode=measure&p=' + urllib.parse.quote(a.args[0]) + '&m=' + urllib.parse.quote(a.args[1])))
            s = d.pop('svg', '')
            if s:
                path = a.save or os.path.join(a.out_dir, 'last.svg')
                open(path, 'w', encoding='utf-8').write(s); d['saved'] = path
            print(json.dumps(d, ensure_ascii=False))
        elif a.cmd == 'audit':
            if len(a.args) != 1:
                sys.exit('audit <폴더>')
            print(json.dumps(dump(chrome, srv.url('/__tidy/probe.html?mode=audit&p=' + urllib.parse.quote(a.args[0]))), ensure_ascii=False))
        elif a.cmd == 'snapshot':
            if not a.args:
                sys.exit('snapshot <이름> [폴더 ...]')
            name, folders = a.args[0], a.args[1:]
            if not folders:
                src = os.path.join(root, 'src')
                folders = sorted(f for f in os.listdir(src) if os.path.isdir(os.path.join(src, f)) and not f.startswith(('_', '.')))
            res = {}
            for p in folders:
                d = dump(chrome, srv.url('/__tidy/probe.html?mode=snapshot&p=' + urllib.parse.quote(p)))
                res[p] = d.get('list', [])
            path = os.path.join(a.out_dir, f'snap-{name}.json')
            json.dump(res, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
            print(json.dumps({'saved': path, '그림 수': {k: len(v) for k, v in res.items()}}, ensure_ascii=False))
        elif a.cmd == 'compare':
            if len(a.args) != 3:
                sys.exit('compare <전.svg> <후.svg> <결과.png>')
            b, af = (open(x, encoding='utf-8').read() for x in a.args[:2])
            (bw, bh), (aw, ah) = svg_size(b), svg_size(af)
            pad, gap, head = 24, 32, 48
            if a.vertical:
                W, H = int(max(bw, aw) + pad * 4 + 8), int(bh + ah + head * 2 + pad * 6 + gap)
            else:
                W, H = int(bw + aw + pad * 6 + gap), int(max(bh, ah) + head + pad * 4)
            bg, fg, line = ('#ffffff', '#222', '#ddd') if a.light else ('#16171b', '#eee', '#444')
            page = f'''<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>body{{margin:0;background:{bg};color:{fg};font-family:Pretendard,sans-serif}}.w{{display:flex;flex-direction:{'column' if a.vertical else 'row'};gap:{gap}px;padding:{pad}px;align-items:flex-start}}
.c{{border:1px solid {line};border-radius:12px;padding:16px}}h2{{margin:0 0 12px;font-size:20px}}</style>
<div class="w"><div class="c"><h2>{html.escape(a.title_before)}</h2>{b}</div><div class="c"><h2>{html.escape(a.title_after)}</h2>{af}</div></div>'''
            open(os.path.join(TMP, 'compare.html'), 'w', encoding='utf-8').write(page)
            out = os.path.abspath(a.args[2])
            subprocess.run(chrome_args(chrome, [f'--window-size={W},{H}', '--virtual-time-budget=8000', f'--screenshot={out}', srv.url('/__tidy/compare.html')]),
                           capture_output=True, timeout=120)
            print(json.dumps({'saved': out, 'size': [W, H]}, ensure_ascii=False))
    finally:
        srv.close()


if __name__ == '__main__':
    main()
