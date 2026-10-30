// ===== 게임 데이터 정의 (무기 / 탄약 / 수류탄 / 아이템 / 적) =====

// 버전: GitHub에 커밋·푸시할 때마다 올림 (새 기능은 가운데 자리, 고침·작은 추가는 끝자리) — 타이틀·일시정지 화면에 표시, git 태그 v<버전>
const VERSION = '0.39.1';

const CAT_NAMES = ['근접', '권총', '샷건', '라이플', '기관총', '에너지'];
const MAX_LOAD = 30;   // 장착 + 가방 무기 무게 합이 넘으면 이동속도 감소

// 스태미너: 달리기(Shift)는 초당 소모, 회피(Space)는 1회 소모, 근접 공격은 무기별 stamina 값만큼 소모
const STAMINA_MAX = 100;
const SPRINT_MUL = 1.6;           // 달리기 이동속도 배율
const STAMINA_SPRINT = 25;        // 달리기 초당 소모량 (최대치에서 4초)
const STAMINA_DASH = 25;          // 회피 1회 소모량
const DASH_CD = 1.5;              // 회피 대기시간 (초) — 회피 숙련 특성·장비 옵션으로 줄어듦 (연달아 쓸 수 없게)
const STAMINA_REGEN = 22;         // 초당 회복량
const STAMINA_REGEN_DELAY = 0.8;  // 마지막 소모 후 회복 시작까지 대기(초)
const STAMINA_RECOVER = 30;       // 고갈 후 다시 달릴 수 있게 되는 수치

const AMMO = {
  pistol: { name: '권총탄',     max: 180, pack: 18, buy: 30,  price: 35 },
  shell:  { name: '산탄',       max: 60,  pack: 8,  buy: 12,  price: 45 },
  rifle:  { name: '소총탄',     max: 210, pack: 20, buy: 30,  price: 55 },
  belt:   { name: '기관총 벨트', short: '벨트', max: 500, pack: 60, buy: 100, price: 90 },
  // 에너지·중화기용 (from: 이 구역부터 바닥·처치 보상에 섞여 나옴, 해당 무기를 가지고 있으면 언제든)
  cell:   { name: '에너지 셀',   short: '에너지', max: 300, pack: 40, buy: 50,  price: 120, from: 5 },
  rocket: { name: '로켓',        max: 24,  pack: 3,  buy: 6,   price: 150, from: 5 },
};

// cat: 0 근접, 1 권총, 2 샷건, 3 라이플, 4 기관총, 5 에너지
// rate: 발사 간격(초), spread: 탄퍼짐(라디안 전체폭), range: 사거리(타일), weight: 무게, stamina: 근접 1회 스태미너 소모
// proj: 탄 종류 (plasma 에너지탄 / rocket·bfg 터지는 탄, blast: 폭발 반경), cost: 한 발에 드는 탄약, charge: 모았다가 쏘는 시간(초)
// size: 인벤토리에서 차지하는 칸 [가로, 세로], minLvl: 이 구역부터 드롭, price 0이면 상점 미판매, desc: 툴팁 설명
// 밸런스 기준 (재장전 포함 지속 DPS): 근접 65~75 · 권총 70~90 · 샷건 100~135(근거리) · 라이플 100~105 · 기관총 155(느려짐)
//   · 에너지: 플라즈마 157(셀을 빨리 씀), 로켓 69·분쇄포 140 (+ 범위 피해, 분쇄포는 앞쪽 적까지)
const WEAPONS = {
  // --- 근접 ---
  knife:   { name: 'M9 총검', cat: 0, type: 'melee', dmg: 24, rate: 0.25, range: 1.15, arc: 1.6, knock: 0.3, stamina: 5, weight: 0.5, size: [2, 1], price: 0, minLvl: 1,
             desc: '군용 대검. 빠르게 연속으로 찌르고 스태미너 소모가 적다.' },
  hammer:  { name: '12파운드 슬레지해머', cat: 0, type: 'melee', dmg: 90, rate: 0.8, range: 1.4, arc: 2.0, knock: 2.2, stun: 0.6, stamina: 18, weight: 3, size: [3, 2], price: 470, minLvl: 2,
             desc: '느리지만 묵직한 일격. 넓게 휘둘러 적을 밀쳐내고 잠시 기절시킨다.' },
  spear:   { name: 'T-3 텅스텐 파이크', cat: 0, type: 'melee', dmg: 52, rate: 0.5, range: 2.3, arc: 0.7, knock: 0.8, stamina: 10, weight: 2, size: [4, 1], price: 580, minLvl: 3,
             desc: '긴 자루의 찌르기 무기. 다른 근접 무기보다 두 배 멀리서 공격한다.' },
  // saw: 누르고 있으면 0.1초마다 갈아 냄 (탄 쳐내기 없음), 처치 보급 탄약 { ammo: 확률, pack·packBig: 일반·정예 탄약 묶음 배율 } — MELEE 대신
  chainsaw: { name: '전동 체인톱', cat: 0, type: 'melee', dmg: 11, rate: 0.1, range: 1.1, arc: 1.2, knock: 0.05, stamina: 1.2, weight: 3.5, size: [4, 1], price: 1150, minLvl: 6,
              saw: { ammo: 1, pack: 1, packBig: 2 },
              desc: '누르고 있는 동안 계속 갈아 낸다. 적 탄은 쳐내지 못하지만, 이것으로 처치하면 탄약이 반드시 넉넉하게 튀어나온다.' },
  // chain: 맞히면 가장 가까이 맞은 적에게서 번개가 n번 튐 (피해 mul배)
  baton:    { name: '방전 진압봉', cat: 0, type: 'melee', dmg: 40, rate: 0.5, range: 1.3, arc: 1.5, knock: 0.6, stun: 0.4, stamina: 7, weight: 1.5, size: [3, 1], price: 1010, minLvl: 4,
              chain: { n: 3, mul: 0.5 },
              desc: '맞은 적을 감전시켜 잠시 기절시키고, 번개가 가까운 적 셋에게 튀어 간다.' },
  // reflect: 쳐낸 적 탄을 앞쪽의 적에게 되돌려 보냄
  pblade:   { name: '플라즈마 블레이드', cat: 0, type: 'melee', dmg: 56, rate: 0.42, range: 1.6, arc: 2.6, knock: 0.5, stamina: 9, weight: 2, size: [4, 1], price: 1700, minLvl: 7,
              reflect: true,
              desc: '넓게 휘두르는 플라즈마 칼날. 쳐낸 적 탄을 앞쪽의 적에게 되돌려 보낸다.' },
  // shieldMul: 방패를 근접 기본(MELEE.shield)보다 더 깎음, crit: 기본 치명타, exec: 체력 30% 아래인 적에게 피해 배율,
  // combo: 1초 안에 연달아 맞힐 때마다 피해 +step (최대 max번)
  bat:      { name: '알루미늄 배트', cat: 0, type: 'melee', dmg: 44, rate: 0.6, range: 1.4, arc: 2.0, knock: 3.0, stun: 0.25, stamina: 10, weight: 1.5, size: [3, 1], price: 280, minLvl: 1,
              desc: '힘껏 휘둘러 적을 멀리 날려 버린다. 맞은 적은 잠깐 휘청인다.' },
  wrench:   { name: '파이프 렌치', cat: 0, type: 'melee', dmg: 30, rate: 0.42, range: 1.15, arc: 1.5, knock: 0.7, stun: 0.3, stamina: 6, weight: 1.5, size: [3, 1], price: 420, minLvl: 1, shieldMul: 6,
              desc: '묵직한 쇳덩이. 방패를 다른 근접 무기의 두 배로 부순다.' },
  crowbar:  { name: '쇠지렛대', cat: 0, type: 'melee', dmg: 36, rate: 0.5, range: 1.25, arc: 1.6, knock: 0.9, stun: 0.2, stamina: 8, weight: 2, size: [3, 1], price: 560, minLvl: 2, crit: 0.15,
              desc: '갈고리 끝으로 약한 곳을 노린다. 치명타가 잘 터진다 (기본 15%).' },
  machete:  { name: '정글 마체테', cat: 0, type: 'melee', dmg: 28, rate: 0.3, range: 1.3, arc: 2.4, knock: 0.3, stamina: 6, weight: 1, size: [3, 1], price: 710, minLvl: 2,
              desc: '넓게 베어 여러 적을 한꺼번에 벤다. 가볍고 빠르다.' },
  knuckles: { name: '강철 너클', cat: 0, type: 'melee', dmg: 14, rate: 0.16, range: 0.95, arc: 1.4, knock: 0.08, stamina: 3, weight: 0.5, size: [2, 1], price: 950, minLvl: 4, combo: { step: 0.08, max: 8 },
              desc: '아주 빠른 주먹질. 쉬지 않고 맞힐수록 점점 세진다 (최대 +64%).' },
  axe:      { name: '소방 도끼', cat: 0, type: 'melee', dmg: 78, rate: 0.75, range: 1.3, arc: 1.5, knock: 1.2, stamina: 14, weight: 2.5, size: [3, 2], price: 940, minLvl: 5, exec: 1.8,
              desc: '무겁게 내려찍는 도끼. 체력이 30% 아래인 적에게는 피해가 1.8배.' },
  // --- 권총 ---
  revolver:      { name: '.44 매그넘 리볼버', cat: 1, type: 'gun', ammo: 'pistol', mag: 6, dmg: 55, rate: 0.45, reload: 1.9, spread: 0.02, speed: 28, weight: 1, size: [2, 2], snd: 'revolver', shake: 2.5, price: 0, minLvl: 1,
                   desc: '한 발 한 발이 강력한 6연발 리볼버. 정확하지만 재장전이 느리다.' },
  autopistol:    { name: 'M1911 .45 권총', cat: 1, type: 'gun', ammo: 'pistol', mag: 15, dmg: 17, rate: 0.15, reload: 1.3, spread: 0.05, speed: 28, weight: 1, size: [2, 2], snd: 'pistol', price: 380, minLvl: 1,
                   desc: '반자동 권총. 클릭할 때마다 한 발, 장탄이 넉넉하고 재장전이 빠르다.' },
  machinepistol: { name: 'M10 기관권총', cat: 1, type: 'gun', ammo: 'pistol', mag: 30, dmg: 9, rate: 0.055, reload: 1.2, spread: 0.2, speed: 26, weight: 1, size: [2, 2], snd: 'smg', auto: true, price: 660, minLvl: 2,
                   desc: '누르고 있으면 탄을 쏟아붓는다. 탄퍼짐이 크지만 가볍고 재장전이 빠르다.' },
  // burst: 한 번 누르면 n발 점사 (rate는 점사와 점사 사이 간격), elem: 기본 속성 (청록 무늬 '아크' = 감전 기절, 자홍 무늬 '헬파이어' = 화상)
  compact:     { name: 'P-9 점사 권총', cat: 1, type: 'gun', ammo: 'pistol', mag: 18, dmg: 13, rate: 0.36, burst: 3, reload: 1.0, spread: 0.06, speed: 28, weight: 0.6, size: [2, 2], snd: 'pistol', price: 490, minLvl: 1,
                 desc: '한 번 누르면 세 발씩 점사하는 작은 권총. 가볍고 재장전이 빠르다.' },
  heavypistol: { name: 'HX-50 핸드캐논', cat: 1, type: 'gun', ammo: 'pistol', mag: 7, dmg: 66, rate: 0.5, reload: 2.0, spread: 0.03, speed: 30, pierce: 1, weight: 1.5, size: [2, 2], snd: 'revolver', shake: 3, price: 850, minLvl: 2,
                 desc: '대구경 탄을 쓰는 커다란 권총. 한 발이 적 하나를 꿰뚫고 뒤의 적까지 맞힌다.' },
  taser:       { name: 'TZ-1 테이저', cat: 1, type: 'gun', ammo: 'cell', mag: 6, dmg: 30, rate: 0.55, reload: 1.6, spread: 0.02, speed: 24, weight: 1, size: [2, 2], snd: 'zap', tracer: '#ffe14a', elem: { type: 'shock', chance: 1 }, price: 860, minLvl: 4,
                 desc: '전기 침을 쏜다. 맞은 적은 반드시 기절한다 (보스는 짧게). 에너지 셀을 쓴다.' },
  mp5:         { name: 'MP5 기관단총', cat: 1, type: 'gun', ammo: 'pistol', mag: 30, dmg: 13, rate: 0.085, reload: 1.8, spread: 0.04, range: 20, crit: 0.05, speed: 28, weight: 2, size: [3, 2], snd: 'smg', auto: true, price: 850, minLvl: 3,
                 desc: '권총탄을 쓰는 기관단총. 정확해서 멀리까지 닿고, 약한 곳을 잘 맞힌다.' },
  arcrevolver: { name: '아크 리볼버', cat: 1, type: 'gun', ammo: 'pistol', mag: 6, dmg: 60, rate: 0.45, reload: 1.8, spread: 0.02, speed: 28, weight: 1, size: [2, 2], snd: 'revolver', shake: 2.5, tracer: '#9df', elem: { type: 'shock', chance: 0.4 }, price: 1580, minLvl: 4,
                 desc: '아크 사의 전기 리볼버. 맞힌 적을 40% 확률로 기절시킨다.' },
  p90:         { name: 'P90 개인화기', cat: 1, type: 'gun', ammo: 'pistol', mag: 50, dmg: 10, rate: 0.06, reload: 2.2, spread: 0.09, speed: 30, pierce: 1, weight: 2.5, size: [3, 2], snd: 'smg', auto: true, price: 1420, minLvl: 5,
                 desc: '50발 탄창의 기관단총. 관통탄이라 줄지어 오는 적을 한꺼번에 뚫는다.' },
  // --- 샷건 ---
  sawedoff:     { name: '소드오프 더블배럴', cat: 2, type: 'gun', ammo: 'shell', mag: 2, pellets: 10, dmg: 12, rate: 0.2, reload: 1.5, spread: 0.55, range: 5, speed: 24, weight: 1.5, size: [3, 2], snd: 'dshotgun', shake: 5, price: 470, minLvl: 1,
                  desc: '총열을 잘라낸 2연발 산탄총. 코앞에서는 가장 강하지만 사거리가 매우 짧다.' },
  doublebarrel: { name: '12게이지 코치건', cat: 2, type: 'gun', ammo: 'shell', mag: 2, pellets: 9, dmg: 14, rate: 0.25, reload: 1.9, spread: 0.28, range: 8, speed: 26, weight: 2.5, size: [4, 2], snd: 'dshotgun', shake: 5, price: 660, minLvl: 2,
                  desc: '긴 총열의 상하 2연발 산탄총. 두 발을 연달아 쏘고, 소드오프보다 멀리 모여서 날아간다.' },
  pump:         { name: 'M590 펌프 샷건', cat: 2, type: 'gun', ammo: 'shell', mag: 7, pellets: 10, dmg: 11, rate: 0.65, reload: 2.4, spread: 0.3, range: 8, speed: 26, weight: 3, size: [4, 2], snd: 'shotgun', shake: 4, price: 850, minLvl: 2,
                  desc: '7발 펌프 액션 산탄총. 넓게 퍼져 가까이 몰려든 적을 한꺼번에 쓸어 낸다.' },
  autoshotgun:  { name: 'M1014 반자동 샷건', cat: 2, type: 'gun', ammo: 'shell', mag: 10, pellets: 7, dmg: 10, rate: 0.24, reload: 2.8, spread: 0.28, range: 8, speed: 26, weight: 4, size: [4, 2], snd: 'shotgun', shake: 3.5, auto: true, price: 1420, minLvl: 5,
                  desc: '누르고 있으면 연사되는 산탄총. 무겁고 비싸지만 근접 화력이 압도적이다.' },
  combatpump:   { name: 'M870 전투 산탄총', cat: 2, type: 'gun', ammo: 'shell', mag: 7, pellets: 6, dmg: 19, rate: 0.7, reload: 2.6, spread: 0.1, range: 13, pierce: 1, speed: 28, weight: 3, size: [4, 2], snd: 'shotgun', shake: 4, price: 990, minLvl: 3,
                  desc: '탄이 좁게 모여 멀리 날아가는 펌프 샷건. 산탄이 적을 하나씩 꿰뚫어 줄지어 오는 적에게 강하다.' },
  dragon:       { name: '드래곤 브레스', cat: 2, type: 'gun', ammo: 'shell', mag: 6, pellets: 9, dmg: 10, rate: 0.6, reload: 2.4, spread: 0.32, range: 7, speed: 24, weight: 3, size: [4, 2], snd: 'shotgun', shake: 4, tracer: '#ff8a40', elem: { type: 'fire', chance: 0.3 }, price: 1400, minLvl: 6,
                  desc: '헬파이어 사의 소이 산탄. 불붙은 산탄이 30% 확률로 적을 태운다.' },
  arcpump:      { name: '아크 펌프 샷건', cat: 2, type: 'gun', ammo: 'shell', mag: 6, pellets: 8, dmg: 15, rate: 0.65, reload: 2.4, spread: 0.24, range: 9, speed: 26, weight: 3, size: [4, 2], snd: 'shotgun', shake: 4, tracer: '#9df', elem: { type: 'shock', chance: 0.15 }, price: 1800, minLvl: 4,
                  desc: '아크 사의 펌프 샷건. 산탄마다 15% 확률로 기절, 무리를 한꺼번에 멈춘다.' },
  // --- 라이플 ---
  marksman: { name: 'M24 저격소총', cat: 3, type: 'gun', ammo: 'rifle', mag: 5, dmg: 150, rate: 1.0, reload: 2.4, spread: 0, speed: 48, range: 30, pierce: 4, weight: 4, size: [5, 2], snd: 'rifle', shake: 3, tracer: '#aef', price: 1320, minLvl: 3,
              desc: '볼트액션 저격소총. 한 발이 일직선 위의 적 다섯 마리까지 꿰뚫는다.' },
  assault:  { name: 'M4A1 카빈', cat: 3, type: 'gun', ammo: 'rifle', mag: 30, dmg: 17, rate: 0.095, reload: 2.0, spread: 0.06, speed: 34, range: 18, weight: 3.5, size: [4, 2], snd: 'smg', auto: true, price: 1150, minLvl: 3,
              desc: '30발 자동소총. 정확하고 다루기 쉬워 어느 거리에서나 쓸 만하다.' },
  arccarbine: { name: '아크 카빈', cat: 3, type: 'gun', ammo: 'rifle', mag: 30, dmg: 22, rate: 0.36, burst: 3, reload: 2.0, spread: 0.05, speed: 34, range: 18, weight: 3.5, size: [4, 2], snd: 'smg', auto: true, tracer: '#9df', elem: { type: 'shock', chance: 0.15 }, price: 1570, minLvl: 5,
                desc: '아크 사의 3점사 카빈. 누르고 있으면 세 발씩 끊어 쏘고, 한 발마다 15% 확률로 기절시킨다.' },
  arcsniper:  { name: '아크 반자동 저격소총', cat: 3, type: 'gun', ammo: 'rifle', mag: 10, dmg: 70, rate: 0.4, reload: 2.6, spread: 0.01, speed: 46, range: 26, pierce: 2, weight: 4, size: [5, 2], snd: 'rifle', shake: 2.5, tracer: '#9df', elem: { type: 'shock', chance: 0.25 }, price: 2140, minLvl: 6,
                desc: '빠르게 연달아 쏘는 저격소총. 셋까지 꿰뚫고 25% 확률로 기절시킨다.' },
  // --- 기관총 ---
  mg: { name: 'M249 분대지원화기', cat: 4, type: 'gun', ammo: 'belt', mag: 100, dmg: 15, rate: 0.055, reload: 4.2, spread: 0.11, speed: 32, range: 18, weight: 7, size: [5, 3], slow: 0.68, spin: true, snd: 'smg', shake: 1.5, auto: true, price: 2200, minLvl: 5,
        desc: '100발 벨트 급탄 경기관총. 발사 속도가 점점 올라가 탄막을 퍼붓지만, 들고 있으면 느려진다.' },
  camolmg: { name: '위장 경기관총', cat: 4, type: 'gun', ammo: 'belt', mag: 80, dmg: 20, rate: 0.085, reload: 3.5, spread: 0.09, speed: 32, range: 18, weight: 6, size: [5, 2], slow: 0.8, snd: 'smg', shake: 1.5, auto: true, price: 2470, minLvl: 6,
             desc: '분대지원화기보다 느리게 쏘지만 처음부터 정확하고, 들고 있어도 덜 느려진다.' },
  hellhmg: { name: '헬파이어 중기관총', cat: 4, type: 'gun', ammo: 'belt', mag: 120, dmg: 18, rate: 0.06, reload: 4.5, spread: 0.12, speed: 32, range: 18, weight: 8, size: [5, 2], slow: 0.62, spin: true, snd: 'smg', shake: 1.8, auto: true, tracer: '#ff8a40', elem: { type: 'fire', chance: 0.15 }, price: 2340, minLvl: 8,
             desc: '헬파이어 사의 소이탄 기관총. 점점 빨라지는 탄막이 15% 확률로 적을 태운다. 매우 무겁다.' },
  // --- 에너지·중화기 (5구역 무렵부터, 정예·보스가 잘 떨어뜨림) ---
  plasma:   { name: 'PX-7 플라즈마 소총', cat: 5, type: 'gun', ammo: 'cell', mag: 40, dmg: 26, rate: 0.085, reload: 2.2, spread: 0.07, speed: 30, range: 16, weight: 4, size: [4, 2], proj: 'plasma', snd: 'plasmaGun', shake: 1.2, auto: true, price: 2550, minLvl: 7,
              desc: '뜨거운 플라즈마 탄을 쏟아붓는 에너지 소총. 빠르고 강하지만 에너지 셀을 많이 먹는다.' },
  launcher: { name: 'M-88 로켓 발사기', cat: 5, type: 'gun', ammo: 'rocket', mag: 4, dmg: 135, rate: 0.9, reload: 2.8, spread: 0.02, speed: 13, range: 18, blast: 2.6, weight: 6, size: [5, 2], proj: 'rocket', snd: 'rocketGun', shake: 6, price: 2430, minLvl: 8,
              desc: '맞은 곳 주변을 통째로 날려버리는 로켓. 무리에 강하지만, 너무 가까이 쏘면 나도 휘말린다.' },
  bfg:      { name: 'XB-9 분쇄포', cat: 5, type: 'gun', ammo: 'cell', mag: 1, cost: 40, dmg: 500, rate: 1.2, reload: 1.8, charge: 0.8, spread: 0, speed: 9, range: 18, blast: 4.2, weight: 8, size: [5, 3], proj: 'bfg', snd: 'bfgGun', shake: 10, price: 3400, minLvl: 9,
              desc: '0.8초 동안 에너지를 모아 거대한 구체를 쏜다. 터지면 넓은 범위를 휩쓸고, 앞쪽에 보이는 적들까지 번개처럼 꿰뚫는다. 한 발에 에너지 셀 40.' },
  // seek: 미사일이 저마다 가까운 적을 쫓아감 (초당 꺾는 각도)
  neonpistol:  { name: '네온 플라즈마 권총', cat: 5, type: 'gun', ammo: 'cell', mag: 20, dmg: 36, rate: 0.2, reload: 1.5, spread: 0.04, speed: 26, range: 14, weight: 1, size: [2, 2], proj: 'plasma', snd: 'plasmaGun', shake: 1, price: 1490, minLvl: 7,
                 desc: '네온 사의 에너지 권총. 가볍고 빠른 플라즈마 탄을 쏜다.' },
  neonshotgun: { name: '네온 플라즈마 산탄총', cat: 5, type: 'gun', ammo: 'cell', mag: 8, pellets: 6, dmg: 18, rate: 0.45, reload: 2.2, spread: 0.3, range: 8, speed: 22, weight: 3, size: [4, 2], proj: 'plasma', snd: 'plasmaGun', shake: 3, price: 2020, minLvl: 7,
                 desc: '플라즈마 탄을 부채꼴로 흩뿌리는 에너지 산탄총.' },
  rpg:         { name: 'RPG-7 무반동포', cat: 5, type: 'gun', ammo: 'rocket', mag: 1, dmg: 200, rate: 0.5, reload: 2.0, spread: 0.02, speed: 15, range: 18, blast: 3.0, weight: 5, size: [5, 2], proj: 'rocket', snd: 'rocketGun', shake: 7, price: 2550, minLvl: 7,
                 desc: '한 발씩 장전하는 대형 로켓. 로켓 발사기보다 넓게 터진다.' },
  neonblaster: { name: '네온 플라즈마 캐논', cat: 5, type: 'gun', ammo: 'cell', mag: 8, cost: 2, dmg: 95, rate: 0.6, reload: 2.0, spread: 0.02, speed: 16, range: 16, blast: 1.4, weight: 4.5, size: [4, 2], proj: 'plasma', snd: 'plasmaGun', shake: 4, price: 2250, minLvl: 8,
                 desc: '커다란 플라즈마 구체를 쏜다. 맞은 자리에서 작게 터진다. 한 발에 셀 2.' },
  homingrl:    { name: '스마트 유도 로켓', cat: 5, type: 'gun', ammo: 'rocket', mag: 4, pellets: 3, dmg: 55, rate: 0.9, reload: 2.6, spread: 0.6, speed: 9, range: 18, blast: 1.6, seek: 4, weight: 5.5, size: [5, 2], proj: 'micro', snd: 'missiles', shake: 4, price: 2770, minLvl: 8,
                 desc: '작은 유도 미사일 셋을 한꺼번에 쏜다. 미사일은 저마다 가까운 적을 쫓아간다.' },
  railgun:     { name: 'XR 레일건', cat: 5, type: 'gun', ammo: 'cell', mag: 4, cost: 6, dmg: 280, rate: 0.9, charge: 0.35, reload: 2.2, spread: 0, speed: 70, range: 30, pierce: 99, weight: 6, size: [5, 2], snd: 'bfgGun', shake: 6, tracer: '#7ef', price: 2600, minLvl: 9,
                 desc: '0.35초 충전한 뒤 쏘는 전자기 탄. 일직선 위의 모든 적을 꿰뚫는다. 한 발에 셀 6.' },
};

