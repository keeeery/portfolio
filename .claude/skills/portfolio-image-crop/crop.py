"""4:3으로 자르기 (macOS sips 사용) — /portfolio-image-crop 도구

  python3 -I crop.py <원본> <결과> box    <x> <y> <w>          # 왼쪽 위(x,y)·폭 w, 높이는 w*3/4
  python3 -I crop.py <원본> <결과> center <cx> <cy> <w>        # 가운데 점(cx,cy)·폭 w
  python3 -I crop.py <원본> <결과> fit-h  <cx> <y0> <y1>       # 위아래(y0~y1)를 다 담는 가장 작은 4:3, 가로 가운데 cx

이미지 밖으로 나가면 안쪽으로 밀어 넣고(그래도 크면 줄임), 실제로 자른 범위와 크기를 알려 줍니다.
원본은 건드리지 않습니다. 결과 파일이 이미 있으면 덮어씁니다(이 스킬이 만든 크롭만 결과로 지정할 것).
"""
import os
import subprocess
import sys


def img_size(path):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path], capture_output=True, text=True, check=True).stdout
    vals = [int(l.split(':')[1]) for l in out.splitlines() if 'pixel' in l]
    return vals[0], vals[1]


def fit(W, H, x, y, w):
    w = int(round(w))
    h = int(round(w * 3 / 4))
    if w > W or h > H:                       # 이미지보다 크면 줄임
        s = min(W / w, H / h)
        w, h = int(w * s), int(w * s * 3 / 4)
    x = int(round(min(max(x, 0), W - w)))
    y = int(round(min(max(y, 0), H - h)))
    return x, y, w, h


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) != 6 or a[2] not in ('box', 'center', 'fit-h'):
        raise SystemExit(__doc__)
    src, out, mode = a[0], a[1], a[2]
    p, q, r = (float(v) for v in a[3:6])
    if os.path.abspath(src) == os.path.abspath(out):
        raise SystemExit('원본과 결과가 같은 파일입니다 — 원본은 덮어쓰지 않습니다')
    W, H = img_size(src)
    if mode == 'box':
        x, y, w = p, q, r
    elif mode == 'center':
        x, y, w = p - r / 2, q - r * 3 / 8, r
    else:
        h = r - q + 1
        w = h * 4 / 3
        x, y = p - w / 2, q
    x, y, w, h = fit(W, H, x, y, w)
    subprocess.run(['sips', '-c', str(h), str(w), '--cropOffset', str(y), str(x), src, '--out', out], capture_output=True, check=True)
    ow, oh = img_size(out)
    print(f'{out}  {ow}x{oh}  (원본 {W}x{H}에서 x={x} y={y} w={w} h={h})')
