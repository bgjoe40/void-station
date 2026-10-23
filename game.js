'use strict';
// ===================== VOID STATION =====================
// 아이소메트릭 우주기지 핵앤슬래시 프로토타입 (HTML5 Canvas)

const TW = 64, TH = 32, WALLH = 72, HUD_H = 132;
const AUTO_AIM_CONE = 0.55; // 자동 조준 허용 각도 (화면 기준 한쪽, 라디안 ≈ 31°)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const lightC = document.createElement('canvas');
const lctx = lightC.getContext('2d');
const overlay = document.getElementById('overlay');
let W = 0, H = 0, VH = 0;
function resize() {
  W = canvas.width = innerWidth; H = canvas.height = innerHeight; VH = H - HUD_H;
  lightC.width = W; lightC.height = VH;
}
addEventListener('resize', resize); resize();

// ===== 유틸 =====
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function weighted(obj) { let s = 0; for (const k in obj) s += obj[k]; let r = Math.random() * s; for (const k in obj) { r -= obj[k]; if (r <= 0) return k; } return Object.keys(obj)[0]; }

// ===== 그래픽 에셋 (tools/build_assets.py 가 만든 assets/) =====
// Freedoom(BSD) 스프라이트·텍스처 + knekko(CC0) 무기 아이콘
const META = window.ASSET_META || { frames: {}, sprites: {}, textures: {} };
const ART = { ready: false, atlas: null, tex: {} };
ART.loading = (() => {
  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `${src}?v=${window.BUILD || 0}`; }); // 다시 만든 아틀라스도 바로 (캐시를 쓰지 않음)
  const jobs = [load(META.atlas).then(im => { ART.atlas = im; })];
  for (const k in META.textures) jobs.push(load(`assets/tex/${k}.png`).then(im => { if (im) ART.tex[k] = im; }));
  return Promise.all(jobs).then(() => {
    ART.ready = !!ART.atlas;
    if (ART.ready && ART.tex.flat_ceil5_1) ART.topPat = ctx.createPattern(ART.tex.flat_ceil5_1, 'repeat');
    if (ART.ready) floorChunks.clear();
  });
})();

// ===== 사운드: Freedoom 효과음(assets/sfx) — 매핑이 없거나 못 불러오면 합성음 =====
// 이름 -> [Freedoom 사운드(여럿이면 무작위), 볼륨, 재생 속도, 최소 재생 간격(초)]
const SFX = {
  pistol: [['dspistol'], 0.6, 1.05], revolver: [['dspistol'], 0.9, 0.78], smg: [['dspistol'], 0.4, 1.2],
  shotgun: [['dsshotgn'], 0.8, 1], dshotgun: [['dsdshtgn'], 0.9, 1], rifle: [['dsshotgn'], 0.7, 1.5],
  swing: [['dsskeswg'], 0.5, 1.3], meleeHit: [['dspunch'], 0.8, 1],
  explode: [['dsbarexp', 'dsrxplod'], 1, 1], fire: [['dsflamst'], 0.8, 1], shock: [['dsplasma'], 0.8, 0.7], cryo: [['dstelept'], 0.6, 1.5],
  pickup: [['dsitemup'], 0.6, 1], weapon: [['dswpnup'], 0.7, 1], gold: [['dsitemup'], 0.35, 1.5], heal: [['dsgetpow'], 0.6, 1],
  crate: [['dspstop'], 0.9, 0.85], enemyGun: [['dspistol'], 0.45, 0.85, 0.05],
  plasmaGun: [['dsplasma'], 0.55, 1.1, 0.04], rocketGun: [['dsrlaunc'], 0.9, 1], bfgGun: [['dsbfg'], 1, 1], bfgBoom: [['dsrxplod'], 1, 0.55],
  levelUp: [['dsgetpow'], 1, 0.75],
  reload: [['dssgcock'], 0.6, 1], empty: [['dsswtchn'], 0.4, 1.3], hurt: [['dsplpain'], 0.8, 1, 0.25], pdeath: [['dspldeth'], 1, 1],
  spit: [['dsfirsht'], 0.6, 1.2], zap: [['dsplasma'], 0.5, 1.4], exit: [['dstelept'], 0.8, 1], buy: [['dsitemup'], 0.6, 1.2],
  menu: [['dsswtchn'], 0.5, 1], deny: [['dsoof'], 0.6, 1, 0.3], save: [['dsitmbk'], 0.7, 1],
  uiMove: [['dsswtchn'], 0.16, 1.9], uiOk: [['dsswtchx'], 0.42, 1.12], uiBack: [['dsswtchn'], 0.3, 0.78], // 메뉴: 고르기 · 확인 · 뒤로
  rocket: [['dsrlaunc'], 0.8, 1], stomp: [['dsbarexp'], 1, 0.6], door: [['dsdoropn'], 0.45, 1], doorClose: [['dsdorcls'], 0.35, 1],
  key: [['dsitemup'], 0.9, 0.85], unlock: [['dsswtchx'], 0.7, 1],
  fireball: [['dsmanatk'], 0.8, 1], fireHit: [['dsfirxpl'], 0.6, 1, 0.08], podHatch: [['dsboscub'], 0.8, 1], bigHurt: [['dspunch'], 0.9, 0.8],
  // 구역 임무: 생존자 합류(무전)·피격·사망·대피, 해킹 시작·완료
  radio: [['dsradio'], 0.9, 1], survHurt: [['dsplpain'], 0.55, 1.3, 0.3], survDie: [['dsssdth'], 0.9, 1], evac: [['dstelept'], 0.8, 1.2],
  hack: [['dspstart'], 0.8, 1], hackDone: [['dsswtchx'], 1, 0.8],
  unique: [['dsitmbk'], 1, 0.7], // 고유 전설 발견
  // 분위기: 대형 몬스터 발걸음, 크롤러가 바닥을 긁는 소리
  stepBig: [['dshoof'], 0.6, 1, 0.2], stepMetal: [['dsmetal'], 0.5, 1, 0.2], stepHeavy: [['dshoof'], 0.3, 0.75, 0.15], skitter: [['dsbspwlk'], 0.3, 1.25, 0.5],
  ballThrow: [['dsfirsht'], 0.8, 0.8], armorHit: [['dspunch'], 0.35, 1.6, 0.08], // 브루트의 구체 던지기, 장갑에 막힌 탄
  shieldBreak: [['dsbarexp'], 0.55, 1.7], // 방패가 부서짐
  shade: [['dstelept'], 0.5, 1.5, 0.15], raise: [['dsslop'], 0.8, 0.85], // 그림자 추적자의 순간이동, 되살리는 자가 시체를 일으킴
  laser: [['dsplasma'], 0.55, 0.5, 0.12], // 처형자의 레이저
  // 액티브 스킬 (스킬 쉘)
  skillShock: [['dsrxplod'], 0.85, 1.5], mineBoom: [['dsbarexp'], 0.75, 1.15, 0.05], turretUp: [['dspstop'], 0.8, 1.3], turretGun: [['dspistol'], 0.35, 1.35, 0.05],
  berserk: [['dssgtsit'], 1, 0.75], charge: [['dssklatk'], 0.9, 1], sawUp: [['dssawup'], 0.7, 1], sawRun: [['dssawful'], 0.4, 1, 0.3], sawHit: [['dssawhit'], 0.5, 1, 0.12],
  iron: [['dsmetal'], 0.9, 0.7], blink: [['dstelept'], 0.8, 1.3], cloak: [['dsgetpow'], 0.7, 0.55], blades: [['dsskeswg'], 0.7, 1.5], deadeye: [['dspstart'], 0.7, 1.3],
  droneUp: [['dsitmbk'], 0.7, 1.3], droneGun: [['dsplasma'], 0.3, 1.6, 0.05], teslaUp: [['dsswtchx'], 0.8, 0.8], tesla: [['dsplasma'], 0.45, 0.6, 0.08],
  missiles: [['dsrlaunc'], 0.6, 1.5], chain: [['dsplasma'], 0.9, 0.5], inferno: [['dsvilatk'], 0.8, 1], gravity: [['dsbospit'], 0.8, 0.6],
  implode: [['dsrxplod'], 0.9, 0.6], drain: [['dsbospn'], 0.6, 1.3],
  pillar: [['dsflame'], 0.9, 1, 0.08], // 감시자의 불기둥
};
// 걸을 때 발소리를 내는 몬스터: [소리, 간격(초), 들리는 거리(칸)] — 크롤러는 여럿이라 가까이서만, 같은 소리는 겹치지 않게(SFX 간격)
const ENEMY_STEP = { titan: ['stepBig', 0.55, 16], hivemother: ['stepMetal', 0.5, 16], brute: ['stepHeavy', 0.6, 12], mortar: ['stepHeavy', 0.8, 12], crawler: ['skitter', 0.8, 8], runner: ['skitter', 0.5, 8], juggernaut: ['stepBig', 0.8, 14],
  crusher: ['stepHeavy', 0.45, 14], plaguegiant: ['stepBig', 0.9, 14], executioner: ['stepMetal', 0.5, 12] };
// 몬스터별 소리: 발견, 사망, 피격, 공격, idle: 아직 플레이어를 모를 때 멀리서 들리는 기척 (Doom의 'active' 소리)
const ENEMY_SFX = {
  // 크롤러는 떼로 와서 소리가 겹치므로 작고 짧은 소리로, 조금 높게 (vol: 크기 배율, rate: 재생 속도 — 작은 몸집)
  crawler: { sight: 'dsbgact', death: 'dsslop', pain: 'dspopain', attack: 'dsclaw', idle: 'dsposact', vol: 0.55, rate: 1.25 },
  runner:  { sight: 'dsbgact', death: 'dsslop', pain: 'dspopain', attack: 'dsclaw', idle: 'dsposact', vol: 0.55, rate: 1.4 },
  xenoid:  { sight: ['dsbgsit1', 'dsbgsit2'], death: ['dsbgdth1', 'dsbgdth2'], pain: 'dspopain', attack: 'dsclaw', idle: 'dsbgact' },
  spitter: { sight: 'dsskesit', death: 'dsskedth', pain: 'dspopain', attack: 'dsskeatk', idle: 'dsskeact' },
  sparker: { sight: 'dscacsit', death: 'dscacdth', pain: 'dsdmpain', attack: 'dsplasma', idle: 'dsdmact' },
  brute:   { sight: 'dsbrssit', death: 'dsbrsdth', pain: 'dsdmpain', attack: 'dsclaw', idle: 'dsdmact' },
  titan:      { sight: 'dscybsit', death: 'dscybdth', pain: 'dsdmpain', attack: 'dshoof' },
  hivemother: { sight: 'dsspisit', death: 'dsspidth', pain: 'dsdmpain', attack: 'dsmetal' },
  overmind:   { sight: 'dsbossit', death: 'dsbosdth', pain: 'dsbospn', attack: 'dsbospit' },
  charger: { sight: 'dssgtsit', death: 'dssgtdth', pain: 'dsdmpain', attack: 'dssgtatk', idle: 'dsdmact' },
  gunner:  { sight: ['dsposit1', 'dsposit2', 'dsposit3'], death: ['dspodth1', 'dspodth2', 'dspodth3'], pain: 'dspopain', attack: 'dsclaw', idle: 'dsposact' },
  brooder: { sight: 'dspesit', death: 'dspedth', pain: 'dspepain', attack: 'dssklatk', idle: 'dsdmact' },
  mortar:  { sight: 'dsmansit', death: 'dsmandth', pain: 'dsmnpain', attack: 'dsmanatk', idle: 'dsdmact' },
  nest:    { sight: 'dsbgact', death: 'dsslop', pain: 'dsdmpain', attack: 'dsslop', idle: 'dsslop' }, // attack: 몬스터를 낳을 때
  juggernaut: { sight: 'dskntsit', death: 'dskntdth', pain: 'dsdmpain', attack: 'dsclaw', idle: 'dsdmact' },
  watcher: { sight: 'dsvilsit', death: 'dsvildth', pain: 'dsvipain', attack: 'dsvilatk', idle: 'dsvilact' },
  shielder: { sight: ['dsposit1', 'dsposit2', 'dsposit3'], death: ['dspodth1', 'dspodth2', 'dspodth3'], pain: 'dspopain', attack: 'dspunch', idle: 'dsposact' },
  bomber:   { sight: 'dsdmact', death: 'dsfirxpl', pain: 'dsdmpain', attack: 'dssklatk', idle: 'dsdmact' }, // attack: 불이 붙을 때
  assassin: { sight: 'dssgtsit', death: 'dssgtdth', pain: 'dsdmpain', attack: 'dssgtatk', idle: 'dsdmact' },
  summoner: { sight: 'dsvilsit', death: 'dsvildth', pain: 'dsvipain', attack: 'dsvilatk', idle: 'dsvilact' }, // attack: 되살리는 주문
  // 구역 보스
  crusher:     { sight: 'dssgtsit', death: 'dssgtdth', pain: 'dsdmpain', attack: 'dssgtatk', idle: 'dsdmact' },
  broodmother: { sight: 'dspesit', death: 'dspedth', pain: 'dspepain', attack: 'dssklatk', idle: 'dsdmact' },
  argus:       { sight: 'dscacsit', death: 'dscacdth', pain: 'dsdmpain', attack: 'dsfirsht', idle: 'dsdmact' },
  plaguegiant: { sight: 'dsmansit', death: 'dsmandth', pain: 'dsmnpain', attack: 'dsmanatk', idle: 'dsdmact' },
  voidpriest:  { sight: 'dsvilsit', death: 'dsvildth', pain: 'dsvipain', attack: 'dsvilatk', idle: 'dsvilact' },
  executioner: { sight: 'dsskesit', death: 'dsskedth', pain: 'dspopain', attack: 'dsskeatk', idle: 'dsskeact' },
  thief:       { sight: 'dsposact', death: 'dsssdth', pain: 'dspopain', attack: 'dspunch', idle: 'dsposact' }, // 보물 약탈자
  lurker:   { sight: 'dsbspsit', death: 'dsbspdth', pain: 'dsdmpain', attack: 'dsclaw', idle: 'dsbspact', vol: 0.8, rate: 0.85 }, // 매복자: 떨어질 때 낮은 거미 비명
  burrower: { sight: 'dsbgsit2', death: 'dsbgdth2', pain: 'dspopain', attack: 'dsclaw', idle: 'dsbgact', rate: 0.85 },        // 굴착자
  warden:   { sight: 'dsswtchx', death: 'dsbarexp', pain: 'dsmetal', attack: 'dsswtchx', idle: 'dsposact', vol: 0.6 },        // 수호 드론: 기계음, 터지며 사라짐
};
const Snd = {
  ctx: null, last: {}, buf: {},
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 음량 단계: 전체(out) ← 효과음(sfxVol: 합성음 master + 샘플 sfx), 배경음악(musicVol), 환경음(ambVol) — 설정 화면에서 조절
      const gain = (v, to) => { const g = this.ctx.createGain(); g.gain.value = v; g.connect(to); return g; };
      this.out = gain(settings.master, this.ctx.destination);
      this.sfxVol = gain(settings.sfx, this.out);
      this.musicVol = gain(settings.music, this.out);
      this.ambVol = gain(settings.amb, this.out);
      this.master = gain(0.35, this.sfxVol);
      this.sfx = gain(0.7, this.sfxVol);
      this.amb = gain(0.7, this.ambVol); // 먼 기척·기계 소리 (샘플)
      for (const n of META.sounds || []) {
        fetch(`assets/sfx/${n}.wav`).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(a => { this.buf[n] = a; }).catch(() => {});
      }
      Music.init(this.ctx, this.musicVol, this.noise);
      Amb.init(this.ctx, this.ambVol, this.noise);
    } catch (e) { this.ctx = null; }
  },
  // Freedoom 효과음 재생. 위치(x, y)를 주면 플레이어와의 거리로 줄이고 좌우로 나눔 (bus: 보낼 곳, 기본은 효과음)
  sample(names, vol = 1, rate = 1, x, y, bus) {
    const b = this.buf[Array.isArray(names) ? pick(names) : names];
    if (!b) return false;
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = b; s.playbackRate.value = rate * rnd(0.95, 1.05);
    let out = g;
    if (x !== undefined && player) {
      vol *= clamp(1 - Math.hypot(x - player.x, y - player.y) / 18, 0.06, 1);
      if (c.createStereoPanner) { const pn = c.createStereoPanner(); pn.pan.value = clamp((PX(x, y) - W / 2) / (W / 2), -1, 1) * 0.8; g.connect(pn); out = pn; }
    }
    g.gain.value = vol; s.connect(g); out.connect(bus || this.sfx); s.start();
    return true;
  },
  ready(key, gap) {
    const now = this.ctx.currentTime;
    if (this.last[key] && now - this.last[key] < gap) return false;
    this.last[key] = now;
    return true;
  },
  nz(dur, freq, vol, type = 'lowpass', at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.8); s.stop(t + dur);
  },
  tn(f0, f1, dur, vol, type = 'square', at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  },
  play(n, x, y) {
    if (!this.ctx || !this.ready(n, (SFX[n] && SFX[n][3]) || 0.03)) return;
    const f = SFX[n];
    if (f && this.sample(f[0], f[1], f[2], x, y)) return;
    switch (n) { // 합성음 (Freedoom에 맞는 소리가 없거나 아직 못 불러온 경우)
      case 'pistol': case 'enemyGun': this.nz(0.12, 2500, 0.5); this.tn(180, 60, 0.08, 0.12); break;
      case 'revolver': this.nz(0.22, 1800, 0.8); this.tn(140, 45, 0.15, 0.18); break;
      case 'smg': this.nz(0.07, 2600, 0.35); break;
      case 'shotgun': case 'dshotgun': this.nz(0.35, 1100, 0.9); this.tn(110, 35, 0.22, 0.25); this.nz(0.05, 3000, 0.25, 'bandpass', 0.35); break;
      case 'rifle': this.nz(0.28, 3200, 0.75); this.tn(220, 50, 0.2, 0.15); break;
      case 'swing': this.nz(0.12, 900, 0.25, 'bandpass'); break;
      case 'meleeHit': this.nz(0.1, 600, 0.6); this.tn(90, 50, 0.1, 0.2); break;
      case 'hit': this.nz(0.04, 1500, 0.15, 'bandpass'); break;
      case 'explode': this.nz(0.9, 450, 1.0); this.tn(80, 25, 0.6, 0.5, 'sine'); break;
      case 'gas': this.nz(0.9, 3000, 0.3, 'highpass'); break;
      case 'shock': this.tn(900, 150, 0.35, 0.18, 'sawtooth'); this.nz(0.25, 4000, 0.35, 'highpass'); break;
      case 'cryo': this.tn(1500, 700, 0.45, 0.12, 'sine'); this.nz(0.35, 5000, 0.25, 'highpass'); break;
      case 'fire': this.nz(0.7, 700, 0.5); break;
      case 'throw': this.nz(0.15, 700, 0.2, 'bandpass'); break;
      case 'pickup': case 'weapon': case 'buy': case 'key': this.tn(600, 1200, 0.1, 0.15, 'sine'); break;
      case 'gold': this.tn(1300, 1900, 0.08, 0.1, 'sine'); break;
      case 'heal': case 'levelUp': this.tn(400, 900, 0.3, 0.2, 'triangle'); break;
      case 'reload': this.nz(0.05, 3000, 0.3, 'bandpass'); this.nz(0.05, 2000, 0.3, 'bandpass', 0.25); break;
      case 'hurt': case 'pdeath': case 'survHurt': case 'survDie': this.tn(200, 80, 0.2, 0.2); break;
      case 'dash': this.nz(0.18, 600, 0.3, 'bandpass'); break;
      case 'empty': case 'menu': case 'unlock': case 'radio': case 'hack': this.tn(1000, 990, 0.03, 0.1); break;
      case 'spit': this.nz(0.2, 800, 0.25, 'bandpass'); break;
      case 'zap': case 'plasmaGun': this.tn(1200, 400, 0.15, 0.08, 'sawtooth'); break;
      case 'rocketGun': this.nz(0.4, 600, 0.5); break;
      case 'bfgGun': this.tn(200, 1200, 0.8, 0.2, 'sawtooth'); break;
      case 'bfgBoom': this.nz(1.2, 300, 1); this.tn(60, 20, 0.9, 0.5, 'sine'); break;
      case 'exit': case 'save': case 'evac': case 'hackDone': this.tn(300, 900, 0.6, 0.25, 'sine'); break;
      case 'alarm': this.tn(880, 870, 0.28, 0.1); this.tn(620, 610, 0.28, 0.1, 'square', 0.32); break; // 자폭 경보 (Freedoom에 없음)
      case 'wind': this.nz(0.55, rnd(500, 900), 0.3, 'bandpass'); break; // 선체 파손: 빨려 나가는 바람 (Freedoom에 없음)
      // 분위기 (Freedoom에 없음): 금속 바닥 발소리, 체력이 낮을 때 심장 박동, 안내 카드
      case 'step': this.nz(0.07, rnd(260, 380), 0.2); this.nz(0.025, 2600, 0.035, 'bandpass'); break;
      case 'heart': this.tn(75, 42, 0.13, 0.4, 'sine'); this.tn(68, 40, 0.11, 0.28, 'sine', 0.2); break;
      case 'tip': this.tn(660, 660, 0.12, 0.08, 'sine'); this.tn(990, 990, 0.18, 0.07, 'sine', 0.1); break;
      case 'dodge': this.nz(0.13, 1300, 0.14, 'bandpass'); break; // 옆으로 뛰는 바람 소리
      case 'unique': this.tn(500, 1500, 0.5, 0.2, 'triangle'); break;
      case 'fireball': case 'fireHit': this.nz(0.4, 800, 0.4); break;
      case 'podHatch': case 'crate': this.nz(0.3, 500, 0.4); break;
      case 'bigHurt': this.nz(0.12, 400, 0.6); this.tn(70, 40, 0.15, 0.3, 'sine'); break;
    }
  },
  // 몬스터 소리: kind = sight | death | pain | attack (같은 종류는 잠시 겹치지 않게)
  mon(e, kind) {
    if (this.ctx && this.ready(e.type + kind, kind === 'death' ? 0.05 : 0.4)) this.monPlay(e.type, kind, e.x, e.y);
  },
  monPlay(type, kind, x, y) { // 몬스터 소리 한 번 — 종류별 크기·높낮이 (ENEMY_SFX의 vol·rate, 디버그 뷰어도 씀)
    const S = ENEMY_SFX[type];
    this.sample(S[kind], (kind === 'death' ? 0.9 : 0.7) * (S.vol || 1), S.rate || 1, x, y);
  },
};

// ===== 설정 (음량) — 브라우저 localStorage에 저장 =====
const SETTINGS_KEY = 'voidstation.settings.v1';
const settings = { master: 0.9, music: 0.6, sfx: 0.9, amb: 0.8, tips: true, shake: 1, dmgNums: true, hurtFx: true }; // amb: 환경음, tips: 첫 플레이 안내, shake: 화면 흔들림 배율, dmgNums: 피해 숫자, hurtFx: 피격 화면 효과
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* 저장 못 하면 이번 실행에만 적용 */ } };
function applyVolume() {
  if (!Snd.ctx) return;
  const t = Snd.ctx.currentTime;
  Snd.out.gain.setTargetAtTime(settings.master, t, 0.02);
  Snd.sfxVol.gain.setTargetAtTime(settings.sfx, t, 0.02);
  Snd.musicVol.gain.setTargetAtTime(settings.music, t, 0.02);
  Snd.ambVol.gain.setTargetAtTime(settings.amb, t, 0.02);
}

// ===== 환경음: 환기구 바람(잡음 → 천천히 흔들리는 대역 필터) + 기계음(낮은 두 음의 맥놀이) — 장소마다 크기·높이가 바뀜 =====
const Amb = {
  ctx: null, last: '',
  init(ctx, dest, noise) {
    this.ctx = ctx;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.07; lfoG.gain.value = 200; // 바람이 세졌다 약해졌다
    lfo.connect(lfoG); lfoG.connect(bp.frequency);
    this.wind = ctx.createGain(); this.wind.gain.value = 0;
    src.connect(bp); bp.connect(this.wind); this.wind.connect(dest);
    this.o1 = ctx.createOscillator(); this.o2 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o2.type = 'triangle';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    this.hum = ctx.createGain(); this.hum.gain.value = 0;
    this.o1.connect(lp); this.o2.connect(lp); lp.connect(this.hum); this.hum.connect(dest);
    src.start(); lfo.start(); this.o1.start(); this.o2.start();
  },
  // 목표 크기·높이로 천천히 바꿈 (값이 바뀔 때만)
  set(wind, hum, freq) {
    const key = `${wind}|${hum}|${freq}`;
    if (!this.ctx || key === this.last) return;
    this.last = key;
    const t = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(wind, t, 0.8); this.hum.gain.setTargetAtTime(hum, t, 0.8);
    this.o1.frequency.setTargetAtTime(freq, t, 1.5); this.o2.frequency.setTargetAtTime(freq * 2.01, t, 1.5);
  },
};

// ===== 배경음악: Freedoom 사운드트랙(MIDI)을 그 자리에서 합성해 연주 (원작 Doom처럼) =====
// 악기 계열(GM 프로그램 번호 / 8)마다 간단한 음색, 10번 채널은 잡음·사인으로 만든 드럼
// wave: 파형, det: 겹치는 발진기 음정 차(센트), a·d·s·r: 엔벨로프, cut: 로우패스, lv: 크기
const PATCHES = [
  { wave: 'triangle', det: [0, 5], a: 0.003, d: 0.9, s: 0.15, r: 0.25, cut: 4000, lv: 0.3 },   // 피아노
  { wave: 'sine', det: [0, 1200], a: 0.002, d: 0.6, s: 0.05, r: 0.3, cut: 6000, lv: 0.25 },     // 건반 타악
  { wave: 'square', det: [0, 5], a: 0.01, d: 0.2, s: 0.8, r: 0.08, cut: 2200, lv: 0.13 },       // 오르간
  { wave: 'sawtooth', det: [0], a: 0.003, d: 0.5, s: 0.25, r: 0.12, cut: 2600, lv: 0.2 },       // 기타
  { wave: 'sawtooth', det: [0], a: 0.004, d: 0.3, s: 0.6, r: 0.07, cut: 800, lv: 0.4 },         // 베이스
  { wave: 'sawtooth', det: [-6, 6], a: 0.12, d: 0.4, s: 0.8, r: 0.3, cut: 1800, lv: 0.11 },     // 현악
  { wave: 'sawtooth', det: [-7, 7], a: 0.1, d: 0.4, s: 0.8, r: 0.3, cut: 1600, lv: 0.11 },      // 합주·합창
  { wave: 'sawtooth', det: [0, 3], a: 0.04, d: 0.3, s: 0.75, r: 0.1, cut: 1500, lv: 0.14 },     // 금관
  { wave: 'square', det: [0], a: 0.03, d: 0.3, s: 0.75, r: 0.1, cut: 1600, lv: 0.12 },          // 목관
  { wave: 'triangle', det: [0], a: 0.05, d: 0.3, s: 0.8, r: 0.15, cut: 3000, lv: 0.22 },        // 피리
  { wave: 'square', det: [0, 6], a: 0.01, d: 0.3, s: 0.7, r: 0.1, cut: 3000, lv: 0.1 },         // 신스 리드
  { wave: 'sawtooth', det: [-8, 8], a: 0.35, d: 0.6, s: 0.7, r: 0.6, cut: 1100, lv: 0.11 },     // 신스 패드
  { wave: 'triangle', det: [-10, 10], a: 0.15, d: 0.6, s: 0.6, r: 0.5, cut: 2500, lv: 0.16 },   // 신스 효과
  { wave: 'triangle', det: [0], a: 0.005, d: 0.4, s: 0.3, r: 0.15, cut: 3000, lv: 0.22 },       // 민속 악기
  { wave: 'sine', det: [0], a: 0.002, d: 0.2, s: 0.05, r: 0.1, cut: 3000, lv: 0.28 },           // 타악기
  { wave: 'triangle', det: [0], a: 0.02, d: 0.4, s: 0.4, r: 0.2, cut: 2500, lv: 0.14 },         // 효과음
].map((p, k) => ({ ...p, key: k }));
const DIST_GTR = { wave: 'sawtooth', det: [-6, 6], a: 0.004, d: 0.3, s: 0.75, r: 0.08, cut: 2400, lv: 0.13, drive: true, key: 'dist' }; // 오버드라이브·디스토션 기타
const patchFor = prog => prog === 29 || prog === 30 ? DIST_GTR : PATCHES[prog >> 3];
// 드럼 (10번 채널 음 번호): [필터, 주파수, 길이(초), 크기, 몸통 음정(Hz)] / 탐탐은 음정이 내려가는 사인파
const DRUMS = {
  37: ['bandpass', 2500, 0.05, 0.5], 38: ['bandpass', 1800, 0.18, 0.9, 190], 40: ['bandpass', 2000, 0.18, 0.9, 200], 39: ['bandpass', 1200, 0.15, 0.7],
  42: ['highpass', 7500, 0.05, 0.4], 44: ['highpass', 7000, 0.06, 0.3], 46: ['highpass', 7000, 0.32, 0.4],
  49: ['highpass', 5000, 1.2, 0.5], 57: ['highpass', 5000, 1.2, 0.5], 51: ['highpass', 6500, 0.5, 0.3], 59: ['highpass', 6500, 0.5, 0.3],
  52: ['highpass', 5500, 0.7, 0.45], 55: ['highpass', 6000, 0.5, 0.4], 53: ['bandpass', 4000, 0.4, 0.35], 54: ['highpass', 8000, 0.12, 0.3], 56: ['bandpass', 800, 0.12, 0.4],
};
const TOMS = { 41: 90, 43: 110, 45: 130, 47: 150, 48: 175, 50: 200 };

// 표준 MIDI 파일 → { ev: 시간순 이벤트(음표 {t, d, c, n, v} / 컨트롤 {t, c, cc, val} / 악기 {t, c, pg}), len: 길이(초) }
function parseMidi(buf) {
  const b = new Uint8Array(buf), dv = new DataView(buf);
  if (dv.getUint32(0) !== 0x4d546864) throw new Error('MIDI 아님');
  const ntr = dv.getUint16(10), div = dv.getUint16(12), raw = [];
  let i = 8 + dv.getUint32(4), seq = 0;
  const vlq = () => { let v = 0, c; do { c = b[i++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
  for (let tr = 0; tr < ntr && i < b.length - 8; tr++) {
    while (i < b.length - 8 && dv.getUint32(i) !== 0x4d54726b) i++; // 'MTrk'
    const end = Math.min(b.length, i + 8 + dv.getUint32(i + 4));
    let tick = 0, rs = 0;
    i += 8;
    while (i < end) {
      tick += vlq();
      const st = b[i];
      if (st === 0xff) { // 메타: 템포만 씀
        const type = b[i + 1]; i += 2;
        const ml = vlq();
        if (type === 0x51) raw.push({ tk: tick, o: 0, s: seq++, tempo: (b[i] << 16) | (b[i + 1] << 8) | b[i + 2] });
        i += ml;
        if (type === 0x2f) break;
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { i++; i += vlq(); continue; }
      if (st & 0x80) { rs = st; i++; } // 아니면 이전 상태 바이트를 이어 씀
      const hi = rs >> 4, c = rs & 15, one = hi === 0xc || hi === 0xd, a = b[i], v = one ? 0 : b[i + 1];
      i += one ? 1 : 2;
      if (hi === 0x9 && v > 0) raw.push({ tk: tick, o: 2, s: seq++, on: true, c, n: a, v });
      else if (hi === 0x8 || hi === 0x9) raw.push({ tk: tick, o: 1, s: seq++, off: true, c, n: a });
      else if (hi === 0xb) raw.push({ tk: tick, o: 1, s: seq++, c, cc: a, val: v });
      else if (hi === 0xc) raw.push({ tk: tick, o: 1, s: seq++, c, pg: a });
    }
    i = end;
  }
  raw.sort((p, q) => p.tk - q.tk || p.o - q.o || p.s - q.s);
  const ev = [], open = {};
  let tempo = 500000, lt = 0, sec = 0, len = 1;
  for (const r of raw) {
    sec += (r.tk - lt) * tempo / 1e6 / div; lt = r.tk;
    if (r.tempo) { tempo = r.tempo; continue; }
    const key = r.c * 128 + r.n;
    if (r.on) { const e = { t: sec, d: 0.5, c: r.c, n: r.n, v: r.v }; ev.push(e); (open[key] = open[key] || []).push(e); }
    else if (r.off) { const e = open[key] && open[key].shift(); if (e) e.d = Math.max(0.02, sec - e.t); }
    else ev.push(r.pg !== undefined ? { t: sec, c: r.c, pg: r.pg } : { t: sec, c: r.c, cc: r.cc, val: r.val });
  }
  for (const e of ev) len = Math.max(len, e.t + (e.d || 0));
  return { ev, len };
}

const Music = {
  ctx: null, bus: null, noise: null, songs: {}, cur: null, want: null, timer: 0, drive: null,
  // 오디오가 준비되면 (첫 클릭) 연결하고, 기다리던 곡이 있으면 시작
  init(ctx, dest, noise) {
    this.ctx = ctx; this.noise = noise;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor(); // 음표가 많이 겹쳐도 찢어지지 않게
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.bus.connect(comp); comp.connect(dest);
    this.drive = new Float32Array(1024).map((_, k) => Math.tanh(6 * (k / 511.5 - 1)));
    if (!this.timer) this.timer = setInterval(() => this.tick(), 200);
    if (this.want) this.start(this.want);
  },
  load(name) {
    return this.songs[name] = this.songs[name] || fetch(`assets/music/${name}.mid`).then(r => r.arrayBuffer()).then(parseMidi);
  },
  play(name) {
    if (this.want === name) return;
    this.want = name;
    if (this.ctx) this.start(name);
  },
  stop(fade = 1.5) { this.want = null; this.fadeOut(fade); },
  start(name) {
    this.fadeOut(1);
    this.load(name).then(song => {
      if (this.want !== name || !this.ctx) return;
      const c = this.ctx, out = c.createGain(), vol = (MUSIC_INFO[name] || [])[2] || 1; // 곡마다 음량 보정
      out.gain.setValueAtTime(0, c.currentTime); out.gain.linearRampToValueAtTime(vol, c.currentTime + 1);
      out.connect(this.bus);
      this.cur = { song, t0: c.currentTime + 0.1, i: 0, out, ch: [] };
      this.tick();
    }).catch(() => { /* 곡 파일이 없으면 조용히 */ });
  },
  fadeOut(sec) {
    const s = this.cur;
    if (!s) return;
    this.cur = null;
    const g = s.out.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + sec);
    setTimeout(() => s.out.disconnect(), (sec + 2) * 1000); // 미리 예약해 둔 음표까지 끝난 뒤 정리
  },
  // 앞으로 ahead초 안에 울릴 음표를 미리 예약 (끝나면 처음부터 반복)
  tick(ahead = 1.5) {
    const s = this.cur, c = this.ctx;
    if (!s || !s.song.ev.length) return;
    const now = c.currentTime, ev = s.song.ev, L = s.song.len;
    if (s.t0 + L < now) { s.t0 += Math.floor((now - s.t0) / L) * L; s.i = 0; s.ch = []; } // 오래 멈춰 있었으면 건너뜀
    for (;;) {
      if (s.i >= ev.length) { s.t0 += L; s.i = 0; s.ch = []; }
      const e = ev[s.i], t = s.t0 + e.t;
      if (t > now + ahead) break;
      s.i++;
      const ch = s.ch[e.c] || (s.ch[e.c] = this.channel(s, e.c));
      if (e.n === undefined) this.control(ch, e, Math.max(t, now)); // 지난 컨트롤도 상태는 반영
      else if (t >= now - 0.02) ch.drum ? this.drum(ch, e, Math.max(t, now)) : this.note(ch, e, Math.max(t, now));
    }
  },
  channel(s, c) {
    const x = this.ctx, vol = x.createGain(), pan = x.createStereoPanner ? x.createStereoPanner() : null;
    vol.gain.value = (100 / 127) ** 2; // 기본 음량 CC7 = 100
    if (pan) { vol.connect(pan); pan.connect(s.out); } else vol.connect(s.out);
    return { drum: c === 9, prog: 0, vol, pan, cc7: 100, cc11: 127, inputs: {} };
  },
  control(ch, e, t) {
    if (e.pg !== undefined) { ch.prog = e.pg; return; }
    if (e.cc === 7 || e.cc === 11) {
      if (e.cc === 7) ch.cc7 = e.val; else ch.cc11 = e.val;
      ch.vol.gain.setValueAtTime((ch.cc7 * ch.cc11 / 16129) ** 2, t);
    } else if (e.cc === 10 && ch.pan) ch.pan.pan.setValueAtTime(clamp((e.val - 64) / 64, -1, 1) * 0.7, t);
  },
  // 악기 계열마다 채널 입력단: (왜곡 기타는 웨이브셰이퍼) → 로우패스 → 채널 음량
  input(ch, P) {
    if (ch.inputs[P.key]) return ch.inputs[P.key];
    const x = this.ctx, f = x.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = P.cut; f.Q.value = 0.7; f.connect(ch.vol);
    let head = f;
    if (P.drive) { const sh = x.createWaveShaper(); sh.curve = this.drive; sh.oversample = '2x'; sh.connect(f); head = sh; }
    return (ch.inputs[P.key] = head);
  },
  note(ch, e, t) {
    const x = this.ctx, P = patchFor(ch.prog), f = 440 * 2 ** ((e.n - 69) / 12), lv = P.lv * (e.v / 127) ** 1.6;
    const g = x.createGain(), dur = e.d, a = Math.min(P.a, dur * 0.8), s = lv * P.s, end = t + dur + P.r * 4;
    const off = dur <= a ? lv : s + (lv - s) * Math.exp(-(dur - a) * 3 / P.d); // 건반을 놓는 순간의 크기
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + a);
    g.gain.setTargetAtTime(s, t + a, P.d / 3);
    g.gain.setValueAtTime(off, t + dur); g.gain.setTargetAtTime(0, t + dur, P.r);
    for (const det of P.det) {
      const o = x.createOscillator();
      o.type = P.wave; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(end);
    }
    g.connect(this.input(ch, P));
  },
  drum(ch, e, t) {
    const x = this.ctx, lv = (e.v / 127) ** 1.4 * 0.9;
    const tone = (f0, f1, dur, vol) => {
      const o = x.createOscillator(), g = x.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(ch.vol); o.start(t); o.stop(t + dur + 0.02);
    };
    if (e.n === 35 || e.n === 36) return tone(140, 42, 0.3, lv * 1.5); // 킥
    if (TOMS[e.n]) return tone(TOMS[e.n] * 1.6, TOMS[e.n], 0.35, lv);
    const [type, freq, dur, vol, body] = DRUMS[e.n] || ['highpass', 4000, 0.1, 0.3];
    const src = x.createBufferSource(), fl = x.createBiquadFilter(), g = x.createGain();
    src.buffer = this.noise; fl.type = type; fl.frequency.value = freq; fl.Q.value = 0.8;
    g.gain.setValueAtTime(lv * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(ch.vol);
    src.start(t, Math.random() * 0.7); src.stop(t + dur + 0.02);
    if (body) tone(body * 1.4, body, 0.1, lv * 0.5); // 스네어 몸통
  },
};

// ===== 맵 =====
const T = { VOID: 0, FLOOR: 1, WALL: 2, CRATE: 3, PIPEX: 4, PIPEY: 5, EXIT: 6, TERM: 7, DOOR: 8 }; // TERM: 기지 단말기, DOOR: 자동문
const MW = FIELD.margin * 2 + FIELD.block * 3, MH = MW; // 필드 전체 (구역 3x3)
const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
let tiles, rooms, lamps, roomOf, wallTex, levelTheme, terminals = [];
let doors = []; // 자동문: { cells, open(0~1), x, y, key(보안문 색), locked } — 가까이 가면 천장으로 올라가 열림
const doorOf = new Int16Array(MW * MH).fill(-1);
const safeMap = new Uint8Array(MW * MH); // 보급 거점 방 = 안전 지대: 몬스터가 들어오지 못하고 적 탄환이 막히며, 안에서는 다치지도 싸우지도 않음
// 구역 테마 (구역마다 돌아가며): 방 바닥, 통로 바닥, 벽, 가끔 섞이는 장식 벽 — Freedoom 텍스처 이름
const THEMES = [
  { floors: ['aqf001', 'aqf029', 'aqf031', 'floor7_1'], corridor: 'aqf004', walls: ['startan2', 'starbr2'], accents: ['comptall', 'compwerd'] },
  { floors: ['floor0_6', 'aqf051', 'floor0_5', 'flat5_4'], corridor: 'flat4', walls: ['starg3', 'stargr1'], accents: ['compsta1', 'spacew3'] },
  { floors: ['aqf027', 'aqf026', 'ceil3_5', 'mflr8_1'], corridor: 'aqf072', walls: ['tekwall1', 'metal2'], accents: ['compblue', 'silver2'] },
  { floors: ['aqf045', 'floor5_1', 'aqf007', 'floor4_8'], corridor: 'aqf005', walls: ['support3', 'brown96', 'bronze1'], accents: ['pipe4', 'brownpip'] },
];
// 우주 기지: 방 순서대로 바닥·벽 지정 (중앙 홀, 출격실)
const BASE_THEME = { floors: ['floor0_6', 'aqf027'], corridor: 'flat5_4', walls: ['stargr1', 'silver2'], accents: ['compsta1', 'comptall'], fixed: true };
// 차원 균열: 어두운 돌바닥과 금속 벽 (보랏빛 조명)
const RIFT_THEME = { floors: ['ceil5_1', 'mflr8_1', 'floor4_8'], corridor: 'aqf072', walls: ['metal2', 'support3', 'tekwall1'], accents: ['compwerd', 'spacew3'] };
const tileAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? T.VOID : tiles[y * MW + x];
const walkable = t => t === T.FLOOR || t === T.EXIT || t === T.DOOR; // 길찾기용 (문은 열고 지나감)
const isWallT = t => t === T.WALL || t === T.VOID;
const DOOR_PASS = 0.8; // 이만큼 열리면 지나가고 보임
const doorShut = (i, j) => tileAt(i, j) === T.DOOR && doors[doorOf[j * MW + i]].open < DOOR_PASS;
const blocksTile = (i, j) => isWallT(tileAt(i, j)) || doorShut(i, j); // 총알·시야를 막음
const blocksShot = (x, y) => blocksTile(Math.floor(x), Math.floor(y));
const lockedAt = k => doorOf[k] >= 0 && doors[doorOf[k]].locked; // 잠긴 보안문 칸 (몬스터 길찾기에서 제외)

function carve(x, y, w, h) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
    if (i > 0 && j > 0 && i < MW - 1 && j < MH - 1) tiles[j * MW + i] = T.FLOOR;
}

// ===== 통로: 방 벽의 문 자리(2칸)끼리, 다른 방에서 벽 한 칸 이상 떨어져 돌아가는 2칸 너비 길로 이음 =====
let links = [];                             // 이은 통로 { a, b, A, B: 양쪽 문 자리, len: 통로 길이(칸) }
const nearRoom = new Uint8Array(MW * MH);   // 방 바닥에서 한 칸 안 — 통로가 들어가면 방과 맞붙어 벽이 사라짐
const keepClear = new Uint8Array(MW * MH);  // 문 바로 안쪽 — 파이프·상자·조명·단말기를 두지 않음
const blockOK = (bx, by) => bx >= 1 && by >= 1 && bx <= MW - 3 && by <= MH - 3 && // 2x2 통로 칸 (왼쪽 위 기준)을 놓을 수 있는지
  !nearRoom[by * MW + bx] && !nearRoom[by * MW + bx + 1] && !nearRoom[(by + 1) * MW + bx] && !nearRoom[(by + 1) * MW + bx + 1];
const floorAt = (i, j) => tileAt(i, j) === T.FLOOR;
// 방 a에서 b 쪽을 보는 벽: 더 크게 벌어진 축 먼저
function sidesToward(a, b) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy, h = dx > 0 ? 'E' : 'W', v = dy > 0 ? 'S' : 'N';
  return Math.abs(dx) >= Math.abs(dy) ? [h, v] : [v, h];
}
// 문 자리: 벽(방 바로 바깥 줄)의 2칸 — 모서리에서 한 칸 이상, 같은 벽의 다른 문 자리와 벽 두 칸 이상 떨어지게,
// 벽 가운데와 상대 방 사이쯤 (at: 원하는 자리 — 마주 보는 두 벽이면 같은 줄로 맞춰 통로가 곧게). out: 문 바로 바깥에서 통로가 시작하는 2x2 칸
const slotRange = (r, side) => side === 'N' || side === 'S' ? [r.x + 1, r.x + r.w - 3] : [r.y + 1, r.y + r.h - 3];
function slotFor(r, side, toward, at) {
  const horiz = side === 'N' || side === 'S', [lo, hi] = slotRange(r, side);
  if (hi < lo) return null;
  const want = clamp(at ?? Math.round(horiz ? (r.cx + toward.cx) / 2 : (r.cy + toward.cy) / 2), lo, hi), order = [];
  for (let q = lo; q <= hi; q++) order.push(q);
  order.sort((u, v) => Math.abs(u - want) - Math.abs(v - want));
  for (const q of order) {
    if (r.slots.some(s => s.side === side && Math.abs(s.q - q) < 4)) continue;
    const s = side === 'N' ? { cells: [[q, r.y - 1], [q + 1, r.y - 1]], out: [q, r.y - 3] }
      : side === 'S' ? { cells: [[q, r.y + r.h], [q + 1, r.y + r.h]], out: [q, r.y + r.h + 1] }
      : side === 'W' ? { cells: [[r.x - 1, q], [r.x - 1, q + 1]], out: [r.x - 3, q] }
      : { cells: [[r.x + r.w, q], [r.x + r.w, q + 1]], out: [r.x + r.w + 1, q] };
    if (blockOK(...s.out)) return { side, q, room: r, ...s };
  }
  return null;
}
// 통로 길찾기 (2x2 칸 단위, 4방향 다익스트라, box [x0, y0, x1, y1] 안에서만): 꺾을 때마다 비싸게(반듯하게), 이미 판 통로는 싸게(합류),
// 판 통로 바로 옆을 나란히 달리면 비싸게 (두 통로가 붙어 넓적한 공간이 되지 않게)
// avoid: 지나가면 안 되는 칸 표시 (도착 칸은 예외)
function routeCorridor(from, to, box, avoid) {
  const [bx0, by0, bx1, by1] = box, bw = bx1 - bx0, N = bw * (by1 - by0);
  const dist = new Float32Array(N * 4).fill(1e9), prev = new Int32Array(N * 4).fill(-1), heap = [];
  const push = (c, s) => { heap.push([c, s]); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, rt = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rt < heap.length && heap[rt][0] < heap[m][0]) m = rt; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  const dug = (x, y) => floorAt(x, y) && floorAt(x + 1, y) && floorAt(x, y + 1) && floorAt(x + 1, y + 1);
  const hugs = (x, y) => { // 둘레 12칸에 판 통로가 있는데 이 칸은 아직 안 팜
    if (floorAt(x, y) || floorAt(x + 1, y) || floorAt(x, y + 1) || floorAt(x + 1, y + 1)) return false;
    for (let j = y - 1; j <= y + 2; j++) for (let i = x - 1; i <= x + 2; i++) if ((i < x || i > x + 1 || j < y || j > y + 1) && floorAt(i, j) && !nearRoom[j * MW + i]) return true;
    return false;
  };
  const at = (x, y) => (y - by0) * bw + x - bx0;
  const start = at(from[0], from[1]), goal = at(to[0], to[1]);
  for (let d = 0; d < 4; d++) { dist[start * 4 + d] = 0; push(0, start * 4 + d); }
  while (heap.length) {
    const [c, s] = pop();
    if (c > dist[s]) continue;
    const k = s >> 2, d = s & 3, x = k % bw + bx0, y = ((k / bw) | 0) + by0;
    if (k === goal) { // 되짚어 길 만들기
      const path = [];
      for (let t = s; t >= 0; t = prev[t]) { const kk = t >> 2; if (!path.length || path[path.length - 1][2] !== kk) path.push([kk % bw + bx0, ((kk / bw) | 0) + by0, kk]); }
      return path.reverse();
    }
    for (let nd = 0; nd < 4; nd++) {
      const nx = x + DIR4[nd][0], ny = y + DIR4[nd][1];
      if (nx < bx0 || ny < by0 || nx > bx1 - 2 || ny > by1 - 2 || !blockOK(nx, ny)) continue;
      if (avoid && at(nx, ny) !== goal && (avoid[ny * MW + nx] || avoid[ny * MW + nx + 1] || avoid[(ny + 1) * MW + nx] || avoid[(ny + 1) * MW + nx + 1])) continue;
      const ns = at(nx, ny) * 4 + nd, nc = c + (dug(nx, ny) ? 0.4 : hugs(nx, ny) ? 2.5 : 1) + (nd !== d ? 4 : 0);
      if (nc < dist[ns]) { dist[ns] = nc; prev[ns] = s; push(nc, ns); }
    }
  }
  return null;
}
// 두 방을 이음: 마주 보는 벽부터 문 자리를 고르고 길을 찾음. 문 바로 안쪽은 비워 둘 칸으로
// gate: 다음 구역으로 가는 봉쇄 격벽 길목 — 격벽(b 쪽 끝)까지의 통로는 모두 a 구역. avoid: 통로가 닿으면 안 되는 칸 (routeCorridor)
function connect(a, b, box, gate = false, avoid = null) {
  const facing = { N: 'S', S: 'N', W: 'E', E: 'W' };
  for (const sa of sidesToward(a, b)) for (const sb of sidesToward(b, a)) {
    let at; // 마주 보는 두 벽: 둘 다 문을 낼 수 있는 구간의 가운데로 맞춤
    if (facing[sa] === sb) { const [la, ha] = slotRange(a, sa), [lb, hb] = slotRange(b, sb), lo = Math.max(la, lb), hi = Math.min(ha, hb); if (lo <= hi) at = Math.round((lo + hi) / 2); }
    const A = slotFor(a, sa, b, at), B = slotFor(b, sb, a, at), path = A && B && routeCorridor(A.out, B.out, box, avoid);
    if (!path) continue;
    for (const [S, r] of [[A, a], [B, b]]) for (const [i, j] of S.cells) { tiles[j * MW + i] = T.FLOOR; regionMap[j * MW + i] = r.reg; }
    path.forEach(([bx, by], n) => { // 통로 칸의 구역: 앞 절반은 a, 뒤 절반은 b
      carve(bx, by, 2, 2);
      const g = gate || n < path.length / 2 ? a.reg : b.reg;
      for (let j = by; j < by + 2; j++) for (let i = bx; i < bx + 2; i++) if (!regionMap[j * MW + i]) regionMap[j * MW + i] = g;
    });
    for (const S of [A, B]) {
      S.room.slots.push(S);
      const [dx, dy] = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[S.side]; // 방 안쪽 방향
      for (const [i, j] of S.cells) for (let k = 0; k <= 2; k++) for (let w = -1; w <= 1; w++) {
        const x = i + dx * k + (dy ? w : 0), y = j + dy * k + (dx ? w : 0);
        if (x >= 0 && y >= 0 && x < MW && y < MH) keepClear[y * MW + x] = 1;
      }
    }
    links.push({ a, b, A, B, len: path.length });
    return true;
  }
  return false;
}
// 방 잇기 (rs: 한 구역의 방, box 안에서만): 가까운 방부터 하나씩 (최소 신장 트리) + 아직 바로 이어지지 않은 가까운 방 사이 고리 2~3개
function linkRooms(rs, box) {
  const tree = [rs[0]], rest = rs.slice(1), md = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  while (rest.length) {
    const pairs = [];
    for (const b of rest) for (const a of tree) pairs.push([md(a, b), a, b]);
    pairs.sort((u, v) => u[0] - v[0]);
    const hit = pairs.slice(0, 16).find(([, a, b]) => connect(a, b, box));
    if (!hit) return false;
    tree.push(hit[2]); rest.splice(rest.indexOf(hit[2]), 1);
  }
  const loops = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    if (md(a, b) < 28 && !links.some(L => (L.a === a && L.b === b) || (L.a === b && L.b === a))) loops.push([md(a, b) + rnd(0, 10), a, b]);
  }
  loops.sort((u, v) => u[0] - v[0]);
  let want = irnd(2, 3);
  for (const [, a, b] of loops) if (want > 0 && connect(a, b, box)) want--;
  return true;
}
// blocked: 지나갈 수 없는 칸 표시 (보안문 배치 계산용)
function bfs(sx, sy, blocked) {
  const d = new Int16Array(MW * MH).fill(-1);
  const q = [sy * MW + sx]; d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % MW, y = (k / MW) | 0;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const nk = ny * MW + nx;
      if (d[nk] >= 0 || !walkable(tiles[nk]) || (blocked && blocked[nk])) continue;
      d[nk] = d[k] + 1; q.push(nk);
    }
  }
  return d;
}
function connectedOK() {
  const s = rooms[0], d = bfs(s.cx, s.cy);
  for (let k = 0; k < tiles.length; k++) if (walkable(tiles[k]) && d[k] < 0) return false;
  return true;
}
function tryPlace(cells, type, room) {
  for (const [i, j] of cells) {
    if (tileAt(i, j) !== T.FLOOR || keepClear[j * MW + i]) return false; // 문 바로 안쪽은 비워 둠
    if (Math.abs(i - room.cx) < 2 && Math.abs(j - room.cy) < 2) return false;
  }
  for (const [i, j] of cells) tiles[j * MW + i] = type;
  if (connectedOK()) return true;
  for (const [i, j] of cells) tiles[j * MW + i] = T.FLOOR;
  return false;
}

// 바닥에 맞닿은 빈칸을 벽으로
function buildWalls() {
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (tiles[j * MW + i] !== T.VOID) continue;
    for (const [dx, dy] of DIR8) if (walkable(tileAt(i + dx, j + dy))) { tiles[j * MW + i] = T.WALL; break; }
  }
}
// 텍스처: 방마다 바닥·벽을 테마에서 고르고 (필드는 구역마다 돌아가며, 보급 거점은 기지 모습, theme을 주면 그것만), 벽은 붙어 있는 방을 따름 (가끔 컴퓨터 패널 등 장식)
const themeOf = reg => THEMES[(reg - 1) % THEMES.length];
function applyTheme(theme) {
  levelTheme = theme || THEMES[0];
  rooms.forEach((r, n) => {
    const th = theme || (r.hub ? BASE_THEME : themeOf(r.reg));
    r.flat = th.fixed ? th.floors[n % th.floors.length] : pick(th.floors);
    r.wall = th.fixed ? th.walls[n % th.walls.length] : pick(th.walls);
  });
  roomOf = new Int16Array(MW * MH).fill(-1); safeMap.fill(0);
  rooms.forEach((r, n) => { for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { roomOf[j * MW + i] = n; if (r.hub) safeMap[j * MW + i] = 1; } });
  wallTex = new Array(MW * MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    if (tiles[j * MW + i] !== T.WALL) continue;
    const th = theme || themeOf(regionMap[j * MW + i] || 1);
    const near = DIR8.map(([dx, dy]) => tileAt(i + dx, j + dy) === T.VOID ? -1 : roomOf[(j + dy) * MW + i + dx]).find(n => n >= 0);
    const h = hash(i * 7, j * 13);
    wallTex[j * MW + i] = 'wall_' + (h < 0.12 ? th.accents[h < 0.06 ? 0 : 1] : near !== undefined ? rooms[near].wall : th.walls[0]);
  }
  floorChunks.clear();
}
// 자동문 하나 (run: 문이 되는 칸들)
function addDoor(run) {
  const n = doors.length;
  doors.push({ cells: run.map(([i, j]) => j * MW + i), open: 0, x: run.reduce((s, c) => s + c[0], 0) / run.length + 0.5, y: run.reduce((s, c) => s + c[1], 0) / run.length + 0.5 });
  for (const [i, j] of run) { tiles[j * MW + i] = T.DOOR; doorOf[j * MW + i] = n; }
  return n;
}
// 통로가 방에 들어가는 문 자리마다 70% 확률로 자동문 — 짧은 통로(5칸 미만)는 양 끝에 문이 둘 붙지 않게 한쪽만.
// 다음 구역으로 가는 길목에 봉쇄 격벽이 있으면(GATES) 다음 구역 쪽 끝에 — 보스 처치·임무로 열림
function placeDoors() {
  doors = []; doorOf.fill(-1);
  for (const L of links) {
    if (L.gate) {
      const d = doors[addDoor(L.B.cells)];
      d.gate = L.gate; d.locked = true;
      if (L.len >= 5 && Math.random() < 0.7) addDoor(L.A.cells);
      continue;
    }
    const ends = [L.A, L.B].filter(() => Math.random() < 0.7);
    if (L.len < 5 && ends.length > 1) ends.splice(irnd(0, 1), 1);
    for (const s of ends) addDoor(s.cells);
  }
}
// 방의 모든 입구를 문으로 막을 수 있으면 [{ door(기존 문 번호, 없으면 -1), run }], 아니면 null
function roomSeal(r) {
  const seal = [];
  for (const [fixed, horiz, out] of [[r.y - 1, true, -1], [r.y + r.h, true, 1], [r.x - 1, false, -1], [r.x + r.w, false, 1]]) {
    let run = [];
    const flush = () => {
      if (!run.length) return true;
      const n = doorOf[run[0][1] * MW + run[0][0]];
      const ok = n >= 0
        ? run.every(([i, j]) => doorOf[j * MW + i] === n) && doors[n].cells.length === run.length && !doors[n].gate // 이미 달린 자동문 (봉쇄 격벽은 안 됨)
        : run.length <= 3 && run.every(([i, j]) => tiles[j * MW + i] === T.FLOOR && tileAt(horiz ? i : i + out, horiz ? j + out : j) === T.FLOOR); // 문을 달 수 있는 입구
      seal.push({ door: n, run }); run = [];
      return ok;
    };
    for (let s = horiz ? r.x : r.y, e = s + (horiz ? r.w : r.h); s < e; s++) {
      const i = horiz ? s : fixed, j = horiz ? fixed : s;
      if (walkable(tileAt(i, j))) run.push([i, j]); else if (!flush()) return null;
    }
    if (!flush()) return null;
  }
  return seal;
}
// 보안문 (구역마다): 마지막 색(되도록 다음 구역 길목 방)부터 거꾸로 잠글 방을 고름. 잠글 때마다 구역 입구에서 갈 수 있는 곳이 줄어들고,
// 다음 색의 키카드는 바로 앞 색 문 뒤에만 있는 방에, 첫 색의 키카드는 처음부터 갈 수 있는 방에 둔다 (다른 구역은 막힌 것으로 셈)
function placeLocks(R) {
  const start = R.entry, want = LOCKS[R.n - 1], at = (d, r) => d[r.cy * MW + r.cx] >= 0;
  const outside = new Uint8Array(MW * MH);
  for (let k = 0; k < MW * MH; k++) if (regionMap[k] !== R.n) outside[k] = 1;
  const seals = new Map();
  for (const r of R.rooms) { const s = r !== start && !r.hub && roomSeal(r); if (s) seals.set(r, s); }
  let blocked = outside, reach = bfs(start.cx, start.cy, blocked);
  const chain = []; // 마지막 색부터: { room, behind: 이 문을 열어야만 갈 수 있는 방들 }
  while (chain.length < want) {
    let best = null, bs = -1;
    for (const [r, seal] of seals) {
      if (!at(reach, r) || chain.some(c => c.room === r)) continue;
      const b2 = blocked.slice();
      for (const { run } of seal) for (const [i, j] of run) b2[j * MW + i] = 1;
      const r2 = bfs(start.cx, start.cy, b2);
      if (at(r2, r)) continue; // 막아도 다른 길로 들어감
      const front = R.rooms.filter(q => q !== start && at(r2, q)).length;
      if (front < 1) continue; // 앞쪽에 키카드를 둘 방이 없음
      const sc = (chain.length ? 0 : (r === R.exit) * 4 + !at(r2, R.exit) * 2) + (front >= 2) + Math.random() * 0.5;
      if (sc > bs) { bs = sc; best = { room: r, blocked: b2, reach: r2, behind: R.rooms.filter(q => at(reach, q) && !at(r2, q)) }; }
    }
    if (!best) break;
    chain.push(best); blocked = best.blocked; reach = best.reach;
  }
  const m = chain.length;
  R.locks = KEY_ORDER.slice(0, m); R.keyPlan = [];
  chain.forEach((c, t) => {
    const color = KEY_ORDER[m - 1 - t];
    for (const { door, run } of seals.get(c.room)) {
      const d = doors[door >= 0 ? door : addDoor(run)];
      d.key = color; d.kr = R.n; d.locked = true;
    }
    // ok: 키카드를 놓아도 되는 칸 (앞 색까지 열면 닿고, 앞 색 문을 열기 전에는 닿지 않는 곳)
    const next = chain[t + 1];
    R.keyPlan.push({ color, room: pick(next ? next.behind : R.rooms.filter(q => q !== start && at(reach, q))), ok: k => c.reach[k] >= 0 && (!next || next.reach[k] < 0) });
  });
}
// 문 열고 닫기: 플레이어나 몬스터가 가까우면 열림, 문 칸에 누가 있으면 닫히지 않음
// 보안문은 같은 색 키카드를 가진 플레이어가 다가와야 풀림 (몬스터는 못 엶)
// 봉쇄 격벽에 다가갔을 때 안내 (어떻게 열리는지)
const gateMsg = n => GATES[n] === 'boss' ? `봉쇄 격벽 — ${ENEMIES[bossKindFor(n)].name}을(를) 처치하면 열린다` : '봉쇄 격벽 — 중앙 통제실의 보안 통제 단말기를 해킹하면 열린다';
function updateDoors(dt) {
  const near = (d, o, k) => Math.abs(o.x - d.x) < k && Math.abs(o.y - d.y) < k;
  const fol = survivors.filter(s => s.state === 'follow'); // 동행 중인 생존자도 문을 엶
  for (const d of doors) {
    if (Math.abs(d.x - player.x) > 26 || Math.abs(d.y - player.y) > 26) continue; // 먼 문은 그대로 (넓은 필드)
    if (d.locked) {
      d.denyT = Math.max(0, (d.denyT || 0) - dt);
      if (!near(d, player, 2.3)) continue;
      if (d.gate) { // 봉쇄 격벽: 보스 처치·임무로 열림
        if (!gateOpen(d.gate)) {
          if (d.denyT <= 0 && near(d, player, 1.7)) { msg(gateMsg(d.gate), '#f96'); Snd.play('deny', d.x, d.y); d.denyT = 3; tip('gate'); }
          continue;
        }
        d.gate = 0; msg('봉쇄 격벽 개방', '#9f9');
      } else {
        const K = KEYCARDS[d.key];
        if (!keysHeld.has(`${d.kr}:${d.key}`)) {
          if (d.denyT <= 0 && near(d, player, 1.7)) { msg(d.key === 'vault' ? '금고 열쇠가 필요합니다 — 이 구역의 고유 정예가 지니고 있다' : `${K.name}가 필요합니다`, K.color); Snd.play('deny', d.x, d.y); d.denyT = 3; tip(d.key === 'vault' ? 'vault' : 'key'); }
          continue;
        }
        msg(`${K.door} 해제`, K.color);
      }
      d.locked = false; flowTile = -1; Snd.play('unlock', d.x, d.y); // 몬스터 길찾기 다시 계산
    }
    const want = near(d, player, 2.3) || enemies.some(e => near(d, e, 2.1)) || fol.some(s => near(d, s, 2.1));
    const prev = d.open;
    d.open = clamp(d.open + (want ? dt * 3 : -dt * 1.6), 0, 1);
    if (d.open < prev && [player, ...enemies, ...fol].some(o => near(d, o, 1.2 + o.r))) d.open = prev; // 끼이지 않게
    if (prev === 0 && d.open > 0) Snd.play('door', d.x, d.y);
    else if (prev === 1 && d.open < 1) Snd.play('doorClose', d.x, d.y);
  }
}

// 타이틀 화면 뒤의 우주 기지 풍경: 중앙 홀(단말기) + 통로 + 패드 방
const room = (x, y, w, h) => ({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
function genBase() {
  tiles = new Uint8Array(MW * MH); doors = []; doorOf.fill(-1); regionMap = null; hubs = []; chests = []; spots = [];
  rooms = [room(20, 18, 14, 10), room(24, 32, 6, 6)];
  for (const r of rooms) carve(r.x, r.y, r.w, r.h);
  carve(26, 28, 2, 4);
  buildWalls();
  const pr = rooms[1];
  tiles[pr.cy * MW + pr.cx] = T.EXIT; pads = [{ i: pr.cx, j: pr.cy, kind: 'hub' }];
  terminals = [
    { i: 22, j: 18, kind: 'shop', name: '보급관 (상점)', col: '255,200,90' },
    { i: 26, j: 18, kind: 'sell', name: '회수 단말기 (판매)', col: '120,255,160' },
    { i: 30, j: 18, kind: 'upgrade', name: '개조실 (업그레이드)', col: '120,190,255' },
    { i: 20, j: 22, kind: 'save', name: '기록 단말기 (저장)', col: '230,230,230' },
    { i: 20, j: 20, kind: 'stash', name: '보관 단말기 (창고)', col: '200,170,255' },
  ];
  for (const t of terminals) tiles[t.j * MW + t.i] = T.TERM;
  for (const [i, j] of [[33, 26], [33, 27], [32, 27], [20, 27]]) tiles[j * MW + i] = T.CRATE;
  applyTheme(BASE_THEME);
  resetMinimap(true);
  lamps = [[24.5, 18.6], [28.5, 18.6], [32.5, 18.6], [20.6, 25.5], [24.6, 33.5], [29.4, 33.5]]
    .map(([x, y]) => ({ x, y, col: '170,210,255', ph: rnd(0, 6), flick: false }));
  lamps.push({ x: pr.cx + 0.5, y: pr.cy + 0.5, col: '80,255,140', ph: 0, flick: false, exit: true });
}

// ===== 필드: 구역 9개가 이어진 하나의 큰 정거장 (FIELD, FIELD_ORDER, GATES) =====
// 구역마다 방을 놓고 이은 뒤, 이웃 구역끼리 가장 가까운 방을 잇는다. 같은 씨앗이면 같은 지도 (불러오기에서 다시 만듦)
let regions = [null];  // 1~9: { n, bx, by, rooms, entry, exit, hubs, locks, keyPlan, mission, vault, superRoom }
let chests = [];       // 금고 보물함 { kind: 'chest', x, y, reg, open }
let spots = [];        // 필드 사건 { kind: 'spot', type: 'cache' | 'beacon', x, y, reg, state: 'idle' | 'on' | 'done', prog, nextWave, lamp }
let beaconOn = null;   // 지키는 중인 조난 신호기
let hubs = [];         // 보급 거점 { n, reg, room, pad: { i, j }, name, found, stock }
let pads = [];         // 바닥 패드 (순간이동·탈출정) { i, j, kind: 'hub' | 'escape', hub }
let regionMap = null;  // 칸마다 구역 번호
let fieldSeed = 0, lastHub = 0;
// 진행 기록 (저장됨): 처치한 보스·이룬 임무의 구역, 주운 키카드('구역:색'), 찾은 거점, 들어가 본 구역
let flags = { bosses: [], missions: [], keys: [], hubs: [], visited: [] };
const newSeed = () => (Math.random() * 2 ** 31) | 0;
// 씨앗으로 정해지는 난수 (mulberry32) — 지도 만들 때만 Math.random 대신 씀
function mulberry32(a) {
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function withSeed(seed, fn) { const real = Math.random; Math.random = mulberry32(seed); try { return fn(); } finally { Math.random = real; } }
const regionAt = (x, y) => regionMap ? regionMap[Math.floor(y) * MW + Math.floor(x)] : 0;
const gateOpen = n => GATES[n] === 'boss' ? flags.bosses.includes(n) : GATES[n] === 'mission' ? flags.missions.includes(n) : true;
const roomAt = (x, y) => { const ri = roomOf ? roomOf[Math.floor(y) * MW + Math.floor(x)] : -1; return ri >= 0 ? rooms[ri] : null; };
const safeAt = (x, y) => safeMap[Math.floor(y) * MW + Math.floor(x)] === 1; // 보급 거점 방 (안전 지대)
const inHub = () => safeAt(player.x, player.y);
const noFight = () => { msg('보급 거점은 안전 지대 — 안에서는 싸울 수 없습니다', '#7fd8ff'); };
// 가장 가까운, 찾아 둔 거점의 패드 (생존자 대피, 보상 자리, 추적기) — 못 찾은 거점은 격벽·보안문 너머일 수 있으므로 뺌
const nearestHubPad = (x, y) => {
  const list = hubs.some(h => h.found) ? hubs.filter(h => h.found) : hubs;
  return list.reduce((b, h) => !b || Math.hypot(h.pad.i + 0.5 - x, h.pad.j + 0.5 - y) < Math.hypot(b.pad.i + 0.5 - x, b.pad.j + 0.5 - y) ? h : b, null);
};

function genField() {
  const B = FIELD.block;
  tiles = new Uint8Array(MW * MH); rooms = []; links = []; keepClear.fill(0); nearRoom.fill(0); regionMap = new Int8Array(MW * MH); chests = []; spots = [];
  doors = []; doorOf.fill(-1); terminals = []; hubs = []; pads = []; lamps = [];
  regions = [null, ...FIELD_ORDER.map(([cx, cy], k) => ({ n: k + 1, bx: FIELD.margin + cx * B, by: FIELD.margin + cy * B, rooms: [], hubs: [], locks: [], keyPlan: [] }))];
  for (let n = 1; n <= 9; n++) genRegionRooms(regions[n]);
  for (let n = 1; n < 9; n++) linkRegions(regions[n], regions[n + 1]);
  // 착륙 지점: 구역 1에서 다음 구역 길목과 가장 먼 방, 코어: 구역 9에서 입구와 가장 먼 방
  const R1 = regions[1], d1 = bfs(R1.exit.cx, R1.exit.cy), R9 = regions[9], d9 = bfs(R9.entry.cx, R9.entry.cy), dist = (d, r) => d[r.cy * MW + r.cx];
  R1.entry = R1.rooms.filter(r => r !== R1.exit).reduce((a, r) => dist(d1, r) > dist(d1, a) ? r : a);
  R9.exit = R9.rooms.filter(r => r !== R9.entry).reduce((a, r) => dist(d9, r) > dist(d9, a) ? r : a);
  for (const n of [3, 6, 9]) regions[n].exit.boss = bossKindFor(n);
  buildWalls();
  for (let k = 0; k < MW * MH; k++) { // 벽 칸의 구역: 맞닿은 바닥을 따름 (텍스처)
    if (regionMap[k] || tiles[k] !== T.WALL) continue;
    const i = k % MW, j = (k / MW) | 0;
    for (const [dx, dy] of DIR8) { const g = regionMap[(j + dy) * MW + i + dx]; if (g) { regionMap[k] = g; break; } }
  }
  placeHubs();
  decorateRooms();
  placeDoors();
  if (!gatesHold()) throw new Error('봉쇄 격벽을 돌아가는 길이 있음');
  for (let n = 1; n <= 9; n++) placeLocks(regions[n]);
  placeFieldLamps();
  setupMissions();
  placeEscapePad();
  for (let n = 1; n <= 9; n++) { // 정예가 있는 방 (거점·입구 제외)
    const R = regions[n], cand = R.rooms.filter(r => !r.hub && r !== R.entry);
    for (let k = 0; k < ELITE_COUNT[n - 1] && cand.length; k++) { const r = cand.splice(Math.floor(Math.random() * cand.length), 1)[0]; r.elites = (r.elites || 0) + 1; }
  }
  withSeed((fieldSeed * 31 + 0x9e37) | 0, placeExtras); // 고유 정예·금고·필드 사건 (따로 굴린 난수 — 앞의 지도는 예전 저장과 같게)
  placeBossLairs(); // 구역 보스의 방 (난수를 쓰지 않음)
  applyTheme();
}
// 구역 보스(REGION_BOSSES)의 방: 구역 입구에서 먼 쪽 절반 중 가장 큰 빈 방 — 거점·입구·출구·금고·고유 정예 방은 쓰지 않고, 키카드·임무·필드 사건 방은 되도록 피함
// (난수를 쓰지 않아 같은 씨앗이면 같은 방 — 예전 저장도 그대로)
function placeBossLairs() {
  const inRoom = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (const [n, kind] of Object.entries(REGION_BOSSES)) {
    const R = regions[+n];
    if (!R) continue;
    const busy = r => r.hub || r.boss || r.vault || r.super || r === R.entry || r === R.exit;
    const soft = r => R.keyPlan.some(k => k.room === r) || survivors.some(s => inRoom(r, s.x, s.y)) || enemies.some(e => e.d.nest && inRoom(r, e.x, e.y)) || spots.some(s => inRoom(r, s.x, s.y));
    const d = bfs(R.entry.cx, R.entry.cy), far = (a, b) => d[b.cy * MW + b.cx] - d[a.cy * MW + a.cx] || a.y - b.y || a.x - b.x;
    const big = (a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x;
    const cand = R.rooms.filter(r => !busy(r) && !soft(r)), alt = R.rooms.filter(r => !busy(r)), pool = (cand.length ? cand : alt).sort(far);
    const r = pool.slice(0, Math.ceil(pool.length / 2)).sort(big)[0]; // 입구에서 먼 쪽 절반 중 가장 큰 방
    if (r) { r.boss = kind; R.bossRoom = r; }
  }
}
// 구역마다: 고유 정예의 방, 금고 (입구를 모두 금고 문으로 잠그고 보물함), 필드 사건 (보급 캐시·조난 신호기)
// 입구·출구·거점·보스 방은 쓰지 않고, 키카드가 놓일 방·임무(생존자·둥지) 방은 되도록 피함 (금고는 반드시 피함)
function placeExtras() {
  const inRoom = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  const freeCell = (r, ok = () => true) => { // 방 안의 빈 바닥 (문 바로 안쪽은 피함)
    for (let k = 0; k < 60; k++) {
      const i = irnd(r.x + 1, r.x + r.w - 2), j = irnd(r.y + 1, r.y + r.h - 2);
      if (tileAt(i, j) === T.FLOOR && !keepClear[j * MW + i] && ok(i + 0.5, j + 0.5)) return { x: i + 0.5, y: j + 0.5 };
    }
    return null;
  };
  const mix = a => a.sort(() => Math.random() - 0.5);
  // 방의 입구를 모두 막아도 그 방 말고는 착륙 지점에서 다 닿는지 (금고가 길을 끊지 않게)
  const sealKeepsPaths = (r, sl) => {
    const blocked = new Uint8Array(MW * MH);
    for (const { run } of sl) for (const [i, j] of run) blocked[j * MW + i] = 1;
    const d = bfs(hubs[0].pad.i, hubs[0].pad.j, blocked);
    for (let k = 0; k < MW * MH; k++) if (walkable(tiles[k]) && d[k] < 0 && !blocked[k] && !inRoom(r, k % MW, (k / MW) | 0)) return false;
    return true;
  };
  for (let n = 1; n <= 9; n++) {
    const R = regions[n], hard = new Set([R.entry, R.exit]), soft = new Set(R.keyPlan.map(k => k.room));
    for (const r of R.rooms) if (r.hub || r.boss) hard.add(r);
    for (const o of [...survivors.filter(sv => sv.reg === n), ...enemies.filter(e => e.d.nest && e.lv === n)]) { const r = R.rooms.find(q => inRoom(q, o.x, o.y)); if (r) soft.add(r); }
    const open = () => R.rooms.filter(r => !hard.has(r) && !soft.has(r)), any = () => R.rooms.filter(r => !hard.has(r));
    // 고유 정예: 입구에서 먼 쪽 절반 중 하나 (빈 방이 없으면 임무·키카드 방이라도)
    const d = bfs(R.entry.cx, R.entry.cy), far = (open().length ? open() : any()).sort((a, b) => d[b.cy * MW + b.cx] - d[a.cy * MW + a.cx]);
    const sr = far.length ? far[irnd(0, Math.max(0, Math.ceil(far.length / 2) - 1))] : null;
    if (sr) { sr.super = SUPERS[n - 1]; R.superRoom = sr; hard.add(sr); }
    // 금고 (고유 정예가 있을 때만 — 열쇠를 그가 지님): 입구가 보안문·격벽이 아니고, 막아도 길이 끊기지 않는 방
    if (sr) for (const r of mix(open())) {
      const sl = roomSeal(r);
      if (!sl || sl.some(e => e.door >= 0 && (doors[e.door].key || doors[e.door].gate)) || !sealKeepsPaths(r, sl)) continue;
      for (const e of sl) { const door = doors[e.door >= 0 ? e.door : addDoor(e.run)]; door.key = 'vault'; door.kr = n; door.locked = true; }
      r.vault = true; R.vault = r; hard.add(r);
      for (let k = 0; k < FIELD_EVENTS.vault[n <= 4 ? 0 : 1]; k++) {
        const q = freeCell(r, (x, y) => chests.every(c => Math.hypot(c.x - x, c.y - y) > 2));
        if (q) chests.push({ kind: 'chest', x: q.x, y: q.y, reg: n, open: false });
      }
      break;
    }
    // 필드 사건: 빈 방부터 per개 (신호기·캐시를 번갈아, 첫 종류는 무작위)
    const o1 = mix(open()), rest = [...o1, ...mix(any().filter(r => !o1.includes(r)))], first = Math.random() < 0.5 ? 'beacon' : 'cache';
    for (let k = 0, made = 0; made < FIELD_EVENTS.per[n - 1] && k < rest.length; k++) {
      const r = rest[k], q = freeCell(r, (x, y) => Math.hypot(x - r.cx - 0.5, y - r.cy - 0.5) < 3);
      if (!q) continue;
      const sp = { kind: 'spot', type: made % 2 ? (first === 'beacon' ? 'cache' : 'beacon') : first, x: q.x, y: q.y, reg: n, state: 'idle', prog: 0, nextWave: 2 };
      if (sp.type === 'beacon') { sp.lamp = { x: q.x, y: q.y, col: '255,190,60', ph: 0, flick: false, exit: true }; lamps.push(sp.lamp); } // 신호기 불빛 (켜면 빨강, 끝나면 초록)
      spots.push(sp); made++;
    }
  }
}
// 봉쇄 격벽을 앞에서부터 하나씩 열었을 때, 닫힌 격벽 너머 구역에는 닿지 않는지 (구역 1부터)
function gatesHold() {
  const shut = Object.keys(GATES).map(Number).sort((u, v) => u - v), s = regions[1].rooms[0];
  for (let n = 0; n < shut.length; n++) {
    const blocked = new Uint8Array(MW * MH);
    for (const d of doors) if (d.gate && shut.indexOf(d.gate) >= n) for (const c of d.cells) blocked[c] = 1;
    const d = bfs(s.cx, s.cy, blocked);
    for (let k = 0; k < MW * MH; k++) if (d[k] >= 0 && regionMap[k] > shut[n]) return false;
  }
  return true;
}
// 구역 하나의 방: 구역 칸 안에 서로 4칸 이상 떨어지게 놓고 이음 (이어지지 않으면 이 칸만 다시)
function genRegionRooms(R) {
  const B = FIELD.block, box = [R.bx, R.by, R.bx + B, R.by + B], x0 = R.bx + 4, y0 = R.by + 4, x1 = R.bx + B - 4, y1 = R.by + B - 4;
  for (let attempt = 0; attempt < 40; attempt++) {
    clearBox(box);
    const rs = [], want = irnd(...FIELD.rooms);
    for (let a = 0; a < 600 && rs.length < want; a++) {
      const w = irnd(6, 12), h = irnd(6, 12), x = irnd(x0, x1 - w), y = irnd(y0, y1 - h);
      if (rs.some(r => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 4 > r.y)) continue;
      rs.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), slots: [], reg: R.n });
    }
    if (rs.length < FIELD.rooms[0] - 1) continue;
    for (const r of rs) {
      carve(r.x, r.y, r.w, r.h);
      for (let j = r.y - 1; j <= r.y + r.h; j++) for (let i = r.x - 1; i <= r.x + r.w; i++) nearRoom[j * MW + i] = 1;
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) regionMap[j * MW + i] = R.n;
    }
    const L0 = links.length;
    if (linkRooms(rs, [box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1])) { R.rooms = rs; rooms.push(...rs); return; } // 통로는 칸 가장자리에서 한 칸 안쪽까지만 (이웃 구역 통로와 붙지 않게)
    links.length = L0;
  }
  throw new Error(`구역 ${R.n}을(를) 만들지 못함`);
}
function clearBox([x0, y0, x1, y1]) {
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const k = j * MW + i; tiles[k] = T.VOID; nearRoom[k] = 0; keepClear[k] = 0; regionMap[k] = 0; }
}
// 이웃 구역 잇기: 앞 구역의 방(입구 제외)과 다음 구역의 방 중 가장 가까운 짝. 길목에 봉쇄 격벽이 있으면 표시 (문은 placeDoors)
// 통로는 격벽으로 나뉜 다른 구간(앞 격벽 길목 포함 — 그 구역 번호로 표시됨)의 바닥에 닿지 않게 (격벽을 돌아가는 길이 생기지 않게)
const gateSeg = n => Object.keys(GATES).filter(g => g < n).length; // 구역 n 앞에 있는 격벽 수
function linkRegions(A, B) {
  const box = [Math.min(A.bx, B.bx) + 1, Math.min(A.by, B.by) + 1, Math.max(A.bx, B.bx) + FIELD.block - 1, Math.max(A.by, B.by) + FIELD.block - 1], pairs = [];
  const gate = !!GATES[A.n], segs = regions.map((_, n) => gateSeg(n)), avoid = new Uint8Array(MW * MH);
  for (let k = 0; k < MW * MH; k++) if (tiles[k] === T.FLOOR && segs[regionMap[k]] !== segs[A.n]) for (const [dx, dy] of [[0, 0], ...DIR8]) avoid[k + dy * MW + dx] = 1;
  for (const a of A.rooms) for (const b of B.rooms) if (a !== A.entry) pairs.push([Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy), a, b]);
  pairs.sort((u, v) => u[0] - v[0]);
  for (const [, a, b] of pairs.slice(0, 14)) {
    if (!connect(a, b, box, gate, avoid)) continue;
    A.exit = a; B.entry = b; links[links.length - 1].gate = GATES[A.n] ? A.n : 0;
    return;
  }
  throw new Error(`구역 ${A.n}과 ${B.n}을 잇지 못함`);
}
// 보급 거점: FIELD.hubs의 구역에만 하나씩, 구역 1은 착륙 지점(다음 구역 길목에서 먼 방 — 플레이어가 처음 서는 곳이라 구역 1의 입구가 됨)
// 입구·출구에서 떨어진 큰 방에, 자판기 다섯 대를 서로 떨어뜨려 놓을 수 있는 방만 (어디에도 안 되면 조금 덜 떨어뜨려서)
const HUB_KINDS = [['shop', '보급 자판기', '255,200,90'], ['sell', '회수 자판기', '120,255,160'], ['upgrade', '개조 자판기', '120,190,255'], ['save', '기록 단말기', '230,230,230'], ['stash', '보관함', '200,170,255']];
function placeHubs() {
  for (const n of FIELD.hubs) {
    const R = regions[n];
    if (n === 1) {
      const d = bfs(R.exit.cx, R.exit.cy), cand = R.rooms.filter(q => q !== R.exit).sort((a, b) => d[b.cy * MW + b.cx] - d[a.cy * MW + a.cx]);
      for (const gap of FIELD.hubGap) { const r = cand.find(q => makeHub(q, '착륙 지점', gap)); if (r) { R.entry = r; break; } }
      if (!hubs.length) throw new Error('착륙 지점을 놓지 못함');
      continue;
    }
    const far = r => Math.min(...[R.entry, R.exit].map(q => Math.abs(q.cx - r.cx) + Math.abs(q.cy - r.cy)));
    const order = R.rooms.filter(r => r !== R.entry && r !== R.exit).map(r => [far(r) + Math.random() * 6 + (r.w >= 8 && r.h >= 7 ? 12 : 0), r]).sort((a, b) => b[0] - a[0]).map(a => a[1]); // 큰 방, 입구·출구에서 먼 방부터
    if (!FIELD.hubGap.some(gap => order.some(r => makeHub(r, `${CAMPAIGN[n - 1].name} 거점`, gap)))) throw new Error(`구역 ${n}에 보급 거점을 놓지 못함`);
  }
}
// 자판기 다섯 대: 위·왼쪽 벽 먼저 (화면에서 잘 보임), 모자라면 아래·오른쪽 벽. 서로 gap칸 이상 떨어지게 (바로 옆 자판기를 고르기 쉽게). 다 놓지 못하면 되돌리고 null
function makeHub(r, name, gap = 1) {
  const cells = [], placed = [];
  for (let i = r.x + 1; i < r.x + r.w - 1; i++) cells.push([i, r.y, i, r.y - 1]);
  for (let j = r.y + 1; j < r.y + r.h - 1; j++) cells.push([r.x, j, r.x - 1, j]);
  for (let i = r.x + 1; i < r.x + r.w - 1; i++) cells.push([i, r.y + r.h - 1, i, r.y + r.h]);
  for (let j = r.y + 1; j < r.y + r.h - 1; j++) cells.push([r.x + r.w - 1, j, r.x + r.w, j]);
  for (const [i, j, wi, wj] of cells) {
    if (placed.length >= HUB_KINDS.length) break;
    if (placed.some(([a, b]) => Math.max(Math.abs(a - i), Math.abs(b - j)) < gap)) continue;
    if (tileAt(wi, wj) === T.WALL && tryPlace([[i, j]], T.TERM, r)) placed.push([i, j]);
  }
  if (placed.length < HUB_KINDS.length) { for (const [i, j] of placed) tiles[j * MW + i] = T.FLOOR; return null; }
  const h = { n: hubs.length, reg: r.reg, room: r, name, found: false, pad: { i: r.cx, j: r.cy }, edges: hubEdges(r) };
  r.hub = h; hubs.push(h);
  tiles[r.cy * MW + r.cx] = T.EXIT; pads.push({ i: r.cx, j: r.cy, kind: 'hub', hub: h });
  placed.forEach(([i, j], k) => { const [kind, tname, col] = HUB_KINDS[k]; terminals.push({ i, j, kind, name: tname, col, hub: h }); });
  return h;
}
// 안전 지대 차단막 자리: 방 테두리 바로 바깥의 지나갈 수 있는 칸(입구)과 방 사이의 선분 (이어진 칸은 하나로), d: 그리는 깊이
function hubEdges(r) {
  const out = [], sides = [
    [r.x, r.x + r.w, i => [i, r.y - 1], i => [i, r.y, i + 1, r.y]],
    [r.x, r.x + r.w, i => [i, r.y + r.h], i => [i, r.y + r.h, i + 1, r.y + r.h]],
    [r.y, r.y + r.h, j => [r.x - 1, j], j => [r.x, j, r.x, j + 1]],
    [r.y, r.y + r.h, j => [r.x + r.w, j], j => [r.x + r.w, j, r.x + r.w, j + 1]],
  ];
  for (const [s0, s1, cell, seg] of sides) {
    let run = null;
    for (let q = s0; q <= s1; q++) {
      if (q < s1 && walkable(tileAt(...cell(q)))) { const [x0, y0, x1, y1] = seg(q); if (run) { run.x1 = x1; run.y1 = y1; } else run = { x0, y0, x1, y1 }; }
      else if (run) { run.d = (run.x0 + run.x1 + run.y0 + run.y1) / 2; out.push(run); run = null; }
    }
  }
  return out;
}
// 장식: 파이프 / 상자 (거점·입구·출구·보스 방은 비움)
function decorateRooms() {
  for (const r of rooms) {
    if (r.hub || r.boss || regions[r.reg].entry === r || regions[r.reg].exit === r) continue;
    if (Math.random() < 0.55) {
      const cells = [];
      if (r.w >= r.h) { const j = Math.random() < 0.5 ? r.y + 1 : r.y + r.h - 2; for (let i = r.x + 1; i < r.x + r.w - 1; i++) cells.push([i, j]); tryPlace(cells, T.PIPEX, r); }
      else { const i = Math.random() < 0.5 ? r.x + 1 : r.x + r.w - 2; for (let j = r.y + 1; j < r.y + r.h - 1; j++) cells.push([i, j]); tryPlace(cells, T.PIPEY, r); }
    }
    for (let n = irnd(1, 4); n > 0; n--) {
      const i = r.x + irnd(0, r.w - 2), j = r.y + irnd(0, r.h - 2), cells = [[i, j]];
      if (Math.random() < 0.5) cells.push([i + 1, j]);
      if (Math.random() < 0.3) cells.push([i, j + 1]);
      tryPlace(cells, T.CRATE, r);
    }
  }
}
// 조명: 방마다 윗벽 앞 (문 앞은 피해서), 거점은 자판기 위로 밝게, 패드마다 불빛
function placeFieldLamps() {
  for (const r of rooms) {
    if (r.hub) continue;
    let x = r.x + irnd(1, r.w - 2);
    for (let k = 0; k < 12 && keepClear[r.y * MW + x]; k++) x = r.x + irnd(1, r.w - 2);
    lamps.push({ x: x + 0.5, y: r.y + 0.6, col: pick(['255,70,40', '255,150,60', '255,150,60', '120,200,255']), ph: rnd(0, 6), flick: Math.random() < 0.35 });
  }
  for (const t of terminals) if (t.kind === 'shop' || t.kind === 'save') lamps.push({ x: t.i + 0.5, y: t.j + 0.9, col: '170,210,255', ph: rnd(0, 6), flick: false });
  for (const h of hubs) lamps.push({ x: h.pad.i + 0.5, y: h.pad.j + 0.5, col: '90,200,255', ph: 0, flick: false, exit: true });
  for (const h of hubs) for (const b of h.edges) lamps.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, col: '110,200,255', ph: b.d, flick: false, exit: true }); // 안전 지대 차단막 불빛 (난수를 쓰지 않음 — 같은 씨앗이면 같은 지도)
}
// 탈출정: 코어(구역 9) 입구 방 구석 (구석이 다 막혔으면 방 안 아무 빈칸) — 오버마인드를 처치해야 가동
function placeEscapePad() {
  const r = regions[9].entry, cells = [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]];
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) if (i !== r.cx || j !== r.cy) cells.push([i, j]);
  for (const [i, j] of cells) {
    if (tileAt(i, j) !== T.FLOOR || keepClear[j * MW + i]) continue;
    tiles[j * MW + i] = T.EXIT; pads.push({ i, j, kind: 'escape' });
    lamps.push({ x: i + 0.5, y: j + 0.5, col: '255,70,50', ph: 0, flick: false, exit: true, escape: true });
    return;
  }
}
// 구역 임무: 해킹 단말기(구역 가장 안쪽 방), 생존자, 둥지 — 이미 이룬 임무는 다시 놓지 않음
const PURGE = { type: 'purge', t: 0 };
function setupMissions() {
  survivors = [];
  for (let n = 1; n <= 9; n++) {
    const R = regions[n], C = CAMPAIGN[n - 1].mission;
    R.mission = { type: 'purge', t: 0, reg: n };
    if (!C || flags.missions.includes(n)) continue;
    if (C.type === 'hack') { const t = placeHackTerminal(C, R); if (t) { R.mission = { type: 'hack', time: C.time, term: t, prog: 0, on: false, done: false, near: false, nextWave: 2, t: 0, reg: n }; t.m = R.mission; } }
    else if (C.type === 'rescue') R.mission = { type: 'rescue', n: placeSurvivors(C.n, R), saved: 0, lost: 0, t: 0, reg: n };
    else { const k = placeNests(C.n, R); R.mission = { type: 'nest', n: k, left: k, t: 0, reg: n }; }
  }
}

// 새 필드 시작 (새 게임·불러오기): 씨앗으로 지도를 만들고 진행 기록을 적용, 거점에 세움
function startField(seed, fl = {}, hubN = 0, seen = null) {
  inBase = false; rift = null; resetWorld();
  flags = { bosses: [], missions: [], keys: [], hubs: [], visited: [], logs: [], armory: [], ...fl };
  for (let attempt = 0; ; attempt++) { // 아주 드물게 만들지 못하면 다른 씨앗으로
    try { fieldSeed = seed; withSeed(seed, genField); break; } catch (e) { if (attempt > 6) throw e; seed = newSeed(); }
  }
  for (const R of regions.slice(1)) for (const kp of R.keyPlan) { // 키카드 (이미 주운 것은 빼고, 그 문은 가까이 가면 열림)
    if (flags.keys.includes(`${R.n}:${kp.color}`)) { keysHeld.add(`${R.n}:${kp.color}`); continue; }
    let p = null;
    for (let k = 0; k < 40 && !p; k++) { const q = randomFloorIn(kp.room, 0.4); if (kp.ok(Math.floor(q.y) * MW + Math.floor(q.x))) p = q; }
    p = p || { x: kp.room.cx + 0.5, y: kp.room.cy + 0.5 };
    addPickup(p.x, p.y, 'key', kp.color); pickups[pickups.length - 1].kr = R.n;
  }
  for (const h of hubs) h.found = flags.hubs.includes(h.n);
  withSeed((fieldSeed * 71 + 0xa53) | 0, placeArmories); // 무기고 단말기 (무기 슬롯)
  withSeed((fieldSeed * 53 + 0x5eed) | 0, placeLogs); // 데이터 기록 (이 저장에서 아직 줍지 않은 것)
  seedLoot();
  resetMinimap(false);
  if (seen) unpackSeen(seen);
  const h = hubs[hubN] || hubs[0];
  level = 0; lastHub = h.n; mission = PURGE;
  placePlayer(h.pad.i + 0.5, h.pad.j + 1.5);
  player.onPad = false; invOpen = false; held = null; trade = null; msgs = [];
  hideOverlay(); state = 'play'; mouse.down = false;
  hubIn = h; // 시작·불러온 거점에서는 자동 저장하지 않음 (나갔다 들어오면)
  trackRegion();
}
// 무기고 단말기 (ARMORIES): 그 구역의 방(거점·입구·출구·보스·금고·고유 정예 방 제외)의 위·왼쪽 벽 앞 — 해제한 것은 '해제됨'으로
function placeArmories() {
  for (const A of ARMORIES) {
    const R = regions[A.reg];
    if (!R) continue;
    const busy = r => r.hub || r.boss || r.vault || r.super || r === R.entry || r === R.exit;
    const cand = R.rooms.filter(r => !busy(r) && r.w >= 6 && r.h >= 6).sort(() => Math.random() - 0.5);
    for (const r of cand) if (armoryTerminal(r, A)) break;
  }
}
function armoryTerminal(r, A) {
  const cells = [];
  for (let i = r.x + 1; i < r.x + r.w - 1; i++) cells.push([i, r.y, i, r.y - 1, i, r.y + 1]);
  for (let j = r.y + 1; j < r.y + r.h - 1; j++) cells.push([r.x, j, r.x - 1, j, r.x + 1, j]);
  for (let k = cells.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [cells[k], cells[m]] = [cells[m], cells[k]]; }
  for (const [i, j, wi, wj, fi, fj] of cells) {
    if (tileAt(wi, wj) !== T.WALL || tileAt(fi, fj) !== T.FLOOR || DIR8.some(([dx, dy]) => tileAt(i + dx, j + dy) === T.DOOR)) continue;
    if (lamps.some(l => Math.floor(l.x) === i && Math.floor(l.y) === j) || pickups.some(o => Math.floor(o.x) === i && Math.floor(o.y) === j) || !tryPlace([[i, j]], T.TERM, r)) continue;
    const t = { i, j, fi, fj, kind: 'armory', name: A.name, col: '255,170,60', reg: A.reg, A, state: flags.armory.includes(A.reg) ? 'done' : 'idle', prog: 0, nextWave: 2, near: false };
    terminals.push(t);
    lamps.push({ x: i + 0.5, y: j + 0.9, col: '255,170,60', ph: rnd(0, 6), flick: false });
    return t;
  }
  return null;
}
let armoryOn = null; // 해제 중인 무기고 단말기
function startArmory(t) {
  if (t.state !== 'idle') return;
  t.state = 'on'; t.prog = 0; t.nextWave = 2; t.near = true; armoryOn = t;
  Snd.play('hack', t.i + 0.5, t.j + 0.5); tip('armory');
  msg(`${t.name} 해제 시작 — ${t.A.time}초 동안 단말기 곁(${t.A.r}칸 안)을 지켜라! 적 무리가 몰려온다`, '#ffb060');
}
// 단말기에서 r칸 안에 있는 동안만 진행 (벗어나면 멈춤). gap초마다 적 무리, 마지막 무리에는 정예 — 마치면 무기 슬롯 한 칸 + 무기 하나
function updateArmory(dt) {
  const t = armoryOn;
  if (!t || t.state !== 'on') return;
  const A = t.A;
  t.near = Math.hypot(player.x - t.i - 0.5, player.y - t.j - 0.5) < A.r;
  if (!t.near) {
    if (gtime - (t.warnT ?? -9) > 5) { t.warnT = gtime; msg('무기고 단말기에서 멀어져 해제가 멈췄습니다 — 돌아가세요', '#f96'); }
    return;
  }
  t.prog = Math.min(A.time, t.prog + dt);
  if (t.prog >= t.nextWave && t.prog < A.time) { const last = t.nextWave + A.gap >= A.time; spawnWave(t.fi, t.fj, t.reg, A.wave * (last ? 1.5 : 1), last); t.nextWave += A.gap; }
  if (t.prog < A.time) return;
  t.state = 'done'; armoryOn = null;
  if (!flags.armory.includes(t.reg)) flags.armory.push(t.reg);
  const n = slotsOpen(), x = t.fi + 0.5, y = t.fj + 0.5;
  dropWeapon(x, y, atLeastMagic(randomLootWeapon(2, 0.3))); // 무기 거치대의 무기
  for (let k = 0; k < 2; k++) { const a = randomAmmoType(); addPickup(x + rnd(-0.6, 0.6), y + rnd(-0.6, 0.6), 'ammo', a, AMMO[a].pack); }
  flashes.push({ x, y, r: 420, t: 0.5, max: 0.5, col: '255,190,90' }); Snd.play('hackDone', x, y);
  msg(`★ ${t.name} 해제 — 무기 슬롯 ${n}번이 열렸다 (${n}/${WEAPON_SLOTS.max}칸)`, '#ffd27a');
}
// 데이터 기록 (LOGS): 그 구역의 방(거점·착륙 지점 제외) 아무 데나 휴대 단말기로
function placeLogs() {
  LOGS.forEach((L, i) => {
    const R = regions[L.reg], cand = R && R.rooms.filter(r => !r.hub && r !== regions[1].entry);
    if (!cand || !cand.length) return;
    const q = randomFloorIn(pick(cand), 0.4);
    if (!flags.logs.includes(i)) addPickup(q.x, q.y, 'log', i);
  });
}
// 데이터 기록 줍기: 재생 카드 + 수집 도감
let logNow = null; // 재생 중인 기록 { id, t, max }
function readLog(i) {
  const L = LOGS[i];
  if (!flags.logs.includes(i)) flags.logs.push(i);
  if (!codex.logs[i]) { codex.logs[i] = 1; codexDirty = true; }
  logNow = { id: i, t: LOG_TIME, max: LOG_TIME };
  msg(`데이터 기록 재생: ${L.title} — ${L.who} (${nKeys(codex.logs)}/${LOGS.length})`, '#7fe0ff'); Snd.play('radio'); tip('log');
}
function drawLog() {
  const T = logNow;
  if (!T || state !== 'play' || codexOpen) return;
  const L = LOGS[T.id], w = Math.min(500, W - 300), x = (W - w) / 2, tx = 70;
  ctx.font = '13px sans-serif';
  const lines = wrapPx(`"${L.text}"`, w - tx - 16), h = 52 + lines.length * 19 + 18, y = 50;
  ctx.globalAlpha = clamp(Math.min((T.max - T.t) / 0.25, T.t / 0.6), 0, 1);
  ctx.fillStyle = 'rgba(8,16,20,0.92)'; rr(x, y, w, h, 7); ctx.fill();
  ctx.strokeStyle = '#3fb8d8'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(80,200,255,0.08)'; ctx.fillRect(x + 12, y + 14, 48, 48); drawIcon(Math.floor(gtime * 3) % 2 ? 'pmapb0' : 'pmapa0', x + 16, y + 18, 40, 40);
  ctx.textAlign = 'left'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#7fe0ff'; ctx.fillText(fitText(`데이터 기록 · ${L.title}`, w - tx - 16), x + tx, y + 26);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#8fb0b8'; ctx.fillText(`${L.who} · 구역 ${L.reg} ${CAMPAIGN[L.reg - 1].name}`, x + tx, y + 44);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#e0f0f0';
  lines.forEach((l, k) => ctx.fillText(l, x + tx, y + 66 + k * 19));
  ctx.textAlign = 'right'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#5f8890'; ctx.fillText('[H] 닫기 · [J] 수집 도감에서 다시 보기', x + w - 12, y + h - 8);
  ctx.fillStyle = 'rgba(63,184,216,0.55)'; ctx.fillRect(x + 8, y + h - 4, (w - 16) * clamp(T.t / T.max, 0, 1), 2);
  ctx.globalAlpha = 1;
}
// 예전(구역 방식) 저장: 그 구역까지 지나온 것으로 — 앞 구역의 보스·임무는 끝났고, 구역마다 첫 거점을 찾아 둠
function legacyFlags(stage) {
  const done = n => n < stage;
  return { bosses: [3, 6, 9].filter(done), missions: CAMPAIGN.map((C, k) => C.mission && done(k + 1) ? k + 1 : 0).filter(Boolean), keys: [], hubs: [], visited: CAMPAIGN.map((_, k) => k + 1).filter(n => n <= stage) };
}
// 바닥에 놓인 장비: 구역마다 1~2개 + 가끔 스킬 쉘 (불러올 때마다 새로)
function seedLoot() {
  for (const R of regions.slice(1)) {
    const cand = R.rooms.filter(r => !r.hub), lv = level;
    level = R.n; // 그 구역 기준의 등급·종류
    for (let k = irnd(1, 2); k > 0; k--) { const q = randomFloorIn(pick(cand)); dropWeapon(q.x, q.y, randomLoot()); }
    if (Math.random() < SHELL_DROP.floor) { const q = randomFloorIn(pick(cand)); dropWeapon(q.x, q.y, randomLootShell()); }
    level = lv;
  }
}
// 지금 서 있는 구역·거점 확인: 구역이 바뀌면 안내, 거점에 들어오면 찾은 것으로 (순간이동 등록). 음악: 거점은 잔잔한 기지 곡, 밖은 그 구역 곡
let hubIn = null; // 지금 들어와 있는 거점 (자동 저장: 밖에서 거점에 들어올 때마다)
function trackRegion() {
  const p = player, n = regionAt(p.x, p.y), r = roomAt(p.x, p.y);
  if (n && n !== level) enterRegion(n);
  if (r && r.hub) { if (!r.hub.found) discoverHub(r.hub); lastHub = r.hub.n; }
  const h = r && r.hub ? r.hub : null;
  if (h !== hubIn) { hubIn = h; if (h && state === 'play' && !escape && !rift) { autoSave(); maybeAssault(h); } }
  if (level && !escape) Music.play(r && r.hub && !contested() ? MUSIC.base : combatT > 0 ? MUSIC.combat[Math.min(2, Math.floor((level - 1) / 3))] : MUSIC.zones[level - 1]); // 거점은 잔잔한 곡, 싸우는 중이면 전투 곡
}
// 전투 음악 (COMBAT_MUSIC): 플레이어를 알아챈 적이 가까이 있는 동안 + 그 뒤 hold초
let combatT = 0;
function combatTick(dt) {
  const p = player, R = COMBAT_MUSIC.r;
  combatT = enemies.some(e => e.aggro && !e.dead && Math.abs(e.x - p.x) < R && Math.abs(e.y - p.y) < R && Math.hypot(e.x - p.x, e.y - p.y) < R) ? COMBAT_MUSIC.hold : Math.max(0, combatT - dt);
}
// ===== 거점 습격 (ASSAULT): 몬스터 무리가 보급 거점의 안전막을 두드림 — 습격 중에는 거점 안에서도 싸울 수 있고, 다 처치하면 보상 =====
// phase: wait (들어온 뒤 잠깐) → warn (경보, 카운트다운) → fight (무리가 몰려옴). 안전막이 다 깎이면 그 방의 안전 지대가 꺼짐 (끝나면 복구)
let assault = null, assaultCd = 0; // { hub, ri: 방 번호, phase, t, hp, max, wave, next, foes, broke, hitT }
const contested = () => !!assault && assault.phase !== 'wait' && roomOf[Math.floor(player.y) * MW + Math.floor(player.x)] === assault.ri; // 습격받는 거점 안 (싸울 수 있음)
function maybeAssault(h) {
  if (assault || assaultCd > 0 || h.reg < ASSAULT.from || hazards.length || Math.random() >= ASSAULT.chance) return;
  const max = ASSAULT.hp + ASSAULT.lvHp * h.reg;
  assault = { hub: h, ri: rooms.indexOf(h.room), phase: 'wait', t: rnd(...ASSAULT.delay), hp: max, max, wave: 0, next: 0, foes: new Set(), broke: false, hitT: 0 };
}
function updateAssault(dt) {
  if (assaultCd > 0) assaultCd -= dt;
  const A = assault;
  if (!A) return;
  const p = player, h = A.hub, far = Math.hypot(p.x - h.pad.i - 0.5, p.y - h.pad.j - 0.5) > ASSAULT.far;
  if (A.phase === 'wait') { // 들어왔다가 바로 떠나면 없던 일로
    if (far) assault = null;
    else if ((A.t -= dt) <= 0) { A.phase = 'warn'; A.t = ASSAULT.warn; Snd.play('alarm'); tip('assault'); }
    return;
  }
  if (far || escape) { endAssault(false, '거점 습격이 흩어졌다 — 거점에서 너무 멀어졌다'); return; }
  if (A.phase === 'warn') { const s0 = Math.ceil(A.t); A.t -= dt; if (A.t <= 0) A.phase = 'fight'; else if (Math.ceil(A.t) < s0) Snd.play('alarm'); return; } // 1초마다 경보
  if (A.wave < ASSAULT.waves && (A.next -= dt) <= 0) { // 다음 무리 (거점에서 길로 9~20칸 떨어진, 보이지 않는 곳에서)
    const before = new Set(enemies);
    spawnWave(h.pad.i, h.pad.j, h.reg, ASSAULT.wave, A.wave === ASSAULT.waves - 1);
    for (const e of enemies) if (!before.has(e)) { A.foes.add(e); e.aggro = true; }
    A.wave++; A.next = ASSAULT.gap; Snd.play('alarm');
  }
  if (!A.broke) { // 안전막에 붙은 적이 막을 깎음
    const r = h.room;
    for (const e of A.foes) {
      if (e.dead || !e.aggro || e.stun > 0 || e.freeze > 0) continue;
      const cx = clamp(e.x, r.x, r.x + r.w), cy = clamp(e.y, r.y, r.y + r.h);
      if (Math.hypot(e.x - cx, e.y - cy) > e.r + 0.55) continue;
      A.hp -= (e.d.dmg || 8) * (1 + 0.1 * (e.lv - 1)) * ASSAULT.atk * dt; A.hitT = 0.15;
      if (Math.random() < dt * 5) spark(cx, cy, 3, '#9df', 2.5);
    }
    if (A.hp <= 0) breakBarrier(A);
  }
  A.hitT -= dt; A.ft = (A.ft || 0) + dt;
  for (const e of A.foes) if (e.dead) A.foes.delete(e);
  if (A.wave >= ASSAULT.waves && (!A.foes.size || A.ft > ASSAULT.gap * ASSAULT.waves + 60)) endAssault(true); // 다 처치 (길을 잃고 오지 않는 적이 남아도 너무 오래 끌지 않게)
}
// 안전막 붕괴: 그 방의 안전 지대를 끔 (적이 들어오고, 안에서도 다침) — 습격이 끝나면 복구
function breakBarrier(A) {
  const h = A.hub, r = h.room;
  A.broke = true; A.hp = 0; h.broken = true;
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) safeMap[j * MW + i] = 0;
  for (const b of h.edges) { const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2; spark(x, y, 24, pick(['#9cf', '#cdf', '#fff']), 5); flashes.push({ x, y, r: 260, t: 0.3, max: 0.3, col: '120,180,255' }); }
  shake = Math.max(shake, 10); Snd.play('shieldBreak'); Snd.play('alarm');
  eventNotes.push({ x: h.pad.i + 0.5, y: h.pad.j + 0.5, z: 170, t: '안전막 붕괴 — 적이 들어온다!', col: '#ff8a5a', until: gtime + 3 });
}
// 습격 끝: 이겼으면 보상 (막이 버텼으면 hold배) — 안전막은 언제나 복구, 다음 습격까지 cd초
function endAssault(won, why) {
  const A = assault, h = A.hub, r = h.room, x = h.pad.i + 0.5, y = h.pad.j + 0.5;
  assault = null; assaultCd = ASSAULT.cd;
  if (A.broke) { h.broken = false; for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) safeMap[j * MW + i] = 1; } // 안에 들어온 적은 밖으로 밀려남 (evict)
  if (!won) { eventNotes.push({ x, y, z: 130, t: why || '거점 습격이 끝났다', col: '#b9b4a8', until: gtime + 3 }); return; }
  const k = A.broke ? 1 : ASSAULT.hold, n = h.reg, gold = Math.round(irnd(...ASSAULT.gold) * n * k), xp = Math.round(ASSAULT.xp * n * k);
  for (let m = 0; m < 4; m++) addPickup(x + rnd(-1, 1), y + 1 + rnd(-0.5, 0.8), 'gold', 'gold', Math.round(gold / 4));
  for (let m = 0; m < 2; m++) { const a = randomAmmoType(); addPickup(x + rnd(-1, 1), y + 1 + rnd(-0.5, 0.8), 'ammo', a, AMMO[a].pack); }
  dropWeapon(x + rnd(-0.6, 0.6), y + 1.2, atLeastMagic(randomLoot(A.broke ? 1 : 2, 0.3)));
  gainXp(xp); addText(x, y, `+${xp} XP`, '#c9a0ff', 56);
  eventNotes.push({ x, y, z: 130, t: A.broke ? `습격을 막아냈다 — 안전막 복구 (+${gold}G)` : `완벽한 방어! 안전막이 버텼다 (+${gold}G)`, col: '#9f9', until: gtime + 4 });
  flashes.push({ x, y, r: 420, t: 0.4, max: 0.4, col: '140,255,170' }); Snd.play('hackDone');
}
function enterRegion(n) {
  const C = CAMPAIGN[n - 1], R = regions[n], first = !flags.visited.includes(n);
  level = n; mission = R.mission; exitDist = null;
  msg(`구역 ${n} ${C.name}`, '#9f9');
  if (!first) return;
  flags.visited.push(n);
  msg(C.brief, '#cfe8c8');
  if (n > 1) { // 새 구역 보너스 (예전의 구역 클리어 보너스)
    const g = REGION_BONUS.gold * (n - 1), xp = REGION_BONUS.xp * (n - 1);
    player.gold += g; gainXp(xp); msg(`구역 ${n} 진입 — 보너스 +${g}G · 경험치 +${xp}`, '#ffd27a');
  }
  const M = R.mission;
  if (M.type !== 'purge') { msg(`임무: ${MISSIONS[M.type].name} — ${MISSIONS[M.type].goal(M.type === 'hack' ? { ...M, term: M.term.name } : M)}`, MISSIONS[M.type].color); tip(M.type); }
  if (R.exit.boss && !flags.bosses.includes(n)) msg(`⚠ 대형 개체 '${ENEMIES[R.exit.boss].name}' 반응 — ${n < 9 ? '다음 구역으로 가는 길목' : '코어'}`, '#f96');
  if (R.locks.length) msg(`${R.locks.map(c => KEYCARDS[c].name.split(' ')[0]).join('·')} 보안문 — 이 구역의 같은 색 키카드가 있어야 열린다`, '#9cf');
  if (terminals.some(t => t.kind === 'armory' && t.reg === n && t.state === 'idle')) { msg('이 구역에 잠긴 무기고가 있다 — 해제하면 무기 슬롯이 한 칸 늘어난다 (미니맵의 주황 고리)', '#ffb060'); tip('armory'); }
}
// 지도가 바뀐 예전 저장(거점이 줄기 전 판·구역 방식): 이미 지나온 구역(가장 깊이 들어간 구역 앞)의 키카드는 가진 것으로,
// 들어가 본 구역의 거점 중 착륙 지점에서 (연 격벽·가진 키카드로) 닿는 곳을 찾은 것으로 하고, 가장 깊은 곳에 세움
function settleHubs() {
  const deep = Math.max(1, ...flags.visited);
  for (let n = 1; n < deep; n++) for (const c of regions[n].locks) { const k = `${n}:${c}`; if (!flags.keys.includes(k)) flags.keys.push(k); keysHeld.add(k); }
  pickups = pickups.filter(it => !(it.kind === 'key' && keysHeld.has(`${it.kr}:${it.id}`)));
  const blocked = new Uint8Array(MW * MH);
  for (const d of doors) if (d.locked && (d.gate ? !gateOpen(d.gate) : !keysHeld.has(`${d.kr}:${d.key}`))) for (const c of d.cells) blocked[c] = 1;
  const reach = bfs(hubs[0].pad.i, hubs[0].pad.j, blocked);
  let h = hubs[0];
  for (const q of hubs) {
    if (!flags.visited.includes(q.reg) || reach[q.pad.j * MW + q.pad.i] < 0) continue;
    if (!q.found) { q.found = true; if (!flags.hubs.includes(q.n)) flags.hubs.push(q.n); }
    if (q.reg > h.reg) h = q;
  }
  placePlayer(h.pad.i + 0.5, h.pad.j + 1.5); lastHub = h.n; trackRegion();
}
function discoverHub(h) {
  h.found = true; if (!flags.hubs.includes(h.n)) flags.hubs.push(h.n);
  msg(`보급 거점 발견: ${h.name} — 안전 지대 · 순간이동 패드에 등록됨`, '#7fd8ff'); Snd.play('radio'); tip('hub');
}

// --- 적: 방에 가까이 가면 그 방의 적이 나타남 (한 번만), 멀리 있는 적은 쉼 (updateEnemies) ---
let spawnCheck = 0;
function spawnNear(dt) {
  if ((spawnCheck -= dt) > 0) return;
  spawnCheck = 0.3;
  const p = player;
  for (const r of rooms) {
    if (r.spawned) continue;
    const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
    if (dx + dy < FIELD.spawn) spawnRoom(r);
  }
}
// 방 하나 채우기: 그 구역 기준의 적 (보스 방은 절반, 다음 구역 길목 방은 1.3배) + 통·보급품, 정예, 보스
function spawnRoom(r) {
  r.spawned = true;
  if (r.hub || r.vault) return; // 거점·금고에는 적이 없음
  if (r.super) { spawnSuper(r); return; }
  const lv = r.reg, R = regions[lv], bossHere = r.boss && !flags.bosses.includes(lv);
  fillRoom(r, (ROOM_BUDGET[0] + ROOM_BUDGET[1] * lv) * rnd(0.7, 1.3) * (bossHere ? 0.5 : r === R.exit ? 1.3 : 1) * (rift ? RIFT.dense : 1), enemyPool(lv), lv);
  const made = enemies.filter(e => !e.dead && !e.elite && !e.d.nest && !e.d.bomb && roomAt(e.x, e.y) === r); // 폭주 해골은 정예가 되지 않음
  for (let k = 0; k < (r.elites || 0) && made.length; k++) { // 정예: 되도록 위협도 2 이상인 적에게 특성
    const strong = made.filter(e => e.d.cost >= 2), e = pick(strong.length ? strong : made);
    makeElite(e, irnd(1, ELITE_AFFIX_MAX[lv - 1])); made.splice(made.indexOf(e), 1);
  }
  if (Math.random() < 0.5) for (let k = irnd(1, 2); k > 0; k--) { const q = randomFloorIn(r); barrels.push({ x: q.x, y: q.y, r: 0.28, hp: 25 }); }
  if (Math.random() < 0.45) { const q = randomFloorIn(r); addPickup(q.x, q.y, 'item', weighted(ITEM_DROP_WEIGHTS)); }
  if (Math.random() < 0.55) { const q = randomFloorIn(r), a = randomAmmoType(); addPickup(q.x, q.y, 'ammo', a, AMMO[a].pack); }
  if (Math.random() < 0.3) { const q = randomFloorIn(r); addPickup(q.x, q.y, 'gold', 'gold', irnd(20, 60) * lv); }
  if (Math.random() < 0.2) { const q = randomFloorIn(r); addPickup(q.x, q.y, 'gren', pick(Object.keys(GRENADES)), 1); }
  const TR = rift || R; // 보물 약탈자 (구역·균열마다 한 번까지)
  if (TR && !TR.thief && !bossHere && Math.random() < (rift ? THIEF.rift : THIEF.room)) { TR.thief = true; const q = randomFloorIn(r, 0.4); spawnEnemy('thief', q.x, q.y, lv); }
  if (bossHere) {
    const q = ENEMIES[r.boss].fixed ? { x: r.cx + 0.5, y: r.cy + 0.5 } : randomFloorIn(r, 0.9);
    boss = spawnEnemy(r.boss, q.x, q.y, lv);
  }
}

// 고유 정예와 부하 (불러오면 다시 나타남)
function spawnSuper(r) {
  const S = r.super, lv = r.reg, q = randomFloorIn(r, 0.9), e = spawnEnemy(S.base, q.x, q.y, lv);
  makeElite(e, 0, S.affixes);
  e.hp = e.maxhp = e.maxhp * S.hp; e.name = S.name; e.super = S;
  for (const [type, n] of S.minions) for (let k = 0; k < n; k++) { const m = randomFloorIn(r, ENEMIES[type].r); spawnEnemy(type, m.x, m.y, lv); }
}
// 고유 정예 처치: 좋은 장비 둘, 보석 둘, 골드, 가끔 고유 전설, 그 구역 금고 열쇠
function superDeath(e) {
  const n = e.lv, R = regions[n];
  for (let k = 0; k < 2; k++) dropWeapon(e.x + rnd(-0.6, 0.6), e.y + rnd(-0.6, 0.6), atLeastMagic(randomLoot(3, 0.4)));
  for (let k = 0; k < 2; k++) dropWeapon(e.x + rnd(-0.6, 0.6), e.y + rnd(-0.6, 0.6), randomGem(2));
  const u = uniqueShellDrop(SHELL_UNIQUE_DROP.super) || uniqueDrop(UNIQUE_DROP.elite * 2);
  if (u) dropWeapon(e.x, e.y, u);
  const st = setDrop(SET_DROP.super); if (st) dropWeapon(e.x + rnd(-0.5, 0.5), e.y + rnd(-0.5, 0.5), st); // 세트 장비
  addPickup(e.x + rnd(-0.5, 0.5), e.y + rnd(-0.5, 0.5), 'gold', 'gold', irnd(60, 120) * n);
  if (R && R.vault && !keysHeld.has(`${n}:vault`)) { addPickup(e.x, e.y, 'key', 'vault'); pickups[pickups.length - 1].kr = n; }
  msg(`고유 정예 처치: ${e.name}${R && R.vault ? ' — 금고 열쇠를 떨어뜨렸다' : ''}`, '#ff9a3a');
  flashes.push({ x: e.x, y: e.y, r: 520, t: 0.45, max: 0.45, col: '255,160,60' }); shake = Math.max(shake, 10);
}
// --- 필드 사건과 금고 보물함: 가까이에서 [F] ---
function nearestSpot() {
  let best = null, bd = 1.5;
  for (const o of [...chests.filter(c => !c.open), ...spots.filter(sp => sp.state === 'idle')]) { const d = Math.hypot(o.x - player.x, o.y - player.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function useSpot(o) { if (o.kind === 'chest') openChest(o); else if (o.type === 'cache') openCache(o); else startBeacon(o); }
// 금고 보물함: 좋은 장비, 보석 1~2, 골드, 가끔 고유 전설 쉘·무기
function openChest(c) {
  c.open = true;
  dropWeapon(c.x + rnd(-0.5, 0.5), c.y + rnd(-0.5, 0.5), atLeastMagic(randomLoot(3, 0.4)));
  for (let k = irnd(1, 2); k > 0; k--) dropWeapon(c.x + rnd(-0.5, 0.5), c.y + rnd(-0.5, 0.5), randomGem(2));
  const u = uniqueShellDrop(SHELL_UNIQUE_DROP.vault) || uniqueDrop(0.08);
  if (u) dropWeapon(c.x, c.y, u);
  const st = setDrop(SET_DROP.vault); if (st) dropWeapon(c.x + rnd(-0.5, 0.5), c.y + rnd(-0.5, 0.5), st); // 세트 장비
  addPickup(c.x + rnd(-0.5, 0.5), c.y + rnd(-0.5, 0.5), 'gold', 'gold', irnd(80, 160) * c.reg);
  flashes.push({ x: c.x, y: c.y, r: 360, t: 0.4, max: 0.4, col: '255,210,120' }); glowBurst(c.x, c.y, 20, ['#ffd27a', '#fff2c0', '#ffc850'], 3);
  Snd.play('unique', c.x, c.y); msg('금고 보물함을 열었다', '#ffc040');
}
// 보급 캐시: 보급품을 쏟고 경보 — 근처의 적이 알아채고, 매복 무리가 몰려옴
function openCache(sp) {
  sp.state = 'done';
  const near = () => ({ x: sp.x + rnd(-0.7, 0.7), y: sp.y + rnd(-0.7, 0.7) });
  for (let k = 0; k < 2; k++) { const a = randomAmmoType(), q = near(); addPickup(q.x, q.y, 'ammo', a, AMMO[a].pack); }
  let q = near(); addPickup(q.x, q.y, 'item', weighted(ITEM_DROP_WEIGHTS));
  q = near(); addPickup(q.x, q.y, 'gren', pick(Object.keys(GRENADES)), 1);
  q = near(); addPickup(q.x, q.y, 'gold', 'gold', irnd(30, 70) * sp.reg);
  if (Math.random() < 0.35) dropWeapon(sp.x, sp.y, randomGem());
  if (Math.random() < 0.3) dropWeapon(sp.x, sp.y, randomLoot(1));
  msg('보급 캐시를 열었다 — ⚠ 경보! 적이 몰려온다', '#ffb060'); tip('event');
  alertNear(sp.x, sp.y, 16);
  spawnWave(Math.floor(sp.x), Math.floor(sp.y), sp.reg, 0.8, false);
}
// 조난 신호기: 켜고 time초 동안 곁(r칸 안)에 있으면 송신 완료 — gap초마다 적 무리, 마지막 무리에는 정예
function startBeacon(sp) {
  const B = FIELD_EVENTS.beacon;
  sp.state = 'on'; sp.prog = 0; sp.nextWave = 2; sp.near = true; beaconOn = sp;
  if (sp.lamp) sp.lamp.col = '255,70,50';
  msg(`조난 신호기 작동 — ${B.time}초 동안 곁(${B.r}칸 안)을 지켜라! 적 무리가 몰려온다`, '#ffb060'); Snd.play('hack', sp.x, sp.y); tip('event');
}
function updateBeacon(dt) {
  const sp = beaconOn, B = FIELD_EVENTS.beacon;
  if (!sp || sp.state !== 'on') return;
  sp.near = Math.hypot(player.x - sp.x, player.y - sp.y) < B.r;
  if (!sp.near) {
    if (gtime - (sp.warnT ?? -9) > 5) { sp.warnT = gtime; msg('신호기에서 멀어져 송신이 멈췄습니다 — 돌아가세요', '#f96'); }
    return;
  }
  sp.prog = Math.min(B.time, sp.prog + dt);
  if (sp.prog >= sp.nextWave && sp.prog < B.time) { spawnWave(Math.floor(sp.x), Math.floor(sp.y), sp.reg, 0.7, sp.nextWave + B.gap >= B.time); sp.nextWave += B.gap; }
  if (sp.prog < B.time) return;
  sp.state = 'done'; beaconOn = null;
  if (sp.lamp) sp.lamp.col = '90,255,140';
  dropWeapon(sp.x + 0.6, sp.y + 0.5, atLeastMagic(randomLoot(2, 0.3)));
  dropWeapon(sp.x - 0.6, sp.y + 0.5, randomGem(1));
  addPickup(sp.x, sp.y + 0.8, 'gold', 'gold', irnd(50, 100) * sp.reg);
  const xp = 40 * sp.reg; gainXp(xp); addText(sp.x, sp.y, `+${xp} XP`, '#c9a0ff', 56);
  flashes.push({ x: sp.x, y: sp.y, r: 380, t: 0.5, max: 0.5, col: '120,255,150' });
  msg('조난 신호 송신 완료 — 구조대가 보급품을 떨어뜨렸다', '#9f9'); Snd.play('hackDone', sp.x, sp.y);
}

// --- 순간이동 패드: 찾아 둔 거점으로 (동행 중인 생존자도 함께) — 창은 menu.js의 teleportScreen ---
function teleportTo(h) {
  const p = player, fol = survivors.filter(s => s.state === 'follow');
  hideOverlay(); state = 'play'; mouse.down = false;
  addFx('tfog', 'abcdefghij', p.x, p.y, 0, 0.6, 1);
  placePlayer(h.pad.i + 0.5, h.pad.j + 1.5); p.onPad = false; lastHub = h.n;
  fol.forEach((s, k) => { s.x = p.x + Math.cos(k * 2.1) * 1.2; s.y = p.y + Math.sin(k * 2.1) * 0.8; if (collides(s.x, s.y, s.r, false)) { s.x = p.x; s.y = p.y; } });
  addFx('tfog', 'abcdefghij', p.x, p.y, 0, 0.6, 1); Snd.play('exit');
  msg(`순간이동 — ${h.name}`, '#7fd8ff');
  trackRegion();
}

// ===== 차원 균열 (RIFT_TIERS, RIFT): 거점 패드에서 들어가는 무작위 전투 구역 — 필드는 씨앗·진행 기록으로 저장했다가 나올 때 다시 만듦 =====
let rift = null; // 균열 안이면 { tier, T, lv, prog, need, guardian, done, start, saved: { seed, hub, seen } }
function enterRift(t) {
  if (assault) endAssault(false); // 거점 습격은 끝 (안전막 복구)
  const T = RIFT_TIERS[t - 1], p = player, saved = { seed: fieldSeed, hub: lastHub, seen: packSeen() };
  hideOverlay(); state = 'play'; mouse.down = false; closeInventory();
  inBase = false; resetWorld();
  rift = { tier: t, T, lv: T.lv, prog: 0, need: 1, guardian: null, done: false, saved };
  level = T.lv; mission = PURGE; msgs = [];
  for (let k = 0; ; k++) { try { genRift(); break; } catch (e) { if (k > 6) throw e; } }
  rift.need = Math.round(rooms.filter(r => r !== rift.start).length * (ROOM_BUDGET[0] + ROOM_BUDGET[1] * T.lv) * RIFT.dense * RIFT.need);
  placePlayer(rift.start.cx + 0.5, rift.start.cy + 1.5); p.onPad = false;
  addFx('tfog', 'abcdefghij', p.x, p.y, 0, 0.6, 1); Snd.play('exit'); Music.play(MUSIC.rift);
  flashes.push({ x: p.x, y: p.y, r: 420, t: 0.5, max: 0.5, col: '170,80,255' });
  msg(`차원 균열 ${t}단계 — 적을 쓰러뜨려 균열을 채워라. 가득 차면 균열 수호자가 나타난다`, '#d6a8ff'); tip('rift');
}
// 균열 지도: 구역 하나 크기에 방 8~11개 (필드와 같은 방식), 한쪽 끝 방에 들어온 패드, 정예 방, 보랏빛 조명
function genRift() {
  const R = { n: rift.lv, bx: FIELD.margin, by: FIELD.margin, rooms: [] };
  tiles = new Uint8Array(MW * MH); rooms = []; links = []; keepClear.fill(0); nearRoom.fill(0); regionMap = new Int8Array(MW * MH);
  chests = []; spots = []; doors = []; doorOf.fill(-1); terminals = []; hubs = []; pads = []; lamps = []; survivors = [];
  genRegionRooms(R);
  buildWalls();
  const far = from => { const d = bfs(from.cx, from.cy); return R.rooms.reduce((a, r) => d[r.cy * MW + r.cx] > d[a.cy * MW + a.cx] ? r : a); };
  const start = far(far(R.rooms[0])); // 한쪽 끝 방
  start.spawned = true; rift.start = start;
  tiles[start.cy * MW + start.cx] = T.EXIT; pads.push({ i: start.cx, j: start.cy, kind: 'rift' });
  decorateRooms();
  placeDoors();
  const cand = R.rooms.filter(r => r !== start);
  for (let k = 0; k < RIFT.elites(rift.tier) && cand.length; k++) { const r = pick(cand); r.elites = (r.elites || 0) + 1; }
  placeFieldLamps();
  for (const l of lamps) if (!l.exit) { l.col = pick(['170,80,255', '200,90,255', '255,70,140']); l.flick = Math.random() < 0.3; }
  lamps.push({ x: start.cx + 0.5, y: start.cy + 0.5, col: '200,120,255', ph: 0, flick: false, exit: true });
  applyTheme(RIFT_THEME);
  regionMap = null; // 구역이 아님 (구역 안내·임무 없음)
  resetMinimap(false);
}
// 처치: 균열이 참 (소환·산란·분열·되살아난 적은 빼고, 정예는 4배)
function riftKill(e) {
  if (rift.guardian || rift.done || e.minion || e.parent || e.small || e.raised || e.nestKid || e.d.thief) return;
  rift.prog += (e.d.cost || 1) * (e.elite ? 4 : 1);
}
function updateRift(dt) {
  spawnNear(dt);
  if (rift.guardian || rift.done) return;
  const cleared = rooms.every(r => r.spawned) && !enemies.some(e => !e.dead && !e.d.thief); // 다 쓰러뜨렸는데 덜 찼으면 그래도 수호자 (보물 약탈자는 빼고)
  if (rift.prog >= rift.need || cleared) spawnGuardian();
}
// 균열 수호자: 단계에 맞는 보스 하나가 플레이어 가까이 (보이는 곳)에 나타남
function spawnGuardian() {
  const p = player, type = pick(RIFT_GUARDIANS.filter(([, from]) => from <= rift.tier).map(([k]) => k)), D = ENEMIES[type];
  let q = null;
  for (let k = 0; k < 120 && !q; k++) { const a = rnd(0, 6.28), r = rnd(4.5, 8), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (!collides(x, y, D.r + 0.25, !!D.fly) && los(p.x, p.y, x, y)) q = { x, y }; }
  if (!q) { const room = rooms.reduce((a, r) => Math.hypot(r.cx - p.x, r.cy - p.y) < Math.hypot(a.cx - p.x, a.cy - p.y) ? r : a); q = randomFloorIn(room, D.r + 0.25); }
  const e = spawnEnemy(type, q.x, q.y, rift.lv);
  e.hp = e.maxhp = e.maxhp * RIFT.guardian; e.rift = true; e.seenMsg = true; aggro(e);
  rift.guardian = e; boss = e;
  addFx('tfog', 'abcdefghij', q.x, q.y, 0, 0.8, 2.4); flashes.push({ x: q.x, y: q.y, r: 600, t: 0.6, max: 0.6, col: '200,90,255' }); shake = Math.max(shake, 12);
  msg(`⚠ 균열이 가득 찼다 — 균열 수호자 '${D.name}' 출현!`, '#e080ff'); Snd.play('unique', q.x, q.y);
}
// 수호자 처치: 돌파 기록, 보상 (골드·경험치·세트 장비·보석·좋은 장비), 쓰러진 자리 옆에 나가는 패드
function riftCleared(e) {
  const t = rift.tier, W2 = RIFT.reward;
  rift.done = true; rift.guardian = null;
  if ((flags.rift || 0) < t) flags.rift = t;
  codexStat('rift', t);
  addPickup(e.x + rnd(-0.6, 0.6), e.y + rnd(-0.6, 0.6), 'gold', 'gold', W2.gold * t);
  const xp = W2.xp * t; gainXp(xp); addText(e.x, e.y - 0.5, `+${xp} XP`, '#c9a0ff', 56);
  const st = setDrop(Math.min(0.9, W2.set[0] + W2.set[1] * t)); if (st) dropWeapon(e.x + rnd(-0.8, 0.8), e.y + rnd(-0.8, 0.8), st);
  for (let k = 0; k < W2.gems; k++) dropWeapon(e.x + rnd(-0.8, 0.8), e.y + rnd(-0.8, 0.8), randomGem(1 + Math.floor(t / 3)));
  dropWeapon(e.x + rnd(-0.8, 0.8), e.y + rnd(-0.8, 0.8), atLeastMagic(randomLoot(3 + Math.floor(t / 2), 0.5)));
  let c = null; // 나가는 패드: 쓰러진 자리에서 가까운 빈 바닥 칸 (상자·문·벽이 아닌)
  for (let r = 0; r < 6 && !c; r++) for (let dj = -r; dj <= r && !c; dj++) for (let di = -r; di <= r && !c; di++) { const i = Math.floor(e.x) + di, j = Math.floor(e.y) + dj; if (tileAt(i, j) === T.FLOOR && !keepClear[j * MW + i]) c = { i, j }; }
  if (c) { tiles[c.j * MW + c.i] = T.EXIT; pads.push({ i: c.i, j: c.j, kind: 'riftExit' }); lamps.push({ x: c.i + 0.5, y: c.j + 0.5, col: '200,120,255', ph: 0, flick: false, exit: true }); floorChunks.clear(); }
  flashes.push({ x: e.x, y: e.y, r: 700, t: 0.6, max: 0.6, col: '210,140,255' });
  msg(`★ 차원 균열 ${t}단계 돌파! — 보라색 패드로 거점에 돌아간다`, '#e6c8ff'); Snd.play('hackDone');
}
// 균열에서 나감: 저장해 둔 씨앗·진행 기록·밝힌 지도로 필드를 다시 만들고, 들어간 거점에 세움
function leaveRift(text) {
  const S = rift.saved, p = player;
  rift = null;
  startField(S.seed, flags, S.hub, S.seen);
  addFx('tfog', 'abcdefghij', p.x, p.y, 0, 0.6, 1); Snd.play('exit');
  msg(text, '#d6a8ff');
}
// 목표 칸: 균열 진행 막대 / 수호자 / 돌파
function riftBox() {
  if (rift.done) return { t: `차원 균열 ${rift.tier}단계 돌파! — 보라색 패드로 돌아가기`, col: '#e6c8ff', edge: '#a66cff' };
  if (rift.guardian) return { t: `균열 수호자 ${rift.guardian.d.name}을(를) 처치하라`, col: '#ffb0ff', edge: '#e080ff' };
  const f = Math.min(1, rift.prog / rift.need);
  return { t: `차원 균열 ${rift.tier}단계 — 균열 ${Math.floor(f * 100)}%`, col: '#e6c8ff', edge: '#a66cff', frac: f };
}

// --- 쓰러지면: 마지막으로 들른 거점에서 다시 일어남 (골드 일부를 잃음) ---
function respawn() {
  if (state !== 'dead') return;
  if (assault) endAssault(false, '쓰러져서 거점 습격이 끝났다'); // 안전막 복구
  const p = player, inRift = !!rift, h = inRift ? null : hubs[lastHub] || hubs[0], lost = inRift ? 0 : Math.round(p.gold * DEATH_GOLD);
  p.gold -= lost; p.hp = p.maxhp; p.stamina = staminaMax(); p.exhausted = false; p.deathT = 0; p.stagger = 0;
  p.fx = { poison: 0, burn: 0, shock: 0, regen: 0, adren: 0, immP: 0, immS: 0, curse: 0 };
  p.sk = {}; p.inv = 2; // 일어난 직후 잠깐 무적
  bullets = []; eshots = []; grenades = []; pillars = []; waves = []; wells = []; hazards = []; areas = areas.filter(a => a.safe);
  for (const e of enemies) { e.aggro = false; e.burst = 0; } // 쫓던 적은 놓침
  for (const s of survivors) if (s.state === 'follow') s.state = 'wait'; // 동행하던 생존자는 그 자리에서 기다림
  if (inRift) { hurtFlash = 0; leaveRift('균열에서 쓰러졌다 — 균열이 닫히고 거점으로 돌아왔다 (골드는 잃지 않음)'); return; }
  placePlayer(h.pad.i + 0.5, h.pad.j + 1.5); p.onPad = false; state = 'play'; hurtFlash = 0;
  addFx('tfog', 'abcdefghij', p.x, p.y, 0, 0.6, 1); Snd.play('exit');
  msg(`쓰러졌다 — ${h.name}에서 다시 일어났다 (골드 -${lost})`, '#f99');
  trackRegion();
}
// 밝힌 지도 저장: 칸마다 1비트
function packSeen() {
  let s = '';
  for (let k = 0; k < mapSeen.length; k += 8) { let b = 0; for (let m = 0; m < 8; m++) if (mapSeen[k + m]) b |= 1 << m; s += String.fromCharCode(b); }
  return btoa(s);
}
function unpackSeen(str) {
  try {
    const s = atob(str);
    for (let n = 0; n < s.length; n++) { const b = s.charCodeAt(n); for (let m = 0; m < 8; m++) { const k = n * 8 + m; if (b & (1 << m) && k < mapSeen.length) revealTile(k); } }
  } catch (e) { /* 깨진 기록은 무시 */ }
}
// 패드: 거점의 순간이동 패드(파랑), 탈출정(잠김 빨강 / 가동 초록)
function drawPads() {
  for (const pd of pads) {
    const x = PX(pd.i, pd.j), y = PY(pd.i, pd.j);
    if (x < -80 || x > W + 80 || y < -60 || y > VH + 80) continue;
    const rf = pd.kind === 'rift' || pd.kind === 'riftExit', pulse = 0.5 + 0.5 * Math.sin(gtime * 4), col = pd.kind === 'escape' ? (escape ? '90,255,140' : '255,70,50') : rf ? '200,120,255' : '110,200,255';
    ctx.strokeStyle = `rgba(${col},${0.5 + pulse * 0.5})`; ctx.lineWidth = 2; diamond(x, y); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = `rgb(${col})`; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pd.kind === 'escape' ? (escape ? 'ESCAPE' : 'LOCKED') : rf ? 'EXIT' : 'WARP', x, y + TH / 2 + 4);
  }
}

// ===== 게임 상태 =====
let state = 'title', level = 1, player, difficulty = 'normal';
let enemies = [], bullets = [], eshots = [], grenades = [], areas = [], parts = [], decals = [], pickups = [], barrels = [], texts = [], flashes = [], beams = [];
let corpses = [], fxs = []; // 쓰러진 몬스터(사망 애니메이션 후 바닥에 남음), 스프라이트 이펙트
let cam = { x: 0, y: 0 }, shake = 0, shx = 0, shy = 0, msgs = [], kills = 0, hurtFlash = 0, gtime = 0;
let flow = new Int16Array(MW * MH), flowTile = -1;
let keysHeld = new Set(); // 이번 구역에서 주운 키카드 색
let hitFlash = 0, hurtDirs = [], hitStop = 0; // 피격: 붉은 번쩍임, 맞은 방향 표시 { a, t }, 큰 공격 순간 멈춤(초)
let escape = null; // 마지막 구역 자폭 카운트다운 { t, alarm, boom, bx, by }
let crateHp = new Map(), crateHitT = new Map(); // 상자 칸 → 남은 체력, 맞아서 흔들리는 끝 시각

const PX = (x, y) => (x - y) * (TW / 2) - cam.x + W / 2 + shx;
const PY = (x, y) => (x + y) * (TH / 2) - cam.y + VH / 2 + shy;
function screenToWorld(sx, sy) {
  const a = (sx - W / 2 - shx + cam.x) / (TW / 2), b = (sy - VH / 2 - shy + cam.y) / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

function newPlayer() {
  return {
    x: 0, y: 0, r: 0.3, hp: 230, maxhp: 230, armor: 0, aim: 0,
    equip: [makeWeapon('knife'), makeWeapon('revolver'), null, null], slot: 1, bag: [], // 무기 슬롯 (어떤 무기든, NSLOT칸 중 열린 칸만) + 가방
    up: { hp: 0, stamina: 0, bag: 0, load: 0, ammo: 0 }, // 기지 신체 개조 단계
    ammo: { pistol: 36, shell: 0, rifle: 0, belt: 0, cell: 0, rocket: 0 },
    charging: 0, // 분쇄포처럼 모았다가 쏘는 무기의 남은 충전 시간
    clv: 1, xp: 0, pts: 0, perks: {}, // 캐릭터 레벨, 경험치, 남은 특성 점수, 특성별 단계
    gear: { head: null, body: makeArmor('vest'), legs: null }, parts: 0, // 방어구 (머리·몸·다리), 분해로 모은 부품
    shells: [makeShell('shock'), null, null, null], attr: { str: 0, agi: 0, tec: 0, psi: 0 }, apts: 0, // 스킬 칸 Z X V B의 쉘, 투자한 능력치, 남은 능력치 점수
    scd: {}, sk: {}, inv: 0, // 스킬별 남은 대기시간, 지속 중인 스킬 효과, 무적 시간 (순간 이동·돌진)
    cool: 0, reload: 0, reloadMax: 1, spin: 0,
    gren: { frag: 3, gas: 1, shock: 1, fire: 0, cryo: 0 }, gsel: 'frag', gcool: 0,
    items: { medS: 2, medM: 1, medL: 0, nano: 0, antidote: 1, insul: 0, armor: 0, adren: 0 },
    gold: 0, gemBag: emptyPouch(), // 보석 주머니: 종류별 [조각난, 보통, 완벽한] 개수 (가방 칸을 차지하지 않음)
    fx: { poison: 0, burn: 0, shock: 0, regen: 0, adren: 0, immP: 0, immS: 0, curse: 0 }, // curse: 저주하는 정예의 저주 (방어 절반)
    stamina: STAMINA_MAX, staminaDelay: 0, exhausted: false, sprinting: false, staminaBarA: 0,
    dash: 0, dashCd: 0, ddx: 0, ddy: 0, kx: 0, ky: 0, walk: 0, moving: false, swing: 0, swingMax: 0.18,
    fireT: 0, painT: 0, deathT: 0, // 스프라이트 동작: 사격, 피격, 사망 애니메이션 시간
    hitT: 0, stagger: 0, // 피격 시 붉게 번쩍임, 큰 공격에 맞은 경직
    look: 0, // 시선·손전등 방향 (조준을 부드럽게 따라옴)
  };
}
const NCAT = CAT_NAMES.length; // 무기 분류 수
const NSLOT = WEAPON_SLOTS.max; // 무기 슬롯 수 (열린 칸은 slotsOpen)
const slotsOpen = () => Math.min(NSLOT, WEAPON_SLOTS.base + ((flags && flags.armory) || []).length); // 처음 2칸 + 해제한 무기고마다 한 칸
const allWeapons = () => [...player.equip.filter(Boolean), ...player.bag];
const load = () => allWeapons().reduce((s, w) => s + w.s.weight, 0) + GEAR_KEYS.reduce((s, g) => s + (player.gear[g] ? player.gear[g].s.weight : 0), 0); // 가방의 쉘·방어구도
// 기지 신체 개조로 늘어나는 한도들
const staminaMax = () => STAMINA_MAX + 20 * player.up.stamina + gearV('stam');
const bagH = () => BAG_H + player.up.bag;
const maxLoad = () => MAX_LOAD + 5 * player.up.load;
const ammoMax = a => Math.round(AMMO[a].max * (1 + 0.25 * player.up.ammo));
function applyUpgrades(p) { p.maxhp = 230 + 25 * p.up.hp + (p.perks.hp || 0) * PERKS.hp.per + gearV('hp', undefined, p); p.hp = Math.min(p.hp, p.maxhp); } // 방어구 체력 옵션 포함
function useStamina(n) { player.stamina = Math.max(0, player.stamina - n * (1 - perkV('stamina') * 2 / 3)); player.staminaDelay = STAMINA_REGEN_DELAY; }

// ===== 캐릭터 성장: 경험치 → 레벨 → 특성 점수 =====
const perkV = k => (player.perks[k] || 0) * PERKS[k].per; // 특성이 지금 주는 수치
const xpNeed = lv => XP_NEXT[0] + XP_NEXT[1] * lv;          // 이 레벨에서 다음 레벨까지 필요한 경험치
const PERK_ORDER = PERK_TREES.map((_, t) => Object.keys(PERKS).filter(k => PERKS[k].tree === t));
function xpFor(e) {
  if (e.minion || e.parent || e.small || e.raised) return 0; // 소환·산란·분열·되살아난 적은 경험치 없음 (무한 사냥 방지)
  if (e.d.boss) return e.d.xp || (e.lv >= CAMPAIGN.length ? 800 : 400); // 구역 보스는 구역에 맞춘 경험치
  return Math.round((e.d.cost || 1) * XP_PER_COST * (1 + 0.15 * (e.lv - 1)) * (e.elite ? 12 : 1)); // 정예는 예전만큼 (일반 적이 많아져 한 마리당 경험치를 줄였으므로)
}
function gainXp(n) {
  const p = player;
  if (n <= 0) return;
  n = Math.round(n * (1 + gearV('xp'))); // 세트: 경험치 +
  p.xp += n;
  while (p.xp >= xpNeed(p.clv)) { p.xp -= xpNeed(p.clv); p.clv++; p.pts++; p.apts += ATTR_PER_LEVEL; levelUpFx(); }
  codexStat('lv', p.clv);
}
function levelUpFx() {
  const p = player;
  msg(`레벨 업! Lv ${p.clv} — 특성 1점 · 능력치 ${ATTR_PER_LEVEL}점 ([K] 성장 창)`, '#ffe08a'); Snd.play('levelUp'); tip('levelup');
  addText(p.x, p.y, 'LEVEL UP', '#ffe08a', 60);
  flashes.push({ x: p.x, y: p.y, r: 420, t: 0.5, max: 0.5, col: '255,220,120' });
  for (let k = 0; k < 40; k++) parts.push({ x: p.x + rnd(-0.4, 0.4), y: p.y + rnd(-0.4, 0.4), z: rnd(0, 10), vx: 0, vy: 0, vz: rnd(60, 160), g: 0, life: rnd(0.6, 1.1), max: 1.1, col: pick(['#ffe08a', '#fff2c0', '#ffc850']), size: 3, glow: true });
}
const staminaCol = () => player.exhausted ? (Math.sin(gtime * 10) > 0 ? '#e64' : '#833') : '#cd4';

function msg(t, col = '#cfe8c8') { const same = msgs.find(m => m.t === t); if (same) { same.life = 4; return; } msgs.unshift({ t, col, life: 4 }); if (msgs.length > 6) msgs.pop(); }
function addText(x, y, t, col, z = 30) { texts.push({ x, y, z, t: String(t), col, life: 0.8 }); }

// ===== 레벨 구성 =====
function randomFloorIn(r, rad = 0.35) {
  for (let k = 0; k < 60; k++) {
    const x = r.x + rnd(0.5, r.w - 0.5), y = r.y + rnd(0.5, r.h - 0.5);
    if (!collides(x, y, rad, false)) return { x, y };
  }
  return { x: r.cx + 0.5, y: r.cy + 0.5 };
}
// 이 구역에 나오는 일반 적과 가중치 (보스·소환물 제외)
function enemyPool(lv = level) {
  const w = {};
  for (const k in ENEMIES) if (ENEMIES[k].from && ENEMIES[k].from <= lv) w[k] = ENEMIES[k].w;
  return w;
}
// 정예로 만들기: 특성 n개 (겹치지 않게) — 체력·피해 증가, 이름 앞에 특성
// 그 적에게 맞는 특성만: 브루더는 분열하지 않음 (크롤러가 너무 불어남), 난사는 원거리 적만, 방패·순간이동은 움직이는 적만 (이미 그런 적 제외)
const ELITE_ONLY = { split: e => !e.d.spawn, multi: e => !!(e.d.ranged || e.d.lob), shield: e => !e.d.shield && !e.d.fixed, blink: e => !e.d.blink && !e.d.fixed };
function makeElite(e, n, fixed) { // fixed: 정해진 특성 (고유 정예)
  const pool = Object.keys(ELITE_AFFIXES).filter(k => !ELITE_ONLY[k] || ELITE_ONLY[k](e));
  e.elite = fixed ? fixed.slice() : [];
  while (!fixed && e.elite.length < n && pool.length) e.elite.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  e.hp = e.maxhp = e.maxhp * ELITE.hp; e.dmg *= ELITE.dmg;
  if (e.elite.includes('fast')) { e.fast = 1.45; e.atkMul = 0.7; }
  if (e.elite.includes('iron')) e.dr = 0.55;
  if (e.elite.includes('shield')) e.shield = ELITE_FX.shield; // 방패를 든: 방패 해병과 같은 정면 방패
  if (e.elite.includes('multi')) e.multi = true;              // 난사하는: 원거리 탄이 세 갈래로
  e.name = `${e.elite.map(k => ELITE_AFFIXES[k].name).join(' ')} ${e.d.name}`;
  return e;
}
// 방 하나를 위협 예산만큼 적으로 채움: 가중치대로 뽑아 예산이 바닥날 때까지 (마지막 한 마리는 조금 넘어도 됨, 최대 ROOM_MAX마리)
// 무거운 적(위협도 5 이상)은 방마다 HEAVY_MAX까지만, 그다음은 가벼운 적으로. 서로 겹치지 않게 흩어 놓음
function fillRoom(r, budget, pool, lv = level) {
  const light = Object.fromEntries(Object.entries(pool).filter(([k]) => ENEMIES[k].cost < 5)), placed = [];
  let heavy = HEAVY_MAX[0] + Math.floor(lv / HEAVY_MAX[1]);
  const count = {};
  for (let n = 0; n < ROOM_MAX && budget > 0.3; n++) {
    let type = weighted(pool);
    if (ENEMIES[type].cost >= 5 && heavy-- <= 0) type = weighted(light);
    if ((count[type] || 0) >= (ENEMIES[type].roomMax || ROOM_MAX)) continue; // 방마다 수가 정해진 적 (감시자)
    count[type] = (count[type] || 0) + 1;
    const rad = ENEMIES[type].r;
    let p = randomFloorIn(r, rad);
    for (let k = 0; k < 8 && placed.some(q => Math.hypot(q.x - p.x, q.y - p.y) < rad + q.r + 0.1); k++) p = randomFloorIn(r, rad);
    spawnEnemy(type, p.x, p.y, lv); placed.push({ x: p.x, y: p.y, r: rad }); budget -= ENEMIES[type].cost;
  }
}
function spawnEnemy(type, x, y, lv) { const e = makeEnemy(type, x, y, lv); if (e.d.ceiling) e.ceil = true; enemies.push(e); return e; } // 매복자는 천장에 붙은 채로
const hiddenE = e => !!(e.ceil || e.under || e.riseT > 0); // 천장의 매복자·땅속의 굴착자: 보이지 않고 맞지 않음 (자동 조준·폭발·근접 모두)
function makeEnemy(type, x, y, lv = level) { // lv: 강함의 기준 구역
  const d = ENEMIES[type], m = (1 + 0.18 * (lv - 1)) * DIFFICULTY[difficulty].hp * (rift ? rift.T.hp : 1); // 차원 균열: 단계 배율
  return {
    type, d, lv, x, y, r: d.r, hp: d.hp * m, maxhp: d.hp * m, dmg: d.dmg * (1 + 0.1 * (lv - 1)), fly: !!d.fly,
    aggro: false, acd: 0, rcd: rnd(0.5, 2), face: rnd(0, 6.28), anim: rnd(0, 10),
    stun: 0, freeze: 0, slow: 0, burn: 0, poison: 0, flash: 0, kx: 0, ky: 0, strafe: Math.random() < 0.5 ? 1 : -1, wander: 0, wx: 0, wy: 0,
    atkT: 0, painT: 0, moving: false, // 스프라이트 동작: 공격, 피격, 걷기
  };
}
function addPickup(x, y, kind, id, amount = 1) { pickups.push({ x, y, kind, id, amount, bob: rnd(0, 6) }); }
function randomAmmoType() {
  const owned = [...new Set(allWeapons().map(w => w.s.ammo).filter(Boolean))];
  return Math.random() < 0.7 && owned.length ? pick(owned) : pick(Object.keys(AMMO).filter(k => (AMMO[k].from || 1) <= level)); // 셀·로켓은 후반부터
}
// ===== 충돌 / 이동 =====
function solidFor(x, y, fly) {
  const i = Math.floor(x), j = Math.floor(y), t = tileAt(i, j);
  if (t === T.DOOR) return doorShut(i, j);
  return fly ? isWallT(t) : !walkable(t);
}
function collides(x, y, r, fly) {
  if (r <= 0.5) return solidFor(x - r, y - r, fly) || solidFor(x + r, y - r, fly) || solidFor(x - r, y + r, fly) || solidFor(x + r, y + r, fly);
  const n = Math.ceil(2 * r / 0.9); // 큰 몸집: 네 모서리만 보면 한 칸짜리 벽 끝이 몸 가운데에 낌 — 0.9칸 간격으로 몸 전체를 봄
  for (let a = 0; a <= n; a++) for (let b = 0; b <= n; b++) if (solidFor(x - r + 2 * r * a / n, y - r + 2 * r * b / n, fly)) return true;
  return false;
}
function moveEntity(e, dx, dy) {
  const out = !!e.d, free = e.r > 0.5 && collides(e.x, e.y, e.r, e.fly); // 몬스터: 보급 거점(안전 지대) 안으로는 못 들어감. 이미 벽에 낀 큰 몸집은 빠져나오게
  if ((free || !collides(e.x + dx, e.y, e.r, e.fly)) && !(out && safeAt(e.x + dx, e.y))) e.x += dx;
  if ((free || !collides(e.x, e.y + dy, e.r, e.fly)) && !(out && safeAt(e.x, e.y + dy))) e.y += dy;
}
// 안전 지대 안에 생겨난 몬스터(분열·산란 등)는 가장 가까운 바깥 칸으로
function evict(e) {
  const k0 = Math.floor(e.y) * MW + Math.floor(e.x), seen = new Set([k0]), q = [k0];
  for (let h = 0; h < q.length; h++) {
    const k = q[h];
    if (!safeMap[k] && walkable(tiles[k])) { e.x = k % MW + 0.5; e.y = ((k / MW) | 0) + 0.5; return; }
    for (const [dx, dy] of DIR4) { const nk = k + dy * MW + dx; if (!seen.has(nk) && walkable(tiles[nk])) { seen.add(nk); q.push(nk); } }
  }
}
// --- 플레이어가 안전 지대에 들어가면 쫓던 적은 원래 자리로: 쫓는 동안 지나온 길(trail)을 남기고, 돌아갈 때 거꾸로 따라감 ---
function trailMark(e) {
  const t = e.trail || (e.trail = []), L = t[t.length - 1];
  if (L && Math.abs(L[0] - e.x) + Math.abs(L[1] - e.y) < 0.8) return;
  t.push([e.x, e.y]);
  if (t.length > 600) e.trail = t.filter((_, k) => k === 0 || k % 2 === 1); // 아주 길면 점을 반으로 (처음 자리는 남김)
}
// 돌아갈 방향 (끝까지 왔으면 null). 다음 점에 3초 넘게 못 가면: 플레이어 눈에 안 띄면 바로 제자리로, 보이면 그 점을 건너뜀
function homeDir(e, dt) {
  const t = e.trail;
  while (t && t.length) {
    const [tx, ty] = t[t.length - 1], dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 0.35) { t.pop(); e.homeT = 0; continue; }
    if ((e.homeT = (e.homeT || 0) + dt) > 3) {
      e.homeT = 0;
      if (!canSee(e.x, e.y)) { goHome(e); return null; }
      t.pop(); continue;
    }
    return [dx / d, dy / d];
  }
  e.homing = false; return null;
}
function goHome(e) { const h = e.trail && e.trail[0]; if (h) { e.x = h[0]; e.y = h[1]; } e.trail = []; e.homing = false; e.homeT = 0; }
function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.3);
  for (let k = 1; k < n; k++) { const t = k / n; if (blocksShot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
  return true;
}
// 화면에서 보이는 방향 각도 (아이소메트릭 왜곡 보정)
const screenAng = (dx, dy) => Math.atan2((dx + dy) * 0.5, dx - dy);
// 조준 방향 부채꼴 안에서 사거리·시야가 닿는 가장 가까운 적
function findTarget(range) {
  const p = player, aimA = screenAng(Math.cos(p.aim), Math.sin(p.aim));
  let best = null, bd = range;
  for (const e of enemies) {
    if (e.dead || hiddenE(e) || (e.leapT > 0 && e.leapKind === 'dodge') || (ghost(e) && Math.hypot(e.x - p.x, e.y - p.y) > 2.5)) continue; // 옆으로 피하는 중인 적, 드러나지 않은 그림자 추적자는 자동 조준이 놓침
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d >= bd || Math.abs(angDiff(screenAng(dx, dy), aimA)) > AUTO_AIM_CONE || !canSee(e.x, e.y)) continue;
    if (!los(p.x, p.y, e.x, e.y)) continue;
    best = e; bd = d;
  }
  return best;
}
function updateFlow() {
  const tx = Math.floor(player.x), ty = Math.floor(player.y), k0 = ty * MW + tx;
  if (k0 === flowTile) return;
  flowTile = k0; flow.fill(-1);
  const q = [k0]; flow[k0] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % MW, y = (k / MW) | 0;
    if (flow[k] >= 64) continue; // 플레이어에게서 64걸음까지만 (더 먼 적은 쉬거나 곧장 다가옴)
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const nk = ny * MW + nx;
      if (flow[nk] >= 0 || !walkable(tiles[nk]) || lockedAt(nk)) continue;
      flow[nk] = flow[k] + 1; q.push(nk);
    }
  }
}
const flowAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? -1 : flow[y * MW + x];
function flowStep(e) {
  const tx = Math.floor(e.x), ty = Math.floor(e.y);
  let best = flowAt(tx, ty); if (best < 0) return null;
  let bx = -1, by = -1;
  for (const [dx, dy] of DIR8) {
    const v = flowAt(tx + dx, ty + dy);
    if (v < 0) continue;
    if (dx && dy && (flowAt(tx + dx, ty) < 0 || flowAt(tx, ty + dy) < 0)) continue;
    if (v < best) { best = v; bx = tx + dx; by = ty + dy; }
  }
  return bx < 0 ? null : [bx + 0.5, by + 0.5];
}

// ===== 파티클 =====
function spark(x, y, n, col = '#ffd27a', spd = 4) {
  for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), s = rnd(1, spd); parts.push({ x, y, z: rnd(8, 24), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(20, 120), g: 300, life: rnd(0.15, 0.4), max: 0.4, col, size: 2 }); }
}
function blood(x, y, n, col) {
  for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), s = rnd(0.5, 3); parts.push({ x, y, z: rnd(10, 22), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(10, 90), g: 300, life: rnd(0.3, 0.7), max: 0.7, col, size: 3 }); }
}
function smoke(x, y, n, col = '90,90,90', spd = 1) {
  for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), s = rnd(0.2, spd); parts.push({ x, y, z: rnd(5, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(10, 40), g: -10, life: rnd(0.6, 1.4), max: 1.4, col: `rgba(${col},`, size: rnd(6, 14), smoke: true }); }
}
function fireBurst(x, y, n, spd = 2) {
  for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), s = rnd(0.3, spd); parts.push({ x, y, z: rnd(2, 14), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(30, 90), g: -20, life: rnd(0.25, 0.6), max: 0.6, col: pick(['#ffb040', '#ff7020', '#ffe080']), size: rnd(3, 6), glow: true }); }
}
// 스프라이트 이펙트: pre 스프라이트의 frames 글자들을 dur초 동안 재생
function addFx(pre, frames, x, y, z, dur, scale = 1, alpha = 1) { fxs.push({ pre, frames, x, y, z, t: 0, dur, scale, alpha }); }
function shotImpact(s) {
  if (s.type === 'orb') { addFx('bal2', 'cde', s.x, s.y, 14, 0.3, 0.9); return; } // 아르고스의 에너지 구체
  if (s.type === 'bullet') { addFx('puff', 'abcd', s.x, s.y, 20, 0.25, 0.7); return; }
  if (s.type === 'fireball') { addFx('misl', 'bcd', s.x, s.y, 12, 0.35, 0.8); fireBurst(s.x, s.y, 6, 1.5); Snd.play('fireHit', s.x, s.y); return; }
  if (s.type === 'ball') { addFx('bal7', 'cde', s.x, s.y, 16, 0.35, 1.3); Snd.play('fireHit', s.x, s.y); return; } // 브루트의 녹색 구체
  if (s.type !== 'rocket') { addFx(s.type === 'acid' ? 'bal7' : 'plse', s.type === 'acid' ? 'cde' : 'abcde', s.x, s.y, 14, 0.3, 0.8); return; }
  addFx('misl', 'bcd', s.x, s.y, 10, 0.4, 1.3); smoke(s.x, s.y, 8, '70,60,50', 1.5);
  flashes.push({ x: s.x, y: s.y, r: 300, t: 0.3, max: 0.3, col: '255,150,60' });
  shake = Math.max(shake, 6); Snd.play('explode', s.x, s.y);
  const d = Math.hypot(player.x - s.x, player.y - s.y);
  if (d < 1.8) hurtPlayer(s.dmg * (1 - d / 2.4), s.x, s.y);
  for (const v of survivors) { const dv = Math.hypot(v.x - s.x, v.y - s.y); if (dv < 1.8) hurtSurvivor(v, s.dmg * (1 - dv / 2.4), s.x, s.y); }
  for (const t of devices()) { const dd = Math.hypot(t.x - s.x, t.y - s.y); if (dd < 1.8) hurtDevice(t, s.dmg * (1 - dd / 2.4), s.x, s.y); }
}
const ATK_ANIM = 0.4; // 몬스터 공격 동작 시간(초)
function decal(x, y, r, col) { addDecal({ x, y, r, col, rot: rnd(0, 3) }); } // 둥근 자국 (그을음·서리·부스러기)
function addDecal(d) { decals.push(d); if (decals.length > 400) decals.shift(); }
// 핏자국 (체액): 핏자국 그림(splat_a~e, AlejandroHaibi CC0)을 그 색으로 칠해 바닥에 눕힘 — 큰 자국 하나 + 둘레에 작은 자국 1~2개 (more=false면 작은 자국 하나)
function bloodSplat(x, y, r, col, more = true) {
  const one = (x, y, r, keys) => addDecal({ x, y, r, col, rot: rnd(0, 6.28), flip: Math.random() < 0.5, splat: pick(keys) });
  if (!more) { one(x, y, r, ['splat_b', 'splat_d', 'splat_e']); return; }
  one(x, y, r, ['splat_a', 'splat_b', 'splat_c']);
  for (let k = irnd(1, 2); k > 0; k--) { const a = rnd(0, 6.28), dd = r * rnd(0.6, 1.1); one(x + Math.cos(a) * dd, y + Math.sin(a) * dd, r * rnd(0.35, 0.55), ['splat_d', 'splat_e']); }
}

// ===== 전투 =====
// 플레이어 피격 (난이도 배율 적용). (sx, sy): 공격이 온 곳 — 맞은 방향 표시와 밀려남에 씀
function hurtPlayer(dmg, sx, sy) {
  const p = player;
  if (p.dash > 0 || p.inv > 0 || state !== 'play' || dmg <= 0 || inHub()) return false; // 안전 지대에서는 다치지 않음
  dmg *= DIFFICULTY[difficulty].dmg * (rift ? rift.T.dmg : 1) * (buff('berserk') ? 1 - SKILLS.berserk.guard : 1) * (buff('iron') ? 1 - SKILLS.iron.guard : 1) // 균열 단계, 광폭화·강철 피부 중에는 덜 아픔
    * (1 - defCut(gearDef() * (p.fx.curse > 0 ? ELITE_FX.curse.def : 1))) * (1 - resV('str')); // 방어구 (저주 중이면 절반), 근력 공명
  const ab = Math.min(p.armor, dmg * 0.6);
  p.armor -= ab; const real = dmg - ab; p.hp -= real;
  hurtFlash = Math.min(1, hurtFlash + real / 35); hitFlash = 1; p.painT = 0.2; p.hitT = 0.16;
  shake = Math.max(shake, Math.min(14, 3 + real * 0.25));
  addText(p.x, p.y, `-${Math.round(real)}`, '#f66', 44);
  blood(p.x, p.y, Math.min(14, 3 + Math.floor(real / 4)), '#a01414'); // 피 튐
  addFx('blud', 'cba', p.x + rnd(-0.15, 0.15), p.y + rnd(-0.15, 0.15), rnd(22, 34), 0.35, 2.2);
  if (sx !== undefined) {
    const a = Math.atan2(sy - p.y, sx - p.x);
    hurtDirs.push({ a, t: 1 }); if (hurtDirs.length > 6) hurtDirs.shift();
    if (real >= Math.max(18, p.maxhp * 0.08)) { // 큰 공격: 짧은 경직 + 반대로 밀려남 + 순간 멈춤
      p.stagger = 0.25; p.kx -= Math.cos(a) * 3; p.ky -= Math.sin(a) * 3; hitStop = 0.06;
      bloodSplat(p.x + rnd(-0.3, 0.3), p.y + rnd(-0.3, 0.3), rnd(0.22, 0.34), 'rgba(110,8,8,0.85)', false);
      Snd.play('bigHurt');
    }
  }
  Snd.play('hurt');
  if (p.hp <= 0 && !rebirth()) { p.hp = 0; die(); }
  return true;
}
// 불사조 (보석 조합): 죽을 피해를 받으면 체력 50%로 되살아남 — 그 뒤 정해진 시간 동안은 다시 안 됨
function rebirth() {
  const p = player, cd = gearV('phoenix');
  if (!cd || p.phoenixT > 0 || state !== 'play') return false;
  p.hp = p.maxhp * 0.5; p.phoenixT = cd; p.inv = Math.max(p.inv, 2); p.fx.poison = p.fx.burn = 0;
  msg(`불사조 — 다시 일어섰다! (${cd}초 뒤 다시)`, RW_COLOR); Snd.play('unique');
  flashes.push({ x: p.x, y: p.y, r: 520, t: 0.6, max: 0.6, col: '255,170,80' }); fireBurst(p.x, p.y, 50, 5); shake = Math.max(shake, 8);
  return true;
}
function hitEnemy(e, dmg, kx = 0, ky = 0, silent = false, crit = false, guard = false) { // guard: 방패에 막힘 (회색 숫자 + 방패의 푸른 불꽃)
  if (e.dead || hiddenE(e)) return; // 천장·땅속: 맞지 않음
  dmg *= e.dr || 1; // 강철의 정예: 받는 피해 감소
  if (e.wardT > gtime && !silent && e.wardBy && !e.wardBy.dead) { dmg *= 1 - e.wardBy.d.ward.cut; if (Math.random() < 0.5) spark(e.x, e.y, 3, '#7df', 2.5); } // 수호 드론의 보호막 (지속 피해는 그대로)
  if (e.d.vuln && e.stun > 0) dmg *= e.d.vuln; // 파쇄 짐승: 벽에 박혀 기절한 동안 더 아픔
  const raw = dmg;
  if (e.d.armor && !silent && !meleeNow) dmg = Math.max(raw * 0.2, raw - e.d.armor); // 장갑: 직접 맞은 한 발마다 덜 받음 (화상·중독 같은 지속 피해는 그대로, 근접은 무시)
  const blocked = guard || dmg < raw * 0.5; // 장갑·방패에 거의 막힘 → 회색 숫자 + 불꽃
  const kb = e.d.fixed ? 0 : e.d.boss ? 0.15 : e.d.heavy ? 0.25 : 1;
  e.hp -= dmg; e.flash = 0.08; e.kx += kx * kb; e.ky += ky * kb;
  if (!e.aggro) { aggro(e); alertNear(e.x, e.y, 5); }
  if (e.d.blink) e.reveal = Math.max(e.reveal || 0, e.d.blink.reveal); // 그림자 추적자: 맞으면 잠시 드러남 (화상·중독도)
  if (!silent) {
    if (guard) { spark(e.x + Math.cos(e.face) * (e.r + 0.3), e.y + Math.sin(e.face) * (e.r + 0.3), 5, '#9cf', 3); Snd.play('armorHit', e.x, e.y); }
    else if (blocked) { spark(e.x, e.y, 3, '#dde', 2.5); Snd.play('armorHit', e.x, e.y); } else blood(e.x, e.y, 3, e.d.blood);
    if (settings.dmgNums) addText(e.x + rnd(-.2, .2), e.y, crit ? `${Math.round(dmg)}!` : Math.round(dmg), blocked ? '#9aa' : crit ? '#ff7a40' : '#ffe9a0'); // 설정의 피해 숫자
    Snd.play('hit');
    if (Math.random() < (e.d.boss ? 0.08 : 0.35) && e.hp > 0) { e.painT = 0.15; Snd.mon(e, 'pain'); }
  }
  if (!silent && e.elite && e.elite.includes('spark') && !(e.sparkCd > 0)) eliteSpark(e); // 전기를 품은: 맞으면 전기 불꽃
  if (e.hp <= 0) killEnemy(e);
}
// 전기를 품은 정예: 맞을 때마다 (대기시간마다) 전기 불꽃 n개가 사방으로 — 맞으면 감전
function eliteSpark(e) {
  const S = ELITE_FX.spark; e.sparkCd = S.cd;
  for (let k = 0; k < S.n; k++) { const a = rnd(0, 6.28); eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * S.speed, vy: Math.sin(a) * S.speed, type: 'shock', dmg: S.dmg * (1 + 0.1 * (e.lv - 1)), life: S.life }); }
  spark(e.x, e.y, 6, '#9ee8ff', 3); Snd.play('zap', e.x, e.y);
}
// 무기 명중: 치명타·속성 옵션·고유 효과·보석 조합 적용 (force: 반드시 치명타). 방패에 막혔으면 'block'
function weaponHit(e, s, dmg, kx, ky, force = false) {
  if (s.type !== 'skill') dmg *= 1 + gearV('gdmg'); // 세트: 모든 무기 피해
  const skill = s.type === 'skill', D = !skill && buff('deadeye'), cc = (s.crit || 0) + perkV('crit') + (D ? D.crit : 0) + (skill ? 0 : gearV('gcrit')), crit = force || (cc > 0 && Math.random() < cc); // 무기 옵션 + 약점 포착 + 집중 사격 + 예언자의 눈
  const SH = shieldOf(e); // 방패 해병·방패를 든 정예: 정면에서 온 직접 공격(탄·근접)은 거의 막힘 — 폭발·스킬은 그대로, 기절·빙결 중에는 방패가 꺼짐
  if (SH && !skill && !s.blast && !(e.stun > 0) && !(e.freeze > 0) && !(e.guardDown > 0)) { // 공격하느라 방패를 내렸으면 그대로 들어감
    const from = kx || ky ? Math.atan2(-ky, -kx) : Math.atan2(player.y - e.y, player.x - e.x);
    if (Math.abs(angDiff(from, e.face)) < SH.arc / 2) {
      const hit = crit ? dmg * 2 : dmg;
      if (e.shieldHp === undefined) e.shieldHp = e.shieldMax = SH.hp * e.maxhp;
      e.shieldHp -= hit * (meleeNow ? MELEE.shield : 1); e.shieldT = 0.2; tip('shielder'); // 막은 피해만큼 방패가 닳음 (근접은 몇 배로)
      hitEnemy(e, hit * (1 - SH.cut), kx * 0.2, ky * 0.2, false, false, true);
      if (e.shieldHp <= 0 && !e.dead) breakShield(e);
      return 'block';
    }
  }
  if (meleeNow && (e.stun > 0 || e.freeze > 0)) dmg *= MELEE.open; // 근접: 기절·빙결한 적에게 무방비 일격
  const RW = s.rw; // 보석 조합: 처형인(빈사의 적에게 더), 역병(죽으면 독가스)
  if (RW && RW.exec && e.hp < e.maxhp * 0.3) dmg *= RW.exec;
  if (RW && RW.plague) e.venom = true;
  const shatter = s.uq === 'frost' && e.freeze > 0; // 영구동토: 얼어 있는 적은 산산조각 (피해 2배, 얼음이 풀림)
  if (shatter) {
    dmg *= 2; e.freeze = 0; Snd.play('cryo', e.x, e.y);
    for (let k = 0; k < 18; k++) { const a = rnd(0, 6.28), v = rnd(1, 4); parts.push({ x: e.x, y: e.y, z: rnd(10, 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(30, 90), g: 260, life: rnd(0.4, 0.8), max: 0.8, col: pick(['#dff', '#bef', '#fff']), size: 3, glow: true }); }
  }
  if (s.uq === 'venom') e.venom = true; // 맹독 살포기: 이 적이 죽으면 독가스 (이번 공격으로 죽어도)
  const ED = (s.eliteDmg || 0) + (skill ? 0 : gearV('elite'));
  if (ED && (e.elite || e.d.boss)) dmg *= 1 + ED; // 다이아몬드·세트: 정예·보스에게 더
  const hp0 = e.hp;
  hitEnemy(e, crit ? dmg * 2 : dmg, kx, ky, false, crit);
  if (RW) rwHit(e, RW, hp0 - Math.max(0, e.hp), dmg);
  if (!e.dead) {
    if (s.uq === 'frost' && !shatter) { e.freeze = Math.max(e.freeze, 1.4 * ccScale(e)); e.slow = Math.max(e.slow, 3); }
    else if (s.uq === 'dragon') e.burn = Math.max(e.burn, 3);
    else if (s.uq === 'venom') e.poison = Math.max(e.poison, 4);
  }
  if (s.elem && !e.dead && Math.random() < s.elem.chance) {
    const t = s.elem.type;
    if (t === 'fire') e.burn = Math.max(e.burn, 3);
    else if (t === 'poison') e.poison = Math.max(e.poison, 4);
    else if (t === 'shock') { e.stun = Math.max(e.stun, 0.6 * ccScale(e)); spark(e.x, e.y, 4, '#9df', 2); }
    else e.slow = Math.max(e.slow, 3);
  }
  if (!skill) { // 세트: 불태움, 연쇄 번개
    const GB = gearV('gburn'), GC = gearV('gchain');
    if (GB && !e.dead && Math.random() < GB) e.burn = Math.max(e.burn, 3);
    if (GC && Math.random() < GC) chainBolt(e, dmg * 0.6, 3);
  }
  const G = s.gemProc; // 보석: 루비 화상 · 사파이어 둔화 · 에메랄드 중독
  if (G && !e.dead) {
    if (G.fire && Math.random() < G.fire) e.burn = Math.max(e.burn, 3);
    if (G.cryo && Math.random() < G.cryo) e.slow = Math.max(e.slow, 3);
    if (G.poison && Math.random() < G.poison) e.poison = Math.max(e.poison, 4);
  }
}
const ccScale = e => e.d.boss ? 0.2 : e.d.heavy ? 0.5 : 1; // 보스는 기절·빙결 시간이 짧음, 철갑 거수는 절반
const ghost = e => !!e.d.blink && !(e.reveal > 0); // 드러나지 않은 그림자 추적자 (거의 투명, 자동 조준·지도에 안 잡힘)
const shieldOf = e => e.shieldBroken ? null : e.shield || e.d.shield; // 정면 방패: 방패 해병, 방패를 든 정예 (부서졌으면 없음)
// 방패 내구도: 처음 막을 때 정함 (최대 체력 x hp — 정예·고유 정예 배율이 붙은 뒤), 막은 공격의 피해만큼 닳음
const shieldDur = e => e.shieldHp === undefined ? 1 : clamp(e.shieldHp / e.shieldMax, 0, 1);
// 방패가 부서짐: 푸른 파편, 잠깐 휘청 — 그 뒤로는 막지 못함
function breakShield(e) {
  e.shieldBroken = true; e.shieldT = 0; e.stun = Math.max(e.stun, 0.6 * ccScale(e));
  const fx = e.x + Math.cos(e.face) * (e.r + 0.3), fy = e.y + Math.sin(e.face) * (e.r + 0.3);
  for (let k = 0; k < 26; k++) { const a = e.face + rnd(-1.3, 1.3), v = rnd(2, 5); parts.push({ x: fx, y: fy, z: rnd(10, 40), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(40, 120), g: 300, life: rnd(0.4, 0.9), max: 0.9, col: pick(['#9cf', '#cdf', '#6af', '#fff']), size: 3, glow: true }); }
  flashes.push({ x: fx, y: fy, r: 260, t: 0.25, max: 0.25, col: '120,180,255' }); shake = Math.max(shake, 4);
  addText(e.x, e.y, '방패 파괴!', '#9cf', 54); Snd.play('shieldBreak', e.x, e.y);
}
// 보석 조합 명중 효과: 불(업화)·중독(역병)·얼림(혹한의 송곳니)·흡혈(피의 계약)·연쇄 번개(뇌신). dealt: 실제로 깎은 체력
function rwHit(e, RW, dealt, dmg) {
  if (!e.dead) {
    if (RW.burn) e.burn = Math.max(e.burn, 3);
    if (RW.plague) e.poison = Math.max(e.poison, 4);
    if (RW.freeze && Math.random() < RW.freeze) { e.freeze = Math.max(e.freeze, 1.2 * ccScale(e)); e.slow = Math.max(e.slow, 3); }
  }
  if (RW.leech && dealt > 0) heal(player, dealt * RW.leech);
  if (RW.chain && Math.random() < RW.chain) chainBolt(e, dmg * 0.6, 3);
}
// 뇌신: 맞은 적에게서 가까운 적으로 번개가 n번 튐 (보이는 5칸 안, 같은 적은 한 번만 — skip: 건너뛸 적, 예: 이미 같이 맞은 적)
function chainBolt(e, dmg, n, skip = []) {
  const hit = [e, ...skip];
  let from = e, jumps = 0;
  for (let k = 0; k < n; k++) {
    let nx = null, nd = 5;
    for (const o of enemies) { if (o.dead || hiddenE(o) || hit.includes(o)) continue; const d = Math.hypot(o.x - from.x, o.y - from.y); if (d < nd && los(from.x, from.y, o.x, o.y)) { nx = o; nd = d; } }
    if (!nx) break;
    beams.push({ x0: from.x, y0: from.y, x1: nx.x, y1: nx.y, t: 0.25, col: '150,200,255' });
    hitEnemy(nx, dmg); if (!nx.dead) nx.stun = Math.max(nx.stun, 0.25 * ccScale(nx));
    hit.push(nx); from = nx; jumps++;
  }
  if (jumps) Snd.play('zap', e.x, e.y);
}
function alertNear(x, y, r) { for (const o of enemies) if (!o.aggro && Math.hypot(o.x - x, o.y - y) < r) aggro(o); }
// 몬스터가 플레이어를 알아챔 (발견 소리)
function aggro(e) { if (!e.aggro && !e.ceil) { e.aggro = true; Snd.mon(e, 'sight'); } } // 천장의 매복자는 떨어질 때 깨어남
function killEnemy(e) {
  e.dead = true; kills++; codexKill(e);
  if (rift && !e.rift) riftKill(e);
  const xp = xpFor(e); // 캐릭터 경험치 (정예·보스는 숫자로 보여줌)
  if (xp && (e.elite || e.d.boss)) addText(e.x, e.y, `+${xp} XP`, '#c9a0ff', 56);
  gainXp(xp);
  if (perkV('leech')) heal(player, perkV('leech')); // 피의 갈증
  const FR = curW().s.rw && curW().s.rw.frenzy; // 광란 (보석 조합): 처치하면 3초 동안 공격속도
  if (FR) { if (!(player.frenzy > 0)) addText(player.x, player.y, '광란!', RW_COLOR, 50); player.frenzy = 3; player.frenzyV = FR; }
  const B = buff('berserk'); // 광폭화: 처치마다 회복, 피의 축제는 지속 +1초 (최대 +10초)
  if (B) { heal(player, B.heal); if (B.ext > 0) { const add = Math.min(1, B.ext); B.ext -= add; B.t += add; B.max = Math.max(B.max, B.t); } }
  if (e.shatter && e.freeze > 0) frostShatter(e); // 영원한 겨울: 얼어 있던 적은 산산조각
  blood(e.x, e.y, 16, e.d.blood); bloodSplat(e.x, e.y, e.r * 1.6 + 0.3, e.d.blood); // 쓰러진 자리의 체액
  if ((!e.d.fixed || e.d.corpse) && !e.voided && !e.d.bomb && !e.d.nocorpse) corpses.push({ x: e.x, y: e.y, type: e.type, face: e.face, t: 0 }); // 오버마인드는 터져 사라짐, 우주로 빨려 나간 적도 남지 않음
  if (e.d.ward) { addFx('misl', 'bcd', e.x, e.y, 30, 0.4, 0.7); spark(e.x, e.y, 14, '#7df', 4); } // 수호 드론: 터지며 사라짐 (보호막도 꺼짐)
  if (e.venom && !e.d.fixed) areas.push({ type: 'gas', x: e.x, y: e.y, r: 1.8, t: 3, max: 3, safe: true }); // 맹독 살포기: 플레이어는 안전한 독가스
  if (e.d.bomb) bombBlast(e, e.d.bomb.early); // 폭주 해골: 쏘아 떨어뜨리면 그 자리에서 약하게 터짐
  for (let k = 0, n = 0; n < (e.d.deathSpawn || 0) && k < 8; k++) { // 브루더: 터지면서 품고 있던 크롤러가 쏟아짐 (벽 쪽은 피해서)
    const a = k * 2.4 + rnd(0, 0.5), x = e.x + Math.cos(a) * 0.6, y = e.y + Math.sin(a) * 0.6;
    if (collides(x, y, ENEMIES[e.d.spawn.type].r, false)) continue;
    spawnEnemy(e.d.spawn.type, x, y).aggro = true; addFx('tfog', 'abcdefghij', x, y, 0, 0.5, 0.6); n++;
  }
  if (corpses.length > 80) corpses.shift();
  Snd.mon(e, 'death');
  if (e.d.nest) nestDeath(e);
  if (e.nestKid || e.raised) return; // 둥지가 낳은·되살아난 몬스터는 아무것도 떨어뜨리지 않음 (무한 사냥 방지)
  if (meleeNow) meleeKill(e); // 근접 처치 보급
  const plain = !e.elite && !e.d.boss, KR = plain ? KILL_REWARD : { gold: 1, item: 1, loot: 1 }; // 적이 많아 일반 적 한 마리당 보상은 줄임 (탄약은 그대로)
  const gold = Math.round(e.d.gold * rnd(0.7, 1.3) * (1 + e.lv * 0.1) * (e.elite ? ELITE.gold : 1) * KR.gold);
  if (gold > 0) addPickup(e.x, e.y, 'gold', 'gold', gold);
  if (e.elite) eliteDeath(e);
  if (e.super) superDeath(e);
  if (e.d.thief) thiefDeath(e);
  const r = Math.random();
  if (r < 0.22) { const a = randomAmmoType(); addPickup(e.x + rnd(-.3, .3), e.y + rnd(-.3, .3), 'ammo', a, AMMO[a].pack); }
  else if (r < 0.22 + 0.08 * KR.item) addPickup(e.x + rnd(-.3, .3), e.y + rnd(-.3, .3), 'item', weighted(ITEM_DROP_WEIGHTS));
  else if (r < 0.22 + 0.12 * KR.item) addPickup(e.x + rnd(-.3, .3), e.y + rnd(-.3, .3), 'gren', pick(Object.keys(GRENADES)));
  if (e.d.boss) {
    for (let k = 0; k < BOSS_DROPS; k++) dropWeapon(e.x + rnd(-0.8, 0.8), e.y + rnd(-0.8, 0.8), (!k && uniqueDrop(UNIQUE_DROP.boss)) || (k === 1 && setDrop(SET_DROP.boss)) || randomLoot(e.d.lootBonus, 0.5));
    dropWeapon(e.x + rnd(-0.8, 0.8), e.y + rnd(-0.8, 0.8), uniqueShellDrop(SHELL_UNIQUE_DROP.boss) || randomLootShell(e.d.lootBonus)); // 스킬 쉘 하나 (상위 등급, 가끔 고유 전설)
    for (let k = 0; k < 2; k++) dropWeapon(e.x + rnd(-0.8, 0.8), e.y + rnd(-0.8, 0.8), randomGem(2)); // 보석 둘
    for (let k = 0; k < 3; k++) addPickup(e.x + rnd(-1, 1), e.y + rnd(-1, 1), 'item', weighted(ITEM_DROP_WEIGHTS));
    addFx('misl', 'bcd', e.x, e.y, 20, 0.6, 2.6); fireBurst(e.x, e.y, 50, 6);
    flashes.push({ x: e.x, y: e.y, r: 700, t: 0.5, max: 0.5, col: '255,160,70' }); shake = Math.max(shake, 18);
    msg(`${e.d.name} 처치!`, '#ffd27a');
    if (e.rift) riftCleared(e); // 균열 수호자: 돌파 (구역 보스 기록·격벽과 무관)
    else if (!flags.bosses.includes(e.lv)) flags.bosses.push(e.lv);
    if (!e.rift && GATES[e.lv] === 'boss') { msg(`봉쇄 격벽이 열린다 — 구역 ${e.lv + 1}(으)로 가는 길`, '#9f9'); Snd.play('unlock'); }
    if (e.d.boss === 'brain') startEscape(e);
  } else if (!e.elite) {
    const u = !e.minion && !e.parent && !e.small && (uniqueDrop(UNIQUE_DROP.kill) || setDrop(SET_DROP.kill)); // 아주 드물게 고유 전설·세트 장비 (소환·산란·분열한 적 제외)
    if (u) dropWeapon(e.x, e.y, u);
    else if (Math.random() < (e.d.loot || 0) * KILL_REWARD.loot) dropWeapon(e.x, e.y, randomLoot(e.d.lootBonus || 0));
    if (!e.minion && !e.parent && !e.small && Math.random() < SHELL_DROP.kill) dropWeapon(e.x, e.y, randomLootShell(e.d.lootBonus || 0)); // 드물게 스킬 쉘
    if (!e.minion && !e.parent && !e.small) { const us = uniqueShellDrop(SHELL_UNIQUE_DROP.kill); if (us) dropWeapon(e.x, e.y, us); } // 아주 드물게 고유 전설 쉘
    if (!e.minion && !e.parent && !e.small && Math.random() < GEM_DROP.kill) dropWeapon(e.x + rnd(-0.3, 0.3), e.y + rnd(-0.3, 0.3), randomGem()); // 가끔 보석
  }
}
// 보물 약탈자 (THIEF): 들키면(보이거나 맞거나 아주 가까우면) 플레이어에게서 길로 멀어지는 쪽으로 달아남 — 막다른 곳이면 옆으로 허둥댐.
// 체력이 drop만큼 깎일 때마다 골드를 흘리고, escape초가 지나면 차원 틈으로 사라짐 (보상 없음)
function thiefThink(e, dt, d, dx, dy, see) {
  const p = player;
  if (e.hpMark === undefined) e.hpMark = e.hp;
  if (e.hp < e.hpMark - e.maxhp * THIEF.drop) { e.hpMark = e.hp; addPickup(e.x + rnd(-0.3, 0.3), e.y + rnd(-0.3, 0.3), 'gold', 'gold', irnd(8, 18) * e.lv); Snd.play('gold', e.x, e.y); }
  if (!e.alert) {
    if (!(e.aggro || (see && d < 12) || d < 3 || e.hp < e.maxhp)) { // 아직 모름: 제자리에서 어슬렁
      if ((e.wander -= dt) <= 0) { e.wander = rnd(1, 3); const a = rnd(0, 6.28), go = Math.random() < 0.5; e.wx = go ? Math.cos(a) : 0; e.wy = go ? Math.sin(a) : 0; }
      if (e.wx || e.wy) { moveEntity(e, e.wx * e.d.spd * 0.3 * dt, e.wy * e.d.spd * 0.3 * dt); e.face = Math.atan2(e.wy, e.wx); e.moving = true; }
      return;
    }
    e.alert = true; e.escapeT = THIEF.escape; e.aggro = true; e.seenMsg = true; Snd.mon(e, 'sight');
    msg(`💰 보물 약탈자 발견 — ${THIEF.escape}초 안에 잡아라!`, '#ffd27a'); tip('thief', 'sthfa1');
  }
  if ((e.escapeT -= dt) <= 0) { thiefEscape(e); return; }
  if (Math.random() < dt * 8) parts.push({ x: e.x + rnd(-0.2, 0.2), y: e.y + rnd(-0.2, 0.2), z: rnd(14, 34), vx: rnd(-0.5, 0.5), vy: rnd(-0.5, 0.5), vz: rnd(10, 50), g: 120, life: rnd(0.4, 0.8), max: 0.8, col: pick(['#ffd27a', '#fff2c0', '#ffc850']), size: 2, glow: true }); // 금빛 반짝임
  updateFleeMap();
  const tx = Math.floor(e.x), ty = Math.floor(e.y), k0 = ty * MW + tx;
  let mvx = 0, mvy = 0;
  if (flow[k0] >= 0) { // 달아나기 지도를 따라 내려감 (구석에 몰리지 않고 문·통로를 지나 먼 곳으로)
    let best = fleeMap[k0], bx = 0, by = 0;
    for (const [ox, oy] of DIR8) {
      const k = k0 + oy * MW + ox;
      if (flow[k] < 0 || (ox && oy && (flowAt(tx + ox, ty) < 0 || flowAt(tx, ty + oy) < 0))) continue;
      if (fleeMap[k] < best - 0.01) { best = fleeMap[k]; bx = ox; by = oy; }
    }
    if (bx || by) { const gx = tx + bx + 0.5 - e.x, gy = ty + by + 0.5 - e.y, l = Math.hypot(gx, gy) || 1; mvx = gx / l; mvy = gy / l; }
    else { if (Math.random() < dt * 1.5) e.strafe *= -1; mvx = -dy / d * e.strafe; mvy = dx / d * e.strafe; } // 더 갈 데가 없으면 옆으로 허둥댐
  } else { mvx = -dx / d; mvy = -dy / d; } // 아주 멀면 곧장 반대쪽으로
  const spd = e.d.spd * (e.slow > 0 ? 0.5 : 1);
  moveEntity(e, mvx * spd * dt, mvy * spd * dt);
  e.face = Math.atan2(mvy, mvx); e.moving = true;
}
// 달아나기 지도 (로그라이크의 '안전 지도'): 플레이어까지 길 거리 x -1.2에서 한 번 더 퍼뜨림 — 내려가기만 하면 막다른 구석 대신 먼 곳으로 빠져나감
let fleeMap = null, fleeKey = -2;
function updateFleeMap() {
  if (fleeKey === flowTile && fleeMap) return; // 플레이어가 같은 칸이면 그대로
  fleeKey = flowTile;
  const N = MW * MH, h = [];
  if (!fleeMap) fleeMap = new Float32Array(N);
  fleeMap.fill(1e9);
  const push = (c, k) => { h.push([c, k]); for (let i = h.length - 1; i > 0;) { const pa = (i - 1) >> 1; if (h[pa][0] <= h[i][0]) break; [h[pa], h[i]] = [h[i], h[pa]]; i = pa; } };
  const pop = () => {
    const top = h[0], last = h.pop();
    if (h.length) { h[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
    return top;
  };
  for (let k = 0; k < N; k++) if (flow[k] >= 0) { fleeMap[k] = -1.2 * flow[k]; push(fleeMap[k], k); }
  while (h.length) {
    const [c, k] = pop();
    if (c > fleeMap[k]) continue;
    for (const [dx, dy] of DIR4) { const nk = k + dy * MW + dx; if (flow[nk] >= 0 && c + 1 < fleeMap[nk]) { fleeMap[nk] = c + 1; push(c + 1, nk); } }
  }
}
// ===== 매복자 · 굴착자 · 수호 드론 =====
// 숨은 동안 (맞지 않음): 매복자는 천장에서 기다리다 플레이어 바로 위로 기어가 그림자를 드리운 뒤 떨어짐, 굴착자는 땅속으로 다가가 흙더미를 흔든 뒤 솟아오름
function hiddenThink(e, dt) {
  const p = player, d = Math.hypot(p.x - e.x, p.y - e.y), safe = inHub() && !contested();
  e.stun = e.freeze = e.burn = e.poison = 0; e.kx = e.ky = 0; e.anim += dt; e.moving = false;
  if (e.ceil) {
    const C = e.d.ceiling;
    if (e.wave || e.minion) { e.ceil = false; aggro(e); return; } // 무리로 몰려오는 매복자는 걸어서 옴
    if (e.dropT > 0) { if ((e.dropT -= dt) <= 0) { e.ceil = false; e.dropT = 0; e.fallT = C.fall; e.z = 150; Snd.mon(e, 'sight'); } return; }
    if (!safe && d < C.drop && los(e.x, e.y, p.x, p.y)) { // 플레이어 바로 위 천장으로 — 여기서부터 warn초 뒤 떨어짐 (그 사이에 비키면 됨)
      if (!collides(p.x, p.y, e.r, false)) { e.x = p.x; e.y = p.y; }
      e.dropT = C.warn; Snd.play('skitter', e.x, e.y); tip('lurker', frontKey(ENEMY_ART.lurker.spr, 'a'));
    } else if (Math.random() < dt * 0.4) parts.push({ x: e.x + rnd(-0.2, 0.2), y: e.y + rnd(-0.2, 0.2), z: 70, vx: 0, vy: 0, vz: -20, g: 300, life: 0.4, max: 0.4, col: '#a5c', size: 2 }); // 천장에서 떨어지는 점액
    return;
  }
  const B = e.d.burrow, dirt = (n, s) => { for (let k = 0; k < n; k++) parts.push({ x: e.x + rnd(-s, s), y: e.y + rnd(-s, s), z: 2, vx: rnd(-1, 1), vy: rnd(-1, 1), vz: rnd(30, 80), g: 300, life: 0.4, max: 0.4, col: pick(['#6b5434', '#8a6d44', '#4a3a24']), size: rnd(2, 4) }); };
  if (e.riseT > 0) { if (Math.random() < dt * 30) dirt(1, 0.45); if ((e.riseT -= dt) <= 0) burrowErupt(e); return; } // 흙더미가 흔들림 → 솟아오름
  e.ut = (e.ut || 0) + dt;
  if (!e.aggro || safe) { e.under = false; e.emergeT = 0.3; e.sink = 1; e.upT = B.up; return; } // 놓치면 그 자리로 올라옴
  if (d < B.near || e.ut > B.max) { e.under = false; e.riseT = B.warn; Snd.play('stomp', e.x, e.y); tip('burrower', frontKey(ENEMY_ART.burrower.spr, 'a')); return; }
  const s = flowStep(e), tx = s ? s[0] : p.x, ty = s ? s[1] : p.y, l = Math.hypot(tx - e.x, ty - e.y) || 1; // 땅속으로 길을 따라 다가옴
  moveEntity(e, (tx - e.x) / l * B.spd * dt, (ty - e.y) / l * B.spd * dt); e.moving = true;
  if (Math.random() < dt * 14) dirt(1, 0.25);
  if ((e.stepT = (e.stepT || 0) - dt) <= 0 && d < 10) { e.stepT = 0.45; Snd.play('skitter', e.x, e.y); }
}
// 굴착자: 솟아오르며 r칸 안을 쳐 올림 (바로 위면 피해 + 밀려남), 땅 위에서 up초
function burrowErupt(e) {
  const B = e.d.burrow, p = player, d = Math.hypot(p.x - e.x, p.y - e.y) || 0.01;
  e.riseT = 0; e.emergeT = 0.3; e.sink = 1; e.upT = B.up; e.atkT = ATK_ANIM; e.acd = 0.6;
  if (d < B.r + p.r && hurtPlayer(B.hit * e.dmg / e.d.dmg, e.x, e.y)) { p.kx += (p.x - e.x) / d * B.knock; p.ky += (p.y - e.y) / d * B.knock; }
  for (let k = 0; k < 26; k++) { const a = rnd(0, 6.28), v = rnd(1, 4); parts.push({ x: e.x, y: e.y, z: 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(60, 160), g: 320, life: rnd(0.4, 0.8), max: 0.8, col: pick(['#6b5434', '#8a6d44', '#4a3a24', '#9a8060']), size: rnd(2, 5) }); }
  rings.push({ x: e.x, y: e.y, R: B.r, t: 0, max: 0.3, col: '170,130,80' }); addDecal({ x: e.x, y: e.y, r: 0.7, col: 'rgba(40,30,18,0.7)' }); // 파인 자국
  shake = Math.max(shake, 6); Snd.play('stomp', e.x, e.y); Snd.mon(e, 'attack');
}
// 굴착자: 파고드는 중 (sink 0→1, 다 들어가면 땅속으로) · 솟아오르는 중 (1→0)
function startDig(e) { e.digT = e.d.burrow.dig; e.sink = 0; Snd.play('skitter', e.x, e.y); }
function burrowAnim(e, dt) {
  e.anim += dt;
  if (e.digT > 0) {
    if (Math.random() < dt * 20) parts.push({ x: e.x + rnd(-0.3, 0.3), y: e.y + rnd(-0.3, 0.3), z: 2, vx: rnd(-1, 1), vy: rnd(-1, 1), vz: rnd(30, 70), g: 300, life: 0.4, max: 0.4, col: pick(['#6b5434', '#8a6d44']), size: 3 });
    e.digT -= dt; e.sink = 1 - Math.max(0, e.digT) / e.d.burrow.dig;
    if (e.digT <= 0) { e.digT = 0; e.under = true; e.ut = 0; e.sink = 1; }
    return;
  }
  e.emergeT -= dt; e.sink = Math.max(0, e.emergeT / 0.3);
}
// 매복자: 떨어지는 중 — 바닥에 닿으면 r칸 안을 덮침 (피해 + 밀려남)
function lurkerFall(e, dt) {
  const C = e.d.ceiling, p = player;
  e.anim += dt; e.fallT -= dt; e.z = 150 * Math.max(0, e.fallT / C.fall) ** 2;
  if (e.fallT > 0) return;
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 0.01;
  e.fallT = 0; e.z = 0; e.atkT = ATK_ANIM; e.acd = 0.5;
  if (d < C.r && hurtPlayer(C.hit * e.dmg / e.d.dmg, e.x, e.y)) { p.kx += (p.x - e.x) / d * C.knock; p.ky += (p.y - e.y) / d * C.knock; }
  rings.push({ x: e.x, y: e.y, R: C.r, t: 0, max: 0.3, col: '170,90,200' }); smoke(e.x, e.y, 8, '90,70,100', 1.2); shake = Math.max(shake, 7);
  Snd.play('stomp', e.x, e.y); Snd.mon(e, 'attack'); aggro(e); alertNear(e.x, e.y, 5);
}
// 수호 드론: range칸 안의 가까운 적 n마리에 보호막 (매 프레임 다시 고름 — 드론이 쓰러지면 바로 꺼짐)
function wardTick(e) {
  const W = e.d.ward;
  e.wards = enemies.filter(o => o !== e && !o.dead && !hiddenE(o) && !o.d.ward && !o.d.boss && Math.abs(o.x - e.x) < W.range && Math.abs(o.y - e.y) < W.range && Math.hypot(o.x - e.x, o.y - e.y) < W.range)
    .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, W.n);
  for (const o of e.wards) { o.wardT = gtime + 0.25; o.wardBy = e; }
  if (e.aggro && e.wards.length) tip('warden', frontKey(ENEMY_ART.warden.spr, 'a'));
}
function thiefEscape(e) {
  e.dead = true; // 처치가 아님 (보상·시체 없음)
  addFx('tfog', 'abcdefghij', e.x, e.y, 0, 0.6, 1.2); Snd.play('exit', e.x, e.y);
  flashes.push({ x: e.x, y: e.y, r: 300, t: 0.4, max: 0.4, col: '180,120,255' });
  msg('보물 약탈자가 차원 틈으로 달아났다…', '#b9a6c8');
}
// 처치: 훔친 보물이 쏟아짐 — 골드 무더기, 보석, 좋은 장비, 가끔 고유 전설·세트 장비, 경험치
function thiefDeath(e) {
  const n = e.lv, T = THIEF, at = (r = 1.1) => [e.x + rnd(-r, r), e.y + rnd(-r, r)];
  for (let k = 0; k < T.piles; k++) addPickup(...at(1.3), 'gold', 'gold', irnd(T.gold[0], T.gold[1]) * n);
  for (let k = 0; k < T.gems; k++) dropWeapon(...at(), randomGem(2));
  for (let k = 0; k < T.items; k++) dropWeapon(...at(), atLeastMagic(randomLoot(3, 0.4)));
  const sp = uniqueDrop(T.unique) || setDrop(T.set); if (sp) dropWeapon(...at(0.6), sp);
  const xp = T.xp * n; gainXp(xp); addText(e.x, e.y, `+${xp} XP`, '#c9a0ff', 56);
  for (let k = 0; k < 40; k++) { const a = rnd(0, 6.28), s = rnd(1, 5); parts.push({ x: e.x, y: e.y, z: rnd(10, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(60, 180), g: 320, life: rnd(0.5, 1), max: 1, col: pick(['#ffd27a', '#fff2c0', '#ffc850']), size: 3, glow: true }); }
  flashes.push({ x: e.x, y: e.y, r: 520, t: 0.5, max: 0.5, col: '255,210,110' }); shake = Math.max(shake, 8);
  msg('💰 보물 약탈자 처치! — 훔친 보물이 쏟아진다', '#ffd27a'); Snd.play('unique', e.x, e.y);
}
// 근접 공격에 맞은 적(보스 제외): 준비 동작을 끊음 — 차저 돌진 · 브루트 투척 · 감시자 불기둥 · 되살리는 주문 · 연사
function interrupt(e) {
  let cut = false;
  if (e.windT > 0) { e.windT = 0; e.chargeCd = e.d.charge.cd; cut = true; }
  if (e.lobT > 0) { e.lobT = 0; e.lobCd = e.d.lob.rate; cut = true; }
  if (e.castT > 0 && e.d.raise) { e.castT = 0; e.raiseC = null; cut = true; }
  if (e.castT > 0 && e.d.pillar) { e.castT = 0; pillars = pillars.filter(q => q.owner !== e); cut = true; }
  if (e.burst > 0) { e.burst = 0; cut = true; }
  if (cut) addText(e.x, e.y, '끊음!', '#9cf', 52);
}
// 근접으로 처치: 체력 조금, 확률로(정예·보스는 반드시) 장착한 총 중 가장 모자란 탄약이 튀어나와 끌려옴 (체인톱은 반드시, 더 많이)
function meleeKill(e) {
  const p = player, big = e.elite || e.d.boss, M = MELEE, S = meleeNow.saw || M, h = Math.round(p.maxhp * (big ? M.healBig : M.heal));
  if (heal(p, h)) addText(p.x, p.y, `+${h}`, '#7f7', 46);
  if (Math.random() > (big ? 1 : S.ammo)) return;
  const own = [...new Set(p.equip.filter(w => w && w.s.ammo).map(w => w.s.ammo))];
  const a = own.length ? own.sort((u, v) => p.ammo[u] / ammoMax(u) - p.ammo[v] / ammoMax(v))[0] : randomAmmoType();
  addPickup(e.x + rnd(-0.3, 0.3), e.y + rnd(-0.3, 0.3), 'ammo', a, Math.max(1, Math.round(AMMO[a].pack * (big ? S.packBig : S.pack))));
  pickups[pickups.length - 1].mag = true;
  tip('melee');
}
// 영원한 겨울: 얼어 있던 적이 죽으면 산산조각 — 주변 2칸에 냉기 피해·둔화 (연쇄될 수 있음)
function frostShatter(e) {
  const dmg = e.shatter; e.shatter = 0;
  for (const o of enemiesNear(e.x, e.y, 2, false)) if (o !== e) { hitEnemy(o, dmg); if (!o.dead) o.slow = Math.max(o.slow, 3); }
  for (let k = 0; k < 24; k++) { const a = rnd(0, 6.28), v = rnd(1, 4); parts.push({ x: e.x, y: e.y, z: rnd(10, 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(30, 90), g: 260, life: rnd(0.4, 0.8), max: 0.8, col: pick(['#dff', '#bef', '#fff']), size: 3, glow: true }); }
  rings.push({ x: e.x, y: e.y, R: 2, t: 0, max: 0.3, col: '190,235,255' }); Snd.play('cryo', e.x, e.y);
}
// 정예 처치: '고급' 이상 장비 확정 + 아이템, 특성별 최후 (불길·폭발·분열)
function eliteDeath(e) {
  const w = uniqueDrop(UNIQUE_DROP.elite) || setDrop(SET_DROP.elite) || randomLoot(ELITE.lootBonus + (e.d.lootBonus || 0), 0.3);
  dropWeapon(e.x, e.y, atLeastMagic(w));
  if (Math.random() < SHELL_DROP.elite) dropWeapon(e.x, e.y, uniqueShellDrop(SHELL_UNIQUE_DROP.elite) || randomLootShell(ELITE.lootBonus)); // 스킬 쉘 (아주 가끔 고유 전설)
  if (Math.random() < GEM_DROP.elite) dropWeapon(e.x + rnd(-0.4, 0.4), e.y + rnd(-0.4, 0.4), randomGem(1)); // 보석
  addPickup(e.x + rnd(-.3, .3), e.y + rnd(-.3, .3), 'item', weighted(ITEM_DROP_WEIGHTS));
  msg(`정예 처치: ${e.name}`, '#ffcc55');
  flashes.push({ x: e.x, y: e.y, r: 320, t: 0.35, max: 0.35, col: ELITE_AFFIXES[e.elite[0]].rgb });
  if (e.elite.includes('fire')) { areas.push({ type: 'fire', x: e.x, y: e.y, r: 1.8, t: 4, max: 4 }); Snd.play('fire', e.x, e.y); }
  if (e.elite.includes('bomb')) grenades.push({ type: 'frag', sx: e.x, sy: e.y, tx: e.x, ty: e.y, x: e.x, y: e.y, z: 0, z0: 0, arc: 0.01, t: 0, dur: 1, warn: true });
  if (e.elite.includes('split')) for (let k = 0, n = 0; n < 2 && k < 8; k++) {
    const a = k * 2.4 + rnd(0, 0.5), x = e.x + Math.cos(a) * 0.5, y = e.y + Math.sin(a) * 0.5;
    if (collides(x, y, e.r * 0.8, e.fly)) continue;
    const c = spawnEnemy(e.type, x, y);
    c.hp = c.maxhp = c.maxhp * 0.4; c.aggro = true; c.small = true; n++;
    addFx('tfog', 'abcdefghij', x, y, 0, 0.5, 0.8);
  }
}
// 정예 특성: 재생, 불타는 기운 (가까이 있으면 화상), 지휘 (주변 적 강화), 저주 (내 방어 절반), 순간이동, 전기 불꽃 대기시간
function eliteTick(e, dt) {
  const p = player, F = ELITE_FX, d = Math.hypot(p.x - e.x, p.y - e.y), free = !(e.freeze > 0) && !(e.stun > 0);
  if (e.sparkCd > 0) e.sparkCd -= dt;
  if (e.elite.includes('aura') && (e.auraTick = (e.auraTick || 0) - dt) <= 0) { // 0.25초마다 주변 적에게 표시 (잠깐 동안 유지)
    e.auraTick = 0.25;
    for (const o of enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < F.aura.r) o.auraT = 0.4;
  }
  if (e.elite.includes('curse') && e.aggro && free && (e.curseT = (e.curseT ?? 1) - dt) <= 0 && d < F.curse.range && canSee(e.x, e.y) && !inHub()) {
    e.curseT = F.curse.cd;
    if (!(p.fx.curse > 0)) msg(`저주에 걸렸다 — ${F.curse.t}초 동안 방어 절반`, '#b08aff');
    p.fx.curse = F.curse.t; tip('curse');
    beams.push({ x0: e.x, y0: e.y, x1: p.x, y1: p.y, t: 0.35, col: '150,90,255', z0: 40 }); Snd.play('shade', p.x, p.y);
  }
  if (e.elite.includes('blink') && e.aggro && free && !(e.leapT > 0) && (e.eblinkT = (e.eblinkT ?? rnd(...F.blink.cd)) - dt) <= 0) {
    e.eblinkT = rnd(...F.blink.cd);
    if (d > F.blink.min && d < 14 && los(e.x, e.y, p.x, p.y)) { const s = blinkSpot(e, F.blink.r[0], F.blink.r[1], rnd(0, 6.28), true); if (s) { blinkTo(e, s); e.face = Math.atan2(p.y - e.y, p.x - e.x); e.acd = Math.max(e.acd, 0.35); } }
  }
  if (e.elite.includes('regen') && e.hp < e.maxhp) e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.03 * dt);
  if (e.elite.includes('fire')) {
    if (Math.random() < dt * 14) fireBurst(e.x + rnd(-0.4, 0.4), e.y + rnd(-0.4, 0.4), 1, 0.4);
    if (Math.hypot(p.x - e.x, p.y - e.y) < 1.4 + e.r) afflict('burn', 0.8);
  }
}
// 상자: 근접 공격으로 부숨. 부서지면 바닥이 되어 길이 열리고, 가끔 탄약·골드·아이템이 나옴
function hitCrate(i, j, dmg) {
  const k = j * MW + i, hp = (crateHp.get(k) ?? CRATE_HP) - dmg, x = i + 0.5, y = j + 0.5;
  spark(x, y, 5, '#c8a878', 3); crateHitT.set(k, gtime + 0.15);
  if (hp > 0) { crateHp.set(k, hp); return; }
  crateHp.delete(k); tiles[k] = T.FLOOR;
  for (let n = 0; n < 16; n++) { const a = rnd(0, 6.28), s = rnd(1, 4); parts.push({ x, y, z: rnd(6, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(40, 140), g: 320, life: rnd(0.5, 0.9), max: 0.9, col: pick(['#6a6a62', '#8a8478', '#4e4a42', '#a89a78']), size: rnd(3, 5) }); }
  smoke(x, y, 8, '110,100,85', 1.2); decal(x, y, 0.35, 'rgba(40,36,30,0.55)');
  Snd.play('crate', x, y); shake = Math.max(shake, 3);
  if (mapSeen[k]) revealTile(k); // 미니맵도 바닥으로
  flowTile = -1; exitDist = null;  // 몬스터 길찾기·출구 안내 다시 계산
  const r = Math.random();
  if (r < CRATE_LOOT * 0.5) { const a = randomAmmoType(); addPickup(x, y, 'ammo', a, AMMO[a].pack); }
  else if (r < CRATE_LOOT * 0.8) addPickup(x, y, 'gold', 'gold', irnd(10, 30) * level);
  else if (r < CRATE_LOOT) addPickup(x, y, 'item', weighted(ITEM_DROP_WEIGHTS));
  if (Math.random() < GEM_DROP.crate) dropWeapon(x, y, randomGem()); // 가끔 보석
}
function hitBarrel(b, dmg) {
  if (b.dead) return;
  b.hp -= dmg; spark(b.x, b.y, 3);
  if (b.hp <= 0) { b.dead = true; explode('frag', b.x, b.y, 1.2); areas.push({ type: 'fire', x: b.x, y: b.y, r: 1.8, t: 5, max: 5 }); }
}
// dm: 피해 배율 (플레이어가 던진 수류탄은 폭파 전문가 특성만큼)
function explode(type, x, y, scale = 1, dm = 1) {
  const p = player, pd = Math.hypot(p.x - x, p.y - y);
  if (type === 'frag') {
    const R = 3 * scale;
    for (const e of enemies) { const d = Math.hypot(e.x - x, e.y - y); if (d < R) hitEnemy(e, 100 * scale * dm * (1 - d / R * 0.6), (e.x - x) / (d || 1) * 8, (e.y - y) / (d || 1) * 8); }
    for (const b of barrels) if (!b.dead && Math.hypot(b.x - x, b.y - y) < R) setTimeout(() => hitBarrel(b, 99), 80);
    if (pd < R * 0.9) hurtPlayer(45 * (1 - pd / R), x, y);
    fireBurst(x, y, 40, 5); smoke(x, y, 18, '70,60,50', 2); spark(x, y, 20, '#ffd27a', 8);
    addFx('misl', 'bcd', x, y, 6, 0.45, 1.5 * scale);
    decal(x, y, 1.1 * scale, 'rgba(10,8,6,0.75)');
    flashes.push({ x, y, r: 520 * scale, t: 0.35, max: 0.35, col: '255,150,60' });
    shake = Math.max(shake, 14 * scale); Snd.play('explode', x, y);
  } else if (type === 'gas') {
    areas.push({ type: 'gas', x, y, r: 2.8, t: 7, max: 7 }); smoke(x, y, 20, '120,200,60', 2); Snd.play('gas', x, y);
    addFx('tfog', 'abcdefghij', x, y, 0, 0.8, 1.3);
  } else if (type === 'fire') {
    areas.push({ type: 'fire', x, y, r: 2.3, t: 6, max: 6 }); fireBurst(x, y, 40, 4);
    for (const e of enemies) if (Math.hypot(e.x - x, e.y - y) < 2.3) { hitEnemy(e, 20 * dm); e.burn = 3; }
    flashes.push({ x, y, r: 380, t: 0.3, max: 0.3, col: '255,120,40' }); Snd.play('fire', x, y);
  } else if (type === 'shock') {
    for (const e of enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 3.6) { hitEnemy(e, (e.fly ? 70 : 35) * dm); e.stun = Math.max(e.stun, 2.5 * ccScale(e)); beams.push({ x0: x, y0: y, x1: e.x, y1: e.y, t: 0.3 }); }
    }
    if (pd < 2.2) afflict('shock', 2.5);
    spark(x, y, 30, '#9df', 7); addFx('ifog', 'abcde', x, y, 0, 0.5, 1.5);
    flashes.push({ x, y, r: 420, t: 0.25, max: 0.25, col: '120,200,255' }); shake = Math.max(shake, 5); Snd.play('shock', x, y);
  } else if (type === 'cryo') {
    for (const e of enemies) if (Math.hypot(e.x - x, e.y - y) < 3.2) { hitEnemy(e, 15 * dm); e.freeze = 3.5 * ccScale(e); e.slow = 7; }
    for (let k = 0; k < 40; k++) { const a = rnd(0, 6.28), s = rnd(1, 5); parts.push({ x, y, z: rnd(4, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(10, 60), g: 100, life: rnd(0.4, 0.9), max: 0.9, col: pick(['#dff', '#bef', '#fff']), size: 3, glow: true }); }
    decal(x, y, 2.2, 'rgba(180,230,255,0.25)'); addFx('ifog', 'abcde', x, y, 0, 0.6, 1.3, 0.8);
    flashes.push({ x, y, r: 400, t: 0.3, max: 0.3, col: '170,230,255' }); Snd.play('cryo', x, y);
  } else if (type === 'pod') { // 오버마인드의 포자: 떨어진 곳에서 몬스터가 깨어남
    const c = spawnEnemy(weighted({ crawler: 4, xenoid: 3, spitter: 2 }), x, y);
    c.minion = true; c.aggro = true;
    addFx('fire', 'abcdefgh', x, y, 0, 0.6, 0.9); addFx('tfog', 'abcdefghij', x, y, 0, 0.6, 0.8);
    flashes.push({ x, y, r: 260, t: 0.3, max: 0.3, col: '255,120,60' }); Snd.play('podHatch', x, y);
  }
}

// ===== 보스 =====
let boss = null; // 지금 싸우는 보스 (체력 막대)
const bossKindFor = lv => lv >= CAMPAIGN.length ? 'overmind' : lv % BOSS_EVERY ? null : (lv / BOSS_EVERY) % 2 === 1 ? 'titan' : 'hivemother';
function bossThink(e, dt, d, dx, dy, see, spawned) { // 이번 프레임의 움직임을 직접 처리했으면 true (구역 보스의 돌진·주문·레이저 중)
  if (BOSS_AI[e.d.boss]) return BOSS_AI[e.d.boss](e, dt, d, dx, dy, see, spawned);
  const p = player, m = 1 + 0.1 * (e.lv - 1), a0 = Math.atan2(dy, dx);
  if (e.d.boss === 'titan') {
    // 로켓 3연발
    e.volleyT = (e.volleyT ?? 1.5) - dt;
    if (see && d < 13 && e.volleyT <= 0 && !e.burst) { e.volleyT = 3; e.burst = 3; e.burstT = 0; }
    if (e.burst) {
      e.burstT -= dt;
      if (e.burstT <= 0) {
        e.burst--; e.burstT = 0.3; e.atkT = ATK_ANIM; e.face = a0;
        const a = a0 + rnd(-0.12, 0.12);
        eshots.push({ x: e.x + Math.cos(a) * 0.8, y: e.y + Math.sin(a) * 0.8, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, type: 'rocket', dmg: 28 * m, life: 3 });
        Snd.play('rocket', e.x, e.y);
      }
    }
    // 가까이 붙으면 땅 내려찍기 (벽·닫힌 문 너머로는 안 함)
    e.stompT = (e.stompT ?? 2) - dt;
    if (see && d < 2.8 && e.stompT <= 0) {
      e.stompT = 3.2; e.atkT = ATK_ANIM;
      hurtPlayer(32 * m * (1 - d / 3.5), e.x, e.y); p.kx += dx / d * 9; p.ky += dy / d * 9;
      shake = Math.max(shake, 14); smoke(e.x, e.y, 24, '90,80,70', 3); addFx('misl', 'bcd', e.x, e.y, 0, 0.4, 2.2);
      Snd.play('stomp', e.x, e.y);
    }
  } else if (e.d.boss === 'brain') {
    // 오버마인드: 움직이지 않음. 화염탄 부채꼴 + 포자 발사(떨어진 곳에서 몬스터가 깨어남). 체력이 줄수록 빨라짐
    const ph = e.hp < e.maxhp * 0.3 ? 2 : e.hp < e.maxhp * 0.65 ? 1 : 0;
    e.rage = ph === 2;
    e.fireT = (e.fireT ?? 2) - dt;
    if (see && d < 14 && e.fireT <= 0) {
      e.fireT = [2.6, 2, 1.4][ph]; e.atkT = ATK_ANIM;
      const n = [5, 7, 9][ph];
      for (let k = 0; k < n; k++) {
        const a = a0 + (k - (n - 1) / 2) * 0.17;
        eshots.push({ x: e.x + Math.cos(a) * 1.1, y: e.y + Math.sin(a) * 1.1, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, type: 'fireball', dmg: 11 * m, life: 2.4 });
      }
      Snd.play('fireball', e.x, e.y);
    }
    e.podT = (e.podT ?? 2.5) - dt;
    if (e.podT <= 0) {
      e.podT = [7, 5.5, 4][ph];
      const alive = enemies.filter(o => o.minion && !o.dead).length + spawned.length + grenades.filter(g => g.type === 'pod').length;
      for (let k = 0; k < [3, 4, 5][ph] && alive + k < 25; k++) {
        const t = podTarget(e);
        grenades.push({ type: 'pod', sx: e.x, sy: e.y, tx: t.x, ty: t.y, x: e.x, y: e.y, z: 90, z0: 90, arc: 80, t: 0, dur: 1.1 + k * 0.15 });
      }
      Snd.mon(e, 'attack');
    }
  } else {
    // 하이브 마더: 산성액 부채꼴 + 크롤러 소환, 체력 절반 이하면 격노(빨라짐)
    e.rage = e.hp < e.maxhp * 0.5;
    e.sprayT = (e.sprayT ?? 1.5) - dt * (e.rage ? 1.5 : 1);
    if (see && d < 11 && e.sprayT <= 0) {
      e.sprayT = 2.4; e.atkT = ATK_ANIM; e.face = a0;
      for (let k = -3; k <= 3; k++) {
        const a = a0 + k * 0.14;
        eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, type: 'acid', dmg: 9 * m, life: 1.6 });
      }
      Snd.play('spit', e.x, e.y);
    }
    e.summonT = (e.summonT ?? 4) - dt;
    if (e.summonT <= 0) {
      e.summonT = e.rage ? 6 : 9;
      let alive = enemies.filter(o => o.minion && !o.dead).length + spawned.length;
      for (let k = 0; k < 5 && alive < 20; k++) {
        const a = rnd(0, 6.28), x = e.x + Math.cos(a) * 1.4, y = e.y + Math.sin(a) * 1.4;
        if (collides(x, y, 0.25, false)) continue;
        const c = makeEnemy('crawler', x, y);
        c.minion = true; c.aggro = true; spawned.push(c); alive++;
        addFx('tfog', 'abcdefghij', x, y, 0, 0.6, 0.8);
      }
      Snd.mon(e, 'attack');
    }
  }
}
// ===== 구역 보스 (REGION_BOSSES): 체력이 절반 밑이면 격노 — 빨라지고 공격이 잦아짐 =====
const bossDmg = (e, v) => v * (1 + 0.1 * (e.lv - 1));
function bossRage(e) {
  e.rage = e.hp < e.maxhp * 0.5;
  if (e.rage && !e.raged) { e.raged = true; msg(`${e.d.name} — 격노!`, '#ff6a4a'); Snd.mon(e, 'sight'); flashes.push({ x: e.x, y: e.y, r: 420, t: 0.4, max: 0.4, col: '255,80,50' }); shake = Math.max(shake, 6); }
  return e.rage;
}
// 파쇄 짐승: 돌진은 chargeThink(e.d.charge)가 맡음 — 여기서는 격노(돌진·공격 간격↓)와 내려찍기 (뛰어올랐다가 충격파, 격노하면 두 번)
function crusherThink(e, dt, d, dx, dy, see) {
  const S = e.d.slam, rage = bossRage(e);
  e.atkMul = rage ? 0.7 : 1;
  e.slamCd = (e.slamCd ?? 2) - dt;
  if (e.slamT > 0) {
    e.slamT -= dt; e.atkT = 0.1; e.z = Math.sin(Math.PI * clamp(1 - e.slamT / S.wind, 0, 1)) * 30;
    if (e.slamT <= 0) { e.z = 0; slamWave(e, S); if (rage) later(0.35, () => { if (!e.dead) slamWave(e, S); }); }
    return true;
  }
  if (e.dashT > 0 || e.windT > 0) return false;
  if (see && d < S.near && e.slamCd <= 0) { e.slamCd = S.cd * (rage ? 0.6 : 1); e.slamT = S.wind; Snd.mon(e, 'attack'); return true; }
  return false;
}
function slamWave(e, S) {
  waves.push({ x: e.x, y: e.y, r: e.r, max: S.r, speed: S.speed, dmg: bossDmg(e, S.dmg), hit: false, col: '255,170,90' });
  shake = Math.max(shake, 12); smoke(e.x, e.y, 20, '90,80,70', 3); addFx('misl', 'bcd', e.x, e.y, 0, 0.4, 2); Snd.play('stomp', e.x, e.y);
  decal(e.x, e.y, 1.4, 'rgba(10,8,6,0.6)');
}
// 번식 모체: 산성액 부채꼴 + 새끼 (크롤러·질주 크롤러·폭주 해골 — 새끼는 경험치·전리품이 거의 없음)
function broodBossThink(e, dt, d, dx, dy, see, spawned) {
  const B = e.d.brood, S = e.d.spray, rage = bossRage(e), a0 = Math.atan2(dy, dx);
  e.sprayT = (e.sprayT ?? 1.5) - dt;
  if (see && d < 11 && e.sprayT <= 0) {
    e.sprayT = S.rate * (rage ? 0.7 : 1); e.atkT = ATK_ANIM; e.face = a0;
    const n = S.n + (rage ? 2 : 0);
    for (let k = 0; k < n; k++) { const a = a0 + (k - (n - 1) / 2) * S.spread; eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * S.speed, vy: Math.sin(a) * S.speed, type: 'acid', dmg: bossDmg(e, S.dmg), life: 1.6 }); }
    Snd.play('spit', e.x, e.y);
  }
  e.broodT = (e.broodT ?? 2) - dt;
  if (e.broodT <= 0) {
    e.broodT = B.rate * (rage ? 0.65 : 1);
    let alive = enemies.filter(o => o.parent === e && !o.dead).length + spawned.filter(o => o.parent === e).length;
    for (let k = 0, made = 0; k < 10 && made < B.n + (rage ? 1 : 0) && alive < B.max; k++) {
      const a = rnd(0, 6.28), x = e.x + Math.cos(a) * 1.4, y = e.y + Math.sin(a) * 1.4, type = weighted(B.pool);
      if (collides(x, y, ENEMIES[type].r, !!ENEMIES[type].fly) || safeAt(x, y)) continue;
      const c = makeEnemy(type, x, y, e.lv); c.parent = e; c.aggro = true; spawned.push(c); alive++; made++;
      addFx('tfog', 'abcdefghij', x, y, 0, 0.5, 0.7);
    }
    e.atkT = ATK_ANIM; Snd.mon(e, 'attack');
  }
  return false;
}
// 감시 포대 아르고스: 사방으로 퍼지는 탄 고리 (격노하면 엇갈린 두 겹)와 소용돌이 탄 (움직이면서)
function argusThink(e, dt, d, dx, dy, see) {
  const O = e.d.orb, RG = e.d.ring, SP = e.d.spiral, rage = bossRage(e), a0 = Math.atan2(dy, dx);
  const orb = a => eshots.push({ x: e.x + Math.cos(a) * 0.9, y: e.y + Math.sin(a) * 0.9, vx: Math.cos(a) * O.speed, vy: Math.sin(a) * O.speed, type: 'orb', dmg: bossDmg(e, O.dmg), life: 14 / O.speed });
  if (e.spiral > 0) {
    e.spiral -= dt; e.spT -= dt; e.atkT = 0.1;
    const arms = SP.arms + (rage ? 1 : 0);
    while (e.spT <= 0 && e.spiral > 0) { e.spT += SP.gap; for (let k = 0; k < arms; k++) orb(e.spA + k * Math.PI * 2 / arms); e.spA += SP.turn * e.spDir; }
    if (Math.random() < dt * 6) Snd.play('spit', e.x, e.y);
    return false;
  }
  e.ringT = (e.ringT ?? 1.5) - dt; e.spiralT = (e.spiralT ?? 5) - dt;
  if (!see || d > 15) return false;
  if (e.spiralT <= 0) { e.spiralT = SP.rate * (rage ? 0.7 : 1); e.spiral = SP.dur; e.spT = 0; e.spA = a0; e.spDir = Math.random() < 0.5 ? 1 : -1; Snd.mon(e, 'attack'); return false; }
  if (e.ringT <= 0) {
    e.ringT = RG.rate * (rage ? 0.75 : 1); e.atkT = ATK_ANIM; e.face = a0;
    const n = RG.n + (rage ? 6 : 0), off = rnd(0, Math.PI * 2 / n);
    for (let k = 0; k < n; k++) orb(off + k * Math.PI * 2 / n);
    if (rage) later(0.4, () => { if (!e.dead) for (let k = 0; k < n; k++) orb(off + (k + 0.5) * Math.PI * 2 / n); });
    Snd.play('spit', e.x, e.y); Snd.mon(e, 'attack');
  }
  return false;
}
// 역병 거인: 독액 덩어리 (떨어질 곳에 초록 테두리 예고 → 독 웅덩이), 가까우면 주위에 독구름 (예고 동안 멈춤)
function plagueThink(e, dt, d, dx, dy, see) {
  const G = e.d.glob, C = e.d.cloud, rage = bossRage(e);
  if (e.cloudT > 0) {
    e.cloudT -= dt; e.atkT = 0.1;
    if (Math.random() < dt * 30) smoke(e.x + rnd(-1, 1), e.y + rnd(-1, 1), 1, '120,200,60', 1.2);
    if (e.cloudT <= 0) { const t = C.t * (rage ? 1.4 : 1); areas.push({ type: 'gas', x: e.x, y: e.y, r: C.r, t, max: t, foe: true }); smoke(e.x, e.y, 24, '120,200,60', 3); Snd.play('gas', e.x, e.y); }
    return true;
  }
  e.globT = (e.globT ?? 1.5) - dt; e.cloudCd = (e.cloudCd ?? 5) - dt;
  if (e.cloudCd <= 0 && d < C.r + 1.5) { e.cloudCd = C.rate * (rage ? 0.75 : 1); e.cloudT = C.wind; Snd.mon(e, 'attack'); return true; }
  if (see && d < 12 && e.globT <= 0) {
    e.globT = G.rate * (rage ? 0.75 : 1); e.atkT = ATK_ANIM; e.face = Math.atan2(dy, dx);
    for (let k = 0; k < G.n + (rage ? 2 : 0); k++) {
      let tx = player.x, ty = player.y;
      if (k) for (let t = 0; t < 8; t++) { const a = rnd(0, 6.28), r = rnd(1.5, 3.2); tx = player.x + Math.cos(a) * r; ty = player.y + Math.sin(a) * r; if (!collides(tx, ty, 0.3, false) && !safeAt(tx, ty)) break; }
      grenades.push({ type: 'acid', sx: e.x, sy: e.y, tx, ty, x: e.x, y: e.y, z: 40, z0: 40, arc: 70, t: 0, dur: G.flight + k * 0.12, warn: true, warnR: G.r, dmg: bossDmg(e, G.dmg), poolR: G.r, poolT: G.t * (rage ? 1.3 : 1) });
    }
    Snd.play('ballThrow', e.x, e.y);
  }
  return false;
}
// 독액 덩어리가 떨어짐: 닿으면 피해·중독 + 독 웅덩이 (보스가 만든 독이라 몬스터는 다치지 않음)
function acidSplash(g) {
  const p = player, d = Math.hypot(p.x - g.x, p.y - g.y);
  if (d < g.poolR && hurtPlayer(g.dmg, g.x, g.y)) afflict('poison', 3);
  areas.push({ type: 'gas', x: g.x, y: g.y, r: g.poolR, t: g.poolT, max: g.poolT, foe: true });
  addFx('bal7', 'cde', g.x, g.y, 6, 0.4, 1.6); smoke(g.x, g.y, 10, '120,200,60', 1.5); bloodSplat(g.x, g.y, g.poolR * 0.7, 'rgba(90,140,30,0.6)', false);
  Snd.play('fireHit', g.x, g.y);
}
// 공허 사제: 순간이동, 불기둥 무늬 (십자·줄·고리, 격노하면 십자+고리), 시체 되살리기는 raiseThink(e.d.raise)
function voidThink(e, dt, d, dx, dy, see) {
  const Wp = e.d.warp, P = e.d.pyre, rage = bossRage(e);
  if (e.raiseC) return false; // 되살리는 주문 중 (raiseThink가 멈춰 세움)
  e.warpT = (e.warpT ?? 3) - dt; e.pyreT = (e.pyreT ?? 1.5) - dt;
  if (e.castT > 0) { e.castT -= dt; return true; } // 불기둥 부르는 동작
  if (!see) return false;
  if (e.warpT <= 0 && d < 13) {
    e.warpT = Wp.rate * (rage ? 0.7 : 1) * rnd(0.85, 1.15);
    const s = blinkSpot(e, Wp.min, Wp.max, rnd(0, 6.28), true);
    if (s) { blinkTo(e, s); e.face = Math.atan2(player.y - e.y, player.x - e.x); }
  }
  if (e.pyreT <= 0 && d < 13) {
    e.pyreT = P.rate * (rage ? 0.7 : 1); e.castT = e.castMax = 0.6; e.face = Math.atan2(dy, dx);
    pyrePattern(e, pick(rage ? ['cross', 'line', 'ring', 'crossring'] : ['cross', 'line', 'ring']), P.wind * (rage ? 0.8 : 1));
    Snd.mon(e, 'attack');
    return true;
  }
  return false;
}
function pyrePattern(e, pat, w) {
  const P = e.d.pyre, p = player, dmg = bossDmg(e, P.dmg);
  const add = (x, y, delay = 0) => { if (!blocksShot(x, y) && !safeAt(x, y)) pillars.push({ x, y, t: w + delay, max: w + delay, r: P.r, dmg, burn: P.burn }); };
  if (pat === 'cross' || pat === 'crossring') { add(p.x, p.y); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; add(p.x + Math.cos(a) * 2, p.y + Math.sin(a) * 2, 0.15); } }
  if (pat === 'ring' || pat === 'crossring') for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; add(p.x + Math.cos(a) * 2.6, p.y + Math.sin(a) * 2.6, pat === 'crossring' ? 0.5 : 0); }
  if (pat === 'ring') add(p.x, p.y, 0.45);
  if (pat === 'line') { const a = Math.atan2(p.y - e.y, p.x - e.x); for (let k = 0; k < 7; k++) add(e.x + Math.cos(a) * (1.4 + k * 1.3), e.y + Math.sin(a) * (1.4 + k * 1.3), k * 0.1); }
}
// 처형자: 유도 미사일, 레이저 (조준선 → 쓸기 — 그동안 멈춤)
function execThink(e, dt, d, dx, dy, see) {
  const M = e.d.missile, L = e.d.laser, rage = bossRage(e), p = player;
  const B = e.laser;
  if (B) {
    B.t -= dt; e.atkT = 0.1;
    if (B.phase === 'aim') {
      if (B.t > L.wind * 0.35) B.a = Math.atan2(p.y - e.y, p.x - e.x); // 끝 무렵에는 방향이 고정됨
      e.face = B.a;
      if (B.t <= 0) { B.phase = 'fire'; B.t = B.max = L.dur * (rage ? 0.8 : 1); B.from = B.a - B.sw * B.dir; B.tick = 0; Snd.play('laser', e.x, e.y); }
      return true;
    }
    B.cur = B.from + B.sw * 2 * B.dir * (1 - Math.max(0, B.t) / B.max); e.face = B.cur;
    const len = B.len = laserLen(e, B.cur, L.len), ca = Math.cos(B.cur), sa = Math.sin(B.cur);
    if ((B.tick -= dt) <= 0) {
      B.tick = L.tick;
      const rx = p.x - e.x, ry = p.y - e.y, along = rx * ca + ry * sa;
      if (along > 0 && along < len && Math.abs(rx * sa - ry * ca) < 0.45 + p.r && p.dash <= 0 && hurtPlayer(bossDmg(e, L.dmg), e.x, e.y)) afflict('burn', 1);
      Snd.play('laser', e.x, e.y);
    }
    if (Math.random() < dt * 30) spark(e.x + ca * len, e.y + sa * len, 2, '#ff9070', 2);
    if (B.t <= 0) e.laser = null;
    return true;
  }
  e.missT = (e.missT ?? 1.5) - dt; e.laserT = (e.laserT ?? 4) - dt;
  if (!see || d > 14) return false;
  if (e.laserT <= 0) { e.laserT = L.rate * (rage ? 0.7 : 1); e.laser = { phase: 'aim', t: L.wind, a: Math.atan2(dy, dx), sw: L.sweep * (rage ? 1.35 : 1), dir: Math.random() < 0.5 ? 1 : -1 }; Snd.mon(e, 'attack'); return true; }
  if (e.missT <= 0) {
    e.missT = M.rate * (rage ? 0.75 : 1); e.atkT = ATK_ANIM; e.face = Math.atan2(dy, dx);
    const n = M.n + (rage ? 1 : 0), a0 = Math.atan2(dy, dx);
    for (let k = 0; k < n; k++) { const a = a0 + (k - (n - 1) / 2) * 0.6; eshots.push({ x: e.x + Math.cos(a) * 0.8, y: e.y + Math.sin(a) * 0.8, vx: Math.cos(a) * M.speed, vy: Math.sin(a) * M.speed, type: 'rocket', dmg: bossDmg(e, M.dmg), life: M.life, home: M.turn }); }
    Snd.play('rocket', e.x, e.y);
  }
  return false;
}
// 레이저가 닿는 길이 (벽까지, 최대 max칸)
function laserLen(e, a, max) { const ca = Math.cos(a), sa = Math.sin(a); let l = 0.6; while (l < max && !blocksShot(e.x + ca * l, e.y + sa * l)) l += 0.2; return l; }
const BOSS_AI = { crusher: crusherThink, brood: broodBossThink, argus: argusThink, plague: plagueThink, void: voidThink, exec: execThink };
// 보스의 충격파: 퍼지는 고리에 닿으면 피해·밀려남 (회피 대시로 넘을 수 있음)
let waves = []; // { x, y, r, max, speed, dmg, hit, col }
function updateWaves(dt) {
  const p = player;
  for (const w of waves) {
    w.r += w.speed * dt;
    const pd = Math.hypot(p.x - w.x, p.y - w.y);
    if (!w.hit && Math.abs(pd - w.r) < 0.45 + p.r && p.dash <= 0) {
      w.hit = true;
      if (hurtPlayer(w.dmg, w.x, w.y)) { p.kx += (p.x - w.x) / (pd || 1) * 8; p.ky += (p.y - w.y) / (pd || 1) * 8; }
    }
    if (Math.random() < 0.7) { const a = rnd(0, 6.28); smoke(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, 1, '110,95,80', 0.4); }
  }
  waves = waves.filter(w => w.r < w.max);
}
// 보스 예고·효과 (조명 위에 그려 어둠 속에서도 보임): 파쇄 짐승의 돌진 경로, 처형자의 조준선·레이저, 충격파
function drawBossFx() {
  for (const e of enemies) {
    if (e.dead || !e.d.boss || !canSee(e.x, e.y)) continue;
    const C = e.d.charge;
    if (C && e.windT > 0) { // 돌진 경로: 붉은 띠 (웅크리는 동안 차오름)
      const a = Math.atan2(player.y - e.y, player.x - e.x), ca = Math.cos(a), sa = Math.sin(a), k = 1 - e.windT / C.wind;
      let L = e.r; while (L < C.speed * C.dur && !blocksShot(e.x + ca * L, e.y + sa * L)) L += 0.25;
      const w = e.r * 0.9, px = -sa * w, py = ca * w, P = (x, y) => [PX(x, y), PY(x, y)];
      const q = [P(e.x + px, e.y + py), P(e.x + ca * L + px, e.y + sa * L + py), P(e.x + ca * L - px, e.y + sa * L - py), P(e.x - px, e.y - py)];
      ctx.beginPath(); q.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
      ctx.fillStyle = `rgba(255,40,30,${0.12 + 0.22 * k})`; ctx.fill();
    }
    const B = e.laser;
    if (B) { // 처형자: 조준선 → 레이저
      const a = B.phase === 'aim' ? B.a : B.cur, len = B.phase === 'aim' ? laserLen(e, a, e.d.laser.len) : B.len || 1, ex = e.x + Math.cos(a) * len, ey = e.y + Math.sin(a) * len;
      const x0 = PX(e.x, e.y), y0 = PY(e.x, e.y) - 62, x1 = PX(ex, ey), y1 = PY(ex, ey) - 24;
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      if (B.phase === 'aim') { ctx.strokeStyle = `rgba(255,40,30,${0.35 + 0.35 * Math.sin(gtime * 40)})`; ctx.lineWidth = 1.5; ctx.stroke(); }
      else {
        ctx.strokeStyle = 'rgba(255,60,40,0.35)'; ctx.lineWidth = 12; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,120,90,0.8)'; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,220,0.95)'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    }
  }
  for (const w of waves) { // 충격파: 퍼지는 고리 (퍼질수록 엷어짐)
    const k = w.r / w.max;
    ctx.strokeStyle = `rgba(${w.col},${0.85 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 2; isoEllipse(w.x, w.y, w.r); ctx.stroke();
  }
  ctx.lineWidth = 1;
}
// 포자가 떨어질 곳: 플레이어 주변 2~4칸의 빈 바닥 (오버마인드에서 너무 멀지 않게), 없으면 오버마인드 방
function podTarget(e) {
  for (let k = 0; k < 12; k++) {
    const a = rnd(0, 6.28), r = rnd(2, 4), x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r;
    if (Math.hypot(x - e.x, y - e.y) < 11 && !collides(x, y, 0.4, false)) return { x, y };
  }
  return randomFloorIn(regions[9].exit, 0.4);
}
// 오버마인드 처치 → 정거장 자폭: 제한 시간 안에 코어 입구의 탈출정으로
function startEscape(e) {
  escape = { t: ESCAPE_TIME, alarm: 0, boom: 0, bx: e.x, by: e.y };
  exitDist = null;
  for (const l of lamps) if (l.escape) l.col = '80,255,140'; // 탈출정 가동
  Music.play(MUSIC.escape);
  msg(`⚠ 자폭 장치 가동 — ${ESCAPE_TIME}초 안에 코어 입구의 탈출정으로!`, '#ff6a5a'); tip('escape');
}
function updateEscape(dt) {
  const s = escape;
  s.t -= dt; s.alarm -= dt; s.boom -= dt;
  if (s.alarm <= 0) { s.alarm = s.t < 15 ? 0.7 : 1.4; Snd.play('alarm'); }
  // 처음 2.5초는 오버마인드 자리에서 연쇄 폭발, 그 뒤로는 플레이어 주변 여기저기서 폭발 (피해 없음)
  if (s.boom <= 0) {
    const early = s.t > ESCAPE_TIME - 2.5, a = rnd(0, 6.28), r = early ? rnd(0, 1.5) : rnd(3, 7);
    const x = (early ? s.bx : player.x) + Math.cos(a) * r, y = (early ? s.by : player.y) + Math.sin(a) * r;
    s.boom = early ? 0.18 : rnd(0.8, 1.8) * (s.t < 20 ? 0.5 : 1);
    addFx('misl', 'bcd', x, y, rnd(10, 40), 0.45, early ? 1.6 : 1.1); smoke(x, y, 6, '70,60,50', 1.5);
    flashes.push({ x, y, r: early ? 420 : 260, t: 0.3, max: 0.3, col: '255,150,60' });
    shake = Math.max(shake, early ? 12 : 5); Snd.play('explode', x, y);
  }
  if (s.t <= 0) {
    escape = null; shake = 24; hurtFlash = 1;
    flashes.push({ x: player.x, y: player.y, r: 1200, t: 0.8, max: 0.8, col: '255,200,120' });
    die('정거장 자폭에 휘말렸습니다 — 탈출 실패');
  }
}
function drawBossBar() {
  let boss = null, bd = 1e9; // 싸우는 중인 가장 가까운 보스 (구역 보스가 여럿 깨어 있을 수 있음)
  for (const e of enemies) if (e.d.boss && !e.dead && e.aggro) { const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; boss = e; } }
  if (!boss) return;
  const bw = Math.min(520, W * 0.5), x = W / 2 - bw / 2, y = 52, f = clamp(boss.hp / boss.maxhp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 6, y - 16, bw + 12, 36);
  ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ff8a5a';
  ctx.fillText(`${boss.rift ? '균열 수호자 — ' : ''}${boss.d.name}${boss.rage ? ' — 격노' : ''}`, W / 2, y);
  ctx.fillStyle = '#3a1010'; ctx.fillRect(x, y + 6, bw, 9);
  ctx.fillStyle = boss.rage ? '#ff5030' : '#c8302a'; ctx.fillRect(x, y + 6, bw * f, 9);
  ctx.strokeStyle = '#8c8574'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 6.5, bw - 1, 8);
}

// ===== 구역 임무: 섬멸(기본) · 생존자 구출 · 해킹 · 둥지 파괴 =====
let mission = null;   // 지금 서 있는 구역의 임무 { type, t: 그 구역에 머문 시간, reg, ... } (regions[n].mission)
let hackM = null;     // 진행 중인 해킹 임무
let survivors = [];   // 생존자 { x, y, r, hp, maxhp, state: wait(갇힘) | follow(동행) | safe(대피) | dead, ... }
let rescued = 0;      // 캠페인 전체에서 대피시킨 생존자 수 (저장됨, 엔딩에 표시)
// 해킹 단말기: 구역 가장 안쪽 방(다음 구역 길목)의 위쪽·왼쪽 벽에 붙여 (화면에서 벽에 가리지 않게). 문 옆·조명 자리·방 가운데는 피함
function placeHackTerminal(C, R) {
  const r = R.exit, cells = [], back = []; // [칸 i, j, 뒤쪽 벽 i, j, 앞쪽(서는 곳) i, j]
  for (let i = r.x + 1; i < r.x + r.w - 1; i++) cells.push([i, r.y, i, r.y - 1, i, r.y + 1]);
  for (let j = r.y + 1; j < r.y + r.h - 1; j++) cells.push([r.x, j, r.x - 1, j, r.x + 1, j]);
  for (let i = r.x + 1; i < r.x + r.w - 1; i++) back.push([i, r.y + r.h - 1, i, r.y + r.h, i, r.y + r.h - 2]); // 자리가 없으면 아래·오른쪽 벽
  for (let j = r.y + 1; j < r.y + r.h - 1; j++) back.push([r.x + r.w - 1, j, r.x + r.w, j, r.x + r.w - 2, j]);
  const mix = a => { for (let k = a.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [a[k], a[m]] = [a[m], a[k]]; } return a; };
  for (const [i, j, wi, wj, fi, fj] of [...mix(cells), ...mix(back)]) {
    if (tileAt(wi, wj) !== T.WALL || tileAt(fi, fj) !== T.FLOOR || DIR8.some(([dx, dy]) => tileAt(i + dx, j + dy) === T.DOOR)) continue;
    if (lamps.some(l => Math.floor(l.x) === i && Math.floor(l.y) === j) || !tryPlace([[i, j]], T.TERM, r)) continue;
    const t = { i, j, fi, fj, kind: 'hack', name: C.term, col: '110,240,220', reg: R.n };
    terminals.push(t);
    return t;
  }
  return null;
}
// 구역의 방 중 n개를 (입구·출구·거점 제외) 서로, 그리고 입구와 되도록 멀리 떨어지게
function spreadRooms(n, R) {
  const cand = R.rooms.filter(r => r !== R.entry && r !== R.exit && !r.hub), out = [];
  const far = r => Math.min(...[R.entry, ...out].map(q => Math.abs(q.cx - r.cx) + Math.abs(q.cy - r.cy)));
  while (out.length < n && cand.length) {
    let best = cand[0], bs = -1;
    for (const r of cand) { const s = far(r) + rnd(0, 8); if (s > bs) { bs = s; best = r; } }
    out.push(best); cand.splice(cand.indexOf(best), 1);
  }
  return out;
}
// 방 안에서 시작 방부터 걸어서 닿는 빈 바닥 (ok: 추가 조건)
function reachableSpot(r, rad, reach, ok = () => true) {
  for (let k = 0; k < 40; k++) {
    const q = randomFloorIn(r, rad);
    if (reach[Math.floor(q.y) * MW + Math.floor(q.x)] >= 0 && ok(q)) return q;
  }
  return { x: r.cx + 0.5, y: r.cy + 0.5 };
}
function placeSurvivors(n, R) {
  const reach = bfs(R.entry.cx, R.entry.cy), hp = SURVIVOR.hp[0] + SURVIVOR.hp[1] * R.n, rs = spreadRooms(n, R);
  for (const r of rs) {
    const p = reachableSpot(r, 0.35, reach);
    survivors.push({ x: p.x, y: p.y, r: 0.3, hp, maxhp: hp, state: 'wait', face: rnd(0, 6.28), walk: 0, moving: false, painT: 0, hitT: 0, calm: 0, deathT: 0, kx: 0, ky: 0, reg: R.n });
  }
  return rs.length;
}
// 둥지: 서로 떨어진 방마다 하나 (문 바로 옆은 피함 — 문이 계속 열려 있게 되므로)
function placeNests(n, R) {
  const reach = bfs(R.entry.cx, R.entry.cy), rs = spreadRooms(n, R);
  for (const r of rs) {
    const p = reachableSpot(r, 0.8, reach, q => !doors.some(d => Math.hypot(d.x - q.x, d.y - q.y) < 2.6));
    spawnEnemy('nest', p.x, p.y, R.n);
  }
  return rs.length;
}
// 매 프레임 (필드): 지금 구역·거점 확인, 가까운 방의 적 등장, 생존자·해킹, 돌발 상황
function updateMission(dt) {
  combatTick(dt);
  updateAssault(dt);
  trackRegion();
  spawnNear(dt);
  mission.t = (mission.t || 0) + dt;
  if (survivors.length) updateSurvivors(dt);
  updateHack(dt);
  updateArmory(dt);
  updateBeacon(dt);
  if (spots.some(sp => sp.state === 'idle' && Math.hypot(sp.x - player.x, sp.y - player.y) < 7 && canSee(sp.x, sp.y))) tip('event');
  updateEvents(dt);
}
// 구역 임무 끝 (기록 — 다시 불러와도 끝난 것으로). 구역 8은 코어로 가는 봉쇄 격벽이 열림
function missionDone(M) {
  if (!flags.missions.includes(M.reg)) flags.missions.push(M.reg);
  if (GATES[M.reg] === 'mission') { msg('보안 권한 확보 — 코어로 가는 봉쇄 격벽이 열린다', '#9f9'); Snd.play('unlock'); }
}
// 임무 보상: '고급' 이상 장비 + 골드 + 경험치
function missionReward(x, y, lv) {
  const g = MISSION_REWARD.gold * lv, xp = MISSION_REWARD.xp * lv, w = uniqueDrop(UNIQUE_DROP.mission) || setDrop(SET_DROP.mission) || randomLoot(2, 0.3);
  dropWeapon(x, y, atLeastMagic(w));
  if (Math.random() < SHELL_DROP.mission) dropWeapon(x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), randomLootShell(2)); // 스킬 쉘
  addPickup(x + rnd(-0.4, 0.4), y + rnd(-0.4, 0.4), 'gold', 'gold', g);
  gainXp(xp); addText(x, y, `+${xp} XP`, '#c9a0ff', 56);
  flashes.push({ x, y, r: 380, t: 0.5, max: 0.5, col: '255,220,120' });
  msg('임무 보상 — 장비와 보급품이 지급되었습니다', '#ffd27a');
}
// 가장 가까운 거점 패드 옆의 빈 바닥 (보상 자리 — 패드 위에 두면 줍기 전에 순간이동 창이 뜸)
function besidePad() {
  const h = nearestHubPad(player.x, player.y);
  for (const [dx, dy] of DIR8) {
    const x = h.pad.i + 0.5 + dx * 1.2, y = h.pad.j + 0.5 + dy * 1.2;
    if (!collides(x, y, 0.3, false)) return { x, y };
  }
  return { x: h.pad.i + 0.5, y: h.pad.j + 1.5 };
}
// --- 생존자 구출 ---
// 사람(플레이어·생존자)에게만 보이는 아군: 동행 중이면 가리지 않는 한 보임, 갇혀 있으면 시야 안일 때만
const survivorShown = s => s.state === 'follow'
  ? Math.hypot(s.x - player.x, s.y - player.y) < VIEW_RANGE && los(player.x, player.y, s.x, s.y)
  : canSee(s.x, s.y);
function updateSurvivors(dt) {
  const p = player, fol = [];
  for (const s of survivors) {
    if (s.state === 'dead') { s.deathT += dt; continue; }
    if (s.state === 'safe') continue;
    s.painT -= dt; s.hitT -= dt; s.calm -= dt;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 0.01;
    if (s.state === 'wait') { // 갇혀 있음: 다가오는 플레이어를 바라보다가 가까이 오면 합류
      if (d < 6) s.face += angDiff(Math.atan2(dy, dx), s.face) * Math.min(1, dt * 4);
      if (d < SURVIVOR.join && los(s.x, s.y, p.x, p.y)) {
        s.state = 'follow'; s.calm = 0;
        msg(`생존자 합류 — 보급 거점의 패드까지 데려가세요 (동행 ${survivors.filter(o => o.state === 'follow').length}명)`, MISSIONS.rescue.color);
        addText(s.x, s.y, '살았다!', '#9cf', 50); Snd.play('radio');
      }
      continue;
    }
    fol.push(s);
  }
  // 플레이어가 거점 패드에 오면 생존자는 패드로 가서 대피 (패드 둘레에 닿으면 바로)
  const hb = nearestHubPad(p.x, p.y), ex0 = hb.pad.i + 0.5, ey0 = hb.pad.j + 0.5, atPad = Math.hypot(ex0 - p.x, ey0 - p.y) < 2.5;
  fol.forEach((s, n) => {
    if (Math.hypot(ex0 - s.x, ey0 - s.y) < (atPad ? 2.2 : 1.1)) { evacuate(s); return; }
    if (s.calm <= 0 && s.hp < s.maxhp) s.hp = Math.min(s.maxhp, s.hp + 4 * dt); // 한동안 안 맞으면 회복
    // 따라가기: 줄 선 순서대로 조금씩 떨어져서, 멀수록 빨리 (최대 SURVIVOR.speed). 멀거나 가리면 길찾기
    const gx = atPad ? ex0 : p.x, gy = atPad ? ey0 : p.y, keep = atPad ? 0 : 1.3 + 0.45 * n;
    const dx = gx - s.x, dy = gy - s.y, d = Math.hypot(dx, dy) || 0.01, spd = Math.min(SURVIVOR.speed, 1 + (d - keep) * 4);
    let mvx = 0, mvy = 0;
    if (d > keep) {
      let tx = gx, ty = gy;
      if (d > 4 || !los(s.x, s.y, gx, gy)) { const st = flowStep(s); if (st) { tx = st[0]; ty = st[1]; } }
      const ex = tx - s.x, ey = ty - s.y, l = Math.hypot(ex, ey) || 1;
      mvx = ex / l; mvy = ey / l;
    }
    moveEntity(s, mvx * spd * dt, mvy * spd * dt);
    moveEntity(s, s.kx * dt, s.ky * dt); s.kx *= Math.max(0, 1 - dt * 8); s.ky *= Math.max(0, 1 - dt * 8);
    s.moving = !!(mvx || mvy);
    if (s.moving) s.walk += dt * spd * 2.4;
    s.face += angDiff(s.moving ? Math.atan2(mvy, mvx) : Math.atan2(p.y - s.y, p.x - s.x), s.face) * Math.min(1, dt * 8);
  });
  // 서로·플레이어와 겹치지 않게 (생존자가 비켜섬)
  const act = fol.filter(s => s.state === 'follow');
  for (let a = 0; a < act.length; a++) for (const o of [p, ...act.slice(a + 1)]) {
    const s = act[a], dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy), m = s.r + o.r;
    if (d < m && d > 0.001) moveEntity(s, dx / d * (m - d), dy / d * (m - d));
  }
}
function evacuate(s) {
  const M = regions[s.reg].mission, g = SURVIVOR.gold * s.reg, xp = SURVIVOR.xp * s.reg;
  s.state = 'safe'; M.saved++; rescued++; codexStat('rescued', (codex.stat.rescued || 0) + 1);
  addFx('tfog', 'abcdefghij', s.x, s.y, 0, 0.6, 0.9); Snd.play('evac', s.x, s.y);
  player.gold += g; gainXp(xp); addText(s.x, s.y, `+${g}G +${xp} XP`, '#9cf', 50);
  msg(`생존자 대피 완료 (${M.saved}/${M.n})`, MISSIONS.rescue.color);
  if (M.saved + M.lost >= M.n) { M.over = true; missionDone(M); }
  if (M.saved === M.n) { const q = besidePad(); missionReward(q.x, q.y, M.reg); } // 전원 구출
}
// 동행 중인 생존자 피격 (갇혀 있는 동안은 안전). 플레이어의 공격·폭발에는 다치지 않음
function hurtSurvivor(s, dmg, sx, sy) {
  if (s.state !== 'follow' || dmg <= 0 || safeAt(s.x, s.y)) return;
  dmg *= DIFFICULTY[difficulty].dmg;
  s.hp -= dmg; s.hitT = 0.16; s.painT = 0.25; s.calm = 4;
  blood(s.x, s.y, 4, '#a01414'); addText(s.x, s.y, `-${Math.round(dmg)}`, '#8cf', 40);
  if (sx !== undefined) { const a = Math.atan2(s.y - sy, s.x - sx); s.kx += Math.cos(a) * 2; s.ky += Math.sin(a) * 2; }
  Snd.play('survHurt', s.x, s.y);
  if (gtime - (s.warnT ?? -9) > 6) { s.warnT = gtime; msg('생존자가 공격받고 있습니다!', '#8cf'); }
  if (s.hp <= 0) survivorDie(s);
}
// 설치물(포탑·테슬라 코일) 피격 (몬스터의 근접 공격·탄환): 내구도가 다 닳으면 부서짐 (updateSkills에서 치움)
const devices = () => turrets.concat(coils, decoys);
function hurtDevice(t, dmg, sx, sy) {
  if (t.hp <= 0 || dmg <= 0) return;
  dmg *= DIFFICULTY[difficulty].dmg;
  t.hp -= dmg; t.hitT = 0.12;
  spark(t.x, t.y, 4, '#ffd27a', 2.5); addText(t.x, t.y, `-${Math.round(dmg)}`, '#bfb', 40); Snd.play('armorHit', t.x, t.y);
  if (t.hp <= 0) { t.hp = 0; t.t = 0; }
}
function survivorDie(s) {
  const M = regions[s.reg].mission;
  s.state = 'dead'; s.hp = 0; s.deathT = 0; M.lost++;
  blood(s.x, s.y, 16, '#a01414'); bloodSplat(s.x, s.y, 0.5, 'rgba(110,8,8,0.85)'); Snd.play('survDie', s.x, s.y);
  if (M.saved + M.lost >= M.n) { M.over = true; missionDone(M); msg(M.saved ? `구출 임무 끝 — ${M.n}명 중 ${M.saved}명 대피` : '생존자를 모두 잃었습니다 — 임무 실패', '#f66'); }
  else msg(`생존자 사망 — 남은 생존자 ${M.n - M.saved - M.lost}명`, '#f88');
}
// 몬스터가 노릴 생존자: 플레이어보다 가까이(4.5칸 안) 보이는 동행 생존자
// 포탑·테슬라 코일도 플레이어보다 가까이(6칸 안) 보이면 노림
function preyFor(e, dp) {
  let best = null, bd = dp * 0.85;
  const look = (o, R) => { const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < Math.min(R, bd) && los(e.x, e.y, o.x, o.y)) { best = o; bd = d; } };
  for (const s of survivors) if (s.state === 'follow') look(s, 4.5);
  for (const t of devices()) if (t.hp > 0) look(t, 6);
  return best;
}

// --- 둥지 파괴 ---
// 몇 초마다 옆에 몬스터를 낳음. 구역에 오래 있을수록 자주·많이 (둥지 하나당 max → 4분 뒤 max+2마리)
// 가만두면 둥지 둘레에 모여 있다가 플레이어를 보면 달려듦
function nestThink(e, dt, spawned) {
  const B = e.d.brood, ramp = clamp(regions[e.lv].mission.t / 240, 0, 1); // 그 구역에 머문 시간
  e.spawnT = (e.spawnT ?? rnd(2, 6)) - dt;
  if (e.spawnT > 0) return;
  e.spawnT = (B.rate + (B.min - B.rate) * ramp) * rnd(0.8, 1.2);
  const kids = [...enemies, ...spawned].filter(o => o.nestKid && !o.dead);
  if (kids.length >= B.cap || kids.filter(o => o.parent === e).length >= B.max + Math.round(ramp * 2)) return;
  for (let k = 0; k < 6; k++) {
    const a = rnd(0, 6.28), type = weighted(B.pool), x = e.x + Math.cos(a) * (e.r + 0.4), y = e.y + Math.sin(a) * (e.r + 0.4);
    if (collides(x, y, ENEMIES[type].r, false)) continue;
    const c = makeEnemy(type, x, y);
    c.parent = e; c.nestKid = true; c.aggro = e.aggro; spawned.push(c);
    e.atkT = ATK_ANIM; blood(x, y, 8, e.d.blood);
    if (e.aggro) Snd.mon(e, 'attack');
    return;
  }
}
function nestDeath(e) {
  const M = regions[e.lv].mission;
  for (let k = 0; k < 26; k++) { const a = rnd(0, 6.28), s = rnd(1, 5); parts.push({ x: e.x, y: e.y, z: rnd(10, 40), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(60, 160), g: 320, life: rnd(0.5, 1), max: 1, col: pick(['#c46', '#8a1c3a', '#e07090', '#5a0e22']), size: rnd(3, 6) }); }
  bloodSplat(e.x, e.y, 1.1, 'rgba(120,20,50,0.85)');
  flashes.push({ x: e.x, y: e.y, r: 360, t: 0.4, max: 0.4, col: '230,80,160' }); shake = Math.max(shake, 8);
  if (M.type !== 'nest') return;
  M.left--;
  msg(M.left ? `둥지 파괴 (${M.n - M.left}/${M.n})` : '모든 둥지 파괴!', MISSIONS.nest.color);
  if (M.left) return;
  missionReward(e.x, e.y, M.reg); missionDone(M);
}

// --- 해킹 ---
function startHack(t) {
  const M = t.m;
  if (!M || M.on) return;
  M.on = true; hackM = M; Snd.play('hack', t.i + 0.5, t.j + 0.5);
  msg(`해킹 시작 — ${M.time}초 동안 단말기 곁을 지켜라! 적 무리가 몰려온다`, MISSIONS.hack.color);
}
// 단말기에서 r칸 안에 있는 동안만 진행 (벗어나면 멈춤). 진행 gap초마다 적 무리, 마지막 무리에는 정예
function updateHack(dt) {
  const M = hackM, H = MISSIONS.hack;
  if (!M || !M.on || M.done) return;
  const t = M.term;
  M.near = Math.hypot(player.x - t.i - 0.5, player.y - t.j - 0.5) < H.r;
  if (!M.near) {
    if (gtime - (M.warnT ?? -9) > 5) { M.warnT = gtime; msg('단말기에서 멀어져 해킹이 멈췄습니다 — 돌아가세요', '#f96'); }
    return;
  }
  const q0 = Math.floor(M.prog / M.time * 4);
  M.prog = Math.min(M.time, M.prog + dt);
  if (M.prog >= M.nextWave && M.prog < M.time) { hackWave(M.nextWave + H.gap >= M.time); M.nextWave += H.gap; }
  if (M.prog < M.time) { if (Math.floor(M.prog / M.time * 4) > q0) msg(`데이터 전송 ${Math.round(M.prog / M.time * 100)}%`, H.color); return; }
  M.done = true; hackM = null; Snd.play('hackDone', t.i + 0.5, t.j + 0.5);
  missionReward(t.fi + 0.5, t.fj + 0.5, M.reg); missionDone(M);
}
// 적 무리: 단말기에서 걸어서 9~20칸 떨어진, 지금 보이지 않는 곳 두 군데에서 나타나 곧장 달려옴
function hackWave(last) { const M = hackM; spawnWave(M.term.fi, M.term.fj, M.reg, MISSIONS.hack.wave * (last ? 1.6 : 1), last); }
// (fi, fj)에서 걸어서 9~20칸 떨어진, 지금 보이지 않는 곳 두 군데에서 적이 나타나 곧장 달려옴 (mult: 방 하나 위협 예산의 배율, last: 정예 하나)
function spawnWave(fi, fj, reg, mult, last) {
  if (enemies.filter(e => e.wave).length >= 40) return; // 이미 많이 몰려와 있으면 이번 무리는 건너뜀
  const blocked = new Uint8Array(MW * MH);
  for (const d of doors) if (d.locked) for (const c of d.cells) blocked[c] = 1;
  const dist = bfs(fi, fj, blocked), find = (lo, hi) => {
    const out = [];
    for (let k = 0; k < MW * MH; k++) if (dist[k] >= lo && dist[k] <= hi && tiles[k] === T.FLOOR && !visMark[k] && !safeMap[k]) out.push(k);
    return out;
  };
  let cand = find(9, 20);
  if (!cand.length) cand = find(6, 99);
  if (!cand.length) return;
  const pts = [pick(cand), pick(cand)], pool = enemyPool(reg), made = [];
  let left = (ROOM_BUDGET[0] + ROOM_BUDGET[1] * reg) * mult;
  for (let a = 0; a < 90 && left > 0.3 && made.length < 24; a++) {
    const type = weighted(pool), k = pts[made.length % 2], x = k % MW + 0.5 + rnd(-1.6, 1.6), y = Math.floor(k / MW) + 0.5 + rnd(-1.6, 1.6);
    if (collides(x, y, ENEMIES[type].r, false)) continue;
    const e = spawnEnemy(type, x, y, reg);
    e.aggro = true; e.wave = true; left -= ENEMIES[type].cost; made.push(e);
    addFx('tfog', 'abcdefghij', x, y, 0, 0.5, 0.8);
  }
  const elig = made.filter(e => !e.d.bomb);
  if (last && elig.length) makeElite(pick(elig), irnd(1, ELITE_AFFIX_MAX[reg - 1]));
  Snd.play('alarm'); msg(last ? '⚠ 마지막 적 무리 — 정예 개체 반응!' : '⚠ 적 무리 접근!', '#f96');
}

// 화면 왼쪽 위 목표 표시: { t: 글, col: 글자색, edge: 테두리색, frac: 진행 막대 (해킹) } — 지금 구역의 임무, 없으면 구역 이름과 길목 상태
function objectiveBox() {
  if (rift) return riftBox();
  const M = mission, R = regions[level];
  if (!R) return null;
  if (armoryOn) { // 무기고 해제 중
    const t = armoryOn;
    return { t: `무기고 해제 ${Math.floor(t.prog / t.A.time * 100)}% — ${t.near ? '단말기 곁을 지켜라' : '단말기로 돌아가라!'}`, col: t.near ? '#ffd27a' : Math.sin(gtime * 8) > 0 ? '#fff' : '#ffb08a', edge: t.near ? '#ffb060' : '#f86', frac: t.prog / t.A.time };
  }
  if (beaconOn) { // 조난 신호기 송신 중
    const sp = beaconOn, B = FIELD_EVENTS.beacon;
    return { t: `조난 신호기 ${Math.floor(sp.prog / B.time * 100)}% — ${sp.near ? '곁을 지켜라' : '신호기로 돌아가라!'}`, col: sp.near ? '#ffd27a' : Math.sin(gtime * 8) > 0 ? '#fff' : '#ffb08a', edge: sp.near ? '#ffb060' : '#f86', frac: sp.prog / B.time };
  }
  if (M.type === 'rescue' && !M.over) {
    const f = survivors.filter(s => s.state === 'follow' && s.reg === level).length;
    return { t: `생존자 구출 — 대피 ${M.saved}/${M.n}${f ? ` · 동행 ${f}` : ''}${M.lost ? ` · 사망 ${M.lost}` : ''}`, col: '#9cf', edge: '#7fc8ff' };
  }
  if (M.type === 'hack' && !M.done) {
    if (!M.on) return { t: `해킹 — ${M.term.name}에서 [F]`, col: '#8ff0e0', edge: '#6ff0d8' };
    return { t: `해킹 ${Math.floor(M.prog / M.time * 100)}% — ${M.near ? '단말기 곁을 지켜라' : '단말기로 돌아가라!'}`, col: M.near ? '#8ff0e0' : Math.sin(gtime * 8) > 0 ? '#fff' : '#ffb08a',
      edge: M.near ? '#6ff0d8' : '#f86', frac: M.prog / M.time };
  }
  if (M.type === 'nest' && M.left > 0) return { t: `둥지 파괴 ${M.n - M.left}/${M.n}`, col: '#f0a8ff', edge: '#e07aff' };
  const shut = GATES[level] && !gateOpen(level), name = `구역 ${level} ${CAMPAIGN[level - 1].name}`;
  if (shut) return { t: `${name} — ${GATES[level] === 'boss' ? `${ENEMIES[bossKindFor(level)].name}이(가) 길목을 막고 있다` : '통제 단말기를 해킹해 코어 격벽을 열어라'}`, col: '#ffb08a', edge: '#f86' };
  return { t: name, col: '#cfe8c8', edge: '#5a6a50' };
}
// ===== 구역 돌발 상황: 정전 · 독가스 누출 · 선체 파손 (EVENTS, EVENT_PLAN) =====
let eventClock = 0, nextEvent = 0, lastEvent = null; // 돌발 상황 시계, 다음 시각, 지난번 종류
let hazards = [];   // 진행 중인 사건 { type, t: 남은 시간, max, ... }
const isBlackout = () => hazards.some(h => h.type === 'blackout');
// 구역 EVENT_PLAN.from부터 (보급 거점 안·코어·탈출 중 제외): 처음엔 at초 무렵, 그 뒤로 gap초마다 chance 확률로 (지난번과 다른 종류)
function updateEvents(dt) {
  const P = EVENT_PLAN;
  eventClock += dt;
  if (!nextEvent) nextEvent = rnd(...P.at);
  if (eventClock >= nextEvent) {
    if (hazards.length || level < P.from || level >= CAMPAIGN.length || inHub() || escape) nextEvent = eventClock + 10;
    else if (Math.random() >= P.chance) nextEvent = eventClock + rnd(...P.gap);
    else {
      const type = pick(Object.keys(EVENTS).filter(k => k !== lastEvent));
      if (startEvent(type)) { lastEvent = type; nextEvent = eventClock + rnd(...P.gap); } else nextEvent = eventClock + 10; // 일어날 자리가 없으면 조금 뒤에
    }
  }
  for (const h of hazards) { h.t -= dt; tickEvent(h, dt); if (h.t <= 0) endEvent(h); }
  hazards = hazards.filter(h => h.t > 0);
}
function startEvent(type) {
  const E = EVENTS[type], p = player, h = { type, t: E.time, max: E.time };
  if (type === 'blackout') { // 조명이 모두 꺼지고 근처 몬스터가 몰려옴
    for (const e of enemies) if (!e.d.fixed && Math.hypot(e.x - p.x, e.y - p.y) < E.aggro) aggro(e);
    msg('⚠ 정전 — 조명이 모두 꺼졌다. 어둠 속에서 무언가 다가온다', E.color); Snd.play('alarm');
  } else if (type === 'gas') { // 플레이어가 있는 방(통로면 가까운 방)의 배관이 터짐
    const r = gasRoom();
    if (!r) return false;
    const pipes = [];
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) if (tileAt(i, j) === T.PIPEX || tileAt(i, j) === T.PIPEY) pipes.push({ x: i + 0.5, y: j + 0.5 });
    const src = pipes.length ? pick(pipes) : randomFloorIn(r, 0.3);
    Object.assign(h, { room: r, sx: src.x, sy: src.y, n: clamp(Math.round(r.w * r.h / 14), ...E.clouds), made: 0, next: 0, hiss: 0 }); // 알림은 배관 위의 표지 (drawHazardLabels)
    Snd.play('alarm');
  } else { // 선체 파손: 가까운 벽이 뚫려 빨아들임 — 알림은 구멍 위의 표지
    const b = breachSpot();
    if (!b) return false;
    Object.assign(h, b, { wind: 0, hurtT: 0.5, jag: Array.from({ length: 11 }, () => rnd(0.75, 1.15)), stars: Array.from({ length: 7 }, () => [rnd(-0.6, 0.6), rnd(-0.6, 0.6)]) });
    Snd.play('explode', h.x, h.y); Snd.play('alarm'); shake = Math.max(shake, 12);
    flashes.push({ x: h.x, y: h.y, r: 520, t: 0.4, max: 0.4, col: '170,210,255' }); spark(h.x, h.y, 24, '#dde', 6);
  }
  hazards.push(h); tip(type);
  return true;
}
function gasRoom() {
  const p = player, ri = roomOf[Math.floor(p.y) * MW + Math.floor(p.x)];
  if (ri >= 0 && !rooms[ri].hub) return rooms[ri];
  let best = null, bd = 12;
  for (const r of rooms) { const d = Math.hypot(r.cx + 0.5 - p.x, r.cy + 0.5 - p.y); if (!r.hub && d < bd) { bd = d; best = r; } } // 보급 거점(안전 지대)은 빼고
  return best;
}
// 선체가 뚫릴 자리: 플레이어에게서 4~9칸 떨어진, 보이는 벽 면(바닥이 아래·오른쪽에 있는 면 — 화면에 그려지는 면)의 가운데. 문 근처는 피함
function breachSpot() {
  const p = player, i0 = Math.floor(p.x), j0 = Math.floor(p.y), cand = [];
  for (let j = j0 - 9; j <= j0 + 9; j++) for (let i = i0 - 9; i <= i0 + 9; i++) {
    if (tileAt(i, j) !== T.WALL) continue;
    for (const [di, dj] of [[0, 1], [1, 0]]) {
      const fi = i + di, fj = j + dj, x = (i + fi) / 2 + 0.5, y = (j + fj) / 2 + 0.5, d = Math.hypot(x - p.x, y - p.y);
      if (tileAt(fi, fj) !== T.FLOOR || safeMap[fj * MW + fi] || d < 4 || d > 9 || !los(p.x, p.y, fi + 0.5, fj + 0.5) || doors.some(o => Math.hypot(o.x - x, o.y - y) < 2.5)) continue;
      cand.push({ x, y, side: dj ? 1 : -1, fi, fj, room: roomOf[fj * MW + fi] }); // side: 벽 면이 화면에서 기운 방향, room: 구멍이 난 방 (통로면 -1)
    }
  }
  return cand.length ? pick(cand) : null;
}
function tickEvent(h, dt) {
  if (h.type === 'gas') {
    h.next -= dt; h.hiss -= dt;
    if (h.made < h.n && h.next <= 0 && h.t > 6) { // 1.2초마다 방 안에 독가스 구름 하나씩 — 이미 낀 구름에서 가장 먼 곳에 (방이 고르게 참, 끝날 때 함께 걷힘)
      h.next = 1.2;
      const own = areas.filter(a => a.leak), far = q => Math.min(...own.map(a => Math.hypot(a.x - q.x, a.y - q.y)));
      let q = { x: h.sx, y: h.sy };
      if (h.made) for (let k = 0, best = -1; k < 10; k++) { const c = randomFloorIn(h.room, 0.3), f = far(c); if (f > best) { best = f; q = c; } }
      areas.push({ type: 'gas', x: q.x, y: q.y, r: EVENTS.gas.r, t: h.t, max: h.max, leak: true, room: h.room }); // room: 안개를 그 방 바닥 안에서만 그림
      h.made++;
    }
    if (h.hiss <= 0) { h.hiss = 3; Snd.play('gas', h.sx, h.sy); } // 터진 배관에서 솟는 가스 기둥은 drawGasFog
  } else if (h.type === 'breach') {
    const E = EVENTS.breach, p = player, gust = Math.min(1, (h.max - h.t) / 0.5); // 처음 0.5초 동안 세짐
    // 구멍 쪽으로 끌어당김 (가까울수록 셈, 회피 중에는 안 끌림), 큰 적·보스는 덜, 고정된 것(둥지·오버마인드)은 그대로
    // 같은 방(구멍이 통로면 통로)에 있고 구멍이 보이는 것만 — 다른 방·벽 너머는 끌려가지 않음
    const near = o => roomOf[Math.floor(o.y) * MW + Math.floor(o.x)] === h.room && los(o.x, o.y, h.fi + 0.5, h.fj + 0.5);
    const pull = (o, k) => {
      const dx = h.x - o.x, dy = h.y - o.y, d = Math.hypot(dx, dy);
      if (d >= E.r || !near(o)) return 99;
      if (d > 0.05) { const f = E.pull * gust * (1 - d / E.r) * k; moveEntity(o, dx / d * f * dt, dy / d * f * dt); } // 멀수록 약해짐
      return d;
    };
    const dp = pull(p, p.dash > 0 || inHub() ? 0 : 1); // 회피 중·안전 지대 안에서는 안 끌림
    if ((h.hurtT -= dt) <= 0 && dp < 1.3) { h.hurtT = 0.5; hurtPlayer(E.dps * 0.5, h.x, h.y); } // 구멍 바로 앞: 감압 피해
    for (const e of enemies) {
      if (e.dead || e.d.fixed) continue;
      const d = pull(e, e.d.boss ? 0.25 : e.r >= 0.5 ? 0.5 : 1);
      if (d < 0.75 && e.r < 0.5 && !e.d.boss) { // 작은 몬스터는 구멍으로 빨려 나감
        e.voided = true; e.hp = 0; killEnemy(e);
        h.lost = (h.lost || 0) + 1; // 알림은 구멍 위 표지 바로 위에 (빨려 나갈 때마다 수를 고침)
        const t = `몬스터 ${h.lost}마리가 우주로 빨려 나갔다`;
        if (h.lostNote && h.lostNote.until > gtime) { h.lostNote.t = t; h.lostNote.until = gtime + 2.5; }
        else eventNotes.push(h.lostNote = { x: h.x, y: h.y, z: 138, t, col: E.color, until: gtime + 2.5 });
      }
    }
    if (Math.random() < dt * 40) { // 빨려 들어가는 먼지
      const a = rnd(0, 6.28), r = rnd(1.5, 6), x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r, s = rnd(6, 10);
      if (!blocksShot(x, y)) parts.push({ x, y, z: rnd(5, 40), vx: (h.x - x) / r * s, vy: (h.y - y) / r * s, vz: 0, g: 0, life: r / s, max: r / s, col: pick(['#9aa', '#ccd', '#778']), size: rnd(2, 3) });
    }
    if ((h.wind -= dt) <= 0) { h.wind = 0.3; Snd.play('wind'); }
  }
}
function endEvent(h) {
  if (h.type === 'blackout') { msg('비상 전원 복구 — 조명이 다시 들어온다', '#9f9'); Snd.play('unlock'); }
  else if (h.type === 'gas') eventNotes.push({ x: h.sx, y: h.sy, z: 118, t: '배관 차단 — 독가스가 걷힌다', col: '#9f9', until: gtime + 3 });
  else { eventNotes.push({ x: h.x, y: h.y, z: 86, t: '비상 격벽이 구멍을 막았다', col: '#9cf', until: gtime + 3 }); Snd.play('doorClose', h.x, h.y); spark(h.x, h.y, 12, '#ffd27a', 3); }
}
// 돌발 상황 표지 (화면 위 대신 그 자리에): 독가스는 터진 배관 위, 선체 파손은 구멍 위 — 이름 · 할 일 · 남은 시간 고리. 화면 밖이면 가장자리에 붙고 화살표로 가리킴
let eventNotes = []; // 끝난 자리에 잠깐 남는 글 { x, y, z, t, col, until }
function drawHazardLabels() {
  const box = (wx, wy, z, title, sub, col, frac) => {
    ctx.font = 'bold 14px sans-serif'; const w1 = ctx.measureText(title).width + (frac === undefined ? 0 : 26);
    ctx.font = '11px sans-serif'; const w2 = sub ? ctx.measureText(sub).width : 0;
    const w = Math.max(w1, w2) + 22, h = sub ? 40 : 24, ax = PX(wx, wy), ay = PY(wx, wy) - z + Math.sin(gtime * 3) * 3;
    const sx0 = PX(wx, wy), sy0 = PY(wx, wy), off = sx0 < 0 || sx0 > W || sy0 < 0 || sy0 > VH; // 그 자리가 화면 밖: 가장자리로 (위쪽 목표·메시지, 아래 스킬 칸은 피해서)
    const x = off ? clamp(ax, w / 2 + 14, W - w / 2 - 14) : clamp(ax, w / 2 + 8, W - w / 2 - 8), y = off ? clamp(ay, h + 170, VH - 96) : Math.max(ay, h + 8); // 화면 안이면 위로 넘치지만 않게
    ctx.fillStyle = 'rgba(8,10,8,0.8)'; rr(x - w / 2, y - h, w, h, 5); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = col; ctx.beginPath(); // 아래 꼭지 (화면 밖이면 그쪽을 가리키는 화살표)
    if (off) { const a = Math.atan2(ay - y, ax - x), cx = x + Math.cos(a) * (w / 2 + 8) * 0.9, cy = y - h / 2 + Math.sin(a) * (h / 2 + 10); ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); ctx.lineTo(cx + Math.cos(a + 2.4) * 7, cy + Math.sin(a + 2.4) * 7); ctx.lineTo(cx + Math.cos(a - 2.4) * 7, cy + Math.sin(a - 2.4) * 7); }
    else { ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 7); }
    ctx.fill();
    ctx.textAlign = 'center'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = col; ctx.fillText(title, x - (frac === undefined ? 0 : 13), y - h + 18);
    if (sub) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#d8dccf'; ctx.fillText(sub, x, y - 8); }
    if (frac !== undefined) { // 남은 시간 고리
      const cx = x + w1 / 2 - 4, cy = y - h + 13;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke(); ctx.lineWidth = 1;
    }
  };
  for (const h of hazards) {
    if (h.type === 'blackout') continue;
    const E = EVENTS[h.type], gas = h.type === 'gas', blink = h.t < 4 && Math.sin(gtime * 10) < 0;
    box(gas ? h.sx : h.x, gas ? h.sy : h.y, gas ? 118 : 86, `⚠ ${E.name}`, gas ? '해독제 [8] · 이 방을 벗어나라' : '우주로 빨려 나간다 — 구멍에서 멀어져라', blink ? '#fff' : E.color, h.t / h.max);
  }
  const A = assault; // 거점 습격: 패드 위에 경보 (카운트다운 고리) → 몇 번째 무리 · 안전막 남은 정도 (고리) · 남은 적
  if (A && A.phase !== 'wait') {
    const h = A.hub, warn = A.phase === 'warn';
    box(h.pad.i + 0.5, h.pad.j + 0.5, 130, warn ? `⚠ 거점 습격 임박 — ${Math.ceil(A.t)}초` : `⚠ 거점 습격 ${A.wave}/${ASSAULT.waves}`,
      warn ? '몬스터 무리가 몰려온다 — 거점 안에서도 싸울 수 있다' : A.broke ? `안전막 붕괴! 남은 적 ${A.foes.size}` : `안전막 ${Math.max(0, Math.round(A.hp / A.max * 100))}% · 남은 적 ${A.foes.size}`,
      A.hitT > 0 && Math.sin(gtime * 30) > 0 ? '#fff' : '#ff9a6a', warn ? A.t / ASSAULT.warn : A.broke ? 0 : Math.max(0, A.hp / A.max));
  }
  eventNotes = eventNotes.filter(n => n.until > gtime);
  for (const n of eventNotes) { ctx.globalAlpha = clamp(n.until - gtime, 0, 1); box(n.x, n.y, n.z, n.t, '', n.col); ctx.globalAlpha = 1; }
}
// 선체에 뚫린 구멍 (벽 면에 맞춰 기울인 들쭉날쭉한 검은 구멍 + 별 + 얼어붙은 테두리)
function drawBreach(h) {
  const r = (h.r0 || 17) * Math.min(1, (h.max - h.t) / 0.3), n = h.jag.length; // r0: 오프닝 컷신의 큰 구멍
  ctx.save(); ctx.translate(PX(h.x, h.y), PY(h.x, h.y) - 34); ctx.transform(1, h.side * 0.5, 0, 1, 0, 0);
  ctx.beginPath();
  h.jag.forEach((j, k) => { const a = k / n * Math.PI * 2, x = Math.cos(a) * r * j, y = Math.sin(a) * r * 1.25 * j; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
  ctx.strokeStyle = `rgba(160,215,255,${0.55 + 0.3 * Math.sin(gtime * 20)})`; ctx.lineWidth = 2; ctx.stroke();
  for (const [sx, sy] of h.stars) circle(sx * r, sy * r * 1.25, 1, '#dde6ff');
  ctx.restore();
}

// ===== 액티브 스킬: 스킬 쉘을 인벤토리의 스킬 칸(Z X V B)에 끼워서 씀 (SKILLS, SHELL_*, ATTRS) =====
let turrets = [], mines = [], rings = [], drones = [], coils = [], wells = []; // 포탑, 지뢰, 퍼지는 고리, 드론, 테슬라 코일, 중력장
let decoys = [], delayed = []; // 잔상 (유령 발자국), 조금 뒤에 일어날 스킬 효과 { t, fn }
const later = (t, fn) => delayed.push({ t, fn });
const SKILL_KEYS = Object.fromEntries(SHELL_SLOTS.map((k, n) => ['Key' + k, n])); // 키 → 스킬 칸 번호
const skillScale = () => 1 + 0.15 * (level - 1); // 구역이 깊을수록 센 피해
const SKILL_SHOT = { type: 'skill', crit: 0, elem: null }; // 스킬이 쏜 탄 (무기 옵션·집중 사격 치명타 없음)
const CLOAK_NEAR = 1.6; // 은신 중에도 이만큼 가까운 적은 알아챔
const buff = k => { const b = player.sk[k]; return b && b.t > 0 ? b : null; }; // 지속 중인 스킬 효과 { t, max, ... }
// --- 능력치: 투자한 점수 + 장착한 쉘의 능력치 옵션 ---
const ATTR_KEYS = Object.keys(ATTRS);
function affixSum(sh, k, type) { let s = 0; for (const a of sh.affixes) if (a.k === k && (!type || a.type === type)) s += a.v; return s; }
const gearAttr = k => player.shells.reduce((s, sh) => s + (sh ? affixSum(sh, 'stat', k) : 0), 0) + gearV('stat', k); // 쉘 + 방어구
const attrV = k => (player.attr[k] || 0) + gearAttr(k);
// 장착한 스킬에 이 능력치가 주는 효과 (성장 창 설명)
function attrEffects(k) {
  const v = attrV(k), out = [];
  for (const sh of player.shells) {
    if (!sh) continue;
    const S = SKILLS[sh.id];
    for (const [q, [a, per]] of Object.entries(S.st)) if (a === k) out.push(`${S.name} ${PARAM_NAME[q]} +${SKILL_PARAM[q] === 'n' ? Math.floor(v * per) : Math.round(v * per * 100) + '%'}`);
  }
  return out;
}

// --- 스킬 쉘 아이템: 가방·창고 격자 1칸 (kind: 'shell', id: 스킬) ---
const SHELL_S = { size: [1, 1], weight: 0 };
function buildShell(id, rarity, affixes, uq = false) {
  const sh = { uid: uidSeq++, kind: 'shell', id, rarity, affixes, gx: 0, gy: 0, s: SHELL_S };
  if (uq && SHELL_UNIQUES[id]) sh.uq = true; // 고유 전설 (SHELL_UNIQUES: 이름·정해진 옵션·바뀌는 동작)
  refreshShell(sh);
  return sh;
}
function refreshShell(sh) {
  if (sh.uq) { sh.name = SHELL_UNIQUES[sh.id].name; return; }
  const top = sh.affixes[0]; sh.name = `${top ? (top.k === 'stat' ? ATTRS[top.type].prefix : SHELL_AFFIXES[top.k].prefix) + ' ' : ''}${SKILLS[sh.id].name} 쉘`;
}
const makeUniqueShell = id => buildShell(id, 4, SHELL_UNIQUES[id].affixes.map(a => ({ ...a })), true);
// chance 확률로 이 구역에서 나올 수 있는 스킬의 고유 전설 쉘, 아니면 null
function uniqueShellDrop(chance) {
  const ids = Object.keys(SHELL_UNIQUES).filter(k => SKILLS[k].from <= level + 1);
  return ids.length && Math.random() < chance ? makeUniqueShell(pick(ids)) : null;
}
// 계열 공명: 끼운 쉘 중 같은 계열(주 능력치)이 2·3·4개면 1·2·3단계
const resTier = stat => { const n = player.shells.filter(sh => sh && SKILLS[sh.id].stat === stat).length; return n >= 4 ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0; };
const resV = stat => { const t = resTier(stat); return t ? RESONANCE[stat].v[t - 1] : 0; };
const RES_LABEL = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'];
const resonanceText = k => { const t = resTier(k); return t ? `${ATTRS[k].name} 공명 ${RES_LABEL[t]} — ${ATTRS[k].name} 스킬 위력 +${pct(RESONANCE.pow[t - 1])} · ${RESONANCE[k].text(RESONANCE[k].v[t - 1])}` : ''; };
// 옵션 하나 (높은 등급일수록 좋은 수치). 능력치는 그 스킬이 쓰는 것이 잘 나오고, 같은 쉘의 다른 능력치 옵션과 겹치지 않게
function rollShellAffix(id, rarity, k, others = []) {
  const A = SHELL_AFFIXES[k], q = clamp(Math.random() * 0.7 + rarity * 0.1, 0, 1), v = A.min + (A.max - A.min) * q, a = { k, v: A.int ? Math.round(v) : v };
  if (k === 'stat') {
    const own = [...new Set(Object.values(SKILLS[id].st).map(s => s[0]))], used = others.filter(b => b.k === 'stat').map(b => b.type);
    const cand = (Math.random() < 0.6 ? own : ATTR_KEYS).filter(t => !used.includes(t));
    a.type = pick(cand.length ? cand : ATTR_KEYS.filter(t => !used.includes(t)));
  }
  return a;
}
// 등급만큼 옵션을 굴림: 위력·대기시간·능력치(둘까지) + 그 스킬 전용 옵션
function makeShell(id, rarity = 0) {
  const pool = ['pow', 'cd', 'stat', 'stat', ...SKILLS[id].mods], affixes = [], [lo, hi] = RARITY[rarity].affixes;
  for (let n = irnd(lo, hi); n > 0 && pool.length; n--) affixes.push(rollShellAffix(id, rarity, pool.splice(Math.floor(Math.random() * pool.length), 1)[0], affixes));
  return buildShell(id, rarity, affixes);
}
// 이 구역에서 나올 수 있는 스킬 중 하나 (from 구역부터)
function randomLootShell(bonus = 0) {
  return makeShell(pick(Object.keys(SKILLS).filter(k => SKILLS[k].from <= level + 1)), rollRarity(bonus));
}
// 쉘의 지금 수치: 기본 x 등급·옵션(위력·범위·지속·제어) x 능력치, 개수는 더하기, 피해는 구역 배율. cd: 대기시간
function shellVals(sh) {
  const S = SKILLS[sh.id], out = {}, rt = resTier(S.stat);
  for (const k in S.v) {
    const kind = SKILL_PARAM[k], st = S.st[k];
    let x = S.v[k];
    if (kind === 'pow') x *= (1 + SHELL_POW[sh.rarity]) * (1 + affixSum(sh, 'pow')) * (1 + (rt ? RESONANCE.pow[rt - 1] : 0)); // 계열 공명: 위력
    else if (kind === 'n') x += affixSum(sh, 'n');
    else if (kind) x *= 1 + affixSum(sh, kind);
    if (st) x = kind === 'n' ? x + Math.floor(attrV(st[0]) * st[1]) : x * (1 + attrV(st[0]) * st[1]);
    if (k === 'dmg' || k === 'hp') x *= skillScale(); // 피해·포탑 내구도는 구역이 깊을수록 큼
    if (kind === 'dur' && S.stat === 'tec') x *= 1 + resV('tec'); // 기술 공명: 지속
    if (kind === 'r') x *= 1 + resV('psi');                      // 정신 공명: 범위
    out[k] = x;
  }
  out.uq = !!sh.uq; // 고유 전설: 스킬마다 바뀌는 동작 (SKILL_CAST)
  out.cd = S.cd * (1 - affixSum(sh, 'cd')) * (1 - gearV('cdr')); // 쉘 옵션, 헬멧 옵션
  return out;
}
// 설명용 반올림: 위력·개수는 정수, 범위·시간은 소수 한 자리, 비율(치명타·기습·흡수)은 그대로
function shellDisplay(v) {
  const d = {};
  for (const k in v) { const kind = SKILL_PARAM[k]; d[k] = kind === 'pow' || kind === 'n' ? Math.round(v[k]) : kind ? Math.round(v[k] * 10) / 10 : v[k]; }
  return d;
}
function shellTooltip(sh) {
  const S = SKILLS[sh.id], R = RARITY[sh.rarity], v = shellVals(sh), k = player.shells.indexOf(sh), L = [];
  L.push({ t: (sh.uq ? '★ ' : '') + sh.name, c: R.color, b: true });
  L.push({ t: `${R.name} 스킬 쉘 · ${sh.uq ? S.name + ' · ' : ''}${ATTRS[S.stat].name} 계열${k >= 0 ? ` · [${SHELL_SLOTS[k]}] 칸에 장착` : ''}`, c: '#9a9' });
  for (const t of wrapWords(S.desc(shellDisplay(v)), 32)) L.push({ t, c: '#e8dcc0' });
  if (sh.uq) { // 고유 전설: 바뀌는 동작 + 붉은 글씨 한 줄
    const U = SHELL_UNIQUES[sh.id];
    for (const [n, t] of wrapWords(U.effect, 32).entries()) L.push({ t: (n ? '   ' : '◆ ') + t, c: '#ffcf70' });
    L.push({ t: `"${U.flavor}"`, c: '#d0604a' });
  }
  L.push({ t: `대기시간 ${v.cd.toFixed(1)}초${SHELL_POW[sh.rarity] ? ` · 등급 보너스 위력 +${pct(SHELL_POW[sh.rarity])}` : ''}`, c: '#ccc' });
  for (const [q, [a, per]] of Object.entries(S.st)) // 이 스킬이 쓰는 능력치
    L.push({ t: `${PARAM_NAME[q]} ← ${ATTRS[a].name} ${SKILL_PARAM[q] === 'n' ? `${Math.round(1 / per)}점마다 +1` : `1점당 +${+(per * 100).toFixed(1)}%`} (지금 ${attrV(a)})`, c: ATTRS[a].color });
  for (const a of sh.affixes) L.push({ t: SHELL_AFFIXES[a.k].text(a.v, a.type), c: a.k === 'stat' ? ATTRS[a.type].color : '#8af' });
  const eq = player.shells.find(s => s && s.id === sh.id);
  if (eq && eq !== sh) { // 같은 스킬을 끼고 있으면 첫 수치와 대기시간 비교
    const ev = shellVals(eq), q = Object.keys(S.v)[0], a = shellDisplay(ev)[q], b = shellDisplay(v)[q];
    const gain = v[q] / ev[q] - v.cd / ev.cd;
    L.push({ t: `장착 중인 쉘과 비교: ${PARAM_NAME[q]} ${a} → ${b} · 대기 ${ev.cd.toFixed(1)} → ${v.cd.toFixed(1)}초`, c: gain >= 0 ? '#7f7' : '#f77' });
  }
  if (resTier(S.stat)) L.push({ t: resonanceText(S.stat), c: ATTRS[S.stat].color }); // 계열 공명
  return L;
}
const itemLines = inst => inst.kind === 'gem' ? gemTooltip(inst) : inst.kind === 'shell' ? shellTooltip(inst) : inst.kind === 'armor' ? armorTooltip(inst) : tooltipLines(inst); // 무기·쉘·방어구·보석 툴팁

// --- 장착 (스킬 칸 4개, 같은 스킬은 한 칸에만) ---
const shellSlotOf = id => player.shells.findIndex(s => s && s.id === id);
// 새로 얻은 쉘: 같은 스킬이 없고 빈 칸이 있으면 장착, 아니면 가방. 실패하면 null
function addShell(sh) {
  const p = player, k = p.shells.indexOf(null);
  if (k >= 0 && shellSlotOf(sh.id) < 0) { p.shells[k] = sh; return 'equip'; }
  const spot = bagFindSpot(sh);
  if (!spot) return null;
  sh.gx = spot.gx; sh.gy = spot.gy; p.bag.push(sh);
  return 'bag';
}
// 가방의 쉘 우클릭: 같은 스킬을 낀 칸과 바꾸거나 빈 칸에
function equipShellFromBag(sh) {
  const p = player, same = shellSlotOf(sh.id), k = same >= 0 ? same : p.shells.indexOf(null);
  if (k < 0) { msg('빈 스킬 칸이 없습니다 — 끌어다 놓아 바꾸세요', '#f99'); Snd.play('deny'); return; }
  const old = p.shells[k];
  removeFromBag(sh); p.shells[k] = sh;
  if (old) { old.gx = sh.gx; old.gy = sh.gy; p.bag.push(old); } // 1칸짜리라 빠진 자리에 그대로 들어감
  Snd.play('pickup');
}
function unequipShell(k) {
  const p = player, sh = p.shells[k], spot = sh && bagFindSpot(sh);
  if (!sh) return;
  if (!spot) { msg('가방에 공간이 없습니다', '#f99'); return; }
  p.shells[k] = null; sh.gx = spot.gx; sh.gy = spot.gy; p.bag.push(sh);
}

// --- 사용 ---
function useSkillSlot(n) {
  const p = player, sh = p.shells[n];
  if (inBase) return;
  if (inHub() && !contested()) { noFight(); Snd.play('deny'); return; }
  if (!sh) { msg(`[${SHELL_SLOTS[n]}] 스킬 칸이 비어 있습니다 — 인벤토리(I)에서 스킬 쉘을 끼우세요`, '#a99'); Snd.play('deny'); return; }
  const S = SKILLS[sh.id];
  if (p.scd[sh.id] > 0) { msg(`${S.name} 대기 중 (${Math.ceil(p.scd[sh.id])}초)`, '#a99'); Snd.play('deny'); return; }
  const v = shellVals(sh);
  if (SKILL_CAST[sh.id](v) === false) return; // 대상이 없거나 갈 곳이 없으면 대기시간 없이 취소
  p.scd[sh.id] = v.cd;
}
// 범위 안의 살아 있는 적 (see: 그 자리에서 벽에 가리지 않은 적만)
const enemiesNear = (x, y, R, see = true) => enemies.filter(e => !e.dead && !hiddenE(e) && Math.hypot(e.x - x, e.y - y) < R + e.r && (!see || los(x, y, e.x, e.y)));
function nearestEnemy(x, y, R) {
  let best = null, bd = R;
  for (const e of enemies) { if (e.dead || hiddenE(e)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd && los(x, y, e.x, e.y)) { best = e; bd = d; } }
  return best;
}
const stunE = (e, t) => { if (!e.dead) e.stun = Math.max(e.stun, t * ccScale(e)); };
// 커서 쪽으로 최대 L칸, 벽·닫힌 문 앞에서 멈춘 자리 (r: 그 자리에 몸이 들어가야 함)
function aimPoint(L, r = 0) {
  const p = player, m = screenToWorld(mouse.x, mouse.y + 14);
  let dx = m.x - p.x, dy = m.y - p.y;
  const d = Math.hypot(dx, dy) || 0.01, n = Math.min(d, L);
  dx /= d; dy /= d;
  let tx = p.x, ty = p.y;
  for (let s = 0.1; s <= n; s += 0.1) { const x = p.x + dx * s, y = p.y + dy * s; if (blocksShot(x, y)) break; if (!r || !collides(x, y, r, false)) { tx = x; ty = y; } }
  return { x: tx, y: ty };
}
// 바라보는 쪽 바로 앞 (막혀 있으면 발밑): 포탑·코일을 세우는 자리
function frontSpot(da = 0) {
  const p = player, a = p.aim + da, x = p.x + Math.cos(a) * (da ? 1.1 : 0.9), y = p.y + Math.sin(a) * (da ? 1.1 : 0.9);
  return collides(x, y, 0.3, false) ? { x: p.x, y: p.y } : { x, y };
}
// 스킬의 작은 폭발 (플레이어는 안전): 가까울수록 센 피해, 근처 통도 터짐
function skillBlast(x, y, R, dmg) {
  for (const e of enemiesNear(x, y, R, false)) { const d = Math.hypot(e.x - x, e.y - y); hitEnemy(e, dmg * (1 - Math.min(1, d / (R + e.r)) * 0.5), (e.x - x) / (d || 1) * 5, (e.y - y) / (d || 1) * 5); }
  for (const b of barrels) if (!b.dead && Math.hypot(b.x - x, b.y - y) < R) setTimeout(() => hitBarrel(b, 99), 60);
  addFx('misl', 'bcd', x, y, 10, 0.35, 0.5 + R * 0.4); fireBurst(x, y, 10, 2.5); smoke(x, y, 5, '70,60,50', 1);
  flashes.push({ x, y, r: 160 + R * 80, t: 0.2, max: 0.2, col: '255,150,60' }); shake = Math.max(shake, 3); Snd.play('mineBoom', x, y);
}
function explodeShot(b, x, y) { // 터지는 탄: 스킬 미사일 / 로켓·분쇄포
  if (!b.blastR) { weaponBlast(b, x, y); return; }
  skillBlast(x, y, b.blastR, b.dmg);
  if (b.cluster) for (let k = 0; k < 3; k++) { // 집속탄 포드: 작은 폭탄 셋 (피해 40%)
    const a = rnd(0, 6.28), d = rnd(0.8, 1.6), x2 = x + Math.cos(a) * d, y2 = y + Math.sin(a) * d;
    if (!blocksShot(x2, y2)) later(0.12 + k * 0.08, () => skillBlast(x2, y2, 0.9, b.dmg * 0.4));
  }
}
function glowBurst(x, y, n, cols, spd = 3) {
  for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), s = rnd(1, spd); parts.push({ x, y, z: rnd(10, 40), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(30, 90), g: 120, life: rnd(0.4, 0.8), max: 0.8, col: pick(cols), size: 3, glow: true }); }
}
// 은신 중 공격: 은신이 풀리고 이 공격은 기습 피해 (배율을 돌려줌)
function takeAmbush() {
  const c = buff('cloak');
  if (!c) return 1;
  c.t = 0; msg('기습!', SKILLS.cloak.color); smoke(player.x, player.y, 8, '150,160,180', 1);
  if (c.shadow) { // 그림자 군주: 주변 3칸 기절
    for (const e of enemiesNear(player.x, player.y, 3)) stunE(e, 1.5);
    rings.push({ x: player.x, y: player.y, R: 3, t: 0, max: 0.35, col: '150,120,220' }); flashes.push({ x: player.x, y: player.y, r: 380, t: 0.3, max: 0.3, col: '150,120,220' });
  }
  return 1 + c.amb;
}
// 스킬 20종: v = 쉘의 지금 수치 (shellVals). false를 돌려주면 취소
const SKILL_CAST = {
  shock(v) { // 충격파: 벽에 가리지 않은 주변 적을 밀쳐내고 기절 (가까울수록 센 피해), 근처 통도 터짐
    const p = v.at || player; // 지진의 심장: 여진은 처음 자리에서
    for (const e of enemiesNear(p.x, p.y, v.r)) {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 0.01;
      hitEnemy(e, v.dmg * (1 - Math.min(1, d / (v.r + e.r)) * 0.4), dx / d * 12, dy / d * 12); stunE(e, v.stun);
    }
    for (const b of barrels) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < v.r) setTimeout(() => hitBarrel(b, 99), 80);
    rings.push({ x: p.x, y: p.y, R: v.r, t: 0, max: 0.35, col: '140,200,255' });
    addFx('bfe1', 'cdef', p.x, p.y, 6, 0.4, 0.3 + v.r * 0.1, 0.7);
    spark(p.x, p.y, 30, '#9df', 6); flashes.push({ x: p.x, y: p.y, r: 520, t: 0.3, max: 0.3, col: '140,200,255' });
    shake = Math.max(shake, 8); Snd.play('skillShock');
    if (v.uq) { const at = { x: p.x, y: p.y }; later(0.5, () => SKILL_CAST.shock({ ...v, uq: false, dmg: v.dmg * 0.7, at })); } // 지진의 심장: 여진
  },
  charge(v) { // 강습 돌진: 조준한 쪽으로 빠르게 돌진 (무적) — 움직임과 충돌은 chargeStep
    const p = player, sp = 22;
    p.sk.charge = { t: v.dist / sp, max: v.dist / sp, dx: Math.cos(p.aim), dy: Math.sin(p.aim), sp, dmg: v.dmg, stun: v.stun, hits: [], fire: v.uq, fireT: 0 }; // fire: 혜성 엔진
    p.inv = Math.max(p.inv, v.dist / sp + 0.15);
    shake = Math.max(shake, 4); Snd.play('charge');
  },
  saw(v) { // 회전 톱날: 몸 둘레를 도는 전기톱 두 개 — 피해는 updateSkills에서 0.2초마다
    player.sk.saw = { t: v.dur, max: v.dur, dmg: v.dmg, r: v.r * (v.uq ? 1.3 : 1), tick: 0, ang: player.aim, snd: 0, n: v.uq ? 4 : 2, rate: v.uq ? 0.14 : 0.2 }; // 분쇄기 왕관: 톱날 넷
    Snd.play('sawUp');
  },
  berserk(v) { // 광폭화: 공격·이동 속도↑, 받는 피해↓, 처치마다 회복 (updatePlayer·hurtPlayer·killEnemy)
    const p = player;
    p.sk.berserk = { t: v.dur, max: v.dur, heal: v.heal, ext: v.uq ? 10 : 0 }; // ext: 피의 축제 — 처치마다 늘릴 수 있는 남은 시간
    flashes.push({ x: p.x, y: p.y, r: 600, t: 0.4, max: 0.4, col: '255,60,40' }); shake = Math.max(shake, 6);
    glowBurst(p.x, p.y, 30, ['#f44', '#f84', '#c22'], 4);
    Snd.play('berserk'); msg('광폭화!', SKILLS.berserk.color);
  },
  iron(v) { // 강철 피부: 방어도 + 받는 피해 감소, 밀려나거나 휘청이지 않음
    const p = player;
    p.armor = Math.min(100, p.armor + v.armor);
    p.sk.iron = { t: v.dur, max: v.dur, thorns: v.uq }; // 가시 갑주
    glowBurst(p.x, p.y, 24, ['#dde', '#aab', '#fff'], 3); flashes.push({ x: p.x, y: p.y, r: 360, t: 0.3, max: 0.3, col: '200,210,230' });
    Snd.play('iron'); msg('강철 피부', SKILLS.iron.color);
  },
  blink(v) { // 순간 이동: 커서 쪽 (벽·닫힌 문 앞까지), 도착한 곳 둘레의 적은 피해·기절
    const p = player, to = aimPoint(v.dist, p.r);
    if (Math.hypot(to.x - p.x, to.y - p.y) < 0.6) { msg('순간 이동할 곳이 막혀 있습니다', '#a99'); Snd.play('deny'); return false; }
    if (v.uq) { const hp = 80 * skillScale(); decoys = [{ x: p.x, y: p.y, t: 4, max: 4, dev: '잔상', ghost: true, r: 0.3, hp, maxhp: hp, hitT: 0, face: p.aim }]; } // 유령 발자국: 떠난 자리에 잔상
    addFx('tfog', 'abcdef', p.x, p.y, 0, 0.5, 0.9);
    p.x = to.x; p.y = to.y; p.kx = p.ky = 0; p.inv = Math.max(p.inv, 0.3); flowTile = -1;
    addFx('tfog', 'abcdef', to.x, to.y, 0, 0.5, 0.9);
    for (const e of enemiesNear(to.x, to.y, 1.8)) { const d = Math.hypot(e.x - to.x, e.y - to.y) || 0.01; hitEnemy(e, v.dmg, (e.x - to.x) / d * 6, (e.y - to.y) / d * 6); stunE(e, v.stun); }
    flashes.push({ x: to.x, y: to.y, r: 320, t: 0.3, max: 0.3, col: '170,255,120' }); Snd.play('blink');
  },
  cloak(v) { // 은신 장막: 곁(CLOAK_NEAR)이 아니면 적이 놓침 (updateEnemies) — 공격하면 풀리고 그 공격은 기습 (takeAmbush)
    const p = player;
    p.sk.cloak = { t: v.dur, max: v.dur, amb: v.amb, shadow: v.uq }; // 그림자 군주
    for (const e of enemies) if (e.aggro && Math.hypot(e.x - p.x, e.y - p.y) > CLOAK_NEAR) { e.aggro = false; e.burst = 0; e.wander = 0; }
    smoke(p.x, p.y, 14, '150,160,180', 1.2); Snd.play('cloak'); msg('은신 — 적이 나를 놓친다', SKILLS.cloak.color);
  },
  blades(v) { // 칼날 부채: 조준한 쪽 부채꼴로 칼날 (적 셋까지 꿰뚫음)
    const p = player, n = v.n, spread = Math.min(1.4, 0.16 * (n - 1));
    for (let k = 0; k < n; k++) {
      const a = p.aim + (n > 1 ? (k / (n - 1) - 0.5) * spread : 0), ca = Math.cos(a), sa = Math.sin(a), ox = p.x + ca * 0.4, oy = p.y + sa * 0.4;
      bullets.push({ x: ox, y: oy, px: ox, py: oy, vx: ca * 18, vy: sa * 18, life: 0.5, dmg: v.dmg, pierce: 2, hits: [], col: '#ddd', wid: 2, target: null, s: SKILL_SHOT, kind: 'blade', dir: a });
    }
    Snd.play('blades');
    if (v.uq) later(0.25, () => SKILL_CAST.blades({ ...v, uq: false })); // 천 개의 칼날: 한 번 더
  },
  deadeye(v) { // 집중 사격: 무기 치명타·공격 속도 (weaponHit·updatePlayer), 레이저 조준선
    player.sk.deadeye = { t: v.dur, max: v.dur, crit: v.crit, pierce: v.uq ? 1 : 0 }; // 매의 눈: 하나 더 꿰뚫음
    Snd.play('deadeye'); msg('집중 사격', SKILLS.deadeye.color);
  },
  mines(v) { // 지뢰: 바라보는 쪽 부채꼴로 던짐 → 떨어지고 0.5초 뒤 작동, 걷는 적이 밟으면 폭발 (떠 있는 적은 안 밟음, 나는 안전)
    const p = player, S = SKILLS.mines, dmg = v.dmg * (1 + perkV('blast')), step = Math.min(0.32, 2.2 / Math.max(1, v.n - 1));
    for (let k = 0; k < v.n; k++) {
      const a = p.aim + (k - (v.n - 1) / 2) * step + rnd(-0.08, 0.08);
      let d = rnd(1.6, 3.4);
      while (d > 0.6 && blocksShot(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d)) d -= 0.3;
      mines.push({ sx: p.x, sy: p.y, x: p.x, y: p.y, z: 0, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, fly: 0, dur: 0.3 + k * 0.04, arm: 0.5, life: S.life, dmg, r: v.r, ph: rnd(0, 6), uq: v.uq });
    }
    while (mines.length > S.cap) mines.shift(); // 너무 많으면 오래된 것부터 치움
    Snd.play('throw');
  },
  turret(v) { // 포탑: 바라보는 쪽 바로 앞에. 하나만 — 다시 세우면 앞의 것은 접힘 (쌍둥이 파수꾼: 좌우로 두 대)
    for (const t of turrets) smoke(t.x, t.y, 6, '120,120,120', 0.8);
    turrets = (v.uq ? [-0.75, 0.75] : [0]).map(da => {
      const at = frontSpot(da);
      smoke(at.x, at.y, 8, '120,120,120', 1); spark(at.x, at.y, 10, '#9f9', 3);
      return { x: at.x, y: at.y, t: v.dur, max: v.dur, dmg: v.dmg, ang: player.aim, cool: 0.4, scan: 0, tgt: null, dev: '포탑', r: 0.35, hp: v.hp, maxhp: v.hp, hitT: 0 };
    });
    Snd.play('turretUp', turrets[0].x, turrets[0].y);
  },
  drone(v) { // 전투 드론: 곁을 돌며 따라다니고 가까운 적에게 플라즈마 (updateSkills). 하나만
    const p = player;
    for (const d of drones) addFx('ifog', 'abcde', d.x, d.y, d.z, 0.4, 0.6);
    drones = (v.uq ? [0, Math.PI] : [0]).map(da => ({ x: p.x, y: p.y, z: 0, t: v.dur, max: v.dur, dmg: v.dmg, ang: p.aim + Math.PI + da, cool: 0.5, scan: 0, tgt: null })); // 편대장: 둘
    addFx('ifog', 'abcde', p.x, p.y, 30, 0.5, 0.8); Snd.play('droneUp');
  },
  tesla(v) { // 테슬라 코일: 앞에 세움 (하나만), 0.6초마다 가까운 적 n마리에게 번개 (updateSkills)
    const at = frontSpot();
    for (const c of coils) smoke(c.x, c.y, 6, '120,140,170', 0.8);
    coils = [{ x: at.x, y: at.y, t: v.dur, max: v.dur, dmg: v.dmg, zr: v.r, n: v.n, cool: 0.3, dev: '테슬라 코일', r: 0.35, hp: v.hp, maxhp: v.hp, hitT: 0, chain: v.uq }]; // zr: 번개 범위, r: 몸, chain: 폭풍 첨탑
    spark(at.x, at.y, 12, '#9cf', 3); flashes.push({ x: at.x, y: at.y, r: 260, t: 0.25, max: 0.25, col: '120,170,255' }); Snd.play('teslaUp', at.x, at.y);
  },
  missiles(v) { // 유도 미사일: 가까이 보이는 적들에게 나눠서 날아감 (소형 폭발, 나는 안전)
    const p = player, tg = enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 12 && canSee(e.x, e.y) && los(p.x, p.y, e.x, e.y))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (!tg.length) { msg('미사일을 보낼 적이 보이지 않습니다', '#a99'); Snd.play('deny'); return false; }
    for (let k = 0; k < v.n; k++) {
      const a = p.aim + rnd(-1.3, 1.3);
      bullets.push({ x: p.x, y: p.y, px: p.x, py: p.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 3, dmg: v.dmg, pierce: 0, hits: [], col: '#fa6', wid: 2,
        target: tg[k % tg.length], turn: 9, s: SKILL_SHOT, kind: 'micro', dir: a, blastR: 1.2, delay: k * 0.06, z: 22, cluster: v.uq }); // cluster: 집속탄 포드
    }
    Snd.play('missiles');
  },
  repair(v) { // 나노 수리: 3초에 걸쳐 회복 (updatePlayer), 방어도, 상태 이상 치료
    const p = player;
    p.sk.repair = { t: 3, max: 3, rate: v.heal / 3 };
    p.armor = Math.min(100, p.armor + v.armor); p.fx.poison = p.fx.burn = p.fx.shock = 0;
    glowBurst(p.x, p.y, 20, ['#7f7', '#bfb', '#fff'], 2); Snd.play('heal'); msg('나노 수리', SKILLS.repair.color);
    if (v.uq) { p.inv = Math.max(p.inv, 2); p.armor = Math.min(100, p.armor + 20); flashes.push({ x: p.x, y: p.y, r: 420, t: 0.4, max: 0.4, col: '255,230,140' }); msg('불사의 서약 — 2초 무적', '#ffcf70'); }
  },
  chain(v) { // 연쇄 번개: 조준한 쪽의 적부터 r칸 안의 다음 적으로 n번 튕김 (튕길 때마다 10%씩 약해짐)
    const p = player, first = findTarget(9) || nearestEnemy(p.x, p.y, 6);
    if (!first) { msg('번개를 맞힐 적이 보이지 않습니다', '#a99'); Snd.play('deny'); return false; }
    const hit = [], next = (x0, y0) => { // 아직 안 맞은, r칸 안의 가장 가까운 적
      let nx = null, nd = v.r;
      for (const o of enemies) { if (o.dead || hiddenE(o) || hit.includes(o)) continue; const d = Math.hypot(o.x - x0, o.y - y0); if (d < nd && los(x0, y0, o.x, o.y)) { nx = o; nd = d; } }
      return nx;
    };
    const bolt = (cur, x0, y0, z0, dmg) => {
      for (let k = 0; k <= v.n && cur; k++) {
        beams.push({ x0, y0, z0, x1: cur.x, y1: cur.y, t: 0.3, col: '140,180,255' });
        hitEnemy(cur, dmg); stunE(cur, 0.25); spark(cur.x, cur.y, 6, '#9df', 3);
        hit.push(cur); x0 = cur.x; y0 = cur.y; z0 = 10; dmg *= 0.9;
        cur = next(x0, y0);
      }
    };
    bolt(first, p.x, p.y, 26, v.dmg);
    if (v.uq) { const fork = next(first.x, first.y); if (fork) bolt(fork, first.x, first.y, 10, v.dmg * 0.9); } // 갈래 번개: 첫 적에서 두 번째 갈래
    flashes.push({ x: p.x, y: p.y, r: 240, t: 0.15, max: 0.15, col: '140,180,255' }); Snd.play('chain');
  },
  frost(v) { // 냉기 폭발: 주변의 보이는 적을 얼리고, 풀린 뒤에도 느리게
    const p = player;
    for (const e of enemiesNear(p.x, p.y, v.r)) { hitEnemy(e, v.dmg); if (!e.dead) { e.freeze = Math.max(e.freeze, v.freeze * ccScale(e)); e.slow = Math.max(e.slow, v.freeze + 4); if (v.uq) e.shatter = v.dmg * 0.5; } } // shatter: 영원한 겨울
    for (let k = 0; k < 50; k++) { const a = rnd(0, 6.28), s = rnd(1, 2 + v.r); parts.push({ x: p.x, y: p.y, z: rnd(4, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(10, 60), g: 100, life: rnd(0.4, 0.9), max: 0.9, col: pick(['#dff', '#bef', '#fff']), size: 3, glow: true }); }
    rings.push({ x: p.x, y: p.y, R: v.r, t: 0, max: 0.4, col: '190,235,255' });
    decal(p.x, p.y, v.r * 0.6, 'rgba(180,230,255,0.25)'); addFx('ifog', 'abcde', p.x, p.y, 0, 0.6, 1.4, 0.8);
    flashes.push({ x: p.x, y: p.y, r: 460, t: 0.3, max: 0.3, col: '170,230,255' }); Snd.play('cryo');
  },
  inferno(v) { // 화염 폭풍: 퍼지는 불의 고리 (피해·화상) + 불타는 바닥 (플레이어는 안전)
    const p = player, R = v.r * (v.uq ? 1.4 : 1), burn = v.uq ? 6 : 4; // 태양의 고리: 넓게, 화상 길게
    for (const e of enemiesNear(p.x, p.y, R)) { const d = Math.hypot(e.x - p.x, e.y - p.y) || 0.01; hitEnemy(e, v.dmg, (e.x - p.x) / d * 4, (e.y - p.y) / d * 4); if (!e.dead) e.burn = Math.max(e.burn, burn); }
    rings.push({ x: p.x, y: p.y, R, t: 0, max: 0.45, col: '255,140,50', fire: true });
    const n = Math.round(4 + R * 1.2);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + rnd(-0.3, 0.3), d = R * rnd(0.4, 0.85), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!blocksShot(x, y) && los(p.x, p.y, x, y)) areas.push({ type: 'fire', x, y, r: 1, t: v.dur, max: v.dur, safe: true });
    }
    fireBurst(p.x, p.y, 40, 5); flashes.push({ x: p.x, y: p.y, r: 560, t: 0.35, max: 0.35, col: '255,120,40' }); shake = Math.max(shake, 6); Snd.play('inferno');
  },
  gravity(v) { // 중력장: 커서 위치(벽 앞까지)에 특이점 — 끌어당기다 붕괴 (updateSkills)
    const at = aimPoint(8);
    wells.push({ x: at.x, y: at.y, t: v.dur, max: v.dur, r: v.r, dmg: v.dmg, uq: v.uq }); // uq: 사건의 지평선
    flashes.push({ x: at.x, y: at.y, r: 300, t: 0.3, max: 0.3, col: '190,120,255' }); Snd.play('gravity', at.x, at.y);
  },
  drain(v) { // 생명 흡수: 주변의 보이는 적에게 피해, 준 피해만큼 회복 (한 번에 최대 체력의 30%까지)
    const p = player, tg = enemiesNear(p.x, p.y, v.r);
    if (!tg.length) { msg('주변에 생명력을 빼앗을 적이 없습니다', '#a99'); Snd.play('deny'); return false; }
    let total = 0;
    for (const e of tg) {
      const before = e.hp; hitEnemy(e, v.dmg); total += before - Math.max(0, e.hp);
      beams.push({ x0: e.x, y0: e.y, z0: 18, x1: p.x, y1: p.y, t: 0.4, col: '255,70,120' });
      for (let k = 0; k < 4; k++) parts.push({ x: e.x, y: e.y, z: 20, vx: (p.x - e.x) * 2.2, vy: (p.y - e.y) * 2.2, vz: 0, g: 0, life: 0.45, max: 0.45, col: pick(['#f46', '#f8a', '#c13']), size: 3, glow: true });
    }
    const h = Math.round(Math.min(total * v.leech, p.maxhp * 0.3)), room = p.maxhp - p.hp;
    if (heal(p, h)) addText(p.x, p.y, `+${h}`, '#7f7', 50);
    if (v.uq && h > room) { const a = Math.round(Math.min(h - room, 100 - p.armor)); if (a > 0) { p.armor += a; addText(p.x, p.y - 0.3, `방어 +${a}`, '#9cf', 64); } } // 흡혈 군주: 넘친 만큼 방어도
    flashes.push({ x: p.x, y: p.y, r: 380, t: 0.35, max: 0.35, col: '255,70,120' }); Snd.play('drain');
  },
};
// 지속 효과가 끝날 때
function skillEnd(k) {
  if (k === 'cloak') { smoke(player.x, player.y, 8, '150,160,180', 1); msg('은신이 풀렸습니다', '#a99'); }
}
// 강습 돌진 한 프레임: 앞으로 달리며 부딪힌 적을 옆으로 튕겨냄, 벽에 막히면 멈춤 (updatePlayer)
function chargeStep(C, dt) {
  const p = player, ox = p.x, oy = p.y;
  moveEntity(p, C.dx * C.sp * dt, C.dy * C.sp * dt);
  if (Math.hypot(p.x - ox, p.y - oy) < C.sp * dt * 0.3) { C.t = 0; shake = Math.max(shake, 6); spark(p.x, p.y, 10, '#ffd27a', 4); Snd.play('meleeHit'); return; }
  fireBurst(p.x, p.y, 2, 0.6);
  if (C.fire && (C.fireT -= dt) <= 0) { C.fireT = 0.07; areas.push({ type: 'fire', x: p.x, y: p.y, r: 0.85, t: 3, max: 3, safe: true }); } // 혜성 엔진: 불길 (나는 안전)
  for (const e of enemies) {
    if (e.dead || C.hits.includes(e) || Math.hypot(e.x - p.x, e.y - p.y) > 0.75 + e.r) continue;
    C.hits.push(e);
    const side = (e.x - p.x) * -C.dy + (e.y - p.y) * C.dx >= 0 ? 1 : -1; // 진행 방향의 왼쪽·오른쪽
    hitEnemy(e, C.dmg, -C.dy * side * 10 + C.dx * 4, C.dx * side * 10 + C.dy * 4); stunE(e, C.stun);
    blood(e.x, e.y, 6, e.d.blood); shake = Math.max(shake, 5); Snd.play('meleeHit', e.x, e.y);
  }
  for (const b of barrels) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < 0.7) hitBarrel(b, 99);
}
function updateSkills(dt) {
  const p = player, safe = inHub() && !contested(); // 안전 지대: 드론·톱날은 공격하지 않음 (거점 습격 중은 공격)
  const due = delayed.filter(d => (d.t -= dt) <= 0); // 조금 뒤에 일어날 효과 (여진·두 번째 칼날·집속탄)
  delayed = delayed.filter(d => d.t > 0);
  for (const d of due) d.fn();
  for (const d of decoys) { d.t -= dt; d.hitT -= dt; if (d.t <= 0) addFx('tfog', 'abcdef', d.x, d.y, 0, 0.5, 0.8); } // 잔상
  decoys = decoys.filter(d => d.t > 0);
  if (ATTR_KEYS.some(k => resTier(k))) tip('resonance');
  for (const t of turrets) { // 포탑: 사거리 안에서 가려지지 않은 가장 가까운 적을 돌아보며 쏨 (0.2초마다 목표를 다시 찾음)
    t.t -= dt; t.cool -= dt; t.scan -= dt; t.hitT -= dt;
    if (t.tgt && (t.tgt.dead || hiddenE(t.tgt) || Math.hypot(t.tgt.x - t.x, t.tgt.y - t.y) > SKILLS.turret.range)) t.tgt = null; // 굴착자가 땅속으로 숨으면 놓침
    if (!t.tgt && t.scan <= 0) { t.scan = 0.2; t.tgt = nearestEnemy(t.x, t.y, SKILLS.turret.range); }
    if (!t.tgt) continue;
    const want = Math.atan2(t.tgt.y - t.y, t.tgt.x - t.x);
    t.ang += angDiff(want, t.ang) * Math.min(1, dt * 12);
    if (t.cool > 0 || Math.abs(angDiff(want, t.ang)) > 0.25) continue;
    t.cool = SKILLS.turret.rate;
    const ca = Math.cos(t.ang), sa = Math.sin(t.ang), ox = t.x + ca * 0.45, oy = t.y + sa * 0.45;
    bullets.push({ x: ox, y: oy, px: ox, py: oy, vx: ca * 30, vy: sa * 30, life: SKILLS.turret.range * 1.3 / 30, dmg: t.dmg, pierce: 0, hits: [], col: '#b8ffa0', wid: 1.8, target: t.tgt, s: SKILL_SHOT, kind: 'bullet', dir: t.ang });
    flashes.push({ x: ox, y: oy, r: 110, t: 0.05, max: 0.05, col: '200,255,180' }); Snd.play('turretGun', t.x, t.y);
  }
  for (const t of turrets) if (t.t <= 0) { smoke(t.x, t.y, 8, '120,120,120', 1); spark(t.x, t.y, 8, '#9f9', 2); if (t.hp <= 0) deviceBroken(t); }
  turrets = turrets.filter(t => t.t > 0);
  for (const d of drones) { // 드론: 플레이어 둘레를 돌며 (벽 안이면 머리 위) 가장 가까운 적을 쏨
    d.t -= dt; d.cool -= dt; d.scan -= dt; d.ang += dt * 1.4;
    let hx = p.x + Math.cos(d.ang) * 1.3, hy = p.y + Math.sin(d.ang) * 1.3;
    if (blocksShot(hx, hy)) { hx = p.x; hy = p.y; }
    const k = Math.min(1, dt * 5);
    d.x += (hx - d.x) * k; d.y += (hy - d.y) * k; d.z = Math.min(36, d.z + dt * 80);
    if (d.tgt && (d.tgt.dead || hiddenE(d.tgt) || Math.hypot(d.tgt.x - d.x, d.tgt.y - d.y) > SKILLS.drone.range)) d.tgt = null;
    if (!d.tgt && d.scan <= 0) { d.scan = 0.25; d.tgt = nearestEnemy(d.x, d.y, SKILLS.drone.range); }
    if (!d.tgt || d.cool > 0 || safe) continue;
    d.cool = SKILLS.drone.rate;
    const a = Math.atan2(d.tgt.y - d.y, d.tgt.x - d.x);
    bullets.push({ x: d.x, y: d.y, px: d.x, py: d.y, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22, life: 0.6, dmg: d.dmg, pierce: 0, hits: [], col: '#9cf', wid: 2, target: d.tgt, s: SKILL_SHOT, kind: 'plasma', dir: a, z: 34 });
    Snd.play('droneGun', d.x, d.y);
  }
  for (const d of drones) if (d.t <= 0) { addFx('ifog', 'abcde', d.x, d.y, d.z, 0.4, 0.6); spark(d.x, d.y, 8, '#7ef', 2); }
  drones = drones.filter(d => d.t > 0);
  for (const c of coils) { // 테슬라 코일: 가까운 적 n마리에게 번개
    c.t -= dt; c.cool -= dt; c.hitT -= dt;
    if (c.cool > 0) continue;
    const tg = enemiesNear(c.x, c.y, c.zr).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, c.n);
    if (!tg.length) { c.cool = 0.15; continue; }
    c.cool = SKILLS.tesla.rate;
    for (const e of tg) {
      beams.push({ x0: c.x, y0: c.y, z0: 54, x1: e.x, y1: e.y, t: 0.22, col: '130,180,255' }); hitEnemy(e, c.dmg); stunE(e, 0.25); spark(e.x, e.y, 4, '#9df', 2);
      const o = c.chain && enemies.find(q => !q.dead && q !== e && !tg.includes(q) && Math.hypot(q.x - e.x, q.y - e.y) < 3 && los(e.x, e.y, q.x, q.y)); // 폭풍 첨탑
      if (o) { beams.push({ x0: e.x, y0: e.y, z0: 20, x1: o.x, y1: o.y, t: 0.22, col: '170,210,255' }); hitEnemy(o, c.dmg * 0.6); stunE(o, 0.2); }
    }
    flashes.push({ x: c.x, y: c.y, r: 200, t: 0.12, max: 0.12, col: '120,170,255' }); Snd.play('tesla', c.x, c.y);
  }
  for (const c of coils) if (c.t <= 0) { smoke(c.x, c.y, 8, '120,140,170', 1); spark(c.x, c.y, 8, '#9cf', 2); if (c.hp <= 0) deviceBroken(c); }
  coils = coils.filter(c => c.t > 0);
  for (const w of wells) { // 중력장: 끌어당기다 (무거운 적·보스는 덜) 끝나면 붕괴
    w.t -= dt;
    for (const e of enemies) {
      if (e.dead || e.d.fixed) continue;
      const dx = w.x - e.x, dy = w.y - e.y, d = Math.hypot(dx, dy);
      if (d > w.r + e.r || d < 0.15 || !los(w.x, w.y, e.x, e.y)) continue;
      const pull = (1.5 + 3.5 * (1 - d / (w.r + e.r))) * (e.d.boss ? 0.1 : e.d.heavy ? 0.35 : 1);
      moveEntity(e, dx / d * pull * dt, dy / d * pull * dt); e.slow = Math.max(e.slow, 0.3);
    }
    if (Math.random() < dt * 40) { const a = rnd(0, 6.28), rr = w.r * rnd(0.6, 1); parts.push({ x: w.x + Math.cos(a) * rr, y: w.y + Math.sin(a) * rr, z: rnd(4, 30), vx: -Math.cos(a) * rr * 2, vy: -Math.sin(a) * rr * 2, vz: 0, g: 0, life: 0.5, max: 0.5, col: pick(['#c8f', '#a6f', '#fff']), size: 2, glow: true }); }
    if (w.t > 0) continue;
    for (const e of enemiesNear(w.x, w.y, w.r * 0.7)) { const d = Math.hypot(e.x - w.x, e.y - w.y) || 0.01; hitEnemy(e, w.dmg * (1 - Math.min(1, d / (w.r * 0.7 + e.r)) * 0.4), (e.x - w.x) / d * 6, (e.y - w.y) / d * 6); }
    addFx('bfe2', 'abcd', w.x, w.y, 10, 0.45, 0.7, 0.8); rings.push({ x: w.x, y: w.y, R: w.r * 0.7, t: 0, max: 0.35, col: '200,140,255' });
    if (w.uq && !w.child) { for (const e of enemiesNear(w.x, w.y, w.r)) stunE(e, 1.5); wells.push({ x: w.x, y: w.y, t: 1.2, max: 1.2, r: w.r * 0.6, dmg: w.dmg * 0.6, child: true }); } // 사건의 지평선
    flashes.push({ x: w.x, y: w.y, r: 520, t: 0.35, max: 0.35, col: '190,120,255' }); shake = Math.max(shake, 8); Snd.play('implode', w.x, w.y);
  }
  wells = wells.filter(w => w.t > 0);
  for (const m of mines) { // 지뢰: 날아가 떨어진 뒤 작동, 밟히면 폭발
    if (m.fly < m.dur) { m.fly += dt; const k = Math.min(1, m.fly / m.dur); m.x = m.sx + (m.tx - m.sx) * k; m.y = m.sy + (m.ty - m.sy) * k; m.z = Math.sin(k * Math.PI) * 30; continue; }
    m.z = 0; m.arm -= dt; m.life -= dt;
    if (m.life <= 0) { m.dead = true; smoke(m.x, m.y, 3, '90,90,90', 0.5); continue; }
    if (m.arm <= 0 && enemies.some(e => !e.dead && !e.fly && Math.hypot(e.x - m.x, e.y - m.y) < e.r + 0.45)) { m.dead = true; mineBlast(m); }
  }
  mines = mines.filter(m => !m.dead);
  for (const r of rings) r.t += dt;
  rings = rings.filter(r => r.t < r.max);
  const W = buff('saw'); // 회전 톱날: 0.2초마다 둘레의 적
  if (W) {
    W.ang += dt * 12; W.tick -= dt; W.snd -= dt;
    if (W.tick <= 0 && !safe) {
      W.tick = W.rate || 0.2;
      let hit = false;
      for (const e of enemiesNear(p.x, p.y, W.r)) { const d = Math.hypot(e.x - p.x, e.y - p.y) || 0.01; hitEnemy(e, W.dmg, (e.x - p.x) / d * 2, (e.y - p.y) / d * 2); spark(e.x, e.y, 3, '#ffd27a', 3); hit = true; }
      for (const b of barrels) if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < W.r) hitBarrel(b, W.dmg);
      if (hit) Snd.play('sawHit');
    }
    if (W.snd <= 0) { W.snd = 0.45; Snd.play('sawRun'); }
  }
  if (buff('berserk') && Math.random() < dt * 30) parts.push({ x: p.x + rnd(-0.3, 0.3), y: p.y + rnd(-0.3, 0.3), z: rnd(10, 40), vx: 0, vy: 0, vz: rnd(20, 60), g: 0, life: 0.5, max: 0.5, col: pick(['#f44', '#f84', '#c22']), size: 3, glow: true });
  if (buff('repair') && Math.random() < dt * 20) parts.push({ x: p.x + rnd(-0.3, 0.3), y: p.y + rnd(-0.3, 0.3), z: rnd(5, 30), vx: 0, vy: 0, vz: rnd(30, 60), g: 0, life: 0.6, max: 0.6, col: pick(['#7f7', '#bfb', '#fff']), size: 2, glow: true });
}
// 설치물이 적에게 부서짐: 폭발 + 알림 (잔상은 조용히 사라짐)
function deviceBroken(o) {
  if (o.ghost) return;
  addFx('misl', 'bcd', o.x, o.y, 14, 0.4, 0.9); spark(o.x, o.y, 14, '#ffd27a', 5); smoke(o.x, o.y, 10, '70,60,50', 1.5);
  flashes.push({ x: o.x, y: o.y, r: 300, t: 0.3, max: 0.3, col: '255,150,60' }); shake = Math.max(shake, 5); Snd.play('explode', o.x, o.y);
  msg(`${o.dev}이 부서졌다`, '#f96');
}
function mineBlast(m) {
  if (m.uq && !m.mini) for (let k = 0; k < 2; k++) { // 벌집 지뢰: 작은 지뢰 둘이 튀어 나감 (피해 50%)
    const a = rnd(0, 6.28);
    let d = rnd(1.2, 2.2);
    while (d > 0.4 && blocksShot(m.x + Math.cos(a) * d, m.y + Math.sin(a) * d)) d -= 0.3;
    mines.push({ sx: m.x, sy: m.y, x: m.x, y: m.y, z: 0, tx: m.x + Math.cos(a) * d, ty: m.y + Math.sin(a) * d, fly: 0, dur: 0.25, arm: 0.3, life: 12, dmg: m.dmg * 0.5, r: m.r * 0.75, ph: rnd(0, 6), mini: true });
  }
  for (const e of enemiesNear(m.x, m.y, m.r, false)) { const d = Math.hypot(e.x - m.x, e.y - m.y); hitEnemy(e, m.dmg * (1 - Math.min(1, d / (m.r + e.r)) * 0.6), (e.x - m.x) / (d || 1) * 8, (e.y - m.y) / (d || 1) * 8); }
  for (const b of barrels) if (!b.dead && Math.hypot(b.x - m.x, b.y - m.y) < m.r) setTimeout(() => hitBarrel(b, 99), 60);
  addFx('misl', 'bcd', m.x, m.y, 6, 0.4, 1.2); fireBurst(m.x, m.y, 24, 4); smoke(m.x, m.y, 10, '70,60,50', 1.6);
  decal(m.x, m.y, 0.8, 'rgba(10,8,6,0.7)'); flashes.push({ x: m.x, y: m.y, r: 380, t: 0.3, max: 0.3, col: '255,150,60' });
  shake = Math.max(shake, 7); Snd.play('mineBoom', m.x, m.y);
}
// 지속 중인 효과·설치물의 남은 비율 (스킬 칸 위 막대)
function skillLeft(id) {
  const o = buff(id) || (id === 'turret' ? turrets[0] : id === 'drone' ? drones[0] : id === 'tesla' ? coils[0] : null);
  return o && o.t > 0 ? o.t / o.max : 0;
}
// 화면 아래 가운데 스킬 칸 (Z X V B): 끼운 쉘 그림·등급 테두리, 대기시간(시계 방향으로 걷힘), 지속 중인 효과 막대. 커서를 올리면 쉘 설명
function drawSkillBar() {
  if (inBase || !player) return;
  const p = player, s = 46, gap = 8, x0 = Math.round(W / 2 - (4 * s + 3 * gap) / 2), y0 = VH - s - 10;
  let hover = null;
  p.shells.forEach((sh, n) => {
    const x = x0 + n * (s + gap), S = sh && SKILLS[sh.id], cd = sh ? p.scd[sh.id] || 0 : 0, left = sh ? skillLeft(sh.id) : 0;
    ctx.fillStyle = 'rgba(12,12,10,0.82)'; rr(x, y0, s, s, 6); ctx.fill();
    ctx.strokeStyle = !sh ? '#3a3830' : left ? (Math.sin(gtime * 10) > 0 ? S.color : '#fff') : cd > 0 ? '#5a5648' : RARITY[sh.rarity].color;
    ctx.lineWidth = left ? 2.5 : 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    if (sh) {
      drawIcon(S.icon, x + 6, y0 + 5, s - 12, s - 14);
      if (cd > 0) {
        ctx.save(); rr(x, y0, s, s, 6); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.beginPath(); ctx.moveTo(x + s / 2, y0 + s / 2);
        ctx.arc(x + s / 2, y0 + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(cd / shellVals(sh).cd, 0, 1)); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#000'; ctx.fillText(Math.ceil(cd), x + s / 2 + 1, y0 + s / 2 + 6); ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(cd), x + s / 2, y0 + s / 2 + 5);
      }
      if (left) { ctx.fillStyle = S.color; ctx.fillRect(x + 3, y0 + 2, (s - 6) * clamp(left, 0, 1), 3); }
    } else { ctx.font = '10px sans-serif'; ctx.fillStyle = '#5a5648'; ctx.fillText('빈 칸', x + s / 2, y0 + s / 2 + 4); }
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y0 + s - 14, 13, 13);
    ctx.fillStyle = sh ? '#ffd27a' : '#6a6458'; ctx.fillText(SHELL_SLOTS[n], x + 3.5, y0 + s - 3);
    if (sh && mouse.x >= x && mouse.x < x + s && mouse.y >= y0 && mouse.y < y0 + s) hover = { sh, x };
  });
  const res = ATTR_KEYS.filter(k => resTier(k)); // 계열 공명
  ctx.textAlign = 'right'; ctx.font = 'bold 11px sans-serif';
  res.forEach((k, n) => { const t = `${ATTRS[k].name} 공명 ${RES_LABEL[resTier(k)]}`; ctx.fillStyle = '#000'; ctx.fillText(t, x0 - 9, y0 + 17 + n * 15); ctx.fillStyle = ATTRS[k].color; ctx.fillText(t, x0 - 10, y0 + 16 + n * 15); });
  if (hover && !held) { const L = shellTooltip(hover.sh); drawTooltip(L, hover.x - 60, y0 - L.length * 17 - 18, VH); }
}

let meleeNow = false; // 근접 공격이 맞히는 중인 무기 스탯 (장갑 무시·방패 강타·처치 보급 — 체인톱은 탄약 더)
function doMelee(w) {
  meleeNow = w;
  try { meleeSwing(w); } finally { meleeNow = false; }
}
function meleeSwing(w) {
  const p = player, saw = !!w.saw, start = saw && !(gtime - (p.sawAt ?? -9) < 0.3); // 체인톱: 0.1초마다 갈아 냄 (잠시 멈췄다 다시 켜면 시동 소리)
  if (saw) p.sawAt = gtime;
  p.swing = p.swingMax = saw ? 0.15 : 0.18; p.fireT = 0.14;
  const mul = (p.fx.adren > 0 ? 1.2 : 1) * (1 + perkV('blade')) * takeAmbush(); // 아드레날린, 검술, 은신 기습
  let hit = false, hitN = 0, near = null, nd = 1e9;
  const struck = [];
  for (const e of enemies) {
    if (e.dead || hiddenE(e)) continue; // 천장·땅속의 적은 휘둘러도 닿지 않음
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 0.01;
    if (d > w.range + e.r) continue;
    if (d > 0.45 && Math.abs(angDiff(Math.atan2(dy, dx), p.aim)) > w.arc / 2) continue;
    weaponHit(e, w, w.dmg * mul, dx / d * w.knock * 5, dy / d * w.knock * 5);
    if (w.stun) e.stun = Math.max(e.stun, w.stun * ccScale(e));
    if (!e.dead && !e.d.boss) interrupt(e); // 준비 동작 끊기
    hit = true; hitN++; struck.push(e);
    if (d < nd) { near = e; nd = d; }
    if (saw) spark(e.x, e.y, 2, '#ffcf80', 2.5); // 갈리는 불똥
  }
  if (w.chain && near) { // 방전 진압봉: 가장 가까이 맞은 적에게서 번개가 튐 (같이 맞은 적은 건너뜀)
    spark(near.x, near.y, 6, '#9df', 3); Snd.play('zap', near.x, near.y);
    chainBolt(near, w.dmg * mul * w.chain.mul, w.chain.n, struck);
  }
  let cut = 0; // 날아오는 적 탄 쳐내기 (휘두른 방향) — 체인톱은 못 함, 플라즈마 블레이드는 되돌려 보냄
  if (!saw) for (const s of eshots) {
    const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy);
    if (s.dead || d > w.range + MELEE.deflect || (d > 0.45 && Math.abs(angDiff(Math.atan2(dy, dx), p.aim)) > w.arc / 2 + 0.25)) continue;
    s.dead = true; cut++; spark(s.x, s.y, 6, w.reflect ? '#9ef' : '#ffe9a0', 3);
    if (w.reflect) reflectShot(s, w, mul);
  }
  if (cut) { addText(p.x, p.y, w.reflect ? '되받아침!' : '쳐냄!', w.reflect ? '#7ef' : '#ffe9a0', 46); Snd.play('armorHit', p.x, p.y); hit = true; }
  if (w.uq === 'vamp' && hitN) { const h = Math.round(w.dmg * mul * hitN * 0.15); if (heal(p, h)) addText(p.x, p.y, `+${h}`, '#7f7', 50); } // 핏빛 송곳니: 흡혈
  if (w.uq === 'bolt') { // 뇌격창: 찌른 방향으로 번개가 벽까지(최대 6칸) 뻗어 일직선의 적을 꿰뚫음
    const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
    let L = 0.5;
    while (L < 6 && !blocksShot(p.x + ca * L, p.y + sa * L)) L += 0.2;
    for (const e of enemies) {
      if (e.dead || hiddenE(e)) continue;
      const dx = e.x - p.x, dy = e.y - p.y, along = dx * ca + dy * sa;
      if (along > 0.3 && along < L + e.r && Math.abs(dx * sa - dy * ca) < 0.45 + e.r) { weaponHit(e, w, w.dmg * mul * 0.6, ca * 2, sa * 2); hit = true; }
    }
    beams.push({ x0: p.x + ca * 0.6, y0: p.y + sa * 0.6, x1: p.x + ca * L, y1: p.y + sa * L, t: 0.25, col: '170,210,255' });
    flashes.push({ x: p.x + ca * L * 0.5, y: p.y + sa * L * 0.5, r: 160, t: 0.15, max: 0.15, col: '150,190,255' });
    Snd.play('zap');
  }
  for (const b of barrels) {
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (b.dead || d > w.range + 0.3 || (d > 0.45 && Math.abs(angDiff(Math.atan2(b.y - p.y, b.x - p.x), p.aim)) > w.arc / 2)) continue; // 휘두른 방향만
    hitBarrel(b, w.dmg); hit = true;
  }
  // 휘두른 범위 안의 상자 (가장 가까운 면까지의 거리)
  const R = Math.ceil(w.range + 1);
  for (let j = Math.floor(p.y) - R; j <= Math.floor(p.y) + R; j++) for (let i = Math.floor(p.x) - R; i <= Math.floor(p.x) + R; i++) {
    if (tileAt(i, j) !== T.CRATE) continue;
    const d = Math.hypot(clamp(p.x, i + 0.1, i + 0.9) - p.x, clamp(p.y, j + 0.1, j + 0.9) - p.y);
    if (d > w.range + 0.05 || (d > 0.45 && Math.abs(angDiff(Math.atan2(j + 0.5 - p.y, i + 0.5 - p.x), p.aim)) > w.arc / 2)) continue;
    hitCrate(i, j, w.dmg * mul); hit = true;
  }
  if (saw) { // 체인톱 소리: 시동 → 계속 돌아가는 소리 + 갈리는 소리, 흔들림은 약하게
    if (start) Snd.play('sawUp'); else { Snd.play('sawRun'); if (hit) Snd.play('sawHit'); }
    if (hit) shake = Math.max(shake, 1.2);
    return;
  }
  Snd.play(hit ? 'meleeHit' : 'swing');
  if (hit) shake = Math.max(shake, 2.5);
}
// 플라즈마 블레이드: 쳐낸 적 탄을 앞쪽의 적(자동 조준, 없으면 겨눈 쪽)으로 되돌려 보냄 — 푸른 플라즈마 탄, 로켓은 터지는 로켓으로
function reflectShot(s, w, mul) {
  const p = player, tgt = findTarget(14), a = tgt ? Math.atan2(tgt.y - s.y, tgt.x - s.x) : p.aim, sp = Math.max(16, Math.hypot(s.vx, s.vy) * 1.5), rocket = s.type === 'rocket';
  bullets.push({ x: s.x, y: s.y, px: s.x, py: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2, dmg: s.dmg * 2 + w.dmg * mul * 0.5, pierce: 0, hits: [], col: '#9ef', wid: 2,
    target: tgt, s: w, kind: rocket ? 'rocket' : 'plasma', dir: a, blastR: rocket ? 2 : 0 });
}
const PROJ_COL = { plasma: '120,180,255', rocket: '255,170,80', micro: '255,170,80', bfg: '140,170,255' }; // 에너지·중화기 총구 섬광·빛 색
function fireGun(w) {
  const p = player, wi = curW();
  if (Math.random() >= perkV('saver')) wi.mag--; // 탄약 절약: 가끔 탄을 쓰지 않음
  // 자동 조준: 사격 방향 안의 가장 가까운 적을 향해 발사
  const tgt = p.target, base = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.aim;
  const n = w.pellets || 1, ca = Math.cos(base), sa = Math.sin(base);
  const ox = p.x + ca * 0.45, oy = p.y + sa * 0.45;
  const homing = n === 1 ? tgt : null; // 단발 화기는 목표에 반드시 명중, 샷건 산탄은 목표 중심으로 퍼짐
  const last = w.uq === 'judge' && wi.mag === 0, fury = w.uq === 'fury' && p.spin >= 0.99; // 심판자의 마지막 탄, 다 돈 분노의 회전
  const amb = takeAmbush(); // 은신 중이면 기습 (모든 산탄에)
  // 조준당한 제노이드: 일정 확률로 옆으로 뛰어 피함 (아주 짧은 반응 시간 뒤, 가까우면 안 피함)
  const D = tgt && tgt.d.dodge;
  if (D && tgt.aggro && !tgt.leapT && !tgt.dodgeIn && !(tgt.dodgeCd > 0) && !tgt.stun && !tgt.freeze && Math.hypot(tgt.x - p.x, tgt.y - p.y) > D.min && Math.random() < D.chance) tgt.dodgeIn = 0.02;
  for (let k = 0; k < n; k++) {
    const a = base + (homing ? 0 : (Math.random() - 0.5) * w.spread * (p.fx.adren > 0 ? 0.8 : 1));
    const sp = (w.speed || 28) * rnd(0.92, 1.05);
    bullets.push({ x: ox, y: oy, px: ox, py: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (w.range || 16) * (homing ? 1.3 : 1) / sp, dmg: w.dmg * (1 + perkV('gun')) * (last ? 3 : 1) * amb,
      pierce: (w.pierce || 0) + (fury ? 2 : 0) + (buff('deadeye')?.pierce || 0), hits: [], col: last ? '#ff5a3a' : fury ? '#ff8a40' : w.tracer || '#ffd27a', wid: last ? 3.5 : n > 1 ? 1.5 : 2.2, target: homing, s: w,
      kind: w.proj || 'bullet', dir: base, force: last, bounce: w.uq === 'ricochet' ? 1 : 0, jumps: w.uq === 'arc' ? 2 : 0 });
  }
  if (last) { shake = Math.max(shake, 7); flashes.push({ x: ox, y: oy, r: 300, t: 0.15, max: 0.15, col: '255,90,60' }); }
  flashes.push({ x: ox, y: oy, r: n > 1 ? 280 : w.proj === 'bfg' ? 520 : 200, t: w.proj === 'bfg' ? 0.25 : 0.06, max: w.proj === 'bfg' ? 0.25 : 0.06, col: PROJ_COL[w.proj] || '255,200,120' });
  if (!w.proj) parts.push({ x: p.x, y: p.y, z: 20, vx: -sa * rnd(1, 2), vy: ca * rnd(1, 2), vz: 60, g: 300, life: 0.5, max: 0.5, col: '#d9b45a', size: 2 }); // 탄피
  shake = Math.max(shake, w.shake || 1.5);
  if (!w.charge) Snd.play(w.snd || 'pistol'); // 분쇄포는 충전을 시작할 때 소리
  alertNear(p.x, p.y, 9); p.fireT = 0.12;
  if (wi.mag <= 0) startReload();
}
function startReload() {
  const p = player, wi = curW(), w = wi.s;
  if (w.type !== 'gun' || p.reload > 0 || wi.mag >= w.mag || p.ammo[w.ammo] < (w.cost || 1)) return false;
  p.reload = p.reloadMax = w.reload * (1 - perkV('reload')); p.charging = 0; Snd.play('reload'); return true;
}
function finishReload() {
  const p = player, wi = curW(), w = wi.s, cost = w.cost || 1; // cost: 한 발에 드는 탄약 (분쇄포는 셀 40)
  const take = Math.min(w.mag - wi.mag, Math.floor(p.ammo[w.ammo] / cost));
  wi.mag += take; p.ammo[w.ammo] -= take * cost; p.reload = 0;
}
// 폭심 (고유 전설 저격소총): 꿰뚫은 적 자리에서 작은 폭발 (반경 1.8칸, 탄 피해의 60%, 플레이어는 안전)
function uniqueBlast(b, x, y) {
  for (const o of enemies) {
    if (o.dead) continue;
    const d = Math.hypot(o.x - x, o.y - y);
    if (d < 1.8 + o.r) hitEnemy(o, b.dmg * 0.6 * (1 - Math.min(1, d / 2.4)), (o.x - x) / (d || 1) * 4, (o.y - y) / (d || 1) * 4);
  }
  for (const br of barrels) if (!br.dead && Math.hypot(br.x - x, br.y - y) < 1.8) setTimeout(() => hitBarrel(br, 99), 60);
  addFx('misl', 'bcd', x, y, 16, 0.35, 0.9); fireBurst(x, y, 12, 3);
  flashes.push({ x, y, r: 260, t: 0.25, max: 0.25, col: '255,150,60' }); shake = Math.max(shake, 5); Snd.play('explode', x, y);
}
// 로켓·분쇄포가 터짐: 반경 안의 적에게 가까울수록 큰 피해(무기 옵션도 적용), 로켓은 너무 가까우면 플레이어도 다침
function weaponBlast(b, x, y) {
  const s = b.s, R = s.blast, big = b.kind === 'bfg', bm = 1 + perkV('blast'); // 폭파 전문가
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < R + e.r) weaponHit(e, s, b.dmg * bm * (1 - Math.min(1, d / (R + e.r)) * 0.6), (e.x - x) / (d || 1) * (big ? 10 : 7), (e.y - y) / (d || 1) * (big ? 10 : 7));
  }
  for (const br of barrels) if (!br.dead && Math.hypot(br.x - x, br.y - y) < R) setTimeout(() => hitBarrel(br, 99), 60);
  const pd = Math.hypot(player.x - x, player.y - y);
  if (!big && pd < R * 0.8) hurtPlayer(b.dmg * 0.35 * (1 - pd / R), x, y); // 분쇄포는 원작 BFG처럼 쏜 사람은 안 다침
  if (big) {
    addFx('bfe1', 'abcd', x, y, 14, 0.6, 2.4); smoke(x, y, 20, '110,130,190', 2.5);
    flashes.push({ x, y, r: 900, t: 0.5, max: 0.5, col: '140,170,255' }); shake = Math.max(shake, 22); Snd.play('bfgBoom', x, y);
    // 앞쪽에 보이는 적들을 번개처럼 꿰뚫음 (Doom의 BFG처럼)
    for (const e of enemies) {
      if (e.dead || Math.hypot(e.x - player.x, e.y - player.y) > 14 || Math.abs(angDiff(Math.atan2(e.y - player.y, e.x - player.x), b.dir)) > 0.8 || !canSee(e.x, e.y)) continue;
      beams.push({ x0: player.x, y0: player.y, x1: e.x, y1: e.y, t: 0.35, col: '150,180,255' });
      addFx('bfe2', 'abcd', e.x, e.y, 20, 0.45, 1.2);
      weaponHit(e, s, b.dmg * 0.35 * bm, 0, 0);
    }
  } else {
    addFx('misl', 'bcd', x, y, 10, 0.45, 1.6); fireBurst(x, y, 30, 4); smoke(x, y, 14, '70,60,50', 2);
    flashes.push({ x, y, r: 460, t: 0.3, max: 0.3, col: '255,150,60' }); shake = Math.max(shake, 10); Snd.play('explode', x, y);
  }
  decal(x, y, R * 0.45, 'rgba(10,8,6,0.7)');
  if (s.uq === 'cluster') for (let k = 0; k < 4; k++) { // 벌집: 작은 폭탄 4개가 흩어져 터짐 (벽 너머로는 안 감)
    const a = k * Math.PI / 2 + rnd(-0.6, 0.6);
    let r = rnd(1.2, 2.6);
    while (r > 0.4 && blocksShot(x + Math.cos(a) * r, y + Math.sin(a) * r)) r -= 0.3;
    grenades.push({ type: 'frag', sx: x, sy: y, tx: x + Math.cos(a) * r, ty: y + Math.sin(a) * r, x, y, z: 10, z0: 10, arc: 28, t: 0, dur: rnd(0.3, 0.55), own: true, scale: 0.45 });
  }
}

// ===== 무기 개체 (등급 + 랜덤 옵션) =====
let uidSeq = 1;
// 장착 슬롯이 비었을 때 쓰는 맨손
const FISTS = { id: 'fists', rarity: 0, affixes: [], name: '맨손', mag: 0,
  s: { name: '맨손', cat: 0, type: 'melee', dmg: 7, rate: 0.35, range: 1.0, arc: 1.4, knock: 0.3, stamina: 4, weight: 0, size: [1, 1], crit: 0, elem: null } };
const curW = () => player.equip[player.slot] || FISTS;

function weaponStats(inst) {
  const b = WEAPONS[inst.id], s = { ...b, crit: 0, elem: null };
  for (const a of inst.affixes) {
    if (a.k === 'dmg') s.dmg = b.dmg * (1 + a.v);
    else if (a.k === 'rate') s.rate = b.rate / (1 + a.v);
    else if (a.k === 'mag') s.mag = Math.max(b.mag + 1, Math.round(b.mag * (1 + a.v)));
    else if (a.k === 'reload') s.reload = b.reload * (1 - a.v);
    else if (a.k === 'acc') s.spread = b.spread * (1 - a.v);
    else if (a.k === 'crit') s.crit = a.v;
    else if (a.k === 'elem') s.elem = { type: a.type, chance: a.v };
  }
  for (const g of inst.gems || []) { // 끼운 보석: 치명타·공격속도·정예 피해·속성 확률
    const [k, vals] = GEMS[g.id].weapon, v = vals[g.grade];
    if (k === 'crit') s.crit += v;
    else if (k === 'rate') s.rate /= 1 + v;
    else if (k === 'elite') s.eliteDmg = (s.eliteDmg || 0) + v;
    else (s.gemProc = s.gemProc || {})[k] = (s.gemProc[k] || 0) + v;
  }
  const RW = inst.rw && RUNEWORDS[inst.rw]; // 보석 조합: 피해·공격속도·치명타·정예 피해는 수치로, 나머지는 명중·처치 효과 (weaponHit·killEnemy)
  if (RW) for (const [k, v] of Object.entries(RW.stats)) {
    if (k === 'dmg') s.dmg *= 1 + v;
    else if (k === 'rate') s.rate /= 1 + v;
    else if (k === 'crit') s.crit += v;
    else if (k === 'elite') s.eliteDmg = (s.eliteDmg || 0) + v;
    else (s.rw = s.rw || {})[k] = v;
  }
  s.dmg *= 1 + ENHANCE_DMG * (inst.plus || 0); // 기지에서 강화한 만큼
  if (inst.uq) { s.uq = inst.uq; if (UNIQUES[inst.uq].tracer) s.tracer = UNIQUES[inst.uq].tracer; } // 고유 전설: 효과 키, 탄 색
  return s;
}
// 등급·옵션·강화가 정해진 무기 개체 (저장 불러오기에도 사용). uq: 고유 전설 키, sockets: 소켓 수, gems: 끼운 보석 [{ id, grade }]
function buildWeapon(id, rarity, affixes, plus = 0, uq, sockets = 0, gems = []) {
  const inst = { uid: uidSeq++, id, rarity, affixes, plus, gx: 0, gy: 0, sockets, gems };
  if (uq && UNIQUES[uq]) inst.uq = uq;
  refreshWeapon(inst);
  inst.mag = inst.s.mag || 0;
  return inst;
}
function refreshWeapon(inst) {
  const b = WEAPONS[inst.id], top = inst.affixes.find(a => a.k === 'elem') || inst.affixes[0];
  inst.rw = runewordOf(inst); // 보석 조합 (끼운 보석에서 정해짐 — 저장하지 않음)
  inst.s = weaponStats(inst);
  inst.name = (inst.plus ? `+${inst.plus} ` : '') + (inst.uq ? UNIQUES[inst.uq].name : inst.set ? SET_ITEMS[inst.set].name : inst.rw ? RUNEWORDS[inst.rw].name : top ? `${top.k === 'elem' ? ELEMS[top.type].prefix : AFFIXES[top.k].prefix} ${b.name}` : b.name);
}
const makeUnique = key => buildWeapon(UNIQUES[key].base, 4, UNIQUES[key].affixes.map(a => ({ ...a })), 0, key);
// chance 확률로 이 구역에서 나올 수 있는 고유 전설 하나 (바탕 무기가 나오는 구역부터), 아니면 null
function uniqueDrop(chance) {
  const keys = Object.keys(UNIQUES).filter(k => WEAPONS[UNIQUES[k].base].minLvl <= level + 1);
  return keys.length && Math.random() < chance ? makeUnique(pick(keys)) : null;
}
// --- 세트 장비 (SETS, SET_ITEMS): 등급 5, 정해진 옵션. 같은 세트를 장착한 수만큼 세트 효과 (setSum → gearV·gearDef) ---
const setBaseLvl = k => { const b = SET_ITEMS[k].base; return (ARMORS[b] || WEAPONS[b]).minLvl || 1; };
function makeSetItem(k) {
  const S = SET_ITEMS[k], aff = S.affixes.map(a => ({ ...a })), it = ARMORS[S.base] ? buildArmor(S.base, 5, aff) : buildWeapon(S.base, 5, aff);
  it.set = k; (it.kind === 'armor' ? refreshArmor : refreshWeapon)(it);
  if (!it.kind) it.mag = it.s.mag;
  return it;
}
// chance 확률로 이 구역에서 나올 수 있는 세트 장비 하나 (바탕 장비가 나오는 구역부터), 아니면 null
function setDrop(chance) {
  const keys = Object.keys(SET_ITEMS).filter(k => setBaseLvl(k) <= level + 1);
  return keys.length && Math.random() < chance ? makeSetItem(pick(keys)) : null;
}
// 장착한 세트 장비 (무기 슬롯 + 방어구 칸): 세트별 장착 수
function setCounts(p = player) {
  const out = {}, seen = new Set();
  for (const it of [...p.equip, ...GEAR_KEYS.map(g => p.gear[g])]) if (it && it.set && SET_ITEMS[it.set] && !seen.has(it.set)) { seen.add(it.set); const s = SET_ITEMS[it.set].set; out[s] = (out[s] || 0) + 1; }
  return out;
}
// 켜진 세트 효과의 합 (k: 효과 키)
function setSum(k, p = player) {
  let v = 0;
  for (const [s, n] of Object.entries(setCounts(p))) for (const [t, B] of Object.entries(SETS[s].bonus)) if (n >= +t && B[k]) v += B[k];
  return v;
}
const setPieces = s => Object.keys(SET_ITEMS).filter(k => SET_ITEMS[k].set === s);
// 툴팁의 세트 줄: 세트 이름 (장착 수/전체), 조각마다 장착 여부, 단계별 효과 (켜진 것은 밝게)
function setLines(it, L) {
  const S = it.set && SET_ITEMS[it.set];
  if (!S) return;
  const T = SETS[S.set], pieces = setPieces(S.set), n = setCounts()[S.set] || 0, worn = new Set([...player.equip, ...GEAR_KEYS.map(g => player.gear[g])].filter(o => o && o.set).map(o => o.set));
  L.push({ t: `◆ ${T.name} (${n}/${pieces.length})`, c: SET_COLOR, b: true });
  for (const k of pieces) L.push({ t: `   ${worn.has(k) ? '✓' : '·'} ${SET_ITEMS[k].name}`, c: worn.has(k) ? '#bff5b0' : '#6f7f6a' });
  for (const [t, B] of Object.entries(T.bonus)) L.push({ t: `(${t}) ${Object.entries(B).map(([q, v]) => SET_FX[q](v)).join(' · ')}`, c: n >= +t ? SET_COLOR : '#5f6f5a' });
  L.push({ t: `"${T.flavor}"`, c: '#d0604a' });
}
// 세트 장비가 바뀌었는지 (무기 슬롯을 바꿔도 최대 체력 등이 바로 바뀌게 — update에서 확인)
let setSig = '';
function checkSets() {
  const c = setCounts(), s = JSON.stringify(c);
  if (s === setSig) return;
  setSig = s; gearChanged();
  if (Object.entries(c).some(([k, n]) => n >= setPieces(k).length)) codexStat('setFull', 1); // 업적: 세트 하나를 모두 장착
}
// 판매·강화 기준 가치
const basePrice = inst => (inst.kind === 'armor' ? ARMORS[inst.id].price : WEAPONS[inst.id].price) || 120;
const weaponValue = inst => inst.kind === 'gem' ? GEM_PRICE[inst.grade] // 보석: 등급별 값
  : inst.kind === 'shell' ? SKILLS[inst.id].price * RARITY_VALUE[inst.rarity] // 스킬 쉘: 스킬 값 x 등급
  : basePrice(inst) * (inst.rw ? RW_VALUE : RARITY_VALUE[inst.rarity]) * (1 + 0.3 * (inst.plus || 0)) + (inst.gems || []).reduce((t, g) => t + GEM_PRICE[g.grade], 0); // 끼운 보석 값도
const enhanceCost = inst => Math.round(basePrice(inst) * RARITY_VALUE[inst.rarity] * 0.5 * ((inst.plus || 0) + 1));
const sellPrice = inst => Math.round(weaponValue(inst) * SELL_RATE);
const weaponPool = id => { const b = WEAPONS[id]; return Object.keys(AFFIXES).filter(k => (!AFFIXES[k].gun || b.type === 'gun') && (!AFFIXES[k].needSpread || b.spread > 0)); };
function rollWeaponAffix(id, rarity, k) {
  const A = AFFIXES[k], q = clamp(Math.random() * 0.7 + rarity * 0.1, 0, 1), a = { k, v: A.min + (A.max - A.min) * q }; // 높은 등급일수록 좋은 수치
  if (k === 'elem') a.type = pick(Object.keys(ELEMS));
  return a;
}
function makeWeapon(id, rarity = 0) {
  const pool = weaponPool(id), affixes = [], [lo, hi] = RARITY[rarity].affixes;
  for (let n = irnd(lo, hi); n > 0 && pool.length; n--) affixes.push(rollWeaponAffix(id, rarity, pool.splice(Math.floor(Math.random() * pool.length), 1)[0]));
  return rollSockets(buildWeapon(id, rarity, affixes));
}
function rollRarity(bonus = 0) {
  return +weighted({
    0: RARITY[0].weight, 1: RARITY[1].weight + bonus * 5,
    2: RARITY[2].weight + level * 1.5 + bonus * 6, 3: RARITY[3].weight + level * 0.5 + bonus * 3,
  });
}
// heavy: 에너지·중화기가 나올 수 있는 구역이면 그중에서 고를 확률 (정예·보스 보상)
function randomLootWeapon(bonus = 0, heavy = 0) {
  const ids = Object.keys(WEAPONS).filter(k => WEAPONS[k].minLvl <= level + 1), big = ids.filter(k => WEAPONS[k].cat === 5);
  return makeWeapon(pick(big.length && Math.random() < heavy ? big : ids), rollRarity(bonus));
}
// 지속 DPS: 총기는 재장전 시간 포함, 산탄은 전부 맞았다고 가정
const weaponDps = s => s.dmg * (s.pellets || 1) * (1 + (s.crit || 0)) *
  (s.type === 'gun' ? s.mag / (s.mag * s.rate + s.reload) : 1 / s.rate);

function dropWeapon(x, y, inst) {
  const ox = rnd(-0.3, 0.3), oy = rnd(-0.3, 0.3), free = !collides(x + ox, y + oy, 0.1, false);
  pickups.push({ x: free ? x + ox : x, y: free ? y + oy : y, kind: 'weapon', inst, bob: rnd(0, 6) });
  if (inst.uq && !inst.found) { // 고유 전설이 처음 떨어지면 알림 + 빛기둥
    inst.found = true; codexItem(inst);
    msg(`★ 고유 전설 발견: ${inst.name}`, RARITY[4].color); Snd.play('unique', x, y); tip('unique', inst.kind === 'shell' ? SKILLS[inst.id].icon : 'icon_' + inst.id);
    flashes.push({ x, y, r: 420, t: 0.6, max: 0.6, col: RARITY[4].glow });
  }
  if (inst.set && !inst.found) { // 세트 장비
    inst.found = true; codexItem(inst);
    msg(`◆ 세트 장비 발견: ${inst.name} — ${SETS[SET_ITEMS[inst.set].set].name}`, SET_COLOR); Snd.play('unique', x, y); tip('set');
    flashes.push({ x, y, r: 420, t: 0.6, max: 0.6, col: RARITY[5].glow });
  }
}
function nearestWeaponPickup() {
  let best = null, bd = 1.3;
  for (const it of pickups) {
    if (it.dead || it.kind !== 'weapon' || it.inst.kind === 'gem') continue; // 보석은 저절로 주워짐
    const d = Math.hypot(it.x - player.x, it.y - player.y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
function pickUpWeapon() {
  const it = nearestWeaponPickup();
  if (!it) return;
  const where = addWeapon(it.inst);
  if (!where) { msg('가방에 공간이 없습니다', '#f99'); tip('bagfull'); return; }
  it.dead = true; Snd.play('weapon');
  msg(`${it.inst.name} 획득 — ${where === 'pouch' ? '보석 주머니' : where !== 'equip' ? '가방' : it.inst.kind === 'shell' ? `[${SHELL_SLOTS[player.shells.indexOf(it.inst)]}] 스킬 칸에 장착` : it.inst.kind === 'armor' ? `${ARMOR_SLOTS[it.inst.s.slot]} 칸에 장착` : `${it.inst.s.cat + 1}번 슬롯에 장착`}`, itemColor(it.inst));
}

// ===== 장착 / 가방 =====
function onActiveWeaponChanged() { const p = player; p.reload = 0; p.cool = Math.max(p.cool, 0.2); p.spin = 0; p.charging = 0; }
function selectSlot(c) {
  const p = player;
  if (c >= slotsOpen()) { msg(`${c + 1}번 무기 슬롯은 잠겨 있습니다 — 무기고를 해제하면 열린다`, '#a99'); tip('armory'); return; }
  if (!p.equip[c]) { msg(`${c + 1}번 슬롯이 비어 있습니다`, '#a99'); return; }
  if (p.slot === c) return;
  p.slot = c; onActiveWeaponChanged();
  msg(p.equip[c].name, itemColor(p.equip[c]));
}
function cycleWeapon(dir) {
  const p = player, n = slotsOpen();
  for (let k = 1; k <= n; k++) { const c = (p.slot + dir * k + n * 10) % n; if (p.equip[c]) { selectSlot(c); return; } }
}
const freeSlot = () => { for (let c = 0; c < slotsOpen(); c++) if (!player.equip[c]) return c; return -1; }; // 비어 있는 열린 무기 슬롯
const inBag = (inst, gx, gy) => gx >= 0 && gy >= 0 && gx + inst.s.size[0] <= BAG_W && gy + inst.s.size[1] <= bagH();
// 격자(가방·상점 진열대) 위의 무기 배치
function gridOverlaps(list, inst, gx, gy) {
  const [w, h] = inst.s.size;
  return list.filter(o => o !== inst && gx < o.gx + o.s.size[0] && gx + w > o.gx && gy < o.gy + o.s.size[1] && gy + h > o.gy);
}
function gridFindSpot(list, inst, cols, rows) {
  for (let gy = 0; gy + inst.s.size[1] <= rows; gy++)
    for (let gx = 0; gx + inst.s.size[0] <= cols; gx++)
      if (!gridOverlaps(list, inst, gx, gy).length) return { gx, gy };
  return null;
}
const bagOverlaps = (inst, gx, gy) => gridOverlaps(player.bag, inst, gx, gy);
const bagFindSpot = inst => gridFindSpot(player.bag, inst, BAG_W, bagH());
const bagItemAt = (cx, cy) => player.bag.find(o => cx >= o.gx && cx < o.gx + o.s.size[0] && cy >= o.gy && cy < o.gy + o.s.size[1]);
const removeFromBag = inst => { player.bag = player.bag.filter(o => o !== inst); };
// 가방 정렬: 큰 장비부터 (같으면 무기 분류·방어구·쉘 순, 높은 등급 먼저) 왼쪽 위부터 다시 놓음 — 몇 가지 순서로 해 보고, 다 들어가지 않으면 그대로
function sortBag() {
  const p = player, old = p.bag.map(o => [o, o.gx, o.gy]), items = p.bag.slice();
  const rank = o => o.kind === 'shell' ? 20 : o.kind === 'armor' ? 10 + GEAR_KEYS.indexOf(o.s.slot) : o.s.cat;
  const tie = (a, b) => rank(a) - rank(b) || b.rarity - a.rarity || String(a.id).localeCompare(String(b.id));
  const orders = [(a, b) => b.s.size[1] - a.s.size[1] || b.s.size[0] - a.s.size[0] || tie(a, b),
    (a, b) => b.s.size[0] * b.s.size[1] - a.s.size[0] * a.s.size[1] || tie(a, b),
    (a, b) => b.s.size[0] - a.s.size[0] || b.s.size[1] - a.s.size[1] || tie(a, b)];
  for (const ord of orders) {
    p.bag = [];
    if (items.slice().sort(ord).every(o => { const s = bagFindSpot(o); if (s) { o.gx = s.gx; o.gy = s.gy; p.bag.push(o); } return !!s; })) { Snd.play('pickup'); return true; }
  }
  for (const [o, gx, gy] of old) { o.gx = gx; o.gy = gy; }
  p.bag = items; msg('가방을 정렬할 수 없습니다 — 빈틈없이 다시 들어가지 않음', '#f99'); Snd.play('deny');
  return false;
}
// 빈 장착 슬롯이 있으면 장착, 아니면 가방 빈 자리에. 실패하면 null
function addWeapon(inst) {
  codexItem(inst); // 수집 도감: 고유 전설·보석 조합
  if (inst.kind === 'gem') { pouchAdd(inst, true); return 'pouch'; } // 보석: 보석 주머니로 (가방 칸을 차지하지 않음)
  if (inst.kind === 'shell') return addShell(inst);
  if (inst.kind === 'armor') return addArmor(inst);
  const p = player, c = freeSlot();
  if (c >= 0) { p.equip[c] = inst; if (c === p.slot) onActiveWeaponChanged(); return 'equip'; }
  const spot = bagFindSpot(inst);
  if (!spot) return null;
  inst.gx = spot.gx; inst.gy = spot.gy; p.bag.push(inst);
  return 'bag';
}
// 가방의 무기를 장착: 빈 무기 슬롯, 없으면 손에 든 무기와 바꿈 (빠진 무기는 그 자리나 빈 자리로, 자리가 없으면 바닥에)
function equipFromBag(inst) {
  const p = player, f = freeSlot(), c = f >= 0 ? f : p.slot < slotsOpen() ? p.slot : 0, old = p.equip[c];
  removeFromBag(inst); p.equip[c] = inst;
  if (c === p.slot) onActiveWeaponChanged();
  if (!old) return;
  const spot = inBag(old, inst.gx, inst.gy) && !bagOverlaps(old, inst.gx, inst.gy).length ? { gx: inst.gx, gy: inst.gy } : bagFindSpot(old);
  if (spot) { old.gx = spot.gx; old.gy = spot.gy; p.bag.push(old); }
  else { dropWeapon(p.x, p.y, old); msg(`가방이 가득 차 ${old.name}을(를) 바닥에 내려놓았습니다`, '#f99'); }
}
function unequipToBag(c) {
  const p = player, inst = p.equip[c], spot = inst && bagFindSpot(inst);
  if (!inst) return;
  if (!spot) { msg('가방에 공간이 없습니다', '#f99'); return; }
  p.equip[c] = null; inst.gx = spot.gx; inst.gy = spot.gy; p.bag.push(inst);
  if (c === p.slot) onActiveWeaponChanged();
}
function addAmmo(a, n) { player.ammo[a] = Math.min(ammoMax(a), player.ammo[a] + n); }
function throwGrenade() {
  const p = player;
  if (state !== 'play' || p.gcool > 0 || inBase) return;
  if (inHub() && !contested()) { noFight(); return; }
  if (p.gren[p.gsel] <= 0) { msg(`${GRENADES[p.gsel].name} 없음`, '#a99'); return; }
  const m = screenToWorld(mouse.x, mouse.y);
  let dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 0.01;
  const L = Math.min(d, 9); dx /= d; dy /= d;
  let tx = p.x, ty = p.y;
  for (let s = 0; s < L; s += 0.15) { const nx = p.x + dx * s, ny = p.y + dy * s; if (blocksShot(nx, ny)) break; tx = nx; ty = ny; }
  p.gren[p.gsel]--; p.gcool = 0.6;
  grenades.push({ type: p.gsel, sx: p.x, sy: p.y, tx, ty, x: p.x, y: p.y, z: 0, t: 0, dur: 0.3 + L * 0.06, own: true });
  Snd.play('throw');
}

// ===== 방어구 (머리·몸·다리 칸): ARMORS, ARMOR_AFFIXES =====
const GEAR_KEYS = Object.keys(ARMOR_SLOTS);
const armorPool = id => Object.keys(ARMOR_AFFIXES).filter(k => !ARMOR_AFFIXES[k].slots || ARMOR_AFFIXES[k].slots.includes(ARMORS[id].slot));
// 옵션 하나 굴리기 (others: 같은 장비의 다른 옵션 — 능력치 종류는 겹치지 않게)
function rollArmorAffix(id, rarity, k, others = []) {
  const A = ARMOR_AFFIXES[k], q = clamp(Math.random() * 0.7 + rarity * 0.1, 0, 1), v = A.min + (A.max - A.min) * q, a = { k, v: A.int ? Math.round(v) : v };
  if (k === 'stat') { const used = others.filter(b => b.k === 'stat').map(b => b.type); a.type = pick(ATTR_KEYS.filter(t => !used.includes(t))); }
  return a;
}
function makeArmor(id, rarity = 0) {
  const pool = armorPool(id), affixes = [], [lo, hi] = RARITY[rarity].affixes;
  for (let n = irnd(lo, hi); n > 0 && pool.length; n--) affixes.push(rollArmorAffix(id, rarity, pool.splice(Math.floor(Math.random() * pool.length), 1)[0], affixes));
  return rollSockets(buildArmor(id, rarity, affixes));
}
function buildArmor(id, rarity, affixes, plus = 0, sockets = 0, gems = []) {
  const inst = { uid: uidSeq++, kind: 'armor', id, rarity, affixes, plus, gx: 0, gy: 0, sockets, gems };
  refreshArmor(inst);
  return inst;
}
// 방어 = 기본 x 등급 x 방어 옵션 x 강화 + 자수정
function refreshArmor(inst) {
  const b = ARMORS[inst.id], top = inst.affixes[0];
  inst.rw = runewordOf(inst); // 보석 조합
  inst.s = { ...b, def: b.def * (1 + ARMOR_RARITY_DEF * inst.rarity) * (1 + affixSum(inst, 'def')) * (1 + ENHANCE_DMG * (inst.plus || 0)) + gemSum(inst, 'armor', 'defN') + rwStat(inst, 'defN') };
  inst.name = (inst.plus ? `+${inst.plus} ` : '') + (inst.set ? SET_ITEMS[inst.set].name : inst.rw ? RUNEWORDS[inst.rw].name : (top ? `${top.k === 'stat' ? ATTRS[top.type].prefix : ARMOR_AFFIXES[top.k].prefix} ` : '') + b.name);
}
const randomLootArmor = (bonus = 0) => makeArmor(pick(Object.keys(ARMORS).filter(k => ARMORS[k].minLvl <= level + 1)), rollRarity(bonus));
// 떨어지는 장비: ARMOR_DROP 확률로 방어구, 아니면 무기 (heavy: 에너지·중화기가 나올 확률)
const randomLoot = (bonus = 0, heavy = 0) => Math.random() < ARMOR_DROP ? randomLootArmor(bonus) : randomLootWeapon(bonus, heavy);
// 보상용: 일반 등급이면 같은 장비의 '고급'으로
const atLeastMagic = it => it.rarity ? it : it.kind === 'armor' ? makeArmor(it.id, 1) : makeWeapon(it.id, 1);
// 장착한 방어구: 옵션 합 + 끼운 보석 + 보석 조합 (type: 능력치 종류), 방어 합, 받는 피해 감소 비율
const gearV = (k, type, p = player) => GEAR_KEYS.reduce((s, g) => s + (p.gear[g] ? affixSum(p.gear[g], k, type) + (type ? 0 : gemSum(p.gear[g], 'armor', k) + rwStat(p.gear[g], k)) : 0), 0) + (type ? 0 : setSum(k, p) + achSum(k)); // + 세트 효과 + 업적 보너스
const gearDef = (p = player) => GEAR_KEYS.reduce((s, g) => s + (p.gear[g] ? p.gear[g].s.def : 0), 0) + setSum('defN', p) + achSum('defN');
const defCut = def => def / (def + ARMOR_K);
const gearChanged = () => applyUpgrades(player); // 체력 옵션 → 최대 체력
// 새로 얻은 방어구: 그 칸이 비었으면 장착, 아니면 가방. 실패하면 null
function addArmor(inst) {
  const p = player, g = inst.s.slot;
  if (!p.gear[g]) { p.gear[g] = inst; gearChanged(); tip('gear'); return 'equip'; }
  const spot = bagFindSpot(inst);
  if (!spot) return null;
  inst.gx = spot.gx; inst.gy = spot.gy; p.bag.push(inst); tip('gear');
  return 'bag';
}
// 가방의 방어구 우클릭: 같은 칸의 방어구와 바꿔 낌 (빠진 것은 그 자리나 빈 자리로, 없으면 바닥)
function equipArmorFromBag(inst) {
  const p = player, g = inst.s.slot, old = p.gear[g];
  removeFromBag(inst); p.gear[g] = inst; gearChanged(); Snd.play('pickup');
  if (!old) return;
  const spot = inBag(old, inst.gx, inst.gy) && !bagOverlaps(old, inst.gx, inst.gy).length ? { gx: inst.gx, gy: inst.gy } : bagFindSpot(old);
  if (spot) { old.gx = spot.gx; old.gy = spot.gy; p.bag.push(old); }
  else { dropWeapon(p.x, p.y, old); msg(`가방이 가득 차 ${old.name}을(를) 바닥에 내려놓았습니다`, '#f99'); }
}
function unequipArmor(g) {
  const p = player, inst = p.gear[g], spot = inst && bagFindSpot(inst);
  if (!inst) return;
  if (!spot) { msg('가방에 공간이 없습니다', '#f99'); return; }
  p.gear[g] = null; inst.gx = spot.gx; inst.gy = spot.gy; p.bag.push(inst); gearChanged();
}
function armorTooltip(inst) {
  const s = inst.s, R = RARITY[inst.rarity], L = [], eq = player.gear[s.slot];
  L.push({ t: inst.name, c: itemColor(inst), b: true });
  L.push({ t: `${inst.rw ? '보석 조합' : R.name} 방어구 · ${ARMOR_SLOTS[s.slot]} · ${s.size[0]}x${s.size[1]}칸 · 무게 ${s.weight}`, c: '#9a9' });
  for (const t of wrapWords(s.desc || '', 30)) L.push({ t, c: '#d8c89a' });
  L.push({ t: `방어 ${Math.round(s.def)}${inst.plus ? ` (강화 +${inst.plus})` : ''} — 이것만으로 받는 피해 -${pct(defCut(s.def))}`, c: '#eee' });
  for (const a of inst.affixes) L.push({ t: ARMOR_AFFIXES[a.k].text(a.v, a.type), c: a.k === 'stat' ? ATTRS[a.type].color : '#8af' });
  setLines(inst, L);
  rwLines(inst, L);
  socketLines(inst, L);
  if (eq && eq !== inst) {
    const d = Math.round(s.def - eq.s.def);
    L.push({ t: `장착 중: ${eq.name} (방어 ${Math.round(eq.s.def)})  ${d >= 0 ? '▲ +' + d : '▼ ' + d}`, c: d >= 0 ? '#7f7' : '#f77' });
  }
  const all = gearDef();
  L.push({ t: `지금 방어 합 ${Math.round(all)} — 받는 피해 -${pct(defCut(all))}`, c: '#9cf' });
  return L;
}
// 플레이어 상태 이상 (중독·화상·감전): 면역 중이면 무시, 방어구 저항만큼 짧게. 걸렸으면 true
function afflict(kind, t) {
  const f = player.fx;
  if ((kind === 'shock' ? f.immS : f.immP) > 0) return false;
  f[kind] = Math.max(f[kind], t * (1 - Math.min(0.8, gearV('res'))));
  return true;
}

// ===== 소켓 · 보석 (GEMS): 무기·방어구의 소켓에 보석을 끼움 — 무기 효과는 weaponStats·weaponHit, 방어구 효과는 gearV·refreshArmor =====
const GEM_S = { size: [1, 1], weight: 0 };
const gemName = (id, grade) => `${GEM_GRADES[grade] ? GEM_GRADES[grade] + ' ' : ''}${GEMS[id].name}`;
function makeGem(id, grade) { return { uid: uidSeq++, kind: 'gem', id, grade, rarity: grade, affixes: [], gx: 0, gy: 0, s: GEM_S, name: gemName(id, grade) }; }
// 이 구역 기준의 등급 (깊을수록 좋은 등급), bonus: 정예·보스·금고일수록 좋게
const gemGrade = (bonus = 0) => +weighted({ 0: Math.max(0.5, 7 - level * 0.8 - bonus * 2), 1: 1 + level * 0.6 + bonus, 2: Math.max(0, level - 3) * 0.35 + bonus * 0.6 });
const randomGem = (bonus = 0) => makeGem(pick(Object.keys(GEMS)), gemGrade(bonus));
// --- 보석 주머니: 보석은 가방 칸을 차지하지 않고 종류·등급별 개수로 (인벤토리 가방 아래 2줄 x 9칸) ---
const GEM_KEYS = Object.keys(GEMS);
function emptyPouch() { return Object.fromEntries(Object.keys(GEMS).map(k => [k, [0, 0, 0]])); }
function pouchAdd(g, quiet = false) {
  player.gemBag[g.id][g.grade]++;
  if (!quiet) { msg(`${g.name} → 보석 주머니`, GEMS[g.id].color); Snd.play('pickup'); }
  tip('gem', GEMS[g.id].icon); tip('pouch');
}
function pouchTake(id, grade) { const b = player.gemBag[id]; if (!b || !(b[grade] > 0)) return null; b[grade]--; return makeGem(id, grade); }
const pouchN = id => player.gemBag[id].reduce((a, b) => a + b, 0);
// 그리기·툴팁용 보석 정보 (개체를 새로 만들지 않음)
const gemInfo = (id, grade) => ({ kind: 'gem', id, grade, rarity: grade, name: gemName(id, grade), s: GEM_S, affixes: [] });
const itemColor = it => it.kind === 'gem' ? GEMS[it.id].color : it.rw ? RW_COLOR : RARITY[it.rarity].color; // 이름 색 (보석은 그 보석 색, 보석 조합은 청록, 세트는 초록 — 등급 5)
const SET_COLOR = RARITY[5].color;
// 소켓 최대 수: 큰 무기 3·보통 2·작은 무기 1 / 몸 방어구 3·머리·다리 2
const socketMax = it => it.kind === 'armor' ? (it.s.slot === 'body' ? 3 : 2) : it.s.size[0] * it.s.size[1] >= 8 ? 3 : it.s.size[0] * it.s.size[1] >= 4 ? 2 : 1;
const canSocket = it => !!it && (it.kind === 'armor' || !it.kind); // 무기·방어구만
// 새로 만든 장비: 등급별 확률로 소켓 1~최대 개 (일반 장비에 잘 붙음)
function rollSockets(it) { it.sockets = Math.random() < SOCKET_ROLL[Math.min(3, it.rarity)] ? irnd(1, socketMax(it)) : 0; it.gems = []; return it; }
// 끼운 보석 효과의 합 (part: 'weapon' | 'armor', k: 옵션 키)
const gemSum = (it, part, k) => (it.gems || []).reduce((t, g) => t + (GEMS[g.id][part][0] === k ? GEMS[g.id][part][1][g.grade] : 0), 0);
const gemFxText = (id, grade, part) => GEM_FX[GEMS[id][part][0]](GEMS[id][part][1][grade]);
// 무기·방어구 수치 다시 계산 (끼고 있는 방어구면 최대 체력 등도)
function refreshItem(it) { if (it.kind === 'armor') { refreshArmor(it); if (isEquipped(it)) gearChanged(); } else refreshWeapon(it); }
// --- 보석 조합 (RUNEWORDS): 소켓이 꼭 맞게 찬 '일반' 등급 장비의 보석 순서가 조합식과 같으면 그 조합 ---
function rwType(it) { return it.kind === 'armor' ? ARMORS[it.id].slot : 'weapon'; }
function runewordOf(it) {
  if (it.rarity !== 0 || it.uq || !it.sockets || (it.gems || []).length !== it.sockets) return null;
  const seq = it.gems.map(g => g.id).join(), t = rwType(it);
  return Object.keys(RUNEWORDS).find(k => RUNEWORDS[k].type === t && RUNEWORDS[k].gems.join() === seq) || null;
}
function rwStat(it, k) { return (it.rw && RUNEWORDS[it.rw].stats[k]) || 0; }
// 이 장비(일반 등급·소켓 수)에 맞는 조합식들
const rwFits = it => it.rarity !== 0 || it.uq || !it.sockets ? [] : Object.keys(RUNEWORDS).filter(k => RUNEWORDS[k].type === rwType(it) && RUNEWORDS[k].gems.length === it.sockets);
// 툴팁의 보석 조합 줄: 효과(◆)와 한 줄
function rwLines(it, L) {
  const RW = it.rw && RUNEWORDS[it.rw];
  if (!RW) return;
  L.push({ t: `보석 조합: ${RW.gems.map(id => GEMS[id].name).join(' → ')}`, c: RW_COLOR });
  for (const [k, v] of Object.entries(RW.stats)) L.push({ t: '◆ ' + RW_FX[k](v), c: RW_COLOR });
  L.push({ t: `"${RW.flavor}"`, c: '#d0604a' });
}
// 끼우기: 빈 소켓이 있으면 true (소켓이 다 차서 보석 조합이 되면 알림)
function socketGem(it, gem) {
  if (!canSocket(it) || (it.gems || []).length >= (it.sockets || 0)) return false;
  const had = it.rw;
  it.gems = [...(it.gems || []), { id: gem.id, grade: gem.grade }];
  refreshItem(it);
  if (it.rw && !had) {
    msg(`★ 보석 조합 완성: ${it.name} — ${Object.entries(RUNEWORDS[it.rw].stats).map(([k, v]) => RW_FX[k](v)).join(' · ')}`, RW_COLOR);
    Snd.play('unique'); tip('runeword'); rwFlash = performance.now(); codexItem(it);
    return true;
  }
  Snd.play('unlock'); msg(`${gem.name} → ${it.name}: ${gemFxText(gem.id, gem.grade, it.kind === 'armor' ? 'armor' : 'weapon')}`, GEMS[gem.id].color);
  return true;
}
let rwFlash = -1e9; // 보석 조합이 완성된 때 (인벤토리 창 테두리가 잠깐 청록으로 빛남)
function gemTooltip(g) {
  const G = GEMS[g.id], L = [];
  L.push({ t: g.name, c: G.color, b: true });
  L.push({ t: `보석 · ${['조각난 등급', '보통 등급', '완벽한 등급'][g.grade]} · 판매가 ${sellPrice(g)}G`, c: '#9a9' });
  L.push({ t: `무기에 끼우면: ${gemFxText(g.id, g.grade, 'weapon')}`, c: '#8af' });
  L.push({ t: `방어구에 끼우면: ${gemFxText(g.id, g.grade, 'armor')}`, c: '#9cf' });
  L.push({ t: '빈 소켓(◇)이 있는 무기·방어구 위에 끌어다 놓으면 끼워짐', c: '#ccc' });
  if (g.grade < 2) L.push({ t: `같은 보석 3개 → ${gemName(g.id, g.grade + 1)} (개조 자판기의 소켓·보석 탭)`, c: '#ccc' });
  return L;
}
// 툴팁의 소켓 줄: 끼운 보석 효과 (그 장비 종류 기준), 빈 소켓
function socketLines(it, L) {
  if (!it.sockets) return;
  const part = it.kind === 'armor' ? 'armor' : 'weapon', gems = it.gems || [];
  L.push({ t: `소켓 ${gems.length}/${it.sockets}`, c: '#bbb' });
  for (const g of gems) L.push({ t: `◆ ${gemName(g.id, g.grade)}: ${gemFxText(g.id, g.grade, part)}`, c: GEMS[g.id].color });
  for (let n = gems.length; n < it.sockets; n++) L.push({ t: '◇ 빈 소켓', c: '#777' });
  if (it.rw || gems.length >= it.sockets) return; // 보석 조합 안내: 지금까지 끼운 보석으로 시작하는 (소켓 수가 맞는) 조합식
  const seq = gems.map(g => g.id).join(), fit = rwFits(it).filter(k => RUNEWORDS[k].gems.slice(0, gems.length).join() === seq);
  for (const k of fit.slice(0, 3)) L.push({ t: `◇ 보석 조합 ${RUNEWORDS[k].name}: ${RUNEWORDS[k].gems.map((id, n) => n < gems.length ? `[${GEMS[id].name}]` : GEMS[id].name).join(' → ')}`, c: RW_COLOR });
  if (fit.length > 3) L.push({ t: `   외 ${fit.length - 3}개 — 개조 자판기의 보석 조합 탭`, c: '#7aa' });
}
// 개조 자판기: 소켓 뚫기 (지금 소켓 수에 따라 부품·골드), 보석 모두 빼기 (가방으로), 같은 보석 3개 합성
const socketCost = it => ({ parts: SOCKET_COST.parts[it.sockets || 0], gold: SOCKET_COST.gold[it.sockets || 0] });
function drillSocket(it) {
  const p = player, c = socketCost(it);
  if (!canSocket(it) || it.rw || (it.sockets || 0) >= socketMax(it) || p.parts < c.parts || p.gold < c.gold) return; // 보석 조합 장비는 소켓을 더 뚫지 못함
  p.parts -= c.parts; p.gold -= c.gold; it.sockets = (it.sockets || 0) + 1;
  trade.note = `${it.name}: 소켓 ${it.sockets}/${socketMax(it)}`; Snd.play('buy');
}
function unsocketAll(it) {
  const p = player, gems = it.gems || [], cost = UNSOCKET_GOLD * gems.length, rw = it.rw;
  if (!gems.length || p.gold < cost) return;
  for (const g of gems) pouchAdd(makeGem(g.id, g.grade), true); // 보석 주머니로
  p.gold -= cost; it.gems = []; refreshItem(it);
  trade.note = `${it.name}에서 보석 ${gems.length}개를 뺐다 (주머니로)${rw ? ` — 보석 조합 ${RUNEWORDS[rw].name}이(가) 풀렸다` : ''}`; Snd.play('pickup');
}
function combineGems(id, grade) {
  const p = player, b = p.gemBag[id];
  if (grade >= 2 || !b || b[grade] < 3 || p.gold < GEM_UP_GOLD[grade]) return;
  b[grade] -= 3; b[grade + 1]++; p.gold -= GEM_UP_GOLD[grade];
  trade.note = `합성: ${gemName(id, grade)} 3개 → ${gemName(id, grade + 1)}`; Snd.play('unique');
}
// 보석 주머니: 종류·등급별 개수 (합성 칸, 가진 것만)
function pouchStacks() {
  const out = [];
  for (const id of GEM_KEYS) player.gemBag[id].forEach((n, grade) => { if (n > 0) out.push({ id, grade, n }); });
  return out;
}
// '소켓 · 보석' 탭 배치: 고른 장비 상자, 소켓 줄, 보석 합성 칸 (2줄 x 10칸)
const sockLayout = g => ({ by: g.gy + 44, rowY: n => g.gy + 118 + n * 22, gemY: g.gy + 204 });
function drawSocketArea(g) {
  const p = player, L = sockLayout(g), it = trade.sel && ownedItems().includes(trade.sel) && canSocket(trade.sel) ? trade.sel : (trade.sel = null);
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText('소켓 · 보석', g.gx, g.gy + 14);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd27a'; ctx.fillText(`부품 ${p.parts}`, g.gx + VG_W * CELL, g.gy + 14);
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a9484';
  ctx.fillText(fitText('장비를 클릭해 소켓을 뚫거나 보석을 뺀다 · 보석은 주머니에서 집어 장비 위에 놓기', VG_W * CELL), g.gx, g.gy + 32);
  ctx.fillStyle = '#0b0a08'; ctx.fillRect(g.gx, L.by, 140, 64); ctx.strokeStyle = '#4a463c'; ctx.strokeRect(g.gx + 0.5, L.by + 0.5, 139, 63);
  if (!it) { ctx.textAlign = 'center'; ctx.fillStyle = '#6a6458'; ctx.fillText('무기·방어구를 클릭', g.gx + 70, L.by + 36); }
  else {
    const [sw, sh] = it.s.size, k = Math.min(132 / (sw * CELL), 56 / (sh * CELL));
    drawItemBox(it, g.gx + 70 - sw * CELL * k / 2, L.by + 32 - sh * CELL * k / 2, sw * CELL * k, sh * CELL * k);
    ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = itemColor(it); ctx.fillText(fitText(it.name, 190), g.gx + 150, L.by + 13);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a9484'; ctx.fillText(`소켓 ${(it.gems || []).length}/${it.sockets || 0} (최대 ${socketMax(it)})`, g.gx + 150, L.by + 28);
    const part = it.kind === 'armor' ? 'armor' : 'weapon';
    for (let n = 0; n < socketMax(it); n++) {
      const y = L.rowY(n), gm = (it.gems || [])[n], open = n < (it.sockets || 0);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(g.gx, y - 2, VG_W * CELL, 20);
      if (gm) { drawIcon(GEMS[gm.id].icon, g.gx + 4, y, 16, 16); ctx.fillStyle = GEMS[gm.id].color; ctx.fillText(fitText(`${gemName(gm.id, gm.grade)}: ${gemFxText(gm.id, gm.grade, part)}`, VG_W * CELL - 30), g.gx + 26, y + 12); }
      else { ctx.fillStyle = open ? '#8a8478' : '#4a463c'; ctx.fillText(open ? '◇ 빈 소켓' : '— 소켓 없음 (뚫을 수 있음)', g.gx + 8, y + 12); }
    }
  }
  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText('보석 주머니 — 같은 보석 3개가 모이면 클릭해 한 등급 위로', g.gx, L.gemY - 6);
  const stacks = pouchStacks();
  if (!stacks.length) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#6a6458'; ctx.fillText('보석이 없습니다 — 적·상자·금고에서 나옴', g.gx, L.gemY + 20); }
  for (const b of tradeButtons()) if (b.gem) { // 보석 칸: 그림 + 개수, 합성할 수 있으면 초록 테두리
    const { id, grade, n } = b.gem, hov = mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h;
    ctx.fillStyle = b.on ? 'rgba(80,200,90,0.16)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = hov ? '#fff' : b.on ? '#6f6' : '#3a3830'; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    const sz = [16, 21, 26][grade];
    drawIcon(GEMS[id].icon, b.x + (b.w - sz) / 2, b.y + (b.h - sz) / 2, sz, sz);
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#000'; ctx.fillText(n, b.x + b.w - 2, b.y + b.h - 2); ctx.fillStyle = '#fff'; ctx.fillText(n, b.x + b.w - 3, b.y + b.h - 3);
  }
  const hb = tradeButtons().find(b => b.gem && mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h);
  if (hb) {
    const { id, grade, n } = hb.gem, L2 = gemTooltip(gemInfo(id, grade));
    L2.push({ t: grade >= 2 ? '가장 높은 등급' : n >= 3 ? `클릭: 3개 → ${gemName(id, grade + 1)} (${GEM_UP_GOLD[grade]}G)` : `${3 - n}개 더 있으면 합성 (${GEM_UP_GOLD[grade]}G)`, c: hb.on ? '#7f7' : '#a99', b: true });
    drawTooltip(L2, mouse.x + 18, mouse.y + 18);
  }
}

// ===== 분해·재련 (개조실): 분해하면 부품, 재련은 옵션 하나를 다시 굴림 =====
// 아이템 종류별: 옵션 목록, 옵션 하나 굴리기, 이름·수치 다시 계산, 능력치 옵션 최대 수
const ITEM_KIND = {
  weapon: { pool: it => weaponPool(it.id), roll: (it, k) => rollWeaponAffix(it.id, it.rarity, k), refresh: refreshWeapon, stats: 0 },
  shell:  { pool: it => ['pow', 'cd', 'stat', ...SKILLS[it.id].mods], roll: (it, k, o) => rollShellAffix(it.id, it.rarity, k, o), refresh: refreshShell, stats: 2 },
  armor:  { pool: it => armorPool(it.id), roll: (it, k, o) => rollArmorAffix(it.id, it.rarity, k, o), refresh: refreshArmor, stats: 1 },
};
const kindOf = it => ITEM_KIND[it.kind || 'weapon'];
const ownedItems = () => [...player.equip, ...player.bag, ...player.shells, ...GEAR_KEYS.map(g => player.gear[g])].filter(Boolean);
const isEquipped = it => player.equip.includes(it) || player.shells.includes(it) || GEAR_KEYS.some(g => player.gear[g] === it);
const salvageValue = it => SALVAGE[it.rarity] + 2 * (it.plus || 0);
const canReforge = it => it.rarity >= 1 && it.rarity <= 3 && it.affixes.length > 0; // 일반(옵션 없음)·고유 전설(정해진 옵션)은 못 함
const reforgeCost = it => ({ parts: REFORGE.parts[it.rarity], gold: REFORGE.gold[it.rarity] });
function salvage(it) {
  if (!it || isEquipped(it) || !player.bag.includes(it)) return;
  const n = salvageValue(it), gems = it.gems || [];
  removeFromBag(it); player.parts += n; trade.sel = null;
  for (const g of gems) pouchAdd(makeGem(g.id, g.grade), true); // 끼운 보석은 주머니로
  trade.note = `${it.name} 분해 — 부품 +${n}${gems.length ? ` · 보석 ${gems.length}개는 주머니로` : ''}`; Snd.play('crate');
}
function salvageCommons() {
  const list = player.bag.filter(o => o.rarity === 0 && o.kind !== 'gem' && !o.rw); // 보석 조합 장비는 남김
  let n = 0;
  for (const it of list) { removeFromBag(it); n += salvageValue(it); for (const g of it.gems || []) pouchAdd(makeGem(g.id, g.grade), true); }
  player.parts += n; if (list.includes(trade.sel)) trade.sel = null;
  trade.note = `일반 등급 ${list.length}개 분해 — 부품 +${n}`; Snd.play('crate');
}
// 재련: 고른 옵션 하나를 새로 굴림 (같은 옵션의 새 수치일 수도, 다른 옵션일 수도 — 다른 옵션과는 겹치지 않게)
function reforge(it, n) {
  const p = player, c = reforgeCost(it), K = kindOf(it), others = it.affixes.filter((_, m) => m !== n);
  if (!canReforge(it) || !it.affixes[n] || p.parts < c.parts || p.gold < c.gold) return;
  const pool = [...new Set(K.pool(it))].filter(k => k === 'stat' ? others.filter(a => a.k === 'stat').length < K.stats : !others.some(a => a.k === k));
  const old = it.affixes[n];
  it.affixes[n] = K.roll(it, pick(pool), others);
  K.refresh(it);
  if (it.kind === 'armor' && isEquipped(it)) gearChanged();
  if (!it.kind && it.mag > it.s.mag) it.mag = it.s.mag; // 장탄수 옵션이 빠진 무기
  p.parts -= c.parts; p.gold -= c.gold;
  const txt = a => (it.kind === 'shell' ? SHELL_AFFIXES : it.kind === 'armor' ? ARMOR_AFFIXES : AFFIXES)[a.k].text(a.v, a.type);
  trade.note = `재련: ${txt(old)} → ${txt(it.affixes[n])}`; Snd.play('buy');
}
// 개조실 '분해 · 재련' 탭: 고른 장비, 분해 버튼, 옵션마다 재련 버튼 (버튼은 tradeButtons)
const FORGE_ROW = 30;
function drawForgeArea(g) {
  const p = player, it = trade.sel && ownedItems().includes(trade.sel) ? trade.sel : (trade.sel = null);
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText('분해 · 재련', g.gx, g.gy + 14);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd27a'; ctx.fillText(`부품 ${p.parts}`, g.gx + VG_W * CELL, g.gy + 14);
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a9484';
  wrapPx('필요 없는 장비는 분해해 부품으로. 부품과 골드로 옵션 하나를 다시 굴린다 (고급~전설 장비, 장착 중이어도 됨)', VG_W * CELL).forEach((l, n) => ctx.fillText(l, g.gx, g.gy + 32 + n * 14));
  const by = g.gy + 66;
  ctx.fillStyle = '#0b0a08'; ctx.fillRect(g.gx, by, 140, 70); ctx.strokeStyle = '#4a463c'; ctx.strokeRect(g.gx + 0.5, by + 0.5, 139, 69);
  if (!it) { ctx.textAlign = 'center'; ctx.fillStyle = '#6a6458'; ctx.fillText('인벤토리에서 장비를 클릭', g.gx + 70, by + 39); return; }
  const [sw, sh] = it.s.size, k = Math.min(132 / (sw * CELL), 62 / (sh * CELL));
  drawItemBox(it, g.gx + 70 - sw * CELL * k / 2, by + 35 - sh * CELL * k / 2, sw * CELL * k, sh * CELL * k);
  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = RARITY[it.rarity].color; ctx.fillText(fitText(it.name, 200), g.gx + 150, by + 14);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a9484';
  ctx.fillText(`${RARITY[it.rarity].name} ${it.kind === 'shell' ? '스킬 쉘' : it.kind === 'armor' ? '방어구' : '무기'}${isEquipped(it) ? ' · 장착 중' : ''}`, g.gx + 150, by + 30);
  if (!canReforge(it)) { ctx.fillStyle = '#6a6458'; ctx.fillText(it.uq ? '고유 전설은 옵션이 정해져 있어 재련할 수 없음' : '옵션이 없는 일반 등급 — 분해만 가능', g.gx + 150, by + 46); }
  const T = it.kind === 'shell' ? SHELL_AFFIXES : it.kind === 'armor' ? ARMOR_AFFIXES : AFFIXES;
  it.affixes.forEach((a, n) => {
    const y = by + 92 + n * FORGE_ROW;
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(g.gx, y - 4, VG_W * CELL, FORGE_ROW - 4);
    ctx.font = '12px sans-serif'; ctx.fillStyle = a.k === 'stat' ? ATTRS[a.type].color : a.k === 'elem' ? ELEMS[a.type].color : '#8af';
    ctx.fillText(fitText(T[a.k].text(a.v, a.type), VG_W * CELL - 130), g.gx + 8, y + 13);
  });
}

// ===== 감시자의 불기둥: 보이는 플레이어 발밑에 예고(붉은 원) → wind초 뒤 솟음 =====
let pillars = []; // { x, y, t, max, r, dmg, burn }
function watcherThink(e, dt, d, dx, dy, see) {
  const P = e.d.pillar;
  e.castT = Math.max(0, (e.castT || 0) - dt);
  if (!e.aggro) return;
  e.face = Math.atan2(dy, dx);
  e.castCd = (e.castCd ?? rnd(0.8, 1.8)) - dt;
  if (!see || d > P.range || e.castCd > 0) return;
  e.castCd = P.rate * rnd(0.85, 1.15) * (e.atkMul || 1); e.castT = e.castMax = P.wind + 0.15;
  pillars.push({ x: player.x, y: player.y, t: P.wind, max: P.wind, r: P.r, dmg: P.dmg * (1 + 0.1 * (e.lv - 1)) * (e.elite ? ELITE.dmg : 1), burn: P.burn, owner: e });
  Snd.mon(e, 'attack'); tip('watcher');
}
function updatePillars(dt) {
  for (const q of pillars) {
    q.t -= dt;
    if (q.t > 0) continue;
    q.dead = true;
    addFx('fire', 'abcdefgh', q.x, q.y, 0, 0.7, 1.4); fireBurst(q.x, q.y, 30, 3); smoke(q.x, q.y, 8, '80,60,40', 1.2);
    flashes.push({ x: q.x, y: q.y, r: 360, t: 0.3, max: 0.3, col: '255,120,40' }); shake = Math.max(shake, 5); Snd.play('pillar', q.x, q.y);
    const p = player;
    if (Math.hypot(p.x - q.x, p.y - q.y) < q.r + p.r && hurtPlayer(q.dmg, q.x, q.y)) afflict('burn', q.burn);
    for (const s of survivors) if (s.state === 'follow' && Math.hypot(s.x - q.x, s.y - q.y) < q.r + s.r) hurtSurvivor(s, q.dmg, q.x, q.y);
  }
  pillars = pillars.filter(q => !q.dead);
}
// 불기둥 예고: 안쪽이 차오르는 붉은 원 (테두리 없음, 조명 위에 그려 어둠 속에서도 보임)
function drawPillars() {
  for (const q of pillars) {
    const k = 1 - q.t / q.max;
    ctx.fillStyle = `rgba(255,70,30,${0.12 + 0.3 * k})`; isoEllipse(q.x, q.y, q.r * (0.3 + 0.7 * k)); ctx.fill();
  }
}

// ===== 아이템 =====
function heal(p, n) { if (p.hp >= p.maxhp) return false; p.hp = Math.min(p.maxhp, p.hp + n); return true; }
const MED_HEAL = { medS: 40, medM: 90, medL: 200 };
const medHeal = k => MED_HEAL[k] * (1 + perkV('medic')); // 응급 처치 특성 반영
const ITEM_FX = {
  medS: p => heal(p, medHeal('medS')), medM: p => heal(p, medHeal('medM')), medL: p => heal(p, medHeal('medL')),
  nano: p => { p.fx.regen += 140; return true; },
  antidote: p => { p.fx.poison = 0; p.fx.burn = 0; p.fx.immP = 8; return true; },
  insul: p => { p.fx.shock = 0; p.fx.immS = 10; return true; },
  armor: p => { if (p.armor >= 100) return false; p.armor = Math.min(100, p.armor + 50); return true; },
  adren: p => { p.fx.adren = 12; return true; },
};
function useItem(id) {
  const p = player;
  if (!p.items[id]) { msg(`${ITEMS[id].name} 없음`, '#a99'); return; }
  if (!ITEM_FX[id](p)) { msg(MED_ORDER.includes(id) ? '체력이 가득 찼습니다' : '지금은 사용할 필요가 없습니다', '#a99'); return; }
  p.items[id]--; Snd.play('heal'); msg(`${ITEMS[id].name} 사용`, ITEMS[id].color);
  for (let k = 0; k < 14; k++) parts.push({ x: p.x + rnd(-.3, .3), y: p.y + rnd(-.3, .3), z: rnd(0, 20), vx: 0, vy: 0, vz: rnd(30, 70), g: 0, life: rnd(0.4, 0.8), max: 0.8, col: ITEMS[id].color, size: 3, glow: true });
}

// ===== 캐릭터 성장 창 [K] (실시간): 왼쪽 능력치 4개 + 계열 3개 x 특성 4개 카드, 클릭하면 1점씩 투자 =====
let perkOpen = false;
function perkGeom() {
  const aw = 236, gap = 10, ch = 80, cw = clamp(Math.floor((W - 24 - aw - 5 * gap) / 3), 170, 236);
  const pw = aw + 3 * cw + 5 * gap, ph = 76 + 4 * (ch + gap) + 44;
  return { x: Math.max(4, Math.round((W - pw) / 2)), y: Math.max(8, Math.round((VH - ph) / 2)), pw, ph, cw, ch, gap, aw };
}
const attrCard = (g, n) => ({ x: g.x + g.gap, y: g.y + 76 + n * (g.ch + g.gap) });
const perkCard = (g, t, n) => ({ x: g.x + 2 * g.gap + g.aw + t * (g.cw + g.gap), y: g.y + 76 + n * (g.ch + g.gap) });
const respecBtn = g => ({ x: g.x + g.pw - 216, y: g.y + g.ph - 36, w: 204, h: 26 });
function perkHit(mx, my) {
  const g = perkGeom();
  if (mx < g.x || mx > g.x + g.pw || my < g.y || my > g.y + g.ph) return null;
  for (let n = 0; n < ATTR_KEYS.length; n++) { const c = attrCard(g, n); if (mx >= c.x && mx <= c.x + g.aw && my >= c.y && my <= c.y + g.ch) return { attr: ATTR_KEYS[n] }; }
  for (let t = 0; t < PERK_ORDER.length; t++) for (let n = 0; n < PERK_ORDER[t].length; n++) {
    const c = perkCard(g, t, n);
    if (mx >= c.x && mx <= c.x + g.cw && my >= c.y && my <= c.y + g.ch) return { k: PERK_ORDER[t][n] };
  }
  const b = respecBtn(g);
  if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return { respec: true };
  return { panel: true };
}
// 창 위를 클릭했으면 true (창 밖 클릭은 그대로 공격)
function perkMouseDown(button) {
  const h = perkHit(mouse.x, mouse.y), p = player;
  if (!h) return false;
  if (button !== 0) return true;
  if (h.attr) { // 능력치: 클릭 1점, Shift+클릭 5점
    const A = ATTRS[h.attr], n = Math.min(p.apts, keys.ShiftLeft || keys.ShiftRight ? 5 : 1);
    if (n <= 0) { msg(`능력치 점수가 없습니다 — 레벨이 오를 때마다 ${ATTR_PER_LEVEL}점`, '#a99'); Snd.play('deny'); }
    else { p.attr[h.attr] += n; p.apts -= n; Snd.play('buy'); msg(`${A.name} +${n} → ${attrV(h.attr)}`, A.color); }
  } else if (h.k) {
    const P = PERKS[h.k], r = p.perks[h.k] || 0;
    if (r >= P.max) { msg(`${P.name}: 이미 최고 단계입니다`, '#a99'); Snd.play('deny'); }
    else if (p.pts <= 0) { msg('특성 점수가 없습니다 — 적을 처치해 레벨을 올리세요', '#a99'); Snd.play('deny'); }
    else { p.perks[h.k] = r + 1; p.pts--; applyUpgrades(p); Snd.play('buy'); msg(`${P.name} ${r + 1}단계 — ${P.fmt(P.per * (r + 1))}`, '#ffe08a'); }
  } else if (h.respec) {
    const cost = RESPEC_COST * p.clv, spent = Object.values(p.perks).reduce((a, b) => a + b, 0), spentA = Object.values(p.attr).reduce((a, b) => a + b, 0);
    if (!spent && !spentA) msg('초기화할 특성·능력치가 없습니다', '#a99');
    else if (p.gold < cost) { msg(`골드가 부족합니다 (${cost}G)`, '#f99'); Snd.play('deny'); }
    else {
      p.gold -= cost; p.pts += spent; p.apts += spentA; p.perks = {}; for (const k of ATTR_KEYS) p.attr[k] = 0;
      applyUpgrades(p); Snd.play('menu'); msg(`초기화 — 특성 ${spent}점 · 능력치 ${spentA}점을 돌려받았습니다`, '#9cf');
    }
  }
  return true;
}
function drawPerks() {
  const g = perkGeom(), p = player, h = perkHit(mouse.x, mouse.y);
  ctx.fillStyle = 'rgba(18,16,12,0.95)'; rr(g.x, g.y, g.pw, g.ph, 8); ctx.fill();
  ctx.strokeStyle = '#8c8574'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  ctx.textAlign = 'left'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ff8a5a'; ctx.fillText('캐릭터 성장', g.x + 14, g.y + 24);
  ctx.textAlign = 'right'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#887'; ctx.fillText('[K] 닫기 · 게임은 계속 진행', g.x + g.pw - 14, g.y + 24);
  // 레벨·경험치 막대·남은 점수
  const need = xpNeed(p.clv), bx = g.x + 120, bw = g.pw - 330;
  ctx.textAlign = 'left'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#ffe08a'; ctx.fillText(`Lv ${p.clv}`, g.x + 14, g.y + 50);
  ctx.fillStyle = '#1a1712'; ctx.fillRect(bx - 50, g.y + 40, bw, 12);
  ctx.fillStyle = '#c9a03a'; ctx.fillRect(bx - 50, g.y + 40, bw * p.xp / need, 12);
  ctx.strokeStyle = '#5a5040'; ctx.strokeRect(bx - 49.5, g.y + 40.5, bw - 1, 11);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#eee'; ctx.textAlign = 'center'; ctx.fillText(`경험치 ${p.xp} / ${need}`, bx - 50 + bw / 2, g.y + 50);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = p.pts > 0 || p.apts > 0 ? (Math.sin(gtime * 6) > 0 ? '#fff2a0' : '#ffd060') : '#887'; ctx.fillText(`남은 점수 — 특성 ${p.pts} · 능력치 ${p.apts}`, g.x + g.pw - 14, g.y + 50);
  // 능력치 (왼쪽): 값 = 투자 + 장착한 쉘 옵션, 아래에 장착한 스킬에 주는 효과
  const a0 = attrCard(g, 0);
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText('능력치 — 스킬마다 키우는 수치가 다름', a0.x + 2, a0.y - 6);
  ATTR_KEYS.forEach((k, n) => {
    const A = ATTRS[k], c = attrCard(g, n), hover = h && h.attr === k, gear = gearAttr(k), v = attrV(k), fx = attrEffects(k);
    ctx.fillStyle = v ? '#1b1a22' : '#121410'; ctx.fillRect(c.x, c.y, g.aw, g.ch);
    ctx.strokeStyle = hover ? '#ffd27a' : p.apts > 0 ? A.color : '#3a3a30'; ctx.lineWidth = hover ? 2 : 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, g.aw - 1, g.ch - 1); ctx.lineWidth = 1;
    ctx.fillStyle = '#0a0b08'; ctx.fillRect(c.x + 8, c.y + 12, 56, 56);
    ctx.textAlign = 'center'; ctx.font = 'bold 24px monospace'; ctx.fillStyle = v ? A.color : '#5a5648'; ctx.fillText(v, c.x + 36, c.y + 47);
    if (gear) { ctx.font = '10px sans-serif'; ctx.fillStyle = '#8af'; ctx.fillText(`장비 +${gear}`, c.x + 36, c.y + 63); }
    ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = A.color; ctx.fillText(A.name, c.x + 74, c.y + 22);
    if (p.apts > 0) { ctx.textAlign = 'right'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = hover ? '#fff2a0' : '#ffd27a'; ctx.fillText('+ 투자', c.x + g.aw - 10, c.y + 22); ctx.textAlign = 'left'; }
    ctx.font = '11px sans-serif';
    if (fx.length) wrapPx(fx.join(' · '), g.aw - 82).slice(0, 3).forEach((l, m) => { ctx.fillStyle = '#dfffd0'; ctx.fillText(fitText(l, g.aw - 82), c.x + 74, c.y + 40 + m * 14); });
    else {
      const uses = Object.keys(SKILLS).filter(id => Object.values(SKILLS[id].st).some(s => s[0] === k)).map(id => SKILLS[id].name);
      ctx.fillStyle = '#6a6658'; ctx.fillText(fitText(`장착한 스킬 중 ${A.name} 스킬 없음`, g.aw - 82), c.x + 74, c.y + 42);
      wrapPx(uses.join('·'), g.aw - 82).slice(0, 2).forEach((l, m) => ctx.fillText(fitText(l, g.aw - 82), c.x + 74, c.y + 58 + m * 13));
    }
  });
  // 계열 이름 + 카드
  PERK_ORDER.forEach((keys, t) => {
    const c0 = perkCard(g, t, 0);
    ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText(PERK_TREES[t], c0.x + 2, c0.y - 6);
    keys.forEach((k, n) => {
      const P = PERKS[k], r = p.perks[k] || 0, c = perkCard(g, t, n), hover = h && h.k === k, maxed = r >= P.max;
      ctx.fillStyle = r ? '#1c2216' : '#121410'; ctx.fillRect(c.x, c.y, g.cw, g.ch);
      ctx.strokeStyle = hover ? '#ffd27a' : maxed ? '#7c7' : r ? '#a8904a' : '#3a3a30'; ctx.lineWidth = hover ? 2 : 1;
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, g.cw - 1, g.ch - 1); ctx.lineWidth = 1;
      ctx.fillStyle = '#0a0b08'; ctx.fillRect(c.x + 8, c.y + 12, 56, 56);
      ctx.globalAlpha = r ? 1 : 0.45; drawIcon(P.icon, c.x + 12, c.y + 16, 48, 48); ctx.globalAlpha = 1;
      ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = r ? '#ffe9b0' : '#aaa59a'; ctx.fillText(fitText(P.name, g.cw - 82 - P.max * 11), c.x + 74, c.y + 22);
      for (let s = 0; s < P.max; s++) { ctx.fillStyle = s < r ? '#ffc850' : '#2e2a22'; ctx.fillRect(c.x + g.cw - 12 - (P.max - s) * 11, c.y + 13, 8, 8); } // 단계 칸
      ctx.font = '11px sans-serif';
      ctx.fillStyle = r ? '#dfffd0' : '#6a6658'; ctx.fillText(fitText(r ? P.fmt(P.per * r) : '아직 배우지 않음', g.cw - 82), c.x + 74, c.y + 44);
      ctx.fillStyle = maxed ? '#7c7' : '#8fc4ff'; ctx.fillText(fitText(maxed ? '최고 단계' : `다음: ${P.fmt(P.per * (r + 1))}`, g.cw - 82), c.x + 74, c.y + 62);
    });
  });
  // 초기화 버튼 + 안내
  const b = respecBtn(g), cost = RESPEC_COST * p.clv, hoverB = h && h.respec;
  ctx.fillStyle = hoverB ? '#3a352c' : '#2a2620'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = hoverB ? '#ffd27a' : '#8c8574'; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.textAlign = 'center'; ctx.font = '12px sans-serif'; ctx.fillStyle = p.gold >= cost ? '#e8dcc0' : '#a77'; ctx.fillText(`특성·능력치 초기화 (${cost}G)`, b.x + b.w / 2, b.y + 17);
  ctx.textAlign = 'left'; ctx.fillStyle = '#887'; ctx.fillText(fitText(`카드를 클릭해 1점씩 투자 (능력치는 Shift+클릭으로 5점) · 레벨마다 특성 1점 · 능력치 ${ATTR_PER_LEVEL}점`, g.pw - 250), g.x + 14, b.y + 17);
}

// ===== 수집 도감 [J] (실시간): 처치한 몬스터·보스·고유 정예, 찾은 고유 전설 (무기·쉘), 만든 보석 조합 =====
// 이 브라우저의 모든 저장에서 함께 쌓임 (localStorage) — 못 찾은 것은 검은 그림자로
const CODEX_KEY = 'voidstation.codex.v1';
let codex = { mon: {}, sup: {}, uq: {}, suq: {}, rw: {}, set: {}, logs: {}, ach: {}, stat: {} }, codexDirty = false, codexSaveT = 0, codexOpen = false, codexTab = 'mon';
try { const c = JSON.parse(localStorage.getItem(CODEX_KEY)); if (c) for (const k in codex) Object.assign(codex[k], c[k] || {}); } catch (e) { /* 저장소를 못 쓰면 이번 실행에서만 */ }
function codexSave() { codexDirty = false; try { localStorage.setItem(CODEX_KEY, JSON.stringify(codex)); } catch (e) { /* 이번 실행에서만 */ } }
function codexTick(dt) {
  if ((achT -= dt) <= 0) { achT = 1; achCheck(); } // 업적: 1초마다 확인
  if (codexDirty && (codexSaveT -= dt) <= 0) { codexSaveT = 3; codexSave(); } // 몇 초마다 한 번만 저장
}
const codexStat = (k, v) => { if ((codex.stat[k] || 0) < v) { codex.stat[k] = v; codexDirty = true; } }; // 기록 수치 (가장 큰 값)
// --- 업적 (ACHIEVEMENTS): 수집 도감·기록 수치로 진행 계산, 이루면 영구 보너스 (achSum → gearV·gearDef) ---
let achT = 1;
const nKeys = o => Object.keys(o).length;
function achProgress(A) {
  const s = A.stat, C = codex;
  if (s === 'kills') return Object.values(C.mon).reduce((a, b) => a + b, 0);
  if (s === 'species') return Object.keys(C.mon).filter(k => ENEMIES[k] && !ENEMIES[k].boss).length;
  if (s === 'bosses') return BOSS_ORDER.filter(k => C.mon[k]).length;
  if (s === 'supers') return nKeys(C.sup);
  if (s === 'uniques') return nKeys(C.uq) + nKeys(C.suq);
  if (s === 'sets') return nKeys(C.set);
  if (s === 'runewords') return nKeys(C.rw);
  if (s === 'logs') return nKeys(C.logs);
  return C.stat[{ setfull: 'setFull', rescued: 'rescued', level: 'lv', rift: 'rift', win: 'win' }[s]] || 0;
}
function achCheck() {
  for (const A of ACHIEVEMENTS) {
    if (codex.ach[A.id] || achProgress(A) < A.goal) continue;
    codex.ach[A.id] = 1; codexDirty = true;
    if (state !== 'play') continue; // 제목 화면 등: 조용히
    msg(`🏆 업적 달성: ${A.name} — ${Object.entries(A.bonus).map(([k, v]) => SET_FX[k](v)).join(' · ')} (영구)`, '#ffe08a'); Snd.play('levelUp'); tip('ach');
    flashes.push({ x: player.x, y: player.y, r: 360, t: 0.4, max: 0.4, col: '255,220,120' });
    gearChanged(); // 최대 체력 등
  }
}
function achSum(k) { let v = 0; for (const A of ACHIEVEMENTS) if (codex.ach[A.id] && A.bonus[k]) v += A.bonus[k]; return v; }
addEventListener('pagehide', () => { if (codexDirty) codexSave(); });
const codexNew = name => { msg(`수집 도감에 기록: ${name}`, '#e8d8a0'); if (Object.keys(codex.mon).length >= 3) tip('codex'); };
function codexKill(e) { // 몬스터는 처치 수, 고유 정예는 이름으로
  const first = !codex.mon[e.type];
  codex.mon[e.type] = (codex.mon[e.type] || 0) + 1; codexDirty = true;
  if (first) codexNew(e.d.name);
  if (e.super && !codex.sup[e.super.name]) { codex.sup[e.super.name] = 1; codexNew(e.super.name); }
}
function codexItem(it, quiet = false) { // 고유 전설 (무기: 키, 쉘: 스킬), 보석 조합, 세트 장비 — 찾은 적이 있는지만
  if (!it || it.kind === 'gem') return;
  const add = (kind, key, name) => { if (codex[kind][key]) return; codex[kind][key] = 1; codexDirty = true; if (!quiet) codexNew(name); };
  if (it.uq) add(it.kind === 'shell' ? 'suq' : 'uq', it.kind === 'shell' ? it.id : it.uq, it.name);
  if (it.rw) add('rw', it.rw, RUNEWORDS[it.rw].name);
  if (it.set && SET_ITEMS[it.set]) add('set', it.set, it.name);
}
// 업적 보너스도 방어구 효과처럼 (gearV·gearDef에서 더함)
const CODEX_TABS = [['mon', '몬스터'], ['boss', '보스·정예'], ['uq', '고유 전설'], ['set', '세트 장비'], ['rw', '보석 조합'], ['log', '데이터 기록'], ['ach', '업적']];
const BOSS_ORDER = ['crusher', 'broodmother', 'titan', 'argus', 'plaguegiant', 'hivemother', 'voidpriest', 'executioner', 'overmind'];
function bossRegion(k) { for (const n in REGION_BOSSES) if (REGION_BOSSES[n] === k) return +n; return { titan: 3, hivemother: 6, overmind: 9 }[k] || 0; }
const frontKey = (spr, fr) => { const f = META.sprites[spr] && META.sprites[spr][fr]; return f ? f[0][0] : null; }; // 정면 그림
// 탭의 카드: { known, name, icon, gems, sub, col, tip }
function codexCards(tab) {
  if (tab === 'mon') return Object.keys(ENEMIES).filter(k => !ENEMIES[k].boss).sort((a, b) => (ENEMIES[a].from || 99) - (ENEMIES[b].from || 99)).map(monCard);
  if (tab === 'boss') return [...BOSS_ORDER.map(monCard), ...SUPERS.map(supCard)];
  if (tab === 'uq') return [...Object.keys(UNIQUES).map(uqCard), ...Object.keys(SHELL_UNIQUES).map(suqCard)];
  if (tab === 'set') return Object.keys(SET_ITEMS).map(setCard);
  if (tab === 'log') return LOGS.map(logCard);
  if (tab === 'ach') return ACHIEVEMENTS.map(achCard);
  return Object.keys(RUNEWORDS).map(rwCard);
}
function monCard(k) {
  const d = ENEMIES[k], A = ENEMY_ART[k], n = codex.mon[k] || 0, lv = d.boss ? bossRegion(k) : d.from, col = d.boss ? '#ff8a5a' : '#e8dcc0';
  const L = [{ t: n ? d.name : '???', c: n ? col : '#888', b: true }, { t: n ? `처치 ${n}` : '아직 처치하지 못함', c: n ? '#cfe8c8' : '#a99' }];
  if (lv) L.push({ t: d.boss ? `구역 ${lv}의 보스` : `구역 ${lv}부터`, c: '#9a9' });
  if (n) {
    for (const t of wrapWords(MONSTER_DESC[k] || '', 30)) L.push({ t, c: '#d8c89a' });
    L.push({ t: `체력 ${d.hp} · 피해 ${d.dmg}${d.fly ? ' · 날아다님' : ''}${d.armor ? ` · 장갑 ${d.armor}` : ''}${d.shield ? ' · 정면 방패' : ''} (구역이 깊을수록 강해짐)`, c: '#9cf' });
  }
  return { known: n > 0, name: n ? d.name : '???', icon: frontKey(A.spr, A.walk[0]), sub: n ? `처치 ${n}` : lv ? `구역 ${lv}` : '', col, tip: L };
}
function supCard(S, i) {
  const A = ENEMY_ART[S.base], n = codex.sup[S.name] || 0;
  const L = [{ t: n ? S.name : '???', c: n ? '#ff9a3a' : '#888', b: true }, { t: `구역 ${i + 1}의 고유 정예 — ${n ? '처치함' : '아직 처치하지 못함'}`, c: n ? '#cfe8c8' : '#a99' }];
  if (n) {
    L.push({ t: `바탕: ${ENEMIES[S.base].name} · 특성: ${S.affixes.map(k => ELITE_AFFIXES[k].name).join(', ')}`, c: '#d8c89a' });
    L.push({ t: `부하: ${S.minions.map(([t, m]) => `${ENEMIES[t].name} ${m}`).join(', ')} · 처치하면 금고 열쇠`, c: '#9a9' });
  }
  return { known: n > 0, name: n ? S.name : '???', icon: frontKey(A.spr, A.walk[0]), sub: `구역 ${i + 1}`, col: '#ff9a3a', tip: L };
}
function uqCard(k) {
  const U = UNIQUES[k], n = codex.uq[k];
  const L = [{ t: n ? `★ ${U.name}` : '???', c: n ? RARITY[4].color : '#888', b: true }, { t: `고유 전설 무기 · 바탕: ${WEAPONS[U.base].name}`, c: '#9a9' }];
  if (n) { for (const [m, t] of wrapWords(U.effect, 30).entries()) L.push({ t: (m ? '   ' : '◆ ') + t, c: '#ffcf70' }); L.push({ t: `"${U.flavor}"`, c: '#d0604a' }); }
  else L.push({ t: '아직 찾지 못함 — 보스·정예·금고에서 드물게', c: '#a99' });
  return { known: !!n, name: n ? U.name : '???', icon: 'icon_' + U.base, sub: WEAPONS[U.base].name, col: RARITY[4].color, tip: L };
}
function suqCard(k) {
  const U = SHELL_UNIQUES[k], n = codex.suq[k];
  const L = [{ t: n ? `★ ${U.name}` : '???', c: n ? RARITY[4].color : '#888', b: true }, { t: `고유 전설 쉘 · ${SKILLS[k].name}`, c: '#9a9' }];
  if (n) { for (const [m, t] of wrapWords(U.effect, 30).entries()) L.push({ t: (m ? '   ' : '◆ ') + t, c: '#ffcf70' }); if (U.flavor) L.push({ t: `"${U.flavor}"`, c: '#d0604a' }); }
  else L.push({ t: '아직 찾지 못함 — 보스·고유 정예·금고에서', c: '#a99' });
  return { known: !!n, name: n ? U.name : '???', icon: SKILLS[k].icon, sub: SKILLS[k].name, col: RARITY[4].color, tip: L };
}
function setCard(k) {
  const S = SET_ITEMS[k], T = SETS[S.set], n = codex.set[k], A = ARMORS[S.base], col = SET_COLOR;
  const L = [{ t: n ? `◆ ${S.name}` : '???', c: n ? col : '#888', b: true }, { t: `세트 장비 · ${T.name} · 바탕: ${(A || WEAPONS[S.base]).name}`, c: '#9a9' }];
  if (n) {
    for (const a of S.affixes) L.push({ t: (A ? ARMOR_AFFIXES : AFFIXES)[a.k].text(a.v, a.type), c: '#8af' });
    L.push({ t: `${T.name}: ${setPieces(S.set).map(q => codex.set[q] ? SET_ITEMS[q].name : '???').join(', ')}`, c: '#bff5b0' });
    for (const [t, B] of Object.entries(T.bonus)) L.push({ t: `(${t}) ${Object.entries(B).map(([q, v]) => SET_FX[q](v)).join(' · ')}`, c: col });
    L.push({ t: `"${T.flavor}"`, c: '#d0604a' });
  } else L.push({ t: `아직 찾지 못함 — 보스·고유 정예·금고·도박에서 (구역 ${Math.max(1, setBaseLvl(k) - 1)}부터)`, c: '#a99' });
  return { known: !!n, name: n ? S.name : '???', icon: A ? A.icon : 'icon_' + S.base, sub: T.name, col, tip: L };
}
function logCard(L, i) {
  const n = codex.logs[i], T = [{ t: n ? L.title : '???', c: n ? '#7fe0ff' : '#888', b: true }, { t: `데이터 기록 · 구역 ${L.reg} ${CAMPAIGN[L.reg - 1].name}`, c: '#9a9' }];
  if (n) { T.push({ t: L.who, c: '#8fb0b8' }); for (const t of wrapWords(`"${L.text}"`, 32)) T.push({ t, c: '#e0f0f0' }); }
  else T.push({ t: `아직 듣지 못함 — 구역 ${L.reg} 어딘가의 휴대 단말기`, c: '#a99' });
  return { known: !!n, name: n ? L.title : '???', icon: i % 2 ? 'pmapb0' : 'pmapa0', sub: n ? L.who : `구역 ${L.reg}`, col: '#7fe0ff', tip: T };
}
function achCard(A) {
  const done = !!codex.ach[A.id], v = Math.min(A.goal, achProgress(A)), bonus = Object.entries(A.bonus).map(([k, q]) => SET_FX[k](q)).join(' · ');
  const T = [{ t: `🏆 ${A.name}`, c: done ? '#ffe08a' : '#aaa', b: true }, { t: A.desc, c: '#e8dcc0' }, { t: `보너스 (영구): ${bonus}`, c: done ? '#9f9' : '#8a9a88' }, { t: done ? '달성!' : `진행 ${v} / ${A.goal}`, c: done ? '#ffe08a' : '#9cf' }];
  return { known: done, name: A.name, icon: A.icon, sub: done ? '달성' : `${v} / ${A.goal}`, col: '#ffe08a', tip: T, frac: v / A.goal };
}
function rwCard(k) {
  const R = RUNEWORDS[k], n = codex.rw[k];
  const L = [{ t: R.name, c: RW_COLOR, b: true }, { t: `보석 조합 · ${RW_TYPE[R.type]} · ${n ? '만든 적 있음' : '아직 만들지 않음'}`, c: n ? '#cfe8c8' : '#a99' },
    { t: `순서: ${R.gems.map(id => GEMS[id].name).join(' → ')}`, c: '#eee' }];
  for (const [s, v] of Object.entries(R.stats)) L.push({ t: '◆ ' + RW_FX[s](v), c: RW_COLOR });
  L.push({ t: `"${R.flavor}"`, c: '#d0604a' });
  return { known: !!n, name: R.name, gems: R.gems, sub: RW_TYPE[R.type], col: RW_COLOR, tip: L };
}
function codexGeom() {
  const pw = Math.min(W - 24, 880), ph = Math.min(VH - 16, 600), cw = 96, ch = 108, gap = 8;
  return { x: Math.round((W - pw) / 2), y: Math.max(8, Math.round((VH - ph) / 2)), pw, ph, cw, ch, gap, cols: Math.max(1, Math.floor((pw - 24 + gap) / (cw + gap))) };
}
const codexCard = (g, n) => ({ x: g.x + 12 + (n % g.cols) * (g.cw + g.gap), y: g.y + 82 + Math.floor(n / g.cols) * (g.ch + g.gap) });
const codexTabW = g => Math.floor((g.pw - 24 + 8) / CODEX_TABS.length) - 8; // 탭 폭 (탭 수에 맞춰)
const codexTabX = (g, k) => g.x + 12 + k * (codexTabW(g) + 8);
function codexHit(mx, my) {
  const g = codexGeom();
  if (mx < g.x || mx > g.x + g.pw || my < g.y || my > g.y + g.ph) return null;
  for (let k = 0; k < CODEX_TABS.length; k++) if (mx >= codexTabX(g, k) && mx < codexTabX(g, k) + codexTabW(g) && my >= g.y + 40 && my < g.y + 68) return { tab: CODEX_TABS[k][0] };
  const n = codexCards(codexTab).length;
  for (let i = 0; i < n; i++) { const c = codexCard(g, i); if (mx >= c.x && mx < c.x + g.cw && my >= c.y && my < c.y + g.ch) return { card: i }; }
  return { panel: true };
}
// 창 위를 클릭했으면 true (창 밖 클릭은 그대로 공격)
function codexMouseDown(button) {
  const h = codexHit(mouse.x, mouse.y);
  if (!h) return false;
  if (button === 0 && h.tab && h.tab !== codexTab) { codexTab = h.tab; Snd.play('menu'); }
  return true;
}
function drawCodex() {
  const g = codexGeom(), h = codexHit(mouse.x, mouse.y), cards = codexCards(codexTab);
  ctx.fillStyle = 'rgba(18,16,12,0.985)'; rr(g.x, g.y, g.pw, g.ph, 8); ctx.fill();
  ctx.strokeStyle = '#8c8574'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
  ctx.textAlign = 'left'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ff8a5a'; ctx.fillText('수집 도감', g.x + 14, g.y + 25);
  ctx.textAlign = 'right'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#887'; ctx.fillText('[J] 닫기 · 게임은 계속 진행 · 이 브라우저의 모든 저장에서 함께 쌓임', g.x + g.pw - 14, g.y + 25);
  CODEX_TABS.forEach(([id, label], k) => { // 탭 (찾은 수 / 전체)
    const all = codexCards(id), got = all.filter(c => c.known).length, x = codexTabX(g, k), tw = codexTabW(g), on = codexTab === id, hov = h && h.tab === id;
    ctx.fillStyle = on ? '#2a3a26' : '#1a1814'; rr(x, g.y + 40, tw, 28, 4); ctx.fill();
    ctx.strokeStyle = on ? '#8f8' : hov ? '#cfe8c8' : '#4a463c'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = on ? '#dfffd0' : '#9a9484';
    ctx.fillText(fitText(`${label}  ${got}/${all.length}`, tw - 8), x + tw / 2, g.y + 58);
  });
  cards.forEach((c, n) => {
    const q = codexCard(g, n), hov = h && h.card === n;
    ctx.fillStyle = c.known ? '#17150f' : '#0c0b09'; ctx.fillRect(q.x, q.y, g.cw, g.ch);
    ctx.strokeStyle = hov ? '#ffd27a' : c.known ? c.col : '#2e2b24'; ctx.lineWidth = hov ? 2 : 1; ctx.strokeRect(q.x + 0.5, q.y + 0.5, g.cw - 1, g.ch - 1); ctx.lineWidth = 1;
    if (c.gems) { // 보석 조합: 순서대로 보석 (아직 안 만들었으면 흐리게)
      ctx.globalAlpha = c.known ? 1 : 0.35;
      c.gems.forEach((id, j) => drawIcon(GEMS[id].icon, q.x + g.cw / 2 - c.gems.length * 13 + j * 26, q.y + 26, 24, 24));
      ctx.globalAlpha = 1;
    } else if (c.icon) { // 못 찾은 것은 검은 그림자 (업적은 흐린 회색)
      const ach = c.frac !== undefined;
      if (!c.known) { ctx.filter = ach ? 'grayscale(1) brightness(0.55)' : 'brightness(0)'; ctx.globalAlpha = ach ? 0.8 : 0.75; }
      drawIcon(c.icon, q.x + 8, q.y + 6, g.cw - 16, g.ch - 42);
      ctx.filter = 'none'; ctx.globalAlpha = 1;
      if (!c.known && !ach) { ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = '#4a463c'; ctx.fillText('?', q.x + g.cw / 2, q.y + 44); }
    }
    ctx.textAlign = 'center'; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = c.known ? c.col : '#5a5648'; ctx.fillText(fitText(c.name, g.cw - 8), q.x + g.cw / 2, q.y + g.ch - 22);
    ctx.font = '10px sans-serif'; ctx.fillStyle = c.known ? '#9a9484' : '#4a463c'; ctx.fillText(fitText(c.sub || '', g.cw - 8), q.x + g.cw / 2, q.y + g.ch - 8);
    if (c.frac !== undefined && !c.known) { ctx.fillStyle = '#2a2720'; ctx.fillRect(q.x + 8, q.y + g.ch - 36, g.cw - 16, 4); ctx.fillStyle = '#c9a03a'; ctx.fillRect(q.x + 8, q.y + g.ch - 36, (g.cw - 16) * clamp(c.frac, 0, 1), 4); } // 업적 진행
  });
  if (codexTab === 'ach') { // 지금 받는 업적 보너스 합계
    const keys = [...new Set(ACHIEVEMENTS.flatMap(A => Object.keys(A.bonus)))].filter(k => achSum(k) > 0);
    ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffe08a';
    ctx.fillText(fitText(keys.length ? `업적 보너스 (모든 저장): ${keys.map(k => SET_FX[k](achSum(k))).join(' · ')}` : '업적 보너스: 아직 없음 — 업적을 이루면 모든 저장에 작은 영구 보너스', g.pw - 28), g.x + 14, g.y + g.ph - 14);
  }
  if (h && h.card !== undefined && cards[h.card]) drawTooltip(cards[h.card].tip, mouse.x + 18, mouse.y + 18, VH);
}

// ===== 인벤토리 창 (실시간, 화면 오른쪽) =====
const CELL = 34;
let invOpen = false, held = null; // held: 커서로 들고 있는 무기 { inst, from, ogx, ogy, sx, sy }
function invGeom() {
  const pw = BAG_W * CELL + 24, x = W - pw - 12, y = 12;
  const slotW = (pw - 24 - (NSLOT - 1) * 6) / NSLOT, slotH = 58, slotY = y + 34;
  const arW = (pw - 24 - 2 * 6) / 3, arH = 44, arY = slotY + slotH + 8; // 방어구 칸 3개 (머리·몸·다리)
  const skW = (pw - 24 - 3 * 6) / 4, skH = 40, skY = arY + arH + 8;     // 스킬 칸 4개 (Z X V B)
  const gx = x + 12, gy = skY + skH + 26; // 스킬 칸과 가방 사이: 계열 공명 한 줄 (오른쪽 끝에 정렬 단추)
  const py = gy + bagH() * CELL + 24;     // 가방 아래: 보석 주머니 (이름 한 줄 + 2줄 x 9칸)
  return { x, y, pw, ph: py - y + 2 * CELL + 46, slotW, slotH, slotY, arW, arH, arY, skW, skH, skY, gx, gy, py };
}
// 보석 주머니 칸 n (0~17): 보석 종류마다 등급 3칸씩 (조각난·보통·완벽한), 한 줄에 세 종류 (종류 사이는 조금 띄움)
function pouchCell(g, n) {
  const t = Math.floor(n / 3), grade = n % 3;
  return { id: GEM_KEYS[t], grade, x: g.gx + ((t % 3) * 3 + grade) * CELL + (t % 3) * 8, y: g.py + Math.floor(t / 3) * CELL };
}
const sortBtn = g => ({ x: g.gx + BAG_W * CELL - 46, y: g.gy - 21, w: 46, h: 17 }); // 가방 정렬 단추
const arSlotX = (g, n) => g.x + 12 + n * (g.arW + 6);
const slotX = (g, c) => g.x + 12 + c * (g.slotW + 6);
const skSlotX = (g, k) => g.x + 12 + k * (g.skW + 6);
function invHit(mx, my) {
  const g = invGeom();
  if (mx < g.x || mx > g.x + g.pw || my < g.y || my > g.y + g.ph) return null;
  for (let c = 0; c < NSLOT; c++) if (mx >= slotX(g, c) && mx <= slotX(g, c) + g.slotW && my >= g.slotY && my <= g.slotY + g.slotH) return { area: 'slot', c };
  for (let k = 0; k < 4; k++) if (mx >= skSlotX(g, k) && mx <= skSlotX(g, k) + g.skW && my >= g.skY && my <= g.skY + g.skH) return { area: 'skill', k };
  for (let n = 0; n < GEAR_KEYS.length; n++) if (mx >= arSlotX(g, n) && mx <= arSlotX(g, n) + g.arW && my >= g.arY && my <= g.arY + g.arH) return { area: 'gear', g: GEAR_KEYS[n] };
  if (mx >= g.gx && mx < g.gx + BAG_W * CELL && my >= g.gy && my < g.gy + bagH() * CELL)
    return { area: 'grid', cx: Math.floor((mx - g.gx) / CELL), cy: Math.floor((my - g.gy) / CELL) };
  const sb = sortBtn(g);
  if (mx >= sb.x && mx < sb.x + sb.w && my >= sb.y && my < sb.y + sb.h) return { area: 'sort' };
  for (let n = 0; n < 18; n++) { const c = pouchCell(g, n); if (mx >= c.x && mx < c.x + CELL - 2 && my >= c.y && my < c.y + CELL - 2) return { area: 'pouch', id: c.id, grade: c.grade }; }
  return { area: 'panel' };
}
// 들고 있는 무기를 놓을 격자 위치 (커서 중심, 격자 안으로 보정)
function heldTarget(inst) {
  const g = invGeom(), [w, h] = inst.s.size;
  return { gx: clamp(Math.round((mouse.x - g.gx) / CELL - w / 2), 0, BAG_W - w), gy: clamp(Math.round((mouse.y - g.gy) / CELL - h / 2), 0, bagH() - h) };
}
function holdItem(inst, from, extra = {}) { held = { inst, from, sx: mouse.x, sy: mouse.y, ...extra }; }
// 들고 있는 무기 놓기: 창 밖이면 바닥에 버림, 슬롯이면 장착, 격자면 배치 (한 개와 겹치면 서로 교체)
function placeHeld() {
  const p = player, inst = held.inst, hit = invHit(mouse.x, mouse.y), th = trade && tradeHit(mouse.x, mouse.y);
  if (th && trade.mode === 'stash') { if (th.area === 'grid') placeInStash(); return; } // 창고 격자에 놓으면 보관
  if (th && trade.mode !== 'upgrade') { held = null; sellWeapon(inst); return; } // 거래 창에 놓으면 판매
  if (inst.kind === 'gem' && hit) { // 보석: 무기·방어구 위에 놓으면 빈 소켓에 끼움
    const target = hit.area === 'grid' ? bagItemAt(hit.cx, hit.cy) : hit.area === 'slot' ? p.equip[hit.c] : hit.area === 'gear' ? p.gear[hit.g] : null;
    if (target && canSocket(target)) {
      if (socketGem(target, inst)) { held = null; return; }
      msg(target.sockets ? '빈 소켓이 없습니다' : '소켓이 없는 장비입니다 — 개조 자판기에서 뚫을 수 있습니다', '#f99'); Snd.play('deny'); return;
    }
    if (hit.area === 'slot' || hit.area === 'gear' || hit.area === 'skill') { msg('보석은 소켓이 있는 무기·방어구 위에 놓으세요', '#f99'); return; }
    held = null; pouchAdd(inst, true); Snd.play('pickup'); return; // 창 안의 다른 자리: 주머니로 되돌림
  }
  if (!hit) {
    if (inBase) { stowHeld(); msg('기지에서는 버릴 수 없습니다 — 회수 단말기에서 판매하세요', '#a99'); return; }
    held = null; dropWeapon(p.x, p.y, inst); pickups[pickups.length - 1].wait = true; msg(`${inst.name} 버림`, '#a99'); return; // 버린 보석은 한 번 멀어졌다 와야 다시 저절로 주움
  }
  if (hit.area === 'slot') {
    if (inst.kind === 'shell') { msg('스킬 쉘은 아래의 스킬 칸(Z X V B)에 끼웁니다', '#f99'); return; }
    if (inst.kind === 'armor') { msg('방어구는 아래의 방어구 칸(머리·몸·다리)에 끼웁니다', '#f99'); return; }
    if (hit.c >= slotsOpen()) { msg(`${hit.c + 1}번 무기 슬롯은 잠겨 있습니다 — 무기고를 해제하면 열린다`, '#f99'); tip('armory'); return; }
    const old = p.equip[hit.c];
    p.equip[hit.c] = inst; held = null;
    if (old) holdItem(old, 'equip');
    if (hit.c === p.slot) onActiveWeaponChanged();
    Snd.play('pickup');
  } else if (hit.area === 'gear') { // 방어구 칸: 그 부위 방어구만 (끼어 있던 것은 커서로)
    if (inst.kind !== 'armor' || inst.s.slot !== hit.g) { msg(`${ARMOR_SLOTS[hit.g]} 칸에는 ${ARMOR_SLOTS[hit.g]} 방어구만 끼울 수 있습니다`, '#f99'); return; }
    const old = p.gear[hit.g];
    p.gear[hit.g] = inst; held = null; gearChanged();
    if (old) holdItem(old, 'gear');
    Snd.play('pickup');
  } else if (hit.area === 'skill') { // 스킬 칸: 쉘만, 같은 스킬은 한 칸에만 (끼어 있던 쉘은 커서로)
    if (inst.kind !== 'shell') { msg('스킬 칸에는 스킬 쉘만 끼울 수 있습니다', '#f99'); return; }
    const j = shellSlotOf(inst.id);
    if (j >= 0 && j !== hit.k) { msg(`${SKILLS[inst.id].name}은(는) 이미 [${SHELL_SLOTS[j]}] 칸에 있습니다 — 같은 스킬은 한 칸에만`, '#f99'); return; }
    const old = p.shells[hit.k];
    p.shells[hit.k] = inst; held = null;
    if (old) holdItem(old, 'skill', { ok: hit.k });
    Snd.play('pickup');
  } else if (hit.area === 'grid') {
    const t = heldTarget(inst), ov = bagOverlaps(inst, t.gx, t.gy);
    if (ov.length > 1) return;
    held = null;
    if (ov.length) { removeFromBag(ov[0]); holdItem(ov[0], 'bag', { ogx: ov[0].gx, ogy: ov[0].gy }); }
    inst.gx = t.gx; inst.gy = t.gy; p.bag.push(inst);
    Snd.play('pickup');
  }
}
// 창을 닫을 때 들고 있던 무기 정리: 원래 자리 → 빈 슬롯/빈 자리 → 바닥
function stowHeld() {
  if (!held) return;
  const h = held; held = null;
  if (h.from === 'bag' && inBag(h.inst, h.ogx, h.ogy) && !bagOverlaps(h.inst, h.ogx, h.ogy).length) { h.inst.gx = h.ogx; h.inst.gy = h.ogy; player.bag.push(h.inst); return; }
  if (h.from === 'stash' && !gridOverlaps(stash, h.inst, h.ogx, h.ogy).length) { h.inst.gx = h.ogx; h.inst.gy = h.ogy; stash.push(h.inst); return; } // 창고에서 꺼낸 것은 창고 제자리로
  if (h.from === 'skill' && !player.shells[h.ok] && shellSlotOf(h.inst.id) < 0) { player.shells[h.ok] = h.inst; return; } // 스킬 칸에서 뺀 쉘은 그 칸으로
  if (h.from === 'gear' && !player.gear[h.inst.s.slot]) { player.gear[h.inst.s.slot] = h.inst; gearChanged(); return; } // 방어구 칸에서 뺀 것은 그 칸으로
  if (!addWeapon(h.inst)) { dropWeapon(player.x, player.y, h.inst); msg(`가방이 가득 차 ${h.inst.name}을(를) 바닥에 내려놓았습니다`, '#f99'); }
}
function closeInventory() { stowHeld(); invOpen = false; }
// 인벤토리가 클릭을 처리했으면 true (그 클릭으로는 사격하지 않음)
function invMouseDown(button) {
  const p = player, hit = invHit(mouse.x, mouse.y);
  if (held) { if (button === 0) placeHeld(); return true; }
  if (!hit) return false;
  if (hit.area === 'sort') { if (button === 0) sortBag(); return true; }
  if (hit.area === 'pouch') { const g = button === 0 && pouchTake(hit.id, hit.grade); if (g) { holdItem(g, 'pouch'); Snd.play('pickup'); } return true; } // 주머니에서 하나 집기
  if (hit.area === 'grid') {
    const inst = bagItemAt(hit.cx, hit.cy);
    if (inst && button === 0) { removeFromBag(inst); holdItem(inst, 'bag', { ogx: inst.gx, ogy: inst.gy }); }
    else if (inst && button === 2) { if (inst.kind === 'shell') equipShellFromBag(inst); else if (inst.kind === 'armor') equipArmorFromBag(inst); else equipFromBag(inst); }
  } else if (hit.area === 'slot' && p.equip[hit.c]) {
    if (button === 0) { const inst = p.equip[hit.c]; p.equip[hit.c] = null; if (hit.c === p.slot) onActiveWeaponChanged(); holdItem(inst, 'equip'); }
    else if (button === 2) unequipToBag(hit.c);
  } else if (hit.area === 'gear' && p.gear[hit.g]) {
    if (button === 0) { const inst = p.gear[hit.g]; p.gear[hit.g] = null; gearChanged(); holdItem(inst, 'gear'); }
    else if (button === 2) unequipArmor(hit.g);
  } else if (hit.area === 'skill' && p.shells[hit.k]) {
    if (button === 0) { const sh = p.shells[hit.k]; p.shells[hit.k] = null; holdItem(sh, 'skill', { ok: hit.k }); }
    else if (button === 2) unequipShell(hit.k);
  }
  return true;
}
// 끌어서 놓기: 누른 채 움직였다가 떼면 그 자리에 놓음 (그냥 클릭이면 커서에 들고 있다가 다음 클릭에 놓음)
function invMouseUp() {
  if (held && Math.hypot(mouse.x - held.sx, mouse.y - held.sy) > 6) placeHeld();
}

// ===== 거래 창: 디아블로식 상점·판매·개조 (왼쪽 거래 창 + 오른쪽 인벤토리) =====
// 무기 진열대는 기지에 돌아올 때마다 새로 채워지고, 판매한 무기는 '되사기' 칸에 남는다
let trade = null;                 // { mode: 'shop' | 'sell' | 'upgrade' | 'stash', tab, note, sel(강화할 무기) }
let stock = [], buyback = [], shellStock = [], armorStock = []; // 무기 진열대, 되사기, 스킬 쉘·방어구 진열대
let stash = [];                   // 기지 창고에 보관한 무기 (진열대와 같은 격자, 저장 슬롯에 함께 저장)
const VG_W = 10, VG_H = 8;        // 진열대·창고 격자
const GOODS = [...Object.keys(ITEMS).map(id => ['item', id]), ...Object.keys(AMMO).map(id => ['ammo', id]), ...Object.keys(GRENADES).map(id => ['gren', id])];
const UP_ICON = { hp: 'media0', stamina: 'icon_syringe_blue', bag: 'bpaka0', load: 'arm1a0', ammo: 'ammoa0' };
const goodInfo = (k, id) => k === 'item' ? ITEMS[id] : k === 'ammo' ? AMMO[id] : GRENADES[id];
const goodIcon = (k, id) => k === 'item' ? ITEM_ART[id][0] : k === 'ammo' ? AMMO_ART[id][0] : 'icon_gren_' + id;
const goodCount = (k, id) => (k === 'item' ? player.items : k === 'ammo' ? player.ammo : player.gren)[id];
const buyPrice = w => Math.round(weaponValue(w));
const healCost = () => 60 + level * 20;

function rollStock() {
  const ids = Object.keys(WEAPONS).filter(k => WEAPONS[k].minLvl <= level + 1);
  const ws = Array.from({ length: 14 }, () => makeWeapon(pick(ids), Math.random() < 0.12 ? 2 : Math.random() < 0.4 ? 1 : 0))
    .sort((a, b) => b.s.size[0] * b.s.size[1] - a.s.size[0] * a.s.size[1]);
  stock = []; buyback = [];
  for (const w of ws) {
    const spot = gridFindSpot(stock, w, VG_W, VG_H);
    if (spot) { w.gx = spot.gx; w.gy = spot.gy; stock.push(w); }
  }
  const aids = Object.keys(ARMORS).filter(k => ARMORS[k].minLvl <= level + 1); // 방어구 진열대
  armorStock = [];
  for (const a of Array.from({ length: ARMOR_STOCK }, () => makeArmor(pick(aids), Math.random() < 0.12 ? 2 : Math.random() < 0.4 ? 1 : 0))) {
    const spot = gridFindSpot(armorStock, a, VG_W, VG_H);
    if (spot) { a.gx = spot.gx; a.gy = spot.gy; armorStock.push(a); }
  }
  const sids = Object.keys(SKILLS).filter(k => SKILLS[k].from <= level + 1).sort(() => Math.random() - 0.5); // 스킬 쉘: 서로 다른 스킬로, 진열대에 2칸 간격
  shellStock = Array.from({ length: SHELL_STOCK }, (_, n) => {
    const sh = makeShell(sids[n % sids.length], Math.random() < 0.1 ? 2 : Math.random() < 0.4 ? 1 : 0);
    sh.gx = (n % 5) * 2; sh.gy = Math.floor(n / 5) * 2;
    return sh;
  });
}
function openTrade(mode) {
  trade = { mode, tab: { shop: 'weapons', sell: 'sell', upgrade: 'upgrade', stash: 'stash' }[mode], note: '', sel: null }; perkOpen = false;
  invOpen = true; state = 'trade'; mouse.down = false;
  Snd.play('menu');
}
function closeTrade() { stowHeld(); trade = null; invOpen = false; state = 'play'; mouse.down = false; Snd.play('menu'); }

function tradeGeom() {
  const x = 12, y = 12, pw = VG_W * CELL + 24, tabY = y + 38, gx = x + 12, gy = tabY + 32;
  return { x, y, pw, ph: gy - y + VG_H * CELL + 52, tabY, gx, gy, footY: gy + VG_H * CELL + 8 };
}
const TRADE_TABS = { shop: [['weapons', '무기'], ['armor', '방어구'], ['shells', '스킬 쉘'], ['goods', '소모품'], ['gamble', '도박']], sell: [['sell', '판매 · 되사기']], upgrade: [['upgrade', '개조·강화'], ['forge', '분해·재련'], ['socket', '소켓·보석'], ['rune', '보석 조합']], stash: [['stash', '보관함']] };
const tabW = n => Math.min(154, Math.floor((VG_W * CELL - (n - 1) * 6) / n)); // 탭 너비 (탭이 많으면 좁게)
function tradeButtons() {
  const g = tradeGeom(), p = player, B = [{ id: 'close', x: g.x + g.pw - 96, y: g.footY + 12, w: 84, h: 26, label: '닫기 (Esc)', on: true }];
  if (trade.mode === 'shop') B.push({ id: 'heal', x: g.gx, y: g.footY + 12, w: 170, h: 26, label: `체력 완전 회복 ${healCost()}G`, on: p.hp < p.maxhp && p.gold >= healCost() });
  if (trade.mode === 'upgrade' && trade.tab === 'socket') { // 소켓 · 보석: 소켓 뚫기·보석 빼기, 보석 합성 칸
    const it = trade.sel && ownedItems().includes(trade.sel) && canSocket(trade.sel) ? trade.sel : null, L = sockLayout(g);
    if (it) {
      const c = socketCost(it), full = (it.sockets || 0) >= socketMax(it), n = (it.gems || []).length;
      B.push({ id: 'sock', x: g.gx + 150, y: L.by + 38, w: 96, h: 22, label: it.rw ? '보석 조합됨' : full ? '소켓 최대' : `뚫기 ${c.parts}부품·${c.gold}G`, on: !it.rw && !full && p.parts >= c.parts && p.gold >= c.gold });
      B.push({ id: 'unsock', x: g.gx + 250, y: L.by + 38, w: 90, h: 22, label: n ? `빼기 ${UNSOCKET_GOLD * n}G` : '빼기', on: n > 0 && p.gold >= UNSOCKET_GOLD * n });
    }
    pouchStacks().slice(0, 20).forEach((st, k) => B.push({ id: `gu:${st.id}:${st.grade}`, x: g.gx + (k % 10) * CELL, y: L.gemY + Math.floor(k / 10) * CELL, w: CELL - 2, h: CELL - 2, label: '', gem: st,
      on: st.grade < 2 && st.n >= 3 && p.gold >= GEM_UP_GOLD[st.grade] }));
  } else if (trade.mode === 'upgrade' && trade.tab === 'rune') { // 보석 조합: 무기 / 방어구 쪽
    const pg = trade.rwPage || 'weapon';
    B.push({ id: 'rwp:weapon', x: g.gx, y: g.gy + 36, w: 70, h: 20, label: '무기', on: true, sel: pg === 'weapon' });
    B.push({ id: 'rwp:armor', x: g.gx + 76, y: g.gy + 36, w: 70, h: 20, label: '방어구', on: true, sel: pg === 'armor' });
  } else if (trade.mode === 'upgrade' && trade.tab === 'forge') { // 분해·재련: 고른 장비의 분해 버튼, 옵션마다 재련 버튼, 일반 등급 일괄 분해
    const it = trade.sel && ownedItems().includes(trade.sel) ? trade.sel : null;
    if (it) {
      const eq = isEquipped(it), c = reforgeCost(it), ok = canReforge(it);
      B.push({ id: 'salv', x: g.gx + 150, y: g.gy + 66 + 44, w: 150, h: 24, label: eq ? '장착 중 — 분해 불가' : `분해 → 부품 +${salvageValue(it)}`, on: !eq });
      it.affixes.forEach((a, n) => B.push({ id: 'rf:' + n, x: g.gx + VG_W * CELL - 122, y: g.gy + 66 + 92 + n * FORGE_ROW - 3, w: 120, h: 22, label: ok ? `재련 ${c.parts}부품·${c.gold}G` : '재련 불가', on: ok && p.parts >= c.parts && p.gold >= c.gold }));
    }
    const commons = p.bag.filter(o => o.rarity === 0 && o.kind !== 'gem' && !o.rw).length;
    B.push({ id: 'salvAll', x: g.gx, y: g.footY + 12, w: 220, h: 26, label: `가방의 일반 등급 모두 분해 (${commons}개)`, on: commons > 0 });
  } else if (trade.mode === 'upgrade') {
    Object.entries(UPGRADES).forEach(([k, u], n) => {
      const lv = p.up[k], cost = u.cost * (lv + 1);
      B.push({ id: 'up:' + k, x: g.gx + VG_W * CELL - 86, y: g.gy + 23 + n * 34, w: 86, h: 26, label: lv >= u.max ? '최대' : `${cost}G`, on: lv < u.max && p.gold >= cost });
    });
    const w = trade.sel;
    if (w && w.kind !== 'shell') { // 스킬 쉘은 강화하지 않음
      const done = w.plus >= ENHANCE_MAX;
      B.push({ id: 'enh', x: g.gx + 150, y: g.gy + 245, w: 130, h: 24, label: done ? '최대 강화' : `강화 ${enhanceCost(w)}G`, on: !done && p.gold >= enhanceCost(w) });
    }
  }
  return B;
}
// 현재 탭의 진열 항목: 격자 위치(gx, gy, w, h)와 가격
function tradeEntries() {
  const p = player;
  if (trade.tab === 'stash') return stash.map(w => ({ kind: 'stash', inst: w, gx: w.gx, gy: w.gy, w: w.s.size[0], h: w.s.size[1] }));
  if (trade.tab === 'weapons') return stock.map(w => ({ kind: 'buyW', inst: w, gx: w.gx, gy: w.gy, w: w.s.size[0], h: w.s.size[1], price: buyPrice(w) }));
  if (trade.tab === 'shells') return shellStock.map(sh => ({ kind: 'buyS', inst: sh, gx: sh.gx, gy: sh.gy, w: 2, h: 2, price: buyPrice(sh) })); // 쉘은 크게 보이게 2x2칸
  if (trade.tab === 'armor') return armorStock.map(a => ({ kind: 'buyA', inst: a, gx: a.gx, gy: a.gy, w: a.s.size[0], h: a.s.size[1], price: buyPrice(a) }));
  if (trade.tab === 'goods') return GOODS.map(([k, id], n) => ({ kind: 'buyG', k, id, gx: (n % 5) * 2, gy: Math.floor(n / 5) * 2, w: 2, h: 2, price: goodInfo(k, id).price }));
  if (trade.tab === 'gamble') return GAMBLE_CATS.map((c, n) => ({ kind: 'gamble', c, gx: (n % 5) * 2, gy: Math.floor(n / 5) * 2, w: 2, h: 2, price: gamblePrice(c) })); // 값 0: 아직 안 나오는 종류
  if (trade.tab === 'sell') {
    const own = GOODS.filter(([k, id]) => k !== 'ammo' && goodCount(k, id) > 0);
    return [
      ...buyback.map(w => ({ kind: 'back', inst: w, gx: w.gx, gy: w.gy, w: w.s.size[0], h: w.s.size[1], price: sellPrice(w) })),
      ...own.map(([k, id], n) => ({ kind: 'sellG', k, id, gx: n % VG_W, gy: 6 + Math.floor(n / VG_W), w: 1, h: 1, price: Math.round(goodInfo(k, id).price * SELL_RATE) })),
    ];
  }
  return [];
}
function tradeHit(mx, my) {
  const g = tradeGeom();
  if (!trade || mx < g.x || mx > g.x + g.pw || my < g.y || my > g.y + g.ph) return null;
  const tabs = TRADE_TABS[trade.mode], tw = tabW(tabs.length);
  for (let k = 0; k < tabs.length; k++) {
    const tx = g.gx + k * (tw + 6);
    if (mx >= tx && mx < tx + tw && my >= g.tabY && my < g.tabY + 26) return { area: 'tab', tab: tabs[k][0] };
  }
  for (const b of tradeButtons()) if (mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h) return { area: 'btn', btn: b };
  if (trade.mode !== 'upgrade' && mx >= g.gx && mx < g.gx + VG_W * CELL && my >= g.gy && my < g.gy + VG_H * CELL)
    return { area: 'grid', cx: Math.floor((mx - g.gx) / CELL), cy: Math.floor((my - g.gy) / CELL) };
  return { area: 'panel' };
}
const entryAt = (cx, cy) => tradeEntries().find(o => cx >= o.gx && cx < o.gx + o.w && cy >= o.gy && cy < o.gy + o.h);

// 클릭: 인벤토리 무기는 우클릭 판매(개조실에서는 강화 대상으로 선택), 진열대 항목은 구매
function tradeMouseDown(button) {
  const vh = tradeHit(mouse.x, mouse.y);
  if (held) { if (button === 0) placeHeld(); return; }
  if (vh && vh.area === 'grid' && trade.mode === 'stash') { stashClick(vh, button); return; }
  if (vh) { vendorClick(vh); return; }
  const ih = invHit(mouse.x, mouse.y);
  if (!ih) return;
  if (ih.area === 'sort') { if (button === 0) sortBag(); return; }
  if (ih.area === 'pouch') { // 보석 주머니: 보급·회수 자판기에서 우클릭은 하나 판매, 그 밖에는 하나 집기
    if (button === 2 && (trade.mode === 'shop' || trade.mode === 'sell')) { const g = pouchTake(ih.id, ih.grade); if (g) sellWeapon(g); }
    else invMouseDown(button);
    return;
  }
  const inst = ih.area === 'grid' ? bagItemAt(ih.cx, ih.cy) : ih.area === 'slot' ? player.equip[ih.c] : ih.area === 'skill' ? player.shells[ih.k] : ih.area === 'gear' ? player.gear[ih.g] : null;
  if (trade.mode === 'upgrade' && inst && inst.kind === 'gem') { invMouseDown(button); return; } // 보석은 집어 들기 (장비 위에 놓아 끼움)
  if (trade.mode === 'upgrade') { if (inst) { trade.sel = inst; trade.note = ''; Snd.play('menu'); } return; } // 강화·분해·재련할 장비 고르기
  if (button === 2 && ih.area === 'grid' && inst) { if (trade.mode === 'stash') storeWeapon(inst); else { removeFromBag(inst); sellWeapon(inst); } return; }
  invMouseDown(button);
}
// --- 기지 창고 ---
// 창고 칸 클릭: 왼쪽은 집어 들기(끌어서 가방·장착 칸에), 오른쪽은 곧바로 가방으로
function stashClick(h, button) {
  const e = entryAt(h.cx, h.cy);
  if (!e) return;
  if (button === 2) {
    stash.splice(stash.indexOf(e.inst), 1);
    if (!addWeapon(e.inst)) { stash.push(e.inst); trade.note = '가방에 공간이 없습니다'; Snd.play('deny'); return; }
    trade.note = `${e.inst.name} 꺼냄`; Snd.play('pickup');
  } else if (button === 0) { stash.splice(stash.indexOf(e.inst), 1); holdItem(e.inst, 'stash', { ogx: e.inst.gx, ogy: e.inst.gy }); }
}
// 가방 무기 우클릭: 창고의 빈 자리에 보관
function storeWeapon(inst) {
  const spot = gridFindSpot(stash, inst, VG_W, VG_H);
  if (!spot) { trade.note = '창고에 자리가 없습니다'; Snd.play('deny'); return; }
  removeFromBag(inst); inst.gx = spot.gx; inst.gy = spot.gy; stash.push(inst);
  trade.note = `${inst.name} 보관`; Snd.play('pickup');
}
// 들고 있는 무기를 놓을 창고 격자 위치 (커서 중심)
function stashTarget(inst) {
  const g = tradeGeom(), [w, h] = inst.s.size;
  return { gx: clamp(Math.round((mouse.x - g.gx) / CELL - w / 2), 0, VG_W - w), gy: clamp(Math.round((mouse.y - g.gy) / CELL - h / 2), 0, VG_H - h) };
}
// 들고 있는 무기를 창고 격자에 놓기 (한 개와 겹치면 서로 교체, 둘 이상이면 못 놓음)
function placeInStash() {
  const inst = held.inst, t = stashTarget(inst), ov = gridOverlaps(stash, inst, t.gx, t.gy);
  if (ov.length > 1) { Snd.play('deny'); return; }
  held = null;
  if (ov.length) { stash.splice(stash.indexOf(ov[0]), 1); holdItem(ov[0], 'stash', { ogx: ov[0].gx, ogy: ov[0].gy }); }
  inst.gx = t.gx; inst.gy = t.gy; stash.push(inst);
  trade.note = `${inst.name} 보관`; Snd.play('pickup');
}
function vendorClick(h) {
  const p = player;
  if (h.area === 'tab') { trade.tab = h.tab; Snd.play('menu'); if (h.tab === 'gamble') tip('gamble'); return; }
  if (h.area === 'btn') { if (h.btn.on) pressTradeButton(h.btn.id); else Snd.play('deny'); return; }
  const e = h.area === 'grid' && entryAt(h.cx, h.cy);
  if (!e) return;
  if (e.kind === 'sellG') {
    (e.k === 'item' ? p.items : p.gren)[e.id]--; p.gold += e.price;
    trade.note = `${goodInfo(e.k, e.id).name} 판매 +${e.price}G`; Snd.play('gold');
    return;
  }
  if (p.gold < e.price) { trade.note = '골드가 부족합니다'; Snd.play('deny'); return; }
  if (e.kind === 'gamble') { gambleBuy(e); return; }
  if (e.kind === 'buyG') {
    if (e.k === 'ammo' && p.ammo[e.id] >= ammoMax(e.id)) { trade.note = `${AMMO[e.id].name}이(가) 가득 찼습니다`; Snd.play('deny'); return; }
    if (e.k === 'item') p.items[e.id]++; else if (e.k === 'ammo') addAmmo(e.id, AMMO[e.id].buy); else p.gren[e.id]++;
    trade.note = `${goodInfo(e.k, e.id).name} 구매`;
  } else {
    if (!addWeapon(e.inst)) { trade.note = '가방에 공간이 없습니다'; Snd.play('deny'); return; }
    const list = e.kind === 'buyW' ? stock : e.kind === 'buyS' ? shellStock : e.kind === 'buyA' ? armorStock : buyback;
    list.splice(list.indexOf(e.inst), 1);
    trade.note = `${e.inst.name} 구매`;
  }
  p.gold -= e.price; Snd.play('buy');
}
function pressTradeButton(id) {
  const p = player;
  if (id === 'close') closeTrade();
  else if (id === 'heal') { p.gold -= healCost(); p.hp = p.maxhp; trade.note = '체력을 모두 회복했습니다'; Snd.play('heal'); }
  else if (id === 'enh') enhance(trade.sel);
  else if (id === 'salv') salvage(trade.sel);
  else if (id === 'salvAll') salvageCommons();
  else if (id.startsWith('rf:')) reforge(trade.sel, +id.slice(3));
  else if (id === 'sock') drillSocket(trade.sel);
  else if (id === 'unsock') unsocketAll(trade.sel);
  else if (id.startsWith('gu:')) { const [, gid, gr] = id.split(':'); combineGems(gid, +gr); }
  else if (id.startsWith('rwp:')) { trade.rwPage = id.slice(4); Snd.play('menu'); }
  else buyUpgrade(id.slice(3));
}
// --- 도박 (GAMBLE, GAMBLE_CATS): 종류마다 이 구역에서 나오는 바탕 장비 중 무작위, 등급은 GAMBLE.odds (일반은 안 나옴) ---
function gambleBases(c) {
  return c.shell ? Object.keys(SKILLS).filter(k => SKILLS[k].from <= level + 1)
    : c.slot ? Object.keys(ARMORS).filter(k => ARMORS[k].slot === c.slot && ARMORS[k].minLvl <= level + 1)
    : Object.keys(WEAPONS).filter(k => WEAPONS[k].cat === c.cat && WEAPONS[k].minLvl <= level + 1);
}
const gambleBaseValue = (c, k) => c.shell ? SKILLS[k].price : (c.slot ? ARMORS[k].price : WEAPONS[k].price) || 120;
function gamblePrice(c) { // 그 종류 바탕 장비의 평균 값 x 배율 x 구역 (10G 단위), 아직 안 나오면 0
  const b = gambleBases(c);
  return b.length ? Math.round(b.reduce((t, k) => t + gambleBaseValue(c, k), 0) / b.length * GAMBLE.mul * (1 + GAMBLE.lvl * level) / 10) * 10 : 0;
}
// 처음 나오는 구역, 대표 그림 (나올 수 있는 것 중 가장 뒤의 것)
const gambleFrom = c => Math.max(1, Math.min(...(c.shell ? Object.values(SKILLS).map(s => s.from) : c.slot ? Object.values(ARMORS).filter(a => a.slot === c.slot).map(a => a.minLvl) : Object.values(WEAPONS).filter(w => w.cat === c.cat).map(w => w.minLvl))) - 1);
function gambleIcon(c) {
  const b = gambleBases(c), all = c.shell ? Object.keys(SKILLS) : c.slot ? Object.keys(ARMORS).filter(k => ARMORS[k].slot === c.slot) : Object.keys(WEAPONS).filter(k => WEAPONS[k].cat === c.cat), k = b.length ? b[b.length - 1] : all[0];
  return c.shell ? SKILLS[k].icon : c.slot ? ARMORS[k].icon : 'icon_' + k;
}
const gambleUniques = (c, b) => c.shell ? b.filter(k => SHELL_UNIQUES[k]) : c.slot ? [] : Object.keys(UNIQUES).filter(k => b.includes(UNIQUES[k].base));
const gambleSets = (c, b) => c.shell ? [] : Object.keys(SET_ITEMS).filter(k => b.includes(SET_ITEMS[k].base)); // 이 종류의 세트 장비 (바탕이 나오는 것만)
function gambleRoll(c) {
  const b = gambleBases(c), r = weighted(GAMBLE.odds), U = gambleUniques(c, b), S = gambleSets(c, b);
  if (r === 'uq' && U.length) return c.shell ? makeUniqueShell(pick(U)) : makeUnique(pick(U));
  if (r === 'set' && S.length) return makeSetItem(pick(S));
  const id = pick(b), rar = r === 'uq' || r === 'set' ? 3 : +r; // 고유 전설·세트가 없는 종류는 전설로
  return c.shell ? makeShell(id, rar) : c.slot ? makeArmor(id, rar) : makeWeapon(id, rar);
}
function gambleBuy(e) {
  const p = player;
  if (!e.price) { trade.note = `구역 ${gambleFrom(e.c)}부터 나오는 종류입니다`; Snd.play('deny'); return; }
  const it = gambleRoll(e.c);
  if (!addWeapon(it)) { trade.note = '가방에 공간이 없습니다'; Snd.play('deny'); return; }
  p.gold -= e.price;
  trade.note = `도박 — ${it.uq ? '★ ' : it.set ? '◆ ' : ''}${it.name} (${it.uq ? '고유 전설' : RARITY[it.rarity].name})`;
  msg(trade.note, itemColor(it)); Snd.play(it.rarity >= 3 ? 'unique' : 'buy');
}
function gambleTooltip(e) {
  const c = e.c, b = gambleBases(c), o = GAMBLE.odds, tot = o[1] + o[2] + o[3] + o.uq + o.set, uq = gambleUniques(c, b).length > 0, st = gambleSets(c, b).length > 0, pc = v => Math.round(v / tot * 100) + '%';
  const L = [{ t: `무작위 ${c.name}`, c: '#ffd27a', b: true }, { t: '정체를 모르는 장비 — 사면 바탕 장비와 등급이 정해진다', c: '#ccc' }];
  if (!b.length) { L.push({ t: `구역 ${gambleFrom(c)}부터 나온다`, c: '#a99' }); return L; }
  const names = b.map(k => c.shell ? SKILLS[k].name : c.slot ? ARMORS[k].name : WEAPONS[k].name);
  L.push({ t: `나올 수 있는 것: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` 외 ${names.length - 4}가지` : ''}`, c: '#9a9' });
  L.push({ t: `고급 ${pc(o[1])} · 희귀 ${pc(o[2])} · 전설 ${pc(o[3] + (uq ? 0 : o.uq) + (st ? 0 : o.set))}${uq ? ` · ★ 고유 전설 ${pc(o.uq)}` : ''}${st ? ` · ◆ 세트 ${pc(o.set)}` : ''}`, c: '#8af' });
  L.push({ t: `값 ${e.price}G`, c: player.gold >= e.price ? '#ffd27a' : '#f66', b: true });
  return L;
}
// 도박 칸: 그 종류의 대표 그림을 검게 (정체를 모름) + 물음표와 이름 (아직 안 나오는 종류는 흐리게)
function drawGambleCard(e, x, y, w, h) {
  const on = e.price > 0;
  ctx.fillStyle = on ? 'rgba(255,210,120,0.06)' : 'rgba(255,255,255,0.02)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = on ? '#8a7448' : '#3a3830'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.filter = 'brightness(0.3)'; ctx.globalAlpha = on ? 1 : 0.5; drawIcon(gambleIcon(e.c), x + 6, y + 16, w - 12, h - 30); ctx.filter = 'none'; ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = on ? '#ffd27a' : '#5a5448'; ctx.fillText('?', x + w / 2, y + h / 2 + 10);
  ctx.textAlign = 'left'; ctx.font = '10px sans-serif'; ctx.fillStyle = on ? '#e8dcc0' : '#6a6458'; ctx.fillText(fitText(e.c.name, w - 8), x + 4, y + 12);
  if (!on) { ctx.textAlign = 'center'; ctx.fillStyle = '#7a7466'; ctx.fillText(`구역 ${gambleFrom(e.c)}부터`, x + w / 2, y + h - 5); }
}
function sellWeapon(inst) {
  const price = sellPrice(inst);
  player.gold += price;
  let spot; // 되사기 칸: 자리가 없으면 오래된 것부터 치움
  while (!(spot = gridFindSpot(buyback, inst, VG_W, 6)) && buyback.length) buyback.shift();
  if (spot) { inst.gx = spot.gx; inst.gy = spot.gy; buyback.push(inst); }
  trade.note = `${inst.name} 판매 +${price}G`; Snd.play('gold');
}
function buyUpgrade(k) {
  const p = player, u = UPGRADES[k], lv = p.up[k], cost = u.cost * (lv + 1);
  if (lv >= u.max || p.gold < cost) return;
  p.gold -= cost; p.up[k]++;
  applyUpgrades(p);
  if (k === 'hp') p.hp = Math.min(p.maxhp, p.hp + 25);
  trade.note = `${u.name} ${p.up[k]}단계 완료`; Snd.play('buy');
}
function enhance(w) {
  const p = player;
  if (!w || w.plus >= ENHANCE_MAX || p.gold < enhanceCost(w)) return;
  p.gold -= enhanceCost(w); w.plus++;
  if (w.kind === 'armor') { refreshArmor(w); if (isEquipped(w)) gearChanged(); } else refreshWeapon(w);
  trade.note = `${w.name} 강화 성공`; Snd.play('buy');
}

function tradeButton(b) { // sel: 고른 쪽 (보석 조합의 무기 / 방어구)
  ctx.fillStyle = b.sel ? '#1c4a42' : b.on ? '#1d4a26' : '#2a2620'; rr(b.x, b.y, b.w, b.h, 4); ctx.fill();
  ctx.strokeStyle = b.sel ? RW_COLOR : b.on ? '#6f6' : '#5a5448'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = b.sel ? '#dffff6' : b.on ? '#cfe8c8' : '#7a7466';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + Math.min(17, b.h - 5));
}
function drawTrade() {
  const g = tradeGeom(), p = player, hit = tradeHit(mouse.x, mouse.y);
  const title = { shop: '보급 자판기', sell: '회수 자판기', upgrade: '개조 자판기', stash: '보관함 (창고)' }[trade.mode];
  ctx.fillStyle = 'rgba(18,16,12,0.95)'; rr(g.x, g.y, g.pw, g.ph, 8); ctx.fill();
  ctx.strokeStyle = '#8c8574'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ff8a5a'; ctx.fillText(title, g.gx, g.y + 25);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#ffd27a'; ctx.fillText(`${p.gold} G`, g.x + g.pw - 12, g.y + 25);
  // 탭
  TRADE_TABS[trade.mode].forEach(([id, label], k, tabs) => {
    const tw = tabW(tabs.length), tx = g.gx + k * (tw + 6), on = trade.tab === id;
    ctx.fillStyle = on ? '#2a3a26' : '#1a1814'; rr(tx, g.tabY, tw, 26, 4); ctx.fill();
    ctx.strokeStyle = on ? '#8f8' : '#4a463c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = on ? '#dfffd0' : '#9a9484'; ctx.fillText(label, tx + tw / 2, g.tabY + 17);
  });
  if (trade.mode === 'upgrade') { if (trade.tab === 'forge') drawForgeArea(g); else if (trade.tab === 'socket') drawSocketArea(g); else if (trade.tab === 'rune') drawRunewordArea(g); else drawUpgradeArea(g); }
  else {
    // 진열대 격자
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(g.gx, g.gy, VG_W * CELL, VG_H * CELL);
    ctx.strokeStyle = '#26231c'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= VG_W; i++) { ctx.moveTo(g.gx + i * CELL + 0.5, g.gy); ctx.lineTo(g.gx + i * CELL + 0.5, g.gy + VG_H * CELL); }
    for (let j = 0; j <= VG_H; j++) { ctx.moveTo(g.gx, g.gy + j * CELL + 0.5); ctx.lineTo(g.gx + VG_W * CELL, g.gy + j * CELL + 0.5); }
    ctx.stroke();
    if (trade.tab === 'sell') {
      ctx.fillStyle = 'rgba(255,210,120,0.05)'; ctx.fillRect(g.gx, g.gy + 6 * CELL, VG_W * CELL, 2 * CELL);
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#6a6458';
      if (!buyback.length) ctx.fillText('판매한 무기가 여기 놓입니다 (같은 값에 되살 수 있음)', g.gx + 6, g.gy + 16);
      ctx.fillText('소모품 판매 (클릭: 1개)', g.gx + 6, g.gy + 6 * CELL - 4);
    }
    if (trade.tab === 'stash' && !stash.length) {
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#6a6458';
      ctx.fillText('가방의 무기를 끌어다 놓거나 우클릭하면 여기에 보관됩니다 (저장하면 함께 저장)', g.gx + 6, g.gy + 16);
    }
    for (const e of tradeEntries()) {
      const x = g.gx + e.gx * CELL, y = g.gy + e.gy * CELL, w = e.w * CELL, h = e.h * CELL;
      if (e.inst) drawItemBox(e.inst, x, y, w, h);
      else if (e.kind === 'gamble') drawGambleCard(e, x, y, w, h);
      else {
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.strokeStyle = '#4a463c'; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
        drawIcon(goodIcon(e.k, e.id), x + 5, y + (e.h > 1 ? 14 : 4), w - 10, h - (e.h > 1 ? 30 : 10));
        if (e.h > 1) { // 이름 (같은 그림의 메디킷 구분용)
          const info = goodInfo(e.k, e.id);
          ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = info.color || '#c9a040';
          ctx.fillText(fitText(info.short || info.name, w - 8), x + 4, y + 12);
        }
      }
      ctx.font = '10px monospace'; ctx.textAlign = 'right';
      if (e.kind === 'sellG') { ctx.fillStyle = '#dfffd0'; ctx.fillText(goodCount(e.k, e.id), x + w - 3, y + h - 3); }
      else if (e.price) { // 가격표 (살 수 없으면 빨간색, 창고·아직 안 나오는 도박 종류는 없음)
        const tag = `${e.price}G`, tw = ctx.measureText(tag).width + 6;
        ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x + w - tw - 2, y + h - 14, tw, 12);
        ctx.fillStyle = p.gold >= e.price ? '#ffd27a' : '#f66'; ctx.fillText(tag, x + w - 5, y + h - 4);
      }
    }
    const e = hit && hit.area === 'grid' && entryAt(hit.cx, hit.cy);
    if (e && !held) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(g.gx + e.gx * CELL + 1.5, g.gy + e.gy * CELL + 1.5, e.w * CELL - 3, e.h * CELL - 3); }
    if (held && trade.mode === 'stash' && hit && hit.area === 'grid') { // 창고에 놓을 자리 미리보기 (초록: 빈 자리, 노랑: 교체, 빨강: 불가)
      const t = stashTarget(held.inst), n = gridOverlaps(stash, held.inst, t.gx, t.gy).length;
      ctx.fillStyle = n === 0 ? 'rgba(80,255,120,0.22)' : n === 1 ? 'rgba(255,220,80,0.22)' : 'rgba(255,60,60,0.25)';
      ctx.fillRect(g.gx + t.gx * CELL, g.gy + t.gy * CELL, held.inst.s.size[0] * CELL, held.inst.s.size[1] * CELL);
    }
  }
  // 하단: 안내 / 버튼
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif';
  ctx.fillStyle = trade.note ? '#9f9' : '#887';
  ctx.fillText(trade.note || (trade.tab === 'shells' ? '클릭: 구매 · 스킬 쉘은 인벤토리의 스킬 칸(Z X V B)에 끼워 씀'
    : trade.tab === 'armor' ? '클릭: 구매 · 방어구는 인벤토리의 방어구 칸(머리·몸·다리)에' : trade.tab === 'forge' ? '오른쪽 인벤토리에서 분해·재련할 장비를 클릭하세요'
    : trade.tab === 'socket' ? '오른쪽 인벤토리에서 장비를 클릭 · 보석은 주머니에서 집어 장비 위에 놓기'
    : trade.tab === 'rune' ? '조합식에 마우스를 올리면 자세히 · 인벤토리의 장비를 클릭하면 맞는 조합식이 빛남'
    : trade.tab === 'gamble' ? '클릭: 사기 — 종류만 고르고 바탕 장비·등급은 무작위 (고급 이상, 아주 드물게 고유 전설)'
    : { shop: '클릭: 구매 · 내 무기를 끌어다 놓거나 우클릭하면 판매', sell: '내 무기를 끌어다 놓거나 우클릭하면 판매', upgrade: '오른쪽 인벤토리에서 강화할 무기를 클릭하세요',
      stash: `보관 ${stash.length}개 · 끌어서 옮기기 · 우클릭: 가방 ↔ 창고` }[trade.mode]), g.gx, g.footY + 4);
  for (const b of tradeButtons()) if (!b.gem) tradeButton(b); // 보석 칸은 drawSocketArea가 그림
  // 진열 항목 툴팁
  const e = !held && hit && hit.area === 'grid' && entryAt(hit.cx, hit.cy);
  if (e) {
    let L;
    if (e.kind === 'stash') L = [...itemLines(e.inst), { t: '클릭: 집어 들기 · 우클릭: 가방으로', c: '#9a9' }];
    else if (e.kind === 'gamble') L = gambleTooltip(e);
    else if (e.inst) L = [...itemLines(e.inst), { t: `${e.kind === 'back' ? '되사기' : '구매가'} ${e.price}G`, c: p.gold >= e.price ? '#ffd27a' : '#f66', b: true }];
    else {
      const info = goodInfo(e.k, e.id);
      L = [{ t: info.name, c: info.color || '#c9a040', b: true }];
      if (info.desc) L.push({ t: info.desc, c: '#ccc' });
      if (e.k === 'ammo') L.push({ t: `${info.buy}발 · 최대 ${ammoMax(e.id)}`, c: '#ccc' });
      L.push({ t: `보유 ${goodCount(e.k, e.id)}`, c: '#9a9' });
      L.push(e.kind === 'sellG' ? { t: `판매가 ${e.price}G`, c: '#ffd27a', b: true } : { t: `구매가 ${e.price}G`, c: p.gold >= e.price ? '#ffd27a' : '#f66', b: true });
    }
    drawTooltip(L, mouse.x + 18, mouse.y + 18);
  }
}
// '보석 조합' 탭: 조합식 목록 (무기 / 방어구 쪽) — 줄마다 보석 순서·이름·효과, 마우스를 올리면 자세히. 고른 장비에 맞는 조합식은 빛남
const RW_ROW = 30;
const rwKeys = page => Object.keys(RUNEWORDS).filter(k => (RUNEWORDS[k].type === 'weapon') === (page !== 'armor'));
// 주머니에 이 조합식의 보석이 (등급 상관없이) 모두 있는지, 모자란 보석
function rwShort(k) {
  const need = {};
  for (const id of RUNEWORDS[k].gems) need[id] = (need[id] || 0) + 1;
  return Object.keys(need).filter(id => pouchN(id) < need[id]).map(id => `${GEMS[id].name} ${need[id] - pouchN(id)}개`);
}
function drawRunewordArea(g) {
  const page = trade.rwPage || 'weapon', W0 = VG_W * CELL;
  const sel = trade.sel && ownedItems().includes(trade.sel) && canSocket(trade.sel) ? trade.sel : null;
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = RW_COLOR; ctx.fillText('보석 조합', g.gx, g.gy + 14);
  ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a9484';
  ctx.fillText(fitText('일반 등급 장비의 소켓을 정해진 보석으로 순서대로 꽉 채우면 이름 있는 장비가 된다', W0), g.gx, g.gy + 30);
  if (sel) { ctx.textAlign = 'right'; ctx.fillStyle = itemColor(sel); ctx.fillText(fitText(`고른 장비: ${sel.name} (소켓 ${sel.sockets || 0})`, W0 - 156), g.gx + W0, g.gy + 50); }
  let hover = null;
  rwKeys(page).forEach((k, n) => {
    const R = RUNEWORDS[k], y = g.gy + 62 + n * RW_ROW, fits = sel && rwFits(sel).includes(k);
    const hov = mouse.x >= g.gx && mouse.x < g.gx + W0 && mouse.y >= y && mouse.y < y + RW_ROW - 3;
    if (hov) hover = k;
    ctx.fillStyle = fits ? 'rgba(95,224,200,0.14)' : 'rgba(255,255,255,0.04)'; ctx.fillRect(g.gx, y, W0, RW_ROW - 3);
    if (hov || fits) { ctx.strokeStyle = hov ? '#fff' : RW_COLOR; ctx.lineWidth = 1; ctx.strokeRect(g.gx + 0.5, y + 0.5, W0 - 1, RW_ROW - 4); }
    R.gems.forEach((id, j) => drawIcon(GEMS[id].icon, g.gx + 4 + j * 19, y + 5, 17, 17));
    ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = RW_COLOR; ctx.fillText(R.name, g.gx + 64, y + 12);
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#8a8478'; ctx.fillText(`${RW_TYPE[R.type]} · 소켓 ${R.gems.length}`, g.gx + 64, y + 24);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#cfe8c8';
    ctx.fillText(fitText(Object.entries(R.stats).map(([s, v]) => RW_FX[s](v)).join(' · '), W0 - 172 - 18), g.gx + 168, y + 17);
    if (!rwShort(k).length) { ctx.textAlign = 'right'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#7f7'; ctx.fillText('✓', g.gx + W0 - 5, y + 17); }
  });
  if (!hover) return;
  const R = RUNEWORDS[hover], n = R.gems.length, short = rwShort(hover);
  const L = [{ t: R.name, c: RW_COLOR, b: true }, { t: `보석 조합 · ${RW_TYPE[R.type]} · 소켓 ${n}칸 (딱 맞아야 함)`, c: '#9a9' },
    { t: `순서: ${R.gems.map(id => GEMS[id].name).join(' → ')}`, c: '#eee' }];
  for (const [s, v] of Object.entries(R.stats)) L.push({ t: '◆ ' + RW_FX[s](v), c: RW_COLOR });
  L.push({ t: `"${R.flavor}"`, c: '#d0604a' });
  L.push({ t: R.type === 'weapon' ? `바탕: 일반 등급 무기 — 소켓 ${n}칸은 ${n >= 3 ? '큰 무기 (8칸 이상)' : '보통 이상 무기 (4칸 이상)'}` : `바탕: 일반 등급 ${RW_TYPE[R.type]}`, c: '#ccc' });
  L.push({ t: '보석 등급은 상관없음 — 보석마다의 효과도 함께 붙음 · 보석을 빼면 조합이 풀림', c: '#888' });
  L.push(short.length ? { t: `모자란 보석: ${short.join(', ')}`, c: '#a99' } : { t: '보석 주머니에 필요한 보석이 모두 있다', c: '#7f7' });
  drawTooltip(L, mouse.x + 18, mouse.y + 18);
}
// 개조실: 신체 개조 5종 + 선택한 무기 강화
function drawUpgradeArea(g) {
  const p = player;
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText('신체 개조 (영구)', g.gx, g.gy + 14);
  Object.entries(UPGRADES).forEach(([k, u], n) => {
    const y = g.gy + 20 + n * 34, lv = p.up[k];
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(g.gx, y, 32, 32); ctx.strokeStyle = '#4a463c'; ctx.strokeRect(g.gx + 0.5, y + 0.5, 31, 31);
    drawIcon(UP_ICON[k], g.gx + 3, y + 3, 26, 26);
    ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#e8dcc0'; ctx.fillText(u.name, g.gx + 40, y + 13);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#9a9484'; ctx.fillText(u.desc, g.gx + 40, y + 28);
    for (let s = 0; s < u.max; s++) { ctx.fillStyle = s < lv ? '#8f8' : '#2a3a2a'; ctx.fillRect(g.gx + 170 + s * 12, y + 5, 9, 9); }
  });
  const ey = g.gy + 210;
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText(`장비 강화 (단계마다 피해·방어 +${Math.round(ENHANCE_DMG * 100)}%, 최대 +${ENHANCE_MAX})`, g.gx, ey);
  const w = trade.sel && ownedItems().includes(trade.sel) ? trade.sel : (trade.sel = null);
  ctx.fillStyle = '#0b0a08'; ctx.fillRect(g.gx, ey + 6, 140, 54); ctx.strokeStyle = '#4a463c'; ctx.strokeRect(g.gx + 0.5, ey + 6.5, 139, 53);
  if (!w) { ctx.font = '11px sans-serif'; ctx.fillStyle = '#6a6458'; ctx.textAlign = 'center'; ctx.fillText('무기·방어구를 선택하세요', g.gx + 70, ey + 37); return; }
  const [sw, sh] = w.s.size, k = Math.min(132 / (sw * CELL), 46 / (sh * CELL));
  drawItemBox(w, g.gx + 70 - sw * CELL * k / 2, ey + 33 - sh * CELL * k / 2, sw * CELL * k, sh * CELL * k);
  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = RARITY[w.rarity].color; ctx.fillText(fitText(w.name, 200), g.gx + 150, ey + 17);
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#ccc';
  if (w.kind === 'shell') { ctx.fillText('스킬 쉘은 강화하지 않음 — 분해·재련 탭', g.gx + 150, ey + 31); return; }
  const key = w.kind === 'armor' ? 'def' : 'dmg', next = Math.round(w.s[key] / (1 + ENHANCE_DMG * w.plus) * (1 + ENHANCE_DMG * (w.plus + 1)));
  ctx.fillText(`강화 ${w.plus}/${ENHANCE_MAX} · ${key === 'def' ? '방어' : '피해'} ${Math.round(w.s[key])}${w.plus < ENHANCE_MAX ? ` → ${next}` : ''}`, g.gx + 150, ey + 31);
}

// ===== 입력 =====
const keys = {}; const mouse = { x: 0, y: 0, down: false, pressed: false };
addEventListener('keydown', e => {
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!overlay.classList.contains('hidden')) { // 메뉴 (menu.js): 방향키는 누르고 있으면 되풀이
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') e.preventDefault();
    if (!e.repeat || /Arrow|Key[WASD]/.test(e.code)) uiKey(e.code);
    keys[e.code] = false; return;
  }
  if (!keys[e.code]) onKey(e.code);
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; if (!overlay.classList.contains('hidden') && (e.code === 'Space' || e.code === 'Enter')) e.preventDefault(); });
// 브라우저는 사용자가 한 번 누른 뒤에야 소리를 낼 수 있음 → 첫 클릭·키에서 오디오 시작 (타이틀 음악도 이때부터)
addEventListener('pointerdown', () => Snd.init(), { once: true });
addEventListener('keydown', () => Snd.init(), { once: true });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => {
  Snd.init();
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (state === 'intro') { if (e.button === 0) mouse.down = true; return; } // 컷신: 누르고 있으면 건너뜀 (introTick)
  if (state === 'trade') { tradeMouseDown(e.button); return; }
  if (state === 'play' && invOpen && invMouseDown(e.button)) return;
  if (state === 'play' && codexOpen && codexMouseDown(e.button)) return;
  if (state === 'play' && perkOpen && perkMouseDown(e.button)) return;
  if (e.button === 0) { mouse.down = true; mouse.pressed = true; }
  if (e.button === 2) throwGrenade();
});
addEventListener('mouseup', e => {
  if (e.button !== 0) return;
  mouse.down = false;
  if ((state === 'play' || state === 'trade') && invOpen) { mouse.x = e.clientX; mouse.y = e.clientY; invMouseUp(); }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { if (state === 'play') cycleWeapon(Math.sign(e.deltaY || e.deltaX)); }, { passive: true });

function onKey(code) {
  if (state === 'intro') return; // 컷신: 누르고 있으면 건너뜀 (introTick)
  if (code === 'Escape') {
    if (state === 'play' && codexOpen) codexOpen = false;
    else if (state === 'play' && perkOpen) perkOpen = false;
    else if (state === 'play' && invOpen) closeInventory();
    else if (state === 'play') pauseGame();
    else if (state === 'pause') resumeGame();
    else if (state === 'menu') closeMenu(); // 순간이동 패드·기록 단말기 창 닫기
    else if (state === 'trade') closeTrade();
    return;
  }
  if (state !== 'play') return;
  const p = player;
  if (code in ITEM_KEYS) useItem(ITEM_KEYS[code]); // 소모품 (메디킷 Q·E·T, 보조 아이템 7·8·9·0·-)
  else if (code.startsWith('Digit')) { const n = +code.slice(5); if (n >= 1 && n <= NSLOT) selectSlot(n - 1); }
  else if (code === 'KeyI' || code === 'Tab') { if (invOpen) closeInventory(); else { invOpen = true; perkOpen = false; codexOpen = false; } }
  else if (code === 'KeyK') { perkOpen = !perkOpen; if (perkOpen) { closeInventory(); codexOpen = false; } Snd.play('menu'); } // 캐릭터 성장 창
  else if (code === 'KeyJ') { codexOpen = !codexOpen; if (codexOpen) { closeInventory(); perkOpen = false; } Snd.play('menu'); } // 수집 도감
  else if (code === 'KeyF') { const t = nearestTerminal(), o = !t && !inBase && nearestSpot(); if (t) useTerminal(t); else if (o) useSpot(o); else if (!inBase) pickUpWeapon(); } // 단말기 / 금고 보물함·필드 사건 / 무기 줍기
  else if (code === 'KeyR') startReload();
  else if (code === 'KeyM') mapBig = !mapBig;
  else if (code === 'KeyH') { if (tipNow) closeTip(); else if (logNow) { logNow = null; Snd.play('menu'); } } // 안내 카드 · 데이터 기록 닫기
  else if (code in SKILL_KEYS) useSkillSlot(SKILL_KEYS[code]); // 스킬 칸 (Z X V B)
  else if (code === 'KeyG') { const ks = Object.keys(GRENADES); p.gsel = ks[(ks.indexOf(p.gsel) + 1) % ks.length]; msg(`수류탄: ${GRENADES[p.gsel].name}`, GRENADES[p.gsel].color); }
  else if (code === 'Space' && p.dashCd <= 0) {
    if (p.stamina < STAMINA_DASH) { msg('스태미너 부족', '#fc6'); return; }
    useStamina(STAMINA_DASH);
    let dx = p.mvx || 0, dy = p.mvy || 0;
    if (!dx && !dy) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    p.ddx = dx; p.ddy = dy; p.dash = 0.22; p.dashCd = 0.9 * (1 - perkV('dash')) * (1 - gearV('dash')); Snd.play('dash');
  }
}

// ===== 업데이트 =====
function updatePlayer(dt) {
  const p = player, f = p.fx;
  for (const k of ['adren', 'immP', 'immS', 'shock', 'curse']) if (f[k] > 0) f[k] = Math.max(0, f[k] - dt);
  const dm = DIFFICULTY[difficulty].dmg, safe = inHub(); // 중독·화상 피해도 난이도 배율, 안전 지대에서는 깎이지 않음
  if (f.poison > 0) { f.poison -= dt; if (!safe) p.hp -= 5 * dt * dm; if (Math.random() < dt * 6) parts.push({ x: p.x, y: p.y, z: 30, vx: 0, vy: 0, vz: 30, g: 0, life: 0.6, max: 0.6, col: '#9e4', size: 3 }); }
  if (f.burn > 0) { f.burn -= dt; if (!safe) p.hp -= 9 * dt * dm; if (Math.random() < dt * 15) fireBurst(p.x, p.y, 1, 0.3); }
  if (f.regen > 0) { const h = Math.min(f.regen, 14 * dt); f.regen -= h; p.hp = Math.min(p.maxhp, p.hp + h); }
  const rg = gearV('regen'); if (rg > 0) p.hp = Math.min(p.maxhp, p.hp + rg * dt); // 방어구 체력 회복 옵션
  if (p.hp <= 0 && !rebirth()) { p.hp = 0; die(); return; }

  let sx = 0, sy = 0;
  if (keys.KeyA || keys.ArrowLeft) sx--;
  if (keys.KeyD || keys.ArrowRight) sx++;
  if (keys.KeyW || keys.ArrowUp) sy--;
  if (keys.KeyS || keys.ArrowDown) sy++;
  let mx = 0, my = 0;
  if (sx || sy) { const a = sx / (TW / 2), b = sy / (TH / 2); mx = (a + b) / 2; my = (b - a) / 2; const l = Math.hypot(mx, my); mx /= l; my /= l; }
  p.mvx = mx; p.mvy = my;
  const wi = curW(), w = wi.s;
  const heavy = w.slow && !(w.uq === 'fury' && p.spin >= 0.99); // 분노의 회전: 총열이 다 돌면 느려지지 않음
  let spd = 4.3 * (f.adren > 0 ? 1.35 : 1) * (buff('berserk') ? SKILLS.berserk.speed : 1) * (f.shock > 0 ? 0.5 : 1) * (heavy ? w.slow : 1) * (load() > maxLoad() ? 0.8 : 1) * (1 + gearV('spd') + resV('agi')); // 다리 방어구 옵션, 민첩 공명
  if (heavy && mouse.down) spd *= 0.75;
  // 달리기 (Shift): 스태미너 소모, 고갈되면 일정량 회복될 때까지 불가
  p.sprinting = !!((keys.ShiftLeft || keys.ShiftRight) && (sx || sy) && !p.exhausted && p.dash <= 0);
  if (p.sprinting) {
    spd *= SPRINT_MUL; useStamina(STAMINA_SPRINT * dt);
    if (p.stamina <= 0) { p.exhausted = true; msg('스태미너 고갈! 잠시 달릴 수 없습니다', '#fc6'); }
    if (Math.random() < dt * 10) smoke(p.x, p.y, 1, '120,110,100', 0.3);
  }
  if (p.stagger > 0) { p.stagger -= dt; if (!buff('iron')) spd *= 0.3; } // 큰 공격에 맞은 경직 (강철 피부면 무시)
  p.staminaDelay -= dt;
  if (p.staminaDelay <= 0) p.stamina = Math.min(staminaMax(), p.stamina + STAMINA_REGEN * (1 + perkV('stamina')) * dt);
  if (p.exhausted && p.stamina >= STAMINA_RECOVER) p.exhausted = false;
  // 중앙 스태미너 바: 가득 차 있지 않으면 표시, 다 차면 서서히 사라짐
  p.staminaBarA = p.stamina < staminaMax() ? 1 : Math.max(0, p.staminaBarA - dt * 2.5);
  p.dashCd -= dt; p.gcool -= dt;
  const C = buff('charge');
  if (C) chargeStep(C, dt); // 강습 돌진
  else if (p.dash > 0) {
    p.dash -= dt; moveEntity(p, p.ddx * 13 * dt, p.ddy * 13 * dt);
    smoke(p.x, p.y, 1, '120,110,100', 0.3);
  } else moveEntity(p, mx * spd * dt, my * spd * dt);
  if (f.shock > 0 && Math.random() < dt * 10) spark(p.x, p.y, 2, '#9df', 2);
  if (buff('iron')) p.kx = p.ky = 0; // 강철 피부: 밀려나지 않음
  moveEntity(p, p.kx * dt, p.ky * dt); p.kx *= Math.max(0, 1 - dt * 8); p.ky *= Math.max(0, 1 - dt * 8);
  p.moving = !!(sx || sy); if (p.moving) p.walk += dt * spd * 2.4;
  if (p.moving && p.dash <= 0) { const st = Math.floor(p.walk * 0.3); if (st !== p.stepN) { p.stepN = st; Snd.play('step'); } } // 발소리 (걷기 초당 약 3번, 달리면 더 빨리)

  const m = screenToWorld(mouse.x, mouse.y + 14);
  p.aim = Math.atan2(m.y - p.y, m.x - p.x);
  p.look += angDiff(p.aim, p.look) * Math.min(1, dt * 12);
  p.target = w.type === 'gun' ? findTarget(w.range || 16) : null;

  const rate = (f.adren > 0 ? 1.35 : 1) * (buff('berserk') ? SKILLS.berserk.rate : 1) * (buff('deadeye') ? 1.25 : 1) * (p.frenzy > 0 ? 1 + p.frenzyV : 1); // 아드레날린, 광폭화, 집중 사격, 광란
  p.cool -= dt * rate; p.swing -= dt; p.fireT -= dt; p.painT -= dt; p.hitT -= dt;
  for (const k in p.scd) if (p.scd[k] > 0) p.scd[k] -= dt; // 스킬 대기시간
  for (const k in p.sk) { const b = p.sk[k]; if (b.t > 0 && (b.t -= dt) <= 0) skillEnd(k); } // 지속 중인 스킬 효과
  if (p.inv > 0) p.inv -= dt;
  if (p.frenzy > 0) p.frenzy -= dt;
  if (p.phoenixT > 0) p.phoenixT -= dt; // 불사조 대기시간
  const RP = buff('repair'); if (RP) heal(p, RP.rate * dt); // 나노 수리
  if (p.reload > 0) { p.reload -= dt * rate; if (p.reload <= 0) finishReload(); }
  const noAtk = safe && !contested(); // 거점 습격 중에는 거점 안에서도 싸움
  if (noAtk) p.charging = 0; // 안전 지대에 들어오면 모으던 분쇄포도 멈춤
  if (p.charging > 0 && (p.charging -= dt) <= 0 && w.charge && wi.mag > 0) fireGun(w); // 분쇄포: 다 모이면 발사
  if (w.spin) p.spin = mouse.down ? Math.min(1, p.spin + dt / 0.7) : Math.max(0, p.spin - dt);
  const trig = (w.type === 'melee' || w.auto) ? (mouse.down || mouse.pressed) : mouse.pressed;
  if (inBase) mouse.pressed = false; // 기지 안에서는 공격하지 않음
  else if (noAtk) { if (trig) noFight(); mouse.pressed = false; } // 보급 거점(안전 지대)
  else if (trig && p.cool <= 0 && p.reload <= 0) {
    mouse.pressed = false;
    if (w.type === 'melee') {
      if (p.stamina < w.stamina) { msg('스태미너 부족', '#fc6'); p.cool = 0.25; }
      else { useStamina(w.stamina); doMelee(w); p.cool = w.rate; }
    }
    else if (wi.mag > 0 && w.charge) { p.charging = w.charge; p.cool = w.charge + w.rate; Snd.play(w.snd); } // 모으기 시작
    else if (wi.mag > 0) { fireGun(w); p.cool = w.rate * (w.spin ? 1 + (1 - p.spin) * 2 : 1); }
    else if (!startReload()) { Snd.play('empty'); msg('탄약이 없습니다 — 다른 무기로 교체하세요', '#f99'); p.cool = 0.4; tip('noammo'); }
  }

  // 아이템 줍기 (무기는 F 키로 직접 줍기) — 골드·보석은 가까이 가면 끌려와 저절로 (보석은 보석 주머니로)
  for (const it of pickups) {
    if (it.dead) continue;
    const gem = it.kind === 'weapon' && it.inst.kind === 'gem', d = Math.hypot(it.x - p.x, it.y - p.y);
    if (it.kind === 'weapon' && !gem) continue;
    if (it.wait) { if (d > PICKUP_MAGNET.r + 0.5) it.wait = false; continue; } // 직접 버린 것: 한 번 멀어졌다 돌아와야 다시 주움
    if ((gem || it.kind === 'gold' || it.mag) && d > 0.5 && d < PICKUP_MAGNET.r && los(it.x, it.y, p.x, p.y)) { const k = Math.min(1, PICKUP_MAGNET.v * dt / d); it.x += (p.x - it.x) * k; it.y += (p.y - it.y) * k; } // 골드·보석·근접 처치 탄약은 끌려옴
    if (d > 0.6) continue;
    it.dead = true;
    if (gem) { pouchAdd(it.inst); continue; }
    const amt = Math.round(it.amount * (1 + perkV('scav') + (it.kind === 'gold' ? gearV('gold') : 0))); // 보급 전문가: 골드·탄약 더, 토파즈(방어구): 골드 더
    if (it.kind === 'gold') { p.gold += amt; addText(it.x, it.y, `+${amt}G`, '#ffd27a'); Snd.play('gold'); continue; }
    if (it.kind === 'key') { const K = KEYCARDS[it.id], kk = `${it.kr}:${it.id}`; keysHeld.add(kk); if (it.id !== 'vault' && !flags.keys.includes(kk)) flags.keys.push(kk); msg(`${K.name} 획득 — ${K.door}을 열 수 있다`, K.color); Snd.play('key'); tip(it.id === 'vault' ? 'vault' : 'key', K.spr + 'a0'); continue; } // 금고 열쇠는 저장하지 않음 (불러오면 고유 정예가 다시 지님)
    if (it.kind === 'log') { readLog(it.id); continue; } // 데이터 기록
    if (it.kind === 'ammo') { addAmmo(it.id, amt); msg(`${AMMO[it.id].name} +${amt}`); }
    else if (it.kind === 'item') { p.items[it.id]++; msg(`${ITEMS[it.id].name} 획득`, ITEMS[it.id].color); }
    else if (it.kind === 'gren') { p.gren[it.id]++; msg(`${GRENADES[it.id].name} 획득`, GRENADES[it.id].color); }
    Snd.play('pickup');
  }
  pickups = pickups.filter(i => !i.dead);

  // 패드: 올라선 순간 — 거점의 순간이동 패드면 이동 창, 탈출정은 자폭 중에만 (내려섰다 다시 올라야 다시 뜸)
  const onPad = tileAt(Math.floor(p.x), Math.floor(p.y)) === T.EXIT;
  if (onPad && !p.onPad && !inBase) {
    const pd = pads.find(q => q.i === Math.floor(p.x) && q.j === Math.floor(p.y));
    if (pd && pd.hub) teleportScreen(pd.hub);
    else if (pd && (pd.kind === 'rift' || pd.kind === 'riftExit')) riftPadScreen(); // 차원 균열의 패드
    else if (escape) ending();
    else msg('탈출정 — 오버마인드를 처치하면 가동된다', '#f99');
  }
  p.onPad = onPad;
}

// 몬스터 원거리 공격 한 발 (구역이 깊을수록 피해 증가)
function enemyShot(e, R, a) {
  eshots.push({ x: e.x, y: e.y, vx: Math.cos(a) * R.speed, vy: Math.sin(a) * R.speed, type: R.type, dmg: R.dmg * (1 + 0.1 * (e.lv - 1)), life: R.range / R.speed + 0.3 });
}
// 난사하는 정예면 양옆으로 한 발씩 더
function enemyShots(e, R, a) { enemyShot(e, R, a); if (e.multi) { const s = ELITE_FX.multi.spread; enemyShot(e, R, a - s); enemyShot(e, R, a + s); } }
// 차저: 보이면 웅크렸다가(windT, 붉게 번쩍) 그 순간 플레이어 쪽으로 일직선 돌진(dashT). 맞히면 크게 밀어내고, 벽에 박으면 기절
// 이번 프레임의 움직임을 직접 처리했으면 true
function chargeThink(e, dt, d, dx, dy, see) {
  const C = e.d.charge, p = player;
  e.chargeCd = (e.chargeCd ?? rnd(0, 0.4)) - dt; // 처음 발견하면 곧바로 돌진할 수 있음
  if (e.dashT > 0) {
    e.dashT -= dt;
    const ox = e.x, oy = e.y;
    moveEntity(e, e.cdx * C.speed * dt, e.cdy * C.speed * dt);
    e.moving = true; e.face = Math.atan2(e.cdy, e.cdx);
    if (Math.random() < dt * 30) smoke(e.x, e.y, 1, '120,110,100', 0.4);
    if (!e.hitDone && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 0.25) {
      e.hitDone = true; e.dashT = Math.min(e.dashT, 0.05); e.atkT = ATK_ANIM; e.acd = e.d.atkRate; // 들이받은 직후 바로 물지는 않음
      hurtPlayer(e.dmg * C.mul, e.x, e.y); p.kx += e.cdx * 10; p.ky += e.cdy * 10; Snd.mon(e, 'attack');
    } else if (Math.hypot(e.x - ox, e.y - oy) < C.speed * dt * 0.3) { // 벽에 박음
      e.dashT = 0; e.stun = C.stun; shake = Math.max(shake, 4); spark(e.x, e.y, 8, '#ffd27a', 3); Snd.play('meleeHit', e.x, e.y);
    }
    if (e.dashT <= 0) e.chargeCd = C.cd * (e.atkMul || 1);
    return true;
  }
  if (e.windT > 0) {
    e.windT -= dt; e.face = Math.atan2(dy, dx); e.atkT = 0.1;
    if (e.windT <= 0) { e.cdx = dx / d; e.cdy = dy / d; e.dashT = C.dur; e.hitDone = false; }
    return true;
  }
  if (see && e.chargeCd <= 0 && d > 1.5 && d < C.range) { e.windT = C.wind; Snd.mon(e, 'sight'); return true; }
  return false;
}
// 도약: (dx, dy) 쪽으로 dur초 동안 v칸/초로 뛰어오름 (높이 h px, 그림자는 바닥에 남음)
// kind: hop(크롤러의 깡충 이동) · pounce(덮치기) · dodge(제노이드가 옆으로 피하기)
function startLeap(e, dx, dy, v, dur, h, kind) {
  const l = Math.hypot(dx, dy) || 1;
  e.ldx = dx / l; e.ldy = dy / l; e.leapV = v; e.leapT = e.leapDur = dur; e.leapH = h; e.leapKind = kind;
}
function leapStep(e, dt) {
  e.leapT -= dt;
  const k = 1 - Math.max(0, e.leapT) / e.leapDur, v = e.leapV * (e.slow > 0 ? 0.5 : 1);
  moveEntity(e, e.ldx * v * dt, e.ldy * v * dt);
  e.z = Math.sin(Math.PI * k) * e.leapH; e.moving = true;
  if (e.leapKind !== 'dodge') e.face = Math.atan2(e.ldy, e.ldx); // 옆으로 피할 때는 플레이어를 바라본 채로
  if (e.leapT > 0) return;
  e.leapT = 0; e.z = 0;
  if (e.leapKind !== 'hop') smoke(e.x, e.y, 3, '110,100,90', 0.6); // 크게 뛴 뒤 착지 먼지
}
// 옆으로 피하기: 플레이어 쪽에서 볼 때 왼쪽·오른쪽 중 막히지 않은 쪽으로, 조금 다가가며 (지그재그로 접근). 날아오던 자동 조준 탄은 목표를 잃고 직진
function dodge(e) {
  const D = e.d.dodge, dx = e.x - player.x, dy = e.y - player.y, l = Math.hypot(dx, dy) || 1, s = Math.random() < 0.5 ? 1 : -1, reach = D.v * D.dur;
  for (const side of [s, -s]) {
    let ux = -dy / l * side - dx / l * 0.35, uy = dx / l * side - dy / l * 0.35;
    const ul = Math.hypot(ux, uy); ux /= ul; uy /= ul;
    if (collides(e.x + ux * reach, e.y + uy * reach, e.r, e.fly) || collides(e.x + ux * reach / 2, e.y + uy * reach / 2, e.r, e.fly)) continue;
    startLeap(e, ux, uy, D.v, D.dur, D.h, 'dodge');
    e.dodgeCd = D.cd * rnd(0.85, 1.15) * (e.atkMul || 1);
    for (const b of bullets) if (b.target === e) b.target = null;
    smoke(e.x, e.y, 2, '110,100,90', 0.5); Snd.play('dodge', e.x, e.y); tip('dodge');
    return true;
  }
  return false;
}
// 브루더: 보이는 동안 spawn.rate초마다 앞쪽에 크롤러를 낳음 (살아 있는 자식이 max마리 미만일 때)
function broodThink(e, dt, dx, dy, spawned) {
  const S = e.d.spawn;
  e.spawnT = (e.spawnT ?? rnd(1, 2.5)) - dt;
  if (e.spawnT > 0) return;
  e.spawnT = S.rate * rnd(0.8, 1.2) * (e.atkMul || 1);
  const kids = enemies.filter(o => o.parent === e && !o.dead).length + spawned.filter(o => o.parent === e).length;
  const a = Math.atan2(dy, dx), x = e.x + Math.cos(a) * 0.7, y = e.y + Math.sin(a) * 0.7;
  if (kids >= S.max || collides(x, y, ENEMIES[S.type].r, false)) return;
  const c = makeEnemy(S.type, x, y);
  c.aggro = true; c.parent = e; spawned.push(c);
  e.atkT = ATK_ANIM; addFx('tfog', 'abcdefghij', x, y, 0, 0.5, 0.7); Snd.mon(e, 'attack');
}
// 폭주 해골: 플레이어(또는 동행 생존자·설치물)가 near칸 안에 들면 불이 붙어 fuse초 뒤 그 자리에서 터짐 — 이번 프레임을 직접 처리했으면 true
function bombThink(e, dt, d, see) {
  const B = e.d.bomb;
  if (e.fuse > 0) {
    e.atkT = 0.1;
    if ((e.fuse -= dt) <= 0) { e.dead = true; bombBlast(e, 1); } // 스스로 터짐: 경험치·전리품 없음
    return true;
  }
  const near = o => Math.hypot(o.x - e.x, o.y - e.y) < B.near;
  if (!((see && d < B.near) || devices().some(near) || survivors.some(v => v.state === 'follow' && near(v)))) return false;
  e.fuse = B.fuse; Snd.mon(e, 'attack'); tip('bomber');
  return true;
}
// 폭주 해골이 터짐 (k: 피해 배율 — 쏘아 떨어뜨렸으면 약하고 좁게): 플레이어·생존자·설치물·다른 적 모두, 가까울수록 크게
function bombBlast(e, k) {
  const B = e.d.bomb, R = B.r * (k < 1 ? 0.8 : 1), dmg = B.dmg * (1 + 0.1 * (e.lv - 1)) * k * (e.elite ? ELITE.dmg : 1), x = e.x, y = e.y, f = d => 1 - Math.min(1, d / R) * 0.5;
  const pd = Math.hypot(player.x - x, player.y - y);
  if (pd < R) hurtPlayer(dmg * f(pd), x, y);
  for (const v of survivors) { const dv = Math.hypot(v.x - x, v.y - y); if (dv < R) hurtSurvivor(v, dmg * f(dv), x, y); }
  for (const t of devices()) { const dd = Math.hypot(t.x - x, t.y - y); if (dd < R) hurtDevice(t, dmg * f(dd), x, y); }
  for (const o of enemies) { if (o === e || o.dead) continue; const d = Math.hypot(o.x - x, o.y - y); if (d < R + o.r) hitEnemy(o, dmg * 1.2 * f(d), (o.x - x) / (d || 1) * 6, (o.y - y) / (d || 1) * 6); }
  for (const b of barrels) if (!b.dead && Math.hypot(b.x - x, b.y - y) < R) setTimeout(() => hitBarrel(b, 99), 60);
  addFx('misl', 'bcd', x, y, 18, 0.45, k < 1 ? 1.05 : 1.35); fireBurst(x, y, k < 1 ? 18 : 30, 4); smoke(x, y, 10, '70,60,50', 1.6);
  decal(x, y, R * 0.4, 'rgba(10,8,6,0.7)');
  flashes.push({ x, y, r: k < 1 ? 300 : 420, t: 0.3, max: 0.3, col: '255,150,60' }); shake = Math.max(shake, k < 1 ? 5 : 9); Snd.play('explode', x, y);
}
// 그림자 추적자: min~range칸 떨어지면 cd초마다 플레이어 등 뒤로 순간이동 (곧바로 치지는 않고 잠깐 틈을 줌), 그 기습으로 한 대 치면 멀리 사라짐
function assassinThink(e, dt, d) {
  const B = e.d.blink, p = player;
  e.blinkCd = (e.blinkCd ?? rnd(0.5, 1.5)) - dt;
  if (e.flee) {
    e.flee = false;
    const s = blinkSpot(e, B.flee, B.flee + 2.5, rnd(0, 6.28), false);
    if (s) { blinkTo(e, s); e.blinkCd = B.cd * rnd(0.85, 1.15); e.reveal = 0; }
    return;
  }
  if (e.blinkCd > 0 || d < B.min || d > B.range) return;
  const s = blinkSpot(e, B.back, B.back + 0.7, p.aim + Math.PI, true);
  if (!s) { e.blinkCd = 0.5; return; }
  blinkTo(e, s); e.blinkCd = B.cd * rnd(0.85, 1.15) * (e.atkMul || 1); e.reveal = Math.max(e.reveal || 0, 0.7); e.acd = Math.max(e.acd, 0.45); e.ambush = true;
  e.face = Math.atan2(p.y - e.y, p.x - e.x); tip('assassin');
}
// 순간이동할 자리: 플레이어에게서 r0~r1칸, prefer 방향부터 좌우로 넓혀 가며 (벽·안전 지대·막힌 곳 제외, 플레이어에게 걸어갈 수 있는 곳만)
// see: 플레이어가 보이는 자리만 (기습) / 아니면 보이지 않는 자리를 먼저 (사라짐)
function blinkSpot(e, r0, r1, prefer, see) {
  const p = player, ok = (x, y) => !collides(x, y, e.r, false) && !safeAt(x, y) && flowAt(Math.floor(x), Math.floor(y)) >= 0;
  let fallback = null;
  for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2, 3.1]) for (const r of [r0, (r0 + r1) / 2, r1]) {
    const a = prefer + da, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (!ok(x, y)) continue;
    const vis = los(x, y, p.x, p.y);
    if (see ? vis : !vis) return { x, y };
    if (!see && !fallback) fallback = { x, y };
  }
  return fallback;
}
function blinkTo(e, s) {
  addFx('tfog', 'abcdefghij', e.x, e.y, 0, 0.45, 0.75, 0.7); // 사라진 자리
  e.x = s.x; e.y = s.y; e.kx = e.ky = 0;
  addFx('tfog', 'abcdefghij', s.x, s.y, 0, 0.45, 0.75, 0.7);
  Snd.play('shade', s.x, s.y);
}
// 되살리는 자: rate초마다 range칸 안의 가장 가까운 시체를 골라 wind초 주문(초록 줄기) 뒤 일으켜 세움 — 주문 중이면 true (멈춤)
function raiseThink(e, dt, spawned) {
  const R = e.d.raise;
  if (e.castT > 0) {
    const c = e.raiseC;
    if (c && Math.random() < dt * 25) parts.push({ x: c.x + rnd(-0.3, 0.3), y: c.y + rnd(-0.3, 0.3), z: rnd(0, 6), vx: 0, vy: 0, vz: rnd(30, 70), g: 0, life: 0.6, max: 0.6, col: pick(['#8f8', '#bfb', '#5d5']), size: 3, glow: true });
    if ((e.castT -= dt) > 0) return true;
    e.raiseC = null;
    const T = c && ENEMIES[c.type];
    if (!T || !corpses.includes(c) || collides(c.x, c.y, T.r, !!T.fly) || safeAt(c.x, c.y)) return true;
    corpses.splice(corpses.indexOf(c), 1);
    const o = makeEnemy(c.type, c.x, c.y, e.lv);
    o.hp = o.maxhp * R.hp; o.aggro = true; o.raised = e; o.face = c.face; o.painT = 0.3; spawned.push(o);
    addFx('tfog', 'abcdefghij', c.x, c.y, 0, 0.6, 0.9); rings.push({ x: c.x, y: c.y, R: 1.3, t: 0, max: 0.45, col: '120,255,140' });
    Snd.play('raise', c.x, c.y);
    return true;
  }
  if ((e.raiseCd = (e.raiseCd ?? rnd(1.5, 3)) - dt) > 0) return false;
  e.raiseCd = R.rate * rnd(0.85, 1.15) * (e.atkMul || 1);
  if (enemies.filter(o => o.raised === e && !o.dead).length + spawned.filter(o => o.raised === e).length >= R.max) return false;
  let best = null, bd = R.range;
  for (const c of corpses) {
    const T = ENEMIES[c.type];
    if (!T || T.boss || T.nest || T.fixed || T.raise || T.bomb || c.t < 1) continue;
    const dd = Math.hypot(c.x - e.x, c.y - e.y);
    if (dd < bd) { bd = dd; best = c; }
  }
  if (!best) { e.raiseCd = 1.2; return false; } // 시체가 없으면 곧 다시 살핌
  e.raiseC = best; e.castT = e.castMax = R.wind; e.face = Math.atan2(best.y - e.y, best.x - e.x);
  beams.push({ x0: e.x, y0: e.y, x1: best.x, y1: best.y, t: R.wind, col: '120,255,140', z0: 44 });
  Snd.mon(e, 'attack'); tip('summoner');
  return true;
}
function updateEnemies(dt) {
  const p = player, spawned = [], cloaked = !!buff('cloak'), safe = inHub() && !contested(); // 거점 습격 중에는 거점 안의 플레이어도 계속 노림
  updateFlow();
  for (const e of enemies) {
    if (e.dead) continue;
    e.awake = e.aggro || inBase || Math.abs(e.x - p.x) + Math.abs(e.y - p.y) < FIELD.sleep;
    if (safe && e.trail && e.trail.length) e.homing = true; // 플레이어가 안전 지대에 들어감: 쫓던 적은 원래 자리로
    if (!e.awake) { if (e.homing) goHome(e); continue; } // 멀리서 쉬는 적 (넓은 필드 — 쫓아오는 적은 계속 움직임), 돌아가던 적은 보이지 않으니 바로 제자리로
    if (safeMap[Math.floor(e.y) * MW + Math.floor(e.x)]) evict(e);
    if (e.super && !e.seenMsg && canSee(e.x, e.y)) { e.seenMsg = true; msg(`⚠ 고유 정예 '${e.name}' — ${regions[e.lv] && regions[e.lv].vault ? '금고 열쇠를 지니고 있다' : '강력한 개체'}`, '#ff9a3a'); tip('super'); }
    else if (e.d.boss && !e.seenMsg && canSee(e.x, e.y)) { e.seenMsg = true; msg(`⚠ 보스 '${e.d.name}'`, '#ff7a4a'); }
    if (e.aggro && !e.d.fixed) trailMark(e); // 쫓는 동안 지나온 길
    e.flash -= dt; e.anim += dt; e.acd -= dt; e.atkT -= dt; e.painT -= dt; e.moving = false;
    if (e.reveal > 0) e.reveal -= dt;
    if (e.shieldT > 0) e.shieldT -= dt;
    if (e.auraT > 0) e.auraT -= dt; // 지휘하는 정예 곁
    if (e.guardDown > 0) e.guardDown -= dt; // 방패가 내려간 시간
    if (e.burn > 0) { e.burn -= dt; hitEnemy(e, 10 * dt, 0, 0, true); if (Math.random() < dt * 12) fireBurst(e.x, e.y, 1, 0.3); }
    if (e.poison > 0) { e.poison -= dt; hitEnemy(e, 8 * dt, 0, 0, true); }
    if (e.dead) continue;
    if (hiddenE(e)) { hiddenThink(e, dt); continue; } // 천장의 매복자 · 땅속의 굴착자
    if (e.fallT > 0) { lurkerFall(e, dt); continue; } // 매복자: 떨어지는 중
    if (e.digT > 0 || e.emergeT > 0) { burrowAnim(e, dt); continue; } // 굴착자: 파고드는 중 · 솟아오르는 중
    if (e.elite) eliteTick(e, dt);
    e.slow -= dt;
    if (e.dodgeCd > 0) e.dodgeCd -= dt;
    if (e.pounceCd > 0) e.pounceCd -= dt;
    moveEntity(e, e.kx * dt, e.ky * dt); e.kx *= Math.max(0, 1 - dt * 7); e.ky *= Math.max(0, 1 - dt * 7);
    if (e.leapT > 0) { leapStep(e, dt); continue; } // 뛰는 중: 정한 방향으로만 (착지한 뒤 다시 판단)
    if (e.freeze > 0) { e.freeze -= dt; continue; }
    if (e.stun > 0) { e.stun -= dt; if (Math.random() < dt * 8) spark(e.x, e.y, 1, '#9df', 1.5); continue; }
    if (e.dodgeIn > 0 && (e.dodgeIn -= dt) <= 0) { e.dodgeIn = 0; if (dodge(e)) continue; } // 조준당한 제노이드: 옆으로 피하기

    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 0.01;
    const hidden = safe || (cloaked && d > CLOAK_NEAR); // 안전 지대 안의 플레이어, 은신 장막(곁이 아니면)은 놓침
    if (hidden && e.aggro) { e.aggro = false; e.burst = 0; }
    const see = d < 14 && los(e.x, e.y, p.x, p.y);
    if (!e.aggro && !hidden && ((see && d < 10) || d < 3)) { aggro(e); alertNear(e.x, e.y, 5); }
    if (e.d.nest) { nestThink(e, dt, spawned); continue; } // 둥지: 움직이지 않고 몬스터만 낳음
    if (e.d.pillar) { watcherThink(e, dt, d, dx, dy, see); continue; } // 감시자: 제자리에서 불기둥만
    if (e.d.thief) { thiefThink(e, dt, d, dx, dy, see); continue; } // 보물 약탈자: 싸우지 않고 달아남
    if (e.d.burrow && e.aggro && !hidden && (e.upT = (e.upT ?? 0) - dt) <= 0 && !(e.atkT > 0)) { startDig(e); continue; } // 굴착자: 땅 위 시간이 다 되면 다시 파고듦
    if (e.d.ward) wardTick(e); // 수호 드론: 주변 적에게 보호막 (움직임은 거리를 두는 적과 같음)
    if (e.d.boss && e.aggro && bossThink(e, dt, d, dx, dy, see, spawned)) continue; // 구역 보스: 돌진·주문·레이저 중에는 따로 움직임
    if (e.d.charge && e.aggro && chargeThink(e, dt, d, dx, dy, see)) continue; // 차저: 웅크림·돌진 중에는 따로 움직임
    if (e.d.spawn && e.aggro && see) broodThink(e, dt, dx, dy, spawned);
    if (e.d.bomb && (e.fuse > 0 || e.aggro) && bombThink(e, dt, d, see)) continue; // 폭주 해골: 불이 붙으면 그 자리에서 터질 때까지
    if (e.d.raise && e.aggro && raiseThink(e, dt, spawned)) continue;             // 되살리는 자: 주문 중에는 멈춤
    if (e.d.blink && e.aggro && !hidden) assassinThink(e, dt, d);                // 그림자 추적자: 등 뒤로 순간이동 · 치고 사라짐
    let mvx = 0, mvy = 0, spdMul = 1, tsee = see;
    if (e.aggro) {
      // 노릴 대상: 보통은 플레이어, 동행 중인 생존자가 더 가까이 보이면 생존자 (보스는 플레이어만)
      const T = ((survivors.length || turrets.length || coils.length) && !e.d.boss && preyFor(e, d)) || p;
      const tdx = T.x - e.x, tdy = T.y - e.y, td = Math.hypot(tdx, tdy) || 0.01;
      e.tgtA = Math.atan2(tdy, tdx);
      let tx = T.x, ty = T.y;
      if (T === p && (!see || d > 8)) { const s = flowStep(e); if (s) { tx = s[0]; ty = s[1]; } }
      if (T !== p) tsee = true; // 생존자는 보이는 것만 고름
      const R = e.d.ranged;
      if (R && e.burst > 0) { // 연사 중: gap초마다 한 발 (시야를 잃으면 멈춤) — 타이탄의 로켓 연사(e.burst)는 bossThink가 따로 처리
        if (!tsee) e.burst = 0;
        else if ((e.burstT -= dt) <= 0) { e.burstT = R.gap; e.burst--; e.atkT = 0.15; enemyShots(e, R, Math.atan2(tdy, tdx) + rnd(-R.spread, R.spread)); Snd.play('enemyGun', e.x, e.y); }
      }
      if (tsee && (R ? td < R.range : e.d.keep && td < 9)) { // 거리를 두고 싸우는 적 (브루더는 쏘지 않고 거리만 둠)
        if (R && (e.rcd -= dt) <= 0) {
          e.rcd = R.rate * rnd(0.8, 1.2) * (e.atkMul || 1) * (e.auraT > 0 ? ELITE_FX.aura.atk : 1); e.atkT = ATK_ANIM;
          if (shieldOf(e)) e.guardDown = shieldOf(e).drop; // 방패를 든 정예: 쏠 때는 방패가 내려감
          if (R.burst) { e.burst = R.burst; e.burstT = 0; }
          else {
            const n = (R.volley || 1) + (e.multi && R.volley ? 2 : 0), a0 = Math.atan2(tdy, tdx); // 부채꼴로 쏘는 적이 난사하면 두 발 더
            if (n > 1) for (let k = 0; k < n; k++) enemyShot(e, R, a0 + (k - (n - 1) / 2) * R.spread);
            else enemyShots(e, R, a0 + rnd(-0.08, 0.08));
            Snd.play(R.snd || (R.type === 'acid' ? 'spit' : 'zap'), e.x, e.y);
          }
        }
        if (td < e.d.keep) { mvx = -tdx / td; mvy = -tdy / td; }
        else { mvx = -tdy / td * e.strafe * 0.6; mvy = tdx / td * e.strafe * 0.6; if (Math.random() < dt * 0.5) e.strafe *= -1; }
        if (!shieldOf(e)) e.face = Math.atan2(tdy, tdx); // 방패가 있으면 몸(방패)은 천천히 돌고 탄만 대상 쪽으로
      } else {
        const ex = tx - e.x, ey = ty - e.y, l = Math.hypot(ex, ey) || 1;
        mvx = ex / l; mvy = ey / l;
      }
      const Lb = e.d.lob; // 브루트: 다가오면서 가끔 녹색 구체를 던짐 (팔을 드는 예고 동작 뒤에 날아감)
      if (Lb) {
        e.lobCd = (e.lobCd ?? rnd(1, 2.5)) - dt;
        if (e.lobT > 0) { mvx *= 0.15; mvy *= 0.15; if (!shieldOf(e)) e.face = Math.atan2(tdy, tdx); if ((e.lobT -= dt) <= 0) { enemyShots(e, Lb, Math.atan2(tdy, tdx)); Snd.play('ballThrow', e.x, e.y); } }
        else if (tsee && td > Lb.min && td < Lb.range && e.lobCd <= 0) { e.lobT = Lb.wind; e.lobCd = Lb.rate * rnd(0.85, 1.15) * (e.atkMul || 1); e.atkT = ATK_ANIM; }
      }
      const Hp = e.d.hop; // 크롤러: 곧장 보이는 거리에서는 깡충깡충 뛰어 다가오다가 가까우면 크게 덮침 (안 보일 때는 길을 따라 기어 옴)
      if (Hp && td > e.r + T.r + 0.3 && (T !== p || (see && d <= 8))) {
        if (e.pounceCd === undefined) e.pounceCd = rnd(0.2, 0.8); // 처음 발견한 직후에는 바로 덮치지 않음 (대기시간은 위에서 매 프레임 줄어듦)
        if ((e.hopRest = (e.hopRest || 0) - dt) > 0) { mvx = mvy = 0; } // 착지 뒤 잠깐 멈춤
        else if (tsee && td < Hp.pounce && e.pounceCd <= 0) { startLeap(e, tdx, tdy, Hp.pv, Hp.pdur, Hp.ph, 'pounce'); e.pounceCd = Hp.pcd * (e.atkMul || 1); e.hopRest = rnd(...Hp.rest); Snd.mon(e, 'attack'); continue; }
        else if (mvx || mvy) { // 다음 칸을 지나치지 않을 만큼만 (모퉁이에 걸리지 않게)
          startLeap(e, mvx, mvy, Math.min(Hp.v, (Math.hypot(tx - e.x, ty - e.y) + 0.25) / Hp.dur) * (e.fast || 1), Hp.dur, Hp.h, 'hop'); e.hopRest = rnd(...Hp.rest); continue;
        }
      }
      if (td < e.r + T.r + 0.3) {
        mvx *= 0.2; mvy *= 0.2;
        if (e.acd <= 0) {
          e.acd = e.d.atkRate * (e.atkMul || 1) * (e.auraT > 0 ? ELITE_FX.aura.atk : 1); e.lunge = 0.15; e.atkT = ATK_ANIM; Snd.mon(e, 'attack');
          if (shieldOf(e)) e.guardDown = shieldOf(e).drop; // 방패: 칠 때는 방패가 내려감
          if (T.dev) hurtDevice(T, e.dmg, e.x, e.y);
          else if (T !== p) hurtSurvivor(T, e.dmg, e.x, e.y);
          else {
            const hurt = hurtPlayer(e.dmg, e.x, e.y);
            if (e.d.knock) { p.kx += dx / d * e.d.knock; p.ky += dy / d * e.d.knock; }
            if (buff('iron')?.thorns) { hitEnemy(e, e.dmg * 0.8); spark(e.x, e.y, 6, '#dde', 3); } // 가시 갑주: 되받음
            const TH = hurt && gearV('thorns'); // 고슴도치 (보석 조합): 근접 공격을 되돌려줌
            if (TH && !e.dead) { hitEnemy(e, e.dmg * TH); spark(e.x, e.y, 5, RW_COLOR, 3); }
            if (hurt && e.ambush) { e.ambush = false; e.flee = true; } // 그림자 추적자: 등 뒤 기습으로 한 대 치면 사라짐
          }
        }
      }
    } else {
      const h = e.homing && homeDir(e, dt); // 원래 자리로 돌아가는 중
      if (h) [mvx, mvy] = h;
      else {
        e.wander -= dt;
        if (e.wander <= 0) { e.wander = rnd(1, 3); const a = rnd(0, 6.28); const go = Math.random() < 0.5; e.wx = go ? Math.cos(a) : 0; e.wy = go ? Math.sin(a) : 0; }
        mvx = e.wx; mvy = e.wy; spdMul = 0.35;
      }
    }
    if (shieldOf(e) && e.aggro) { // 방패: react초마다 그때 대상이 있던 쪽(안 보이면 가는 쪽)을 정하고 그쪽으로 천천히 돌림 — 바로바로 따라오지 못함
      const SH = shieldOf(e), turn = SH.turn * dt * (e.fast || 1) * (e.slow > 0 ? 0.5 : 1);
      if ((e.guardT = (e.guardT || 0) - dt) <= 0) { e.guardT = SH.react * rnd(0.8, 1.2); e.guardA = tsee ? e.tgtA : (mvx || mvy) ? Math.atan2(mvy, mvx) : e.face; }
      e.face += clamp(angDiff(e.guardA ?? e.face, e.face), -turn, turn);
    } else if (mvx || mvy) {
      const ta = Math.atan2(mvy, mvx);
      if (!((e.d.ranged || e.d.keep) && tsee)) e.face += angDiff(ta, e.face) * Math.min(1, dt * 10);
    }
    const spd = e.d.spd * spdMul * (e.slow > 0 ? 0.5 : 1) * (e.rage ? 1.5 : 1) * (e.fast || 1) * (e.auraT > 0 ? ELITE_FX.aura.spd : 1);
    moveEntity(e, mvx * spd * dt, mvy * spd * dt);
    e.moving = !!(mvx || mvy);
    const S = ENEMY_STEP[e.type]; // 대형 몬스터 발걸음·크롤러가 긁는 소리 (들리는 거리 안에서 움직일 때)
    if (S && e.moving && d < S[2] && (e.stepT = (e.stepT || 0) - dt) <= 0) { e.stepT = S[1] * rnd(0.9, 1.1); Snd.play(S[0], e.x, e.y); }
    if (e.lunge > 0) e.lunge -= dt;
  }
  // 겹침 방지: 2칸 격자로 나눠 이웃 칸끼리만 비교 (적이 수백 마리여도 빠르게)
  const grid = new Map();
  enemies.forEach((e, i) => { e._i = i; if (e.dead || !e.awake || hiddenE(e)) return; const k = (Math.floor(e.y / 2) << 8) | Math.floor(e.x / 2); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(e); });
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.dead || !a.awake || hiddenE(a)) continue;
    const gx = Math.floor(a.x / 2), gy = Math.floor(a.y / 2);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cell = gx + ox >= 0 && gy + oy >= 0 && grid.get(((gy + oy) << 8) | (gx + ox));
      if (cell) for (const b of cell) {
        if (b._i <= i || b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d < m && d > 0.001) { // 고정된 보스(오버마인드)는 밀리지 않고 상대만 밀려남
          const pa = a.d.fixed ? 0 : b.d.fixed ? m - d : (m - d) / 2, pb = m - d - pa;
          moveEntity(a, -dx / d * pa, -dy / d * pa); moveEntity(b, dx / d * pb, dy / d * pb);
        }
      }
    }
    const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy), m = a.r + p.r;
    if (d < m && d > 0.001) { if (a.d.fixed) moveEntity(p, -dx / d * (m - d), -dy / d * (m - d)); else moveEntity(a, dx / d * (m - d), dy / d * (m - d)); }
    for (const s of survivors) { // 생존자와도 겹치지 않게 (둥지처럼 고정된 것이면 생존자가 비킴)
      if (s.state !== 'wait' && s.state !== 'follow') continue;
      const sx = a.x - s.x, sy = a.y - s.y, sd = Math.hypot(sx, sy), sm = a.r + s.r;
      if (sd < sm && sd > 0.001) { if (a.d.fixed) moveEntity(s, -sx / sd * (sm - sd), -sy / sd * (sm - sd)); else moveEntity(a, sx / sd * (sm - sd), sy / sd * (sm - sd)); }
    }
    for (const b of barrels) {
      if (b.dead) continue;
      const bx = a.x - b.x, by = a.y - b.y, bd = Math.hypot(bx, by), bm = a.r + b.r;
      if (bd < bm && bd > 0.001 && !a.fly && !a.d.fixed) moveEntity(a, bx / bd * (bm - bd), by / bd * (bm - bd));
    }
    for (const t of devices()) { // 포탑·테슬라 코일과도 겹치지 않게 (설치물은 밀리지 않음)
      const tx = a.x - t.x, ty = a.y - t.y, td = Math.hypot(tx, ty), tm = a.r + t.r;
      if (td < tm && td > 0.001 && !a.fly && !a.d.fixed) moveEntity(a, tx / td * (tm - td), ty / td * (tm - td));
    }
  }
  for (const b of barrels) {
    if (b.dead) continue;
    const bx = p.x - b.x, by = p.y - b.y, bd = Math.hypot(bx, by), bm = p.r + b.r;
    if (bd < bm && bd > 0.001) moveEntity(p, bx / bd * (bm - bd), by / bd * (bm - bd));
  }
  enemies = enemies.filter(e => !e.dead).concat(spawned);
  barrels = barrels.filter(b => !b.dead);
}

function updateProjectiles(dt) {
  for (const b of bullets) {
    if (b.delay > 0) { b.delay -= dt; b.x = b.px = player.x; b.y = b.py = player.y; continue; } // 미사일: 한 발씩 이어서 발사
    b.px = b.x; b.py = b.y;
    // 꼬리: 로켓·미사일 연기, 분쇄포 푸른 불티
    if ((b.kind === 'rocket' || b.kind === 'micro') && Math.random() < 0.8) smoke(b.x, b.y, 1, '140,130,120', 0.3);
    if (b.kind === 'bfg' && Math.random() < 0.9) parts.push({ x: b.x + rnd(-0.3, 0.3), y: b.y + rnd(-0.3, 0.3), z: rnd(10, 30), vx: rnd(-1, 1), vy: rnd(-1, 1), vz: rnd(-10, 30), g: 0, life: 0.5, max: 0.5, col: pick(['#9cf', '#cdf', '#fff']), size: 3, glow: true });
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 0.25)), sdt = dt / steps, blast = b.s.blast || b.blastR;
    for (let s = 0; s < steps && !b.dead; s++) {
      if (b.target) {
        if (b.target.dead || hiddenE(b.target)) b.target = b.turn ? nearestEnemy(b.x, b.y, 8) : null; // 미사일은 다음 적을 찾아감 (땅속으로 숨은 적도)
        else if (b.turn) { // 미사일: 초당 turn 라디안까지만 꺾으며 점점 빨라짐
          const cur = Math.atan2(b.vy, b.vx), na = cur + clamp(angDiff(Math.atan2(b.target.y - b.y, b.target.x - b.x), cur), -b.turn * sdt, b.turn * sdt), sp = Math.min(18, Math.hypot(b.vx, b.vy) + 30 * sdt);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        } else { const tx = b.target.x - b.x, ty = b.target.y - b.y, tl = Math.hypot(tx, ty) || 1, sp = Math.hypot(b.vx, b.vy); b.vx = tx / tl * sp; b.vy = ty / tl * sp; }
      }
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt;
      if (blocksShot(b.x, b.y)) {
        const hx = b.x - b.vx * sdt, hy = b.y - b.vy * sdt;
        if (b.bounce > 0) { // 도탄 사수: 막힌 쪽 축의 속도를 뒤집어 한 번 튕김 (튕긴 뒤에는 같은 적을 다시 맞힐 수 있음)
          b.bounce--;
          const fx = blocksShot(b.x, hy), fy = blocksShot(hx, b.y);
          if (fx || !fy) b.vx = -b.vx;
          if (fy || !fx) b.vy = -b.vy;
          b.x = hx; b.y = hy; b.hits = []; spark(hx, hy, 3, '#ffd27a', 3);
          continue;
        }
        if (blast) explodeShot(b, hx, hy);
        else { spark(hx, hy, 4); addFx(b.kind === 'plasma' ? 'plse' : 'puff', 'abcd', hx, hy, 20, 0.25, 0.8); }
        b.dead = true; break;
      }
      for (const e of enemies) {
        if (e.dead || hiddenE(e) || b.hits.includes(e)) continue; // 천장·땅속의 적은 지나침
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 0.1) {
          if (blast) { explodeShot(b, b.x, b.y); b.dead = true; break; } // 터지는 탄: 맞은 적 포함 주변 전체
          const l = Math.hypot(b.vx, b.vy);
          const res = weaponHit(e, b.s, b.dmg, b.vx / l * 1.2, b.vy / l * 1.2, b.force); b.hits.push(e);
          if (res === 'block') { b.dead = true; break; } // 방패에 막힌 탄은 거기서 멈춤
          if (b.kind === 'plasma') addFx('plse', 'abcde', b.x, b.y, 22, 0.25, 0.7);
          if (b.s.uq === 'blast') uniqueBlast(b, e.x, e.y); // 폭심: 꿰뚫은 자리마다 폭발
          if (b.jumps > 0) { // 과부하 코일: 보이는 가장 가까운 다음 적에게 튀어 감 (관통 횟수는 쓰지 않음)
            let nx = null, nd = 5;
            for (const o of enemies) { const d = Math.hypot(o.x - e.x, o.y - e.y); if (!o.dead && !b.hits.includes(o) && d < nd && los(e.x, e.y, o.x, o.y)) { nx = o; nd = d; } }
            if (nx) { b.jumps--; b.target = nx; b.life = Math.max(b.life, 0.8); beams.push({ x0: e.x, y0: e.y, x1: nx.x, y1: nx.y, t: 0.12, col: '120,180,255' }); continue; }
          }
          if (e === b.target) b.target = null; // 관통탄은 이후 직진
          if (b.pierce-- <= 0) { b.dead = true; break; }
        }
      }
      if (b.dead) break;
      for (const br of barrels) if (!br.dead && Math.hypot(br.x - b.x, br.y - b.y) < br.r + 0.08) { if (blast) explodeShot(b, b.x, b.y); else hitBarrel(br, b.dmg); b.dead = true; break; }
      if (b.life <= 0) { if (blast && !b.dead) explodeShot(b, b.x, b.y); b.dead = true; }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  const p = player;
  for (const s of eshots) {
    if (s.home) { // 처형자의 유도 미사일: 초당 home라디안까지 플레이어 쪽으로 꺾임
      const ca = Math.atan2(s.vy, s.vx), na = ca + clamp(angDiff(Math.atan2(p.y - s.y, p.x - s.x), ca), -s.home * dt, s.home * dt), sp = Math.hypot(s.vx, s.vy);
      s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
    }
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.type === 'rocket' && Math.random() < 0.7) smoke(s.x, s.y, 1, '120,110,100', 0.2);
    if (s.type === 'acid' && Math.random() < 0.5) parts.push({ x: s.x, y: s.y, z: 16, vx: 0, vy: 0, vz: -10, g: 0, life: 0.3, max: 0.3, col: '#bd2', size: 2 });
    if (s.type === 'fireball' && Math.random() < 0.6) fireBurst(s.x, s.y, 1, 0.3);
    if (safeAt(s.x, s.y)) { // 안전 지대 차단막에 막힘 (폭발도 없음) — 습격받는 거점이면 막이 깎임
      if (assault && assault.phase === 'fight' && !assault.broke && roomOf[Math.floor(s.y) * MW + Math.floor(s.x)] === assault.ri) { assault.hp -= s.dmg * 0.5; assault.hitT = 0.15; if (assault.hp <= 0) breakBarrier(assault); }
      s.dead = true; spark(s.x, s.y, 6, '#9df', 2.5); flashes.push({ x: s.x, y: s.y, r: 90, t: 0.15, max: 0.15, col: '120,210,255' }); Snd.play('armorHit', s.x, s.y); continue;
    }
    if (blocksShot(s.x, s.y) || s.life <= 0) { s.dead = true; spark(s.x, s.y, 4, s.type === 'acid' || s.type === 'ball' ? '#bd2' : '#9df', 2); shotImpact(s); continue; }
    if (Math.hypot(s.x - p.x, s.y - p.y) < p.r + 0.2 && p.dash <= 0 && !(p.inv > 0)) {
      s.dead = true;
      if (s.type === 'rocket') { shotImpact(s); continue; } // 로켓은 폭발 범위 피해만
      hurtPlayer(s.dmg, s.x - s.vx, s.y - s.vy); shotImpact(s);
      if (s.type === 'acid') { if (afflict('poison', 5)) msg('중독되었습니다! (해독제: 8)', '#9e4'); }
      else if (s.type === 'fireball') afflict('burn', 1.5);
      else if (s.type === 'shock' && afflict('shock', 2.5)) msg('감전! 이동속도 저하 (절연 패치: 9)', '#fd4');
    }
    if (!s.dead) for (const t of devices()) { // 포탑·테슬라 코일도 맞음
      if (t.hp <= 0 || Math.hypot(s.x - t.x, s.y - t.y) > t.r + 0.2) continue;
      s.dead = true;
      if (s.type !== 'rocket') hurtDevice(t, s.dmg, s.x - s.vx, s.y - s.vy);
      shotImpact(s); break;
    }
    if (!s.dead) for (const v of survivors) { // 동행 중인 생존자도 맞음
      if (v.state !== 'follow' || Math.hypot(s.x - v.x, s.y - v.y) > v.r + 0.2) continue;
      s.dead = true;
      if (s.type !== 'rocket') hurtSurvivor(v, s.dmg, s.x - s.vx, s.y - s.vy);
      shotImpact(s); break;
    }
  }
  eshots = eshots.filter(s => !s.dead);

  for (const g of grenades) {
    g.t += dt; const k = Math.min(1, g.t / g.dur);
    g.x = g.sx + (g.tx - g.sx) * k; g.y = g.sy + (g.ty - g.sy) * k; g.z = Math.sin(k * Math.PI) * (g.arc || 50) + (g.z0 ?? 14) * (1 - k);
    if (k >= 1) { g.dead = true; if (g.type === 'acid') acidSplash(g); else explode(g.type, g.x, g.y, g.scale || 1, g.own ? 1 + perkV('blast') : 1); } // scale: 벌집의 작은 폭탄, acid: 역병 거인의 독액
  }
  grenades = grenades.filter(g => !g.dead);

  for (const a of areas) {
    a.t -= dt;
    if (!a.foe) for (const e of enemies) { // foe: 보스가 만든 독 — 몬스터는 다치지 않음
      if (Math.hypot(e.x - a.x, e.y - a.y) > a.r) continue;
      if (a.type === 'gas') { e.poison = Math.max(e.poison, 1.5); hitEnemy(e, 10 * dt, 0, 0, true); }
      else { e.burn = Math.max(e.burn, 2); hitEnemy(e, 16 * dt, 0, 0, true); }
    }
    if (!a.safe && Math.hypot(p.x - a.x, p.y - a.y) < a.r) afflict(a.type === 'gas' ? 'poison' : 'burn', a.type === 'gas' ? 3 : 1.5); // safe: 내 스킬·맹독 살포기의 장판은 무해
    if (a.type === 'fire' && Math.random() < dt * 30) { const ang = rnd(0, 6.28), rr = rnd(0, a.r); fireBurst(a.x + Math.cos(ang) * rr, a.y + Math.sin(ang) * rr, 1, 0.4); }
  }
  areas = areas.filter(a => a.t > 0);
}

function updateMisc(dt) {
  for (const q of parts) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.vz -= q.g * dt; q.z += q.vz * dt; q.life -= dt;
    if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; }
  }
  parts = parts.filter(q => q.life > 0);
  if (parts.length > 1500) parts.splice(0, parts.length - 1500);
  for (const t of texts) { t.life -= dt; t.z += dt * 40; }
  texts = texts.filter(t => t.life > 0);
  for (const f of flashes) f.t -= dt;
  flashes = flashes.filter(f => f.t > 0);
  for (const b of beams) b.t -= dt;
  for (const f of fxs) f.t += dt;
  fxs = fxs.filter(f => f.t < f.dur);
  for (const c of corpses) c.t += dt;
  beams = beams.filter(b => b.t > 0);
  for (const m of msgs) m.life -= dt;
  msgs = msgs.filter(m => m.life > 0);
  if (autoNote > 0) autoNote -= dt;
  hurtFlash = Math.max(0, hurtFlash - dt * 1.5);
  hitFlash = Math.max(0, hitFlash - dt * 6);
  for (const h of hurtDirs) h.t -= dt;
  hurtDirs = hurtDirs.filter(h => h.t > 0);
  shake = Math.max(0, shake - dt * 30);
  shx = (Math.random() - 0.5) * shake * settings.shake; shy = (Math.random() - 0.5) * shake * settings.shake; // 설정의 화면 흔들림
  const tx = (player.x - player.y) * TW / 2, ty = (player.x + player.y) * TH / 2;
  const k = Math.min(1, dt * 8); cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
}

function update(dt) {
  gtime += dt;
  checkSets();
  updatePlayer(dt);
  if (state !== 'play') return;
  updateDoors(dt);
  updateEnemies(dt);
  updatePillars(dt);
  updateWaves(dt);
  if (rift) updateRift(dt);
  else if (!inBase) updateMission(dt);
  updateProjectiles(dt);
  if (escape) updateEscape(dt);
  if (!inBase) updateSkills(dt);
  updateMisc(dt);
  updateTips(dt);
  codexTick(dt);
  if (logNow && (logNow.t -= dt) <= 0) logNow = null;
  if (!inBase) { ambientTick(dt); heartbeat(dt); }
}

// ===== 분위기 소리: 장소별 환경음, 멀리서 들리는 기척·기계 소리, 체력이 낮을 때 심장 박동 =====
let ambT = 6, heartT = 0;
// 매 프레임: 지금 장소에 맞는 바람·기계음 (정전이면 기계가 멈추고, 죽거나 엔딩이면 조용히)
function updateAmbience() {
  if (!Snd.ctx) return;
  let A = state === 'title' ? AMBIENCE.title : inBase ? AMBIENCE.base : AMBIENCE.zones[(level - 1) % AMBIENCE.zones.length];
  if (state === 'dead' || state === 'ending') A = { wind: 0, hum: 0, freq: A.freq };
  else if (!inBase && isBlackout()) A = { wind: A.wind * 0.6, hum: 0, freq: A.freq };
  Amb.set(A.wind, A.hum, A.freq);
}
// 몇 초마다: 아직 플레이어를 모르는 먼 몬스터의 기척 (그 자리에서 들림), 없으면 기지 어딘가의 기계 소리
function ambientTick(dt) {
  if ((ambT -= dt) > 0 || !Snd.ctx) return;
  ambT = rnd(...AMBIENCE.gap);
  const p = player, [lo, hi] = AMBIENCE.far;
  const cand = enemies.filter(e => { const d = Math.hypot(e.x - p.x, e.y - p.y); return !e.aggro && !e.dead && ENEMY_SFX[e.type].idle && d > lo && d < hi; });
  if (cand.length && Math.random() < 0.6) { const e = pick(cand), S = ENEMY_SFX[e.type]; Snd.sample(S.idle, 0.9 * (S.vol || 1), rnd(0.85, 1.05) * (S.rate || 1), e.x, e.y, Snd.amb); return; } // 종류별 크기·높낮이
  const [n, v, r] = pick(AMBIENCE.noises), a = rnd(0, 6.28), d = rnd(6, 14);
  Snd.sample(n, v, r * rnd(0.9, 1.1), p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Snd.amb);
}
// 체력이 30% 밑이면 심장 박동 (15% 밑이면 더 빨리)
function heartbeat(dt) {
  const p = player;
  if (p.hp <= 0 || p.hp >= p.maxhp * 0.3) { heartT = 0; return; }
  if ((heartT -= dt) <= 0) { heartT = p.hp < p.maxhp * 0.15 ? 0.6 : 0.85; Snd.play('heart'); }
}

// ===== 첫 플레이 안내: 처음 만나는 것마다 한 번만 화면 왼쪽 아래 카드 (TIPS) =====
const TIPS_KEY = 'voidstation.tips.v1'; // 이미 본 안내 (저장 슬롯과 상관없이 이 브라우저에 기록)
let tipsSeen = new Set(), tipQueue = [], tipNow = null, tipGap = 0, tipWatchT = 0;
try { tipsSeen = new Set(JSON.parse(localStorage.getItem(TIPS_KEY)) || []); } catch (e) { /* 저장소를 못 쓰면 이번 실행에서만 기억 */ }
// 처음 보는 것이면 대기열에 (icon: 그림을 바꿀 때, 예: 떨어진 고유 전설의 무기 그림)
function tip(id, icon) {
  if (!settings.tips || tipsSeen.has(id) || (tipNow && tipNow.id === id) || tipQueue.some(q => q.id === id)) return;
  tipQueue.push({ id, icon: icon !== undefined ? icon : TIPS[id].icon });
}
function updateTips(dt) {
  if (tipNow && (tipNow.t -= dt) <= 0) { tipNow = null; tipGap = 0.6; }
  if (!tipNow && tipQueue.length && (tipGap -= dt) <= 0) { // 다음 안내 (보여 준 순간 본 것으로 기록)
    tipNow = { ...tipQueue.shift(), t: TIP_TIME, max: TIP_TIME };
    tipsSeen.add(tipNow.id);
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...tipsSeen])); } catch (e) { /* 이번 실행에서만 기억 */ }
    Snd.play('tip');
  }
  // 상황 살피기 (0.25초마다, 구역에서): 처음 보는 무기·정예·보스, 상태 이상, 스태미너 고갈, 낮은 체력
  if ((tipWatchT -= dt) > 0 || inBase || !settings.tips) return;
  tipWatchT = 0.25;
  const p = player, near = (o, r) => Math.hypot(o.x - p.x, o.y - p.y) < r && canSee(o.x, o.y);
  if (pickups.some(it => it.kind === 'weapon' && it.inst.kind !== 'gem' && near(it, 4))) tip('loot');
  if (enemies.some(e => e.elite && near(e, 10))) tip('elite');
  if (enemies.some(e => e.d.armor && near(e, 10))) tip('armor');
  if (enemies.some(e => e.d.shield && near(e, 9))) tip('shielder');
  if (enemies.some(e => e.d.bomb && near(e, 9))) tip('bomber');
  if (enemies.some(e => e.d.raise && near(e, 11))) tip('summoner');
  if (boss && boss.aggro && !boss.dead) tip('boss');
  if (p.fx.poison > 0) tip('poison');
  if (p.fx.shock > 0) tip('shock');
  if (p.exhausted) tip('stamina');
  if (p.hp < p.maxhp * 0.4) tip('lowhp');
}
function closeTip() { if (tipNow) { tipNow = null; tipGap = 0.4; Snd.play('menu'); } }
function resetTips() { tipsSeen = new Set(); tipQueue = []; tipNow = null; try { localStorage.removeItem(TIPS_KEY); } catch (e) { /* 이번 실행에서만 */ } }
// 띄어쓰기 기준으로 maxW 픽셀 안에 들어가게 줄바꿈 (지금 글꼴 기준)
function wrapPx(text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
// 안내 카드: 그림 + 제목 + 설명, 남은 시간 막대 (나타날 때·사라질 때 흐려짐)
function drawTip() {
  const T = tipNow;
  if (!T || state !== 'play' || perkOpen) return;
  const D = TIPS[T.id], icon = T.icon && META.frames[T.icon] ? T.icon : null, w = Math.min(440, W - 28), tx = icon ? 76 : 16;
  ctx.font = '13px sans-serif';
  const lines = D.lines.flatMap(l => wrapPx(l, w - tx - 14)), h = 46 + lines.length * 19 + 16, x = 14, y = VH - h - 34;
  ctx.globalAlpha = clamp(Math.min((T.max - T.t) / 0.25, T.t / 0.5), 0, 1);
  ctx.fillStyle = 'rgba(16,14,10,0.93)'; rr(x, y, w, h, 7); ctx.fill();
  ctx.strokeStyle = '#c9a03a'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
  if (icon) { ctx.fillStyle = 'rgba(255,210,120,0.07)'; ctx.fillRect(x + 12, y + 14, 52, 52); drawIcon(icon, x + 15, y + 17, 46, 46); }
  ctx.textAlign = 'left'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#ffd27a'; ctx.fillText(`안내 · ${D.title}`, x + tx, y + 26);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#e8dcc0';
  lines.forEach((l, k) => ctx.fillText(l, x + tx, y + 48 + k * 19));
  ctx.textAlign = 'right'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#8a8270'; ctx.fillText('[H] 닫기 · 설정에서 끌 수 있음', x + w - 12, y + h - 9);
  ctx.fillStyle = 'rgba(201,160,58,0.55)'; ctx.fillRect(x + 8, y + h - 4, (w - 16) * clamp(T.t / T.max, 0, 1), 2);
  ctx.globalAlpha = 1;
}

// ===== 렌더링 =====
function diamond(sx, sy) {
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + TW / 2, sy + TH / 2); ctx.lineTo(sx, sy + TH); ctx.lineTo(sx - TW / 2, sy + TH / 2); ctx.closePath();
}
function isoEllipse(x, y, r, z = 0) { ctx.beginPath(); ctx.ellipse(PX(x, y), PY(x, y) - z, r * 45, r * 22.6, 0, 0, Math.PI * 2); }
function circle(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function drawShadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; isoEllipse(x, y, r); ctx.fill(); }

// --- 스프라이트 (아틀라스) ---
// Doom식 8방향: 월드 각도 face를 화면 시점에 맞는 회전 번호(0~7)로
const rotIndex = face => ((Math.floor((337.5 + face * 180 / Math.PI) / 45) % 8) + 8) % 8;
// 프레임을 원점(발밑)이 (x, y)에 오도록 그리고, 그림 윗변의 y를 돌려준다
function drawFrame(key, x, y, scale = 1, flip = false) {
  const f = META.frames[key];
  if (!f || !ART.ready) return y;
  const [sx, sy, w, h, ox, oy] = f;
  ctx.imageSmoothingEnabled = scale < 1;
  if (flip) {
    ctx.setTransform(-scale, 0, 0, scale, x, y);
    ctx.drawImage(ART.atlas, sx, sy, w, h, -ox, -oy, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else ctx.drawImage(ART.atlas, sx, sy, w, h, x - ox * scale, y - oy * scale, w * scale, h * scale);
  ctx.imageSmoothingEnabled = true;
  return y - oy * scale;
}
function drawSprite(pre, frame, x, y, face = 0, scale = 1) {
  const fr = META.sprites[pre] && META.sprites[pre][frame];
  if (!fr) return y;
  const [key, flip] = fr[rotIndex(face)];
  return drawFrame(key, x, y, scale, flip);
}
// 아래 가운데를 (x, y)에 맞춰 그리기 (바닥 아이템)
function drawBottom(key, x, y, scale) {
  const f = META.frames[key];
  if (!f || !ART.ready) return;
  const [sx, sy, w, h] = f;
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(ART.atlas, sx, sy, w, h, x - w * scale / 2, y - h * scale, w * scale, h * scale);
  ctx.imageSmoothingEnabled = true;
}
// 회전한 아이콘 (가운데 기준): 날아가는 칼날, 도는 톱날
function drawSpin(key, x, y, ang, w, h) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); drawIcon(key, -w / 2, -h / 2, w, h); ctx.restore(); }
// 상자 안에 비율을 유지해 가운데 맞추기 (HUD·인벤토리 아이콘)
function drawIcon(key, x, y, w, h) {
  const f = META.frames[key];
  if (!f || !ART.ready) return;
  const [sx, sy, fw, fh] = f, k = Math.min(w / fw, h / fh);
  ctx.imageSmoothingEnabled = k < 1;
  ctx.drawImage(ART.atlas, sx, sy, fw, fh, x + (w - fw * k) / 2, y + (h - fh * k) / 2, fw * k, fh * k);
  ctx.imageSmoothingEnabled = true;
}

// --- 바닥: FCH x FCH 칸 조각마다 처음 보일 때 한 번 그려 두고 씀 (넓은 필드를 한 장에 그리면 너무 큼) ---
const FCH = 12, FCH_OX = FCH * TW / 2 + TW / 2; // 조각 캔버스에서 조각 첫 칸이 놓이는 x
let floorChunks = new Map();                      // 조각 번호 → 캔버스 (오래 안 본 것부터 버림)
function floorTexAt(i, j) {
  const k = j * MW + i;
  if (tiles[k] === T.EXIT) return 'flat_gate4';
  if (roomOf[k] >= 0) return 'flat_' + rooms[roomOf[k]].flat;
  return 'flat_' + (regionMap && regionMap[k] ? themeOf(regionMap[k]) : levelTheme).corridor; // 통로: 그 구역 테마
}
function bakeChunk(ci, cj) {
  const c = document.createElement('canvas'), i0 = ci * FCH, j0 = cj * FCH;
  c.width = FCH * TW + TW; c.height = FCH * TH + TH;
  const g = c.getContext('2d'), groups = {};
  const tilePath = (i, j) => {
    const x = (i - i0 - (j - j0)) * TW / 2 + FCH_OX, y = (i - i0 + j - j0) * TH / 2;
    g.moveTo(x, y); g.lineTo(x + TW / 2, y + TH / 2); g.lineTo(x, y + TH); g.lineTo(x - TW / 2, y + TH / 2); g.closePath();
  };
  for (let j = j0; j < Math.min(MH, j0 + FCH); j++) for (let i = i0; i < Math.min(MW, i0 + FCH); i++) {
    if (isWallT(tiles[j * MW + i])) continue;
    const key = floorTexAt(i, j);
    (groups[key] = groups[key] || []).push([i, j]);
  }
  // 같은 텍스처의 타일을 한 경로로 묶어 패턴으로 채움 (패턴은 월드 기준이라 조각 경계에 이음매가 생기지 않음)
  for (const key in groups) {
    const tex = ART.tex[key];
    if (!tex) continue;
    const pat = g.createPattern(tex, 'repeat');
    pat.setTransform(new DOMMatrix([TW / 2 / tex.width, TH / 2 / tex.width, -TW / 2 / tex.height, TH / 2 / tex.height, FCH_OX + (j0 - i0) * TW / 2, -(i0 + j0) * TH / 2]));
    g.fillStyle = pat; g.beginPath();
    for (const [i, j] of groups[key]) tilePath(i, j);
    g.fill();
  }
  // 타일마다 밝기를 조금씩 다르게 + 옅은 이음선
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
  for (const key in groups) for (const [i, j] of groups[key]) {
    g.beginPath(); tilePath(i, j);
    g.fillStyle = `rgba(0,0,0,${(hash(i, j) * 0.2).toFixed(3)})`; g.fill(); g.stroke();
  }
  return c;
}
function floorChunk(ci, cj) {
  const key = cj * 1000 + ci;
  let c = floorChunks.get(key);
  if (c) { floorChunks.delete(key); floorChunks.set(key, c); return c; } // 최근에 본 것으로
  if (!ART.ready) return null;
  c = bakeChunk(ci, cj); floorChunks.set(key, c);
  if (floorChunks.size > 40) floorChunks.delete(floorChunks.keys().next().value);
  return c;
}
function drawFloor() {
  const { i0, i1, j0, j1 } = visibleBounds(), cw = FCH * TW + TW, ch = FCH * TH + TH;
  for (let cj = Math.floor(j0 / FCH); cj <= Math.floor(j1 / FCH); cj++) for (let ci = Math.floor(i0 / FCH); ci <= Math.floor(i1 / FCH); ci++) {
    const sx = Math.round(PX(ci * FCH, cj * FCH) - FCH_OX), sy = Math.round(PY(ci * FCH, cj * FCH));
    if (sx > W || sy > VH || sx + cw < 0 || sy + ch < 0) continue;
    const c = floorChunk(ci, cj);
    if (c) ctx.drawImage(c, sx, sy);
  }
  drawPads();
}
// 안전 지대 차단막: 거점 입구에 아른거리는 푸른 막 (아래가 진하고 위로 옅어짐, 옆으로 흐르는 세로 결, 위로 오르는 줄)
const BARRIER_H = 58;
function drawBarrier(b, hub) {
  if (hub && hub.broken) return; // 거점 습격으로 꺼진 안전막
  const ax = PX(b.x0, b.y0), ay = PY(b.x0, b.y0), bx = PX(b.x1, b.y1), by = PY(b.x1, b.y1);
  if (Math.max(ax, bx) < -20 || Math.min(ax, bx) > W + 20 || Math.max(ay, by) < 0 || Math.min(ay, by) - BARRIER_H > VH) return;
  const A = hub && assault && assault.hub === hub && assault.phase === 'fight' ? assault : null, hot = A ? 1 - A.hp / A.max : 0, hit = A && A.hitT > 0 && Math.random() < 0.6; // 습격 중: 깎일수록 붉게, 맞을 때 번쩍
  const C = (r, g2, b2) => `${Math.round(r + (255 - r) * hot)},${Math.round(g2 + (80 - g2) * hot)},${Math.round(b2 + (60 - b2) * hot)}`, c1 = C(120, 210, 255), c2 = C(160, 225, 255), c3 = C(190, 235, 255), c4 = C(150, 225, 255);
  const H = BARRIER_H, pulse = hit ? 1.6 : 0.5 + 0.5 * Math.sin(gtime * (A ? 9 : 4) + b.d), g = ctx.createLinearGradient(0, Math.max(ay, by), 0, Math.min(ay, by) - H);
  g.addColorStop(0, `rgba(${c1},${0.34 + 0.1 * pulse})`); g.addColorStop(0.6, `rgba(${c1},0.1)`); g.addColorStop(1, `rgba(${c1},0.02)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - H); ctx.lineTo(ax, ay - H); ctx.closePath(); ctx.fill();
  const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0), n = Math.round(len * 5); // 세로 결: 한 칸에 다섯 줄, 옆으로 천천히 흐름
  ctx.lineWidth = 1;
  for (let k = 0; k < n; k++) {
    const t = ((k + gtime * 0.8) % n) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, top = H * (0.55 + 0.45 * Math.abs(Math.sin(k * 1.7 + gtime * 2)));
    ctx.strokeStyle = `rgba(${c2},${0.22 + 0.18 * Math.sin(k * 2.3 + gtime * 5)})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - top); ctx.stroke();
  }
  const s = (gtime * 0.6 + b.d * 0.37) % 1; // 위로 오르는 줄
  ctx.strokeStyle = `rgba(${c3},${0.6 * (1 - s)})`;
  ctx.beginPath(); ctx.moveTo(ax, ay - H * s); ctx.lineTo(bx, by - H * s); ctx.stroke();
  ctx.strokeStyle = `rgba(${c4},${Math.min(1, 0.8 + 0.2 * pulse)})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.lineWidth = 1;
}
// --- 벽 / 상자: 텍스처를 면 모양대로 기울여 붙임 ---
// 텍스처의 (u0, v0)부터 64 x vh 영역을, (x0, y0)에서 (dx, dy) 방향으로 뻗은 높이 h의 면에 그린다
function texFace(tex, x0, y0, dx, dy, u0, v0, vh, h, shade) {
  ctx.setTransform(dx / 64, dy / 64, 0, h / vh, x0, y0 - h);
  ctx.drawImage(tex, u0, v0, 64, vh, 0, 0, 64, vh);
  if (shade) { ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, 0, 64, vh); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function drawWall(i, j, alpha) {
  const tex = ART.tex[wallTex[j * MW + i]];
  if (!tex) return;
  ctx.globalAlpha = alpha;
  if (!isWallT(tileAt(i, j + 1))) texFace(tex, PX(i, j + 1), PY(i, j + 1), TW / 2, TH / 2, (i * 64) % tex.width, 0, tex.height, WALLH, 0.12);
  if (!isWallT(tileAt(i + 1, j))) texFace(tex, PX(i + 1, j + 1), PY(i + 1, j + 1), TW / 2, -TH / 2, ((MH - j) * 64) % tex.width, 0, tex.height, WALLH, 0.38);
  diamond(PX(i, j), PY(i, j) - WALLH);
  ctx.fillStyle = ART.topPat || '#1e1712'; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawCrate(i, j) {
  const tex = ART.tex.wall_crate2, top = ART.tex.flat_cratop2, h = 34, s = 0.8;
  if (!tex || !top) return;
  // 맞으면 잠깐 흔들리고, 많이 맞을수록 어두워짐
  const k = j * MW + i, jx = crateHitT.get(k) > gtime ? rnd(-0.05, 0.05) : 0, jy = jx ? rnd(-0.05, 0.05) : 0, dmg = 1 - (crateHp.get(k) ?? CRATE_HP) / CRATE_HP;
  const x0 = i + 0.1 + jx, y0 = j + 0.1 + jy, x1 = i + 0.9 + jx, y1 = j + 0.9 + jy, vh = Math.min(64, tex.height);
  texFace(tex, PX(x0, y1), PY(x0, y1), TW / 2 * s, TH / 2 * s, 0, 0, vh, h, 0.12 + dmg * 0.35);
  texFace(tex, PX(x1, y1), PY(x1, y1), TW / 2 * s, -TH / 2 * s, 0, 0, vh, h, 0.38 + dmg * 0.3);
  ctx.setTransform(TW / 2 * s / top.width, TH / 2 * s / top.width, -TW / 2 * s / top.height, TH / 2 * s / top.height, PX(x0, y0), PY(x0, y0) - h);
  ctx.drawImage(top, 0, 0);
  if (dmg > 0) { ctx.fillStyle = `rgba(0,0,0,${dmg * 0.4})`; ctx.fillRect(0, 0, top.width, top.height); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
// 자동문: 열릴수록 아랫부분부터 천장으로 올라감 (Doom식). 보안문은 양 끝에 색 표시등, 윗면도 그 색
function drawDoor(i, j) {
  const k = j * MW + i, d = doors[doorOf[k]], tex = (d.key === 'vault' && ART.tex.wall_bronze1) || ART.tex.wall_bigdoor2; // 금고 문은 청동
  if (!tex || d.open >= 0.99) return;
  const b = WALLH * d.open, h = WALLH - b, v0 = tex.height * d.open, vh = tex.height - v0;
  const same = (ii, jj) => tileAt(ii, jj) === T.DOOR && doorOf[jj * MW + ii] === doorOf[k];
  const strip = (d.key && ART.tex[KEYCARDS[d.key].tex]) || (d.gate && ART.tex.wall_doorred), SW = 0.22; // 보안문 색 표시등, 봉쇄 격벽은 붉게
  if (!same(i, j + 1) && !isWallT(tileAt(i, j + 1))) {
    texFace(tex, PX(i, j + 1), PY(i, j + 1) - b, TW / 2, TH / 2, (i * 64) % tex.width, v0, vh, h, 0.1);
    if (strip && !same(i - 1, j)) stripFace(strip, i, j + 1, i + SW, j + 1, b, d.open, 0.1);
    if (strip && !same(i + 1, j)) stripFace(strip, i + 1 - SW, j + 1, i + 1, j + 1, b, d.open, 0.1);
  }
  if (!same(i + 1, j) && !isWallT(tileAt(i + 1, j))) {
    texFace(tex, PX(i + 1, j + 1), PY(i + 1, j + 1) - b, TW / 2, -TH / 2, ((MH - j) * 64) % tex.width, v0, vh, h, 0.35);
    if (strip && !same(i, j + 1)) stripFace(strip, i + 1, j + 1, i + 1, j + 1 - SW, b, d.open, 0.35);
    if (strip && !same(i, j - 1)) stripFace(strip, i + 1, j + SW, i + 1, j, b, d.open, 0.35);
  }
  diamond(PX(i, j), PY(i, j) - WALLH);
  ctx.fillStyle = '#262a30'; ctx.fill();
  if (d.key) { ctx.fillStyle = `rgba(${KEYCARDS[d.key].rgb},${d.locked ? 0.55 : 0.25})`; ctx.fill(); }
  else if (d.gate) { ctx.fillStyle = `rgba(255,110,40,${0.45 + 0.2 * Math.sin(gtime * 4)})`; ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
}
// 좁은 텍스처를 월드 (x0, y0)→(x1, y1) 구간의 문 면에 세워 붙임 (b: 올라간 높이, open: 열린 비율)
function stripFace(tex, x0, y0, x1, y1, b, open, shade) {
  const sx = PX(x0, y0), sy = PY(x0, y0) - b, v0 = tex.height * open, vh = tex.height - v0, h = WALLH - b;
  ctx.setTransform((PX(x1, y1) - sx) / tex.width, (PY(x1, y1) - b - sy) / tex.width, 0, h / vh, sx, sy - h);
  ctx.drawImage(tex, 0, v0, tex.width, vh, 0, 0, tex.width, vh);
  ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, 0, tex.width, vh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
// 기지 단말기: 컴퓨터 패널 텍스처를 붙인 콘솔
function drawTerminal(i, j) {
  const tex = ART.tex.wall_compsta1, h = 46, s = 0.84;
  if (!tex) return;
  const x0 = i + 0.08, y0 = j + 0.08, x1 = i + 0.92, y1 = j + 0.92;
  texFace(tex, PX(x0, y1), PY(x0, y1), TW / 2 * s, TH / 2 * s, 0, 0, tex.height, h, 0.05);
  texFace(tex, PX(x1, y1), PY(x1, y1), TW / 2 * s, -TH / 2 * s, 64, 0, tex.height, h, 0.3);
  ctx.beginPath();
  ctx.moveTo(PX(x0, y0), PY(x0, y0) - h); ctx.lineTo(PX(x1, y0), PY(x1, y0) - h); ctx.lineTo(PX(x1, y1), PY(x1, y1) - h); ctx.lineTo(PX(x0, y1), PY(x0, y1) - h); ctx.closePath();
  ctx.fillStyle = '#2b3036'; ctx.fill(); ctx.strokeStyle = 'rgba(150,200,255,0.4)'; ctx.stroke();
}
// 단말기 이름표 + 가까우면 [F] 안내 (조명 뒤에 그림)
function drawTerminalLabels() {
  drawSpotLabels();
  const near = nearestTerminal();
  ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif';
  for (const t of terminals) {
    if (!inBase && !canSee(t.i + 0.5, t.j + 0.5)) continue; // 구역의 해킹 단말기는 보일 때만
    const x = PX(t.i + 0.5, t.j + 0.5), y = PY(t.i + 0.5, t.j + 0.5) - 62, w = ctx.measureText(t.name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - w / 2 - 5, y - 13, w + 10, 18);
    ctx.fillStyle = `rgb(${t.col})`; ctx.fillText(t.name, x, y);
    if (t === near) { ctx.fillStyle = '#ffd27a'; ctx.fillText(t.kind === 'hack' ? '[F] 해킹 시작' : t.kind === 'armory' ? '[F] 무기고 해제' : '[F] 사용', x, y - 18); }
    else if (t.kind === 'armory' && t.state !== 'idle') { ctx.fillStyle = t.state === 'done' ? '#9f9' : '#ffd27a'; ctx.fillText(t.state === 'done' ? '해제됨' : `해제 ${Math.floor(t.prog / t.A.time * 100)}%`, x, y - 18); }
    else if (t.kind === 'hack' && t.m && t.m.on) { const M = t.m; ctx.fillStyle = M.done ? '#9f9' : '#8ff0e0'; ctx.fillText(M.done ? '해킹 완료' : `데이터 전송 ${Math.floor(M.prog / M.time * 100)}%`, x, y - 18); }
  }
}
function drawPipe(i, j, alongX) {
  const z = 16, R = 13;
  const x0 = alongX ? i : i + 0.5, y0 = alongX ? j + 0.5 : j, x1 = alongX ? i + 1 : i + 0.5, y1 = alongX ? j + 0.5 : j + 1;
  const ax = PX(x0, y0), ay = PY(x0, y0), bx = PX(x1, y1), by = PY(x1, y1);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(ax, ay + 4); ctx.lineTo(bx, by + 4); ctx.stroke();
  const line = (w, c, off) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(ax, ay - z + off); ctx.lineTo(bx, by - z + off); ctx.stroke(); };
  line(R * 2, '#4a2412', 0); line(R * 1.5, '#7a3e1e', -2); line(6, '#a86438', -7); line(2, '#d09060', -9);
  // 축 단면 타원 (플랜지/끝)
  const ring = (cx, cy, fill, stroke) => {
    const ux = alongX ? -0.89 : 0.89, uy = 0.45;
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) { const t = k / 16 * Math.PI * 2; const px = cx + Math.cos(t) * ux * R * 1.1, py = cy - z + Math.cos(t) * uy * R * 1.1 - Math.sin(t) * R * 1.1; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
  };
  if (hash(i * 3, j * 5) < 0.35) ring((ax + bx) / 2, (ay + by) / 2, null, '#5a2c14');
  const nextT = alongX ? tileAt(i + 1, j) : tileAt(i, j + 1);
  const prevT = alongX ? tileAt(i - 1, j) : tileAt(i, j - 1);
  const pt = alongX ? T.PIPEX : T.PIPEY;
  if (nextT !== pt) { ring(bx, by, '#2a120a', '#8a4a26'); ring(bx, by, '#0e0604', null); }
  if (prevT !== pt) ring(ax, ay, '#6a3418', '#8a4a26');
}

// --- 캐릭터 / 몬스터 ---
// spr: Freedoom 스프라이트, walk/attack/pain/death: 동작별 프레임 글자, z: 떠 있는 높이
const ENEMY_ART = {
  crawler: { spr: 'bspi', scale: 0.5, walk: 'abcdef', attack: 'gh', pain: 'i', death: 'jklmnop' },
  runner:  { spr: 'bspr', scale: 0.42, walk: 'abcdef', attack: 'gh', pain: 'i', death: 'jklmnop' }, // 붉은 변종, 조금 작게
  xenoid:  { spr: 'troo', scale: 1, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklm' },
  spitter: { spr: 'skel', scale: 0.9, walk: 'abcdef', attack: 'jk', pain: 'l', death: 'lmnopq' },
  sparker: { spr: 'head', scale: 0.6, walk: 'a', attack: 'bcd', pain: 'e', death: 'ghijkl', z: 22 },
  brute:   { spr: 'boss', scale: 1, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklmno' },
  titan:      { spr: 'cybr', scale: 1.15, walk: 'abcd', attack: 'ef', pain: 'g', death: 'hijklmnop' },
  hivemother: { spr: 'spid', scale: 0.8, walk: 'abcdef', attack: 'gh', pain: 'i', death: 'jklmnopqrs' },
  overmind:   { spr: 'bbrn', scale: 1.4, walk: 'a', attack: 'a', pain: 'b', death: 'b' }, // 시체 없이 터짐
  charger: { spr: 'sarg', scale: 0.95, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklmn' },
  gunner:  { spr: 'cpos', scale: 0.95, walk: 'abcd', attack: 'ef', pain: 'g', death: 'hijklmn' },
  brooder: { spr: 'pain', scale: 0.75, walk: 'abc', attack: 'def', pain: 'g', death: 'hijklm', z: 26 },
  mortar:  { spr: 'fatt', scale: 1.15, walk: 'abcdef', attack: 'ghi', pain: 'j', death: 'klmnopqrst', blob: 1.5 }, // blob: 시야 영역 크기 배율 (큰 몸)
  nest:    { spr: 'col5', scale: 1.15, walk: 'ab', attack: 'b', pain: 'b', death: 'a', idle: 2.2 }, // idle: 제자리에서 꿈틀거리는 속도 (시체 없이 터짐)
  juggernaut: { spr: 'bos2', scale: 1.3, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklmno', blob: 1.4 },
  watcher: { spr: 'vile', scale: 0.95, walk: 'abc', attack: 'ghijklmno', pain: 'q', death: 'rstuvwxyz', idle: 1.4 }, // 불기둥을 부르는 동작은 castT
  shielder: { spr: 'cpsh', scale: 1, walk: 'abcd', attack: 'ef', pain: 'g', death: 'hijklmn' },          // 푸른 감염 해병 (색 변종) — 방패는 drawShield
  bomber:   { spr: 'skul', scale: 0.8, walk: 'ab', attack: 'c', pain: 'c', death: 'c', z: 20 },            // 불붙은 해골 — 터지면서 사라짐 (시체 없음)
  assassin: { spr: 'sasn', scale: 0.9, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklmn' },        // 보랏빛 차저 (색 변종) — 거의 투명
  summoner: { spr: 'vsum', scale: 0.95, walk: 'abc', attack: 'ghijkl', pain: 'q', death: 'rstuvwxyz' },  // 초록빛 감시자 (색 변종) — 되살리는 주문은 castT
  // 구역 보스 (색 변종을 크게)
  crusher:     { spr: 'bsar', scale: 1.9, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklmn' },
  broodmother: { spr: 'bpai', scale: 1.5, walk: 'abc', attack: 'def', pain: 'g', death: 'hijklm', z: 30 },
  argus:       { spr: 'bhea', scale: 1.7, walk: 'a', attack: 'bcd', pain: 'e', death: 'ghijkl', z: 26 },
  plaguegiant: { spr: 'bfat', scale: 1.6, walk: 'abcdef', attack: 'ghi', pain: 'j', death: 'klmnopqrst' },
  voidpriest:  { spr: 'bvil', scale: 1.25, walk: 'abc', attack: 'ghijklmno', pain: 'q', death: 'rstuvwxyz' },
  executioner: { spr: 'bske', scale: 1.45, walk: 'abcdef', attack: 'jk', pain: 'l', death: 'lmnopq' },
  thief:       { spr: 'sthf', scale: 1, walk: 'abcd', attack: 'a', pain: 'h', death: 'ijlm' }, // 금빛 제복의 승무원 (색 변종)
  lurker:   { spr: 'blrk', scale: 0.8, walk: 'abcdef', attack: 'gh', pain: 'i', death: 'jklmnop' }, // 어두운 보랏빛 크롤러 (색 변종) — 천장에서 떨어짐
  burrower: { spr: 'tbur', scale: 1, walk: 'abcd', attack: 'efg', pain: 'h', death: 'ijklm' },        // 흙빛 제노이드 (색 변종) — 땅속을 파고 다님
  warden:   { spr: 'fskw', scale: 0.75, walk: 'abc', attack: 'abc', pain: 'a', death: 'a', z: 34, idle: 8 }, // 푸른 기계 해골 (색 변종) — 보호막을 씌움
};
function drawPlayer() {
  const p = player, sx = PX(p.x, p.y), sy = PY(p.x, p.y), w = curW().s;
  drawShadow(p.x, p.y, 0.3);
  if (p.fx.curse > 0) { ctx.strokeStyle = `rgba(150,90,255,${0.5 + 0.3 * Math.sin(gtime * 8)})`; ctx.lineWidth = 2; isoEllipse(p.x, p.y, 0.5); ctx.stroke(); ctx.lineWidth = 1; } // 저주: 발밑에 보라 고리
  const face = w.type === 'gun' && p.target && !p.target.dead ? Math.atan2(p.target.y - p.y, p.target.x - p.x) : p.aim;
  let fr = 'a';
  if (state === 'dead') fr = 'hijklmn'[Math.min(6, Math.floor(p.deathT / 0.12))];
  else if (p.painT > 0) fr = 'g';
  else if (p.fireT > 0) fr = p.fireT > 0.07 ? 'f' : 'e';
  else if (p.moving) fr = 'abcd'[Math.floor(p.walk * 0.7) % 4];
  ctx.globalAlpha = p.dash > 0 ? 0.55 : buff('cloak') ? 0.25 + 0.08 * Math.sin(gtime * 6) : 1; // 은신: 거의 투명
  if (p.hitT > 0) ctx.filter = 'sepia(1) saturate(7) hue-rotate(-50deg) brightness(1.15)'; // 맞은 순간 붉게
  else if (buff('berserk')) ctx.filter = 'sepia(0.8) saturate(3) hue-rotate(-30deg) brightness(1.1)'; // 광폭화: 붉은 기운
  else if (buff('iron')) ctx.filter = 'grayscale(1) brightness(1.3) contrast(1.25)'; // 강철 피부: 금속빛
  drawSprite('play', fr, sx, sy, face);
  ctx.filter = 'none'; ctx.globalAlpha = 1;
  // 근접 휘두르기 궤적 (진압봉은 푸른빛, 플라즈마 블레이드는 굵은 청록, 체인톱은 앞쪽에 떨리는 톱니)
  if (w.type === 'melee' && p.swing > 0) {
    const prog = 1 - p.swing / p.swingMax, n = w.saw ? 14 : 12;
    if (w.saw) { ctx.strokeStyle = `rgba(255,190,110,${0.5 + 0.3 * Math.random()})`; ctx.lineWidth = 3; }
    else { ctx.strokeStyle = `rgba(${w.reflect ? '120,230,255' : w.chain ? '150,200,255' : '255,255,255'},${(w.reflect ? 0.7 : 0.5) * (1 - prog)})`; ctx.lineWidth = w.reflect ? 6 : 4; }
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = p.aim - w.arc / 2 + w.arc * (w.saw ? 1 : prog) * (k / n), r = w.saw ? w.range * (k % 2 ? 0.8 : 1) + rnd(-0.05, 0.05) : w.range;
      const x = PX(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r), y = PY(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) - 18;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}
function drawEnemy(e) {
  const A = ENEMY_ART[e.type], sx = PX(e.x, e.y), sy = PY(e.x, e.y), sc = A.scale * (e.super ? 1.3 : e.elite ? ELITE.scale : e.small ? 0.8 : 1) * (e.fuse > 0 ? 1 + 0.35 * (1 - e.fuse / e.d.bomb.fuse) : 1); // 불붙은 폭주 해골은 부풀어 오름
  const z = (A.z ? A.z + Math.sin(e.anim * 3) * 3 : 0) + (e.z || 0); // 떠다니는 높이 + 뛰어오른 높이
  const gh = ghost(e) ? (Math.hypot(e.x - player.x, e.y - player.y) < 2.2 ? 0.4 : 0.13) + 0.06 * Math.sin(gtime * 7 + e.anim) : 1; // 그림자 추적자: 거의 투명 (곁에 오면 조금 보임)
  if (e.ceil) { // 매복자: 천장 — 바닥에 옅은 그림자만 (떨어지기 직전에는 짙고 커짐)
    const k = e.dropT > 0 ? 1 - e.dropT / e.d.ceiling.warn : 0;
    ctx.fillStyle = `rgba(25,0,35,${0.12 + 0.05 * Math.sin(gtime * 2 + e.anim) + 0.5 * k})`; isoEllipse(e.x, e.y, e.r * (1.3 + 1.3 * k)); ctx.fill();
    return;
  }
  if (e.under || e.riseT > 0) { // 굴착자: 땅속 — 움직이는 흙더미 (솟기 직전에는 커지며 흔들리고 금이 감)
    const k = e.riseT > 0 ? 1 - e.riseT / e.d.burrow.warn : 0, j = k * Math.sin(gtime * 60) * 0.05;
    ctx.fillStyle = 'rgba(50,36,20,0.9)'; isoEllipse(e.x + j, e.y - j, 0.34 + 0.45 * k); ctx.fill();
    ctx.fillStyle = 'rgba(120,92,58,0.92)'; isoEllipse(e.x + j, e.y - j, 0.2 + 0.3 * k); ctx.fill();
    if (k > 0) { ctx.strokeStyle = `rgba(30,20,10,${0.5 + 0.5 * k})`; ctx.lineWidth = 2; ctx.beginPath(); for (let n = 0; n < 6; n++) { const a = n * 1.05 + 0.4, R = 0.4 + 0.7 * k; ctx.moveTo(sx, sy); ctx.lineTo(PX(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R), PY(e.x + Math.cos(a) * R, e.y + Math.sin(a) * R)); } ctx.stroke(); ctx.lineWidth = 1; }
    return;
  }
  if (e.d.ward && e.wards) for (const o of e.wards) { // 수호 드론: 보호막을 씌운 적에게 이어진 푸른 줄
    ctx.strokeStyle = `rgba(120,220,255,${0.45 + 0.2 * Math.sin(gtime * 9 + o.anim)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy - (A.z || 0) - 20); ctx.lineTo(PX(o.x, o.y), PY(o.x, o.y) - 26); ctx.stroke(); ctx.lineWidth = 1;
  }
  if (gh === 1) drawShadow(e.x, e.y, e.r * (e.fly ? 0.7 : 1.1) * (e.z ? 0.8 : 1));
  if (e.fuse > 0) { // 폭주 해골: 터질 범위를 깜박이는 붉은 원으로 (터질 때가 가까울수록 진하게)
    const k = 1 - e.fuse / e.d.bomb.fuse, f = 0.5 + 0.5 * Math.sin(gtime * 30);
    isoEllipse(e.x, e.y, e.d.bomb.r); ctx.fillStyle = `rgba(255,50,20,${0.08 + 0.14 * k + 0.06 * f})`; ctx.fill();
  }
  if (e.elite && gh === 1) { // 정예: 발밑에 특성 색 고리 (특성마다 하나씩)
    ctx.lineWidth = 2.5;
    e.elite.forEach((k, n) => {
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(gtime * 5 + n * 2);
      ctx.strokeStyle = ELITE_AFFIXES[k].color; isoEllipse(e.x, e.y, e.r + 0.22 + n * 0.13); ctx.stroke();
    });
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
    if (e.elite.includes('aura')) { ctx.strokeStyle = `rgba(48,224,200,${0.16 + 0.08 * Math.sin(gtime * 3)})`; ctx.lineWidth = 1.5; isoEllipse(e.x, e.y, ELITE_FX.aura.r); ctx.stroke(); ctx.lineWidth = 1; } // 지휘 범위
  } else if (e.auraT > 0 && gh === 1) { ctx.strokeStyle = `rgba(48,224,200,${0.45 + 0.25 * Math.sin(gtime * 9)})`; ctx.lineWidth = 1.5; isoEllipse(e.x, e.y, e.r + 0.15); ctx.stroke(); ctx.lineWidth = 1; } // 지휘받는 적
  let fr = A.walk[0];
  if (e.leapT > 0 && e.leapKind === 'pounce') fr = A.attack[0]; // 덮치는 중
  else if (e.painT > 0) fr = A.pain;
  else if (e.castT > 0) fr = A.attack[Math.min(A.attack.length - 1, Math.floor((1 - e.castT / e.castMax) * A.attack.length))]; // 감시자: 불기둥 부르기
  else if (e.atkT > 0) fr = A.attack[Math.min(A.attack.length - 1, Math.floor((1 - e.atkT / ATK_ANIM) * A.attack.length))];
  else if (e.moving) fr = A.walk[Math.floor(e.anim * 8) % A.walk.length];
  else if (A.idle) fr = A.walk[Math.floor(e.anim * A.idle) % A.walk.length];
  const shield = shieldOf(e) && !(e.stun > 0) && !(e.freeze > 0) && !(e.guardDown > 0), front = shield && Math.cos(e.face) + Math.sin(e.face) > 0; // 방패: 화면 앞쪽을 향하면 몸 앞에
  if (shield && !front) drawShield(e, sc);
  if (e.flash > 0) ctx.filter = 'brightness(2.2)';
  else if (e.freeze > 0) ctx.filter = 'sepia(1) hue-rotate(160deg) saturate(2.5) brightness(1.2)';
  else if (e.windT > 0 && Math.sin(gtime * 40) > 0) ctx.filter = 'sepia(1) saturate(6) hue-rotate(-40deg) brightness(1.4)'; // 차저 돌진 예고
  else if (e.fuse > 0 && Math.sin(gtime * 45) > 0) ctx.filter = 'brightness(2.4) saturate(2)'; // 곧 터짐: 번쩍번쩍
  else if (e.raised) ctx.filter = 'sepia(0.7) hue-rotate(55deg) saturate(1.8) brightness(0.85)'; // 되살아난 적: 초록빛
  ctx.globalAlpha = gh;
  const sink = e.sink > 0 ? e.sink : 0; // 굴착자: 바닥 밑으로 들어가는 만큼 아래를 잘라 그림
  if (sink) { ctx.save(); ctx.beginPath(); ctx.rect(sx - 150, sy - 320, 300, 323); ctx.clip(); }
  const top = drawSprite(A.spr, fr, sx, sy - z + sink * 66 * sc, e.face, sc);
  if (sink) ctx.restore();
  ctx.filter = 'none'; ctx.globalAlpha = 1;
  if (front) drawShield(e, sc);
  if (e.wardT > gtime && e.wardBy && !e.wardBy.dead) { // 수호 드론의 보호막: 몸을 감싼 푸른 막
    const by = sy - z - 26 * sc, pul = 0.5 + 0.5 * Math.sin(gtime * 6 + e.anim);
    ctx.fillStyle = `rgba(120,220,255,${0.07 + 0.04 * pul})`; ctx.strokeStyle = `rgba(150,230,255,${0.45 + 0.25 * pul})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(sx, by, 26 * sc + 6, 34 * sc + 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.lineWidth = 1;
  }
  e.topY = top; // 정예 이름표 자리 (조명 뒤에 따로 그림)
  if (e.burn > 0) drawSprite('fire', 'abcdefgh'[Math.floor(gtime * 12 + e.anim * 5) % 8], sx, sy - z + 2, 0, 0.4);
  if (gh < 1) return; // 그림자 추적자: 체력 막대도 숨김
  if (e.hp < e.maxhp && !e.elite && !e.d.nest) { // 정예·둥지는 이름표에 체력 막대
    const bw = 30, f = clamp(e.hp / e.maxhp, 0, 1), by = top - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - bw / 2, by, bw, 4);
    ctx.fillStyle = f > 0.5 ? '#6d6' : f > 0.25 ? '#ed4' : '#e44'; ctx.fillRect(sx - bw / 2, by, bw * f, 4);
  }
  if (!e.elite && shieldOf(e) && shieldDur(e) < 1) { // 방패 내구도 (파란 막대, 체력 막대 아래)
    const bw = 30, by = top - 3;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - bw / 2, by, bw, 3);
    ctx.fillStyle = '#5aa8ff'; ctx.fillRect(sx - bw / 2, by, bw * shieldDur(e), 3);
  }
  if (e.poison > 0) circle(sx + 14, top + 2, 3, '#9e4');
}
// 방패 해병의 에너지 방패: 바라보는 쪽 부채꼴을 따라 선 푸른 막 (막는 순간 밝게)
function drawShield(e, sc) {
  const SH = shieldOf(e), R = e.r + 0.34, n = 12, hgt = 40 * sc, k = clamp((e.shieldT || 0) / 0.2, 0, 1), bot = [], top = [];
  const dur = shieldDur(e), fade = (0.45 + 0.55 * dur) * (dur < 0.3 ? 0.55 + 0.45 * Math.sin(gtime * 28) : 1); // 닳을수록 흐려지고, 거의 깨지면 깜박임
  for (let i = 0; i <= n; i++) {
    const a = e.face - SH.arc / 2 + SH.arc * i / n, x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R, sx = PX(x, y), sy = PY(x, y) - 3;
    bot.push([sx, sy]); top.push([sx, sy - hgt + Math.sin(i / n * Math.PI) * 5]); // 가운데가 조금 낮은 방패 판
  }
  const line = (pts, back) => pts.forEach(([x, y], i) => i || back ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); line(bot); line(top.slice().reverse(), true); ctx.closePath();
  const y0 = Math.max(...bot.map(q => q[1])), y1 = Math.min(...top.map(q => q[1]));
  const gr = ctx.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, `rgba(70,150,255,${(0.32 + 0.45 * k) * fade})`); gr.addColorStop(1, `rgba(70,150,255,${(0.1 + 0.3 * k) * fade})`);
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = `rgba(120,190,255,${(0.16 + 0.3 * k) * fade})`; ctx.lineWidth = 1; // 판의 결
  ctx.beginPath(); for (const i of [3, 6, 9]) { ctx.moveTo(...bot[i]); ctx.lineTo(...top[i]); } ctx.stroke();
  ctx.strokeStyle = `rgba(160,215,255,${(0.6 + 0.4 * k) * fade})`; ctx.lineWidth = 2; // 테두리
  ctx.beginPath(); line(bot); line(top.slice().reverse(), true); ctx.closePath(); ctx.stroke();
  ctx.restore();
}
// 쓰러진 몬스터: 사망 프레임을 재생한 뒤 마지막 프레임으로 남음
function drawCorpse(c) {
  const A = ENEMY_ART[c.type], k = Math.min(A.death.length - 1, Math.floor(c.t / 0.1));
  const z = A.z ? A.z * Math.max(0, 1 - c.t / 0.4) : 0;
  drawSprite(A.spr, A.death[k], PX(c.x, c.y), PY(c.x, c.y) - z, c.face, A.scale);
}
// 생존자 (Freedoom의 파란 제복 승무원)
function drawSurvivor(s) {
  const sx = PX(s.x, s.y), sy = PY(s.x, s.y);
  if (s.state === 'dead') { drawSprite('sswv', 'ijlm'[Math.min(3, Math.floor(s.deathT / 0.12))], sx, sy, s.face); return; }
  drawShadow(s.x, s.y, 0.3);
  let fr = 'a';
  if (s.painT > 0) fr = 'h';
  else if (s.moving) fr = 'abcd'[Math.floor(s.walk * 0.7) % 4];
  if (s.hitT > 0) ctx.filter = 'brightness(2)';
  s.topY = drawSprite('sswv', fr, sx, sy, s.face);
  ctx.filter = 'none';
}
// 포탑: 세 다리 받침 위에 기관총 (겨눈 쪽으로 돌아감), 머리 위에 남은 시간
function drawTurret(t) {
  const sx = PX(t.x, t.y), sy = PY(t.x, t.y);
  drawShadow(t.x, t.y, 0.3);
  ctx.strokeStyle = '#2f3338'; ctx.lineWidth = 3;
  for (const a of [0.5, 2.6, 4.7]) { ctx.beginPath(); ctx.moveTo(sx, sy - 14); ctx.lineTo(sx + Math.cos(a) * 13, sy + Math.sin(a) * 5); ctx.stroke(); }
  ctx.fillStyle = '#4a5058'; ctx.fillRect(sx - 6, sy - 22, 12, 9);
  const vx = Math.cos(t.ang) - Math.sin(t.ang), vy = (Math.cos(t.ang) + Math.sin(t.ang)) / 2; // 화면에서 겨눈 방향
  ctx.save(); ctx.translate(sx, sy - 22); ctx.rotate(Math.atan2(vy, vx)); if (vx < 0) ctx.scale(1, -1);
  drawIcon('icon_mg', -10, -7, 36, 14);
  ctx.restore();
  if (t.hitT > 0) { ctx.fillStyle = 'rgba(255,240,200,0.55)'; ctx.fillRect(sx - 7, sy - 23, 14, 11); } // 맞을 때 번쩍
  drawDeviceBars(t, sx, sy - 40, '#9f9');
  ctx.lineWidth = 1;
}
// 설치물 위의 막대: 남은 시간 (y부터), 닳았으면 그 아래에 내구도
function drawDeviceBars(o, sx, y, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - 15, y, 30, 4);
  ctx.fillStyle = col; ctx.fillRect(sx - 15, y, 30 * clamp(o.t / o.max, 0, 1), 4);
  if (o.hp >= o.maxhp) return;
  const f = clamp(o.hp / o.maxhp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - 15, y + 5, 30, 3);
  ctx.fillStyle = f > 0.5 ? '#ffd27a' : f > 0.25 ? '#ff9a3a' : '#ff5a4a'; ctx.fillRect(sx - 15, y + 5, 30 * f, 3);
}
// 지뢰 (바닥, 조명 아래): Freedoom의 붉은 눈 장치를 작게 — 날아가는 중에는 높이, 작동하면 눈이 깜박임
function drawMines() {
  for (const m of mines) {
    const sx = PX(m.x, m.y), sy = PY(m.x, m.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy + 1, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    drawSprite('ceye', m.arm > 0 ? 'a' : 'abc'[Math.floor(gtime * 6 + m.ph) % 3], sx, sy - m.z + 2, 0, 0.36);
  }
}
// 전투 드론 (Freedoom의 떠다니는 기계 해골): 머리 위에 남은 시간
function drawDrone(d) {
  const sx = PX(d.x, d.y), sy = PY(d.x, d.y), z = d.z + Math.sin(gtime * 4) * 3;
  drawShadow(d.x, d.y, 0.2);
  const top = drawSprite('fsku', 'abc'[Math.floor(gtime * 8) % 3], sx, sy - z, 0, 0.55);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - 12, top - 7, 24, 3);
  ctx.fillStyle = SKILLS.drone.color; ctx.fillRect(sx - 12, top - 7, 24 * clamp(d.t / d.max, 0, 1), 3);
}
// 금고 보물함 (knekko 가방을 금빛으로): 열면 흐리게
function drawChest(c) {
  const sx = PX(c.x, c.y), sy = PY(c.x, c.y);
  drawShadow(c.x, c.y, 0.35);
  ctx.globalAlpha = c.open ? 0.4 : 1; drawBottom('icon_case_gold', sx, sy + 3, 1.7); ctx.globalAlpha = 1;
}
// 필드 사건: 보급 캐시 (흰 케이스), 조난 신호기 (키 큰 기술 등) — 지키는 동안 바닥에 범위 고리
function drawSpot(sp) {
  const sx = PX(sp.x, sp.y), sy = PY(sp.x, sp.y);
  if (sp.type === 'cache') { drawShadow(sp.x, sp.y, 0.4); ctx.globalAlpha = sp.state === 'done' ? 0.35 : 1; drawBottom('icon_case_white', sx, sy + 3, 1.55); ctx.globalAlpha = 1; return; }
  if (sp.state === 'on') { ctx.strokeStyle = `rgba(255,150,60,${0.35 + 0.25 * Math.sin(gtime * 6)})`; ctx.lineWidth = 2; isoEllipse(sp.x, sp.y, FIELD_EVENTS.beacon.r); ctx.stroke(); ctx.lineWidth = 1; }
  drawShadow(sp.x, sp.y, 0.25);
  drawSprite('tlp2', 'a', sx, sy, 0, 1);
}
// 보물함·사건 이름표 + 가까우면 [F] 안내 (조명 뒤에 그림)
function drawSpotLabels() {
  const near = nearestSpot();
  ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif';
  for (const o of [...chests, ...spots]) {
    if (Math.hypot(o.x - player.x, o.y - player.y) > 9 || !canSee(o.x, o.y)) continue;
    const chest = o.kind === 'chest', B = FIELD_EVENTS.beacon;
    const name = chest ? (o.open ? '' : '금고 보물함') : o.type === 'cache' ? (o.state === 'done' ? '' : '보급 캐시') : o.state === 'on' ? `조난 신호기 — 송신 ${Math.floor(o.prog / B.time * 100)}%` : o.state === 'done' ? '조난 신호기 — 송신 완료' : '조난 신호기';
    if (!name) continue;
    const x = PX(o.x, o.y), y = PY(o.x, o.y) - (o.type === 'beacon' ? 70 : 34), w = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - w / 2 - 5, y - 13, w + 10, 18);
    ctx.fillStyle = chest ? '#ffc040' : o.state === 'done' ? '#9f9' : '#ffb060'; ctx.fillText(name, x, y);
    if (o === near) { ctx.fillStyle = '#ffd27a'; ctx.fillText(chest ? '[F] 열기' : o.type === 'cache' ? '[F] 열기 (경보가 울림)' : '[F] 신호기 켜기', x, y - 18); }
  }
}
// 잔상 (유령 발자국): 푸르게 비치는 내 모습, 바닥에 푸른 고리
function drawDecoy(d) {
  const sx = PX(d.x, d.y), sy = PY(d.x, d.y);
  ctx.strokeStyle = `rgba(120,220,255,${0.4 + 0.3 * Math.sin(gtime * 8)})`; ctx.lineWidth = 2; isoEllipse(d.x, d.y, 0.45); ctx.stroke(); ctx.lineWidth = 1;
  ctx.globalAlpha = Math.min(1, d.t * 2) * (0.5 + 0.12 * Math.sin(gtime * 12));
  ctx.filter = d.hitT > 0 ? 'brightness(2)' : 'sepia(1) saturate(5) hue-rotate(150deg) brightness(1.3)';
  drawSprite('play', 'a', sx, sy, d.face);
  ctx.filter = 'none'; ctx.globalAlpha = 1;
}
// 테슬라 코일 (Freedoom의 기술 기둥): 위에 남은 시간·내구도, 맞으면 번쩍
function drawCoil(c) {
  const sx = PX(c.x, c.y), sy = PY(c.x, c.y);
  drawShadow(c.x, c.y, 0.3);
  const top = drawSprite('elec', 'a', sx, sy, 0, 0.5);
  if (c.hitT > 0) { ctx.fillStyle = 'rgba(255,240,200,0.45)'; ctx.fillRect(sx - 7, top + 4, 14, Math.max(4, sy - top - 8)); }
  drawDeviceBars(c, sx, top - 11, SKILLS.tesla.color);
}
// 중력장 바닥: 어둡게 꺼진 바닥과 안으로 줄어드는 물결 (가운데 구체는 drawSkillOverlay)
function drawWell(w) {
  const sx = PX(w.x, w.y), sy = PY(w.x, w.y);
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, w.r * 45);
  g.addColorStop(0, 'rgba(20,0,40,0.6)'); g.addColorStop(0.6, 'rgba(90,40,160,0.2)'); g.addColorStop(1, 'rgba(120,60,200,0)');
  ctx.fillStyle = g; isoEllipse(w.x, w.y, w.r); ctx.fill();
  ctx.strokeStyle = `rgba(200,140,255,${0.25 + 0.2 * Math.sin(gtime * 8)})`; ctx.lineWidth = 1.5;
  isoEllipse(w.x, w.y, w.r * (1 - (gtime * 1.3) % 1)); ctx.stroke(); ctx.lineWidth = 1;
}
// 조명 위에 그리는 스킬 효과: 중력장 가운데 소용돌이 구체 (Freedoom의 무적 구체), 드론, 회전 톱날
function drawSkillOverlay() {
  for (const w of wells) drawSprite('pinv', 'abcd'[Math.floor(gtime * 10) % 4], PX(w.x, w.y), PY(w.x, w.y) - 30, 0, 1.2 + 0.15 * Math.sin(gtime * 9));
  for (const d of drones) drawDrone(d);
  const SW = buff('saw'), p = player;
  if (SW) for (let k = 0, n = SW.n || 2; k < n; k++) { const a = SW.ang + k * Math.PI * 2 / n; drawSawBlade(p.x + Math.cos(a) * SW.r * 0.75, p.y + Math.sin(a) * SW.r * 0.75, a); }
}
// 회전 톱날: 도는 방향을 향한 전기톱 (Freedoom)
function drawSawBlade(x, y, a) { drawSpin('csawa0', PX(x, y), PY(x, y) - 20, screenAng(Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)), 40, 19); }
// 집중 사격: 총구에서 자동 조준 대상(없으면 벽까지)으로 붉은 레이저
function drawLaser() {
  const p = player;
  if (!buff('deadeye') || state !== 'play') return;
  const t = p.target && !p.target.dead ? p.target : null, a = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.aim;
  let L = t ? Math.hypot(t.x - p.x, t.y - p.y) : 0.5;
  if (!t) while (L < 10 && !blocksShot(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L)) L += 0.25;
  const x0 = p.x + Math.cos(a) * 0.45, y0 = p.y + Math.sin(a) * 0.45, x1 = p.x + Math.cos(a) * L, y1 = p.y + Math.sin(a) * L;
  ctx.strokeStyle = `rgba(255,40,30,${0.5 + 0.25 * Math.sin(gtime * 20)})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PX(x0, y0), PY(x0, y0) - 22); ctx.lineTo(PX(x1, y1), PY(x1, y1) - (t ? 24 : 22)); ctx.stroke(); ctx.lineWidth = 1;
  if (t) circle(PX(x1, y1), PY(x1, y1) - 24, 3, '#ff3020');
}
// 바닥 표시 (조명 아래): 갇힌 생존자 발밑의 구조 신호 고리, 해킹 중 지켜야 하는 범위
function drawMissionFloor() {
  const M = hackM || PURGE;
  for (const s of survivors) {
    if (s.state !== 'wait' || !canSee(s.x, s.y)) continue;
    ctx.strokeStyle = `rgba(127,200,255,${0.45 + 0.35 * Math.sin(gtime * 5)})`; ctx.lineWidth = 2;
    isoEllipse(s.x, s.y, 0.5 + 0.08 * Math.sin(gtime * 5)); ctx.stroke(); ctx.lineWidth = 1;
  }
  if (M.type === 'hack' && M.on && !M.done) {
    const x = M.term.i + 0.5, y = M.term.j + 0.5, a = 0.5 + 0.25 * Math.sin(gtime * 4);
    if (M.near) { ctx.fillStyle = 'rgba(110,240,220,0.07)'; isoEllipse(x, y, MISSIONS.hack.r); ctx.fill(); }
    ctx.setLineDash([12, 9]); ctx.lineDashOffset = -gtime * 24;
    ctx.strokeStyle = M.near ? `rgba(110,240,220,${a})` : `rgba(255,150,80,${a + 0.2})`; ctx.lineWidth = 2;
    isoEllipse(x, y, MISSIONS.hack.r); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
}
function drawBarrel(b) {
  drawShadow(b.x, b.y, 0.3);
  drawSprite('bar1', Math.floor(gtime * 4 + b.x * 3) % 2 ? 'b' : 'a', PX(b.x, b.y), PY(b.x, b.y));
}
function drawLamp(l) { drawSprite('tlmp', 'abcd'[Math.floor(gtime * 8 + l.ph) % 4], PX(l.x, l.y), PY(l.x, l.y), 0, 0.85); }

// --- 아이템 ---
// [스프라이트, 크기 배율]
const ITEM_ART = {
  medS: ['stima0', 1.1], medM: ['media0', 1], medL: ['media0', 1.4], nano: ['icon_syringe_blue', 0.8],
  antidote: ['bon1a0', 1.3], insul: ['suita0', 0.5], armor: ['arm1a0', 0.9], adren: ['icon_syringe_red', 0.8],
};
const AMMO_ART = { pistol: ['clipa0', 1.3], shell: ['shela0', 1.2], rifle: ['ammoa0', 1], belt: ['broka0', 0.55], cell: ['cella0', 1.3], rocket: ['rocka0', 1.1] };
function drawPickup(it) {
  const sx = PX(it.x, it.y), sy = PY(it.x, it.y), z = 2 + Math.sin(gtime * 3 + it.bob) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, 9, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  if (it.kind === 'gold') { circle(sx, sy - z - 3, 4.5, '#ffd27a'); circle(sx - 1, sy - z - 4, 2, '#fff6c0'); return; }
  if (it.kind === 'log') { // 데이터 기록: 화면이 깜박이는 휴대 단말기 + 하늘색 고리
    ctx.strokeStyle = `rgba(90,210,255,${0.45 + 0.45 * Math.sin(gtime * 4 + it.bob)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, sy, 14, 7, 0, 0, Math.PI * 2); ctx.stroke();
    drawBottom(Math.floor(gtime * 3 + it.bob) % 2 ? 'pmapb0' : 'pmapa0', sx, sy - z, 1.2); // 이름은 커서를 올렸을 때 (drawLootLabels)
    return;
  }
  if (it.kind === 'key') { // 키카드: 깜박이는 카드 + 바닥의 색 고리
    const K = KEYCARDS[it.id];
    ctx.strokeStyle = `rgba(${K.rgb},${0.5 + 0.5 * Math.sin(gtime * 5)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, sy, 16, 8, 0, 0, Math.PI * 2); ctx.stroke();
    drawBottom(K.spr + (!K.still && Math.floor(gtime * 2.5 + it.bob) % 2 ? 'b0' : 'a0'), sx, sy - z, 1.6); // 이름은 커서를 올렸을 때
    return;
  }
  if (it.kind === 'weapon') { // 무기·스킬 쉘 (이름표는 조명 뒤 drawLootLabels에서)
    const gem = it.inst.kind === 'gem', shell = it.inst.kind === 'shell' || gem, key = gem ? GEMS[it.inst.id].icon : it.inst.kind === 'shell' ? SKILLS[it.inst.id].icon : it.inst.kind === 'armor' ? ARMORS[it.inst.id].icon : 'icon_' + it.inst.id, R = RARITY[it.inst.rarity], f = META.frames[key];
    ctx.strokeStyle = `rgba(${R.glow},${0.5 + 0.5 * Math.sin(gtime * 5)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, sy, shell ? 14 : 20, shell ? 7 : 10, 0, 0, Math.PI * 2); ctx.stroke();
    if (f) drawBottom(key, sx, sy - z - (shell ? 4 : 0), gem ? [0.5, 0.62, 0.75][it.inst.grade] : shell ? Math.min(1, 26 / Math.max(f[2], f[3])) : Math.min(1, 44 / f[2]));
    return;
  }
  const [key, sc] = it.kind === 'item' ? ITEM_ART[it.id] : it.kind === 'ammo' ? AMMO_ART[it.id] : ['icon_gren_' + it.id, 0.8];
  drawBottom(key, sx, sy - z, sc); // 이름은 커서를 올렸을 때
}

// --- 핏자국: 흰 핏자국 그림을 체액 색으로 칠한 것 (그림·색마다 한 번 만들어 둠) ---
const splatCache = new Map();
function tintedSplat(key, col) {
  let c = splatCache.get(key + col);
  if (c) return c;
  const f = META.frames[key];
  if (!f || !ART.ready) return null;
  c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const g = c.getContext('2d');
  g.drawImage(ART.atlas, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  splatCache.set(key + col, c);
  return c;
}
// 바닥에 눕혀 그림: 무작위로 돌리고(뒤집고) 세로를 절반으로 (아이소메트릭 바닥), 너비 = 반지름 r칸의 약 2.3배
function drawSplat(d, sx, sy) {
  const c = tintedSplat(d.splat, d.col);
  if (!c) return;
  const k = d.r * 2.3 * 45 / Math.max(c.width, c.height);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.5); ctx.rotate(d.rot); if (d.flip) ctx.scale(-1, 1);
  ctx.globalAlpha = 0.75; ctx.drawImage(c, -c.width * k / 2, -c.height * k / 2, c.width * k, c.height * k);
  ctx.restore();
}
// --- 이펙트 / 장판 ---
function drawFx(f) {
  ctx.globalAlpha = f.alpha;
  drawSprite(f.pre, f.frames[Math.min(f.frames.length - 1, Math.floor(f.t / f.dur * f.frames.length))], PX(f.x, f.y), PY(f.x, f.y) - f.z, 0, f.scale);
  ctx.globalAlpha = 1;
}
function drawArea(a) {
  if (a.type === 'gas') return; // 독가스는 drawGasFog (바닥을 기는 안개)
  const f = Math.min(1, a.t / 1.5), c = '255,110,30';
  const g = ctx.createRadialGradient(PX(a.x, a.y), PY(a.x, a.y), 0, PX(a.x, a.y), PY(a.x, a.y), a.r * 45);
  g.addColorStop(0, `rgba(${c},${0.4 * f})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; isoEllipse(a.x, a.y, a.r); ctx.fill();
  if (!a.seeds) a.seeds = Array.from({ length: 6 }, () => [rnd(-0.7, 0.7) * a.r, rnd(-0.7, 0.7) * a.r, rnd(0, 10)]);
  ctx.globalAlpha = f;
  for (const [ox, oy, ph] of a.seeds) drawSprite('fire', 'abcdefgh'[Math.floor(gtime * 12 + ph) % 8], PX(a.x + ox, a.y + oy), PY(a.x + ox, a.y + oy), 0, 0.55);
  ctx.globalAlpha = 1;
}
// --- 독가스: 바닥을 기는 안개 — 이음매 없는 노이즈 무늬(가스 결)를 바닥 시점으로 눕혀 흘려보내고, 구름마다 가장자리가 옅은 덩어리 모양으로 오려 냄 ---
// top=false: 바닥 (진하게, 캐릭터 아래), top=true: 캐릭터 발목까지 덮는 옅은 겹 (다른 방향으로 흐름). 누출 가스는 그 방 바닥 안에서만
let gasPat = null, gasC = null, gctx = null;
function gasPattern() {
  if (gasPat) return gasPat;
  const N = 128, c = document.createElement('canvas'), v = new Float32Array(N * N);
  c.width = c.height = N;
  for (let o = 0, f = 4, a = 0.55; o < 4; o++, f *= 2, a *= 0.5) { // 값 노이즈 네 겹 (격자가 이어져서 바둑판처럼 붙여도 이음매 없음)
    const grid = Array.from({ length: f * f }, () => Math.random()), at = (i, j) => grid[(j % f) * f + (i % f)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = x / N * f, gy = y / N * f, i = Math.floor(gx), j = Math.floor(gy), u = gx - i, w = gy - j, su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
      v[y * N + x] += a * ((at(i, j) * (1 - su) + at(i + 1, j) * su) * (1 - sw) + (at(i, j + 1) * (1 - su) + at(i + 1, j + 1) * su) * sw);
    }
  }
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let k = 0; k < N * N; k++) { // 옅은 곳은 투명, 진할수록 어두운 올리브 → 밝은 황록 (부피감)
    const t = clamp((v[k] / 1.03 - 0.28) / 0.5, 0, 1), s = t * t * (3 - 2 * t);
    img.data.set([60 + 140 * s, 105 + 135 * s, 20 + 90 * s, 255 * Math.min(1, s * 1.3)], k * 4);
  }
  g.putImageData(img, 0, 0);
  return gasPat = ctx.createPattern(c, 'repeat');
}
const gasDensity = a => Math.min(1, a.t / 1.5, a.max ? (a.max - a.t) / 1.2 : 1); // 나타날 때·걷힐 때 옅게
function drawGasFog(top) {
  const G = areas.filter(a => a.type === 'gas' && Math.abs(PX(a.x, a.y) - W / 2) < W / 2 + a.r * 50 && Math.abs(PY(a.x, a.y) - VH / 2) < VH / 2 + a.r * 30);
  const plumes = top ? hazards.filter(h => h.type === 'gas') : [];
  if (!G.length && !plumes.length) return;
  if (!gasC) { gasC = document.createElement('canvas'); gctx = gasC.getContext('2d'); }
  if (gasC.width !== W || gasC.height !== VH) { gasC.width = W; gasC.height = VH; }
  const lift = top ? 10 : 0, P = gasPattern();
  const blobs = (col, k = 1) => { // 구름마다 부드러운 덩어리 (조금씩 부풀었다 줄었다), k: 진하기
    for (const a of G) {
      const f = gasDensity(a) * k, R = a.r * 45.25 * (top ? 0.85 : 1) * (1 + 0.05 * Math.sin(gtime * 0.8 + a.x * 3));
      gctx.save();
      if (a.room) { const r = a.room; gctx.beginPath(); for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]) gctx.lineTo(PX(x, y), PY(x, y) - lift); gctx.clip(); }
      gctx.translate(PX(a.x, a.y), PY(a.x, a.y) - lift); gctx.scale(1, 0.5);
      const g = gctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, `rgba(${col},${f})`); g.addColorStop(0.55, `rgba(${col},${0.7 * f})`); g.addColorStop(1, `rgba(${col},0)`);
      gctx.fillStyle = g; gctx.fillRect(-R, -R, 2 * R, 2 * R);
      gctx.restore();
    }
  };
  gctx.globalCompositeOperation = 'source-over'; gctx.clearRect(0, 0, W, VH);
  blobs('0,0,0');
  gctx.globalCompositeOperation = 'source-in'; // 덩어리 모양 안에만 가스 결
  const [dx, dy] = top ? [-gtime * 11, gtime * 15] : [gtime * 17, gtime * 6];
  P.setTransform(new DOMMatrix([0.5, 0.25, -0.5, 0.25, W / 2 - cam.x + shx, VH / 2 - cam.y + shy - lift]).scale(top ? 1.5 : 2.2).translate(dx, dy));
  gctx.fillStyle = P; gctx.fillRect(0, 0, W, VH);
  gctx.globalCompositeOperation = 'destination-over'; // 결 사이도 아주 옅게 차 있음
  blobs(top ? '90,140,30' : '70,120,25', 0.3);
  ctx.globalAlpha = top ? 0.5 : 0.95; ctx.drawImage(gasC, 0, 0); ctx.globalAlpha = 1;
  for (const h of plumes) { // 터진 배관에서 솟구치는 가스 기둥 (결이 위로 빠르게 흐름)
    const x = PX(h.sx, h.sy), y = PY(h.sx, h.sy) - 4, f = gasDensity(h), sway = Math.sin(gtime * 2.3) * 4;
    gctx.globalCompositeOperation = 'source-over'; gctx.clearRect(x - 60, y - 140, 120, 150);
    const plume = (col, k) => {
      gctx.save(); gctx.translate(x + sway, y - 50); gctx.scale(0.45, 1);
      const g = gctx.createRadialGradient(0, 0, 0, 0, 0, 58);
      g.addColorStop(0, `rgba(${col},${k * f})`); g.addColorStop(1, `rgba(${col},0)`);
      gctx.fillStyle = g; gctx.fillRect(-58, -58, 116, 116); gctx.restore();
    };
    plume('0,0,0', 1);
    gctx.globalCompositeOperation = 'source-in';
    P.setTransform(new DOMMatrix([1, 0, 0, 1, x, y - gtime * 80]).scale(0.9));
    gctx.fillStyle = P; gctx.fillRect(x - 60, y - 140, 120, 150);
    gctx.globalCompositeOperation = 'destination-over'; plume('130,190,55', 0.6);
    ctx.drawImage(gasC, x - 60, y - 140, 120, 150, x - 60, y - 140, 120, 150);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.drawImage(gasC, x - 60, y - 140, 120, 150, x - 60, y - 140, 120, 150); // 뿜어져 나오는 가운데는 밝게
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
}

// ===== 무기 아이콘 / 툴팁 =====
// 무기 아이콘 (knekko CC0 픽셀 아트)
const drawWeaponIcon = (id, x, y, w, h) => drawIcon('icon_' + id, x, y, w, h);
// 등급색 테두리 상자 + 아이콘
function drawItemBox(inst, x, y, w, h) {
  const R = RARITY[inst.rarity], rw = !!inst.rw; // 보석 조합: 청록
  ctx.fillStyle = `rgba(${rw ? RW_GLOW : R.glow},0.13)`; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = rw ? RW_COLOR : R.color; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  if (inst.uq || inst.set || rw) ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7); // 고유 전설·세트·보석 조합: 이중 테두리
  if (inst.kind === 'shell') drawIcon(SKILLS[inst.id].icon, x + 4, y + 4, w - 8, h - 8); // 스킬 쉘: 그 스킬의 그림
  else if (inst.kind === 'gem') { const k = [0.62, 0.8, 1][inst.grade], bw = (w - 8) * k, bh = (h - 8) * k; drawIcon(GEMS[inst.id].icon, x + (w - bw) / 2, y + (h - bh) / 2, bw, bh); } // 보석: 등급이 높을수록 크게
  else if (inst.kind === 'armor') drawIcon(ARMORS[inst.id].icon, x + 4, y + 4, w - 8, h - 8);
  else drawWeaponIcon(inst.id, x + 4, y + 4, w - 8, h - 8);
  if (inst.sockets) drawSockets(inst, x, y, w, h);
}
// 소켓: 왼쪽 아래에 구멍 (끼운 보석은 그 보석 그림)
function drawSockets(inst, x, y, w, h) {
  const r = clamp(Math.min(w, h) * 0.09, 3, 6), gems = inst.gems || [];
  for (let n = 0; n < inst.sockets; n++) {
    const cx = x + 5 + r + n * (2 * r + 2), cy = y + h - 5 - r;
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a8478'; ctx.lineWidth = 1; ctx.stroke();
    if (gems[n]) drawIcon(GEMS[gems[n].id].icon, cx - r, cy - r, 2 * r, 2 * r);
  }
}
// 비율을 유지하며 상자 안에 맞춰 그리기 (장착 슬롯용)
function drawItemFit(inst, x, y, bw, bh) {
  const [sw, sh] = inst.s.size, k = Math.min(bw / (sw * CELL), bh / (sh * CELL)), w = sw * CELL * k, h = sh * CELL * k;
  drawItemBox(inst, x + (bw - w) / 2, y + (bh - h) / 2, w, h);
}
function tooltipLines(inst) {
  const s = inst.s, R = RARITY[inst.rarity], L = [], U = inst.uq && UNIQUES[inst.uq];
  L.push({ t: (U ? '★ ' : '') + inst.name, c: itemColor(inst), b: true });
  L.push({ t: `${inst.rw ? '보석 조합' : R.name} · ${CAT_NAMES[s.cat]} · ${s.size[0]}x${s.size[1]}칸 · 무게 ${s.weight}`, c: '#9a9' });
  for (const t of wrapWords(s.desc || '', 30)) L.push({ t, c: '#d8c89a' }); // 무기 설명
  L.push({ t: `피해 ${Math.round(s.dmg)}${s.pellets ? ' x' + s.pellets : ''} · DPS ${Math.round(weaponDps(s))}`, c: '#eee' });
  if (s.type === 'gun') {
    L.push({ t: `발사 간격 ${s.rate.toFixed(2)}초 · 장탄 ${s.mag} · 재장전 ${s.reload.toFixed(1)}초`, c: '#ccc' });
    L.push({ t: `탄퍼짐 ${s.spread.toFixed(2)} · 사거리 ${s.range || 16} · ${AMMO[s.ammo].name}`, c: '#ccc' });
    if (s.blast || s.charge || s.cost) L.push({ t: [s.blast && `폭발 반경 ${s.blast}칸`, s.charge && `충전 ${s.charge}초`, s.cost && `한 발에 ${AMMO[s.ammo].name} ${s.cost}`].filter(Boolean).join(' · '), c: '#9cf' });
  } else {
    L.push({ t: `공격 간격 ${s.rate.toFixed(2)}초 · 사거리 ${s.range} · 스태미너 ${s.saw ? `초당 ${Math.round(s.stamina / s.rate)}` : s.stamina}`, c: '#ccc' });
    if (s.saw) L.push({ t: '누르고 있으면 계속 피해 · 처치하면 탄약이 반드시 (2.5배)', c: '#ffb070' });
    if (s.chain) L.push({ t: `감전 기절 · 연쇄 번개 ${s.chain.n}번 (피해 ${Math.round(s.chain.mul * 100)}%)`, c: '#9df' });
    if (s.reflect) L.push({ t: '쳐낸 적 탄을 앞쪽의 적에게 되돌려 보냄', c: '#7ef' });
    L.push({ t: `근접: 처치하면 체력·탄약 보급${s.saw ? '' : ' · 적 탄 쳐내기'}`, c: '#9cf' }, { t: '   장갑 무시 · 방패 3배 · 준비 동작 끊기', c: '#9cf' });
  }
  for (const a of inst.affixes) L.push({ t: AFFIXES[a.k].text(a.v, a.type), c: a.k === 'elem' ? ELEMS[a.type].color : '#8af' });
  if (U) { // 고유 효과 + 붉은 글씨 한 줄
    for (const [n, t] of wrapWords(U.effect, 30).entries()) L.push({ t: (n ? '   ' : '◆ ') + t, c: '#ffcf70' });
    L.push({ t: `"${U.flavor}"`, c: '#d0604a' });
  }
  setLines(inst, L);
  rwLines(inst, L);
  socketLines(inst, L);
  const eq = player.equip.includes(inst) ? null : curW() !== FISTS ? curW() : null; // 손에 든 무기와 비교
  if (eq) {
    const d = Math.round(weaponDps(s) - weaponDps(eq.s));
    L.push({ t: `손에 든 무기: ${eq.name} (DPS ${Math.round(weaponDps(eq.s))})  ${d >= 0 ? '▲ +' + d : '▼ ' + d}`, c: d >= 0 ? '#7f7' : '#f77' });
  }
  return L;
}
// 띄어쓰기 기준으로 n글자 안팎씩 줄바꿈
function wrapWords(text, n) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}
function drawTooltip(L, x, y, maxY = H) {
  let w = 0;
  for (const l of L) { ctx.font = l.b ? 'bold 13px sans-serif' : '12px sans-serif'; w = Math.max(w, ctx.measureText(l.t).width); }
  w += 18; const h = L.length * 17 + 10;
  x = clamp(x, 6, W - w - 6); y = clamp(y, 6, maxY - h - 6);
  ctx.fillStyle = 'rgba(10,10,8,0.94)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = L[0].c; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = 'left';
  L.forEach((l, i) => { ctx.font = l.b ? 'bold 13px sans-serif' : '12px sans-serif'; ctx.fillStyle = l.c; ctx.fillText(l.t, x + 9, y + 19 + i * 17); });
}
function fitText(t, maxW) {
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
// 바닥 아이템의 이름·정보: 가까이(HOVER_R칸 안) 있는 아이템에 커서를 올렸을 때만 (바라보기만 해서는 뜨지 않음 — 화면을 덜 가림)
// 발밑의 주울 수 있는 무기에는 [F] 줍기 안내만 작게
const HOVER_R = 4;
function hoverPickup() {
  if ((invOpen && invHit(mouse.x, mouse.y)) || codexOpen) return null;
  let best = null, bd = 28; // 커서와 그림 가운데 사이 (화면 픽셀)
  for (const it of pickups) {
    if (it.dead || it.kind === 'gold' || Math.hypot(it.x - player.x, it.y - player.y) > HOVER_R || !canSee(it.x, it.y)) continue;
    const d = Math.hypot(PX(it.x, it.y) - mouse.x, PY(it.x, it.y) - 14 - mouse.y);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
function drawLootLabels() {
  const cand = nearestWeaponPickup(), it = hoverPickup();
  ctx.textAlign = 'center';
  if (cand && cand !== it) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffd27a'; ctx.fillText('[F] 줍기', PX(cand.x, cand.y), PY(cand.x, cand.y) - 46); }
  if (!it) return;
  const sx = PX(it.x, it.y), sy = PY(it.x, it.y) - 30, w = it.kind === 'weapon';
  const name = w ? (it.inst.uq ? '★ ' : it.inst.set ? '◆ ' : '') + it.inst.name : it.kind === 'key' ? KEYCARDS[it.id].name : it.kind === 'log' ? '데이터 기록'
    : it.kind === 'item' ? ITEMS[it.id].name : it.kind === 'ammo' ? AMMO[it.id].name : GRENADES[it.id].name;
  const col = w ? itemColor(it.inst) : it.kind === 'key' ? KEYCARDS[it.id].color : it.kind === 'log' ? '#7fe0ff' : it.kind === 'item' ? ITEMS[it.id].color : it.kind === 'ammo' ? '#c9a040' : GRENADES[it.id].color;
  ctx.font = '11px sans-serif'; const tw = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(sx - tw / 2 - 4, sy - 11, tw + 8, 15);
  ctx.fillStyle = col; ctx.fillText(name, sx, sy);
  if (it === cand) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffd27a'; ctx.fillText('[F] 줍기', sx, sy - 16); }
  if (w) drawTooltip(itemLines(it.inst), sx + 30, sy + 10, VH); // 무기·방어구·쉘·보석: 성능
}
// 정예 이름표 + 체력 막대 (조명 뒤에 그려서 어두운 곳에서도 읽힘, 지금 보이는 정예만)
function drawEliteLabels() {
  ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif';
  for (const e of enemies) if (e.d.thief && !e.dead && e.topY !== undefined && canSee(e.x, e.y)) { // 보물 약탈자: 이름 + 남은 시간
    const x = PX(e.x, e.y), y = e.topY - 12, bw = 56, f = e.alert ? clamp(e.escapeT / THIEF.escape, 0, 1) : 1;
    ctx.fillStyle = '#000'; ctx.fillText('보물 약탈자', x + 1, y - 7); ctx.fillStyle = '#ffd27a'; ctx.fillText('보물 약탈자', x, y - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - bw / 2 - 1, y - 3, bw + 2, 7);
    ctx.fillStyle = f < 0.3 ? '#ff7a4a' : '#ffd27a'; ctx.fillRect(x - bw / 2, y - 2, bw * f, 5);
  }
  for (const e of enemies) {
    if (!e.elite || e.dead || e.topY === undefined || !canSee(e.x, e.y) || ghost(e) || hiddenE(e)) continue;
    const x = PX(e.x, e.y), y = e.topY - 12, bw = 64, f = clamp(e.hp / e.maxhp, 0, 1);
    ctx.fillStyle = '#000'; ctx.fillText(e.name, x + 1, y - 7);
    ctx.fillStyle = e.super ? '#ff9a3a' : '#ffcc55'; ctx.fillText(e.name, x, y - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - bw / 2 - 1, y - 3, bw + 2, 7);
    ctx.fillStyle = '#e8b030'; ctx.fillRect(x - bw / 2, y - 2, bw * f, 5);
    e.elite.forEach((k, n) => circle(x - bw / 2 - 6 - n * 8, y + 0.5, 3, ELITE_AFFIXES[k].color)); // 특성 색 점
    if (shieldOf(e) && shieldDur(e) < 1) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - bw / 2 - 1, y + 4, bw + 2, 4); ctx.fillStyle = '#5aa8ff'; ctx.fillRect(x - bw / 2, y + 5, bw * shieldDur(e), 2); } // 방패 내구도
  }
}
// 임무 이름표 (조명 뒤): 생존자 (갇힘: 구조 요청 / 동행: 체력 막대), 둥지 이름·체력
function drawMissionLabels() {
  ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif';
  const label = (x, y, t, col, f, bar, bw = 50) => {
    if (t) { ctx.fillStyle = '#000'; ctx.fillText(t, x + 1, y - 7); ctx.fillStyle = col; ctx.fillText(t, x, y - 8); }
    if (f === undefined) return;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - bw / 2, y - 3, bw, 7);
    ctx.fillStyle = bar; ctx.fillRect(x - bw / 2 + 1, y - 2, (bw - 2) * clamp(f, 0, 1), 5);
  };
  for (const s of survivors) {
    if ((s.state !== 'wait' && s.state !== 'follow') || s.topY === undefined || !survivorShown(s)) continue;
    const x = PX(s.x, s.y), y = s.topY - 10;
    if (s.state === 'wait') { if (Math.sin(gtime * 4) > -0.5) label(x, y, '구조 요청 — 가까이 가면 합류', '#9cf'); }
    else label(x, y + 6, '', '#9cf', s.hp / s.maxhp, s.hp < s.maxhp * 0.35 ? '#f64' : '#5ab4ff', 30); // 동행 중: 파란 체력 막대만 (여럿이 붙어 있어도 덜 겹치게)
  }
  for (const e of enemies) {
    if (!e.d.nest || e.topY === undefined || !canSee(e.x, e.y)) continue;
    label(PX(e.x, e.y), e.topY - 10, e.d.name, '#f0a8ff', e.hp / e.maxhp, '#d050c0');
  }
}

// ===== 인벤토리 창 그리기 =====
function drawInventory() {
  const g = invGeom(), p = player, hit = invHit(mouse.x, mouse.y);
  ctx.fillStyle = 'rgba(18,16,12,0.94)'; rr(g.x, g.y, g.pw, g.ph, 8); ctx.fill();
  ctx.strokeStyle = '#8c8574'; ctx.lineWidth = 2; ctx.stroke();
  const fk = 1 - (performance.now() - rwFlash) / 1500; // 보석 조합 완성: 테두리가 잠깐 청록으로
  if (fk > 0) { ctx.strokeStyle = `rgba(95,224,200,${fk})`; ctx.lineWidth = 5; ctx.stroke(); ctx.lineWidth = 1; }
  ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#ff8a5a'; ctx.fillText('인벤토리', g.x + 12, g.y + 22);
  ctx.textAlign = 'right'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#887'; ctx.fillText(trade ? '거래 중' : '[I / Tab] 닫기', g.x + g.pw - 12, g.y + 22);
  // 장착 슬롯
  for (let c = 0; c < NSLOT; c++) { // 무기 슬롯 (어떤 무기든) — 잠긴 칸은 무기고를 해제하면 열림
    const sx = slotX(g, c), inst = p.equip[c], open = c < slotsOpen(), canDrop = open && held && !held.inst.kind;
    ctx.fillStyle = open ? '#0c1a10' : '#0b0a08'; ctx.fillRect(sx, g.slotY, g.slotW, g.slotH);
    ctx.strokeStyle = canDrop ? '#ffd27a' : p.slot === c && open ? '#8f8' : open ? '#3a4a3a' : '#2a2620'; ctx.lineWidth = canDrop || (p.slot === c && open) ? 2 : 1;
    ctx.strokeRect(sx + 0.5, g.slotY + 0.5, g.slotW - 1, g.slotH - 1); ctx.lineWidth = 1;
    ctx.textAlign = 'left'; ctx.font = '10px sans-serif'; ctx.fillStyle = open ? '#6a9a70' : '#5a5448'; ctx.fillText(`${c + 1}번 ${open ? (inst ? CAT_NAMES[inst.s.cat] : '빈 슬롯') : '잠김'}`, sx + 4, g.slotY + 12);
    if (inst) drawItemFit(inst, sx + 3, g.slotY + 15, g.slotW - 6, g.slotH - 18);
    else if (!open) { ctx.textAlign = 'center'; ctx.fillStyle = '#6a6458'; ctx.fillText(fitText('무기고 해제 시 열림', g.slotW - 6), sx + g.slotW / 2, g.slotY + 38); }
  }
  // 방어구 칸 (머리·몸·다리)
  GEAR_KEYS.forEach((gk, n) => {
    const sx = arSlotX(g, n), it = p.gear[gk], canDrop = held && held.inst.kind === 'armor' && held.inst.s.slot === gk;
    ctx.fillStyle = '#14120d'; ctx.fillRect(sx, g.arY, g.arW, g.arH);
    ctx.strokeStyle = canDrop ? '#ffd27a' : it ? RARITY[it.rarity].color : '#3a3a30'; ctx.lineWidth = canDrop ? 2 : 1;
    ctx.strokeRect(sx + 0.5, g.arY + 0.5, g.arW - 1, g.arH - 1); ctx.lineWidth = 1;
    ctx.textAlign = 'left'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#8a8270'; ctx.fillText(ARMOR_SLOTS[gk], sx + 4, g.arY + 12);
    if (it) {
      drawIcon(ARMORS[it.id].icon, sx + 4, g.arY + 14, 28, 28);
      ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = RARITY[it.rarity].color; ctx.fillText(fitText(ARMORS[it.id].name, g.arW - 40), sx + 36, g.arY + 26);
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#9cf'; ctx.fillText(`방어 ${Math.round(it.s.def)}`, sx + 36, g.arY + 39);
    }
  });
  // 스킬 칸 (Z X V B): 스킬 쉘을 끼움 — 같은 스킬은 한 칸에만
  for (let k = 0; k < 4; k++) {
    const sx = skSlotX(g, k), sh = p.shells[k], canDrop = held && held.inst.kind === 'shell';
    ctx.fillStyle = '#0d0c18'; ctx.fillRect(sx, g.skY, g.skW, g.skH);
    ctx.strokeStyle = canDrop ? '#ffd27a' : sh ? RARITY[sh.rarity].color : '#34344a'; ctx.lineWidth = canDrop ? 2 : 1;
    ctx.strokeRect(sx + 0.5, g.skY + 0.5, g.skW - 1, g.skH - 1); ctx.lineWidth = 1;
    ctx.textAlign = 'left';
    if (sh) { // 그림 + 이름 (띄어쓰기에서 두 줄로, 등급색)
      drawIcon(SKILLS[sh.id].icon, sx + 4, g.skY + 4, 32, 32);
      const words = SKILLS[sh.id].name.split(' ');
      ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = RARITY[sh.rarity].color;
      words.forEach((w, n) => ctx.fillText(fitText(w, g.skW - 42), sx + 39, g.skY + (words.length > 1 ? 17 + n * 13 : 24)));
    } else { ctx.font = '10px sans-serif'; ctx.fillStyle = '#4a4a5e'; ctx.fillText('스킬 쉘', sx + 40, g.skY + 24); }
    ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#000'; ctx.fillRect(sx + 1, g.skY + g.skH - 14, 13, 13);
    ctx.fillStyle = '#ffd27a'; ctx.fillText(SHELL_SLOTS[k], sx + 3.5, g.skY + g.skH - 3);
  }
  // 계열 공명 (같은 계열 쉘 2·3·4개)
  const res = ATTR_KEYS.filter(k => resTier(k));
  ctx.textAlign = 'left'; ctx.font = '11px sans-serif';
  if (res.length) { let rx = g.x + 12; for (const k of res) { const t = `${ATTRS[k].name} 공명 ${RES_LABEL[resTier(k)]}`; ctx.fillStyle = ATTRS[k].color; ctx.fillText(t, rx, g.skY + g.skH + 15); rx += ctx.measureText(t).width + 12; } }
  else { ctx.fillStyle = '#5a5648'; ctx.fillText('계열 공명: 같은 계열 쉘 2개부터', g.x + 12, g.skY + g.skH + 15); }
  const sb = sortBtn(g), sbh = hit && hit.area === 'sort'; // 가방 정렬 단추
  ctx.fillStyle = sbh ? '#34452f' : '#23211b'; rr(sb.x, sb.y, sb.w, sb.h, 3); ctx.fill();
  ctx.strokeStyle = sbh ? '#cfe8c8' : '#5a5448'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = '11px sans-serif'; ctx.fillStyle = sbh ? '#fff' : '#cfe8c8'; ctx.fillText('정렬', sb.x + sb.w / 2, sb.y + 13);
  // 격자
  ctx.fillStyle = '#0b0a08'; ctx.fillRect(g.gx, g.gy, BAG_W * CELL, bagH() * CELL);
  ctx.strokeStyle = '#26231c'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 0; i <= BAG_W; i++) { ctx.moveTo(g.gx + i * CELL + 0.5, g.gy); ctx.lineTo(g.gx + i * CELL + 0.5, g.gy + bagH() * CELL); }
  for (let j = 0; j <= bagH(); j++) { ctx.moveTo(g.gx, g.gy + j * CELL + 0.5); ctx.lineTo(g.gx + BAG_W * CELL, g.gy + j * CELL + 0.5); }
  ctx.stroke();
  for (const inst of p.bag) drawItemBox(inst, g.gx + inst.gx * CELL, g.gy + inst.gy * CELL, inst.s.size[0] * CELL, inst.s.size[1] * CELL);
  // 개조실에서 고른 강화 대상 표시
  const sel = trade && trade.mode === 'upgrade' && trade.sel;
  if (sel) {
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2;
    const c = p.equip.indexOf(sel), k = p.shells.indexOf(sel), gn = GEAR_KEYS.findIndex(gk => p.gear[gk] === sel);
    if (c >= 0) ctx.strokeRect(slotX(g, c) + 1, g.slotY + 1, g.slotW - 2, g.slotH - 2);
    else if (k >= 0) ctx.strokeRect(skSlotX(g, k) + 1, g.skY + 1, g.skW - 2, g.skH - 2);
    else if (gn >= 0) ctx.strokeRect(arSlotX(g, gn) + 1, g.arY + 1, g.arW - 2, g.arH - 2);
    else ctx.strokeRect(g.gx + sel.gx * CELL + 1, g.gy + sel.gy * CELL + 1, sel.s.size[0] * CELL - 2, sel.s.size[1] * CELL - 2);
  }
  // 놓을 자리 미리보기 (초록: 빈 자리, 노랑: 교체, 빨강: 불가)
  if (held && hit && hit.area === 'grid') {
    const t = heldTarget(held.inst), n = bagOverlaps(held.inst, t.gx, t.gy).length;
    ctx.fillStyle = n === 0 ? 'rgba(80,255,120,0.22)' : n === 1 ? 'rgba(255,220,80,0.22)' : 'rgba(255,60,60,0.25)';
    ctx.fillRect(g.gx + t.gx * CELL, g.gy + t.gy * CELL, held.inst.s.size[0] * CELL, held.inst.s.size[1] * CELL);
  }
  // 보석 주머니: 종류마다 조각난·보통·완벽한 칸 (없으면 흐린 그림), 개수
  ctx.textAlign = 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#9fd28f'; ctx.fillText('보석 주머니', g.gx, g.py - 7);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#6a6458'; ctx.fillText(fitText('가방 칸 차지 없음 · 클릭해 집어서 장비의 소켓(◇)에', BAG_W * CELL - 84), g.gx + 80, g.py - 7);
  for (let n = 0; n < 18; n++) {
    const c = pouchCell(g, n), cnt = p.gemBag[c.id][c.grade], hov = hit && hit.area === 'pouch' && hit.id === c.id && hit.grade === c.grade, sz = [16, 21, 26][c.grade];
    ctx.fillStyle = cnt ? 'rgba(255,255,255,0.07)' : '#0b0a08'; ctx.fillRect(c.x, c.y, CELL - 2, CELL - 2);
    ctx.strokeStyle = hov ? '#fff' : cnt ? GEMS[c.id].color : '#26231c'; ctx.lineWidth = 1; ctx.strokeRect(c.x + 0.5, c.y + 0.5, CELL - 3, CELL - 3);
    ctx.globalAlpha = cnt ? 1 : 0.15; drawIcon(GEMS[c.id].icon, c.x + (CELL - 2 - sz) / 2, c.y + (CELL - 2 - sz) / 2, sz, sz); ctx.globalAlpha = 1;
    if (cnt) { ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#000'; ctx.fillText(cnt, c.x + CELL - 4, c.y + CELL - 4); ctx.fillStyle = '#fff'; ctx.fillText(cnt, c.x + CELL - 5, c.y + CELL - 5); }
  }
  // 하단 정보
  const ld = load(), fy = g.py + 2 * CELL;
  ctx.textAlign = 'left'; ctx.font = '12px sans-serif';
  ctx.fillStyle = ld > maxLoad() ? '#f66' : '#cfe8c8'; ctx.fillText(`무게 ${Math.round(ld)} / ${maxLoad()}`, g.gx, fy + 18);
  ctx.fillStyle = '#ffd27a'; ctx.fillText(`골드 ${p.gold}`, g.gx + 110, fy + 18);
  ctx.fillStyle = '#c8b090'; ctx.fillText(`부품 ${p.parts}`, g.gx + 200, fy + 18);
  ctx.fillStyle = '#9cf'; ctx.fillText(`방어 ${Math.round(gearDef())} (-${pct(defCut(gearDef()))})`, g.gx + 260, fy + 18);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#887';
  ctx.fillText(!trade ? '끌어서 이동·장착 · 우클릭 장착/해제 · 창 밖에 놓으면 버리기'
    : trade.mode === 'upgrade' ? '클릭: 강화·분해·재련할 장비 선택' : trade.mode === 'stash' ? '우클릭: 창고에 보관 · 창고 칸에 끌어다 놓아도 보관' : '우클릭: 판매 · 거래 창에 끌어다 놓아도 판매', g.gx, fy + 36);
  // 툴팁 (거래 중이면 판매가 표시)
  if (!held && hit) {
    const inst = hit.area === 'grid' ? bagItemAt(hit.cx, hit.cy) : hit.area === 'slot' ? p.equip[hit.c] : hit.area === 'skill' ? p.shells[hit.k] : hit.area === 'gear' ? p.gear[hit.g] : null;
    if (inst) {
      const L = itemLines(inst);
      if (trade && trade.mode !== 'upgrade' && trade.mode !== 'stash') L.push({ t: `판매가 ${sellPrice(inst)}G`, c: '#ffd27a', b: true });
      drawTooltip(L, mouse.x - 300, mouse.y + 18);
    }
    if (hit.area === 'pouch') { // 보석 주머니 칸
      const n = p.gemBag[hit.id][hit.grade], gi = gemInfo(hit.id, hit.grade), L = gemTooltip(gi), sell = trade && (trade.mode === 'shop' || trade.mode === 'sell');
      L.splice(1, 0, { t: `보석 주머니에 ${n}개`, c: n ? '#cfe8c8' : '#777' });
      if (n) L.push({ t: sell ? `클릭: 하나 집기 · 우클릭: 하나 판매 (${sellPrice(gi)}G)` : '클릭: 하나 집기 → 소켓이 있는 장비 위에 놓기', c: '#ffd27a', b: true });
      drawTooltip(L, mouse.x - 300, mouse.y - L.length * 17 - 24); // 주머니는 창 아래쪽이라 커서 위에
    }
    if (hit.area === 'sort') drawTooltip([{ t: '가방 정렬', c: '#cfe8c8', b: true }, { t: '큰 장비부터 왼쪽 위로 빈틈없이 다시 놓는다', c: '#ccc' }], mouse.x - 260, mouse.y + 18);
  }
}

function drawParticle(q) {
  const sx = PX(q.x, q.y), sy = PY(q.x, q.y) - q.z, a = clamp(q.life / q.max, 0, 1);
  if (q.smoke) { ctx.fillStyle = q.col + (a * 0.35) + ')'; ctx.beginPath(); ctx.arc(sx, sy, q.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill(); return; }
  ctx.globalAlpha = a; ctx.fillStyle = q.col; ctx.fillRect(sx - q.size / 2, sy - q.size / 2, q.size, q.size); ctx.globalAlpha = 1;
}

function visibleBounds() {
  const pts = [screenToWorld(0, 0), screenToWorld(W, 0), screenToWorld(0, VH + WALLH * 2), screenToWorld(W, VH + WALLH * 2)];
  return {
    i0: Math.max(0, Math.floor(Math.min(...pts.map(p => p.x))) - 1), i1: Math.min(MW - 1, Math.ceil(Math.max(...pts.map(p => p.x))) + 1),
    j0: Math.max(0, Math.floor(Math.min(...pts.map(p => p.y))) - 1), j1: Math.min(MH - 1, Math.ceil(Math.max(...pts.map(p => p.y))) + 1),
  };
}

function render() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!tiles || !player) return;
  const scene = state === 'title', cine = state === 'intro', vh = scene || cine ? H : H - HUD_H; // 타이틀: 플레이어·HUD 없이 화면 전체에 정거장 풍경, 오프닝 컷신: HUD 없이
  if (VH !== vh) { VH = vh; lightC.height = VH; }
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, VH); ctx.clip();
  const { i0, i1, j0, j1 } = visibleBounds();
  if (!inBase && !cine) computeVision();
  drawFloor();
  // 바닥 데칼 / 쓰러진 몬스터 / 장판 효과
  for (const d of decals) { // 핏자국은 그림, 그 밖(그을음·서리·부스러기)은 둥근 자국 — 화면 밖은 건너뜀
    const sx = PX(d.x, d.y), sy = PY(d.x, d.y);
    if (sx < -140 || sx > W + 140 || sy < -90 || sy > VH + 90) continue;
    if (d.splat) drawSplat(d, sx, sy);
    else { ctx.fillStyle = d.col; ctx.globalAlpha = 0.6; isoEllipse(d.x, d.y, d.r); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const c of corpses) drawCorpse(c);
  for (const a of areas) drawArea(a);
  drawGasFog(false);
  drawMissionFloor();
  drawMines();
  // 벽 윗면 텍스처를 카메라에 맞춤
  if (ART.topPat) ART.topPat.setTransform(new DOMMatrix([0.5, 0.25, -0.5, 0.25, W / 2 - cam.x + shx, VH / 2 - cam.y + shy - WALLH]));
  // 깊이 정렬 대상 수집
  const list = [];
  const p = player, psx = PX(p.x, p.y), psy = PY(p.x, p.y), pd = p.x + p.y;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = tileAt(i, j);
    if (t === T.VOID || t === T.FLOOR || t === T.EXIT) continue;
    const sx = PX(i, j), sy = PY(i, j);
    if (sx < -60 || sx > W + 60 || sy < -40 || sy > VH + WALLH + 40) continue;
    const depth = i + j + 1;
    if (t === T.WALL) {
      const bx = sx, by = sy + TH;
      const near = depth > pd + 0.3 && Math.abs(bx - psx) < 70 && by > psy - 10 && by < psy + WALLH + 40;
      list.push({ d: depth, f: drawWall, a: [i, j, near ? 0.3 : 1] });
    } else if (t === T.CRATE) list.push({ d: depth, f: drawCrate, a: [i, j] });
    else if (t === T.TERM) list.push({ d: depth, f: drawTerminal, a: [i, j] });
    else if (t === T.DOOR) list.push({ d: depth, f: drawDoor, a: [i, j] });
    else list.push({ d: depth, f: drawPipe, a: [i, j, t === T.PIPEX] });
  }
  if (!scene && !(cine && intro.t < INTRO.walk[0])) list.push({ d: pd, f: drawPlayer, a: [] }); // 컷신: 폭파 연기 속에서 나타남
  for (const e of enemies) if (canSee(e.x, e.y)) list.push({ d: e.x + e.y, f: drawEnemy, a: [e] }); // 시야 밖의 적은 그리지 않음
  for (const s of survivors) if (s.state !== 'safe' && survivorShown(s)) list.push({ d: s.x + s.y, f: drawSurvivor, a: [s] });
  for (const h of hazards) if (h.type === 'breach') list.push({ d: h.x + h.y, f: drawBreach, a: [h] }); // 벽 면 바로 앞 깊이
  for (const t of turrets) list.push({ d: t.x + t.y, f: drawTurret, a: [t] });
  for (const c of coils) list.push({ d: c.x + c.y, f: drawCoil, a: [c] });
  for (const d of decoys) list.push({ d: d.x + d.y, f: drawDecoy, a: [d] });
  for (const c of chests) list.push({ d: c.x + c.y, f: drawChest, a: [c] });
  for (const sp of spots) list.push({ d: sp.x + sp.y, f: drawSpot, a: [sp] });
  for (const w of wells) list.push({ d: w.x + w.y - 0.6, f: drawWell, a: [w] }); // 바닥 (가운데 구체는 조명 위에)
  for (const b of barrels) list.push({ d: b.x + b.y, f: drawBarrel, a: [b] });
  for (const it of pickups) list.push({ d: it.x + it.y - 0.2, f: drawPickup, a: [it] });
  for (const l of lamps) if (!l.exit) list.push({ d: l.x + l.y, f: drawLamp, a: [l] });
  for (const h of hubs) for (const b of h.edges) list.push({ d: b.d, f: drawBarrier, a: [b, h] });
  list.sort((a, b) => a.d - b.d);
  for (const o of list) o.f(...o.a);
  drawGasFog(true); // 캐릭터 발목까지 덮는 독가스 겹

  // 수류탄
  for (const g of grenades) {
    const sx = PX(g.x, g.y), sy = PY(g.x, g.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, 5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    if (g.warn) { // 폭발하는 정예가 남긴 폭탄·역병 거인의 독액: 떨어질(터질) 곳을 깜박이는 옅은 원으로 예고 (테두리 없음)
      const a = 0.1 + 0.08 * Math.sin(gtime * 16);
      ctx.fillStyle = g.type === 'acid' ? `rgba(150,230,60,${a})` : `rgba(255,60,40,${a})`; isoEllipse(g.tx, g.ty, g.warnR || 2.7); ctx.fill();
    }
    if (g.type === 'pod') drawSprite('bosf', 'abcd'[Math.floor(gtime * 8) % 4], sx, sy - g.z, 0, 0.8); // 오버마인드의 포자
    else if (g.type === 'acid') drawSprite('bal7', Math.floor(gtime * 10) % 2 ? 'b' : 'a', sx, sy - g.z, 0, 1.4); // 역병 거인의 독액 덩어리
    else drawFrame('icon_gren_' + g.type, sx, sy - g.z, 0.6 * Math.min(1, (g.scale || 1) * 1.4));
  }
  for (const q of parts) drawParticle(q);
  for (const f of fxs) drawFx(f);
  // 총알 (에너지·중화기는 Freedoom 탄 스프라이트)
  ctx.lineCap = 'round';
  for (const b of bullets) {
    if (b.delay > 0) continue;
    if (b.kind === 'plasma') { drawSprite('plss', Math.floor(gtime * 20 + b.x * 3) % 2 ? 'b' : 'a', PX(b.x, b.y), PY(b.x, b.y) - (b.z || 14), 0, 0.6); continue; }
    if (b.kind === 'blade') { drawSpin('icon_knife', PX(b.x, b.y), PY(b.x, b.y) - 18, gtime * 25 + b.dir, 26, 7); continue; } // 칼날 부채: 도는 총검
    if (b.kind === 'micro') { drawSprite('misl', 'a', PX(b.x, b.y), PY(b.x, b.y) - (b.z || 16), Math.atan2(b.vy, b.vx), 0.45); continue; } // 유도 미사일
    if (b.kind === 'rocket') { drawSprite('misl', 'a', PX(b.x, b.y), PY(b.x, b.y) - 14, Math.atan2(b.vy, b.vx), 0.75); continue; }
    if (b.kind === 'bfg') { drawSprite('bfs1', Math.floor(gtime * 12) % 2 ? 'b' : 'a', PX(b.x, b.y), PY(b.x, b.y) - 4, 0, 0.9); continue; }
    const l = Math.hypot(b.vx, b.vy), tx = b.x - b.vx / l * 0.7, ty = b.y - b.vy / l * 0.7;
    ctx.strokeStyle = b.col; ctx.lineWidth = b.wid; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(PX(tx, ty), PY(tx, ty) - 22); ctx.lineTo(PX(b.x, b.y), PY(b.x, b.y) - 22); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const s of eshots) {
    const a = Math.atan2(s.vy, s.vx);
    if (s.type === 'rocket') drawSprite('misl', 'a', PX(s.x, s.y), PY(s.x, s.y) - 8, a, 0.9);
    else if (s.type === 'fireball') drawSprite('manf', Math.floor(gtime * 10) % 2 ? 'b' : 'a', PX(s.x, s.y), PY(s.x, s.y) - 8, a, 0.8);
    else if (s.type === 'bullet') { // 감염 해병의 총탄: 짧은 예광선
      const l = Math.hypot(s.vx, s.vy), x1 = s.x - s.vx / l * 0.45, y1 = s.y - s.vy / l * 0.45;
      ctx.strokeStyle = '#ffd890'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PX(x1, y1), PY(x1, y1) - 22); ctx.lineTo(PX(s.x, s.y), PY(s.x, s.y) - 22); ctx.stroke();
    }
    else if (s.type === 'ball') drawSprite('bal7', Math.floor(gtime * 10) % 2 ? 'b' : 'a', PX(s.x, s.y), PY(s.x, s.y) - 10, a, 1.35); // 브루트의 녹색 구체 (크게)
    else if (s.type === 'orb') drawSprite('bal2', Math.floor(gtime * 10) % 2 ? 'b' : 'a', PX(s.x, s.y), PY(s.x, s.y) - 14, a, 0.95); // 아르고스의 구체
    else drawSprite(s.type === 'acid' ? 'bal7' : 'plss', Math.floor(gtime * 10) % 2 ? 'b' : 'a', PX(s.x, s.y), PY(s.x, s.y) - 6, a, 0.8);
  }
  for (const b of beams) { // 번개 (z0: 시작 높이 — 손, 테슬라 코일 꼭대기)
    const z0 = b.z0 || 10;
    ctx.strokeStyle = `rgba(${b.col || '160,220,255'},${Math.min(1, b.t / 0.3)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PX(b.x0, b.y0), PY(b.x0, b.y0) - z0);
    for (let k = 1; k <= 6; k++) { const t = k / 6, x = b.x0 + (b.x1 - b.x0) * t + rnd(-.2, .2) * (k < 6), y = b.y0 + (b.y1 - b.y0) * t + rnd(-.2, .2) * (k < 6); ctx.lineTo(PX(x, y), PY(x, y) - (z0 + (10 - z0) * t) - 8 * (k < 6)); }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  drawLighting();
  drawSkillOverlay(); // 드론·톱날·특이점 구체: 플레이어 곁의 효과라 어둠에 가리지 않게 조명 위에
  drawPillars();      // 감시자의 불기둥 예고
  drawBossFx();       // 보스의 돌진 경로·레이저·충격파
  for (const r of rings) { // 충격파·냉기·붕괴: 퍼지며 흐려지는 고리, 화염 폭풍: 불꽃의 고리 (Freedoom 불꽃)
    const k = r.t / r.max, R = r.R * (0.25 + 0.75 * k);
    if (r.fire) {
      const n = Math.max(8, Math.round(R * 5));
      ctx.globalAlpha = 1 - k * 0.6;
      for (let m = 0; m < n; m++) { const a = m / n * Math.PI * 2, x = r.x + Math.cos(a) * R, y = r.y + Math.sin(a) * R; drawSprite('fire', 'abcdefgh'[(m + Math.floor(gtime * 12)) % 8], PX(x, y), PY(x, y), 0, 0.45); }
      ctx.globalAlpha = 1; continue;
    }
    ctx.strokeStyle = `rgba(${r.col},${1 - k})`; ctx.lineWidth = 5 * (1 - k) + 1;
    isoEllipse(r.x, r.y, R); ctx.stroke(); ctx.lineWidth = 1;
  }
  drawLaser(); // 집중 사격 조준선

  // 자동 조준 대상 표시 (회전하는 붉은 브래킷)
  if (p.target && !p.target.dead && canSee(p.target.x, p.target.y)) {
    const e = p.target, sx = PX(e.x, e.y), sy = PY(e.x, e.y), rx = e.r * 45 + 8, ry = e.r * 22.6 + 4, rot = gtime * 3;
    ctx.strokeStyle = 'rgba(255,80,60,0.9)'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, rot + k * Math.PI / 2, rot + k * Math.PI / 2 + 0.8); ctx.stroke(); }
  }
  // 맞은 방향: 공격이 온 쪽을 가리키는 붉은 호 (캐릭터 둘레)
  for (const h of hurtDirs) {
    const sa = screenAng(Math.cos(h.a), Math.sin(h.a));
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,40,30,${0.85 * h.t})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(psx, psy - 26, 54, sa - 0.38, sa + 0.38); ctx.stroke();
    ctx.strokeStyle = `rgba(255,190,170,${0.6 * h.t})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(psx, psy - 26, 54, sa - 0.28, sa + 0.28); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  if (p.charging > 0) { // 분쇄포 충전: 총구 앞 푸른 구체가 점점 커짐
    const k = 1 - p.charging / (curW().s.charge || 1), mx = PX(p.x + Math.cos(p.aim) * 0.55, p.y + Math.sin(p.aim) * 0.55), my = PY(p.x + Math.cos(p.aim) * 0.55, p.y + Math.sin(p.aim) * 0.55) - 22, r = 5 + 20 * k;
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    g.addColorStop(0, 'rgba(235,245,255,0.95)'); g.addColorStop(0.45, `rgba(130,165,255,${0.55 + 0.35 * k})`); g.addColorStop(1, 'rgba(80,120,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
  }
  // 스태미너 바 (화면 중앙, 캐릭터 발밑) — 소모·회복 중에만 표시
  if (p.staminaBarA > 0) {
    const bw = 64, bh = 6, bx = psx - bw / 2, by = psy + 14;
    ctx.globalAlpha = p.staminaBarA;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = staminaCol(); ctx.fillRect(bx, by, bw * p.stamina / staminaMax(), bh);
    ctx.globalAlpha = 1;
  }
  if (!scene && !cine) { drawLootLabels(); drawEliteLabels(); drawTerminalLabels(); drawMissionLabels(); drawHazardLabels(); }

  // 떠오르는 숫자
  ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life / 0.5, 0, 1);
    ctx.fillStyle = '#000'; ctx.fillText(t.t, PX(t.x, t.y) + 1, PY(t.x, t.y) - t.z + 1);
    ctx.fillStyle = t.col; ctx.fillText(t.t, PX(t.x, t.y), PY(t.x, t.y) - t.z);
  }
  ctx.globalAlpha = 1;

  // 피격 비네트
  if (settings.hurtFx && (hurtFlash > 0 || p.hp < p.maxhp * 0.25)) { // 설정의 피격 화면 효과
    const a = Math.max(hurtFlash * 0.6, p.hp < p.maxhp * 0.25 ? 0.25 + 0.15 * Math.sin(gtime * 6) : 0);
    const g = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.3, W / 2, VH / 2, VH * 0.85);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VH);
  }
  if (settings.hurtFx && hitFlash > 0) { // 맞은 순간 화면 가장자리가 붉게 번쩍
    const g = ctx.createRadialGradient(W / 2, VH / 2, VH * 0.34, W / 2, VH / 2, VH * 0.85);
    g.addColorStop(0, 'rgba(255,30,20,0)'); g.addColorStop(1, `rgba(255,30,20,${0.3 * hitFlash})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, VH);
  }
  if (escape) { ctx.fillStyle = `rgba(255,20,0,${0.06 + 0.05 * Math.sin(gtime * 6)})`; ctx.fillRect(0, 0, W, VH); } // 자폭 경보등
  if (buff('berserk')) { ctx.fillStyle = `rgba(255,40,20,${0.04 + 0.02 * Math.sin(gtime * 8)})`; ctx.fillRect(0, 0, W, VH); } // 광폭화
  if (rift) { ctx.fillStyle = 'rgba(110,40,190,0.07)'; ctx.fillRect(0, 0, W, VH); } // 차원 균열: 보랏빛
  if (p.fx.shock > 0) { ctx.fillStyle = `rgba(120,200,255,${0.05 + Math.random() * 0.06})`; ctx.fillRect(0, 0, W, VH); }
  if (p.fx.poison > 0) { ctx.fillStyle = 'rgba(100,180,30,0.08)'; ctx.fillRect(0, 0, W, VH); }

  if (scene) { // 타이틀: 처음·끝에서 검게 덮음 (길을 다 지나면 처음으로)
    if (titleCam && titleCam.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${titleCam.fade})`; ctx.fillRect(0, 0, W, VH); }
    ctx.restore(); return;
  }
  if (cine) { drawIntro(); ctx.restore(); return; }
  drawTopInfo();
  drawMinimap();
  drawTip();
  drawLog();
  drawSkillBar();
  ctx.restore();
  drawHUD();
  if (state === 'trade') drawTrade();
  if (invOpen && (state === 'play' || state === 'trade')) drawInventory();
  if (perkOpen && state === 'play') drawPerks();
  if (codexOpen && state === 'play') drawCodex();
  drawCursor();
  if (state === 'ending') drawEnding();
}

// ===== 시야 (구역 안에서만): 바라보는 방향의 부채꼴 + 몸 주변 작은 원 + 조명이 비추는 곳, 벽에 가리면 안 보임 =====
const VIEW_HALF = 0.95;   // 시야각 절반 (약 54도 → 전체 약 110도)
const VIEW_RANGE = 13;    // 시야 거리 (타일)
const NEAR_RANGE = 1.8;   // 등 뒤까지 느껴지는 주변 거리
const LAMP_SIGHT = 5;     // 조명 둘레 이 거리(칸)는 손전등을 비추지 않아도 보임 (벽에 가리지 않은 곳만)
const BEAM_HALF = 0.34;   // 손전등 빛줄기 절반 각도
const VIS_RAYS = 360;
let vis = null;           // { len: 방향별 시야 거리, los: 방향별 벽에 가리기 전까지 거리, pts: 바닥 다각형 꼭짓점, walls: 보이는 벽 타일, lit: 가까운 조명 }
const visMark = new Uint8Array(MW * MH); // 1: 보이는 바닥, 2: 보이는 벽
let visList = [];                         // 지난번에 표시한 칸 (넓은 필드 전체를 매번 지우지 않게)
function computeVision() {
  const p = player, x0 = p.x, y0 = p.y, len = new Float32Array(VIS_RAYS), los = new Float32Array(VIS_RAYS), pts = new Array(VIS_RAYS), walls = [];
  const dark = isBlackout(); // 정전: 출구 패드 불빛만 남음
  const lit = lamps.filter(l => (!dark || l.exit) && Math.hypot(l.x - x0, l.y - y0) < VIEW_RANGE + LAMP_SIGHT);
  const lampLit = (x, y) => lit.some(l => (l.x - x) ** 2 + (l.y - y) ** 2 < LAMP_SIGHT * LAMP_SIGHT);
  for (const c of visList) visMark[c] = 0;
  visList = [];
  const mark = (c, v) => { if (!visMark[c]) visList.push(c); visMark[c] = v; };
  mark(Math.floor(y0) * MW + Math.floor(x0), 1);
  for (let k = 0; k < VIS_RAYS; k++) {
    const a = (k + 0.5) / VIS_RAYS * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const max = Math.abs(angDiff(a, p.look)) <= VIEW_HALF ? VIEW_RANGE : NEAR_RANGE;
    // 격자 DDA: 벽 타일에 닿을 때까지 (시야 거리까지). 부채꼴·주변 거리 안이거나 조명이 비추는 칸만 보임
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy);
    let mx = Math.floor(x0), my = Math.floor(y0), t = 0;
    let tx = (dx > 0 ? mx + 1 - x0 : x0 - mx) * tdx, ty = (dy > 0 ? my + 1 - y0 : y0 - my) * tdy;
    for (;;) {
      if (tx < ty) { t = tx; tx += tdx; mx += sx; } else { t = ty; ty += tdy; my += sy; }
      if (t >= VIEW_RANGE) { t = VIEW_RANGE; break; }
      const seen = t < max || (lit.length > 0 && lampLit(mx + 0.5, my + 0.5));
      if (blocksTile(mx, my)) {
        const c = my * MW + mx;
        if (seen && mx >= 0 && my >= 0 && mx < MW && my < MH && visMark[c] !== 2) { mark(c, 2); walls.push(c); }
        break;
      }
      if (seen) mark(my * MW + mx, 1);
    }
    los[k] = t; len[k] = Math.min(t, max); pts[k] = [x0 + dx * len[k], y0 + dy * len[k]];
  }
  // 보이는 바닥에 맞닿은 벽도 보이는 것으로 (스치는 각도에서 빠지는 벽 보정)
  for (const c of visList.slice()) {
    if (visMark[c] !== 1) continue;
    const i = c % MW, j = (c / MW) | 0;
    for (const [ddx, ddy] of DIR4) {
      const ni = i + ddx, nj = j + ddy, n = nj * MW + ni;
      if (ni >= 0 && nj >= 0 && ni < MW && nj < MH && (tiles[n] === T.WALL || doorShut(ni, nj)) && visMark[n] === 0) { mark(n, 2); walls.push(n); }
    }
  }
  vis = { len, los, pts, walls, lit };
  for (const c of visList) if (!mapSeen[c]) revealTile(c);
}
// 시야 안의 지점인지: 부채꼴·주변 거리 안, 또는 가려지지 않았고 조명이 비추는 곳 (기지에서는 모두 보임)
function canSee(x, y) {
  if (inBase || !vis) return true;
  const dx = x - player.x, dy = y - player.y, d = Math.hypot(dx, dy);
  let a = Math.atan2(dy, dx);
  if (a < 0) a += Math.PI * 2;
  const k = Math.floor(a / (Math.PI * 2) * VIS_RAYS) % VIS_RAYS;
  return d <= vis.len[k] + 0.35 || (d <= vis.los[k] + 0.35 && vis.lit.some(l => (l.x - x) ** 2 + (l.y - y) ** 2 < LAMP_SIGHT * LAMP_SIGHT));
}
// 조명이 비추는 바닥: 플레이어에게서 나가는 시선마다 조명 원 안쪽 구간 [d1, d2]를 이은 다각형 (벽에 가린 곳 제외)
function lampRegion(path, l) {
  const x0 = player.x, y0 = player.y, cx = l.x - x0, cy = l.y - y0, cc = cx * cx + cy * cy - LAMP_SIGHT * LAMP_SIGHT;
  let run = [];
  const at = (dx, dy, d) => [PX(x0 + dx * d, y0 + dy * d), PY(x0 + dx * d, y0 + dy * d)];
  const flush = () => {
    if (run.length > 1) {
      run.forEach(([dx, dy, , d2], n) => { const [x, y] = at(dx, dy, d2); n ? path.lineTo(x, y) : path.moveTo(x, y); });
      for (let n = run.length - 1; n >= 0; n--) { const [dx, dy, d1] = run[n]; path.lineTo(...at(dx, dy, d1)); }
      path.closePath();
    }
    run = [];
  };
  for (let k = 0; k <= VIS_RAYS; k++) {
    const kk = k % VIS_RAYS, a = (kk + 0.5) / VIS_RAYS * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    const b = dx * cx + dy * cy, disc = b * b - cc, sq = disc > 0 ? Math.sqrt(disc) : 0, d1 = Math.max(0, b - sq), d2 = Math.min(vis.los[kk], b + sq);
    if (disc <= 0 || d2 <= d1) { flush(); continue; }
    run.push([dx, dy, d1, d2]);
  }
  flush();
}
// 벽 블록(윗면 + 앞 두 면)의 화면 윤곽
function wallHex(path, i, j) {
  const ax = PX(i, j), ay = PY(i, j);
  path.moveTo(ax, ay - WALLH); path.lineTo(ax + TW / 2, ay + TH / 2 - WALLH); path.lineTo(ax + TW / 2, ay + TH / 2);
  path.lineTo(ax, ay + TH); path.lineTo(ax - TW / 2, ay + TH / 2); path.lineTo(ax - TW / 2, ay + TH / 2 - WALLH); path.closePath();
}
// 화면에서 보이는 영역 — main: 바닥 다각형(부채꼴·주변) + 보이는 벽 블록(윗면·앞면) + 보이는 캐릭터 몸, all: main + 조명이 비추는 바닥
function visionPath() {
  const area = new Path2D();
  vis.pts.forEach(([x, y], k) => k ? area.lineTo(PX(x, y), PY(x, y)) : area.moveTo(PX(x, y), PY(x, y)));
  area.closePath();
  for (const c of vis.walls) wallHex(area, c % MW, (c / MW) | 0);
  const blob = (x, y, rx, ry) => { area.moveTo(x + rx, y); area.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
  blob(PX(player.x, player.y), PY(player.x, player.y) - 28, 26, 36);
  // 시야(부채꼴·주변) 바닥 다각형 안쪽인지 — 적의 발밑과 화면에서 머리 위쪽 바닥이 둘 다 안쪽이면 몸 전체가 이미 밝으므로 따로 영역을 붙이지 않음
  // (적이 많을 때 영역 모양이 복잡해지면 조명 그리기가 크게 느려짐)
  const inMain = (x, y) => { const dx = x - player.x, dy = y - player.y; let a = Math.atan2(dy, dx); if (a < 0) a += Math.PI * 2; return Math.hypot(dx, dy) <= vis.len[Math.floor(a / (Math.PI * 2) * VIS_RAYS) % VIS_RAYS] - 0.2; };
  for (const e of enemies) {
    if (!canSee(e.x, e.y) || hiddenE(e)) continue;
    const A = ENEMY_ART[e.type], s = Math.max(A.scale, 0.6) * (e.d.boss ? 1.8 : A.blob || 1);
    if (!e.d.boss && !A.z && !A.blob && !e.z && inMain(e.x, e.y) && inMain(e.x - 1.2, e.y - 1.2)) continue;
    blob(PX(e.x, e.y), PY(e.x, e.y) - (A.z || 0) - (e.z || 0) - 30 * s, 34 * s, 46 * s);
  }
  for (const s of survivors) if (s.state !== 'safe' && survivorShown(s)) blob(PX(s.x, s.y), PY(s.x, s.y) - 28, 26, 36);
  const all = new Path2D(area);
  for (const l of vis.lit) lampRegion(all, l);
  return { main: area, all };
}

// 화면 근처의 보안문 (색 조명용, 다 열린 문은 제외)
const keyDoorsOnScreen = () => doors.filter(d => d.key && d.open < 0.99 && Math.abs(PX(d.x, d.y) - W / 2) < W / 2 + 120 && Math.abs(PY(d.x, d.y) - VH / 2) < VH / 2 + 120);
function drawLighting() {
  const p = player, psx = PX(p.x, p.y), psy = PY(p.x, p.y) - 16, vp = !inBase && vis ? visionPath() : null, area = vp && vp.main;
  const look = (area ? p.look : p.aim) + (p.moving ? Math.sin(p.walk * 1.6) * 0.035 : 0); // 걸을 때 손전등이 살짝 흔들림
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, VH);
  const dark = !inBase && isBlackout(); // 정전: 더 어둡고 조명이 꺼짐 (출구 패드 불빛만)
  lctx.fillStyle = state === 'title' || state === 'intro' ? 'rgba(0,0,0,0.58)' : inBase ? 'rgba(0,0,0,0.42)' : area ? `rgba(0,0,0,${dark ? 0.94 : 0.88})` : 'rgba(0,0,0,0.72)'; // 타이틀은 조명만, 기지는 밝게, 시야 밖은 어둡게
  lctx.fillRect(0, 0, W, VH);
  lctx.globalCompositeOperation = 'destination-out';
  const punch = (x, y, r, a) => {
    if (x < -r || y < -r || x > W + r || y > VH + r || a <= 0) return; // 화면 밖의 빛은 건너뜀 (적이 많을 때)
    const g = lctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const punchIso = (x, y, r, a) => { // 바닥에 눕힌 원 (r: 칸) — 조명이 비추는 바닥, 보이는 범위와 같은 크기라 경계가 자연스럽게 사라짐
    const R = r * 45.25;
    lctx.save(); lctx.translate(x, y); lctx.scale(1, 0.5);
    const g2 = lctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g2.addColorStop(0, `rgba(0,0,0,${a})`); g2.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g2; lctx.fillRect(-R, -R, R * 2, R * 2);
    lctx.restore();
  };
  const L = area ? VIEW_RANGE + 1 : 11, g = lctx.createRadialGradient(psx, psy, 0, psx, psy, L * 40);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  if (area) { // 한 번 본 벽·닫힌 문은 시야 밖이어도 어둑하게 남김 (방 모양을 기억)
    const memo = new Path2D(), { i0, i1, j0, j1 } = visibleBounds();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * MW + i, t = tiles[k];
      if (mapSeen[k] && visMark[k] !== 2 && (t === T.WALL || (t === T.DOOR && doors[doorOf[k]].open < 0.99))) wallHex(memo, i, j);
    }
    lctx.fillStyle = 'rgba(0,0,0,0.33)'; lctx.fill(memo);
  }
  // 화면 근처 조명과 깜박임 밝기
  const lampsOn = lamps.filter(l => !dark || l.exit).map(l => [l, PX(l.x, l.y), PY(l.x, l.y), l.flick ? (Math.sin(gtime * 23 + l.ph) > -0.6 ? 1 : 0.2) : 0.85 + 0.15 * Math.sin(gtime * 2 + l.ph)])
    .filter(([, sx, sy]) => sx > -300 && sx < W + 300 && sy > -300 && sy < VH + 300);
  if (area) {
    // 손전등·주변 밝기는 시야(부채꼴·주변) 안에서만
    lctx.save(); lctx.clip(area);
    const g0 = lctx.createRadialGradient(psx, psy, 0, psx, psy, VIEW_RANGE * 45);
    g0.addColorStop(0, 'rgba(0,0,0,0.66)'); g0.addColorStop(1, 'rgba(0,0,0,0.4)');
    lctx.fillStyle = g0; lctx.fillRect(0, 0, W, VH);
    punch(psx, psy, 150, 0.7);
    // 손전등: 시선을 따라오는 빛줄기 (가려진 곳은 위의 clip이 걸러냄)
    lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(psx, psy);
    for (let k = 0; k <= 24; k++) {
      const a = look - BEAM_HALF + 2 * BEAM_HALF * k / 24;
      lctx.lineTo(PX(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L), PY(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L) - 10);
    }
    lctx.closePath(); lctx.fill();
    for (const [l, sx, sy, fl] of lampsOn) punch(sx, sy - (l.exit ? 0 : 34), l.exit ? 220 : 260, 0.75 * fl); // 시야 안의 조명은 넓게
    lctx.restore();
    // 이후의 빛(조명·폭발 등)은 보이는 영역 안에서만 — 조명이 비추는 곳은 손전등 밖이어도 포함
    lctx.save(); lctx.clip(vp.all);
  } else if (state !== 'title' && state !== 'intro') { // 타이틀 풍경·오프닝 컷신에는 플레이어의 빛이 없음
    punch(psx, psy, 300, 0.95);
    // 손전등: 벽까지 레이캐스트한 부채꼴
    lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(psx, psy);
    for (let k = 0; k <= 32; k++) {
      const a = look - 0.48 + 0.96 * k / 32, ca = Math.cos(a), sa = Math.sin(a);
      let d = 0.3; while (d < L && !blocksShot(p.x + ca * d, p.y + sa * d)) d += 0.25;
      d += 0.6;
      lctx.lineTo(PX(p.x + ca * d, p.y + sa * d), PY(p.x + ca * d, p.y + sa * d) - 10);
    }
    lctx.closePath(); lctx.fill();
  }
  for (const [l, sx, sy, fl] of lampsOn) {
    if (!area) { punch(sx, sy - (l.exit ? 0 : 34), l.exit ? 220 : 260, 0.75 * fl); continue; } // 기지
    punchIso(sx, sy, LAMP_SIGHT, 0.85 * fl); // 손전등 밖이어도 조명이 비추는 바닥 (보이는 범위와 같은 크기)
    if (!l.exit) punch(sx, sy - 34, 150, 0.5 * fl); // 램프 둘레의 벽
  }
  for (const f of flashes) punch(PX(f.x, f.y), PY(f.x, f.y) - 10, f.r, Math.min(1, f.t / f.max * 1.2));
  for (const a of areas) if (a.type === 'fire') punch(PX(a.x, a.y), PY(a.x, a.y), a.r * 90, 0.7);
  for (const e of enemies) if (e.type === 'sparker') punch(PX(e.x, e.y), PY(e.x, e.y) - 26, 70, 0.6);
  for (const it of pickups) if (it.kind === 'weapon' && it.inst.rarity > 0) punch(PX(it.x, it.y), PY(it.x, it.y) - 8, 30 + it.inst.rarity * 18, 0.6);
  for (const t of terminals) punch(PX(t.i + 0.5, t.j + 0.5), PY(t.i + 0.5, t.j + 0.5) - 30, 110, 0.8);
  for (const s of eshots) punch(PX(s.x, s.y), PY(s.x, s.y) - 16, s.type === 'ball' ? 80 : 50, 0.6);
  for (const d of keyDoorsOnScreen()) punch(PX(d.x, d.y), PY(d.x, d.y) - 40, 80, 0.5);
  for (const it of pickups) if (it.kind === 'key') punch(PX(it.x, it.y), PY(it.x, it.y) - 12, 60, 0.75);
  for (const e of enemies) if (e.elite && canSee(e.x, e.y) && !hiddenE(e)) punch(PX(e.x, e.y), PY(e.x, e.y) - 30, 70, 0.45); // 정예는 눈에 띄게
  for (const e of enemies) if (e.d.nest && canSee(e.x, e.y)) punch(PX(e.x, e.y), PY(e.x, e.y) - 30, 80, 0.5);  // 둥지
  for (const s of survivors) if (s.state === 'wait' && canSee(s.x, s.y)) punch(PX(s.x, s.y), PY(s.x, s.y) - 24, 60, 0.6); // 갇힌 생존자의 구조 신호등
  for (const h of hazards) if (h.type === 'breach') punch(PX(h.x, h.y), PY(h.x, h.y) - 34, 120, 0.7); // 선체에 뚫린 구멍 (경보등·불꽃)
  for (const b of bullets) if (b.kind !== 'bullet') punch(PX(b.x, b.y), PY(b.x, b.y) - 16, b.kind === 'bfg' ? 170 : 60, 0.75); // 에너지탄·로켓·분쇄포 구체 빛
  if (area) lctx.restore();
  ctx.drawImage(lightC, 0, 0);
  if (dark) { // 정전: 꺼진 조명 자리에서 붉은 비상등이 천천히 깜박임 (어둠 속에서도 보임, 주변을 밝히지는 않음)
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lamps) {
      const sx = PX(l.x, l.y), sy = PY(l.x, l.y) - 34, a = 0.05 + 0.15 * Math.max(0, Math.sin(gtime * 3 + l.ph));
      if (l.exit || sx < -100 || sx > W + 100 || sy < -100 || sy > VH + 100) continue;
      const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 80);
      g2.addColorStop(0, `rgba(255,30,20,${a})`); g2.addColorStop(1, 'rgba(255,30,20,0)');
      ctx.fillStyle = g2; ctx.fillRect(sx - 80, sy - 80, 160, 160);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // 색 조명 (가산 합성, 보이는 영역 안에서만)
  if (area) { ctx.save(); ctx.clip(vp.all); }
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => {
    if (x < -r || y < -r || x > W + r || y > VH + r || a <= 0) return;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, `rgba(${col},${a})`); g2.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g2; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const l of lamps) {
    const sx = PX(l.x, l.y), sy = PY(l.x, l.y);
    if (sx < -300 || sx > W + 300 || sy < -300 || sy > VH + 300) continue;
    if (dark && !l.exit) continue; // 정전: 꺼진 조명 (비상등은 위에서)
    const fl = l.flick ? (Math.sin(gtime * 23 + l.ph) > -0.6 ? 1 : 0.2) : 1;
    glow(sx, sy - (l.exit ? 0 : 34), 200, l.col, 0.13 * fl);
  }
  for (const f of flashes) glow(PX(f.x, f.y), PY(f.x, f.y) - 10, f.r * 0.6, f.col, 0.35 * f.t / f.max);
  for (const a of areas) if (a.type === 'fire') glow(PX(a.x, a.y), PY(a.x, a.y), a.r * 70, '255,110,30', 0.2);
  for (const b of bullets) if (b.kind !== 'blade' && !(b.delay > 0)) glow(PX(b.x, b.y), PY(b.x, b.y) - (b.kind === 'bullet' ? 22 : b.z || 14), { bullet: 14, plasma: 26, rocket: 30, micro: 20, bfg: 110 }[b.kind] || 14, PROJ_COL[b.kind] || '255,210,120', b.kind === 'bfg' ? 0.5 : 0.3);
  if (player.charging > 0) glow(PX(player.x, player.y), PY(player.x, player.y) - 22, 90, PROJ_COL.bfg, 0.4 * (1 - player.charging)); // 분쇄포 충전
  if (buff('berserk')) glow(PX(player.x, player.y), PY(player.x, player.y) - 24, 80, '255,50,30', 0.28 + 0.1 * Math.sin(gtime * 8)); // 광폭화
  for (const m of mines) if (m.arm <= 0 && Math.sin(gtime * 8 + m.ph) > 0) glow(PX(m.x, m.y), PY(m.x, m.y) - 5, 14, '255,60,40', 0.5); // 작동 중인 지뢰 불빛
  for (const d of drones) glow(PX(d.x, d.y), PY(d.x, d.y) - d.z, 46, '120,230,255', 0.22); // 드론
  for (const c of coils) glow(PX(c.x, c.y), PY(c.x, c.y) - 54, 70, '120,170,255', 0.18 + (c.cool > SKILLS.tesla.rate - 0.12 ? 0.25 : 0)); // 테슬라 코일 (번개 칠 때 번쩍)
  for (const w of wells) glow(PX(w.x, w.y), PY(w.x, w.y) - 18, w.r * 30, '160,90,255', 0.25 + 0.08 * Math.sin(gtime * 9)); // 중력장
  for (const q of pillars) glow(PX(q.x, q.y), PY(q.x, q.y), 60, '255,80,30', 0.15 + 0.25 * (1 - q.t / q.max)); // 불기둥 예고
  for (const e of enemies) if (e.d.thief && !e.dead) glow(PX(e.x, e.y), PY(e.x, e.y) - 24, 60, '255,210,100', 0.22 + 0.08 * Math.sin(gtime * 6)); // 보물 약탈자: 금빛
  for (const e of enemies) if (e.d.ward && !e.dead && canSee(e.x, e.y)) glow(PX(e.x, e.y), PY(e.x, e.y) - 46, 56, '120,220,255', 0.3 + 0.1 * Math.sin(gtime * 7)); // 수호 드론: 눈에 띄게 (먼저 노릴 것)
  for (const it of pickups) if (it.kind === 'weapon' && it.inst.rarity >= 2) glow(PX(it.x, it.y), PY(it.x, it.y) - 8, 40, RARITY[it.inst.rarity].glow, 0.25 + 0.1 * Math.sin(gtime * 4));
  for (const it of pickups) if (it.kind === 'weapon' && (it.inst.uq || it.inst.set)) { // 고유 전설·세트: 바닥에서 솟는 빛기둥 (세트는 초록)
    const x = PX(it.x, it.y), y = PY(it.x, it.y), g2 = ctx.createLinearGradient(0, y - 230, 0, y), gl = RARITY[it.inst.set ? 5 : 4].glow;
    g2.addColorStop(0, `rgba(${gl},0)`); g2.addColorStop(1, `rgba(${gl},${0.32 + 0.1 * Math.sin(gtime * 3)})`);
    ctx.fillStyle = g2; ctx.fillRect(x - 7, y - 230, 14, 230); ctx.fillRect(x - 2, y - 230, 4, 230);
  }
  for (const d of keyDoorsOnScreen()) glow(PX(d.x, d.y), PY(d.x, d.y) - 40, 70, KEYCARDS[d.key].rgb, d.locked ? 0.22 : 0.1);
  for (const it of pickups) if (it.kind === 'key') glow(PX(it.x, it.y), PY(it.x, it.y) - 12, 50, KEYCARDS[it.id].rgb, 0.3 + 0.12 * Math.sin(gtime * 5));
  for (const c of chests) if (!c.open) glow(PX(c.x, c.y), PY(c.x, c.y) - 10, 46, '255,200,90', 0.22 + 0.08 * Math.sin(gtime * 3 + c.x)); // 금고 보물함
  for (const sp of spots) if (sp.type === 'beacon' && sp.state !== 'done') glow(PX(sp.x, sp.y), PY(sp.x, sp.y) - 50, 34, sp.state === 'on' ? '255,70,40' : '255,190,60', sp.state === 'on' ? (Math.sin(gtime * 10) > 0 ? 0.6 : 0.15) : 0.3 + 0.15 * Math.sin(gtime * 3)); // 신호기 머리의 불빛 (켜지면 빨갛게 깜박임)
  for (const e of enemies) if (e.elite && canSee(e.x, e.y) && !hiddenE(e)) glow(PX(e.x, e.y), PY(e.x, e.y) - 24, 60, ELITE_AFFIXES[e.elite[0]].rgb, 0.18 + 0.06 * Math.sin(gtime * 5));
  for (const e of enemies) if (e.d.nest && canSee(e.x, e.y)) glow(PX(e.x, e.y), PY(e.x, e.y) - 28, 70, '220,70,160', 0.2 + 0.08 * Math.sin(e.anim * 4));
  for (const s of survivors) if (s.state === 'wait' && canSee(s.x, s.y)) glow(PX(s.x, s.y), PY(s.x, s.y) - 24, 50, '120,190,255', 0.22 + 0.1 * Math.sin(gtime * 5));
  for (const t of terminals) if (t.kind === 'hack') glow(PX(t.i + 0.5, t.j + 0.5), PY(t.i + 0.5, t.j + 0.5) - 30, 90, t.m && t.m.done ? '90,255,140' : '110,240,220', 0.22);
  for (const h of hazards) if (h.type === 'breach') glow(PX(h.x, h.y), PY(h.x, h.y) - 34, 110, '150,200,255', 0.25 + 0.1 * Math.sin(gtime * 20));
  ctx.globalCompositeOperation = 'source-over';
  if (area) ctx.restore();
}

// ===== 미니맵: 화면 오른쪽 위는 플레이어 둘레, [M]은 필드 전체 (직접 본 곳만 기록) =====
const MM = 2; // 타일 하나의 미니맵 크기 (px)
const mapSeen = new Uint8Array(MW * MH), mapC = document.createElement('canvas'), mapG = mapC.getContext('2d');
mapC.width = (MW + MH) * MM + 4; mapC.height = (MW + MH) * MM / 2 + 4;
let mapBig = false;
const mmX = (x, y) => (x - y) * MM + MH * MM + 2, mmY = (x, y) => (x + y) * MM / 2 + 2;
const MAP_COL = { [T.FLOOR]: '#3b4350', [T.EXIT]: '#3b4350', [T.WALL]: '#8c929c', [T.CRATE]: '#5a5f66', [T.PIPEX]: '#7a4a2a', [T.PIPEY]: '#7a4a2a', [T.TERM]: '#5a8fd0', [T.DOOR]: '#e0a040' };
function revealTile(k) {
  const d = tiles[k] === T.DOOR && doors[doorOf[k]], col = d && d.key ? KEYCARDS[d.key].color : d && d.gate ? '#ff6a3a' : MAP_COL[tiles[k]]; // 보안문은 그 색, 봉쇄 격벽은 주황
  mapSeen[k] = 1;
  if (!col) return;
  const i = k % MW, j = (k / MW) | 0, x = mmX(i, j), y = mmY(i, j);
  mapG.fillStyle = col; mapG.beginPath();
  mapG.moveTo(x, y); mapG.lineTo(x + MM, y + MM / 2); mapG.lineTo(x, y + MM); mapG.lineTo(x - MM, y + MM / 2); mapG.closePath(); mapG.fill();
}
function resetMinimap(all) {
  mapSeen.fill(0); mapG.clearRect(0, 0, mapC.width, mapC.height);
  if (all) for (let k = 0; k < MW * MH; k++) revealTile(k);
}
// 작게: 화면 오른쪽 위에 플레이어 둘레만, 크게([M]): 필드 전체와 구역 이름
function drawMinimap() {
  if (state === 'title' || invOpen || trade || perkOpen || codexOpen) return;
  const R = rift ? null : regions[level];
  let k = 1, w = 230, h = 150, x0 = W - w - 14, y0 = 14, sx = mmX(player.x, player.y) - w / 2, sy = mmY(player.x, player.y) - h / 2;
  if (mapBig) { k = Math.min(2.4, (W - 80) / mapC.width, (VH - 90) / mapC.height); w = mapC.width * k; h = mapC.height * k; x0 = (W - w) / 2; y0 = (VH - h) / 2; sx = sy = 0; }
  const keyRow = !inBase && R && R.locks.length ? 30 : 0; // 아래에 이 구역의 키카드 칸
  ctx.fillStyle = mapBig ? 'rgba(6,8,10,0.55)' : 'rgba(6,8,10,0.6)'; rr(x0 - 8, y0 - 8, w + 16, h + 26 + keyRow, 6); ctx.fill(); // 크게 볼 때도 뒤의 전투가 보이게
  ctx.strokeStyle = '#5a5648'; ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  if (mapBig) ctx.drawImage(mapC, x0, y0, w, h);
  else { // 지도 캔버스 밖은 잘라서
    const a0 = Math.max(0, sx), b0 = Math.max(0, sy), a1 = Math.min(mapC.width, sx + w), b1 = Math.min(mapC.height, sy + h);
    if (a1 > a0 && b1 > b0) ctx.drawImage(mapC, a0, b0, a1 - a0, b1 - b0, x0 + a0 - sx, y0 + b0 - sy, a1 - a0, b1 - b0);
  }
  const at = (wx, wy) => [x0 + (mmX(wx, wy) - sx) * k, y0 + (mmY(wx, wy) - sy) * k], s1 = Math.max(1, k * 0.6);
  if (mapBig && !rift) { // 들어가 본 구역의 이름
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    for (const Rg of regions.slice(1)) {
      if (!flags.visited.includes(Rg.n)) continue;
      const [lx, ly] = at(Rg.bx + FIELD.block / 2, Rg.by + FIELD.block / 2);
      ctx.fillStyle = '#000'; ctx.fillText(`${Rg.n} ${CAMPAIGN[Rg.n - 1].name}`, lx + 1, ly + 1); ctx.fillStyle = Rg.n === level ? '#ffe9a0' : '#a8b8a0'; ctx.fillText(`${Rg.n} ${CAMPAIGN[Rg.n - 1].name}`, lx, ly);
    }
  }
  for (const hb of hubs) { // 찾은 보급 거점 (마지막으로 들른 곳은 밝게)
    if (!hb.found) continue;
    const [hx, hy] = at(hb.pad.i + 0.5, hb.pad.j + 0.5), r = 3.5 * s1;
    ctx.fillStyle = hb.n === lastHub ? '#9ef' : '#4aa8e0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx, hy - r); ctx.lineTo(hx + r, hy); ctx.lineTo(hx, hy + r); ctx.lineTo(hx - r, hy); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const pd of pads) if (pd.kind === 'rift' || pd.kind === 'riftExit') { const [ex, ey] = at(pd.i + 0.5, pd.j + 0.5), s = (pd.kind === 'riftExit' ? 3.5 + Math.sin(gtime * 5) : 3) * s1; ctx.fillStyle = '#c88cff'; ctx.fillRect(ex - s, ey - s, s * 2, s * 2); } // 균열의 패드
  for (const pd of pads) if (pd.kind === 'escape' && escape) { const [ex, ey] = at(pd.i + 0.5, pd.j + 0.5), s = (3 + Math.sin(gtime * 5)) * s1; ctx.fillStyle = '#5f8'; ctx.fillRect(ex - s, ey - s / 2, s * 2, s); }
  for (const t of terminals) if (t.kind === 'armory' && t.state !== 'done' && flags.visited.includes(t.reg)) { // 무기고 (들어가 본 구역만): 주황 고리
    const [tx, ty] = at(t.i + 0.5, t.j + 0.5), r = 2.6 * s1;
    circle(tx, ty, r, '#ffb060');
    ctx.strokeStyle = `rgba(255,176,96,${0.5 + 0.5 * Math.sin(gtime * 4)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tx, ty, r + 3 + 2 * Math.sin(gtime * 4), 0, Math.PI * 2); ctx.stroke();
  }
  for (const t of terminals) {
    if (t.kind !== 'hack' || !t.m || t.m.done || !flags.visited.includes(t.reg)) continue; // 해킹 목표 (들어가 본 구역만): 깜박이는 고리
    const [tx, ty] = at(t.i + 0.5, t.j + 0.5), r = 2.5 * s1;
    circle(tx, ty, r, `rgb(${t.col})`);
    ctx.strokeStyle = `rgba(${t.col},${0.5 + 0.5 * Math.sin(gtime * 5)})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(tx, ty, r + 3 + 2 * Math.sin(gtime * 5), 0, Math.PI * 2); ctx.stroke();
  }
  // 임무 표시 (보지 않은 곳이어도, 들어가 본 구역만): 생존자 구조 신호 (갇힘: 깜박이는 고리), 둥지의 생체 신호
  for (const s of survivors) {
    if ((s.state !== 'wait' && s.state !== 'follow') || !flags.visited.includes(s.reg)) continue;
    const [px, py] = at(s.x, s.y), r = 2.4 * s1;
    circle(px, py, r, '#7fc8ff');
    if (s.state === 'wait') {
      ctx.strokeStyle = `rgba(127,200,255,${0.5 + 0.5 * Math.sin(gtime * 5)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, r + 3 + 2 * Math.sin(gtime * 5), 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (const e of enemies) if (e.d.nest && !e.dead && flags.visited.includes(e.lv)) { const [nx, ny] = at(e.x, e.y); circle(nx, ny, (2.6 + 0.6 * Math.sin(gtime * 4)) * s1, '#e07aff'); }
  // 본 적 있는 고유 정예 (주황 고리), 보물함 (금빛 네모), 필드 사건 (주황 마름모 — 송신 중이면 깜박임)
  for (const e of enemies) if (e.d.thief && !e.dead && e.seenMsg) { const [tx, ty] = at(e.x, e.y); circle(tx, ty, (2.8 + Math.sin(gtime * 10)) * s1, '#ffd27a'); } // 들킨 보물 약탈자 (금빛, 깜박임)
  for (const e of enemies) if ((e.super || e.d.boss) && !e.dead && e.seenMsg) { // 본 고유 정예(주황)·보스(붉은색)
    const [ux, uy] = at(e.x, e.y), r = (e.d.boss ? 3.8 : 3.2) * s1, c = e.d.boss ? '255,80,50' : '255,154,58';
    circle(ux, uy, r, `rgb(${c})`); ctx.strokeStyle = `rgba(${c},0.8)`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ux, uy, r + 3, 0, Math.PI * 2); ctx.stroke();
  }
  for (const c of chests) if (!c.open && mapSeen[Math.floor(c.y) * MW + Math.floor(c.x)]) { const [cx, cy] = at(c.x, c.y), r = 2.6 * s1; ctx.fillStyle = '#ffc040'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
  for (const sp of spots) if (sp.state !== 'done' && mapSeen[Math.floor(sp.y) * MW + Math.floor(sp.x)]) {
    const [qx, qy] = at(sp.x, sp.y), r = (sp.state === 'on' ? 3.5 + Math.sin(gtime * 8) : 3) * s1;
    ctx.fillStyle = sp.state === 'on' ? '#ff5a3a' : '#ffb060'; ctx.beginPath(); ctx.moveTo(qx, qy - r); ctx.lineTo(qx + r, qy); ctx.lineTo(qx, qy + r); ctx.lineTo(qx - r, qy); ctx.closePath(); ctx.fill();
  }
  // 돌발 상황: 새어 나온 독가스, 선체에 뚫린 구멍
  for (const a of areas) if (a.leak) { const [gx, gy] = at(a.x, a.y); ctx.fillStyle = 'rgba(150,220,60,0.3)'; ctx.beginPath(); ctx.arc(gx, gy, a.r * MM * 1.3 * k, 0, Math.PI * 2); ctx.fill(); }
  for (const hz of hazards) if (hz.type === 'breach') { const [bx, by] = at(hz.x, hz.y); circle(bx, by, (3 + Math.sin(gtime * 12)) * s1, '#8cc8ff'); }
  for (const it of pickups) if (it.kind === 'log' && mapSeen[Math.floor(it.y) * MW + Math.floor(it.x)]) { const [lx, ly] = at(it.x, it.y), r = 2.4 * s1; ctx.fillStyle = '#5ad2ff'; ctx.fillRect(lx - r, ly - r, 2 * r, 2 * r); } // 데이터 기록 (본 곳)
  // 키카드: 본 곳에 떨어져 있는 것만 (색 마름모)
  for (const it of pickups) {
    if (it.kind !== 'key' || !mapSeen[Math.floor(it.y) * MW + Math.floor(it.x)]) continue;
    const [kx, ky] = at(it.x, it.y), s = 3.5 * s1;
    ctx.fillStyle = KEYCARDS[it.id].color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(kx, ky - s); ctx.lineTo(kx + s, ky); ctx.lineTo(kx, ky + s); ctx.lineTo(kx - s, ky); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const e of enemies) {
    if (e.dead || e.d.nest || !canSee(e.x, e.y) || ghost(e)) continue; // 지금 보이는 적만 (둥지는 위에서, 드러나지 않은 그림자 추적자는 빼고)
    const [ex, ey] = at(e.x, e.y);
    circle(ex, ey, (e.d.boss ? 3.5 : e.elite ? 2.6 : 1.8) * s1, e.d.boss ? '#ff9933' : e.elite ? '#ffcc55' : '#ff5a4a');
  }
  // 플레이어: 바라보는 방향 삼각형
  const [px, py] = at(player.x, player.y), a = player.aim, ax = Math.cos(a) - Math.sin(a), ay = (Math.cos(a) + Math.sin(a)) / 2, l = Math.hypot(ax, ay);
  const ux = ax / l, uy = ay / l, r = 5 * s1;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + ux * r, py + uy * r); ctx.lineTo(px - ux * r * 0.6 - uy * r * 0.6, py - uy * r * 0.6 + ux * r * 0.6); ctx.lineTo(px - ux * r * 0.6 + uy * r * 0.6, py - uy * r * 0.6 - ux * r * 0.6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#9a9484';
  ctx.fillText(`${rift ? `차원 균열 ${rift.tier}단계` : inBase || !R ? '우주 기지' : `구역 ${level} ${CAMPAIGN[level - 1].name}`} · [M] ${mapBig ? '작게' : '전체 지도'}`, x0, y0 + h + 12);
  if (keyRow) { // 이 구역의 키카드 칸 (주운 것은 밝게)
    const ky = y0 + h + 20;
    ctx.fillText('키카드', x0, ky + 15);
    R.locks.forEach((c, n) => {
      const K = KEYCARDS[c], has = keysHeld.has(`${level}:${c}`), bx = x0 + 40 + n * 30;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, ky, 24, 24);
      ctx.globalAlpha = has ? 1 : 0.45; ctx.strokeStyle = K.color; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, ky + 0.5, 23, 23);
      ctx.globalAlpha = has ? 1 : 0.2; drawIcon(K.spr + 'a0', bx + 3, ky + 2, 18, 20); ctx.globalAlpha = 1;
    });
  }
}
function drawTopInfo() {
  // 메시지 로그 (거래 창이 열려 있으면 가려지므로 생략)
  ctx.textAlign = 'left'; ctx.font = '14px sans-serif';
  let top = 26;
  const box = !inBase && !trade && objectiveBox(); // 구역 목표: 임무 진행 / 구역 이름과 길목(봉쇄 격벽) 상태
  if (box) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(box.t).width + 22, h = box.frac === undefined ? 28 : 34;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(10, 8, w, h, 5); ctx.fill();
    ctx.strokeStyle = box.edge; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = box.col; ctx.fillText(box.t, 21, 28);
    if (box.frac !== undefined) { // 해킹 진행 막대
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(21, 34, w - 22, 4);
      ctx.fillStyle = box.edge; ctx.fillRect(21, 34, (w - 22) * box.frac, 4);
    }
    top = 30 + h; ctx.font = '14px sans-serif';
  }
  if (!trade) msgs.forEach((m, k) => { ctx.globalAlpha = clamp(m.life, 0, 1); ctx.fillStyle = '#000'; ctx.fillText(m.t, 17, top + 1 + k * 20); ctx.fillStyle = m.col; ctx.fillText(m.t, 16, top + k * 20); });
  ctx.globalAlpha = 1;
  // 상태이상 칩
  const f = player.fx, chips = hazards.filter(h => h.type === 'blackout').map(h => ['⚠ ' + EVENTS[h.type].name, h.t, EVENTS[h.type].color]); // 정전 남은 시간 먼저 (독가스·선체 파손은 그 자리에 표지 — drawHazardLabels)
  if (!inBase && inHub()) chips.unshift(contested() ? ['거점 방어 중 — 싸울 수 있음', null, '#ff9a6a'] : ['안전 지대', null, '#7fd8ff']); // 보급 거점 안 (시간 없음)
  if (f.poison > 0) chips.push(['중독', f.poison, '#9e4']);
  if (f.burn > 0) chips.push(['화상', f.burn, '#f83']);
  if (f.shock > 0) chips.push(['감전', f.shock, '#fd4']);
  if (f.curse > 0) chips.push(['저주 (방어 절반)', f.curse, '#b08aff']);
  if (f.regen > 0) chips.push(['나노 회복', f.regen / 14, '#6ef']);
  if (f.adren > 0) chips.push(['아드레날린', f.adren, '#f8c']);
  if (f.immP > 0) chips.push(['중독 면역', f.immP, '#ad8']);
  if (f.immS > 0) chips.push(['감전 면역', f.immS, '#ed8']);
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  const chipText = (n, t) => t === null ? n : `${n} ${t.toFixed(1)}s`;
  const cw = chips.map(([n, t]) => Math.max(96, Math.ceil(ctx.measureText(chipText(n, t)).width) + 16)); // 글이 길면 칩도 넓게
  let x = W / 2 - (cw.reduce((s, w) => s + w + 4, 0) - 4) / 2;
  chips.forEach(([n, t, c], k) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, 10, cw[k], 22);
    ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, 10.5, cw[k] - 1, 21);
    ctx.fillStyle = c; ctx.fillText(chipText(n, t), x + cw[k] / 2, 25);
    x += cw[k] + 4;
  });
  drawBossBar();
  if (escape) { // 자폭 카운트다운 (15초 남으면 깜박임)
    const t = Math.max(0, escape.t), s = `자폭까지 ${z2(Math.floor(t / 60))}:${z2(Math.floor(t % 60))}.${Math.floor(t * 10) % 10}`;
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    const w = ctx.measureText(s).width + 32;
    ctx.fillStyle = 'rgba(40,0,0,0.78)'; rr(W / 2 - w / 2, 40, w, 42, 6); ctx.fill();
    ctx.strokeStyle = '#f44'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = t < 15 && Math.sin(gtime * 12) > 0 ? '#fff' : '#ff5a4a'; ctx.fillText(s, W / 2, 70);
  }
  // 마우스 아래 적 이름 (원작 스타일)
  const m = screenToWorld(mouse.x, mouse.y + 14);
  let best = null, bd = 0.9;
  for (const e of enemies) { const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd && canSee(e.x, e.y) && !ghost(e) && !hiddenE(e)) { bd = d; best = e; } }
  const mi = Math.floor(m.x), mj = Math.floor(m.y), md = !best && tileAt(mi, mj) === T.DOOR ? doors[doorOf[mj * MW + mi]] : null, K = md && md.key && KEYCARDS[md.key], G = md && md.gate;
  const crate = !best && !inBase && tileAt(mi, mj) === T.CRATE; // 상자: 부술 수 있다는 안내
  const label = best ? `${best.name || best.d.name}  (${Math.ceil(best.hp)})${best.d.armor ? ` — 장갑: 한 발마다 피해 -${best.d.armor}` : ''}${shieldOf(best) ? ` — 정면 방패 ${Math.round(shieldDur(best) * 100)}%: 옆·뒤를 노리거나 부숴라` : best.shieldBroken ? ' — 방패 부서짐' : ''}${best.raised ? ' — 되살아남' : ''}${best.elite ? ' — ' + best.elite.map(k => ELITE_AFFIXES[k].desc).join(' · ') : ''}`
    : crate ? '보급 상자 — 근접 공격으로 부술 수 있음'
    : !md ? '' : G ? gateMsg(G) : !K ? '자동문' : !md.locked ? K.door : keysHeld.has(`${md.kr}:${md.key}`) ? `${K.door} — 다가가면 열림` : `${K.door} — ${K.name} 필요`;
  if (label) {
    ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
    const ly = inBase ? VH - 12 : VH - 70; // 구역에서는 스킬 칸 위에
    ctx.fillStyle = '#000'; ctx.fillText(label, W / 2 + 1, ly + 1);
    ctx.fillStyle = K ? K.color : G ? '#ff9a6a' : '#d8f0c8'; ctx.fillText(label, W / 2, ly);
  }
  if (autoNote > 0) { // 거점 자동 저장 (오른쪽 아래)
    ctx.globalAlpha = clamp(autoNote, 0, 1); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = '#000'; ctx.fillText('✔ 자동 저장됨', W - 15, VH - 13); ctx.fillStyle = '#9fe0a0'; ctx.fillText('✔ 자동 저장됨', W - 16, VH - 14);
    ctx.globalAlpha = 1;
  }
}

// ===== HUD =====
function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
function lcd(x, y, w, h, on) {
  ctx.fillStyle = '#2b2a24'; rr(x - 3, y - 3, w + 6, h + 6, 5); ctx.fill();
  ctx.fillStyle = on ? '#12401c' : '#0b1d0f'; rr(x, y, w, h, 3); ctx.fill();
  if (on) { ctx.strokeStyle = '#8f8'; ctx.lineWidth = 1.5; rr(x, y, w, h, 3); ctx.stroke(); }
}
function drawHUD() {
  const p = player, y0 = VH;
  const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#8e8775'); g.addColorStop(1, '#4b463a');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, HUD_H);
  // 경험치 막대 (HUD 윗변) + 남은 특성 점수 안내
  ctx.fillStyle = '#1a1712'; ctx.fillRect(0, y0, W, 5);
  ctx.fillStyle = '#c9a03a'; ctx.fillRect(0, y0, W * p.xp / xpNeed(p.clv), 5);
  if ((p.pts > 0 || p.apts > 0) && state !== 'title') {
    const t = `성장 점수 — 특성 ${p.pts} · 능력치 ${p.apts} — [K] 성장 창`;
    ctx.textAlign = 'right'; ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#000'; ctx.fillText(t, W - 15, y0 - 9);
    ctx.fillStyle = Math.sin(gtime * 6) > 0 ? '#fff2a0' : '#ffc850'; ctx.fillText(t, W - 16, y0 - 10);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 6; x < W; x += 60) { circle(x, y0 + 8, 2, 'rgba(0,0,0,0.3)'); circle(x, H - 6, 2, 'rgba(0,0,0,0.3)'); }

  const TRK = 210, STAT = 270, left = 14, LA = W - TRK - STAT - 30;
  // 무기 슬롯 1~4 (잠긴 칸은 무기고를 해제하면 열림)
  const sw = Math.min(170, (LA - (NSLOT - 1) * 10) / NSLOT);
  const ci = curW(), cw = ci.s;
  for (let c = 0; c < NSLOT; c++) {
    const x = left + c * (sw + 10), y = y0 + 12, open = c < slotsOpen(), on = open && p.slot === c, inst = p.equip[c];
    lcd(x, y, sw, 38, on);
    ctx.textAlign = 'left'; ctx.font = 'bold 22px monospace';
    ctx.fillStyle = inst ? (on ? '#bfffbf' : '#4f9f5f') : open ? '#1f3f25' : '#2a2a22';
    ctx.fillText(String(c + 1), x + 6, y + 27);
    if (inst) {
      drawWeaponIcon(inst.id, x + 26, y + 2, sw - 30, 22);
      ctx.font = '10px sans-serif'; ctx.fillStyle = itemColor(inst); ctx.fillText(fitText(inst.name, sw - 30), x + 26, y + 35);
    } else { ctx.font = '11px sans-serif'; ctx.fillStyle = open ? '#3a6a45' : '#4a4a3e'; ctx.fillText(open ? '빈 슬롯' : '잠김 — 무기고', x + 28, y + 23); }
  }
  // 현재 무기
  const by = y0 + 64, wW = Math.min(230, LA * 0.32);
  lcd(left, by, wW, 56, true);
  if (ci !== FISTS) drawWeaponIcon(ci.id, left + wW - 92, by + 4, 86, 24);
  ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = RARITY[ci.rarity].color; ctx.fillText(fitText(ci.name, wW - 104), left + 8, by + 17);
  if (cw.type === 'gun') {
    ctx.font = 'bold 22px monospace'; ctx.fillStyle = ci.mag ? '#bfffbf' : '#f66';
    ctx.fillText(`${ci.mag}/${cw.mag}`, left + 8, by + 44);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#8fbf8f'; ctx.fillText(`${AMMO[cw.ammo].name} ${p.ammo[cw.ammo]}`, left + wW * 0.55, by + 44);
    if (p.reload > 0) { ctx.fillStyle = '#ffd27a'; ctx.fillRect(left + 8, by + 49, (wW - 16) * (1 - p.reload / p.reloadMax), 3); }
    if (cw.spin) { ctx.fillStyle = '#f84'; ctx.fillRect(left + wW - 10, by + 52 - 40 * p.spin, 4, 40 * p.spin); }
  } else { ctx.font = '13px sans-serif'; ctx.fillStyle = '#8fbf8f'; ctx.fillText(`근접 무기 — ${cw.saw ? `초당 스태미너 ${Math.round(cw.stamina / cw.rate)}` : `1회 스태미너 ${cw.stamina}`}`, left + 8, by + 42); }
  // 수류탄
  const gx = left + wW + 14, gW = Math.min(150, LA * 0.2);
  lcd(gx, by, gW, 56, false);
  const gr = GRENADES[p.gsel];
  ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = gr.color; ctx.fillText(gr.name, gx + 8, by + 17);
  ctx.font = 'bold 22px monospace'; ctx.fillText(`x${p.gren[p.gsel]}`, gx + 8, by + 44);
  drawIcon('icon_gren_' + p.gsel, gx + gW - 34, by + 20, 26, 30);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#7a9a7a'; ctx.fillText('[G] [우클릭]', gx + 52, by + 44);
  // 아이템 스트립
  const ix = gx + gW + 14, keysAll = [...MED_ORDER.slice().reverse(), ...SPECIAL_ITEMS];
  const iw = Math.max(34, Math.min(52, (left + LA - ix) / keysAll.length - 4));
  keysAll.forEach((k, n) => {
    const x = ix + n * (iw + 4);
    lcd(x, by, iw, 56, false);
    ctx.textAlign = 'center';
    ctx.globalAlpha = p.items[k] ? 1 : 0.35; drawIcon(ITEM_ART[k][0], x + 4, by + 3, iw - 8, 18); ctx.globalAlpha = 1;
    ctx.font = '9px sans-serif'; ctx.fillStyle = ITEMS[k].color; ctx.fillText(ITEMS[k].short, x + iw / 2, by + 30);
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = p.items[k] ? '#dfffd0' : '#2f5f35'; ctx.fillText(p.items[k], x + iw / 2, by + 44);
    ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#9fd09f'; ctx.fillText(`[${ITEM_KEY_LABEL[k]}]`, x + iw / 2, by + 54); // 단축키
  });
  // 스탯
  const sx = W - TRK - STAT - 10;
  ctx.fillStyle = '#2b2a24'; rr(sx, y0 + 10, STAT, HUD_H - 20, 5); ctx.fill();
  // HP 줄무늬 막대 (원작 스타일)
  const hx = sx + 10, hy = y0 + 18, hw = 60, hh = 92, n = 12, f = p.hp / p.maxhp;
  for (let k = 0; k < n; k++) {
    const yy = hy + hh - (k + 1) * (hh / n), on = (k + 0.5) / n <= f;
    const t = k / (n - 1);
    ctx.fillStyle = on ? `rgb(${230 - t * 120 | 0},${30 + t * 20 | 0},${60 + t * 180 | 0})` : '#2a1a22';
    ctx.fillRect(hx, yy + 1, hw, hh / n - 3);
  }
  ctx.textAlign = 'left'; ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#eee';
  ctx.fillText(`${Math.ceil(p.hp)}/${p.maxhp}`, hx + hw + 10, hy + 14);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#ffe08a'; ctx.fillText(`Lv ${p.clv}`, sx + STAT - 10, hy + 14); // 캐릭터 레벨
  ctx.textAlign = 'left';
  // 아머 / 스태미너 막대
  const bar = (label, y, frac, col) => {
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#9ab'; ctx.fillText(label, hx + hw + 10, y + 9);
    ctx.fillStyle = '#1a1f2a'; ctx.fillRect(hx + hw + 56, y, 120, 9);
    ctx.fillStyle = col; ctx.fillRect(hx + hw + 56, y, 120 * frac, 9);
  };
  bar('ARMOR', hy + 22, p.armor / 100, '#79f');
  bar('STAMINA', hy + 37, p.stamina / staminaMax(), staminaCol());
  const ld = load();
  ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif';
  ctx.fillText('LOAD', hx + hw + 10, hy + 64); ctx.fillStyle = ld > maxLoad() ? '#f66' : '#dfffd0'; ctx.font = 'bold 14px monospace'; ctx.fillText(`${Math.round(ld)} / ${maxLoad()}`, hx + hw + 56, hy + 64);
  ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif'; ctx.fillText('GOLD', hx + hw + 10, hy + 80);
  ctx.fillStyle = '#ffd27a'; ctx.font = 'bold 14px monospace'; ctx.fillText(String(p.gold), hx + hw + 56, hy + 80);
  ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif'; ctx.fillText('KILLS', hx + hw + 10, hy + 96);
  ctx.fillStyle = '#dfffd0'; ctx.font = 'bold 14px monospace'; ctx.fillText(String(kills), hx + hw + 56, hy + 96);
  if (p.dashCd > 0) { ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.fillText(`회피 ${p.dashCd.toFixed(1)}`, hx + hw + 150, hy + 96); }
  drawTracker(W - TRK - 4, y0 + 6, TRK, HUD_H - 12);
}
function drawTracker(x, y, w, h) {
  const p = player;
  ctx.fillStyle = '#3a382e'; rr(x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = '#081a0e'; rr(x + 8, y + 8, w - 16, h - 16, 8); ctx.fill();
  ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#7fdf9f'; ctx.fillText('Tracker', x + w / 2, y + 24);
  const cx = x + w / 2, cy = y + h / 2 + 6, R = Math.min(w, h) / 2 - 22, range = 24;
  ctx.strokeStyle = 'rgba(100,220,140,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.stroke();
  const sweep = gtime * 2;
  ctx.strokeStyle = 'rgba(100,255,150,0.4)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();
  const toR = (dx, dy) => { let rx = (dx - dy) * 0.707, ry = (dx + dy) * 0.707; const l = Math.hypot(rx, ry); const s = R / range; if (l > range) { rx *= range / l; ry *= range / l; } return [cx + rx * s, cy + ry * s]; };
  let nearest = 1e9, around = 0;
  for (const e of enemies) {
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    nearest = Math.min(nearest, d);
    if (d > range) continue;
    around++;
    const [bx, by] = toR(dx, dy); circle(bx, by, e.d.boss ? 5 : e.elite || e.d.cost >= 4 || e.d.thief ? 3.5 : 2.2, e.d.boss ? '#ff9933' : e.d.nest ? '#e07aff' : e.d.thief ? '#ffd27a' : e.elite ? '#ffcc55' : e.aggro ? '#f66' : '#dfd');
  }
  for (const s of survivors) { // 생존자 (멀면 가장자리에 방향만, 갇힌 생존자는 깜박임)
    if ((s.state !== 'wait' && s.state !== 'follow') || (s.state === 'wait' && Math.sin(gtime * 6) < -0.3)) continue;
    const [bx, by] = toR(s.x - p.x, s.y - p.y); circle(bx, by, 3, '#7fc8ff');
  }
  const esc = escape && pads.find(pd => pd.kind === 'escape'), hb = !inBase && !esc && nearestHubPad(p.x, p.y); // 탈출정 (자폭 중) 또는 가장 가까운 거점
  if (esc || hb) { const [ex, ey] = toR((esc ? esc.i : hb.pad.i) + 0.5 - p.x, (esc ? esc.j : hb.pad.j) + 0.5 - p.y); ctx.fillStyle = esc ? '#5f8' : '#4aa8e0'; ctx.fillRect(ex - 3, ey - 3, 6, 6); }
  circle(cx, cy, 2, '#fff');
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = nearest < 5 ? '#f55' : '#7fdf9f';
  ctx.fillText(nearest < 1e8 ? `${Math.round(nearest)}M` : '--', cx, y + h - 14);
  ctx.textAlign = 'left'; ctx.font = '10px sans-serif'; ctx.fillStyle = '#5a9a6a';
  ctx.fillText(inBase ? '우주 기지' : rift ? `균열 ${rift.tier}단계` : `구역 ${level}/${CAMPAIGN.length}`, x + 14, y + h - 14);
  ctx.textAlign = 'right'; ctx.fillText(`주변 적 ${around}`, x + w - 14, y + h - 14);
}
function drawCursor() {
  if (state !== 'play' && state !== 'trade') return;
  const x = mouse.x, y = mouse.y, p = player;
  if (held) { // 들고 있는 무기
    const [w, h] = held.inst.s.size;
    ctx.globalAlpha = 0.85; drawItemBox(held.inst, x - w * CELL / 2, y - h * CELL / 2, w * CELL, h * CELL); ctx.globalAlpha = 1;
  }
  if (state === 'trade' || (invOpen && (held || invHit(x, y))) || (perkOpen && perkHit(x, y)) || (codexOpen && codexHit(x, y))) { // 인벤토리·거래·성장·도감 창에서는 화살표
    ctx.fillStyle = '#eee'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.lineTo(x + 4, y + 12); ctx.lineTo(x + 11, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.strokeStyle = '#8f8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 14, y); ctx.moveTo(x, y - 14); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 14); ctx.stroke();
  }
  if (state !== 'play') return;
  // 재장전 중: 커서 둘레에 차오르는 링
  if (p.reload > 0) {
    const f = 1 - p.reload / p.reloadMax;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); ctx.stroke();
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText('재장전', x + 1, y + 35); ctx.fillStyle = '#ffd27a'; ctx.fillText('재장전', x, y + 34);
  }
  const gt = guideTarget();
  if (gt && !(perkOpen && perkHit(x, y)) && !(invOpen && invHit(x, y)) && !(codexOpen && codexHit(x, y))) drawExitGuide(x, y, gt); // 창 위에서는 숨김
}
// 길안내 목표: 자폭 중이면 탈출정, 생존자와 함께면 가장 가까운 거점 패드, 해킹 중 단말기에서 벗어나면 단말기
function guideTarget() {
  if (inBase) return null;
  if (rift) { const pd = rift.done && pads.find(q => q.kind === 'riftExit'); return pd ? { i: pd.i, j: pd.j, label: '출구', col: '#c88cff', text: '#e6c8ff' } : null; } // 균열: 돌파하면 나가는 패드
  const esc = escape && pads.find(pd => pd.kind === 'escape');
  if (esc) return { i: esc.i, j: esc.j, label: '탈출정', col: '#5f8', text: '#7f9' };
  if (survivors.some(s => s.state === 'follow')) { const h = nearestHubPad(player.x, player.y); return { i: h.pad.i, j: h.pad.j, label: '대피', col: '#7fc8ff', text: '#9cf' }; }
  if (hackM && hackM.on && !hackM.done && !hackM.near) return { i: hackM.term.i, j: hackM.term.j, label: '단말기', col: '#6ff0d8', text: '#8ff0e0' };
  if (armoryOn && !armoryOn.near) return { i: armoryOn.i, j: armoryOn.j, label: '무기고', col: '#ffb060', text: '#ffd27a' };
  if (beaconOn && !beaconOn.near) return { i: Math.floor(beaconOn.x), j: Math.floor(beaconOn.y), label: '신호기', col: '#ffb060', text: '#ffd27a' };
  return null;
}
// 길안내: 목표 칸까지 걸어갈 길의 몇 칸 앞을 향하는 방향과 남은 거리
let exitDist = null, exitKey = -1; // 목표 칸에서 잰 거리표 (목표가 바뀌거나 상자가 부서지면 다시 계산)
// 몸통 크기로 곧장 걸어갈 수 있는 직선인지 (벽·상자·파이프·닫힌 문)
function walkLine(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.2);
  for (let k = 1; k <= n; k++) if (collides(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, player.r, false)) return false;
  return true;
}
function exitGuide(ti, tj) {
  const p = player, i0 = Math.floor(p.x), j0 = Math.floor(p.y);
  if (!exitDist || exitKey !== tj * MW + ti) { exitDist = bfs(ti, tj); exitKey = tj * MW + ti; }
  const left = exitDist[j0 * MW + i0];
  let tx = ti + 0.5, ty = tj + 0.5;
  if (left > 2) { // 길을 따라가며, 벽에 가리지 않고 곧장 보이는 가장 먼 칸을 향함 (모서리에 걸리지 않게)
    let i = i0, j = j0, d = left, aim = null;
    for (let s = 0; s < 8; s++) {
      let next = null;
      for (const [dx, dy] of DIR4) { const v = exitDist[(j + dy) * MW + i + dx]; if (v >= 0 && v < d) { d = v; next = [i + dx, j + dy]; } }
      if (!next) break;
      [i, j] = next;
      if (aim && !walkLine(p.x, p.y, i + 0.5, j + 0.5)) break;
      aim = [i, j];
    }
    if (aim) { tx = aim[0] + 0.5; ty = aim[1] + 0.5; }
  }
  return { ang: Math.atan2(ty - p.y, tx - p.x), dist: left >= 0 ? left : Math.round(Math.hypot(ti + 0.5 - p.x, tj + 0.5 - p.y)) };
}
function drawExitGuide(x, y, gt) {
  const g = exitGuide(gt.i, gt.j), sx = Math.cos(g.ang) - Math.sin(g.ang), sy = (Math.cos(g.ang) + Math.sin(g.ang)) * 0.5, l = Math.hypot(sx, sy) || 1;
  const ux = sx / l, uy = sy / l, ax = x + ux * 32, ay = y + uy * 32;
  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(gtime * 6);
  ctx.fillStyle = gt.col; ctx.strokeStyle = '#03180f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax + ux * 12, ay + uy * 12); ctx.lineTo(ax - uy * 8 - ux * 5, ay + ux * 8 - uy * 5); ctx.lineTo(ax + uy * 8 - ux * 5, ay - ux * 8 - uy * 5);
  ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.globalAlpha = 1;
  const t = `${gt.label} ${g.dist}M`, lx = x + ux * 62, ly = y + uy * 62 + 4;
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#000'; ctx.fillText(t, lx + 1, ly + 1); ctx.fillStyle = gt.text; ctx.fillText(t, lx, ly);
}

// ===== 화면 전환 / 메뉴: menu.js (showOverlay·screen·타이틀·불러오기·설정·일시정지 등) =====

// ===== 저장 (브라우저 localStorage: 슬롯 3개 + 저장 기록) =====
const SAVE_KEY = 'voidstation.saves.v1', SLOTS = 3;
let playtime = 0;
function readSaves() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && Array.isArray(s.slots)) return s;
  } catch (e) { /* 저장소를 쓸 수 없거나 내용이 깨짐 → 빈 저장 */ }
  return { slots: Array(SLOTS).fill(null), log: [] };
}
function writeSaves(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
}
const packWeapon = w => w && (w.kind === 'gem' ? { kind: 'gem', id: w.id, grade: w.grade, gx: w.gx, gy: w.gy } // 무기·스킬 쉘·방어구·보석
  : w.kind === 'shell' ? { kind: 'shell', id: w.id, rarity: w.rarity, affixes: w.affixes, gx: w.gx, gy: w.gy, uq: w.uq || undefined }
  : w.kind === 'armor' ? { kind: 'armor', id: w.id, rarity: w.rarity, affixes: w.affixes, plus: w.plus || 0, gx: w.gx, gy: w.gy, sockets: w.sockets || 0, gems: w.gems || [], set: w.set }
  : { id: w.id, rarity: w.rarity, affixes: w.affixes, plus: w.plus || 0, mag: w.mag, gx: w.gx, gy: w.gy, uq: w.uq, sockets: w.sockets || 0, gems: w.gems || [], set: w.set });
const okGems = d => (d.gems || []).filter(g => GEMS[g.id]); // 없어진 보석 종류는 버림
function unpackWeapon(d) {
  if (!d) return null;
  if (d.kind === 'gem') { if (!GEMS[d.id]) return null; const g = makeGem(d.id, clamp(d.grade || 0, 0, 2)); g.gx = d.gx; g.gy = d.gy; return g; }
  if (d.kind === 'shell') { if (!SKILLS[d.id]) return null; const sh = buildShell(d.id, d.rarity, d.affixes, d.uq); sh.gx = d.gx; sh.gy = d.gy; return sh; }
  const set = it => { if (SET_ITEMS[d.set]) { it.set = d.set; it.found = true; (it.kind === 'armor' ? refreshArmor : refreshWeapon)(it); } return it; }; // 세트 장비
  if (d.kind === 'armor') { if (!ARMORS[d.id]) return null; const a = set(buildArmor(d.id, d.rarity, d.affixes, d.plus, d.sockets || 0, okGems(d))); a.gx = d.gx; a.gy = d.gy; return a; }
  const w = set(buildWeapon(d.id, d.rarity, d.affixes, d.plus, d.uq, d.sockets || 0, okGems(d)));
  if (w.uq) w.found = true;
  w.mag = d.mag; w.gx = d.gx; w.gy = d.gy;
  return w;
}
// 슬롯: 0~2 (직접 저장) 또는 'auto' (거점에 들어올 때 자동 저장 — 따로 한 칸)
const saveAt = (S, k) => k === 'auto' ? S.auto || null : S.slots[k];
const slotName = k => k === 'auto' ? '자동 저장' : `슬롯 ${k + 1}`;
let autoT = 0, autoNote = 0; // 마지막 자동 저장 시각 (너무 자주 쓰지 않게), 화면 오른쪽 아래 '자동 저장' 표시 남은 시간
function autoSave() {
  if (performance.now() - autoT < 15000) return;
  autoT = performance.now();
  if (saveGame('auto', true)) autoNote = 2.2;
}
function saveGame(slot, quiet = false) {
  const p = player, s = readSaves();
  const data = {
    time: Date.now(), stage: level, kills, playtime, diff: difficulty, rescued,
    field: { seed: fieldSeed, ver: FIELD_VER, hub: lastHub, flags, seen: packSeen() }, // 필드: 같은 지도를 다시 만들 씨앗·판, 저장한 거점, 진행 기록, 밝힌 지도
    player: { hp: p.hp, armor: p.armor, gold: p.gold, ammo: p.ammo, gren: p.gren, items: p.items, gsel: p.gsel,
      slot: p.slot, up: p.up, equip: p.equip.map(packWeapon), bag: p.bag.map(packWeapon), clv: p.clv, xp: p.xp, pts: p.pts, perks: p.perks, shells: p.shells.map(packWeapon), attr: p.attr, apts: p.apts,
      gear: Object.fromEntries(GEAR_KEYS.map(g => [g, packWeapon(p.gear[g])])), parts: p.parts, gemBag: p.gemBag },
    stash: stash.map(packWeapon), // 기지 창고
  };
  if (slot === 'auto') s.auto = data; else s.slots[slot] = data;
  s.log = [{ time: data.time, slot, stage: level, gold: p.gold, kills }, ...s.log.filter(l => !(slot === 'auto' && l.slot === 'auto'))].slice(0, 20); // 자동 저장 기록은 마지막 하나만
  const ok = writeSaves(s);
  if (!quiet) Snd.play(ok ? 'save' : 'deny');
  return ok;
}
function loadGame(slot) {
  const d = saveAt(readSaves(), slot);
  if (!d) return;
  const p = newPlayer(), q = d.player;
  Object.assign(p, { hp: q.hp, armor: q.armor, gold: q.gold, ammo: { ...p.ammo, ...q.ammo }, gren: q.gren, items: q.items, gsel: q.gsel, slot: q.slot,
    clv: q.clv || 1, xp: q.xp || 0, pts: q.pts || 0, perks: { ...(q.perks || {}) } }); // 성장 이전 저장은 Lv 1부터
  if (q.shells) p.shells = [0, 1, 2, 3].map(k => unpackWeapon(q.shells[k])); // 스킬 쉘이 생기기 전 저장은 충격파 쉘 하나로 시작
  p.attr = { ...p.attr, ...(q.attr || {}) }; p.apts = q.attr ? q.apts || 0 : ATTR_PER_LEVEL * (p.clv - 1); // 능력치가 생기기 전 저장은 지난 레벨만큼 점수를 줌
  if (q.gear) for (const g of GEAR_KEYS) p.gear[g] = unpackWeapon(q.gear[g]); // 방어구가 생기기 전 저장은 기본 방탄 조끼
  p.parts = q.parts || 0;
  p.up = { ...p.up, ...q.up };
  const eqOld = (q.equip || []).map(unpackWeapon); p.bag = q.bag.map(unpackWeapon).filter(Boolean);
  if (q.gemBag) for (const k of GEM_KEYS) if (Array.isArray(q.gemBag[k])) p.gemBag[k] = [0, 1, 2].map(n => Math.max(0, Math.floor(+q.gemBag[k][n] || 0))); // 보석 주머니
  for (const g of p.bag) if (g.kind === 'gem') p.gemBag[g.id][g.grade]++; // 주머니가 생기기 전 저장: 가방의 보석을 주머니로
  p.bag = p.bag.filter(o => o.kind !== 'gem');

  player = p; applyUpgrades(p); p.stamina = staminaMax();
  kills = d.kills; playtime = d.playtime || 0; rescued = d.rescued || 0;
  stash = (d.stash || []).map(unpackWeapon).filter(Boolean); // 창고가 생기기 전 저장은 빈 창고
  const open = Math.min(NSLOT, WEAPON_SLOTS.base + (((d.field && d.field.flags) || {}).armory || []).length), extra = [];
  p.equip = new Array(NSLOT).fill(null);
  if (eqOld.length <= NSLOT && !eqOld.some((w, k) => w && k >= open)) eqOld.forEach((w, k) => { p.equip[k] = w; }); // 지금 방식의 저장: 그대로
  else { // 무기 분류별 칸이던 예전 저장 (또는 열린 칸보다 많음): 들고 있던 무기부터 열린 칸에, 나머지는 가방·창고로
    const list = [eqOld[q.slot], ...eqOld.filter((w, k) => k !== q.slot)].filter(Boolean);
    list.forEach((w, k) => { if (k < open) p.equip[k] = w; else extra.push(w); });
    p.slot = 0;
  }
  if (p.slot >= open || !p.equip[p.slot]) p.slot = Math.max(0, p.equip.findIndex(Boolean));
  const moved = { bag: 0, stash: 0, floor: [] };
  for (const w of extra) {
    let s = bagFindSpot(w);
    if (s) { w.gx = s.gx; w.gy = s.gy; p.bag.push(w); moved.bag++; continue; }
    s = gridFindSpot(stash, w, VG_W, VG_H);
    if (s) { w.gx = s.gx; w.gy = s.gy; stash.push(w); moved.stash++; continue; }
    moved.floor.push(w);
  }
  for (const it of [...ownedItems(), ...stash]) codexItem(it, true); // 수집 도감: 가진 고유 전설·보석 조합 (도감이 생기기 전 저장)
  difficulty = DIFFICULTY[d.diff] ? d.diff : 'normal';
  Snd.init(); Snd.play('exit');
  const F = d.field;
  if (F && F.ver === FIELD_VER) startField(F.seed, F.flags, F.hub, F.seen);
  else if (F) { startField(F.seed, { ...F.flags, hubs: [] }); settleHubs(); } // 거점이 줄기 전 판의 저장: 지도는 새로, 진행 기록(구역 단위)은 그대로
  else { startField(newSeed(), legacyFlags(Math.min(d.stage || 1, CAMPAIGN.length))); settleHubs(); } // 예전(구역 방식) 저장: 새 지도에서 그 구역까지 지나온 것으로
  for (const w of moved.floor) dropWeapon(player.x + rnd(-0.8, 0.8), player.y + rnd(0.6, 1.2), w); // 가방·창고가 다 차면 발밑에
  if (extra.length) { msg(`무기 슬롯이 바뀌었다 (지금 ${open}칸 — 구역 2·5의 무기고를 해제하면 늘어남): 남는 무기 ${extra.length}개 → 가방 ${moved.bag} · 창고 ${moved.stash}${moved.floor.length ? ` · 발밑 ${moved.floor.length}` : ''}`, '#ffd27a'); tip('armory'); }
  msg(`${slotName(slot)}을(를) 불러왔습니다`, '#9f9');
}
// 가장 최근 저장: 슬롯 번호, 'auto', 없으면 -1
function latestSlot() {
  const S = readSaves();
  let best = -1, bt = -1;
  for (const k of [...S.slots.keys(), 'auto']) { const d = saveAt(S, k); if (d && d.time > bt) { best = k; bt = d.time; } }
  return best;
}
const z2 = n => String(n).padStart(2, '0');
const fmtTime = t => { const d = new Date(t); return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())} ${z2(d.getHours())}:${z2(d.getMinutes())}`; };
const fmtPlay = s => `${Math.floor(s / 3600)}시간 ${z2(Math.floor(s / 60) % 60)}분`;
// ===== 흐름: 시작 메뉴 → 우주 기지 ↔ 출격(구역) =====
let inBase = false;
function resetWorld() {
  boss = null; exitDist = null; keysHeld = new Set(); perkOpen = false;
  escape = null; hurtDirs = []; hitFlash = 0; hitStop = 0; crateHp = new Map(); crateHitT = new Map();
  enemies = []; bullets = []; eshots = []; grenades = []; areas = []; parts = []; decals = []; pickups = []; barrels = [];
  texts = []; flashes = []; beams = []; corpses = []; fxs = [];
  assault = null; assaultCd = 0; combatT = 0;
  mission = PURGE; hackM = null; armoryOn = null; survivors = []; hazards = []; eventNotes = []; eventClock = 0; nextEvent = 0; lastEvent = null; beaconOn = null;
  turrets = []; mines = []; rings = []; drones = []; coils = []; wells = []; pillars = []; waves = []; decoys = []; delayed = [];
  if (player) { player.scd = {}; player.sk = {}; player.inv = 0; } // 스킬 대기시간·지속 효과는 장소를 옮길 때마다 처음부터
}
function placePlayer(x, y) {
  const p = player;
  p.x = x; p.y = y; p.kx = p.ky = 0; p.dash = 0; p.charging = 0; p.look = p.aim; flowTile = -1; vis = null;
  cam.x = (x - y) * TW / 2; cam.y = (x + y) * TH / 2;
}
const BASE_SPAWN = [27.5, 24.5]; // 타이틀 배경의 기지에서 플레이어 자리
function newGame(diff = 'normal') {
  Snd.init(); Snd.play('menu');
  difficulty = diff; kills = 0; playtime = 0; rescued = 0; stash = []; player = newPlayer();
  startField(newSeed());
  startIntro(() => { // 오프닝 컷신이 끝나면 (건너뛰어도)
    msg('[F] 자판기 · 가운데 패드: 거점 순간이동 · I/Tab: 인벤토리', '#ffd27a');
    msg(`새 작전 (난이도 ${DIFFICULTY[difficulty].name}) — 정거장 가장 깊은 곳(구역 9 코어)의 오버마인드를 처치하라`, '#9f9');
    tipQueue = []; tip('controls'); tip('vision'); tip('skills');
  });
}
// 쓰러짐: 보통은 마지막으로 들른 보급 거점에서 다시 일어남 (respawn) — 자폭 중이거나 자폭에 휘말리면 임무 실패
function die(reason) {
  if (state !== 'play') return;
  stowHeld(); // 커서로 들고 있던 장비·보석은 제자리로 (사라지지 않게)
  state = 'dead'; invOpen = false; perkOpen = false; codexOpen = false;
  Snd.play('pdeath');
  if (escape || reason) { escape = null; Music.stop(2.5); setTimeout(() => gameOverScreen(reason || '탈출하지 못하고 쓰러졌습니다 — 정거장과 함께 사라졌다'), 900); return; }
  setTimeout(respawn, 1800);
}
// ===== 엔딩: 탈출정 도착 → 섬광 → 별이 보이는 우주 → 작전 기록 =====
let endT = 0;
const STARS = Array.from({ length: 180 }, () => [Math.random(), Math.random(), rnd(0.4, 1.7)]);
function ending() {
  closeInventory();
  state = 'ending'; endT = 0; escape = null; mouse.down = false; codexStat('win', 1);
  Snd.play('exit'); Snd.play('explode'); Music.play(MUSIC.ending);
  const s = readSaves(); // 클리어 기록은 저장 기록에 남김
  s.log = [{ time: Date.now(), clear: true, diff: difficulty, playtime, kills, gold: player.gold }, ...s.log].slice(0, 20);
  writeSaves(s);
  setTimeout(endingScreen, 2600);
}
function drawEnding() {
  if (endT < 1) { ctx.fillStyle = `rgba(255,250,235,${endT})`; ctx.fillRect(0, 0, W, H); return; }
  const k = Math.min(1, (endT - 1) / 1.4), c = Math.round(255 * (1 - k) * 0.98);
  ctx.fillStyle = `rgb(${c},${c},${Math.round(c * 0.92)})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  for (const [x, y, s] of STARS) circle(((x * W - endT * 9 * s) % W + W) % W, y * H, s, '#dde6ff');
  // 멀어지는 탈출정 불빛
  const f = Math.min(1, (endT - 1) / 8), px = W * (0.35 + 0.3 * f), py = H * (0.62 - 0.25 * f);
  circle(px, py, 3 * (1 - f) + 1, '#fff'); circle(px, py, 9 * (1 - f) + 3, 'rgba(120,200,255,0.25)');
  ctx.globalAlpha = 1;
}
// ===== 오프닝 컷신 (INTRO, 새 작전): 착륙 지점 거점의 위·왼쪽 벽(되도록 우주에 맞닿은 바깥벽)을 폭파하고 해병이 걸어 들어와 포효 =====
// 실제 필드 그대로 (위아래 검은 띠, HUD 없음, 타이틀처럼 조명만) — 가까이 장면만 정면 그림을 크게. 클릭·키를 누르고 있으면 건너뜀
let intro = null; // { t, s: 구멍 자리, dir, sx·sy → ex·ey: 걸어 들어오는 길, hole, white, typed, step, hold: 누르고 있은 시간, msgs, done }
function introSpot() {
  const r = hubs[0] && hubs[0].room, cand = [];
  if (!r) return null;
  const face = (wi, wj, fi, fj, di, dj, out, mid) => {
    if (tileAt(wi, wj) !== T.WALL || tileAt(fi, fj) !== T.FLOOR) return;
    for (let s = 1; s <= 2; s++) if (!walkable(tileAt(fi + di * s, fj + dj * s))) return; // 걸어 들어올 두 칸
    const x = (wi + fi) / 2 + 0.5, y = (wj + fj) / 2 + 0.5;
    if (doors.some(o => Math.hypot(o.x - x, o.y - y) < 2.5) || lamps.some(l => Math.hypot(l.x - x, l.y - y) < 1.2)) return;
    cand.push({ x, y, fi, fj, di, dj, side: dj ? 1 : -1, score: (tileAt(...out) === T.VOID ? 0 : 20) + mid }); // 바깥벽, 벽 가운데쯤 먼저
  };
  for (let i = r.x + 1; i < r.x + r.w - 1; i++) face(i, r.y - 1, i, r.y, 0, 1, [i, r.y - 2], Math.abs(i + 0.5 - r.x - r.w / 2));
  for (let j = r.y + 1; j < r.y + r.h - 1; j++) face(r.x - 1, j, r.x, j, 1, 0, [r.x - 2, j], Math.abs(j + 0.5 - r.y - r.h / 2));
  return cand.sort((a, b) => a.score - b.score)[0] || null;
}
function startIntro(done) {
  const s = introSpot();
  if (!s) { done(); return; }
  const p = player, dir = Math.atan2(s.dj, s.di), ex = s.x + s.di * 2.7, ey = s.y + s.dj * 2.7;
  intro = { t: 0, s, dir, sx: s.x + s.di * 0.3, sy: s.y + s.dj * 0.3, ex, ey, hole: null, white: 0, typed: 0, step: 0, hold: 0, msgs, done };
  msgs = []; state = 'intro'; vis = null; mouse.down = mouse.pressed = false; Music.stop(0.8);
  placePlayer(ex, ey); p.x = intro.sx; p.y = intro.sy; p.aim = p.look = dir;
  for (const [a, b] of [[1.5, 0.5], [-1.8, -0.3]]) { // 먼저 당한 경비병 둘과 핏자국
    const x = ex - s.dj * a + s.di * b, y = ey + s.di * a + s.dj * b;
    if (collides(x, y, 0.35, false) || tileAt(Math.floor(x), Math.floor(y)) !== T.FLOOR) continue;
    corpses.push({ x, y, type: 'gunner', face: rnd(0, 6.28), t: 99 }); bloodSplat(x, y, rnd(0.7, 1), 'rgba(120,10,10,0.85)');
  }
}
function introTick(dt) {
  const I = INTRO, it = intro, p = player, s = it.s, t0 = it.t;
  gtime += dt; it.t += dt;
  const held = it.t > 0.6 && (mouse.down || Object.values(keys).some(Boolean)); // 건너뛰기: 누르고 있는 동안 차오름 (시작할 때 누르고 있던 키는 무시)
  it.hold = held ? it.hold + dt : Math.max(0, it.hold - dt * 3);
  if (it.hold >= I.hold) { introEnd(); return; }
  const at = x => t0 < x && it.t >= x; // 이번 프레임에 지난 시각
  const n = Math.floor((it.t - 0.5) * 16); // 장소 자막을 치는 소리
  if (n > it.typed && n <= I.place.length + I.sub.length) { it.typed = n; Snd.play('uiMove'); }
  I.knock.forEach((k, m) => { if (at(k)) { shake = Math.max(shake, 4 + m * 3); Snd.play('bigHurt', s.x, s.y); spark(s.x, s.y, 4 + m * 4, '#ffd27a', 2.5); smoke(s.x + s.di * 0.2, s.y + s.dj * 0.2, 3 + m * 2, '110,105,100', 0.7); } }); // 벽 너머에서 쾅, 쾅, 쾅
  if (at(I.boom)) introBoom();
  if (it.hole) {
    it.hole.t -= dt;
    if (Math.random() < dt * 12 && it.t < I.boom + 4) smoke(s.x + s.di * 0.3, s.y + s.dj * 0.3, 1, '80,76,72', 0.6);
    if (Math.random() < dt * 5) spark(s.x, s.y, 2, pick(['#ffd27a', '#ff9a40']), 2);
  }
  it.white = Math.max(0, it.white - dt * 2.5);
  const [w0, w1] = I.walk; // 연기 속에서 천천히 걸어 들어옴
  p.moving = it.t >= w0 && it.t < w1;
  if (p.moving) {
    const u = (it.t - w0) / (w1 - w0), k = 1 - (1 - u) * (1 - u);
    p.x = it.sx + (it.ex - it.sx) * k; p.y = it.sy + (it.ey - it.sy) * k; p.walk += dt * 7 * (1 - u * 0.6);
    if ((it.step -= dt) <= 0) { it.step = 0.4; Snd.play('step'); }
  }
  if (it.t >= w1 && it.t < I.turn) p.aim = it.dir + Math.sin((it.t - w1) * 2.4) * 0.8; // 둘러봄
  else if (it.t >= I.turn) p.aim += angDiff(Math.PI / 4, p.aim) * Math.min(1, dt * 6); // 화면 쪽으로 돌아섬
  p.look = p.aim;
  if (at(I.growl)) Snd.sample(['dsbgsit1', 'dsbgsit2'], 0.35, 0.8); // 어딘가에서 들리는 괴성
  if (at(I.turn)) Snd.play('reload');
  if (at(I.roarAt)) { Snd.play('berserk'); Snd.sample(['dsplpain'], 1, 0.6); shake = Math.max(shake, 16); Music.play(MUSIC.zones[0]); }
  if (at(I.line2)) { Snd.play('stomp'); shake = Math.max(shake, 20); }
  if (at(I.shot)) { Snd.play('dshotgun'); shake = Math.max(shake, 10); }
  if (at(I.seal)) introSeal();
  updateMisc(dt);
  const c = 1.3 + 0.6 * Math.min(1, it.t / I.end), cx = s.x + s.di * c, cy = s.y + s.dj * c; // 카메라: 구멍과 해병 사이, 천천히 안쪽으로
  cam.x = (cx - cy) * TW / 2; cam.y = (cx + cy) * TH / 2;
  if (it.t >= I.end) introEnd();
}
// 폭파: 벽에 구멍 (선체 파손 그림을 크게), 섬광, 불꽃, 안쪽으로 튀는 파편, 바닥 그을음
function introBoom() {
  const it = intro, s = it.s;
  it.hole = { type: 'breach', x: s.x, y: s.y, side: s.side, r0: 26, t: 99, max: 99, jag: Array.from({ length: 11 }, () => rnd(0.75, 1.15)), stars: Array.from({ length: 7 }, () => [rnd(-0.6, 0.6), rnd(-0.6, 0.6)]) };
  hazards.push(it.hole);
  Snd.play('explode'); Snd.play('stomp'); shake = Math.max(shake, 22); it.white = 1;
  flashes.push({ x: s.x, y: s.y, r: 700, t: 0.6, max: 0.6, col: '255,200,140' });
  addFx('misl', 'bcd', s.x + s.di * 0.3, s.y + s.dj * 0.3, 30, 0.6, 2.2);
  fireBurst(s.x, s.y, 30, 4); smoke(s.x + s.di * 0.4, s.y + s.dj * 0.4, 26, '85,80,75', 2.2);
  for (let k = 0; k < 36; k++) { const a = it.dir + rnd(-1.1, 1.1), v = rnd(2, 7); parts.push({ x: s.x, y: s.y, z: rnd(20, 50), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rnd(40, 160), g: 320, life: rnd(0.6, 1.3), max: 1.3, col: pick(['#8a8478', '#6a655c', '#b0a898', '#4a4640']), size: rnd(2, 5) }); }
  addDecal({ x: s.fi + 0.5, y: s.fj + 0.5, r: 1.1, col: 'rgba(14,12,10,0.85)' });
}
// 비상 격벽이 구멍을 막음 (선체 파손이 끝날 때와 같은 모습)
function introSeal() {
  const h = intro.hole;
  if (!h) return;
  hazards = hazards.filter(o => o !== h); intro.hole = null;
  Snd.play('doorClose', h.x, h.y); spark(h.x, h.y, 16, '#ffd27a', 3);
  flashes.push({ x: h.x, y: h.y, r: 200, t: 0.25, max: 0.25, col: '150,200,255' });
}
function introEnd() {
  const it = intro, p = player;
  intro = null;
  if (it.hole) hazards = hazards.filter(o => o !== it.hole);
  placePlayer(it.ex, it.ey); p.moving = false; p.fireT = 0; p.aim = p.look = Math.PI / 4;
  msgs = it.msgs; state = 'play'; mouse.down = mouse.pressed = false;
  trackRegion();
  it.done();
}
// 컷신 화면: 검은 띠, 장소 자막 (타자기), 혼잣말, 가까이 장면, 구역 이름, 폭파 섬광, 처음 밝아짐, 건너뛰기 안내
function drawIntro() {
  const I = INTRO, it = intro, t = it.t, bar = Math.round(H * 0.11), ease = x => x * x * (3 - 2 * x);
  const ui = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif", disp = `Bahnschrift, ${ui}`;
  const txt = (s, x, y, col, w = 4) => { ctx.lineWidth = w; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); };
  const typed = (s, t1, cps) => s.slice(0, Math.max(0, Math.floor((t - t1) * cps)));
  ctx.save(); ctx.lineJoin = 'round';
  const ck = clamp(Math.min((t - I.close[0]) / 0.25, (I.close[1] - t) / 0.3), 0, 1);
  if (ck > 0) drawIntroClose(ck, bar, txt, disp);
  if (it.white > 0) { ctx.fillStyle = `rgba(255,240,220,${it.white * 0.7})`; ctx.fillRect(0, 0, W, H); }
  const bh = bar * Math.min(ease(clamp(t / 0.6, 0, 1)), ease(clamp((I.end - t) / 0.6, 0, 1)));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bh); ctx.fillRect(0, H - bh, W, bh);
  const ca = clamp(Math.min((t - 0.4) / 0.3, (I.boom + 1.2 - t) / 0.6), 0, 1); // 장소 (폭파 뒤 사라짐)
  if (ca > 0) {
    const x = Math.max(28, W * 0.06), y = bar + 60, a = typed(I.place, 0.5, 16), b = typed(I.sub, 0.5 + I.place.length / 16, 16);
    ctx.globalAlpha = ca; ctx.textAlign = 'left';
    ctx.fillStyle = '#ff9a3c'; ctx.fillRect(x, y - 28, 3, 52);
    ctx.font = `bold 26px ${disp}`; txt(a + (a.length < I.place.length && Math.sin(t * 20) > 0 ? '▌' : ''), x + 16, y, '#f2ede4');
    ctx.font = `15px ${ui}`; txt(b, x + 16, y + 24, '#8fb4c8', 3);
    ctx.globalAlpha = 1;
  }
  const qa = clamp(Math.min((t - I.quietAt) / 0.3, (I.turn + 0.3 - t) / 0.4), 0, 1); // 혼잣말
  if (qa > 0) { ctx.globalAlpha = qa; ctx.textAlign = 'center'; ctx.font = `22px ${ui}`; txt(I.quiet, W / 2, H - bar - 36, '#e8e2d6'); ctx.globalAlpha = 1; }
  const ra = clamp(Math.min((t - I.seal) / 0.4, (I.end + 0.2 - t) / 0.5), 0, 1); // 구역 이름 (위쪽 가운데, 양옆에 주황 줄)
  if (ra > 0) {
    const y = bar + 70;
    ctx.globalAlpha = ra; ctx.textAlign = 'center';
    ctx.font = `bold 14px ${disp}`; txt('구역 1', W / 2, y - 34, '#ff9a3c', 3);
    ctx.font = `bold 44px ${disp}`; txt(CAMPAIGN[0].name, W / 2, y + 10, '#f2ede4', 5);
    const half = ctx.measureText(CAMPAIGN[0].name).width / 2 + 24;
    ctx.fillStyle = '#ff9a3c'; ctx.fillRect(W / 2 - half - 70 * ra, y - 7, 70 * ra, 2); ctx.fillRect(W / 2 + half, y - 7, 70 * ra, 2);
    ctx.globalAlpha = 1;
  }
  if (t < 1.2) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 1.2})`; ctx.fillRect(0, 0, W, H); }
  if (bh > bar * 0.5) { // 건너뛰기 안내: 누르고 있으면 둥근 게이지가 참
    const k = Math.min(1, it.hold / I.hold), x = W - 32, y = H - bh / 2;
    ctx.globalAlpha = k > 0 ? 0.95 : 0.55; ctx.textAlign = 'right'; ctx.font = `12px ${ui}`; ctx.fillStyle = k > 0 ? '#f2ede4' : '#9a968c';
    ctx.fillText('클릭·키를 누르고 있으면 건너뜀', x - 16, y + 4);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    if (k > 0) { ctx.lineWidth = 3; ctx.strokeStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
// 가까이: 어둡게 덮고 붉은 역광 앞에 해병의 정면 그림을 크게 — 포효할 때 집중선과 흔들림, 하늘에 한 발 (총구 섬광 그림), 옆에 대사
function drawIntroClose(k, bar, txt, disp) {
  const I = INTRO, t = intro.t, wide = W >= 760, roar = t >= I.roarAt, pulse = roar ? 0.5 + 0.5 * Math.sin(t * 18) : 0;
  const fr = t >= I.shot && t < I.shot + 0.14 ? 'f' : t >= I.roarAt - 0.2 ? 'e' : 'a', key = frontKey('play', fr), f = key && META.frames[key];
  if (!f) return;
  const base = H - bar + 4, sc = (H - 2 * bar) * 0.84 / f[3] * (0.94 + 0.06 * k), cx = wide ? W * 0.33 : W / 2, top = base - f[3] * sc, hy = top + f[3] * sc * 0.2;
  ctx.fillStyle = `rgba(6,3,2,${0.8 * k})`; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(cx, hy + f[3] * sc * 0.15, 0, cx, hy + f[3] * sc * 0.15, H * 0.62);
  g.addColorStop(0, `rgba(255,${Math.round(90 - 40 * pulse)},40,${(0.42 + 0.28 * pulse) * k})`); g.addColorStop(1, 'rgba(90,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (roar && t < I.roarAt + 2.2) { // 집중선
    const a0 = (1 - (t - I.roarAt) / 2.2) * k;
    ctx.strokeStyle = `rgba(255,225,205,${0.18 * a0})`; ctx.lineWidth = 2; ctx.beginPath();
    for (let n = 0; n < 56; n++) { const a = n / 56 * Math.PI * 2 + Math.sin(n * 12.9 + Math.floor(t * 20)) * 0.05, r0 = H * (0.3 + 0.1 * Math.abs(Math.sin(n * 7.3 + Math.floor(t * 20)))); ctx.moveTo(cx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * W, hy + Math.sin(a) * W); }
    ctx.stroke();
  }
  const zx = roar ? shx * 1.6 : 0, zy = roar ? shy * 1.6 : 0;
  ctx.globalAlpha = k; drawFrame(key, cx + zx, base + zy, sc);
  if (fr === 'f') { const fx = cx + zx, fy = top + f[3] * sc * 0.5, g2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, sc * 26); g2.addColorStop(0, 'rgba(255,240,180,0.55)'); g2.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g2; ctx.fillRect(fx - sc * 26, fy - sc * 26, sc * 52, sc * 52); }
  if (t >= I.roarAt - 0.1) { // 대사: 첫 줄은 치듯이, 둘째 줄은 쾅 하고 크게
    const [l1, l2] = I.roar, x = wide ? W * 0.56 : W / 2, y = wide ? H * 0.46 : H - bar - 92, s2 = Math.min(58, (wide ? W * 0.4 : W * 0.9) / (l2.length * 0.95));
    ctx.textAlign = wide ? 'left' : 'center';
    ctx.font = `bold 30px ${disp}`; txt(l1.slice(0, Math.max(0, Math.floor((t - I.roarAt + 0.1) * 14))), x + zx * 0.5, y, '#f2ede4');
    if (t >= I.line2) {
      const slam = 1 + 0.4 * Math.max(0, 1 - (t - I.line2) / 0.15), y2 = y + s2 + 14;
      ctx.save(); ctx.translate(x + zx, y2 + zy); ctx.scale(slam, slam);
      const g3 = ctx.createLinearGradient(0, -s2, 0, 0); g3.addColorStop(0, '#ffe1a0'); g3.addColorStop(1, '#ff5a28');
      ctx.font = `bold ${Math.round(s2)}px ${disp}`; txt(l2, 0, 0, g3, 7);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}
// ===== 보급 거점의 자판기 · 해킹 단말기 =====
// 가까이 있는 쓸 수 있는 단말기 (해킹 단말기는 해킹을 시작하기 전까지만)
const nearestTerminal = () => {
  let best = null, bd = 1.7;
  for (const t of terminals) { const d = Math.hypot(t.i + 0.5 - player.x, t.j + 0.5 - player.y); if (d < bd && (t.kind !== 'hack' || !(t.m && t.m.on)) && (t.kind !== 'armory' || t.state === 'idle')) { best = t; bd = d; } }
  return best;
};
function closeMenu() { hideOverlay(); state = 'play'; mouse.down = false; }
function useTerminal(t) {
  if (t.kind === 'hack') { startHack(t); return; }
  if (t.kind === 'armory') { startArmory(t); return; }
  if (t.hub) lastHub = t.hub.n;
  if (t.kind === 'shop') hubStock(t.hub);
  if (t.kind !== 'save') { openTrade(t.kind); return; }
  closeInventory();
  state = 'menu'; mouse.down = false; Snd.play('menu');
  saveScreen('기록 단말기', '지금 상태를 저장합니다. 불러오면 이 거점에서 다시 시작합니다 — 몬스터는 다시 나타나고, 처치한 보스·연 격벽·찾은 거점·밝힌 지도는 그대로입니다.', '닫기', closeMenu);
}
// 거점마다 진열대: 처음 열 때, 그리고 5분이 지나면 새로 채움 (그 구역 기준)
function hubStock(h) {
  if (!h) { rollStock(); return; }
  if (!h.stock || playtime - h.stockT > 300) { rollStock(); h.stock = { stock, shellStock, armorStock }; h.stockT = playtime; }
  else ({ stock, shellStock, armorStock } = h.stock);
}
// ===== 메인 루프 =====
let lastT = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (state === 'play') { if (hitStop > 0) hitStop -= dt; else { update(dt); playtime += dt; } } // 큰 공격에 맞으면 아주 잠깐 멈춤
  else if (state === 'dead') { updateMisc(dt); player.deathT += dt; }
  else if (state === 'ending') { updateMisc(dt); endT += dt; }
  else if (state === 'title') titleTick(dt); // 타이틀 뒤 풍경 (menu.js)
  else if (state === 'intro') introTick(dt); // 오프닝 컷신
  updateAmbience();
  render();
  requestAnimationFrame(frame);
}
// 시작은 menu.js (시작 화면 → 타이틀)