// ===== 인벤토리 / 루팅 =====
const BAG_W = 10, BAG_H = 6;   // 가방 격자 크기 (칸)

// 등급: weight는 기본 드롭 가중치 (구역이 깊을수록, 강한 적일수록 상위 등급 확률 증가), affixes는 옵션 개수 [최소, 최대]
const RARITY = [
  { name: '일반', color: '#d8d8d8', glow: '216,216,216', weight: 60, affixes: [0, 0] },
  { name: '고급', color: '#66aaff', glow: '102,170,255', weight: 28, affixes: [1, 1] },
  { name: '희귀', color: '#ffdd55', glow: '255,221,85',  weight: 10, affixes: [2, 3] },
  { name: '전설', color: '#ff9933', glow: '255,153,51',  weight: 2,  affixes: [3, 4] },
  // 고유 전설: 무작위로는 나오지 않음 (UNIQUES에 정해진 이름·옵션·고유 효과, UNIQUE_DROP 확률로만 떨어짐)
  { name: '고유 전설', color: '#dcc283', glow: '220,194,131', weight: 0, affixes: [2, 2] },
];

// 랜덤 옵션: min~max 범위에서 굴림 (등급이 높을수록 높은 값), gun: 총기 전용, needSpread: 탄퍼짐이 있는 총만
const AFFIXES = {
  dmg:    { prefix: '강력한',   min: 0.08, max: 0.30, text: v => `피해 +${Math.round(v * 100)}%` },
  rate:   { prefix: '신속한',   min: 0.06, max: 0.22, text: v => `공격속도 +${Math.round(v * 100)}%` },
  mag:    { prefix: '대용량',   min: 0.20, max: 0.60, gun: true, text: v => `장탄수 +${Math.round(v * 100)}%` },
  reload: { prefix: '숙련된',   min: 0.10, max: 0.35, gun: true, text: v => `재장전 시간 -${Math.round(v * 100)}%` },
  acc:    { prefix: '정밀한',   min: 0.15, max: 0.50, gun: true, needSpread: true, text: v => `탄퍼짐 -${Math.round(v * 100)}%` },
  crit:   { prefix: '치명적인', min: 0.05, max: 0.18, text: v => `치명타 확률 ${Math.round(v * 100)}% (2배 피해)` },
  elem:   { min: 0.15, max: 0.35, text: (v, t) => `명중 시 ${Math.round(v * 100)}% 확률로 ${ELEMS[t].name}` },
};
const ELEMS = {
  fire:   { name: '화상', prefix: '작열하는', color: '#ff8833' },
  poison: { name: '중독', prefix: '맹독의',   color: '#99ee44' },
  shock:  { name: '기절', prefix: '방전하는', color: '#66ccff' },
  cryo:   { name: '둔화', prefix: '빙결의',   color: '#bbeeff' },
};

// 수류탄 두 가지: 피해 (파편), 묶어 두기 (냉동)
const GRENADES = {
  frag:  { name: '파편 수류탄', short: '파편', color: '#d8c070', price: 60 },
  cryo:  { name: '냉동 수류탄', short: '냉동', color: '#bef', price: 70 },
};

// 소모품 세 가지 (HUD 칸 순서 = 단축키 Q·E·T): 메디킷 (최대 체력의 MED_HEAL만큼), 치료제 (중독·화상·감전), 아드레날린
const ITEMS = {
  med:   { name: '메디킷',     short: '메디킷', desc: '최대 체력의 40% 회복',      price: 70, color: '#e55' },
  cure:  { name: '치료제',     short: '치료제', desc: '중독·화상·감전 해제 + 8초 면역', price: 50, color: '#9e4' },
  adren: { name: '아드레날린', short: '아드',   desc: '12초간 이동·공격속도 +35%', price: 90, color: '#f8c' },
};
const MED_HEAL = 0.4;
const ITEM_KEYS = { KeyQ: 'med', KeyE: 'cure', KeyT: 'adren' };
const ITEM_KEY_LABEL = Object.fromEntries(Object.entries(ITEM_KEYS).map(([code, id]) => [id, code.slice(-1)]));
const ITEM_DROP_WEIGHTS = { med: 6, cure: 3, adren: 1.5 };

// ===== 우주 기지 =====
// 기지 개조 (영구, 개조 자판기): max 단계까지, n번째 단계 비용 = gold[n]·parts[n]
const UPGRADES = {
  bag: { name: '확장 배낭', desc: '가방 한 줄 추가 (+10칸)', icon: 'bpaka0', max: 2, gold: [1500, 3000], parts: [15, 30] },
};
// 장비 개조 (개조 자판기): 장비 종류(slot)마다 달 수 있는 개조. 그 장비를 장착했을 때만 효과 (k: 더하는 효과 — gearV, per: 한 단계)
// 한 장비의 개조 단계 합은 등급별 MOD_CAP까지 (일반·고급·희귀·전설·고유 전설), 그 장비의 n번째 단계 비용은 MOD_COST (골드는 그 장비가 처음 나오는 막의 MOD_TIER배)
// icon이 없으면 장비 그림
const MODS = {
  neuro:  { name: '신경 가속',   slot: 'head', k: 'cdr',    per: 0.03, icon: 'icon_brain',        text: v => `스킬 대기시간 -${pct(v)}` },
  filter: { name: '면역 필터',   slot: 'head', k: 'res',    per: 0.10, icon: 'bon1a0',            text: v => `중독·화상·감전 시간 -${pct(v)}` },
  frame:  { name: '강화 골격',   slot: 'body', k: 'hp',     per: 20,   icon: 'media0',            text: v => `최대 체력 +${v}` },
  pouch:  { name: '탄약 주머니', slot: 'body', k: 'ammo',   per: 0.15, icon: 'ammoa0',            text: v => `탄약 최대치 +${pct(v)}` },
  exo:    { name: '외골격 다리', slot: 'legs', k: 'load',   per: 3,    icon: 'arm1a0',            text: v => `적재량 +${v}` },
  muscle: { name: '인공 근육',   slot: 'legs', k: 'spd',    per: 0.02, icon: 'icon_boots',        text: v => `이동 속도 +${pct(v)}` },
  servo:  { name: '서보 보조',   slot: 'arm',  k: 'reload', per: 0.04, icon: 'clipa0',            text: v => `재장전 시간 -${pct(v)}` },
  impact: { name: '충격 증폭',   slot: 'arm',  k: 'melee',  per: 0.05, icon: 'icon_knife',        text: v => `근접 피해 +${pct(v)}` },
  lung:   { name: '인공 폐',     slot: 'chip', k: 'stam',   per: 15,   icon: 'icon_syringe_blue', text: v => `최대 스태미너 +${v}` },
  reso:   { name: '증폭 회로',   slot: 'acc',  k: 'spow',   per: 0.03,                            text: v => `스킬 위력 +${pct(v)}` },
};
const MOD_CAP = [1, 2, 3, 4, 4];
const MOD_COST = { gold: [200, 400, 700, 1100], parts: [4, 8, 14, 20] };
const MOD_TIER = [1, 1.8, 2.6];
// ===== 방어구 · 강화칩 · 강화장신구 =====
// 인벤토리의 인체 모양 장비 칸 (GEAR_SLOTS: 칸 → 끼우는 종류, 팔 장비는 왼팔·오른팔 어디든)
// def: 방어 (받는 피해 감소 = 방어 / (방어 + ARMOR_K)), 등급마다 방어 +ARMOR_RARITY_DEF
// aug: 강화칩·강화장신구의 기본 효과 [옵션 키, 수치] — 칩은 몸 능력, 장신구는 모든 스킬 (계열마다 다름)
// weight: 무게 (무기와 함께 적재량), size: 가방 칸, minLvl: 이 구역부터 드롭·상점, icon: 아틀라스 그림 (knekko)
const ARMOR_SLOTS = { head: '머리', body: '몸통', legs: '다리', arm: '팔', chip: '강화칩', acc: '강화장신구' };
const GEAR_SLOTS = { chip: 'chip', head: 'head', acc: 'acc', larm: 'arm', body: 'body', rarm: 'arm', legs: 'legs' };
const GEAR_NAMES = { chip: '강화칩', head: '머리', acc: '강화장신구', larm: '왼팔', body: '몸통', rarm: '오른팔', legs: '다리' };
const ARMOR_K = 100;
const ARMOR_RARITY_DEF = 0.15;
const ARMORS = {
  cap:     { name: '전투 헬멧',       slot: 'head', def: 6,  weight: 1,   size: [2, 2], price: 290,  minLvl: 1, icon: 'icon_helm_army',  desc: '가볍고 튼튼한 기본 헬멧.' },
  scout:   { name: '정찰 헬멧',       slot: 'head', def: 9,  weight: 1,   size: [2, 2], price: 870,  minLvl: 4, icon: 'icon_helm_kevlar', desc: '얇은 복합 소재로 무게는 그대로, 막는 힘은 더 크다.' },
  visor:   { name: '바이저 헬멧',     slot: 'head', def: 13, weight: 1.5, size: [2, 2], price: 1440,  minLvl: 7, icon: 'icon_helm_visor', desc: '전투 바이저가 달린 강습용 헬멧.' },
  vest:    { name: '방탄 조끼',       slot: 'body', def: 14, weight: 3,   size: [2, 3], price: 290,  minLvl: 1, icon: 'icon_vest_tac',   desc: '주머니가 많은 경량 방탄 조끼.' },
  carrier: { name: '플레이트 캐리어', slot: 'body', def: 20, weight: 4,   size: [2, 3], price: 670,  minLvl: 3, icon: 'icon_vest_black', desc: '앞뒤로 장갑판을 넣은 조끼.' },
  heavy:   { name: '중장갑 조끼',     slot: 'body', def: 28, weight: 6.5, size: [2, 3], price: 1060,  minLvl: 5, icon: 'icon_vest_heavy', desc: '가장 단단하지만 무거워 적재량을 많이 차지한다.' },
  neon:    { name: '네온 강화복',     slot: 'body', def: 34, weight: 4.5, size: [2, 3], price: 1440, minLvl: 7, icon: 'icon_vest_neon',  desc: '연구동 시제품. 중장갑보다 단단하면서 훨씬 가볍다.' },
  boots:   { name: '전투화',          slot: 'legs', def: 5,  weight: 1,   size: [2, 2], price: 290,  minLvl: 1, icon: 'icon_boots',      desc: '발목을 감싸는 강화 전투화.' },
  greaves: { name: '보강 하의',       slot: 'legs', def: 9,  weight: 2,   size: [2, 2], price: 870,  minLvl: 4, icon: 'icon_pants',      desc: '무릎과 허벅지에 장갑판을 덧댄 하의.' },
  neonleg: { name: '네온 강화 하의',  slot: 'legs', def: 13, weight: 1.5, size: [2, 2], price: 1440,  minLvl: 7, icon: 'icon_pants_neon', desc: '근력 보조 장치가 달린 시제품 하의.' },
  gauntlet: { name: '전투 건틀릿',    slot: 'arm',  def: 3,  weight: 1,   size: [2, 2], price: 290,  minLvl: 1, icon: 'icon_arm_dark',   desc: '손등과 팔뚝을 덮는 강화 장갑.' },
  servo:    { name: '서보 건틀릿',    slot: 'arm',  def: 5,  weight: 1,   size: [2, 2], price: 870,  minLvl: 4, icon: 'icon_arm_silver', desc: '관절마다 서보 모터가 달려 손이 떨리지 않는다.' },
  neonarm:  { name: '네온 건틀릿',    slot: 'arm',  def: 8,  weight: 1,   size: [2, 2], price: 1440,  minLvl: 7, icon: 'icon_arm_neon',   desc: '연구동 시제품. 가볍고 단단하다.' },
  // 강화칩: 계열마다 보조·증폭·코어 — 근력: 최대 체력, 민첩: 이동 속도, 기술: 재장전, 정신: 회피 대기시간
  chipS1: { name: '근력 보조 칩', slot: 'chip', aug: ['hp', 20], def: 0, weight: 0, size: [1, 1], price: 250, minLvl: 1, icon: 'icon_chip_str1', desc: '근섬유 신호를 조금 키운다.' },
  chipS2: { name: '근력 증폭 칩', slot: 'chip', aug: ['hp', 40], def: 0, weight: 0, size: [1, 1], price: 740, minLvl: 4, icon: 'icon_chip_str2', desc: '근섬유 신호를 크게 키운다.' },
  chipS3: { name: '근력 코어 칩', slot: 'chip', aug: ['hp', 60], def: 0, weight: 0, size: [1, 1], price: 1240, minLvl: 7, icon: 'icon_chip_str3', desc: '근육 제어를 통째로 맡는 코어.' },
  chipA1: { name: '민첩 보조 칩', slot: 'chip', aug: ['spd', 0.04], def: 0, weight: 0, size: [1, 1], price: 250, minLvl: 1, icon: 'icon_chip_agi1', desc: '반사 신경 신호를 조금 앞당긴다.' },
  chipA2: { name: '민첩 증폭 칩', slot: 'chip', aug: ['spd', 0.07], def: 0, weight: 0, size: [1, 1], price: 740, minLvl: 4, icon: 'icon_chip_agi2', desc: '반사 신경 신호를 크게 앞당긴다.' },
  chipA3: { name: '민첩 코어 칩', slot: 'chip', aug: ['spd', 0.1], def: 0, weight: 0, size: [1, 1], price: 1240, minLvl: 7, icon: 'icon_chip_agi3', desc: '생각보다 몸이 먼저 움직인다.' },
  chipT1: { name: '기술 보조 칩', slot: 'chip', aug: ['reload', 0.08], def: 0, weight: 0, size: [1, 1], price: 250, minLvl: 1, icon: 'icon_chip_tec1', desc: '손끝 신경을 정밀하게 다듬는다.' },
  chipT2: { name: '기술 증폭 칩', slot: 'chip', aug: ['reload', 0.14], def: 0, weight: 0, size: [1, 1], price: 740, minLvl: 4, icon: 'icon_chip_tec2', desc: '장비 조작을 연산으로 돕는다.' },
  chipT3: { name: '기술 코어 칩', slot: 'chip', aug: ['reload', 0.2], def: 0, weight: 0, size: [1, 1], price: 1240, minLvl: 7, icon: 'icon_chip_tec3', desc: '전술 연산을 통째로 맡는 코어.' },
  chipP1: { name: '정신 보조 칩', slot: 'chip', aug: ['dash', 0.1], def: 0, weight: 0, size: [1, 1], price: 250, minLvl: 1, icon: 'icon_chip_psi1', desc: '뇌파를 조금 증폭한다.' },
  chipP2: { name: '정신 증폭 칩', slot: 'chip', aug: ['dash', 0.18], def: 0, weight: 0, size: [1, 1], price: 740, minLvl: 4, icon: 'icon_chip_psi2', desc: '뇌파를 크게 증폭한다.' },
  chipP3: { name: '정신 코어 칩', slot: 'chip', aug: ['dash', 0.25], def: 0, weight: 0, size: [1, 1], price: 1240, minLvl: 7, icon: 'icon_chip_psi3', desc: '의식의 대역폭을 넓히는 코어.' },
  // 강화장신구: 계열마다 3단계, 모든 스킬에 — 근력: 위력, 민첩: 대기시간, 기술: 지속, 정신: 범위
  pump:    { name: '아드레날린 펌프', slot: 'acc', aug: ['spow', 0.08], def: 0, weight: 0, size: [1, 1], price: 290,  minLvl: 1, icon: 'icon_acc_str1', desc: '위급할 때 아드레날린을 밀어 넣는다.' },
  heart:   { name: '강화 심장',       slot: 'acc', aug: ['spow', 0.14], def: 0, weight: 0, size: [1, 1], price: 870,  minLvl: 4, icon: 'icon_acc_str2', desc: '두 사람 몫을 뛰는 인공 심장.' },
  spine:   { name: '전투 척추',       slot: 'acc', aug: ['spow', 0.2], def: 0, weight: 0, size: [1, 1], price: 1440, minLvl: 7, icon: 'icon_acc_str3', desc: '충격을 받아내는 합금 척추.' },
  lens:    { name: '반응 렌즈',       slot: 'acc', aug: ['scd', 0.06], def: 0, weight: 0, size: [1, 1], price: 290,  minLvl: 1, icon: 'icon_acc_agi1', desc: '움직임을 미리 그려 보여 주는 안경.' },
  eye:     { name: '추적 의안',       slot: 'acc', aug: ['scd', 0.1], def: 0, weight: 0, size: [1, 1], price: 870,  minLvl: 4, icon: 'icon_acc_agi2', desc: '표적을 놓치지 않는 인공 눈.' },
  hunter:  { name: '사냥꾼의 눈',     slot: 'acc', aug: ['scd', 0.15], def: 0, weight: 0, size: [1, 1], price: 1440, minLvl: 7, icon: 'icon_acc_agi3', desc: '어둠 속의 열까지 읽는 의안.' },
  tablet:  { name: '전술 단말기',     slot: 'acc', aug: ['sdur', 0.1], def: 0, weight: 0, size: [1, 1], price: 290,  minLvl: 1, icon: 'icon_acc_tec1', desc: '드론과 포탑을 손목에서 다룬다.' },
  module:  { name: '전술 모듈',       slot: 'acc', aug: ['sdur', 0.18], def: 0, weight: 0, size: [1, 1], price: 870,  minLvl: 4, icon: 'icon_acc_tec2', desc: '장비 회로에 끼우는 확장 모듈.' },
  hud:     { name: '전술 바이저',     slot: 'acc', aug: ['sdur', 0.25], def: 0, weight: 0, size: [1, 1], price: 1440, minLvl: 7, icon: 'icon_acc_tec3', desc: '전장을 겹쳐 보여 주는 바이저.' },
  eeg:     { name: '뇌파 머리띠',     slot: 'acc', aug: ['sr', 0.08], def: 0, weight: 0, size: [1, 1], price: 290,  minLvl: 1, icon: 'icon_acc_psi1', desc: '뇌파를 읽어 영능을 다듬는다.' },
  implant: { name: '신경 이식체',     slot: 'acc', aug: ['sr', 0.14], def: 0, weight: 0, size: [1, 1], price: 870,  minLvl: 4, icon: 'icon_acc_psi2', desc: '척수에 심는 신경 증폭 회로.' },
  amp:     { name: '신경 증폭기',     slot: 'acc', aug: ['sr', 0.2], def: 0, weight: 0, size: [1, 1], price: 1440, minLvl: 7, icon: 'icon_acc_psi3', desc: '의식을 몸 바깥까지 넓히는 증폭기.' },
};
// 방어구 옵션: slots가 있으면 그 종류에만
// 강화칩은 몸 능력 옵션, 강화장신구는 스킬 옵션 (모든 스킬에)
// 팔 옵션은 두 팔에서 겹치므로 한 팔 범위를 작게
const ARMOR_PIECES = ['head', 'body', 'legs', 'arm'];
const BODY_GEAR = ['head', 'body', 'legs', 'arm', 'chip'];
const ARMOR_AFFIXES = {
  def:    { prefix: '견고한',   min: 0.15, max: 0.45, slots: ARMOR_PIECES, text: v => `방어 +${pct(v)}` },
  hp:     { prefix: '튼튼한',   min: 10, max: 50, int: true, slots: BODY_GEAR, text: v => `최대 체력 +${v}` },
  regen:  { prefix: '재생하는', min: 0.5, max: 2.5, slots: BODY_GEAR, text: v => `초당 체력 회복 +${v.toFixed(1)}` },
  res:    { prefix: '면역의',   min: 0.15, max: 0.45, slots: BODY_GEAR, text: v => `중독·화상·감전 시간 -${pct(v)}` },
  stam:   { prefix: '지구력의', min: 10, max: 35, int: true, slots: BODY_GEAR, text: v => `최대 스태미너 +${v}` },
  spd:    { prefix: '날쌘',     min: 0.03, max: 0.10, slots: ['legs', 'chip'], text: v => `이동 속도 +${pct(v)}` },
  cdr:    { prefix: '집중의',   min: 0.04, max: 0.12, slots: ['head'], text: v => `스킬 대기시간 -${pct(v)}` },
  dash:   { prefix: '재빠른',   min: 0.08, max: 0.25, slots: ['chip'], text: v => `회피 대기시간 -${pct(v)}` },
  reload: { prefix: '능숙한',   min: 0.03, max: 0.08, slots: ['arm'], text: v => `재장전 시간 -${pct(v)}` },
  melee:  { prefix: '강타하는', min: 0.05, max: 0.15, slots: ['arm'], text: v => `근접 피해 +${pct(v)}` },
  spow:   { prefix: '증폭하는', min: 0.04, max: 0.12, slots: ['acc'], text: v => `스킬 위력 +${pct(v)}` },
  scd:    { prefix: '가속하는', min: 0.05, max: 0.15, slots: ['acc'], text: v => `스킬 대기시간 -${pct(v)}` },
  sr:     { prefix: '광역의',   min: 0.08, max: 0.25, slots: ['acc'], text: v => `스킬 범위 +${pct(v)}` },
  sdur:   { prefix: '지속하는', min: 0.10, max: 0.30, slots: ['acc'], text: v => `스킬 지속 +${pct(v)}` },
  sn:     { prefix: '다중의',   min: 1, max: 1, int: true, slots: ['acc'], text: v => `스킬 개수 +${v}` },
  scc:    { prefix: '압도하는', min: 0.10, max: 0.35, slots: ['acc'], text: v => `스킬 기절·빙결 +${pct(v)}` },
};
const ARMOR_DROP = 0.35;         // 떨어지는 장비 중 방어구 비율 (나머지는 무기)
const ARMOR_SLOT_DROP = { head: 1, body: 1, legs: 1, arm: 1, chip: 0.7, acc: 0.7 }; // 방어구 종류 가중치 (종류를 먼저 고르고 그 안에서 바탕)
const ARMOR_STOCK = 10;          // 상점의 방어구 진열 수 (팔·강화칩·강화장신구 포함)
// 분해 (개조실): 분해하면 등급별 SALVAGE개의 부품
const SALVAGE = [1, 3, 8, 20, 40];
const RARITY_VALUE = [1, 1.6, 2.6, 4.5, 7];  // 등급별 무기 가치 배율 (판매)

