# 슬라이드 장면 규칙 (theme/deck-rules.md)

ODDITY 슬라이드를 장면마다 손보며 정한 판단을 다른 프로젝트에도 같은 기준으로 걸 수 있게 모은 것입니다(2026-11-26 확정).
`/portfolio-edit`로 장면을 고치거나 새 프로젝트 슬라이드를 다듬을 때 이 순서로 봅니다.

- **자동** — 렌더러(`assets/project-deck.js`)와 테마 공통 규칙(`theme/deck-keynote.css` ㉖)이 모든 프로젝트에 이미 겁니다. 할 일 없음.
- **골라서** — 장면마다 판단해 장면 카드로 확인받은 뒤 겁니다. 배치·크기는 `theme/deck-keynote.css`의 `#d-<장면>` 규칙(프로젝트 이름 주석),
  **장면 id(d-arch·d-what 등)는 프로젝트마다 겹치므로 ODDITY 밖 프로젝트는 `[data-pf-project="<폴더>"] #d-<장면>`로 그 프로젝트에만 겁니다**(렌더러가 `<html data-pf-project>`를 붙임),
  카드 합치기·라벨·시각 자료 고르기는 `deck-edits.py pin` → `src/<폴더>/deck-edits.json`.
- 카드 글은 원문 그대로이거나 줄이고 합친 것(`verbatim: false` → report.md 「확인해 주세요」)만. 원문에 없는 사실은 넣지 않습니다.
- 렌더러 수정은 `/portfolio-update` 뒤 다시 확인 대상입니다(기억 파일 `slide-*`).

## 1. 자동 규칙

| # | 조건 | 결과 | 거는 곳 | ODDITY 예 |
|---|---|---|---|---|
| R1 | 장면의 요점 카드가 1장 | 모든 배치에서 번호 없음(`.ncard.nonum`) | `project-deck.js` `ncards` | debris-material·boss-finish |
| R2 | 카드가 1장이고 종류 라벨이 있음 | 라벨을 뺌(「선택」 장면이어도) | `ncards` `kindOff` | reward-link |
| R3 | 종류 라벨(기능·구현·이유·문제·원인·해결·결과·배운 점·비용, `KIND_LB`)이 「선택」(tab `선택`)이 아닌 장면에 있음 | 라벨을 화면에서 뺌(data·원문은 그대로). 문제 해결 장면(layout `problem`)의 단계 라벨은 그대로 | `ncards` `keepKind` | 구현·흐름 장면 전부 |
| R4 | 라벨이 「AI 활용」(AI와 함께 한 일을 말하는 카드에는 이 라벨을 닮) | **배너 + 디밍** — 라벨 칸 #D97757·흰 글자 + 카드 바탕 주황 16% | 렌더러가 카드에 `data-lb` → ㉖ | psy-damage·ui-tools |
| R5 | 가로 카드 줄(`.cards.row`)에 라벨이 있음 | 번호 대신 카드 왼쪽 라벨 칸(회색, 13px·700·양옆 10px). 이유·결과 = `--accent-fill` 칸 + `--accent-soft` 바탕, 비용·단점 = #D9534F 칸 + 16% 바탕, 한계 = #6E6E73 칸 + 16% 바탕(제목형 라벨 칸 .num.tl에도) | ㉖ (`--tl-w`로 장면마다 칸 폭 맞춤 가능) | debris-choice·time-choice·shake-choice·psy-damage·(Folk Sack) render-choice·broadcast-order |
| R6 | 카드 글에 `\n`(합친 카드) | 화면에서도 줄바꿈(`pre-line`) | ㉖ | psy-restore·local-time |
| R18 | 화면 장면(layout `screens`) | 「FEATURE 01」 칸을 쓰지 않음 — 그림은 위에 나란히, 설명은 아래 카드 줄(번호 없음, 카드 줄 폭 = 그림 줄 폭) | `bodyHtml` screens 분기 + ㉖ `.scr-cards` | Folk Sack lobby-screens |
| — | 서로 다른 제목형 라벨이 2장 이상 | 번호 대신 라벨 칸(`.cards.titled`) | `titledPts` (예전부터) | overview-systems·telegraph |
| — | 문제 해결 장면 | 해결 칸 `--accent-soft`, 결과 칸 초록 16% | ⑧·㉕ (예전부터) | death-flash |
| — | 카드 수 | 4장까지 | `deck-edits.py` 검사 | — |

## 2. 골라서 거는 규칙

### 배치 (테마 ㉕ `#d-<장면>`)

