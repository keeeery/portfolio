"""PNG 픽셀 위치 재기 (Pillow 없이 파이썬 표준 라이브러리만) — /portfolio-image-crop 도구

  python3 -I measure.py size  <png>
  python3 -I measure.py bbox  <png> "<조건>" [x0,y0,x1,y1]

조건은 r, g, b(0~255)로 쓰는 파이썬 식입니다. 조건에 맞는 픽셀이 모인 사각형(x0 y0 x1 y1)과 가운데 점을 알려 줍니다.
  흰 글자    "r>235 and g>235 and b>235"
  노란색     "r>220 and g>180 and b<90"
  주황 나무  "r>190 and 100<g<200 and b<90"
  빨간색     "r>200 and g<80 and b<80"
영역(x0,y0,x1,y1)을 주면 그 안만 봅니다(넓은 이미지는 영역을 좁혀야 빠름).
8비트 RGB·RGBA, 인터레이스 없는 PNG만 읽습니다. 못 읽으면 sips로 PNG를 다시 저장하거나 눈으로 어림합니다.
"""
import struct
import sys
import zlib


def load(path):
    d = open(path, 'rb').read()
    if d[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'PNG가 아닙니다: {path}')
    i, idat, w = 8, b'', None
    while i < len(d):
        n = struct.unpack('>I', d[i:i + 4])[0]
        t, c = d[i + 4:i + 8], d[i + 8:i + 8 + n]
        if t == b'IHDR':
            w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', c)
            if bd != 8 or il != 0 or ct not in (2, 6):
                raise SystemExit(f'지원하지 않는 PNG 형식(bit={bd}, color={ct}, interlace={il}): {path}')
            ch = 3 if ct == 2 else 4
        elif t == b'IDAT':
            idat += c
        i += 12 + n
    raw = zlib.decompress(idat)
    stride = w * ch
    rows, prev, p = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[p]
        line = bytearray(raw[p + 1:p + 1 + stride])
        p += 1 + stride
        if f == 1:
            for x in range(ch, stride):
                line[x] = (line[x] + line[x - ch]) & 255
        elif f == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif f == 3:
            for x in range(stride):
                line[x] = (line[x] + ((line[x - ch] if x >= ch else 0) + prev[x]) // 2) & 255
        elif f == 4:
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                b = prev[x]
                c2 = prev[x - ch] if x >= ch else 0
                pa, pb, pc = abs(b - c2), abs(a - c2), abs(a + b - 2 * c2)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c2)) & 255
        rows.append(line)
        prev = line
    return w, h, ch, rows


def size(path):
    d = open(path, 'rb').read(32)
    return struct.unpack('>II', d[16:24])


def bbox(img, test, x0=0, y0=0, x1=None, y1=None):
    w, h, ch, rows = img
    x1, y1 = min(x1 or w, w), min(y1 or h, h)
    xs, ys = [], []
    for y in range(y0, y1):
        r = rows[y]
        for x in range(x0, x1):
            k = x * ch
            if test(r[k], r[k + 1], r[k + 2]):
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == 'size':
        print(*size(a[1]))
    elif len(a) >= 3 and a[0] == 'bbox':
        expr = compile(a[2], '<조건>', 'eval')
        test = lambda r, g, b: eval(expr, {}, {'r': r, 'g': g, 'b': b})
        reg = [int(v) for v in a[3].split(',')] if len(a) > 3 else [0, 0, None, None]
        box = bbox(load(a[1]), test, *reg)
        if box:
            print('bbox', *box, 'center', (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 'size', box[2] - box[0] + 1, box[3] - box[1] + 1)
        else:
            print('없음 — 조건이나 영역을 바꿔 보세요')
    else:
        print(__doc__)