// ===== 무기 파츠 (parts.js): 무기마다 칸에 하나씩 — 보급 거점의 개조 자판기 '파츠 개조' 탭에서만 끼우고 뺌 =====
// 칸: 총은 총구·조준경·탄창·개머리판·하부 (에너지·로켓처럼 탄을 쏘지 않는 무기는 총구 없음, 자동이 아닌 권총은 개머리판 없음), 근접은 날·손잡이·모듈
const ATTACH_SLOTS = { muzzle: '총구', sight: '조준경', mag: '탄창', stock: '개머리판', under: '하부', edge: '날', grip: '손잡이', module: '모듈' };
// fx: 효과 (값 하나 또는 등급별 [일반, 고급, 희귀]) — ATT_FX 설명 참고. need: 끼울 수 있는 무기 (bullet 탄을 쏘는 총, single 산탄이 아닌 총,
// pellets 샷건, auto 자동 화기, mag 장탄 3발 이상), size: 가방 칸, price: 일반 등급 값 (ATTACH_MUL배), 그림: att_<이름> (tools/build_assets.py ATTACH_ART)
const ATTACH = {
  suppressor: { name: '소음기',          slot: 'muzzle', size: [2, 1], price: 220, need: 'bullet',  fx: { spread: 0.1, crit: [0.03, 0.05, 0.08], quiet: 1, weight: 0.3 }, desc: '총소리를 줄인다. 멀리 있는 적이 총소리를 듣고 몰려오지 않는다.' },
  brake:      { name: '총구 제동기',     slot: 'muzzle', size: [1, 1], price: 180, need: 'bullet',  fx: { spread: [0.2, 0.28, 0.36], shake: 0.4 }, desc: '총구가 튀는 것을 눌러 연사해도 탄이 덜 퍼진다.' },
  longbarrel: { name: '확장 총열',       slot: 'muzzle', size: [2, 1], price: 240, need: 'single',  fx: { dmg: [0.08, 0.12, 0.16], range: [0.2, 0.25, 0.3], speed: 0.25, weight: 0.5 }, desc: '길어진 총열로 탄이 더 빠르고 멀리, 더 세게 날아간다.' },
  choke:      { name: '산탄 초크',       slot: 'muzzle', size: [1, 1], price: 160, need: 'pellets', fx: { spread: [0.25, 0.35, 0.45], rangeN: [1.5, 2, 2.5] }, desc: '산탄이 덜 퍼지게 모아 준다.' },
  reddot:     { name: '레드닷 조준기',   slot: 'sight',  size: [1, 1], price: 160, fx: { crit: [0.04, 0.06, 0.09] }, desc: '붉은 점에 맞춰 약한 곳을 노린다.' },
  holo:       { name: '홀로 조준기',     slot: 'sight',  size: [1, 1], price: 200, fx: { spread: [0.12, 0.18, 0.24], crit: [0.02, 0.03, 0.04] }, desc: '넓은 시야의 광학 조준기. 탄이 덜 퍼지고 약한 곳도 조금 더 노린다.' },
  scope:      { name: '4배율 스코프',    slot: 'sight',  size: [2, 1], price: 260, fx: { range: [0.3, 0.4, 0.5], crit: [0.08, 0.11, 0.15], rate: -0.08, weight: 0.3 }, desc: '멀리, 정확히. 대신 조준하느라 조금 느리게 쏜다.' },
  thermal:    { name: '열상 조준경',     slot: 'sight',  size: [2, 1], price: 320, fx: { elite: [0.1, 0.15, 0.2], thermal: 1, weight: 0.3 }, desc: '열을 보는 조준경. 숨은 그림자 추적자도 잡아내고, 정예·보스의 약점을 보여 준다.' },
  extmag:     { name: '확장 탄창',       slot: 'mag',    size: [1, 1], price: 180, need: 'mag',     fx: { mag: [0.3, 0.45, 0.6], reload: -0.05 }, desc: '탄이 더 들어가는 긴 탄창.' },
  drum:       { name: '드럼 탄창',       slot: 'mag',    size: [1, 1], price: 300, need: 'auto',    fx: { mag: [0.8, 1, 1.2], reload: -0.25, weight: 1 }, desc: '장탄이 두 배 가까이 되는 대용량 탄창. 무겁고 갈아 끼우기 느리다.' },
  quickmag:   { name: '급속 탄창',       slot: 'mag',    size: [1, 1], price: 200, fx: { reload: [0.2, 0.3, 0.4] }, desc: '손잡이가 달려 빠르게 갈아 끼우는 탄창.' },
  apmag:      { name: '철갑탄 탄창',     slot: 'mag',    size: [1, 1], price: 280, need: 'bullet',  fx: { ap: [0.5, 0.75, 1] }, desc: '단단한 탄심의 철갑탄. 철갑 거수 같은 장갑을 뚫는다.' },
  incmag:     { name: '소이탄 탄창',     slot: 'mag',    size: [1, 1], price: 260, need: 'bullet',  fx: { fire: [0.1, 0.15, 0.2] }, desc: '맞으면 불붙는 소이탄.' },
  lightstock: { name: '경량 개머리판',   slot: 'stock',  size: [2, 1], price: 180, fx: { lighter: [0.25, 0.35, 0.45], reload: [0.05, 0.08, 0.12] }, desc: '가벼운 접이식 개머리판. 무게가 줄고 다루기 쉬워진다.' },
  heavystock: { name: '안정 개머리판',   slot: 'stock',  size: [2, 1], price: 200, fx: { spread: [0.12, 0.18, 0.24], dmg: [0.04, 0.06, 0.08], weight: 0.5 }, desc: '어깨에 단단히 붙는 개머리판. 흔들림이 줄어 정확하고 세게 맞힌다.' },
  vgrip:      { name: '수직 손잡이',     slot: 'under',  size: [1, 1], price: 150, fx: { spread: [0.12, 0.18, 0.24] }, desc: '앞손잡이를 잡아 총을 단단히 고정한다.' },
  laser:      { name: '레이저 조준기',   slot: 'under',  size: [1, 1], price: 180, fx: { crit: [0.03, 0.05, 0.07], spread: 0.08 }, desc: '붉은 레이저가 맞을 곳을 짚어 준다.' },
  serrated:   { name: '톱니 날',         slot: 'edge',   size: [1, 1], price: 200, fx: { dmg: [0.1, 0.15, 0.2] }, desc: '날에 톱니를 덧대 더 깊이 벤다.' },
  weight:     { name: '무게추',          slot: 'edge',   size: [1, 1], price: 180, fx: { knock: 0.6, stun: [0.15, 0.22, 0.3], rate: -0.1, weight: 0.5 }, desc: '머리에 쇳덩이를 단다. 더 밀어내고 더 오래 기절시키지만 느려진다.' },
  mono:       { name: '단분자 날',       slot: 'edge',   size: [1, 1], price: 300, fx: { crit: [0.08, 0.12, 0.16] }, desc: '분자 하나 두께의 날. 갑옷 틈을 파고들어 치명타가 잘 터진다.' },
  wrap:       { name: '가죽 손잡이',     slot: 'grip',   size: [1, 1], price: 150, fx: { rate: [0.08, 0.12, 0.16] }, desc: '미끄러지지 않는 손잡이. 더 빠르게 휘두른다.' },
  absorb:     { name: '충격흡수 손잡이', slot: 'grip',   size: [1, 1], price: 160, fx: { stamina: [0.2, 0.3, 0.4] }, desc: '반동을 흡수해 덜 지친다.' },
  shockmod:   { name: '방전 모듈',       slot: 'module', size: [1, 1], price: 260, fx: { shock: [0.12, 0.18, 0.25] }, desc: '맞힐 때 전기를 흘려 적을 기절시킨다.' },
  firemod:    { name: '화염 모듈',       slot: 'module', size: [1, 1], price: 240, fx: { fire: [0.15, 0.22, 0.3] }, desc: '날을 달궈 맞은 적에게 불을 붙인다.' },
  cryomod:    { name: '냉각 모듈',       slot: 'module', size: [1, 1], price: 240, fx: { cryo: [0.15, 0.22, 0.3] }, desc: '냉각제를 뿜어 맞은 적을 느리게 만든다.' },
};
// 효과 설명 (fx 키별)
const ATT_FX = {
  dmg: v => `피해 +${pct(v)}`, spread: v => `탄퍼짐 -${pct(v)}`, crit: v => `치명타 확률 +${pct(v)}`, range: v => `사거리 +${pct(v)}`,
  rangeN: v => `사거리 +${v}칸`, speed: v => `탄속 +${pct(v)}`, mag: v => `장탄수 +${pct(v)}`,
  reload: v => v >= 0 ? `재장전 시간 -${pct(v)}` : `재장전 시간 +${pct(-v)}`, rate: v => v >= 0 ? `공격속도 +${pct(v)}` : `공격속도 -${pct(-v)}`,
  weight: v => `무게 +${v}`, lighter: v => `무게 -${pct(v)}`, shake: v => `반동 -${pct(v)}`, elite: v => `정예·보스에게 피해 +${pct(v)}`,
  ap: v => `장갑을 뚫을 확률 ${pct(ARMOR_PIERCE + (1 - ARMOR_PIERCE) * v)}`, fire: v => `명중 시 ${pct(v)} 확률로 화상`, cryo: v => `명중 시 ${pct(v)} 확률로 둔화`, shock: v => `명중 시 ${pct(v)} 확률로 기절`,
  knock: v => `넉백 +${pct(v)}`, stun: v => `기절 +${v}초`, stamina: v => `스태미너 소모 -${pct(v)}`,
  quiet: () => '총소리가 작아짐 (멀리 있는 적이 덜 몰려옴)', thermal: () => '숨은 그림자 추적자도 자동 조준',
};
const ATTACH_MUL = [1, 2, 4];       // 등급별(일반·고급·희귀) 값 배율 (구매가 · 판매가 = 값 x SELL_RATE)
const ATTACH_DROP = { kill: 0.015, elite: 0.4, crate: 0.08, boss: 2, thief: 2 }; // 파츠가 떨어질 확률 (보스·보물 약탈자는 개수)
const ATTACH_ON_LOOT = 0.3;          // 희귀 이상 무기가 맞는 파츠 하나를 달고 나올 확률
const ATTACH_STOCK = 12;             // 보급 자판기 '파츠' 진열 수
const BURST_GAP = 0.07;              // 점사 무기의 발과 발 사이 (초)
const SHELL_LOAD = 0.75;             // 샷건: 한 발씩 장전 — 한 발 시간 = 재장전 / 장탄 x SHELL_LOAD (넣는 대로 장탄이 오르고 한 발마다 소리, 쏘면 장전을 멈추고 넣은 만큼 쏨)
const PICKUP_MAGNET = { r: 2.2, v: 10 };            // 골드: 이 거리(칸) 안이면 v칸/초로 끌려와 저절로 주워짐

// ===== 고유 전설 장비 =====
// base: 바탕 무기, affixes: 정해진 옵션, effect: 고유 효과 설명 (효과는 game.js에서 키 이름으로 처리), flavor: 붉은 글씨 한 줄, tracer: 탄 색
const UNIQUES = {
  vamp:     { base: 'knife',       name: '핏빛 송곳니',  affixes: [{ k: 'dmg', v: 0.3 }, { k: 'rate', v: 0.2 }],
              effect: '근접 공격으로 준 피해의 15%만큼 체력 회복', flavor: '베어 낸 만큼 살아남는다.' },
  frost:    { base: 'hammer',      name: '영구동토',     affixes: [{ k: 'dmg', v: 0.25 }, { k: 'crit', v: 0.1 }],
              effect: '맞은 적을 얼림, 얼어 있는 적을 치면 산산조각 (피해 2배)', flavor: '케르베로스-7 냉각 코어에서 뜯어낸 쐐기.' },
  bolt:     { base: 'spear',       name: '뇌격창',       affixes: [{ k: 'dmg', v: 0.25 }, { k: 'rate', v: 0.15 }],
              effect: '찌를 때마다 번개가 앞으로 6칸 뻗어 일직선의 적을 꿰뚫음 (피해 60%)', flavor: '고압선에 꽂아 두고 잊어버린 창.' },
  judge:    { base: 'revolver',    name: '심판자',       affixes: [{ k: 'dmg', v: 0.2 }, { k: 'reload', v: 0.3 }],
              effect: '실린더의 마지막 탄은 피해 3배, 반드시 치명타', flavor: '여섯 번째 탄에는 언제나 이름이 새겨져 있다.' },
  ricochet: { base: 'pump',        name: '도탄 사수',    affixes: [{ k: 'dmg', v: 0.2 }, { k: 'mag', v: 0.5 }],
              effect: '산탄이 벽에 한 번 튕겨 나감', flavor: '좁은 복도에서 쏴라. 벽이 대신 조준해 준다.' },
  dragon:   { base: 'autoshotgun', name: '용의 숨결',    affixes: [{ k: 'rate', v: 0.15 }, { k: 'mag', v: 0.4 }], tracer: '#ff8a30',
              effect: '산탄에 맞은 적은 반드시 불탐', flavor: '소이 산탄 전용. 소방 규정 위반.' },
  blast:    { base: 'marksman',    name: '폭심',         affixes: [{ k: 'dmg', v: 0.2 }, { k: 'reload', v: 0.25 }], tracer: '#ffb060',
              effect: '꿰뚫은 적마다 그 자리가 폭발 (반경 1.8칸, 피해 60%)', flavor: '관통하고, 터진다. 다섯 번.' },
  venom:    { base: 'assault',     name: '맹독 살포기',  affixes: [{ k: 'dmg', v: 0.15 }, { k: 'acc', v: 0.4 }], tracer: '#a8f050',
              effect: '맞은 적은 중독, 중독된 적이 죽으면 독가스를 뿜음', flavor: '연구동 B-3 실험체의 혈청을 탄두에 발랐다.' },
  fury:     { base: 'mg',          name: '분노의 회전',  affixes: [{ k: 'dmg', v: 0.15 }, { k: 'reload', v: 0.3 }],
              effect: '총열이 다 돌면 탄이 적을 2번 더 꿰뚫고, 들고 있어도 느려지지 않음', flavor: '멈추지 않으면 무겁지도 않다.' },
  arc:      { base: 'plasma',      name: '과부하 코일',  affixes: [{ k: 'dmg', v: 0.15 }, { k: 'mag', v: 0.4 }],
              effect: '플라즈마 탄이 맞힌 뒤 가까운 적에게 2번 더 튀어 감', flavor: '안전 제한기를 떼어 냈다. 무엇이 잘못될 수 있겠는가?' },
  cluster:  { base: 'launcher',    name: '벌집',         affixes: [{ k: 'dmg', v: 0.2 }, { k: 'mag', v: 0.5 }],
              effect: '로켓이 터지면 작은 폭탄 4개가 흩어져 연쇄 폭발', flavor: '하나를 쏘면 다섯 번 터진다.' },
};
// 고유 전설이 떨어질 확률: 보스(첫 번째 전리품), 정예, 임무 보상, 그 밖의 적 처치 (바탕 무기가 나오는 구역부터)
const UNIQUE_DROP = { boss: 0.35, elite: 0.06, mission: 0.12, kill: 0.00025 };
const UNIQUE_RATE = 0.5; // 고유 전설(무기·쉘)이 나올 확률 배율 — 모든 곳 (보스·정예·고유 정예·금고·시련·약탈자·임무·처치)
const SELL_RATE = 0.25;          // 판매가 = 가치 x 0.25 (구매가는 가치 그대로)