| # | 조건 | 할 일 | 손잡이 | ODDITY 예 |
|---|---|---|---|---|
| R9 | 4:3 이미지 1개 + 카드 n장 | 왼쪽 이미지 539×404px, 오른쪽 카드 칸 462px. **`side`만 넣고 끝내지 않음** — 재서 확인 | `--pf-layout: side; --pf-vis-scale:` 캡션 한 줄 ≈ .912, 두 줄 ≈ .95 | psy-aim·psy-hold-lag·ui-tools·telegraph |
| R10 | 시각 자료 2개 + 카드 3장 이하 | 위 두 칸(같은 높이), 카드는 아래 줄. 세로로 긴 다이어그램 + 이미지면 카드가 좁아져 넘칠 수 있으니 재서 확인(Arcanist golem-fsm은 기본 배치) | `--pf-layout: quad` | crosshair·boss-finish |
| R11 | 이미지 + 코드 + 카드 | 코드가 길면 왼쪽 이미지·오른쪽 카드 위/코드 아래, 코드가 짧고 넓으면 2×2 — 둘 다 그려 비교, 둘 다 나쁘면(이미지가 작아지거나 넘침) 기본 배치. **quad에 코드가 들어가면 코드 칸이 넘치는 일이 잦음**(Folk map-contract·Arcanist reward-draw — 둘 다 기본 배치) | `side-split` / `quad` | psy-follow·psy-throw·local-time / camera-shake |
| R12 | 시각 자료 3개 + 카드 | 위 줄 세 칸 같은 높이, 카드 아래 줄 | `--pf-layout: row3` | boss-occlusion |
| R13 | 이미지 2개 + 카드 1장 | 이미지 나란히 위, 카드 아래(카드 폭 = 이미지 줄 폭) | `--pf-layout: stack; --pf-arr: row` + ㉕의 psy-hold-aim 선택자 목록에 id 추가 | psy-hold-aim·freeze-except |

### 카드 (pin 또는 테마)

| # | 조건 | 할 일 | 거는 방법 | ODDITY 예 |
|---|---|---|---|---|
| R7 | 앞 카드를 이어 말하는 카드(「이 ~는」으로 시작, 짝이 되는 짧은 문장) | 앞 카드와 합침(`\n`으로 이음). 요약 카드는 세부 카드보다 앞 | pin, `verbatim: false` | psy-restore·local-time·debris-life |
| R8 | 차례·대등 목록이 아닌 카드(소개 문단, 종류가 다른 두 이야기, 요약 → 세부) | 번호 없음 | 테마 `--pf-cards: plain` | overview·time-overview·local-time·psy-hold-lag |
| R5' | 「선택」 장면의 카드에 라벨이 비어 있음 | 이유·비용·결과 등 종류 라벨을 달아 R5 색이 걸리게 | pin `label`(→ 확인해 주세요) | debris-choice |

### 문제 해결·글

| # | 조건 | 할 일 | 거는 방법 | ODDITY 예 |
|---|---|---|---|---|
| R14 | 문제 해결(트러블슈팅) 장면 | **결과 카드는 반드시**(사용자 지시). 카드는 증상·원인·해결·결과(또는 문제·해결·결과·배운 점) — 4장을 넘으면 배운 점부터 슬라이드에서 뺌. 문제가 둘이면 문제·해결을 각각 한 장으로 묶어 4장 안에. 원문에 결과 문장이 없으면 프로젝트 문서의 어느 절에 무엇이 빠졌는지 알려 드림(대신 쓰지 않음) | pin | death-flash·body-overlap |
| R15 | 문제 해결 장면의 시각 자료 | 판단 흐름 다이어그램보다 상황이 보이는 이미지가 원문에 있으면 이미지 | pin `visuals` | body-overlap |
| R16 | 제목 아래 줄(lead)과 카드에 같은 문장 | 한쪽에서 뺌 | pin | — |
| R17 | 캡션이 두 줄 넘게 꺾임 | 앞부분만 | pin `caption`, `verbatim: false` | — |
| — | 본문의 (§n) 괄호 | 화면에서 뺌 | 렌더러 자동(`stripSecRefs`) | — |

## 3. ODDITY 전용(다른 장면에 옮기지 않음)
표 열·코드 칸 px 폭(shake-choice·player-scope·death-flash·boss-intent·crosshair), `--tl-w` 값, telegraph의 두 줄 라벨,
debris-material 블록, psy-control·debris-life의 다이어그램 크기 비율, ui-tools-table의 「AI / 내 판단」 칩.

## 4. 적용 순서(프로젝트 하나씩)
1. `project.html?p=<폴더>`에서 `await PFScene.whenReady(); PFScene.report()` — 장면 목록·audit·notes
2. 장면마다 위 「골라서」 규칙에 걸리는 것을 장면 카드로 한 번에 보여 주고 확인받음
3. `deck-edits.py pin/hide`, 테마 ㉕에 `#d-<장면>` 규칙(프로젝트 이름 주석)
4. `deck-edits.py apply --all` → `portfolio-edits.py apply --all`
5. audit 0건, 바뀐 장면 캡처, 「확인해 주세요」 줄은 report.md에
