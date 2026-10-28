'use strict';
// ===== 디버그 뷰어 (타이틀·일시정지 메뉴): 캐릭터 동작·소리, 무기 발사 모습·소리, 아이템·스킬 소리, 효과 스프라이트, 효과음 전부, 배경음악 =====
// 게임 상태는 건드리지 않음 — 미리보기는 따로 그리는 작은 캔버스 (menu.js의 screen·on·img를 씀)

const DBG_TABS = [['chars', '캐릭터'], ['weapons', '무기'], ['items', '아이템·스킬'], ['fx', '효과'], ['sfx', '효과음'], ['music', '음악']];
const dbg = { tab: 'chars', sel: {}, mode: 'walk', rot: 0, spin: true, speed: 1, auto: false, t: 0, last: 0, raf: 0, music: null, fireT: 0, shotT: 0, cool: 0, sawT: 0, shots: [], fx: [], parts: [], swing: 0, hitT: 0, nade: null };

// --- 소리: 최소 간격 없이 바로 (같은 소리를 여러 번 눌러도 들리게) ---
function dbgSfx(key) {
  Snd.init();
  const f = SFX[key];
  if (f && Snd.sample(f[0], f[1], f[2])) return;
  Snd.last[key] = 0; Snd.play(key); // Freedoom 소리가 없으면 합성음
}
const dbgRaw = names => { Snd.init(); Snd.sample(names, 0.9, 1); };

// --- 목록 ---
const SKILL_SND = { shock: ['skillShock'], charge: ['charge'], saw: ['sawUp', 'sawRun'], berserk: ['berserk'], iron: ['iron'], blink: ['blink'], cloak: ['cloak'], blades: ['blades'], deadeye: ['deadeye'],
  mines: ['throw', 'mineBoom'], turret: ['turretUp', 'turretGun'], drone: ['droneUp', 'droneGun'], tesla: ['teslaUp', 'tesla'], missiles: ['missiles'], repair: ['heal'], chain: ['chain'], frost: ['cryo'],
  inferno: ['inferno'], gravity: ['gravity', 'implode'], drain: ['drain'] };
const NADE_SND = { frag: 'explode', gas: 'gas', shock: 'shock', fire: 'fire', cryo: 'cryo' };
const SYNTH_ONLY = ['hit', 'gas', 'throw', 'dash', 'alarm', 'wind', 'step', 'heart', 'tip', 'dodge']; // Freedoom 소리가 없어 합성하는 이름
const MON_SND = [['sight', '발견'], ['attack', '공격'], ['pain', '피격'], ['death', '사망'], ['idle', '기척']];
const FX_NAME = { play: '주인공 (해병)', sswv: '생존자 (승무원)', bar1: '폭발 드럼통', bexp: '드럼통 폭발', misl: '로켓, 폭발', fire: '불꽃', tfog: '순간이동 안개', ifog: '아이템 안개',
  bal7: '산성 구체', plss: '플라즈마 탄', plse: '플라즈마 명중', puff: '총탄 연기', tlmp: '조명등', stim: '소형 메디킷', medi: '메디킷', bon1: '체력 보너스', suit: '방호복', arm1: '방탄복',
  clip: '탄창', shel: '산탄', ammo: '탄약 상자', brok: '로켓 상자', sgn2: '2연발 샷건', bpak: '배낭', bkey: '파란 키카드', ykey: '노란 키카드', rkey: '빨간 키카드', bosf: '오버마인드 포자',
  manf: '화염탄', blud: '피 튐', plas: '플라즈마 소총', laun: '로켓 발사기', bfug: '분쇄포', cell: '에너지 셀', rock: '로켓', bfs1: '분쇄포 구체', bfe1: '분쇄포 폭발', bfe2: '분쇄포 폭발 2',
  col5: '번식 둥지', pins: '은신 구체', pinv: '무적 구체', soul: '영혼 구체', pstr: '광폭화', pvis: '고글', arm2: '강철 갑옷', csaw: '전기톱 (회전 톱날)', mgun: '체인건 (포탑)',
  skul: '불타는 해골 (강습 돌진)', fsku: '떠다니는 해골 (드론)', elec: '기술 기둥 (테슬라)', celp: '셀 팩', keen: '나노 수리 캡슐', ceye: '붉은 눈 장치 (지뢰)', ysku: '금고 열쇠', tlp2: '조난 신호기',
  bal2: '아르고스 구체', pmap: '데이터 기록 단말기' };