// ranged: 원거리 공격 정보 (volley: 한 번에 부채꼴로 쏘는 수, burst: 간격 gap초로 이어 쏘는 연사 수), keep: 유지 거리,
// loot: 무기 드롭 확률, lootBonus: 상위 등급 보너스
// from: 처음 나오는 구역, w: 출현 가중치, cost: 위협도 (방마다 위협 예산만큼 채우므로 강한 적이 섞일수록 마릿수가 줄어듦)
// 움직임·공격 패턴 (game.js에서 처리)
//  hop: 깡충 이동 — v칸/초로 dur초씩 뛰고(높이 h) rest초 쉬기를 되풀이, pounce칸 안이면 pv칸/초·pdur초·높이 ph로 크게 덮침 (pcd초마다)
//  dodge: 조준당해 총에 맞을 것 같으면 chance 확률로 옆으로 뜀 (min칸보다 멀 때, cd초마다) — 날아오던 자동 조준 탄이 빗나감
//  lob: 다가오면서 가끔 던지는 원거리 공격 (min~range칸, wind초 예고 동작 뒤 발사, rate초마다)
//  armor: 장갑 — 직접 맞은 한 발마다 피해를 그만큼 덜 받음 (최소 20%는 들어감, 화상·중독은 그대로, ARMOR_PIERCE 확률로 뚫리면 그대로), heavy: 거의 밀리지 않고 기절·빙결도 짧음
//  fixed: 제자리에서 움직이지 않고 밀리지도 않음 (corpse: 그래도 시체를 남김), roomMax: 방 하나에 놓는 최대 수
//  pillar: 보이는 플레이어의 발밑에 붉은 원을 띄우고 wind초 뒤 불기둥 (반경 r칸, 피해 dmg, 화상 burn초) — range칸 안에서 rate초마다
// 장갑을 뚫을 확률: 몇 발에 한 발은 장갑을 뚫고 무기 피해가 그대로 들어감. 철갑탄(ap)이면 더 자주 — 확률 = ARMOR_PIERCE + (1 - ARMOR_PIERCE) x ap
const ARMOR_PIERCE = 0.3;
const ENEMIES = {
  crawler: { name: '크롤러',     hp: 22,  spd: 4.0, r: 0.25, dmg: 6,  atkRate: 0.6, gold: 5,   blood: '#7b4', loot: 0.03, from: 1, w: 5, cost: 1,
             hop: { v: 5.5, dur: 0.22, h: 12, rest: [0.08, 0.2], pounce: 3.2, pv: 8.5, pdur: 0.36, ph: 28, pcd: 2.4 } },
  // 질주 크롤러: 크롤러의 붉은 변종 — 약하지만 크롤러보다 빠르게 뛰어든다 (보이면 깡충 약 5.3칸/초, 안 보일 때 기어서 5.4칸/초 — 크롤러는 약 4,
  // 플레이어는 걷기 4.3 · 달리기 6.9라 달리면 따돌릴 수 있음). 덮치기는 3칸 안에서 8칸/초
  runner:  { name: '질주 크롤러', hp: 16,  spd: 5.4, r: 0.22, dmg: 5,  atkRate: 0.5, gold: 5,   blood: '#c63', loot: 0.02, from: 1, w: 3, cost: 1,
             hop: { v: 6.5, dur: 0.18, h: 9, rest: [0.02, 0.06], pounce: 3.2, pv: 8, pdur: 0.38, ph: 22, pcd: 1.6 } },
  xenoid:  { name: '제노이드',   hp: 70,  spd: 2.8, r: 0.35, dmg: 14, atkRate: 0.9, gold: 20,  blood: '#9c3', loot: 0.07, from: 1, w: 4, cost: 2,
             dodge: { chance: 0.5, cd: 1.8, v: 8, dur: 0.22, h: 16, min: 2.5 } },
  spitter: { name: '스피터',     hp: 50,  spd: 1.9, r: 0.35, dmg: 8,  atkRate: 1.0, gold: 25,  blood: '#bd2', loot: 0.08, keep: 4.5, from: 2, w: 3, cost: 2,
             ranged: { type: 'acid', dmg: 9, rate: 1.8, range: 8, speed: 8 } },
  sparker: { name: '스파크 드론', hp: 45,  spd: 2.4, r: 0.3,  dmg: 6,  atkRate: 1.0, gold: 30,  blood: '#9cf', loot: 0.08, keep: 4, fly: true, from: 4, w: 3, cost: 2,
             ranged: { type: 'shock', dmg: 7, rate: 2.2, range: 7, speed: 12 } },
  brute:   { name: '브루트',     hp: 320, spd: 1.7, r: 0.55, dmg: 34, atkRate: 1.5, gold: 120, blood: '#8b3', loot: 0.4, lootBonus: 1, knock: 9, from: 3, w: 1.5, cost: 5,
             lob: { type: 'ball', dmg: 16, rate: 3.6, min: 3, range: 10, speed: 7.5, wind: 0.35 } }, // 녹색 에너지 구체를 던짐 (Doom의 바론처럼)
  // 철갑 거수: 아주 느리지만 맷집이 세다 — 장갑 때문에 기관총·산탄 같은 약한 탄은 잘 안 통하고 (몇 발에 한 발만 뚫림), 강한 한 방(저격·리볼버·강타·폭발)이 잘 통함
  juggernaut: { name: '철갑 거수', hp: 600, spd: 0.9, r: 0.62, dmg: 32, atkRate: 1.8, gold: 150, blood: '#a43', loot: 0.45, lootBonus: 1, knock: 11, armor: 8, heavy: true, from: 7, w: 1.2, cost: 6 },
  // 후반 적 (4~7구역부터)
  // 차저: 보이면 웅크렸다가(붉게 번쩍) 일직선으로 돌진, 맞으면 크게 밀려남. 벽에 박으면 잠시 기절
  charger: { name: '차저',       hp: 120, spd: 3.0, r: 0.4,  dmg: 14, atkRate: 0.9, gold: 40,  blood: '#c55', loot: 0.1,  knock: 5, from: 5, w: 3, cost: 3,
             charge: { range: 7, wind: 0.55, speed: 11, dur: 0.55, stun: 1.2, cd: 3, mul: 2.2 } },
  // 감염 해병: 거리를 두고 5발씩 연사
  gunner:  { name: '감염 해병',   hp: 80,  spd: 1.9, r: 0.33, dmg: 8,  atkRate: 1.0, gold: 35,  blood: '#a33', loot: 0.15, keep: 5, from: 7, w: 3, cost: 3,
             ranged: { type: 'bullet', dmg: 5, rate: 2.8, range: 10, speed: 18, burst: 5, gap: 0.09, spread: 0.1 } },
  // 브루더: 떠다니며 크롤러를 낳음 (최대 max마리), 죽으면 크롤러 deathSpawn마리가 쏟아짐
  brooder: { name: '브루더',     hp: 200, spd: 1.3, r: 0.5,  dmg: 10, atkRate: 1.2, gold: 70,  blood: '#c7a', loot: 0.12, keep: 6, fly: true, from: 6, w: 2, cost: 4,
             spawn: { type: 'crawler', rate: 5, max: 3 }, deathSpawn: 2 },
  // 모르타르: 느리고 단단함, 화염탄 3발을 부채꼴로
  mortar:  { name: '모르타르',   hp: 380, spd: 1.0, r: 0.65, dmg: 22, atkRate: 1.6, gold: 110, blood: '#b62', loot: 0.35, lootBonus: 1, knock: 8, keep: 6.5, from: 8, w: 2, cost: 5,
             ranged: { type: 'fireball', dmg: 12, rate: 3.4, range: 11, speed: 6, volley: 3, spread: 0.22, snd: 'fireball' } },
  // 감시자: 움직이지 않고 원거리 공격만 — 발밑의 붉은 원을 보면 바로 비켜라
  watcher: { name: '감시자',     hp: 130, spd: 0,   r: 0.42, dmg: 0,  atkRate: 99,  gold: 40,  blood: '#a43', loot: 0.15, fixed: true, corpse: true, roomMax: 2, from: 2, w: 1.6, cost: 3,
             pillar: { dmg: 22, rate: 2.6, range: 12, wind: 0.9, r: 1.25, burn: 2 } },
  // 방패 해병: 앞을 푸른 에너지 방패로 막음 — 정면(arc 라디안 부채꼴)에서 온 탄·근접 공격은 cut만큼 덜 받음 (폭발·스킬·지속 피해는 그대로,
  // 기절·빙결 중에는 방패가 꺼짐). react초마다 그때 플레이어가 있던 쪽을 정하고 천천히(turn 라디안/초) 돌아서므로 옆·뒤로 돌아가면 그대로 들어감,
  // 공격할 때(근접·사격)는 drop초 동안 방패가 내려감. 방패 내구도 = 최대 체력 x hp — 막은 공격의 피해만큼 닳고 다 닳으면 부서짐
  shielder: { name: '방패 해병',   hp: 150, spd: 1.7, r: 0.38, dmg: 16, atkRate: 1.1, gold: 45,  blood: '#a33', loot: 0.15, knock: 6, from: 4, w: 2, cost: 3,
              shield: { arc: 1.5, cut: 0.85, turn: 0.9, react: 0.6, drop: 0.8, hp: 0.6 } },
  // 폭주 해골: 불붙은 해골이 날아와 near칸 안에 들면 불이 붙어 fuse초 뒤 터짐 (반경 r칸, 피해 dmg — 플레이어·생존자·설치물·다른 적 모두)
  // 그 전에 쏘아 떨어뜨리면 그 자리에서 early배로 약하게 터짐. 시체를 남기지 않고 정예가 되지 않음
  bomber:   { name: '폭주 해골',   hp: 28,  spd: 3.8, r: 0.3,  dmg: 0,  atkRate: 99,  gold: 8,   blood: '#f84', loot: 0.02, fly: true, from: 2, w: 2, cost: 1.5,
              bomb: { near: 1.3, fuse: 0.65, r: 2.2, dmg: 36, early: 0.6 } },
  // 그림자 추적자: 거의 보이지 않음 (동작 추적기에는 잡힘). min~range칸 떨어지면 cd초마다 플레이어 등 뒤 back칸으로 순간이동해 기습,
  // 그 기습으로 한 대 치면 flee칸 밖으로 다시 사라짐 (걸어와서 싸울 때는 그대로). 맞으면 reveal초 동안 드러남
  assassin: { name: '그림자 추적자', hp: 95, spd: 3.3, r: 0.38, dmg: 18, atkRate: 1.0, gold: 45,  blood: '#a5c', loot: 0.12, from: 5, w: 2, cost: 3,
              blink: { cd: 4.5, min: 3.5, range: 13, back: 1.3, flee: 5, reveal: 2.5 } },
  // 되살리는 자: 거리를 두고 다니며 rate초마다 range칸 안의 가장 가까운 시체를 wind초 주문 뒤 일으켜 세움 (체력 hp배, 동시에 max마리까지)
  // 되살아난 적은 경험치·전리품이 없음 — 먼저 처치할 것
  summoner: { name: '되살리는 자', hp: 170, spd: 1.6, r: 0.42, dmg: 8,  atkRate: 1.2, gold: 70,  blood: '#7b4', loot: 0.2, keep: 6, roomMax: 1, from: 8, w: 1.2, cost: 4,
              raise: { rate: 6, range: 8, wind: 0.9, max: 5, hp: 0.7 } },
  // 매복자: 천장에 붙어 숨어 있음 (보이지 않고 맞지 않음 — 바닥에 옅은 그림자만 어른거림). 플레이어가 drop칸 안에 오면 그 바로 위로 기어가 warn초 동안 그림자가 짙어진 뒤
  // fall초 만에 떨어져 덮침 (r칸 안이면 피해 hit + knock만큼 밀려남). 내려온 뒤로는 빠르게 붙어 할퀴는 근접 적 (무리로 몰려올 때는 천장에 붙지 않음)
  lurker:   { name: '매복자',     hp: 120, spd: 3.3, r: 0.4,  dmg: 15, atkRate: 0.8, gold: 35,  blood: '#a5c', loot: 0.12, from: 4, w: 2, cost: 3,
              ceiling: { drop: 2.8, warn: 0.6, fall: 0.3, r: 1.1, hit: 24, knock: 7 } },
  // 굴착자: 플레이어를 알아채면 바닥 밑으로 파고들어 (dig초, 땅속에서는 보이지 않고 맞지 않음 — 흙더미가 움직이는 자국만) spd칸/초로 다가오고, near칸 안에 들거나 max초가 지나면
  // warn초 동안 땅이 흔들린 뒤 솟아오르며 r칸 안을 쳐 올림 (피해 hit + 밀려남). up초 동안 땅 위에서 싸우다가 다시 파고듦
  burrower: { name: '굴착자',     hp: 160, spd: 2.2, r: 0.4,  dmg: 16, atkRate: 1.0, gold: 45,  blood: '#a73', loot: 0.15, from: 8, w: 1.8, cost: 3,
              burrow: { spd: 4.2, near: 1.4, max: 6, warn: 0.6, r: 1.3, hit: 20, knock: 6, up: 4.5, dig: 0.5 } },
  // 수호 드론: 떠다니며 거리를 두고, range칸 안의 다른 적 n마리까지 보호막을 씌움 — 보호막을 받은 적은 직접 맞는 피해를 cut만큼 덜 받음 (지속 피해는 그대로, 보스는 제외).
  // 드론을 쓰러뜨리면 보호막이 모두 꺼짐. 스스로는 공격하지 않고 약함, 터지며 사라짐 (시체 없음)
  warden:   { name: '수호 드론',   hp: 60,  spd: 2.6, r: 0.3,  dmg: 0,  atkRate: 99,  gold: 40,  blood: '#9cf', loot: 0.12, keep: 6, fly: true, roomMax: 1, nocorpse: true, from: 7, w: 1.5, cost: 3,
              ward: { range: 5.5, n: 4, cut: 0.6 } },
  // 보스: 다음 구역으로 가는 길목 방(코어는 가장 안쪽 방)을 지키고, 쓰러뜨리면 봉쇄 격벽이 열림 (boss 값이 공격 방식)
  // 타이탄: 로켓 연사 (격노하면 5발, 살짝 따라옴), 가까우면 발을 들었다가 내려찍어 충격파 (stomp — wind초 예고, 격노하면 두 번),
  // 로켓 포격 (barrage — 플레이어 자리와 둘레 spread칸 안 n곳을 붉은 원으로 예고, gap초 간격으로 떨어져 반경 r칸 폭발)
  titan:      { name: '타이탄',     hp: 1600, spd: 1.5, r: 0.75, dmg: 40, atkRate: 1.6, gold: 800, blood: '#9c3', lootBonus: 3, knock: 10, boss: 'titan',
                stomp: { wind: 0.4, r: 5.5, speed: 8.5, dmg: 30 }, barrage: { n: 5, rate: 7, flight: 1.2, gap: 0.15, spread: 3.2, r: 1.8, dmg: 30 } },
  // 하이브 마더: 산성액 부채꼴, 크롤러 소환, 산성 고리 (nova — n발), 산성 비 (rain — 떨어질 곳 예고 → 반경 r칸 독 웅덩이 t초)
  hivemother: { name: '하이브 마더', hp: 1900, spd: 1.2, r: 0.85, dmg: 30, atkRate: 1.4, gold: 900, blood: '#bd2', lootBonus: 3, boss: 'hive',
                nova: { n: 16, rate: 5.5, speed: 6, dmg: 9 }, rain: { n: 5, rate: 7.5, flight: 1.1, r: 1.4, t: 4, dmg: 12 } },
  // 최종 보스: 움직이지 않는 군체의 뇌. 몬스터가 깨어나는 포자를 쏘고 화염탄을 뿌림 (fixed: 밀려나지 않음), 발밑을 쫓는 불기둥 (pyre — 단계마다 n개)
  // 체력 65% 밑: 화염탄 고리 (nova), 30% 밑: 쌍둥이 광선이 방을 휩씀 (laser — 반대쪽에도 한 줄기, z: 광선이 나오는 높이 px)
  overmind:   { name: '오버마인드', hp: 2600, spd: 0, r: 1.0, dmg: 0, atkRate: 99, gold: 0, blood: '#c46', lootBonus: 3, boss: 'brain', fixed: true,
                pyre: { rate: 6, n: [3, 4, 5], wind: 0.9, r: 1.1, dmg: 22, burn: 2 }, nova: { n: 18, rate: 5, speed: 5.5, dmg: 11 },
                laser: { rate: 9, wind: 1.2, dur: 3.2, sweep: 1.2, len: 16, dmg: 8, tick: 0.12, z: 40 } },
  // 구역 보스 (REGION_BOSSES): boss 값이 공격 방식, xp: 처치 경험치. 체력이 절반 밑이면 격노 (빨라지고 공격이 잦아짐)
  // 파쇄 짐승: 붉은 띠로 예고한 뒤 일직선 돌진 (charge — 벽에 박히면 stun초 기절, 그동안 받는 피해 vuln배, chain: 이어 돌진 횟수 [보통, 격노] — 이어지는 웅크림은 chainWind배),
  // 가까우면 뛰어올라 내려찍어 충격파 (slam), 떨어져 있으면 플레이어가 있던 곳으로 크게 도약 (leap — min~max칸, 내려앉을 곳은 붉은 원, 반경 r칸 피해 + 충격파)
  crusher:     { name: '파쇄 짐승', hp: 900, spd: 2.4, r: 0.75, dmg: 18, atkRate: 1.3, gold: 400, blood: '#b62', lootBonus: 2, knock: 9, boss: 'crusher', xp: 160, vuln: 1.5,
                 charge: { range: 13, wind: 0.8, speed: 13, dur: 0.95, stun: 2.2, cd: 4.5, mul: 2.2, chain: [0, 2], chainWind: 0.45 }, slam: { near: 3.2, cd: 5, wind: 0.45, r: 4.5, speed: 9, dmg: 20 },
                 leap: { min: 5, max: 11, cd: 7.5, wind: 0.55, dur: 0.75, h: 70, r: 2, dmg: 26 } },
  // 번식 모체: 떠다니며 거리를 두고, rate초마다 n마리씩 낳고 (동시에 max마리까지, pool에서 뽑음) 산성액을 부채꼴로 (spray — 격노하면 두 번),
  // 알을 던짐 (egg — 떨어진 곳에 산성 웅덩이 + 새끼 하나), 격노하면 빙글 돌며 산성액을 사방으로 (whirl — arms갈래로 gap초마다 turn라디안씩 돌며 dur초)
  broodmother: { name: '번식 모체', hp: 1100, spd: 1.3, r: 0.85, dmg: 14, atkRate: 1.2, gold: 450, blood: '#9c4', lootBonus: 2, keep: 5, fly: true, boss: 'brood', xp: 200,
                 brood: { rate: 4.5, n: 2, max: 9, pool: { crawler: 3, runner: 2, bomber: 1.5 } }, spray: { n: 5, spread: 0.16, rate: 2.8, speed: 8, dmg: 9 },
                 egg: { n: 3, rate: 6.5, flight: 1.1, r: 1.2, t: 3, dmg: 12 }, whirl: { arms: 2, gap: 0.1, turn: 0.3, dur: 2.2, rate: 7, speed: 6.5, dmg: 9 } },
  // 감시 포대 아르고스: 떠다니며 사방으로 퍼지는 탄 고리 (ring)와 소용돌이 탄 (spiral — arms갈래로 gap초마다 turn라디안씩 돌며 dur초, 격노하면 거꾸로 도는 소용돌이가 겹침),
  // 조준 연사 (aimed — n발을 gap초마다, 날아가는 동안 플레이어가 갈 곳을 앞질러)
  argus:       { name: '감시 포대 아르고스', hp: 1500, spd: 1.1, r: 0.85, dmg: 12, atkRate: 1.4, gold: 600, blood: '#c4a', lootBonus: 3, keep: 6, fly: true, boss: 'argus', xp: 300,
                 orb: { speed: 5.2, dmg: 11 }, ring: { n: 14, rate: 3.4 }, spiral: { arms: 3, gap: 0.09, turn: 0.26, dur: 2.4, rate: 7.5 },
                 aimed: { n: 6, gap: 0.12, rate: 4.5, speed: 7.5 } },
  // 역병 거인: 독액 덩어리 n개를 던져 독 웅덩이 (glob — 반경 r칸, t초, 격노하면 두 번에 한 번은 플레이어를 빙 둘러쌈), 주위에 독구름 (cloud — wind초 예고 뒤 반경 r칸, t초),
  // 독액 토하기 (vomit — near칸 안이면 wind초 동안 부채꼴 예고 → dur초 동안 ±sweep을 쓸며 gap초마다 한 발)
  plaguegiant: { name: '역병 거인', hp: 1800, spd: 0.95, r: 0.9, dmg: 26, atkRate: 1.8, gold: 700, blood: '#9b3', lootBonus: 3, knock: 10, boss: 'plague', xp: 350,
                 glob: { n: 3, rate: 3.2, flight: 1, r: 1.5, t: 6, dmg: 14 }, cloud: { rate: 8, wind: 0.8, r: 3.6, t: 3.5 },
                 vomit: { rate: 7, near: 8, wind: 0.6, dur: 1.4, gap: 0.05, sweep: 0.75, speed: 7, dmg: 10 } },
  // 공허 사제: warp초마다 순간이동 (나타나며 공허 구체 고리 — orbs), rate초마다 불기둥 무늬 (pyre — 십자·줄·고리·추적), 시체를 일으킴 (raise)
  voidpriest:  { name: '공허 사제', hp: 2000, spd: 2.0, r: 0.55, dmg: 20, atkRate: 1.2, gold: 800, blood: '#a5c', lootBonus: 3, keep: 4, boss: 'void', xp: 450,
                 warp: { rate: 4.5, min: 4, max: 7 }, pyre: { rate: 3.6, wind: 0.95, r: 1.2, dmg: 24, burn: 2 }, raise: { rate: 8, range: 9, wind: 0.8, max: 4, hp: 0.6 },
                 orbs: { n: 8, speed: 4.5, dmg: 14 } },
  // 처형자: 유도 미사일 n발 (missile — 초당 turn라디안 꺾임), 레이저 (laser — wind초 조준선 뒤 dur초 동안 ±sweep라디안을 쓸고 지나감, 닿는 동안 tick초마다 dmg, 격노하면 반대쪽에도 한 줄기),
  // 연속 돌진 베기 (charge — 붉은 띠 예고, chain번 더 이어짐 [보통, 격노])
  executioner: { name: '처형자', hp: 2200, spd: 2.3, r: 0.65, dmg: 30, atkRate: 1.2, gold: 900, blood: '#a33', lootBonus: 3, knock: 8, boss: 'exec', xp: 500,
                 missile: { n: 2, rate: 3.2, speed: 6.5, turn: 1.7, dmg: 18, life: 4 }, laser: { rate: 7, wind: 0.9, dur: 1.4, sweep: 0.7, len: 14, dmg: 9, tick: 0.12 },
                 charge: { range: 11, wind: 0.5, speed: 17, dur: 0.4, stun: 0.8, cd: 6.5, mul: 1, chain: [2, 3], chainWind: 0.65 } },
  // 둥지 (둥지 파괴 임무 전용): 움직이지 않고 옆에 몬스터를 낳음. 구역에 오래 있을수록 자주·많이
  // brood: rate초마다 → 4분에 걸쳐 min초까지 빨라짐, 둥지 하나당 max마리 → 4분 뒤 max+2마리, 모든 둥지 합쳐 cap마리까지, pool에서 뽑음
  nest: { name: '번식 둥지', hp: 360, spd: 0, r: 0.6, dmg: 0, atkRate: 99, gold: 80, blood: '#c46', cost: 5, fixed: true, nest: true,
          brood: { rate: 7, min: 3, max: 4, cap: 36, pool: { crawler: 4, runner: 2, xenoid: 3, spitter: 2 } } },
  // 보물 약탈자: 방이 채워질 때 드물게 하나 (THIEF — 구역 출현 표에는 없음). 싸우지 않고, 들키면 멀어지는 쪽으로 달아나다 차원 틈으로 사라짐
  thief: { name: '보물 약탈자', hp: 240, spd: 5.0, r: 0.3, dmg: 0, atkRate: 99, gold: 0, blood: '#a01414', loot: 0, cost: 0, thief: true },
};
// 보물 약탈자: room — 방이 채워질 때 나타날 확률 (구역마다 한 번까지), escape — 들킨 뒤 사라지기까지 (초),
// drop — 체력이 이 비율만큼 깎일 때마다 골드를 흘림, 처치 보상: 골드 무더기 piles개 (gold x 구역), 장비 items개, 고유 전설 확률, 경험치 xp x 구역
const THIEF = { room: 0.04, escape: 15, drop: 0.15, piles: 8, gold: [30, 70], items: 2, unique: 0.1, xp: 40 };
// 방 하나의 위협 예산 = 앞 값 + 뒤 값 x 구역 (±30%) — 구역 1 약 115마리, 구역 9 약 210마리 (예전의 4~5배)
const ROOM_BUDGET = [10.5, 6];
const START_EASE = [0.5, 0.75]; // 막 첫 구역(1·4·7)에서 들어오는 곳(구역 1은 착륙 지점)에 가장 가까운 방들의 위협 예산 배율 (막의 첫 싸움은 작게)
// 난이도 곡선 (구역 1~9): 앞 구역은 적을 덜, 약하게 해서 서서히 어려워지게. 1이면 원래대로
// room: 방·적 무리·시련의 적 수 (위협 예산)와 고유 정예의 부하 수, hp·dmg: 적 체력·피해, elite: 정예·고유 정예가 더 받는 체력·피해 몫, boss: 보스 체력
// 적이 적은 만큼 일반 적 한 마리의 경험치·골드·장비 확률은 1 / room 배 (구역마다 얻는 양은 비슷하게)
// 구역마다 적이 세지는 정도 (구역 1 기준): 체력·피해 (앞 구역은 아래 CURVE로 더 약하게)
const ENEMY_GROW = { hp: 0.13, dmg: 0.12 };
const BOSS_BOOST = { hp: 5.1, dmg: 4.5 }; // 보스(구역 보스·막 보스)의 체력·피해 배율 (CURVE.boss·ENEMY_GROW 위에) — 0.37: 0.34의 x1.3 · x1.25
const BOSS_CAGE = { regen: 0.25 }; // 보스는 보스방 밖으로 나오지 않음 (들어서면 입구가 잠김). 플레이어가 보스방 밖(문간)이면 쫓지 않고 제자리로, 초당 최대 체력의 regen만큼 회복 (밖에서 쏴서는 못 잡음)
const CURVE = {
  room:  [0.65, 0.75, 0.85, 0.95, 1, 1, 1, 1, 1],
  hp:    [0.8, 0.88, 0.94, 0.98, 1, 1, 1, 1, 1],
  dmg:   [0.75, 0.82, 0.88, 0.95, 1, 1, 1, 1, 1],
  elite: [0.6, 0.7, 0.8, 0.9, 1, 1, 1, 1, 1],
  boss:  [0.6, 0.75, 0.85, 0.95, 1, 1, 1, 1, 1],
};
const ROOM_MAX = 36;          // 방 하나에 놓는 적 최대 수
const HEAVY_MAX = [1, 4];     // 방 하나의 위협도 5 이상(브루트·모르타르·철갑 거수) 최대 수 = 앞 값 + 구역 / 뒤 값 (나머지는 가벼운 적으로)
// 적이 많아진 만큼 한 마리가 주는 보상은 줄임 (일반 적만, 정예·보스는 그대로): 골드, 아이템·수류탄, 무기 — 탄약은 그대로
const KILL_REWARD = { gold: 0.25, item: 0.5, loot: 0.25 };

