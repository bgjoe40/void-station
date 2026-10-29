# VOID STATION

버려진 우주 정거장을 무대로 한 쿼터뷰 액션 RPG 슈터입니다. 디아블로처럼 장비를 모으고, 둠처럼 쏘고 벱니다.
HTML5 캔버스와 순수 자바스크립트로 만들었고, 설치 없이 브라우저에서 바로 실행됩니다.

**▶ 플레이: https://bgjoe40.github.io/void-station/**

## 게임 소개

- 격납고에서 코어까지 9개 구역으로 이어진 정거장 — 시드로 만든 하나의 큰 필드(160×160칸)를 걸어서 내려갑니다.
- 구역마다 보스와 고유 정예, 임무(생존자 구출 · 해킹 · 둥지 파괴), 돌발 상황(정전 · 독가스 누출 · 선체 파손)이 있습니다.
- 마지막 구역의 오버마인드를 쓰러뜨리고 탈출정으로 빠져나가면 끝납니다.

## 주요 기능

- **무기 44종** — 근접 · 권총 · 샷건 · 라이플 · 기관총 · 에너지. 등급과 무작위 옵션이 붙어 나오고, 무기 파츠 25종으로 꾸밉니다.
- **장비 파밍** — 인체 모양 장비 칸(머리 · 몸통 · 왼팔 · 오른팔 · 다리, 강화칩 · 강화장신구), 고유 전설 11종, 장비 개조
- **스킬 쉘 20종** — 스킬 칸(Z X V B)에 끼워 쓰고, 레벨이 오를수록 위력이 커짐 (고유 전설 쉘 20종)
- **근접 전투** — 근접으로 처치하면 체력·탄약 보급, 적 탄 쳐내기, 장갑 무시, 돌진·주문 같은 준비 동작 끊기
- **보급 거점** — 상점(사기 · 팔기) · 개조(장비 개조 · 파츠 · 분해) · 보관함 · 저장, 거점끼리 순간이동
- **즐길 거리** — 보물 약탈자, 막 보스 처치로 무기 슬롯 2칸 → 4칸, 데이터 기록 18개, 업적 13개
- 저장 슬롯 3개, 난이도 3단계(쉬움 · 보통 · 어려움), 음량·화면 흔들림·피해 숫자 등 설정

## 조작

| 키 | 동작 |
|---|---|
| W A S D (방향키) | 이동 |
| 마우스 | 조준 — 조준한 쪽의 가장 가까운 적을 자동 조준 |
| 좌클릭 | 공격 · 사격 (자동화기와 근접 무기는 누르고 있기) |
| 우클릭 / G | 수류탄 던지기 / 수류탄 종류 바꾸기 |
| R | 재장전 |
| Shift / Space | 달리기 / 회피 대시 |
| 1 ~ 4, 마우스 휠 | 무기 슬롯 |
| Q E T | 메디킷 · 치료제 · 아드레날린 |
| Z X V B | 스킬 |
| F | 줍기 · 사용 (자판기 · 단말기 · 보물함) |
| I (Tab) / K / J / M | 인벤토리 (장비) / 스킬 (장착 스킬 · 특성) / 수집 도감 / 전체 지도 |
| Esc | 일시정지 |

## 직접 실행하기

`index.html`을 파일로 바로 열면 브라우저 보안 때문에 스크립트가 동작하지 않습니다. 로컬 서버로 여세요.

```bash
python tools/serve.py 8123
```

그다음 http://localhost:8123 에 접속합니다. (캐시를 끈 개발용 서버이며, `python -m http.server`로도 됩니다.)

## 데스크톱 판 (Windows, Electron)

브라우저 판과 같은 게임을 창으로 실행합니다. 저장은 브라우저 판과 따로 쌓입니다. F11 또는 Alt+Enter로 전체 화면.

```bash
npm install
npm start
npm run dist
```

`npm start`는 바로 실행, `npm run dist`는 `dist/`에 실행 파일 폴더(`Void Station-win32-x64/VoidStation.exe`)와 배포용 zip을 만듭니다.

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `index.html` | 화면 틀, 메뉴 스타일, 스크립트 로더 |
| `data.js` | 무기 · 적 · 스킬 · 구역 등 게임 데이터 |
| `game.js` | 게임 루프, 전투, 필드 생성, 렌더링 |
| `menu.js` | 타이틀 · 설정 · 저장 · 도움말 메뉴 화면 |
| `assets/` | 그래픽 아틀라스, 텍스처, 효과음, 배경음악 (스크립트로 생성) |
| `tools/build_assets.py` | 원본 에셋을 내려받아 `assets/`를 만드는 스크립트 |
| `tools/serve.py` | 개발용 로컬 서버 |
| `electron/` | 데스크톱 판: `main.js` (게임 폴더를 `app://` 주소로 엶), `build.js` (Windows 실행 파일 만들기) |

에셋을 다시 만들려면 Pillow를 설치하고(`pip install pillow`) `python tools/build_assets.py`를 실행합니다. 원본은 처음 한 번 내려받아 `tools/.cache/`에 보관합니다.

## 사용한 에셋과 라이선스

- [Freedoom](https://github.com/freedoom/freedoom) (BSD-3-Clause) — 스프라이트, 벽·바닥 텍스처, 효과음, 배경음악 · 라이선스 전문: [`assets/LICENSE-freedoom.txt`](assets/LICENSE-freedoom.txt)
- knekko, [Futuristic Guns, Weapons and Items](https://opengameart.org/content/futuristic-guns-weapons-and-items) (CC0) — 무기 · 장비 아이콘
- knekko, [Cybericons](https://opengameart.org/content/cybericons) · [Microchips](https://opengameart.org/content/microchips-cpus-ics) (CC0) — 팔 장비 · 강화칩 · 강화장신구 아이콘
- [Project Cordon Sprites](https://github.com/doficia/project-cordon-sprites) (CC0) — 헬멧 · 조끼 · 전투화 · 소모품 아이콘
- AlejandroHaibi, [Liquid Splatter Pixel Texture](https://opengameart.org/content/liquid-splatter-pixel-texture) (CC0) — 핏자국
- 이민서, [갈무리](https://github.com/quiple/galmuri) (SIL OFL 1.1) — 글꼴 · 라이선스 전문: [`assets/fonts/LICENSE-galmuri.txt`](assets/fonts/LICENSE-galmuri.txt)

자세한 출처와 가공 내역은 [`assets/README.md`](assets/README.md)에 있습니다.
