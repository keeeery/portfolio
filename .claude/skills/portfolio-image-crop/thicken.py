"""얇은 밝은 선(1px, 길이 RUN 이상)만 아래·오른쪽으로 1px 굵게 — 표준 라이브러리만.
  python3 -I thicken.py <in.png> <out.png> [RUN=20] [DIFF=60]
가로 선 픽셀: 위·아래 픽셀보다 DIFF 이상 밝고, 같은 조건 픽셀이 가로로 RUN 이상 이어짐 → 바로 아래 픽셀을 max로.
세로 선 픽셀: 왼쪽·오른쪽보다 DIFF 이상 밝고, 세로로 RUN 이상 이어짐 → 바로 오른쪽 픽셀을 max로.
"""
import sys, struct, zlib, importlib.util

spec = importlib.util.spec_from_file_location('m', __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'measure.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

src, dst = sys.argv[1], sys.argv[2]
RUN = int(sys.argv[3]) if len(sys.argv) > 3 else 20
DIFF = int(sys.argv[4]) if len(sys.argv) > 4 else 60
w, h, ch, rows = m.load(src)
L = [[(r[x*ch]*30 + r[x*ch+1]*59 + r[x*ch+2]*11)//100 for x in range(w)] for r in rows]

hz = [[False]*w for _ in range(h)]
vt = [[False]*w for _ in range(h)]
for y in range(1, h-1):
    a, b, c = L[y-1], L[y], L[y+1]
    for x in range(1, w-1):
        v = b[x]
        if v - a[x] >= DIFF and v - c[x] >= DIFF: hz[y][x] = True
        if v - b[x-1] >= DIFF and v - b[x+1] >= DIFF: vt[y][x] = True

def keep_runs_h(mask):
    for y in range(h):
        row = mask[y]; x = 0
        while x < w:
            if row[x]:
                s = x
                while x < w and row[x]: x += 1
                if x - s < RUN:
                    for k in range(s, x): row[k] = False
            else: x += 1

def keep_runs_v(mask):
    for x in range(w):
        y = 0
        while y < h:
            if mask[y][x]:
                s = y
                while y < h and mask[y][x]: y += 1
                if y - s < RUN:
                    for k in range(s, y): mask[k][x] = False
            else: y += 1

keep_runs_h(hz); keep_runs_v(vt)
out = [bytearray(r) for r in rows]
n = 0
for y in range(h):
    for x in range(w):
        if hz[y][x] and y + 1 < h:
            for c in range(3):
                out[y+1][x*ch+c] = max(out[y+1][x*ch+c], rows[y][x*ch+c])
            n += 1
        if vt[y][x] and x + 1 < w:
            for c in range(3):
                out[y][(x+1)*ch+c] = max(out[y][(x+1)*ch+c], rows[y][x*ch+c])
            n += 1

ct = 2 if ch == 3 else 6
raw = b''.join(b'\x00' + bytes(r) for r in out)
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, ct, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
open(dst, 'wb').write(png)
print(f'{dst}: 굵힌 픽셀 {n}')