// ===== 캐릭터 성장 =====
// 적을 처치하면 경험치, 레벨이 오를 때마다 특성 점수 1점 (스킬 창 [K]), 모든 스킬 위력 +SKILL_PER_LEVEL (특성: 사격·생존·전술 트리, 캠페인 끝까지 약 13점)
const XP_NEXT = [100, 200];   // 다음 레벨까지 필요 경험치 = 앞 값 + 뒤 값 x 현재 레벨 (1구역 끝 Lv 2, 캠페인 끝 Lv 14 안팎)
const XP_PER_COST = 2;        // 처치 경험치 = 적 위협도 x 이 값 x (1 + 0.15 x (구역-1)), 정예 12배, 보스 400 (최종 보스 800) — 적이 많아 한 마리당은 적게
const RESPEC_COST = 150;      // 특성 초기화 비용 = 이 값 x 레벨 (골드)
const SKILL_PER_LEVEL = 0.08; // 레벨이 1 오를 때마다 모든 스킬 위력 (피해·회복·방어도·내구도) +8%
const PERK_TREES = ['사격', '생존', '전술'];
// 특성 트리: 계열(탭)마다 3단 5칸 — tier 단은 PERK_TIER_LV 레벨부터, col: 0 왼쪽 · 1 오른쪽 · 0.5 가운데, req: 그중 하나에 1점 이상 넣어야 열림
const PERK_TIER_LV = [1, 4, 8];
const pct = v => Math.round(v * 100) + '%';
// per: 한 단계당 수치, fmt: 지금까지 쌓인 수치(v)를 설명으로
const PERKS = {
  gun:     { tree: 0, tier: 0, col: 0, name: '정밀 사격',   icon: 'icon_assault',      max: 5, per: 0.06, fmt: v => `총기 피해 +${pct(v)}` },
  reload:  { tree: 0, tier: 0, col: 1, name: '빠른 손',     icon: 'clipa0',            max: 5, per: 0.08, fmt: v => `재장전 시간 -${pct(v)}` },
  crit:    { tree: 0, tier: 1, col: 0, req: ['gun'], name: '약점 포착',   icon: 'icon_marksman',     max: 5, per: 0.03, fmt: v => `치명타 확률 +${pct(v)} (피해 2배)` },
  saver:   { tree: 0, tier: 1, col: 1, req: ['reload'], name: '탄약 절약',   icon: 'ammoa0',            max: 3, per: 0.08, fmt: v => `${pct(v)} 확률로 탄을 쓰지 않음` },
  prey:    { tree: 0, tier: 2, col: 0.5, req: ['crit', 'saver'], name: '거물 사냥', icon: 'icon_perk_prey', max: 3, per: 0.1, fmt: v => `정예·보스에게 주는 피해 +${pct(v)}` },
  hp:      { tree: 1, tier: 0, col: 0, name: '강인함',      icon: 'media0',            max: 5, per: 15,   fmt: v => `최대 체력 +${v}` },
  leech:   { tree: 1, tier: 1, col: 0, req: ['hp'], name: '피의 갈증',   icon: 'bon1a0',            max: 3, per: 3,    fmt: v => `적을 처치할 때마다 체력 +${v}` },
  stamina: { tree: 1, tier: 0, col: 1, name: '단련된 몸',   icon: 'icon_syringe_blue', max: 3, per: 0.15, fmt: v => `스태미너 회복 +${pct(v)}, 소모 -${pct(v * 2 / 3)}` },
  blade:   { tree: 1, tier: 1, col: 1, req: ['stamina'], name: '검술',        icon: 'icon_knife',        max: 5, per: 0.1,  fmt: v => `근접 피해 +${pct(v)}` },
  regen:   { tree: 1, tier: 2, col: 0.5, req: ['leech', 'blade'], name: '재생 조직', icon: 'icon_perk_regen', max: 3, per: 1, fmt: v => `초당 체력 회복 +${v}` },
  blast:   { tree: 2, tier: 1, col: 0, req: ['dash'], name: '폭파 전문가', icon: 'icon_gren_frag',    max: 3, per: 0.15, fmt: v => `내 폭발 피해 +${pct(v)} (수류탄·로켓·분쇄포)` },
  dash:    { tree: 2, tier: 0, col: 0, name: '회피 숙련',   icon: 'suita0',            max: 3, per: 0.12, fmt: v => `회피 대기시간 -${pct(v)}` },
  scav:    { tree: 2, tier: 0, col: 1, name: '보급 전문가', icon: 'bpaka0',            max: 3, per: 0.15, fmt: v => `줍는 골드·탄약 +${pct(v)}` },
  medic:   { tree: 2, tier: 1, col: 1, req: ['scav'], name: '응급 처치',   icon: 'stima0',            max: 3, per: 0.15, fmt: v => `메디킷 회복량 +${pct(v)}` },
  command: { tree: 2, tier: 2, col: 0.5, req: ['blast', 'medic'], name: '전술 지휘', icon: 'icon_perk_command', max: 3, per: 0.06, fmt: v => `스킬 대기시간 -${pct(v)}` },
};

// ===== 액티브 스킬 (스킬 쉘) =====
// 스킬은 '스킬 쉘' 아이템을 스킬 창 [K]의 스킬 칸 4개(SHELL_SLOTS 키)에 끼워야 씀 — 같은 스킬은 한 칸에만
// 쉘은 등급(일반~전설)이 높을수록 위력 보너스(SHELL_POW)와 옵션 수(RARITY의 affixes)가 큼
// v: 기본 수치 — 종류는 키 이름으로 정해짐 (SKILL_PARAM): dmg·heal·armor 위력 / r·dist 범위 / dur 지속 / n 개수 / stun·freeze 제어
//    (crit·amb·leech 같은 비율은 그대로). 위력은 캐릭터 레벨마다 +SKILL_PER_LEVEL
// mods: 이 스킬의 쉘에만 붙는 옵션 (위력·대기시간 옵션은 모든 쉘에)
// from: 이 구역부터 떨어지고 상점에 나옴, price: 기본 값 (등급 배율 RARITY_VALUE), icon: 아틀라스 그림
// 피해(와 포탑·코일 내구도)는 구역이 깊을수록 커짐 (x (1 + 0.15 x (구역-1)))
const SKILLS = {
  shock:    { name: '충격파', color: '#8cf', icon: 'bfe1d0', from: 1, price: 250, cd: 12,
              v: { dmg: 50, r: 3.5, stun: 1.2 }, mods: ['r', 'cc'],
              desc: v => `주변 ${v.r}칸의 적에게 피해 ${v.dmg}, 밀쳐내고 ${v.stun}초 기절` },
  charge:   { name: '강습 돌진', color: '#f96', icon: 'skula1', from: 1, price: 250, cd: 8,
              v: { dmg: 60, dist: 5, stun: 0.6 }, mods: ['r', 'cc'],
              desc: v => `조준한 쪽으로 ${v.dist}칸 돌진 (무적). 부딪힌 적에게 피해 ${v.dmg}, ${v.stun}초 기절` },
  saw:      { name: '회전 톱날', color: '#fc8', icon: 'csawa0', from: 2, price: 450, cd: 14,
              v: { dmg: 16, dur: 3, r: 1.7 }, mods: ['dur', 'r'],
              desc: v => `${v.dur}초 동안 톱날 두 개가 몸 둘레 ${v.r}칸을 돌며 0.2초마다 피해 ${v.dmg}` },
  berserk:  { name: '광폭화', color: '#f66', icon: 'pstra0', from: 7, price: 1240, cd: 40,
              v: { dur: 10, heal: 4 }, mods: ['dur'], rate: 1.4, speed: 1.25, guard: 0.2,
              desc: v => `${v.dur}초 동안 공격 속도 +40%, 이동 +25%, 받는 피해 -20%, 처치마다 체력 +${v.heal}` },
  iron:     { name: '강철 피부', color: '#c8d0dc', icon: 'arm2a0', from: 2, price: 450, cd: 25,
              v: { armor: 40, dur: 8 }, mods: ['dur'], guard: 0.35,
              desc: v => `방어도 +${v.armor} (최대 100), ${v.dur}초 동안 받는 피해 -35%, 밀려나지 않음` },
  blink:    { name: '순간 이동', color: '#9f6', icon: 'tfoga0', from: 1, price: 250, cd: 7,
              v: { dist: 6, dmg: 30, stun: 0.8 }, mods: ['r', 'cc'],
              desc: v => `커서 쪽으로 최대 ${v.dist}칸 순간 이동. 도착한 곳 둘레의 적에게 피해 ${v.dmg}, ${v.stun}초 기절` },
  cloak:    { name: '은신 장막', color: '#aab4c8', icon: 'pinsa0', from: 4, price: 710, cd: 22,
              v: { dur: 6, amb: 1 }, mods: ['dur'],
              desc: v => `${v.dur}초 동안 모습을 감춤. 공격하면 풀리고 그 공격은 피해 +${pct(v.amb)}` },
  blades:   { name: '칼날 부채', color: '#e8e8e8', icon: 'icon_blades', from: 1, price: 250, cd: 6,
              v: { dmg: 28, n: 7 }, mods: ['n'],
              desc: v => `조준한 쪽으로 칼날 ${v.n}개를 던짐 (하나당 피해 ${v.dmg}, 적 셋까지 꿰뚫음)` },
  deadeye:  { name: '집중 사격', color: '#f55', icon: 'pvisa0', from: 5, price: 1010, cd: 30,
              v: { dur: 8, crit: 0.5 }, mods: ['dur'],
              desc: v => `${v.dur}초 동안 무기 치명타 확률 +${pct(v.crit)}, 공격 속도 +25%` },
  mines:    { name: '지뢰 살포', color: '#fb6', icon: 'ceyea0', from: 3, price: 580, cd: 16,
              v: { dmg: 80, n: 5, r: 2.2 }, mods: ['n', 'r'], life: 45, cap: 16,
              desc: v => `바라보는 쪽에 지뢰 ${v.n}개. 적이 밟으면 폭발 (반경 ${v.r}칸, 피해 ${v.dmg})` },
  turret:   { name: '포탑 배치', color: '#9f9', icon: 'mguna0', from: 5, price: 910, cd: 30,
              v: { dmg: 7, dur: 10, hp: 100 }, mods: ['dur'], rate: 0.16, range: 9, // 설치 스킬 기준: 켜져 있는 동안 그 시점 총과 비슷한 DPS, 대기시간의 절반쯤 켜짐 (탄은 반드시 맞음) — 포탑은 0.37에서 지속 14→10초·내구도 144→100으로 줄임
              desc: v => `${v.dur}초 동안 ${SKILLS.turret.range}칸 안의 적을 쏘는 포탑 (한 발 ${v.dmg}, 초당 6발, 내구도 ${v.hp})` },
  drone:    { name: '전투 드론', color: '#7ef', icon: 'fskua0', from: 6, price: 1070, cd: 26,
              v: { dmg: 18, dur: 12 }, mods: ['dur'], rate: 0.4, range: 8, // 포탑과 같은 기준
              desc: v => `${v.dur}초 동안 곁을 따라다니며 플라즈마를 쏘는 드론 (한 발 ${v.dmg}, 초당 2.5발)` },
  tesla:    { name: '테슬라 코일', color: '#6af', icon: 'celpa0', from: 8, price: 1400, cd: 24,
              v: { dmg: 12, dur: 10, r: 4.5, n: 3, hp: 176 }, mods: ['dur', 'r', 'n'], rate: 0.6, // 포탑과 같은 기준 (여럿을 함께 맞히고 기절시키니 한 마리에겐 더 약하게)
              desc: v => `${v.dur}초 동안 서 있는 코일. 0.6초마다 ${v.r}칸 안의 적 ${v.n}마리에게 번개 (피해 ${v.dmg}, 내구도 ${v.hp})` },
  missiles: { name: '유도 미사일', color: '#fa6', icon: 'rocka0', from: 7, price: 1240, cd: 10,
              v: { dmg: 45, n: 6 }, mods: ['n'],
              desc: v => `가까이 보이는 적들에게 날아가는 소형 미사일 ${v.n}발 (하나당 피해 ${v.dmg}, 작은 폭발, 나는 안전)` },
  repair:   { name: '나노 수리', color: '#7f7', icon: 'keena0', from: 4, price: 800, cd: 20,
              v: { heal: 90, armor: 15 }, mods: [],
              desc: v => `3초에 걸쳐 체력 ${v.heal} 회복, 방어도 +${v.armor}, 중독·화상·감전 치료` },
  chain:    { name: '연쇄 번개', color: '#8af', icon: 'plseb0', from: 2, price: 330, cd: 6,
              v: { dmg: 40, n: 5, r: 4 }, mods: ['n', 'r'],
              desc: v => `조준한 쪽의 적에게 번개. ${v.r}칸 안의 다음 적으로 ${v.n}번까지 튕김 (피해 ${v.dmg})` },
  frost:    { name: '냉기 폭발', color: '#bef', icon: 'ifoga0', from: 4, price: 710, cd: 15,
              v: { dmg: 30, r: 3.8, freeze: 2 }, mods: ['r', 'cc'],
              desc: v => `주변 ${v.r}칸의 적에게 피해 ${v.dmg}, ${v.freeze}초 동안 얼림` },
  inferno:  { name: '화염 폭풍', color: '#f84', icon: 'firea0', from: 7, price: 1240, cd: 14,
              v: { dmg: 45, r: 3.2, dur: 5 }, mods: ['r', 'dur'],
              desc: v => `불길이 ${v.r}칸까지 퍼져 피해 ${v.dmg}와 화상. ${v.dur}초 동안 바닥이 탄다` },
  gravity:  { name: '중력장', color: '#c8f', icon: 'pinva0', from: 8, price: 1400, cd: 18,
              v: { dmg: 70, dur: 2.5, r: 4.5 }, mods: ['r', 'dur'],
              desc: v => `커서 위치에 특이점. ${v.dur}초 동안 ${v.r}칸 안의 적을 끌어당긴 뒤 붕괴 (피해 ${v.dmg})` },
  drain:    { name: '생명 흡수', color: '#f6a', icon: 'soula0', from: 5, price: 810, cd: 16,
              v: { dmg: 35, r: 4, leech: 0.4 }, mods: ['r'],
              desc: v => `주변 ${v.r}칸의 적에게서 생명력을 빼앗음 (피해 ${v.dmg}). 준 피해의 ${pct(v.leech)}만큼 회복` },
};
const SHELL_SLOTS = ['Z', 'X', 'V', 'B'];  // 스킬 칸 단축키
const SHELL_POW = [0, 0.1, 0.2, 0.35, 0.35]; // 등급별 위력 보너스 (일반·고급·희귀·전설·고유 전설)
const SKILL_PARAM = { dmg: 'pow', heal: 'pow', armor: 'pow', hp: 'pow', r: 'r', dist: 'r', dur: 'dur', n: 'n', stun: 'cc', freeze: 'cc' };
const PARAM_NAME = { dmg: '피해', heal: '회복', armor: '방어도', hp: '내구도', r: '범위', dist: '거리', dur: '지속', n: '개수', stun: '기절', freeze: '빙결', crit: '치명타', amb: '기습', leech: '흡수' };
// 쉘 옵션: min~max에서 굴림 (등급이 높을수록 높은 값), int: 정수
const SHELL_AFFIXES = {
  pow:  { prefix: '강력한',   min: 0.08, max: 0.30, text: v => `스킬 위력 +${pct(v)} (피해·회복·방어도)` },
  cd:   { prefix: '신속한',   min: 0.06, max: 0.20, text: v => `대기시간 -${pct(v)}` },
  r:    { prefix: '광역의',   min: 0.10, max: 0.35, text: v => `범위·거리 +${pct(v)}` },
  dur:  { prefix: '지속하는', min: 0.12, max: 0.40, text: v => `지속시간 +${pct(v)}` },
  n:    { prefix: '다중의',   min: 1, max: 2, int: true, text: v => `개수·횟수 +${v}` },
  cc:   { prefix: '압도하는', min: 0.15, max: 0.50, text: v => `기절·빙결 시간 +${pct(v)}` },
};
// 쉘이 떨어질 확률: 일반 적 처치, 정예, 임무 보상, 구역 바닥에 하나 (보스는 반드시 하나, 등급 보너스)
const SHELL_DROP = { kill: 0.004, elite: 0.35, mission: 0.5, floor: 0.5 };
const SHELL_STOCK = 10; // 보급 자판기의 스킬 쉘 진열 수