function dbgList(tab) {
  if (tab === 'chars') return [
    { id: 'player', name: '주인공 (해병)', icon: 'playa1', A: { spr: 'play', scale: 1, walk: 'abcd', attack: 'ef', pain: 'g', death: 'hijklmn' }, snd: [['피격', 'hurt'], ['사망', 'pdeath'], ['발소리', 'step'], ['회피', 'dash']] },
    { id: 'survivor', name: '생존자 (승무원)', icon: 'sswva1', A: { spr: 'sswv', scale: 1, walk: 'abcd', attack: 'a', pain: 'h', death: 'ijlm' }, snd: [['합류 무전', 'radio'], ['피격', 'survHurt'], ['사망', 'survDie']] },
    ...Object.keys(ENEMY_ART).map(k => ({ id: k, name: (ENEMIES[k] && ENEMIES[k].name) || k, icon: frontKey(ENEMY_ART[k].spr, ENEMY_ART[k].walk[0]), A: ENEMY_ART[k], mon: ENEMY_SFX[k], E: ENEMIES[k] })),
  ];
  if (tab === 'weapons') return Object.keys(WEAPONS).map(k => ({ id: k, name: WEAPONS[k].name, icon: 'icon_' + k, w: WEAPONS[k], head: CAT_NAMES[WEAPONS[k].cat] }));
  if (tab === 'items') return [
    ...Object.keys(GRENADES).map(k => ({ id: 'g_' + k, name: GRENADES[k].name, icon: 'icon_gren_' + k, nade: k, head: '수류탄' })),
    ...Object.keys(ITEMS).map(k => ({ id: 'i_' + k, name: ITEMS[k].name, icon: ITEM_ART[k], item: k, head: '소모품' })),
    ...Object.keys(AMMO).map(k => ({ id: 'a_' + k, name: AMMO[k].name, icon: AMMO_ART[k], ammo: k, head: '탄약' })),
    ...Object.keys(SKILLS).map(k => ({ id: 's_' + k, name: SKILLS[k].name, icon: SKILLS[k].icon, skill: k, head: '스킬 쉘' })),
  ];
  if (tab === 'fx') {
    const mon = {};
    for (const [k, A] of Object.entries(ENEMY_ART)) if (!mon[A.spr]) mon[A.spr] = (ENEMIES[k] && ENEMIES[k].name) || k;
    return Object.keys(META.sprites).sort().map(p => { const fr = Object.keys(META.sprites[p]).sort(); return { id: p, name: `${p}, ${FX_NAME[p] || mon[p] || '스프라이트'}`, icon: META.sprites[p][fr[0]][0][0], frames: fr.join('') }; });
  }
  if (tab === 'sfx') return [
    ...Object.keys(SFX).map(k => ({ id: k, name: `${k}: ${SFX[k][0].join(', ')}`, key: k, head: '게임 효과음 (이름: Freedoom 파일)' })),
    ...SYNTH_ONLY.map(k => ({ id: k, name: `${k}: 합성음`, key: k, head: '합성 효과음 (Freedoom에 없음)' })),
    ...(META.sounds || []).map(n => ({ id: 'raw_' + n, name: n, raw: n, head: '원본 효과음 파일 전체' })),
  ];
  const role = { title: '타이틀', base: '보급 거점', escape: '탈출 (자폭)', ending: '엔딩' };
  return [...Object.entries(role).map(([k, r]) => ({ id: MUSIC[k], role: r })), ...MUSIC.zones.map((m, n) => ({ id: m, role: `구역 ${n + 1} ${CAMPAIGN[n].name}` }))]
    .map(o => ({ ...o, name: `${o.role}: ${(MUSIC_INFO[o.id] || [o.id])[0]}`, song: o.id }));
}
const dbgItem = () => { const L = dbgList(dbg.tab); return L.find(o => o.id === dbg.sel[dbg.tab]) || L[0]; };

