# assets/ — 그래픽 출처와 라이선스

이 폴더는 `python tools/build_assets.py` 가 만든 결과물입니다. 직접 고치지 말고 스크립트를 다시 실행하세요.

## Freedoom — BSD-3-Clause
- 출처: https://github.com/freedoom/freedoom (스프라이트, 벽 패치, 바닥 텍스처, 상태 바 숫자, 효과음, 배경음악)
- 라이선스 전문: `LICENSE-freedoom.txt`, 기여자 목록: `CREDITS-freedoom.txt`, 곡별 작곡자: `CREDITS-freedoom-music.txt`
- 배경음악은 원본 MIDI 그대로(`music/*.mid`), 게임이 Web Audio 신시사이저로 연주
- 가공: 스프라이트를 `atlas.png` 한 장으로 묶음, 벽 텍스처는 `textures.cfg` 정의대로 패치를 합성(`tex/wall_*.png` — 평균 밝기가 낮은 벽은 감마로 밝힘),
  바닥은 원본 그대로(`tex/flat_*.png`), 효과음은 원본 WAV 그대로(`sfx/*.wav`)
- 색조만 바꾼 몬스터 변종: 질주 크롤러(거미), 방패 해병(좀비맨), 그림자 추적자(데몬), 되살리는 자(아치바일),
  구역 보스 — 파쇄 짐승(데몬), 번식 모체(페인 엘리멘탈), 아르고스(카코데몬), 역병 거인(맨큐버스), 공허 사제(아치바일), 처형자(레버넌트)
- 보물 약탈자: 승무원(SS 대원) 스프라이트의 푸른 제복만 금빛으로 바꿈

## knekko "Futuristic Guns, Weapons and Items" — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/futuristic-guns-weapons-and-items
- 무기·수류탄·주사기·방어구·케이스(보급 캐시·금고 보물함, 보물함은 금빛으로 물들임) 아이콘으로 잘라 씀 (방어구는 armor_1.png, 네온 방어구는 neonpunk.png). 해머는 90도 회전, 창은 진압봉에 날을 그려 넣음,
  2연발은 펌프 손잡이를 총열색으로 칠함, 수류탄 일부는 색조를 바꿈 (출처 표기는 필수 아님)
  (체인톱은 마체테 칼날에 사슬 무늬를 넣고 검은 서류가방을 주황 엔진으로 칠해 붙임, 방전 진압봉은 진압봉 끝에 전극과 불꽃을 그려 넣음,
  플라즈마 블레이드는 카타나 칼날을 푸른빛으로·손잡이를 금속색으로 칠함)
  (무기 파츠 그림은 시트의 무기에서 부품만 잘라 씀 — 스코프·총열·개머리판은 저격소총, 탄창·소염기·접이식 개머리판은 M4, 곡선 탄창·앞손잡이는 MP5,
  상자 탄창은 중기관총, 광학 조준기는 P90, 소음기는 진압봉 끝, 모듈·레이저는 테이저 카트리지(색을 바꿈), 근접 파츠는 마체테·해머·카타나·총검·진압봉에서)
  (소드오프 아이콘은 Freedoom의 2연발 샷건 스프라이트, 칼날 부채 스킬 그림은 총검 세 자루를 부채꼴로 겹침)

## knekko "Cybericons"·"Microchips" — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/cybericons, https://opengameart.org/content/microchips-cpus-ics
- 32x32 아이콘을 그대로 씀: 팔 장비(기계 손), 강화칩(마이크로칩), 강화장신구(인공 심장·척추·의안·바이저·단말기·뇌파 머리띠·신경 이식체), 스킬 메뉴(뇌).
  네온 건틀릿은 은색 손을 청록으로 칠함

## MELLE 보석 아이콘 — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/cc0-gem-icons (AntumDeluge가 모은 CC0 보석 아이콘, MELLE 묶음 — 원작 https://opengameart.org/node/89286)
- 32x32 보석 5색을 그대로 씀. 사파이어는 루비를 파란 색조로, 다이아몬드는 하늘색 보석을 무채색으로 바꿈

## AlejandroHaibi "Liquid Splatter Pixel Texture" — CC0 (퍼블릭 도메인)
- 출처: https://opengameart.org/content/liquid-splatter-pixel-texture
- 흰 스플래터 한 장을 덩어리별로 나눠 핏자국 변형 5개(splat_a~e)로 쓰고 1/4로 줄임. 게임에서 몬스터 체액 색으로 칠함