// ===== 고유 전설 스킬 쉘: 스킬마다 하나, 동작이 바뀜 (상점에는 없음) =====
// name: 쉘 이름, affixes: 정해진 옵션, effect: 바뀌는 동작 (game.js에서 스킬 키로 처리), flavor: 붉은 글씨 한 줄
const SHELL_UNIQUES = {
  shock:    { name: '지진의 심장',   affixes: [{ k: 'pow', v: 0.25 }, { k: 'r', v: 0.2 }],    effect: '0.5초 뒤 그 자리에서 여진이 한 번 더 (피해 70%)', flavor: '땅이 두 번 울리면 서 있는 것은 없다.' },
  charge:   { name: '혜성 엔진',     affixes: [{ k: 'pow', v: 0.25 }, { k: 'r', v: 0.2 }],    effect: '돌진한 길에 3초 동안 불길이 남음 (나는 안전)', flavor: '지나간 자리에 꼬리가 남는다.' },
  saw:      { name: '분쇄기 왕관',   affixes: [{ k: 'pow', v: 0.2 }, { k: 'dur', v: 0.25 }],  effect: '톱날이 네 개: 범위 +30%, 더 자주 벰', flavor: '머리 위로 도는 것은 왕관이 아니다.' },
  berserk:  { name: '피의 축제',     affixes: [{ k: 'pow', v: 0.3 }, { k: 'dur', v: 0.2 }],   effect: '광폭화 중 처치할 때마다 지속시간 +1초 (최대 +10초)', flavor: '잔치는 손님이 남아 있는 동안 계속된다.' },
  iron:     { name: '가시 갑주',     affixes: [{ k: 'pow', v: 0.3 }, { k: 'dur', v: 0.25 }],  effect: '강철 피부 중 나를 때린 근접 적은 그 피해의 80%를 되받음', flavor: '먼저 손댄 쪽이 피를 본다.' },
  blink:    { name: '유령 발자국',   affixes: [{ k: 'r', v: 0.25 }, { k: 'cd', v: 0.15 }],    effect: '떠난 자리에 4초 동안 잔상이 남아 적을 끌어들임', flavor: '그들이 찢는 것은 언제나 1초 전의 나다.' },
  cloak:    { name: '그림자 군주',   affixes: [{ k: 'dur', v: 0.3 }, { k: 'cd', v: 0.15 }],   effect: '기습할 때 주변 3칸의 적을 1.5초 기절시킴', flavor: '어둠이 먼저 목을 조른다.' },
  blades:   { name: '천 개의 칼날',  affixes: [{ k: 'pow', v: 0.2 }, { k: 'n', v: 2 }],      effect: '0.25초 뒤 칼날을 한 번 더 던짐', flavor: '하나를 피하면 둘이 온다.' },
  deadeye:  { name: '매의 눈',       affixes: [{ k: 'dur', v: 0.3 }, { k: 'cd', v: 0.15 }],   effect: '집중 사격 중 총탄이 적을 하나 더 꿰뚫음', flavor: '일직선으로 서 있는 놈들은 운이 없다.' },
  mines:    { name: '벌집 지뢰',     affixes: [{ k: 'pow', v: 0.2 }, { k: 'n', v: 1 }],       effect: '지뢰가 터지면 작은 지뢰 둘이 튀어 나감 (피해 50%)', flavor: '하나를 밟으면 셋이 깨어난다.' },
  turret:   { name: '쌍둥이 파수꾼', affixes: [{ k: 'pow', v: 0.2 }, { k: 'dur', v: 0.25 }],  effect: '포탑을 두 대 세움', flavor: '서로의 등을 지키는 기계.' },
  drone:    { name: '편대장',        affixes: [{ k: 'pow', v: 0.2 }, { k: 'dur', v: 0.25 }],  effect: '드론 두 대가 함께 날아다님', flavor: '혼자 나는 드론은 표적일 뿐이다.' },
  tesla:    { name: '폭풍 첨탑',     affixes: [{ k: 'pow', v: 0.2 }, { k: 'r', v: 0.2 }],     effect: '번개가 맞은 적 곁의 다른 적에게 한 번 더 튐 (피해 60%)', flavor: '피뢰침이 되고 싶은 자, 앞으로.' },
  missiles: { name: '집속탄 포드',   affixes: [{ k: 'pow', v: 0.2 }, { k: 'n', v: 2 }],      effect: '미사일이 터지면 작은 폭탄 셋이 흩어져 터짐 (피해 40%)', flavor: '하나가 터지면 넷이 운다.' },
  repair:   { name: '불사의 서약',   affixes: [{ k: 'pow', v: 0.3 }, { k: 'cd', v: 0.15 }],   effect: '쓰는 순간 2초 동안 무적, 방어도 +20 더', flavor: '아직은 아니다.' },
  chain:    { name: '갈래 번개',     affixes: [{ k: 'pow', v: 0.2 }, { k: 'n', v: 2 }],       effect: '번개가 두 갈래로 나뉘어 따로 튕김', flavor: '하늘은 한 번에 둘을 고른다.' },
  frost:    { name: '영원한 겨울',   affixes: [{ k: 'pow', v: 0.25 }, { k: 'cc', v: 0.3 }],   effect: '얼어 있는 동안 죽은 적은 산산조각 (주변 2칸에 피해 50%, 둔화)', flavor: '녹지 않는 것은 부서질 뿐이다.' },
  inferno:  { name: '태양의 고리',   affixes: [{ k: 'pow', v: 0.2 }, { k: 'dur', v: 0.3 }],   effect: '불길이 1.4배 넓게 퍼지고, 화상이 6초', flavor: '정거장 한가운데 작은 태양을.' },
  gravity:  { name: '사건의 지평선', affixes: [{ k: 'pow', v: 0.25 }, { k: 'r', v: 0.2 }],    effect: '붕괴할 때 주변의 적을 1.5초 기절시키고, 작은 특이점이 하나 더 생김', flavor: '빛조차 돌아오지 못한다.' },
  drain:    { name: '흡혈 군주',     affixes: [{ k: 'pow', v: 0.25 }, { k: 'r', v: 0.2 }],    effect: '체력이 가득 차 남는 흡수량은 방어도가 됨 (최대 100)', flavor: '넘치는 잔은 갑옷이 된다.' },
};
// 고유 전설 쉘이 떨어질 확률: 보스, 고유 정예, 금고 보물함(하나당), 정예, 그 밖의 적
const SHELL_UNIQUE_DROP = { boss: 0.35, super: 0.25, vault: 0.12, elite: 0.015, kill: 0.0001 };

// ===== 정예 몬스터 (디아블로식): 일반 적에게 특성이 붙고 이름 앞에 표시됨, 좋은 장비를 반드시 떨어뜨림 =====
const ELITE = { hp: 2.5, dmg: 1.3, gold: 4, lootBonus: 2, scale: 1.15 }; // 체력·피해·골드 배율, 장비 등급 보너스(최소 '고급'), 크기
const ELITE_COUNT = [0, 1, 1, 2, 2, 2, 3, 3, 4];     // 구역 1~9의 정예 수
const ELITE_AFFIX_MAX = [1, 1, 1, 1, 2, 2, 2, 3, 3]; // 구역 1~9에서 붙는 특성 최대 개수 (1개부터 무작위)
const ELITE_AFFIXES = {
  fast:  { name: '신속한',   color: '#ffe066', rgb: '255,224,102', desc: '이동이 1.45배, 공격 간격이 0.7배' },
  iron:  { name: '강철의',   color: '#b8c8e0', rgb: '184,200,224', desc: '받는 피해 45% 감소' },
  fire:  { name: '불타는',   color: '#ff7a30', rgb: '255,122,48',  desc: '가까이 가면 화상, 죽으면 그 자리에 불길' },
  regen: { name: '재생하는', color: '#66ff88', rgb: '102,255,136', desc: '매초 최대 체력의 3% 회복' },
  split: { name: '분열하는', color: '#c080ff', rgb: '192,128,255', desc: '죽으면 체력 40%짜리 둘로 갈라짐' },
  bomb:  { name: '폭발하는', color: '#ff4040', rgb: '255,64,64',   desc: '죽으면 1초 뒤 그 자리가 폭발' },
  blink:  { name: '순간이동하는', color: '#ff7ae0', rgb: '255,122,224', desc: '몇 초마다 플레이어 곁으로 순간이동' },
  shield: { name: '방패를 든',    color: '#4a8cff', rgb: '74,140,255',  desc: '정면 공격의 70%를 막는 방패. 옆이나 뒤를 노려라' },
  multi:  { name: '난사하는',     color: '#f4f4f4', rgb: '244,244,244', desc: '원거리 공격이 세 갈래로' },
  aura:   { name: '지휘하는',     color: '#30e0c8', rgb: '48,224,200',  desc: '주변 적이 빨라지고 공격이 잦아짐' },
  curse:  { name: '저주하는',     color: '#8a4cff', rgb: '138,76,255',  desc: '가까이 보이면 저주 (잠시 내 방어가 절반)' },
  spark:  { name: '전기를 품은',  color: '#9ee8ff', rgb: '158,232,255', desc: '맞을 때마다 전기 불꽃이 튀어 나옴' },
};
// 새 정예 특성의 수치: blink — cd초마다 min칸보다 멀면 플레이어 곁 r칸으로 / shield — 방패 해병과 같은 방패 (조금 약하고 빨리 돎)
// multi — 원거리 탄 양옆으로 spread라디안 / aura — 주변 r칸 적의 이동 spd배·공격 간격 atk배 / curse — range칸 안에서 보이면 cd초마다 t초 동안 방어 def배
// spark — 맞으면 cd초마다 n개의 전기 불꽃 (speed칸/초, life초, 피해 dmg)
const ELITE_FX = {
  blink: { cd: [4, 6], min: 3.5, r: [1.6, 2.6] }, shield: { arc: 1.5, cut: 0.7, turn: 1.1, react: 0.5, drop: 0.7, hp: 0.35 }, multi: { spread: 0.3 },
  aura: { r: 5, spd: 1.3, atk: 0.75 }, curse: { range: 7, cd: 5, t: 4, def: 0.5 }, spark: { n: 3, cd: 0.45, speed: 5, life: 1.3, dmg: 6 },
};
// 고유 정예 (디아블로2의 슈퍼 유니크): 구역마다 이름 붙은 정예 하나가 부하를 거느리고 정해진 방을 지킴
// 처치하면 좋은 장비, 그 구역의 금고 열쇠 (불러오면 다시 나타남). base: 바탕 몬스터, affixes: 정예 특성, minions: [[종류, 수]] (그 막의 적), hp: 체력 배율 (정예 배율에 더해)
const SUPERS = [
  { name: '녹슨 정비공 그룬',  base: 'xenoid',     affixes: ['fast'],                 minions: [['crawler', 5]],                  hp: 2 },
  { name: '울부짖는 보모',     base: 'spitter',    affixes: ['regen'],                minions: [['runner', 4]],                   hp: 3 },
  { name: '하역장 도살자',     base: 'brute',      affixes: ['iron', 'shield'],       minions: [['xenoid', 3]],                   hp: 1.5 },
  { name: '실험체 제로',       base: 'charger',    affixes: ['fire', 'blink'],        minions: [['sparker', 3]],                  hp: 2 },
  { name: '살점 조각가',       base: 'juggernaut', affixes: ['regen', 'curse'],       minions: [['crawler', 6]],                  hp: 1.4 },
  { name: '산란 여왕',         base: 'brooder',    affixes: ['fire', 'iron'],         minions: [['crawler', 4]],                   hp: 1.6 },
  { name: '변압기 볼코프',     base: 'gunner',     affixes: ['spark', 'multi'],       minions: [['gunner', 2], ['warden', 1]],    hp: 2.5 },
  { name: '포격 지휘관',       base: 'mortar',     affixes: ['multi', 'aura'],        minions: [['gunner', 3]],                   hp: 1.5 },
  { name: '군체의 대변자',     base: 'juggernaut', affixes: ['fire', 'aura', 'curse'], minions: [['burrower', 2]],                hp: 1.6 },
];
// 필드 사건: per — 구역마다 놓는 보급 캐시 수 (열면 보급품, 대신 매복), vault: 금고 수
// vault — 금고 보물함 수 [구역 1~4, 5~9]
const FIELD_EVENTS = { per: [1, 2, 2, 2, 2, 2, 2, 2, 2], vault: [2, 3] };
const BOSS_EVERY = 3;   // 이 구역마다 보스 등장 (3, 6): 타이탄과 하이브 마더, 마지막 구역은 오버마인드
const BOSS_DROPS = 2;   // 보스가 떨어뜨리는 무기 수 (상위 등급 보너스)
// 구역 보스: 그 구역 입구에서 먼 쪽의 가장 큰 빈 방에 하나 (길을 막지는 않음 — 구역 3·6의 보스와 9의 오버마인드는 길목에). 처치하면 다시 나오지 않음
const REGION_BOSSES = { 1: 'crusher', 2: 'broodmother', 4: 'argus', 5: 'plaguegiant', 7: 'voidpriest', 8: 'executioner' };
// 수집 도감 [J]의 몬스터 설명
const MONSTER_DESC = {
  crawler: '떼로 몰려와 깡충깡충 뛰어들고, 가까우면 크게 덮친다.', runner: '크롤러의 붉은 변종. 약하지만 더 빠르게 뛰어든다.',
  xenoid: '조준당하면 옆으로 뛰어 자동 조준 탄을 피한다.', spitter: '거리를 두고 산성액을 뱉는다. 맞으면 중독.',
  sparker: '떠다니며 전기 탄을 쏜다. 맞으면 감전되어 느려진다.', brute: '느리지만 강하다. 다가오면서 녹색 에너지 구체를 던진다.',
  juggernaut: '장갑 때문에 약한 탄은 잘 안 통하지만, 몇 발에 한 발은 뚫린다. 강한 한 방이나 철갑탄으로.', charger: '웅크렸다가 일직선으로 돌진한다. 벽에 박으면 잠시 기절.',
  gunner: '거리를 두고 5발씩 연사한다.', brooder: '떠다니며 크롤러를 낳고, 죽으면 품고 있던 크롤러가 쏟아진다.',
  mortar: '느리고 단단하다. 화염탄 3발을 부채꼴로 쏜다.', watcher: '움직이지 않고 멀리서 발밑에 불기둥을 일으킨다.',
  shielder: '정면을 에너지 방패로 막는다. 막을 때마다 닳아 결국 부서진다.', bomber: '날아와 곁에서 터진다. 먼저 쏘아 떨어뜨려라.',
  assassin: '거의 보이지 않고, 등 뒤로 순간이동해 기습한다.', summoner: '쓰러진 몬스터를 다시 일으켜 세운다.',
  lurker: '천장에 숨어 있다가 떨어진다. 바닥의 그림자가 짙어지면 비켜라.', burrower: '땅속을 파고 다가와 발밑에서 솟아오른다. 땅 위에 있을 때 쳐라.',
  warden: '주변 적에게 보호막을 씌운다. 드론부터 쓰러뜨려라.',
  nest: '옆에 몬스터를 계속 낳는 번식 둥지.', thief: '보급품을 훔쳐 달아나는 약탈자. 놓치면 사라지고, 잡으면 보물이 쏟아진다.',
  titan: '로켓 연사와 하늘에서 떨어지는 로켓 포격, 가까우면 내려찍어 충격파. 구역 3의 봉쇄 격벽을 지킨다.', hivemother: '산성액 부채꼴·산성 고리·산성 비와 크롤러 소환. 구역 6의 봉쇄 격벽을 지킨다.',
  overmind: '정거장 코어의 군체의 뇌. 화염탄·포자·쫓아오는 불기둥, 약해질수록 화염탄 고리와 쌍둥이 광선. 쓰러뜨리면 자폭이 시작된다.',
  crusher: '붉은 띠를 따라 돌진하고 (격노하면 연달아), 벽에 박히면 잠시 무방비. 멀면 크게 도약해 내려찍는다.', broodmother: '떠다니며 크롤러·폭주 해골을 낳고, 산성액과 새끼가 든 알을 뿌린다. 격노하면 돌며 뿜는다.',
  argus: '사방으로 퍼지는 탄 고리와 소용돌이 탄, 갈 곳을 앞질러 쏘는 연사. 틈으로 빠져나가라.', plaguegiant: '독액 덩어리와 독구름, 부채꼴로 쓸며 토하는 독액. 격노하면 빙 둘러 던진다.',
  voidpriest: '순간이동하며 공허 구체를 뿌리고, 불기둥 무늬를 펼치고 시체를 일으킨다.', executioner: '유도 미사일, 레이저, 연속 돌진. 격노하면 레이저가 양쪽으로. 붉은 조준선을 보면 비켜라.',
};