// --- 화면 ---
function debugScreen(back) {
  if (dbg.music === null) dbg.music = Music.want || ''; // 나갈 때 원래 음악으로
  const L = dbgList(dbg.tab), cur = dbgItem();
  let head = '';
  const rows = L.map(o => { const h = o.head && o.head !== head ? `<div class="dbg-h">${escHtml(head = o.head)}</div>` : ''; return `${h}<button class="gi ${o === cur ? 'on' : ''}" data-nav data-d="${escHtml(o.id)}">${o.icon ? img(o.icon, 48) : ''}<span>${escHtml(o.name)}</span></button>`; }).join('');
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm dbg" style="width:min(1180px,96vw)">
      <div class="hd"><div class="grow"><div class="h1">디버그 뷰어</div></div>
        <div class="tabs">${DBG_TABS.map(([k, t]) => `<button class="tab ${k === dbg.tab ? 'on' : ''}" data-nav data-tab="${k}">${t}</button>`).join('')}</div></div>
      <div class="bd"><div class="guide dbg-g"><div class="glist">${rows}</div><div class="gdet" id="dbgDet"></div></div></div>
      <div class="ft"><span class="note">목록에서 고르면 오른쪽에서 동작을 보고 소리를 들을 수 있습니다, 게임 진행에는 영향 없음</span><button class="btn" data-nav id="dbgBack">뒤로</button></div>
    </div></div>`, { cls: 'dim', back: () => dbgLeave(back), focus: `[data-d="${cur.id}"]` });
  onAll('[data-tab]', b => { if (b.dataset.tab !== dbg.tab) { dbg.tab = b.dataset.tab; debugScreen(back); setFocus(overlay.querySelector(`[data-tab="${dbg.tab}"]`)); } }, 'uiMove');
  onAll('[data-d]', b => dbgPick(b.dataset.d), null);
  on('dbgBack', () => dbgLeave(back), 'uiBack');
  dbgDetail();
  const f = overlay.querySelector('.gi.on'); if (f) f.scrollIntoView({ block: 'nearest' });
}
function dbgLeave(back) {
  if (dbg.music !== null && Music.want !== dbg.music) { if (dbg.music) Music.play(dbg.music); else Music.stop(0.5); }
  dbg.music = null; dbg.auto = false;
  back();
}
function dbgPick(id) {
  dbg.sel[dbg.tab] = id;
  for (const o of overlay.querySelectorAll('[data-d]')) o.classList.toggle('on', o.dataset.d === id);
  const it = dbgItem();
  if (dbg.tab === 'sfx') { if (it.raw) dbgRaw(it.raw); else dbgSfx(it.key); }
  if (dbg.tab === 'music') Music.play(it.song);
  dbgDetail();
}
const dbgBtn = (id, label, on = false) => `<button class="btn dbg-b ${on ? 'pri' : ''}" data-nav id="${id}">${label}</button>`;
// 오른쪽: 미리보기 캔버스 + 조작 단추 + 정보
function dbgDetail() {
  const it = dbgItem(), det = $('dbgDet');
  if (!det || !it) return;
  dbg.t = 0; dbg.shots = []; dbg.fx = []; dbg.parts = []; dbg.swing = 0; dbg.nade = null; dbg.fireT = 0; dbg.cool = 0; dbg.hitT = 0; dbg.sawT = 0;
  const T = dbg.tab, canvasHTML = '<canvas id="dbgC" class="dbg-c"></canvas>';
  let ctl = '', info = '';
  if (T === 'chars') {
    ctl = `<div class="dbg-row">${[['idle', '대기'], ['walk', '걷기'], ['attack', '공격'], ['pain', '피격'], ['death', '사망']].map(([m, t]) => dbgBtn('dm_' + m, t, dbg.mode === m)).join('')}</div>
      <div class="dbg-row">${dbgBtn('dRotL', '◀ 방향')}${dbgBtn('dRotR', '방향 ▶')}${dbgBtn('dSpin', '자동 회전', dbg.spin)}${dbgBtn('dSpeed', `속도 ×${dbg.speed}`)}</div>
      <div class="dbg-row">${it.mon ? MON_SND.filter(([k]) => it.mon[k]).map(([k, t]) => dbgBtn('ds_' + k, `♪ ${t}`)).join('') : it.snd.map(([t], n) => dbgBtn('ds_' + n, `♪ ${t}`)).join('')}</div>`;
    const E = it.E;
    info = E ? `체력 ${E.hp}, 속도 ${E.spd}, 크기 ${E.r}${E.dmg ? `, 피해 ${E.dmg}` : ''}${E.from ? `, 구역 ${E.from}부터` : ''}${E.boss ? ', 보스' : ''}<br>${escHtml(MONSTER_DESC[it.id] || '')}` : '';
    info += `<br><span class="muted">스프라이트 ${it.A.spr}, 걷기 ${it.A.walk}, 공격 ${it.A.attack}, 피격 ${it.A.pain}, 사망 ${it.A.death}${it.A.scale !== 1 ? `, 크기 ×${it.A.scale}` : ''}</span>`;
  } else if (T === 'weapons') {
    const w = it.w, melee = w.type === 'melee';
    ctl = `<div class="dbg-row">${dbgBtn('dFire', melee ? '휘두르기' : '발사')}${dbgBtn('dAuto', '계속 공격', dbg.auto)}${melee ? '' : dbgBtn('dRel', '♪ 재장전')}${w.saw ? dbgBtn('dSaw0', '♪ 시동') + dbgBtn('dSaw1', '♪ 작동') + dbgBtn('dSaw2', '♪ 갈아냄') : melee ? dbgBtn('dHit', '♪ 명중') : ''}</div>`;
    info = `${CAT_NAMES[w.cat]}, 피해 ${w.dmg}${w.pellets ? ` ×${w.pellets}` : ''}, ${melee ? `공격 간격 ${w.rate}초, 사거리 ${w.range}, 스태미너 ${w.stamina}` : `발사 간격 ${w.rate}초, 장탄 ${w.mag}, 재장전 ${w.reload}초, ${AMMO[w.ammo].name}`}<br>
      <span class="muted">${melee ? `근접${w.saw ? ', 체인톱' : w.chain ? ', 연쇄 번개' : w.reflect ? ', 탄 되받아치기' : ''}` : `탄: ${w.proj || '총탄'}, 소리: ${w.snd || 'pistol'}${w.blast ? `, 폭발 반경 ${w.blast}` : ''}`}</span><br>${escHtml(w.desc || '')}`;
  } else if (T === 'items') {
    if (it.nade) { ctl = `<div class="dbg-row">${dbgBtn('dUse', '던지기')}${dbgBtn('dSnd', '♪ 터지는 소리')}</div>`; info = `던지는 소리 throw, 터지는 소리 ${NADE_SND[it.nade]}`; }
    else if (it.item) { ctl = `<div class="dbg-row">${dbgBtn('dUse', '사용')}</div>`; info = escHtml(ITEMS[it.item].desc || ''); }
    else if (it.ammo) { ctl = `<div class="dbg-row">${dbgBtn('dUse', '줍기')}</div>`; info = `최대 ${AMMO[it.ammo].max}, 한 묶음 ${AMMO[it.ammo].pack}`; }
    else { ctl = `<div class="dbg-row">${SKILL_SND[it.skill].map((s, n) => dbgBtn('dSk_' + n, `♪ ${n ? '효과' : '사용'} (${s})`)).join('')}</div>`; info = `대기시간 ${SKILLS[it.skill].cd}초, 그림 ${SKILLS[it.skill].icon}`; }
  } else if (T === 'fx') {
    ctl = `<div class="dbg-row">${dbgBtn('dRotL', '◀ 방향')}${dbgBtn('dRotR', '방향 ▶')}${dbgBtn('dSpeed', `속도 ×${dbg.speed}`)}</div>`;
    info = `프레임 ${it.frames} (${it.frames.length}장)`;
  } else if (T === 'sfx') {
    const f = it.key && SFX[it.key];
    ctl = `<div class="dbg-row">${dbgBtn('dPlay', '♪ 다시 듣기')}</div>`;
    info = it.raw ? `원본 파일 assets/sfx/${it.raw}.wav` : f ? `파일 ${f[0].join(', ')}, 크기 ${f[1]}, 재생 속도 ${f[2]}${f[3] ? `, 최소 간격 ${f[3]}초` : ''}` : 'Freedoom에 맞는 소리가 없어 게임 안에서 합성하는 소리';
  } else {
    const I = MUSIC_INFO[it.song] || [];
    ctl = `<div class="dbg-row">${dbgBtn('dPlay', '▶ 재생')}${dbgBtn('dStop', '■ 정지')}</div>`;
    info = `${escHtml(I[0] || it.song)}: ${escHtml(I[1] || '')}<br><span class="muted">파일 assets/music/${it.song}.mid, 음량 보정 ×${I[2] || 1}</span>`;
  }
  const big = T === 'sfx' || T === 'music' ? `<div class="dbg-ic">${it.icon ? img(it.icon, 96) : '♪'}</div>` : canvasHTML;
  det.innerHTML = `<div class="gh">${it.icon ? img(it.icon, 64) : ''}<div><div class="eye">${DBG_TABS.find(t => t[0] === T)[1]}</div><div class="h1" style="font-size:22px">${escHtml(it.name)}</div></div></div>
    ${big}${ctl}<p>${info}</p>`;
  wireNav(det);
  dbgWire(it);
  const c = $('dbgC');
  if (c) { c.width = Math.max(320, c.clientWidth | 0); c.height = Math.max(200, c.clientHeight | 0); if (!dbg.raf) { dbg.last = 0; dbg.raf = requestAnimationFrame(dbgLoop); } }
}
function dbgWire(it) {
  const re = () => { const f = document.activeElement && document.activeElement.id; dbgDetail(); const b = f && $(f); if (b) setFocus(b); };
  for (const m of ['idle', 'walk', 'attack', 'pain', 'death']) on('dm_' + m, () => { dbg.mode = m; re(); }, 'uiMove');
  on('dRotL', () => { dbg.spin = false; dbg.rot = (dbg.rot + 7) % 8; re(); }, 'uiMove');
  on('dRotR', () => { dbg.spin = false; dbg.rot = (dbg.rot + 1) % 8; re(); }, 'uiMove');
  on('dSpin', () => { dbg.spin = !dbg.spin; re(); }, 'uiMove');
  on('dSpeed', () => { dbg.speed = dbg.speed === 1 ? 0.5 : dbg.speed === 0.5 ? 0.25 : dbg.speed === 0.25 ? 2 : 1; re(); }, 'uiMove');
  if (it.mon) for (const [k] of MON_SND) on('ds_' + k, () => { Snd.init(); Snd.monPlay(it.id, k); }, null); // 게임과 같은 크기·높낮이
  if (it.snd) it.snd.forEach(([, k], n) => on('ds_' + n, () => dbgSfx(k), null));
  on('dFire', () => dbgAttack(it.w), null);
  on('dAuto', () => { dbg.auto = !dbg.auto; if (!dbg.auto) dbg.sawT = 0; re(); }, 'uiMove');
  on('dRel', () => dbgSfx('reload'), null);
  on('dHit', () => dbgSfx('meleeHit'), null);
  on('dSaw0', () => dbgSfx('sawUp'), null); on('dSaw1', () => dbgSfx('sawRun'), null); on('dSaw2', () => dbgSfx('sawHit'), null);
  on('dUse', () => dbgUse(it), null);
  on('dSnd', () => dbgSfx(NADE_SND[it.nade]), null);
  if (it.skill) SKILL_SND[it.skill].forEach((s, n) => on('dSk_' + n, () => dbgSfx(s), null));
  on('dPlay', () => { if (dbg.tab === 'music') { Music.want = null; Music.play(it.song); } else if (it.raw) dbgRaw(it.raw); else dbgSfx(it.key); }, null);
  on('dStop', () => Music.stop(0.4), null);
}

// --- 동작 ---
function dbgAttack(w) { // 무기 한 번: 총은 탄이 날아가 과녁에 맞고, 근접은 휘두름
  dbg.fireT = 0.12; dbg.cool = Math.max(0.12, w.rate || 0.3);
  if (w.type === 'melee') {
    dbg.swing = 0.18;
    if (w.saw) { if (!(dbg.sawT > 0)) dbgSfx('sawUp'); dbg.sawT = 0.35; dbgSfx('sawRun'); dbgSfx('sawHit'); dbg.hitT = 0.1; }
    else { dbgSfx('swing'); setTimeout(() => { dbgSfx('meleeHit'); dbg.hitT = 0.15; if (w.chain) dbgSfx('zap'); }, 90); }
    return;
  }
  const n = w.pellets || 1, kind = w.proj || 'bullet';
  const go = () => {
    for (let k = 0; k < n; k++) dbg.shots.push({ x: 0, y: (Math.random() - 0.5) * (w.spread || 0) * 60, kind, col: w.tracer || '#ffd27a', v: kind === 'bullet' ? 1100 : kind === 'plasma' ? 650 : kind === 'rocket' ? 420 : 260, blast: w.blast });
    if (!w.charge) dbgSfx(w.snd || 'pistol');
  };
  if (w.charge) { dbgSfx(w.snd); setTimeout(go, w.charge * 1000); } else go();
}
function dbgUse(it) {
  if (it.nade) { dbgSfx('throw'); dbg.nade = { t: 0, type: it.nade }; return; }
  if (it.item) { dbgSfx('heal'); for (let k = 0; k < 26; k++) dbg.parts.push({ x: (Math.random() - 0.5) * 40, y: -Math.random() * 40, vy: -40 - Math.random() * 60, life: 0.5 + Math.random() * 0.6, col: ITEMS[it.item].color }); return; }
  dbgSfx('pickup');
}

// --- 그리기 ---
function dbgFrame(g, key, x, y, s, flip, alpha = 1) { // 아틀라스 한 장을 발밑 기준으로 (픽셀 그대로)
  const f = key && META.frames[key];
  if (!f) return;
  const [sx, sy, w, h, ox, oy] = f;
  g.save(); g.globalAlpha = alpha; g.translate(Math.round(x), Math.round(y)); if (flip) g.scale(-1, 1);
  g.drawImage(ART.atlas, sx, sy, w, h, -ox * s, -oy * s, w * s, h * s);
  g.restore();
}
const dbgSpr = (pre, fr, rot) => { const S = META.sprites[pre] && META.sprites[pre][fr]; return S ? S[rot % 8] : [null, false]; };
const dbgFx = (pre, frames, x, y, dur, s) => dbg.fx.push({ pre, frames, x, y, t: 0, dur, s });
function dbgLoop(ts) {
  const c = $('dbgC');
  if (!c) { dbg.raf = 0; return; }
  const dt = dbg.last ? Math.min(0.05, (ts - dbg.last) / 1000) : 0;
  dbg.last = ts; dbg.t += dt * dbg.speed;
  const g = c.getContext('2d'), W2 = c.width, H2 = c.height, floor = H2 - 46;
  g.imageSmoothingEnabled = false;
  const bg = g.createLinearGradient(0, 0, 0, H2); bg.addColorStop(0, '#0b1016'); bg.addColorStop(1, '#151b22'); g.fillStyle = bg; g.fillRect(0, 0, W2, H2);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
  for (let x = 0; x < W2; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H2); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, floor, W2, 1);
  const it = dbgItem();
  if (it) ({ chars: dbgDrawChar, weapons: dbgDrawWeapon, items: dbgDrawItem, fx: dbgDrawFx }[dbg.tab] || (() => {}))(g, it, W2, H2, floor, dt);
  dbg.raf = requestAnimationFrame(dbgLoop);
}
// 캐릭터: 고른 동작을 되풀이 (사망은 끝까지 간 뒤 잠깐 멈췄다가 다시), 8방향
function dbgDrawChar(g, it, W2, H2, floor) {
  const A = it.A, t = dbg.t, m = dbg.mode, rot = dbg.spin ? Math.floor(t * 1.2) % 8 : dbg.rot;
  let fr = A.walk[0];
  if (m === 'walk') fr = A.walk[Math.floor(t * 7) % A.walk.length];
  else if (m === 'attack') { const n = A.attack.length, k = Math.floor(t * 6) % (n + 3); fr = k < n ? A.attack[k] : A.walk[0]; }
  else if (m === 'pain') fr = t % 1 < 0.35 ? A.pain[0] : A.walk[0];
  else if (m === 'death') { const k = Math.floor(t * 8) % (A.death.length + 10); fr = A.death[Math.min(k, A.death.length - 1)]; }
  const [key, flip] = dbgSpr(A.spr, fr, rot), f = key && META.frames[key];
  if (!f) return;
  const seqH = Math.max(...(A.walk + A.attack + A.pain + A.death).split('').map(q => { const k2 = dbgSpr(A.spr, q, 0)[0]; return k2 && META.frames[k2] ? META.frames[k2][3] : 0; }));
  const s = Math.min(3 * A.scale, (floor - 30) / Math.max(1, seqH)), z = A.z ? (A.z + Math.sin(t * 3) * 3) * s * 0.5 : 0;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(W2 / 2, floor, 22 * s * A.scale / 2 + 10, 7 + 2 * s, 0, 0, Math.PI * 2); g.fill();
  dbgFrame(g, key, W2 / 2, floor - z, s, flip);
  g.fillStyle = '#7f8a96'; g.font = font(FS); g.textAlign = 'left';
  g.fillText(`동작 ${m}, 프레임 ${fr}, 방향 ${rot + 1}/8, ${key}${flip ? ' (좌우 반전)' : ''}`, 12, H2 - 14);
}
// 무기: 왼쪽 해병이 오른쪽 과녁(크롤러)을 쏨 / 근접은 바로 앞을 휘두름
function dbgDrawWeapon(g, it, W2, H2, floor, dt) {
  const w = it.w, melee = w.type === 'melee', s = 2, px = 90, tx = melee ? px + 120 : W2 - 110, gunY = floor - 30 * s;
  if (dbg.auto && (dbg.cool -= dt) <= 0) dbgAttack(w);
  if (!dbg.auto && dbg.cool > 0) dbg.cool -= dt;
  dbg.fireT -= dt; dbg.swing -= dt; dbg.hitT -= dt; dbg.sawT -= dt;
  const X = ENEMY_ART.xenoid, [tk, tf] = dbgSpr(X.spr, dbg.hitT > 0 ? X.pain[0] : X.walk[0], 2); // 과녁: 제노이드 (화면 왼쪽을 봄)
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(tx, floor, 26, 8, 0, 0, Math.PI * 2); g.ellipse(px, floor, 22, 7, 0, 0, Math.PI * 2); g.fill();
  dbgFrame(g, tk, tx, floor, s * X.scale, tf, dbg.hitT > 0 ? 0.7 : 1);
  const [pk, pf] = dbgSpr('play', dbg.fireT > 0.06 ? 'f' : dbg.fireT > -0.12 ? 'e' : 'a', 6); // 해병 (오른쪽을 봄)
  dbgFrame(g, pk, px, floor, s, pf);
  if (dbg.fireT > 0.04 && !melee) { const r = w.proj === 'bfg' ? 70 : 34, mg = g.createRadialGradient(px + 30, gunY, 0, px + 30, gunY, r); mg.addColorStop(0, 'rgba(255,230,160,0.9)'); mg.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = mg; g.fillRect(px + 30 - r, gunY - r, 2 * r, 2 * r); }
  if (melee && (dbg.swing > 0 || (w.saw && dbg.sawT > 0))) { // 휘두르기 궤적 (게임과 같은 색)
    const k = w.saw ? 1 : 1 - dbg.swing / 0.18, R = Math.min(140, w.range * 46), a0 = -w.arc / 2;
    g.strokeStyle = w.saw ? `rgba(255,190,110,${0.5 + 0.3 * Math.random()})` : w.reflect ? `rgba(120,230,255,${0.7 * (1 - k)})` : w.chain ? `rgba(150,200,255,${0.6 * (1 - k)})` : `rgba(255,255,255,${0.55 * (1 - k)})`;
    g.lineWidth = w.saw ? 2 : w.reflect ? 6 : 4; g.beginPath();
    for (let q = 0; q <= 14; q++) { const a = a0 + w.arc * (w.saw ? q / 14 : k * q / 14), r = R * (w.saw && q % 2 ? 0.85 : 1); const x = px + 20 + Math.cos(a) * r, y = gunY + Math.sin(a) * r * 0.5; q ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    if (w.chain && dbg.hitT > 0) { g.strokeStyle = 'rgba(170,215,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, floor - 30); for (let q = 1; q <= 6; q++) g.lineTo(tx + q * 30, floor - 30 - Math.random() * 30); g.stroke(); }
  }
  for (const b of dbg.shots) { // 탄
    b.x += b.v * dt;
    const x = px + 34 + b.x, y = gunY + b.y * (b.x / 300);
    if (x >= tx - 10) { b.dead = true; dbg.hitT = 0.12; const ky = floor - 34;
      if (b.kind === 'bullet') dbgFx('puff', 'abcd', tx - 8, ky, 0.25, 1.6);
      else if (b.kind === 'plasma') dbgFx('plse', 'abcde', tx - 8, ky + 14, 0.3, 1.6);
      else if (b.kind === 'rocket') { dbgFx('misl', 'bcd', tx, ky + 30, 0.45, 2.4); dbgSfx('explode'); }
      else { dbgFx('bfe1', 'abcd', tx, ky + 40, 0.55, 2.2); dbgSfx('bfgBoom'); }
      continue; }
    if (b.kind === 'bullet') { g.strokeStyle = b.col; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 26, y); g.lineTo(x, y); g.stroke(); }
    else if (b.kind === 'plasma') { const [k2] = dbgSpr('plss', Math.floor(dbg.t * 20) % 2 ? 'b' : 'a', 0); dbgFrame(g, k2, x, y + 10, 1.4); }
    else if (b.kind === 'rocket') { const [k2, f2] = dbgSpr('misl', 'a', 6); dbgFrame(g, k2, x, y + 10, 1.6, f2); }
    else { const [k2] = dbgSpr('bfs1', Math.floor(dbg.t * 12) % 2 ? 'b' : 'a', 0); dbgFrame(g, k2, x, y + 30, 1.4); }
  }
  dbg.shots = dbg.shots.filter(b => !b.dead);
  dbgDrawFxList(g, dt);
}
function dbgDrawFxList(g, dt) {
  for (const f of dbg.fx) { f.t += dt; const k = Math.min(f.frames.length - 1, Math.floor(f.t / f.dur * f.frames.length)); const [key, fl] = dbgSpr(f.pre, f.frames[k], 0); dbgFrame(g, key, f.x, f.y, f.s, fl); }
  dbg.fx = dbg.fx.filter(f => f.t < f.dur);
  for (const q of dbg.parts) { q.life -= dt; q.y += q.vy * dt; g.fillStyle = q.col; g.globalAlpha = Math.max(0, Math.min(1, q.life * 2)); g.fillRect(q.cx + q.x, q.cy + q.y, 3, 3); }
  g.globalAlpha = 1; dbg.parts = dbg.parts.filter(q => q.life > 0);
}
// 아이템: 수류탄은 포물선으로 던져 종류별로 터짐, 소모품은 빛이 오름, 스킬 쉘은 그림을 움직여 보임
function dbgDrawItem(g, it, W2, H2, floor, dt) {
  const cx = W2 / 2, cy = floor - 70;
  for (const q of dbg.parts) if (q.cx === undefined) { q.cx = cx; q.cy = cy + 40; }
  const N = dbg.nade;
  if (N) {
    N.t += dt;
    const k = Math.min(1, N.t / 0.7), x = 90 + (cx - 90) * k, y = floor - 20 - Math.sin(k * Math.PI) * 110;
    if (k < 1) dbgFrame(g, 'icon_gren_' + N.type, x, y, 1.6);
    else if (!N.boom) {
      N.boom = true; dbgSfx(NADE_SND[N.type]);
      if (N.type === 'frag') dbgFx('misl', 'bcd', cx, floor + 10, 0.5, 2.6);
      else if (N.type === 'gas') dbgFx('tfog', 'abcdefghij', cx, floor + 10, 1.1, 2);
      else if (N.type === 'fire') { for (let q = 0; q < 7; q++) dbgFx('fire', 'abcdefgh', cx - 75 + q * 25, floor + 4, 1.6, 1.3); }
      else dbgFx('ifog', 'abcde', cx, floor + 10, 0.7, 2.2);
      const col = { frag: '#ffb040', gas: '#9e4', fire: '#ff7a30', shock: '#9df', cryo: '#dff' }[N.type];
      for (let q = 0; q < 30; q++) dbg.parts.push({ cx, cy: floor - 20, x: (Math.random() - 0.5) * 120, y: 0, vy: -30 - Math.random() * 120, life: 0.4 + Math.random() * 0.7, col });
    }
    if (N.t > 3) dbg.nade = null;
  } else if (!it.nade) { // 큰 그림 (스킬 쉘 그림이 스프라이트면 그 동작을 되풀이)
    const m = /^([a-z0-9]{4})([a-z])\d/.exec(it.icon || ''), S = m && META.sprites[m[1]], frs = S ? Object.keys(S).sort() : null;
    const key = frs && frs.length > 1 ? S[frs[Math.floor(dbg.t * 6) % frs.length]][0][0] : it.icon, f = META.frames[key];
    if (f) { const s = Math.min(4, 150 / Math.max(f[2], f[3])); g.drawImage(ART.atlas, f[0], f[1], f[2], f[3], Math.round(cx - f[2] * s / 2), Math.round(cy - f[3] * s / 2), f[2] * s, f[3] * s); } // 가운데에 크게
  }
  dbgDrawFxList(g, dt);
}
// 효과 스프라이트: 프레임을 차례로 (방향이 있으면 고른 방향)
function dbgDrawFx(g, it, W2, H2, floor) {
  const frs = it.frames, k = Math.floor(dbg.t * 8) % frs.length, [key, fl] = dbgSpr(it.id, frs[k], dbg.rot), f = key && META.frames[key];
  if (!f) return;
  const s = Math.min(4, (floor - 30) / Math.max(1, f[3]), (W2 - 60) / Math.max(1, f[2]));
  dbgFrame(g, key, W2 / 2, floor - 10, s, fl);
  g.fillStyle = '#7f8a96'; g.font = font(FS); g.textAlign = 'left';
  g.fillText(`프레임 ${frs[k]} (${k + 1}/${frs.length}), 방향 ${dbg.rot + 1}/8, ${key}, ${f[2]}×${f[3]}`, 12, H2 - 14);
}
