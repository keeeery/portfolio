#!/usr/bin/env python3
"""자기소개서 전문 페이지(letter.html)를 A4 PDF로 만들어 레포 맨 위에 <이름>-자기소개서.pdf로 저장합니다(직접 추가한 도구).
letter.html의 [PDF] 버튼이 이 파일을 엽니다. 자기소개서.md를 고친 뒤 다시 실행하면 PDF도 새로 만들어집니다.

    python3 tools/make-letter-pdf.py                 # 만들기 (Windows: py -3 tools/make-letter-pdf.py)
    python3 tools/make-letter-pdf.py --out 미리.pdf  # 다른 곳에 미리 만들어 보기(레포의 파일은 그대로)

인쇄 모양은 assets/doc.css의 인쇄 규칙(흰 종이 · A4 · 머리 막대·목차 숨김)을 그대로 씁니다.
Chrome 찾기·로컬 서버·Chrome 원격 제어는 tools/make-pdf.py의 것을 빌려 씁니다(mac·Windows 모두).
"""
import argparse
import base64
import importlib.util
import json
import os
import shutil
import sys
import tempfile
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("make_pdf", os.path.join(HERE, "make-pdf.py"))
mp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mp)
ROOT = mp.ROOT

WAIT_JS = r"""(async () => {
  const t = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 300 && document.documentElement.dataset.docReady !== '1'; i++) await t(100);
  if (document.fonts) await Promise.race([document.fonts.ready, t(5000)]);
  await t(500);
  const r = window.PFLetter ? PFLetter.report() : {};
  return JSON.stringify({ ready: document.documentElement.dataset.docReady === '1', sections: document.querySelectorAll('#doc h2').length, title: document.title });
})()"""


def letter_name():
    name = ""
    try:
        with open(os.path.join(ROOT, "data", "portfolio.json"), encoding="utf-8") as f:
            name = str((json.load(f).get("profile") or {}).get("name") or "").strip()
    except Exception:
        pass
    name = "".join(c for c in name if c not in '\\/:*?"<>|')
    return unicodedata.normalize("NFC", f"{name}-자기소개서.pdf" if name else "자기소개서.pdf")


def main():
    ap = argparse.ArgumentParser(description="자기소개서 페이지를 A4 PDF로")
    ap.add_argument("--out", help="저장할 곳(없으면 레포 맨 위 <이름>-자기소개서.pdf)")
    ap.add_argument("--chrome", help="Chrome 실행 파일 경로(없으면 찾아봄)")
    args = ap.parse_args()

    chrome = mp.find_chrome(args.chrome)
    if not chrome:
        sys.exit("Chrome(또는 Chromium·Edge)을 찾지 못했습니다. --chrome으로 경로를 알려 주세요.")
    out = args.out or os.path.join(ROOT, letter_name())
    server = mp.serve(ROOT)
    url = f"http://127.0.0.1:{server.server_address[1]}/letter.html"
    profile = tempfile.mkdtemp(prefix="pf-letter-")
    cdp = mp.open_cdp("ws" if mp.IS_WIN else "pipe", chrome, profile, 1280)
    try:
        sid = mp.new_tab(cdp, 1280)
        cdp.send("Page.navigate", {"url": url}, sid)
        info = json.loads(cdp.eval(sid, WAIT_JS))
        if not info["ready"]:
            sys.exit("페이지가 준비되지 않았습니다(자기소개서.md를 읽지 못했을 수 있음).")
        cdp.send("Emulation.setEmulatedMedia", {"media": "print"}, sid)
        pdf = cdp.send("Page.printToPDF", {"printBackground": True, "preferCSSPageSize": True,
                                           "displayHeaderFooter": False, "generateTaggedPDF": True}, sid)
    finally:
        cdp.close()
        server.shutdown()
        shutil.rmtree(profile, ignore_errors=True)
    with open(out, "wb") as f:
        f.write(base64.b64decode(pdf["data"]))
    facts = mp.pdf_facts(out)
    print(f"만들었습니다: {os.path.relpath(out, ROOT) if out.startswith(ROOT) else out} — {facts['pages']}쪽, {facts['mb']} MB, 절 {info['sections']}개")
    if facts["local_links"]:
        print("주의: localhost 링크가 남아 있습니다:", ", ".join(facts["local_links"]))


if __name__ == "__main__":
    main()