// ===== 필드: 구역 9개가 이어진 하나의 큰 정거장 =====
// 3x3 칸에 뱀 모양으로 이어 놓음 (1→2→3 / 6←5←4 / 7→8→9) — 착륙 지점(구역 1)에서 멀어질수록 적이 강해짐
// block: 구역 하나의 크기(칸), margin: 지도 가장자리, rooms: 구역마다 방 수 [최소, 최대]
// hubs: 보급 거점(자판기·순간이동 패드)이 있는 구역 — 구역마다 하나씩 (생존자 구출 구역 2·7에는 꼭), hubGap: 자판기끼리 떨어뜨릴 칸 수 (방이 좁으면 덜)
// spawn: 방에 이만큼(칸) 다가가면 그 방의 적이 나타남, sleep: 이보다 멀리 있는 적은 쉼 (쫓아오는 적은 제외)
const FIELD = { block: 52, margin: 2, rooms: [8, 11], hubs: [1, 2, 4, 6, 7, 9], hubGap: [3, 2, 1], spawn: 20, sleep: 34 };
const FIELD_VER = 4; // 지도 만드는 방식의 판 (저장에 남김 — 판이 다르면 같은 씨앗이라도 지도가 다름). 4: 구역마다 보스방
// 보스방: 구역마다 하나, 그 구역 보스는 여기에만 (다른 방보다 넓게 — w·h 칸). 2x2 기둥(총알·시야를 막음) pillars개, 상자 crates개를 흩어 놓고 네 구석에 조명
const ARENA = { w: [16, 19], h: [14, 16], pillars: [4, 6], crates: [3, 6] };
// 보스방에 갇힌 동안 every초마다 작은 적(그 막의 위협도 2 이하) n마리가 나타남 (살아 있는 것은 max까지) — 처치하면 chance 확률로 장착한 총 중
// 가장 모자란 탄약을 한 묶음의 pack배 떨어뜨림 (경험치·골드·장비·근접 회복은 없음). 막이 걷히면 남은 것은 사라짐
const ARENA_FEED = { every: 5, n: [1, 2], max: 4, chance: 0.35, pack: 1 };
const FIELD_ORDER = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2]]; // 구역 1~9가 놓이는 칸 (열, 행)
// 다음 구역으로 가는 길목의 봉쇄 격벽: boss — 그 구역 보스를 처치하면, mission — 그 구역 임무를 이루면 열림
const GATES = { 3: 'boss', 6: 'boss', 8: 'mission' };
// 쓰러짐: 체력이 0이 되면 바로 끝나지 않고 몇 초 동안 기어 다니며 싸움 (spd배로 느리게, 쏘기·장전만 — 회피·달리기·스킬·소모품·수류탄·[F] 없음, 더 다치지 않음)
// 그동안 피해 dmg (그 구역 적 체력 배율만큼) 이상 주거나, kills마리 처치하거나, 탄약을 ammo묶음 이상 주우면 다시 일어남 (최대 체력의 hp, inv초 무적)
// 버틸 시간은 처음 time초 — 쓰러질 때마다 다음 시간은 cost초 줄고 (min초까지), 살아 있는 동안 초당 regen초씩 다시 늘어남 (time초까지)
// 시간이 다 되면 죽음: 가운데 '죽었습니다', wait초 뒤부터 hold초 누르고 있으면 마지막으로 들른 거점에서 다시 일어남
const DOWNED = { time: 5, min: 1.5, cost: 1.5, regen: 0.05, spd: 0.35, dmg: 160, kills: 2, ammo: 1, hp: 0.35, inv: 2, wait: 1.2, hold: 1 };
const DEATH_GOLD = 0.15;                    // 쓰러지면 잃는 골드 비율 — 마지막으로 들른 보급 거점에서 다시 일어남
const DEATH_XP = 0.9;                       // 쓰러지면 레벨은 그대로, 지금 레벨에서 모은 경험치는 0이 되어 쓰러진 자리에 떨어짐 — 주우면 이 비율만큼 되찾음
const REGION_BONUS = { gold: 100, xp: 100 }; // 새 구역에 처음 들어가면 골드·경험치 x (구역-1)

// ===== 근접 무기의 쓸모 (총과 다른 역할) =====
// 근접으로 처치: 체력 heal(정예·보스 healBig) x 최대 체력 회복, ammo 확률로(정예·보스는 반드시) 장착한 총 중 가장 모자란 탄약이 튀어나옴
//   (pack·packBig x 그 탄약 한 묶음, 플레이어 쪽으로 끌려옴)
// 휘두르면 범위(사거리 + deflect칸) 안의 적 탄을 쳐냄, 장갑을 무시, 방패 내구도를 shield배로 깎음, 기절·빙결한 적에게 open배 피해
// 맞은 적(보스 제외)의 준비 동작을 끊음: 차저 돌진 · 브루트 투척 · 감시자 불기둥 · 되살리는 주문 · 연사
const MELEE = { heal: 0.02, healBig: 0.08, ammo: 0.5, pack: 0.4, packBig: 1, deflect: 0.6, shield: 3, open: 1.5 };

// ===== 무기 슬롯: 어떤 무기든 끼울 수 있는 칸 — 처음 base칸, 막 보스(bosses: 그 구역의 보스)를 처치할 때마다 한 칸씩 (최대 max칸) =====
const WEAPON_SLOTS = { base: 2, max: 4, bosses: [3, 6] };

// ===== 캠페인 (구역 9개) =====
// 구역 이름과 브리핑 (처음 들어갈 때 표시). 구역 9 코어의 오버마인드를 처치하면 정거장 자폭이 시작되고,
// 코어 입구의 탈출정까지 ESCAPE_TIME초 안에 가면 엔딩
// mission: 구역 임무 (선택 — 이루면 보상. 구역 8은 코어로 가는 봉쇄 격벽을 엶)
const CAMPAIGN = [
  { name: '격납고',      brief: '착륙 지점을 확보하라. 외곽 격납고에 퍼진 제노 개체를 정리할 것.' },
  { name: '거주 구역',   brief: '거주 구역에서 약한 구조 신호가 잡혔다. 살아남은 승무원을 찾아 보급 거점의 순간이동 패드까지 데려가라.', mission: { type: 'rescue', n: 2 } },
  { name: '화물 터미널', brief: '대형 개체 타이탄이 다음 구역으로 가는 봉쇄 격벽을 지키고 있다.' },
  { name: '연구동',      brief: '감염 경로가 기록된 연구동. 가장 안쪽 방의 단말기에서 연구 데이터를 빼내라.', mission: { type: 'hack', stages: 2, term: '연구 데이터 단말기' } },
  { name: '생체 실험실', brief: '실험체들이 우리를 부수고 나왔다. 격리 구역을 정리하라.' },
  { name: '번식장',      brief: '하이브 마더의 번식장. 곳곳의 둥지를 부수고, 봉쇄 격벽을 지키는 하이브 마더를 처치하라.', mission: { type: 'nest', n: 4 } },
  { name: '동력로',      brief: '동력로에 기술자들이 고립되어 있다. 보급 거점의 순간이동 패드까지 데려가라.', mission: { type: 'rescue', n: 3 } },
  { name: '중앙 통제실', brief: '코어로 들어갈 보안 권한을 빼앗아라. 가장 안쪽 방의 통제 단말기를 해킹해야 코어의 봉쇄 격벽이 열린다.', mission: { type: 'hack', stages: 3, term: '보안 통제 단말기' } },
  { name: '코어',        brief: '군체의 뇌 오버마인드를 처치하고, 자폭이 끝나기 전에 코어 입구의 탈출정으로 가라.' },
];
const ESCAPE_TIME = 75; // 오버마인드 처치 후 탈출 제한 시간 (초)

// ===== 3막: 구역 1~3 · 4~6 · 7~9 — 막마다 테마·조명·색조·적·돌발 상황 (배경음악은 MUSIC.zones·combat) =====
// name·title·col: 막 이름·부제·글자 색 (구역 첫 진입 카드), themes: 구역마다 바닥·벽 테마 (game.js THEMES 번호)
// lamps: 방 조명 색 (고르는 비율대로), flick: 깜박이는 조명 비율, dark·shade: 시야 안 어둠의 세기 (0.88이 보통)·색, grade: 화면 색조 [r, g, b, 세기] (곱하기)
// foes: 이 막에 나오는 적 (처음 나오는 구역은 ENEMIES의 from — 막끼리 조금 겹침), events: 돌발 상황 (번갈아)
const ACTS = [
  { name: '1막', title: '외곽', col: '#ffb060', themes: [0, 1, 3], lamps: ['255,150,60', '255,150,60', '255,110,40', '255,200,120'], flick: 0.3, dark: 0.86, shade: '14,8,2', grade: [255, 205, 160, 0.3],
    foes: ['crawler', 'runner', 'xenoid', 'spitter', 'bomber', 'watcher', 'brute'], events: ['breach', 'blackout'] },
  { name: '2막', title: '연구 구역', col: '#7fe8d8', themes: [2, 1, 3], lamps: ['120,220,255', '150,255,210', '120,200,255', '200,255,170'], flick: 0.2, dark: 0.88, shade: '0,10,12', grade: [165, 235, 225, 0.32],
    foes: ['crawler', 'sparker', 'shielder', 'lurker', 'charger', 'assassin', 'brooder'], events: ['gas', 'breach'] },
  { name: '3막', title: '코어', col: '#ff6a7a', themes: [3, 2, 0], lamps: ['255,60,50', '255,90,140', '200,80,255', '255,140,60'], flick: 0.45, dark: 0.9, shade: '16,0,6', grade: [255, 150, 175, 0.32],
    foes: ['runner', 'gunner', 'juggernaut', 'warden', 'burrower', 'mortar', 'summoner'], events: ['blackout', 'gas'] },
];

// ===== 데이터 기록 (음성 기록): 구역마다 둘 — 케르베로스-7에 무슨 일이 있었는지. 바닥의 휴대 단말기를 주우면 재생 =====
// 저장마다 주운 기록은 다시 놓이지 않음 (진행 기록 flags.logs), 들은 기록은 수집 도감 [J]에 모여 다시 볼 수 있음 (모든 저장에서 함께)
const LOG_TIME = 18; // 재생 카드가 화면에 떠 있는 시간 (초)
const LOGS = [
  { reg: 1, title: '관제 기록: 화물선 헤론', who: '격납고 관제사 오민혁', text: '화물선 헤론 입항. 화물 목록에 없는 냉동 컨테이너가 하나 있다. 본사 직송, 검역 생략 지시. 생략이라니, 규정에 그런 건 없는데. 일단 7번 화물칸으로 보낸다.' },
  { reg: 1, title: '정비 일지', who: '정비공 김도윤', text: '사흘째 환풍구에서 긁는 소리가 난다. 쥐일 리가 없다, 여긴 우주니까. 반장은 배관이 식어서 그렇단다. 오늘 밤엔 공구함을 베개 삼아 잔다.' },
  { reg: 2, title: '개인 일지', who: '승무원 박서연', text: '옆방 지훈 씨가 열이 난다며 의무실에 갔다. 이틀이 지났는데 돌아오지 않는다. 의무실은 면회 금지. 복도 불이 자꾸 깜박인다.' },
  { reg: 2, title: '딸에게', who: '승무원 이정아', text: '하린아, 엄마야. 이 메시지가 지구에 닿을지 모르겠어. 문을 잠그고 숨어 있으래. 괜찮을 거야. 엄마가 꼭 갈게. 사랑해.' },
  { reg: 3, title: '화물 점검 보고', who: '화물 책임자 강태수', text: '7번 컨테이너 봉인이 뜯겼다. 안쪽에서. 냉동 장치는 꺼져 있고, 끈적한 자국이 배관 쪽으로 이어진다. 본사에 보고했더니 "표본 회수를 최우선으로" 란다.' },
  { reg: 3, title: '보안 무전', who: '보안 요원 최현', text: '터미널에 거대한 놈이 있다. 장갑판을 종잇장처럼 찢어. 다들 타이탄이라 부른다. 다음 구역 격벽을 내렸다. 놈을 쓰러뜨리지 않으면 아무도 못 지나간다.' },
  { reg: 4, title: '연구 노트 14', who: '수석 연구원 한서윤 박사', text: 'B-3 표본은 개체가 아니다. 군체의 일부다. 떨어져 있어도 신호로 이어져 있고, 하나가 배운 것을 모두가 안다. 그렇다면 이 군체의 "머리"는 어디에 있지?' },
  { reg: 4, title: '이사회 지시 사항', who: '연구동 행정실', text: '표본의 상업적 가치를 고려하여 소각을 금함. 연구 데이터는 최우선 보존 대상이며, 승무원 대피는 데이터 전송 이후로 미룸. (오리온 개발 이사회)' },
  { reg: 5, title: '실험 기록: 성장 단계', who: '연구원 정우진', text: '크롤러는 1단계, 제노이드는 2단계. 브루트는... 3단계라고 부르기로 했다. 먹이를 줄 때마다 다음 단계가 나온다. 무엇을 먹였는지는 기록하지 않겠다.' },
  { reg: 5, title: '마지막 실험 기록', who: '연구원 정우진', text: '우리를 부순 건 표본이 아니었다. 잠긴 문은 안에서 열렸다. 놈들이 단말기를 쓸 줄 안다. 아니, 놈들이 우리를 쓰는 법을 배웠다.' },
  { reg: 6, title: '구조 요청', who: '생존자 윤가람', text: '하이브 마더가 사람들을 둥지로 끌고 간다. 죽이지 않는다. 그게 더 무섭다. 둥지가 맥박처럼 뛸 때마다 벽 너머에서 뭔가가 대답한다.' },
  { reg: 6, title: '연구 노트 21', who: '수석 연구원 한서윤 박사', text: '모든 둥지가 같은 박자로 맥동한다. 박자의 근원을 추적했다. 정거장 코어였다. 원자로의 열 한가운데에 무언가가 자리를 잡았다.' },
  { reg: 7, title: '기술반 일지', who: '기술반장 서동혁', text: '원자로가 멈추면 정거장이 얼어붙는다. 그래서 우리는 남았다. 문을 용접하고 냉각수를 돌린다. 구조대가 오면 이 기록을 보여 줘라. 우리는 끝까지 버텼다고.' },
  { reg: 7, title: '비상 절차', who: '기술자 문지성', text: '정거장 자폭은 곧 코어 원자로 과부하다. 안전장치는 중앙 통제실 보안 단말기에 묶여 있다. 해제하려면 통제실 권한이 필요하다. 누군가는 코어까지 가야 한다.' },
  { reg: 8, title: '사령관 기록', who: '기지 사령관 레아 노박', text: '본사가 구조선을 거부했다. 정거장을 "자산"으로 보존하라고. 나는 자산을 지키러 온 게 아니다. 코어 봉쇄를 명령한다. 자폭 권한은 이 단말기에 남겨 둔다.' },
  { reg: 8, title: '보안 시스템 로그', who: '통제실 보안 AI', text: '경고: 코어 구역에서 미확인 신경 신호. 모든 생체 반응이 이 신호에 동기화됨. 분류명 부여: 오버마인드. 권장 조치: 해당 없음. 권장 조치: 해당 없음.' },
  { reg: 9, title: '연구 노트: 마지막', who: '수석 연구원 한서윤 박사', text: '오버마인드는 원자로의 열을 먹고 자랐다. 뇌가 죽으면 군체는 무너진다. 신호가 끊기면 놈들은 그저 굶주린 짐승일 뿐. 누군가는 이 데이터를 들고 살아 나가야 한다.' },
  { reg: 9, title: '이 기록을 듣는 사람에게', who: '기지 사령관 레아 노박', text: '여기까지 왔다면 당신이 마지막 희망이다. 오버마인드를 쓰러뜨리면 원자로가 과부하된다. 탈출정은 코어 입구에 대기시켜 두었다. 뒤돌아보지 말고 뛰어라.' },
];

// ===== 오프닝 컷신 (새 작전): 착륙 지점 거점의 벽을 폭파하고 들어온 해병이 포효 — 클릭·키를 hold초 누르고 있으면 건너뜀 (game.js startIntro) =====
// 시각(초): 노크 · 폭파 · 걸어 들어옴 · 혼잣말 · 돌아섬 · 가까이 (포효·하늘에 한 발) · 구멍 막힘 · 끝
const INTRO = {
  hold: 1,
  place: '궤도 연구기지 케르베로스-7', sub: '신호 두절 412시간, 격납고 외벽',
  quiet: '…늦었군.', roar: ['에일리언 놈들…', '전부 다 죽여주마!!!'],
  knock: [1.5, 2.1, 2.6], boom: 3.2, walk: [3.45, 5.6], quietAt: 5.9, growl: 6.5, turn: 7.2,
  close: [7.6, 11.2], roarAt: 8.0, line2: 8.7, shot: 9.7, seal: 11.6, end: 12.8,
};

// ===== 업적: 수집 도감 [J]의 업적 탭 (기록만 — 이 브라우저의 모든 저장에서 함께 쌓임) =====
// stat: 진행 수치 (game.js achProgress), goal: 목표
const ACHIEVEMENTS = [
  { id: 'kill100',  name: '첫 사냥',            icon: 'icon_knife',       stat: 'kills',     goal: 100,  desc: '몬스터 100마리 처치' },
  { id: 'kill1000', name: '학살자',             icon: 'icon_mg',          stat: 'kills',     goal: 1000, desc: '몬스터 1000마리 처치' },
  { id: 'kill5000', name: '정거장의 악몽',      icon: 'icon_bfg',         stat: 'kills',     goal: 5000, desc: '몬스터 5000마리 처치' },
  { id: 'species',  name: '생태 조사',          icon: 'trooa1',           stat: 'species',   goal: 15,   desc: '몬스터 15종 처치' },
  { id: 'boss3',    name: '거물 사냥',          icon: 'cybra1',           stat: 'bosses',    goal: 3,    desc: '보스 3종 처치' },
  { id: 'boss9',    name: '보스 사냥꾼',        icon: 'bbrna0',           stat: 'bosses',    goal: 9,    desc: '보스 9종 모두 처치' },
  { id: 'super5',   name: '현상금 사냥꾼',      icon: 'yskua0',           stat: 'supers',    goal: 5,    desc: '고유 정예 5명 처치' },
  { id: 'unique5',  name: '보물 사냥꾼',        icon: 'icon_case_gold',   stat: 'uniques',   goal: 5,    desc: '고유 전설 5종 찾기' },
  { id: 'log9',     name: '기록 보관인',        icon: 'pmapa0',           stat: 'logs',      goal: 9,    desc: '데이터 기록 9개 듣기' },
  { id: 'log18',    name: '케르베로스-7의 진실', icon: 'pmapb0',          stat: 'logs',      goal: 18,   desc: '데이터 기록 18개 모두 듣기' },
  { id: 'rescue5',  name: '구조대',             icon: 'sswva1',           stat: 'rescued',   goal: 5,    desc: '생존자 5명 대피 (모든 저장 합)' },
  { id: 'lv10',     name: '베테랑',             icon: 'pstra0',           stat: 'level',     goal: 10,   desc: '레벨 10 달성' },
  { id: 'win',      name: '탈출',               icon: 'tlp2a0',           stat: 'win',       goal: 1,    desc: '오버마인드를 처치하고 탈출' },
];

