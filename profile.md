# 내 정보 (profile.md)

> **이 파일은 여러분이 직접 씁니다.** Claude는 여기에 적힌 사실과 `src/`의 기술 문서만 사용하며,
> 없는 내용을 지어내지 않습니다. 아래 값은 **예시**이니 모두 내 정보로 바꾸세요.
> 비워 둔 항목은 페이지에 표시되지 않습니다.

## 기본 정보

- 이름: 주현진
- 영문 이름: JU HYUNJIN
- 한 줄 정체성: 편한, 인상적인 플레이 경험을 명확한 구조로 만드는 게임 클라이언트 개발자
- 이메일: khinigs@naver.com
- GitHub: https://github.com/keeeery
- 기타 링크: YouTube https://www.youtube.com/@k_eeeery

## 자기소개

> 2~3문장. 어떤 개발자인지, 무엇을 잘하고 싶은지. (Claude가 고쳐 쓰지 않고 그대로 싣습니다)

플레이어에게는 편하고 인상적인 경험을,
개발자에게는 명확해서 편한 구조를 추구하는 개발자입니다.

UI·연출처럼 눈에 띄는 부분부터 입력 타이밍·시인성처럼 사소하지만 완성도를 가르는 디테일까지 챙기고,
왜 그렇게 만들었는지 문서로 설명합니다.

## 기술 스택 메모 (선택)

> 강조하고 싶은 기술을 적어 두세요. Claude가 기술 문서에서 **근거를 찾아** "경험 기반" 문장으로 만듭니다.
> 근거를 찾지 못한 기술은 싣지 않고, 점검 리포트로 알려 줍니다. 비워 두면 문서에서 자동으로 고릅니다.
> 기술 아래에 `- 문장 (프로젝트 이름)`으로 근거를 직접 적으면, 요약하지 않고 그 문장을 그대로 씁니다(기술 문서에 있는 사실인지만 확인).

- Unity
  - Raycast 카드 선택, Sprite 연결선 (사천성)
  - DontDestroyOnLoad로 씬 전환 후 복귀 (Arcanist)
  - 32×32 Chunk Mesh로 지형 표현 (Folk Sack)
  - Rigidbody 물리 기반 염동력 (ODDITY)
- C#
  - BFS로 두 번 꺾임 연결 탐색 (사천성)
  - SortedDictionary로 Batch 순서 보장 (Folk Sack)
  - 객체별 시간 정지와 상태 복원 (ODDITY)
- 데이터 설계 (ScriptableObject · DTO/Def)
  - ScriptableObject로 카드 데이터 정의 (Arcanist)
  - TSV → DTO → 읽기 전용 Def 변환·검증 (Folk Sack)
  - DTO/Def로 임무·보상 데이터 연결 (ODDITY)
- 디자인 패턴
  - Observer로 피해 결과 통지 (Arcanist)
  - 보스 공격 패턴을 상태 컴포넌트로 분리 (Arcanist)
  - 오브젝트 풀로 파편 재사용 (ODDITY)
- 멀티플레이 동기화 (ASP.NET Core WebSocket · 서버 권위)
  - 서버 권위로 채굴·붕괴 결과 확정 (Folk Sack)
  - 방송 큐로 상태 변경과 송신 분리 (Folk Sack)
- URP 렌더링 · Shader Graph
  - Shader Graph 화면 반전 연출 (Arcanist)
  - RendererFeature로 외곽선·가림 실루엣 (ODDITY)

## 페이지 설정

- 구성 방식: project
  <!-- project = 프로젝트 중심 (프로젝트가 여러 개일 때) / stack = 기술 스택 중심 (특정 기술을 강조할 때) · 지금의 덱에는 아직 반영되지 않습니다(장면 순서 고정) -->
- 강조색: #2F6FEB
  <!-- 버튼·링크·태그에 쓰이는 색 하나. 예) #2F6FEB 블루, #0F9D76 그린, #D9480F 오렌지, #7048E8 퍼플 -->
- 프로젝트 순서:
  <!-- 비워 두면 src/ 폴더 이름 순서. 바꾸려면 폴더 이름을 쉼표로: 2-Yggdrasil, 1-action-platformer -->
- 기타 프로젝트: 5-Nutrifit
  <!-- 주력 프로젝트와 따로, "기타 프로젝트" 절에 카드 하나로 짧게 소개할 폴더(쉼표로 여러 개). 기능 소개 쪽 없이 소개만 나오고, 발표 덱·상세 문서는 그대로 열립니다. 비워 두면 그 절이 없습니다 -->

## 기타 프로젝트 (링크만)

> 기술 문서 없이 "기타 프로젝트" 절에 소개와 링크만 있는 작은 카드로 나옵니다. 페이지(index.html)가 이 절을 직접 읽으므로 고친 뒤 새로고침만 하면 됩니다(다시 빌드 필요 없음).
> `### 프로젝트 이름` 아래에 `- 소개:` `- 정보:` `- 기술:`(쉼표로 여러 개) `- 맡은 역할:` `- 링크:` 를 적습니다. 비운 항목은 나오지 않습니다.

### Nako
- 소개: 음식 영양 정보 검색, 운동 소개, 학식 칼로리 확인 기능을 한 앱에 담은 건강 관리 Android 앱
- 정보: 2024.05 — 2024.06 · 4인 팀
- 기술: Android, Java, Retrofit, Firebase Auth
- 맡은 역할: 식품안전나라 영양성분 Open API로 음식을 검색해 열량·탄수화물·단백질·지방을 보여 주는 식단(Diet) 화면
- 링크: https://github.com/juwonleee/3-1-MobileProgramming-Termproject

### 3D Maze Escape Game
- 소개: WebGL 기반 라이브러리 three.js로 그린, 매번 새로 만들어지는 3D 미로를 1인칭으로 탈출하는 웹 게임
- 정보: 2024.11 · 3인 팀
- 기술: JavaScript, three.js, WebGL, localStorage
- 맡은 역할: 게임 구조 정리와 버그 수정, 벽 충돌 개선, 힌트(위에서 보기) 뒤 안개 복원, 종료 화면
- 링크: https://github.com/keeeery/3D-Maze-Game