// ===== 구역 임무 =====
// 목표를 이루면 보상: '고급' 이상 장비 1개 + 골드 MISSION_REWARD.gold x 구역 + 경험치 MISSION_REWARD.xp x 구역 (한 번만, 저장됨)
// rescue: 갇힌 생존자 — 다가가면 따라오고 보급 거점의 순간이동 패드에 닿으면 대피. 몬스터가 동행 중인 생존자도 노리고, 모두 잃으면 실패
// hack: 구역 가장 안쪽 방의 단말기를 [F]로 해킹 — 보안 단계(미니 게임, HACK_GAMES) stages개를 풀면 완료 (hack.js)
//       시작할 때·마지막 단계에서, 그리고 틀릴 때마다 (경보, gap초에 한 번까지) 적 무리 (방 하나 위협 예산 x wave)
// nest: 몬스터를 낳는 둥지 (ENEMIES.nest)를 모두 부숨
const MISSIONS = {
  rescue: { name: '생존자 구출', color: '#7fc8ff', goal: m => `갇힌 생존자 ${m.n}명을 거점 패드까지 데려가라` },
  hack:   { name: '해킹',       color: '#6ff0d8', gap: 8, wave: 0.8, goal: m => `가장 안쪽 방의 ${m.term}를 해킹하라` },
  nest:   { name: '둥지 파괴',   color: '#e07aff', goal: m => `둥지 ${m.n}개를 모두 부숴라` },
};
const MISSION_REWARD = { gold: 100, xp: 50 };
// 해킹 미니 게임 (보안 단계마다 무작위, 한 해킹 안에서는 겹치지 않게). 배열은 난이도별 (구역 4까지, 7까지, 8부터)
// wires: 전선 수, words: 후보 낱말 수·시도, memory: 기억할 길이, circuit: 격자 크기·과부하 여유 (최소 회전 수 + slack번 넘게 돌리면 경보)
const HACK_GAMES = {
  wires:   { name: '전선 연결', n: [4, 5, 6] },
  words:   { name: '암호 찾기', n: [8, 10, 12], tries: 4 },
  memory:  { name: '순서 기억', len: [4, 5, 6] },
  circuit: { name: '회로 연결', size: [4, 5, 6], slack: 8 },
};
// 암호 찾기의 낱말: 앞 두 글자 x 뒤 두 글자 (겹치는 글자가 많아야 '일치' 힌트가 쓸모 있음)
const HACK_WORDS = [
  ['보안', '보급', '보조', '격리', '격납', '중앙', '냉각', '동력', '생체', '비상', '통신', '연구', '감시', '의료', '방어', '기밀'],
  ['구역', '구조', '통제', '통로', '통신', '장치', '회로', '격벽', '기록', '시설', '단말', '신호', '전력', '체계', '봉쇄'],
];
// 생존자: 체력 = hp[0] + hp[1] x 구역 (4초 동안 안 맞으면 초당 4 회복), 따라오는 최고 속도 (플레이어 걷기 4.3, 달리기 6.9),
// 합류 거리(칸), 한 명 대피할 때마다 골드·경험치 (x 구역)
const SURVIVOR = { hp: [180, 25], speed: 5.4, join: 2.4, gold: 60, xp: 30 };

// ===== 구역 돌발 상황 =====
// 구역 from부터 (보급 거점·마지막 구역 제외): 처음엔 at초 무렵, 그 뒤로 gap초마다 chance 확률로 하나씩 (같은 종류가 연달아 나오지 않게)
const EVENT_PLAN = { from: 2, chance: 0.7, at: [60, 120], gap: [90, 160] };
// time: 지속 시간(초)
// blackout: 조명이 모두 꺼짐 (손전등만), 근처(aggro칸) 몬스터가 몰려옴
// gas: 플레이어가 있는 방의 배관이 터져 독가스 구름이 clouds개까지 퍼짐 (반경 r)
// breach: 가까운 벽이 뚫려 r칸 안을 빨아들임 (구멍 가까이 최대 pull칸/초, 멀수록 약해짐) — 구멍과 같은 방(통로면 통로)에서 구멍이 보이는 곳만. 구멍 바로 앞은 초당 dps 피해, 작은 몬스터는 우주로 빨려 나감
const EVENTS = {
  blackout: { name: '정전',        color: '#ff7a5a', time: 35, aggro: 12 },
  gas:      { name: '독가스 누출', color: '#a8e050', time: 35, clouds: [3, 7], r: 2.4 },
  breach:   { name: '선체 파손',   color: '#8cc8ff', time: 12, r: 7, pull: 3.6, dps: 12 },
};

// 배경음악: Freedoom 사운드트랙(MIDI, BSD)을 게임 안 신시사이저로 연주. zones는 구역 1~9 순서
const MUSIC = {
  title: 'd_e2m2', base: 'd_e3m8', escape: 'd_dm17', ending: 'd_victor', // base: 보급 거점 안
  zones: ['d_map21', 'd_e1m1', 'd_e4m8', 'd_e2m6', 'd_map23', 'd_map22', 'd_e4m3', 'd_e1m7', 'd_map30'],
  combat: ['d_map20', 'd_dm32', 'd_map13'], // 전투 곡: 구역 1~3 · 4~6 · 7~9 (COMBAT_MUSIC)
};
// 전투 음악: 플레이어를 알아챈 적이 r칸 안에 있으면 전투 곡으로, 그런 적이 없어지고 hold초 뒤 원래 곡으로
const COMBAT_MUSIC = { r: 12, hold: 6 };


// 신단: 구역마다 SHRINE_PER개 (빈 방 가운데쯤) — [F]로 쓰면 t초 동안 효과 (한 번에 하나 — 새로 쓰면 바뀜). 그림은 Freedoom의 파워업 구체
const SHRINES = {
  power: { name: '힘의 신단',   spr: 'soul', col: '#ffb040', rgb: '255,170,60',  t: 20, desc: '20초 동안 무기 피해 2배', dmg: 2 },
  guard: { name: '수호의 신단', spr: 'pinv', col: '#c39bff', rgb: '190,140,255', t: 20, desc: '20초 동안 받는 피해 60% 감소', cut: 0.6 },
  haste: { name: '신속의 신단', spr: 'pins', tint: 'sepia(1) saturate(5) hue-rotate(150deg) brightness(1.8)', col: '#7fe8ff', rgb: '120,230,255', t: 20, desc: '20초 동안 이동 속도 +40%, 공격 속도 +25%', spd: 1.4, rate: 1.25 },
};
const SHRINE_PER = 2;
// 시련의 방: 구역 from부터 구역마다 하나 (minW x minH칸 이상, 입구를 막을 수 있는 방 — 빈 방이 없으면 필드 사건 하나를 바꿈) — 들어서면 입구가 붉은 막으로 잠기고 적 무리가 waves번 몰려옴
// (크기 wave, 앞 무리가 하나 남거나 gap초가 지나면 다음, 마지막엔 정예). 다 처치하면 막이 걷히고 가운데 보물함이 열림 (경험치 xp x 구역).
// 쓰러지면 막이 걷히고 남은 적은 사라짐 — 다시 도전할 수 있음. 마친 시련은 저장됨
const TRIAL = { from: 2, waves: 3, wave: 0.9, gap: 18, minW: 6, minH: 6, xp: 60 };
// 곡 제목, 작곡 (Freedoom CREDITS-MUSIC), 음량 보정 (합성해서 잰 크기 차이를 줄임: 조용한 곡은 키우고 시끄러운 곡은 줄임)
const MUSIC_INFO = {
  d_e2m2: ['Voidgaze', 'Korp', 1.44], d_e3m8: ['The Zenith', 'Lola "BlueWorrior" Harvey', 1.69],
  d_dm17: ['Panic', 'Anthony "Ajanddino" Pierce', 0.78], d_victor: ['Distance', 'Korp', 1.7],
  d_map21: ['Rough Landing', 'Korp (원곡 jute)', 1.08], d_e1m1: ['Steel and Brass', 'J.Astartes, Mr795', 0.78],
  d_e4m8: ['Vs. The Assault Quindecapod', 'continuum.mid', 0.77], d_e2m6: ['Concept of Technology', 'Korp', 1.32],
  d_map23: ["Within the Trilo's Den", 'MoonDeLaAxel, Korp', 1.48], d_map22: ['Alien Waltz', 'Korp', 1.25],
  d_e4m3: ['Space Spectre', 'Matzu', 1.13], d_e1m7: ['Totally Surrounded', 'J.Astartes', 0.74],
  d_map30: ['Devoured by the Jaws of Defeat', 'Korp (원곡 Tyler "Picklehammer" P.)', 1.23],
  d_map20: ['Wrath of Horizon', 'J.Astartes', 0.8], d_dm32: ['Bullet Hell', 'rostuhan', 0.78], d_map13: ['Fear', 'Discoholic', 0.72], // 전투 곡 (음표가 빽빽해 조금 줄임)
};

// 상자: 근접 공격으로 부숨 (체력), 부서질 때 탄약·골드·아이템이 나올 확률
const CRATE_HP = 45;
const CRATE_LOOT = 0.3;

// 난이도: hp = 적 체력 배율, dmg = 플레이어가 받는 피해 배율 (새 게임에서 고르고 저장 파일에 기록)
const DIFFICULTY = {
  easy:   { name: '쉬움',   hp: 0.75, dmg: 0.6, desc: '적 체력 75%, 받는 피해 60%' },
  normal: { name: '보통',   hp: 1,    dmg: 1,   desc: '기본 난이도' },
  hard:   { name: '어려움', hp: 1.35, dmg: 1.4, desc: '적 체력 135%, 받는 피해 140%' },
};

// ===== 보안문 / 키카드 (Doom식) =====
// 방 하나의 입구를 모두 같은 색 보안문으로 잠그고, 키카드는 그 문을 열기 전에 갈 수 있는 곳에 둠
// 파랑 → 노랑 → 빨강 순서로 풀리며 마지막 색은 되도록 출구 방. 키카드는 그 구역에서만 쓰임
// spr: Freedoom 키카드 스프라이트, tex: 문 양 끝 표시등 텍스처, rgb: 조명색
const KEYCARDS = {
  blue:   { name: '파란 키카드', door: '파란 보안문', color: '#5aa0ff', rgb: '70,140,255', spr: 'bkey', tex: 'wall_doorblu' },
  yellow: { name: '노란 키카드', door: '노란 보안문', color: '#ffd84a', rgb: '255,210,60', spr: 'ykey', tex: 'wall_dooryel' },
  red:    { name: '빨간 키카드', door: '빨간 보안문', color: '#ff5a4a', rgb: '255,70,50',  spr: 'rkey', tex: 'wall_doorred' },
  // 금고 열쇠: 그 구역의 고유 정예가 지님 (금빛 해골 열쇠, 깜박이지 않음). 불러오면 다시 찾아야 함
  vault:  { name: '금고 열쇠',   door: '금고 문',     color: '#ffc040', rgb: '255,190,60', spr: 'ysku', tex: 'wall_dooryel', still: true },
};
const KEY_ORDER = ['blue', 'yellow', 'red'];
const LOCKS = [1, 1, 1, 2, 2, 2, 2, 2, 2]; // 구역 1~9의 보안문 색 수 (방 구조상 못 만들면 줄어듦) — 키카드는 그 구역에서만 쓰임

// ===== 분위기 소리 (환경음 음량으로 조절) =====
// wind: 환기구 바람 크기, hum: 기계음 크기, freq: 기계음 높이(Hz) — zones는 구역 테마(game.js THEMES) 순서 (구역마다 ACTS의 themes)
// 정전이 나면 기계음이 꺼지고 바람이 줄어듦. gap: 멀리서 들리는 소리 간격(초), far: 몬스터 기척이 들리는 거리(칸)
// noises: 기지 어딘가의 먼 기계 소리 [Freedoom 효과음, 크기, 재생 속도]
const AMBIENCE = {
  title: { wind: 0.02, hum: 0.02, freq: 55 },
  base:  { wind: 0.015, hum: 0.03, freq: 60 },
  zones: [
    { wind: 0.05, hum: 0.025, freq: 48 },
    { wind: 0.03, hum: 0.035, freq: 60 },
    { wind: 0.045, hum: 0.03, freq: 41 },
    { wind: 0.035, hum: 0.04, freq: 52 },
  ],
  gap: [5, 11], far: [8, 22],
  noises: [['dsstnmov', 0.5, 0.7], ['dsmetal', 0.35, 0.55], ['dspstop', 0.4, 0.6], ['dsbdcls', 0.3, 0.7], ['dsswtchn', 0.25, 0.5]],
};

// ===== 첫 플레이 안내 =====
// 처음 만나는 순간 한 번만 화면 왼쪽 아래에 카드로 (게임은 멈추지 않음, [H] 닫기). 본 안내는 브라우저에 기록되고
// 설정에서 끄거나 처음부터 다시 볼 수 있음. icon: 아틀라스 그림 (null이면 그림 없이)
const TIP_TIME = 13; // 카드가 떠 있는 시간 (초)
const TIPS = {
  hub:       { title: '보급 거점', icon: null, lines: ['안에서는 싸울 수 없다. 자판기 앞에서 [F], 가운데 패드로 순간이동'] },
  gate:      { title: '봉쇄 격벽', icon: null, lines: ['보스를 처치하거나 임무를 마치면 열린다'] },
  controls:  { title: '기본 조작', icon: 'playa1', lines: ['WASD 이동, 좌클릭 공격, Shift 달리기, Space 회피, I 인벤토리'] },
  skills:    { title: '스킬 쉘', icon: 'bfe1d0', lines: ['스킬 창 [K]의 칸(Z X V B)에 쉘을 끼워 쓴다'] },
  vision:    { title: '어둠 속의 시야', icon: 'tlmpa0', lines: ['손전등이 비추는 곳만 보인다. 등 뒤를 조심하라'] },
  key:       { title: '보안문과 키카드', icon: 'bkeya0', lines: ['같은 색 키카드가 있어야 열린다'] },
  loot:      { title: '무기 줍기', icon: 'icon_pump', lines: ['[F]로 줍는다. 이름 색이 등급이다'] },
  elite:     { title: '정예 몬스터', icon: 'trooa1', lines: ['강하지만 좋은 장비를 떨어뜨린다'] },
  armor:     { title: '장갑 몬스터', icon: 'bos2a1', lines: ['약한 탄은 잘 안 통하지만 몇 발에 한 발은 뚫린다', '강한 한 방이나 철갑탄 탄창이 잘 통한다'] },
  dodge:     { title: '총알을 피하는 적', icon: 'trooa1', lines: ['넓게 쏘거나 피한 직후를 노려라'] },
  boss:      { title: '보스', icon: 'cybra1', lines: ['체력이 절반 밑이면 격노한다', '보스방에 들어서면 입구가 잠긴다. 처치하거나 쓰러지면 열린다', '갇힌 동안 나타나는 작은 적은 가끔 탄약을 떨어뜨린다'] },
  downed:    { title: '쓰러짐', icon: 'playk0', lines: ['기어 다니며 쏠 수 있다', '피해를 주거나 적을 처치하거나 탄약을 주우면 다시 일어난다'] },
  levelup:   { title: '레벨 업', icon: 'icon_syringe_blue', lines: ['특성은 스킬 창 [K]에서 올린다'] },
  xpdrop:    { title: '잃어버린 경험치', icon: 'playn0', lines: [`쓰러진 자리에서 주우면 ${Math.round(DEATH_XP * 100)}%를 되찾는다`] },
  rescue:    { title: '임무: 생존자 구출', icon: 'sswva1', lines: ['생존자를 거점 패드까지 데려가라'] },
  hack:      { title: '임무: 해킹', icon: null, lines: ['단말기의 보안 단계를 풀어라. 틀리면 경보가 울린다', '전선: 같은 색끼리 / 암호: 일치 수가 힌트 / 순서: 켜진 대로 / 회로: 칸을 돌려 잇기'] },
  nest:      { title: '임무: 둥지 파괴', icon: 'col5a0', lines: ['둥지는 계속 몬스터를 낳는다. 서둘러 부숴라'] },
  blackout:  { title: '정전', icon: 'tlmpa0', lines: ['손전등이 비추는 곳만 보인다'] },
  gas:       { title: '독가스 누출', icon: 'icon_gren_gas', lines: ['치료제 [E]를 쓰거나 방을 벗어나라'] },
  breach:    { title: '선체 파손', icon: null, lines: ['구멍 쪽으로 빨려 간다. 다른 방으로 피하라'] },
  watcher:   { title: '감시자', icon: 'vilea1d1', lines: ['발밑에 붉은 원이 생기면 바로 비켜서라'] },
  gear:      { title: '방어구', icon: 'icon_vest_tac', lines: ['머리, 몸통, 팔, 다리 방어구가 받는 피해를 줄인다'] },
  augment:   { title: '강화칩·강화장신구', icon: 'icon_chip_str3', lines: ['칩은 몸 능력을, 장신구는 한 계열의 스킬을 키운다'] },
  melee:     { title: '근접 무기', icon: 'icon_knife', lines: ['근접으로 처치하면 체력과 탄약을 얻는다'] },
  attach:    { title: '무기 파츠', icon: 'att_scope', lines: ['보급 거점의 개조 자판기에서 무기에 끼운다'] },
  thief:     { title: '보물 약탈자', icon: 'sthfa1', lines: ['놓치면 사라진다. 달려서 쫓아라'] },
  shrine:    { title: '신단', icon: 'soula0', lines: ['[F]로 쓰면 20초 동안 강해진다'] },
  trial:     { title: '시련의 방', icon: 'icon_case_gold', lines: ['들어서면 입구가 잠긴다. 적 무리를 모두 처치하라'] },
  slots:     { title: '무기 슬롯', icon: null, lines: ['구역 3·6의 보스를 처치하면 한 칸씩 열린다'] },
  log:       { title: '데이터 기록', icon: 'pmapa0', lines: ['[J] 수집 도감에서 다시 들을 수 있다'] },
  ach:       { title: '업적', icon: null, lines: ['이룬 업적은 수집 도감 [J]에 모인다'] },
  unique:    { title: '★ 고유 전설', icon: null, lines: ['고유 효과가 있는 특별한 장비다'] },
  poison:    { title: '중독', icon: 'icon_pills', lines: ['치료제 [E]로 풀 수 있다'] },
  shock:     { title: '감전', icon: 'suita0', lines: ['치료제 [E]로 풀 수 있다'] },
  stamina:   { title: '스태미너', icon: 'icon_syringe_blue', lines: ['바닥나면 잠시 달릴 수 없다'] },
  lowhp:     { title: '체력이 낮다', icon: 'icon_medkit', lines: ['메디킷 [Q]로 회복한다'] },
  bagfull:   { title: '가방이 가득 참', icon: 'bpaka0', lines: ['창고에 맡기거나 보급 자판기에서 팔아라'] },
  noammo:    { title: '탄약이 떨어짐', icon: 'clipa0', lines: ['다른 무기로 바꿔라. 근접 무기는 탄약이 필요 없다'] },
  super:     { title: '고유 정예', icon: null, lines: ['금고 열쇠를 지닌 강적이다'] },
  vault:     { title: '금고', icon: 'yskua0', lines: ['[F]로 열면 장비가 쏟아진다'] },
  event:     { title: '필드 사건', icon: 'tlp2a0', lines: ['[F]로 열면 보급품, 대신 적이 몰려온다'] },
  shielder:  { title: '방패 해병', icon: 'cpsha1', lines: ['옆이나 뒤로 돌아가서 공격하라'] },
  bomber:    { title: '폭주 해골', icon: 'skula1', lines: ['붉은 원 밖으로 피하라'] },
  assassin:  { title: '그림자 추적자', icon: 'sasna1', lines: ['맞히면 잠시 드러난다'] },
  summoner:  { title: '되살리는 자', icon: 'vsuma1d1', lines: ['쓰러진 몬스터를 되살린다. 먼저 처치하라'] },
  lurker:    { title: '매복자', icon: null, lines: ['바닥의 그림자가 짙어지면 비켜라'] },
  burrower:  { title: '굴착자', icon: null, lines: ['흙더미가 흔들리면 곧 솟아오른다'] },
  warden:    { title: '수호 드론', icon: null, lines: ['주변 적에게 보호막을 씌운다. 드론부터 노려라'] },
  codex:     { title: '수집 도감', icon: null, lines: ['[J] 처치한 적과 찾은 장비가 모인다'] },
  curse:     { title: '저주', icon: null, lines: ['저주하는 정예가 보이면 방어가 절반이 된다'] },
  escape:    { title: '탈출', icon: null, lines: ['커서 옆 화살표를 따라 탈출정으로 가라'] },
};
