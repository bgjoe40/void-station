'use strict';
// ===== 메뉴 (HTML 덧씌움): 시작 화면 · 타이틀 · 새 작전 · 불러오기 · 저장 · 설정 · 조작법·가이드 · 제작진 · 일시정지 · 작전 실패 · 엔딩 · 순간이동 =====
// 화면마다 [data-nav] 항목을 키보드(↑↓←→ · Enter · Esc)와 마우스로 고름. 꾸밈은 index.html의 CSS, 타이틀 뒤 풍경은 아래 titleBackground

const $ = id => document.getElementById(id);
const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function showOverlay(html) { overlay.innerHTML = html; overlay.classList.remove('hidden'); canvas.style.cursor = 'default'; }
function hideOverlay() { overlay.classList.add('hidden'); overlay.innerHTML = ''; canvas.style.cursor = 'none'; UI.back = UI.anyKey = UI.modal = null; }
const UI = { back: null, anyKey: null, modal: null, closeModal: null, busy: false };

// 화면 하나: back — Esc·뒤로, focus — 처음 고른 항목 (번호 또는 선택자), hints — 아래 키 안내
function screen(html, { cls = '', back = null, focus = 0, hints = true } = {}) {
  showOverlay(`<div class="scr ${cls}">${html}${hints ? hintBar(!!back, hints) : ''}</div>`);
  UI.back = back; UI.anyKey = null; UI.modal = null;
  wireNav(overlay);
  const items = navItems();
  let f = typeof focus === 'string' ? overlay.querySelector(focus) : items[focus];
  if (!f || f.disabled) f = items[0]; // 고를 수 없는 항목이면 첫 항목
  if (f) setFocus(f);
}
// 고른 항목: 실제 포커스 + .f 표시 (창에 포커스가 없을 때도 모양이 남게)
function setFocus(el) {
  for (const o of overlay.querySelectorAll('.f')) if (o !== el) o.classList.remove('f');
  el.classList.add('f'); el.focus({ preventScroll: true });
  if (el.onpick) el.onpick(); // 고르기만 해도 바뀌는 것 (가이드 설명)
  const sc = el.closest('.scroll, .glist'); if (sc) el.scrollIntoView({ block: 'nearest' });
}
function hintBar(back, extra) {
  return `<div class="hints"><span><kbd>↑</kbd><kbd>↓</kbd> 선택</span><span><kbd>Enter</kbd> 확인</span>${back ? '<span><kbd>Esc</kbd> 뒤로</span>' : ''}${typeof extra === 'string' ? extra : ''}</div>`;
}
// 마우스를 올리면 그 항목을 고른 것으로 (키보드와 같은 모양)
function wireNav(root) {
  for (const el of root.querySelectorAll('[data-nav]')) {
    el.addEventListener('mouseenter', () => { if (!el.disabled && !el.classList.contains('f')) { setFocus(el); Snd.play('uiMove'); } });
    el.addEventListener('focus', () => { if (!el.classList.contains('f')) setFocus(el); });
  }
}
const navItems = () => [...(UI.modal || overlay).querySelectorAll('[data-nav]')].filter(el => !el.disabled && el.offsetParent !== null);
// 단추 동작 (누를 때 소리)
function on(el, fn, snd = 'uiOk') { el = typeof el === 'string' ? $(el) : el; if (el) el.onclick = e => { if (UI.busy) return; if (snd) Snd.play(snd); fn(e); }; }
function onAll(sel, fn, snd = 'uiOk') { for (const el of (UI.modal || overlay).querySelectorAll(sel)) on(el, () => fn(el), snd); }

// 메뉴가 떠 있으면 키를 먼저 받음 (게임으로는 보내지 않음)
function uiKey(code) {
  if (overlay.classList.contains('hidden')) return false;
  if (UI.busy) return true;
  if (UI.anyKey) { UI.anyKey(); return true; }
  const items = navItems(), cur = overlay.querySelector('.f') || document.activeElement, i = items.indexOf(cur);
  if (code === 'Escape') { if (UI.modal) UI.closeModal(); else if (UI.back) { Snd.play('uiBack'); UI.back(); } return true; }
  if (cur && cur.dataset.slider && (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD')) { nudgeSlider(cur, /Right|KeyD/.test(code) ? 5 : -5); return true; }
  const dir = { ArrowUp: -1, ArrowLeft: -1, KeyW: -1, KeyA: -1, ArrowDown: 1, ArrowRight: 1, KeyS: 1, KeyD: 1, Tab: 1 }[code];
  if (dir && items.length) {
    const n = items[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + items.length) % items.length];
    setFocus(n); Snd.play('uiMove'); return true;
  }
  if ((code === 'Enter' || code === 'NumpadEnter' || code === 'Space') && cur && items.includes(cur)) { cur.click(); return true; }
  return true;
}
// 확인 창: 지우기·나가기처럼 되돌릴 수 없는 일 (danger면 처음엔 '취소'를 고른 상태)
function confirmBox({ title, text, ok = '확인', cancel = '취소', danger = false, onOk, onCancel }) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="frm cf"><div class="hd"><div class="grow"><div class="h1" style="font-size:32px">${title}</div></div></div>
    <p>${text}</p><div class="ft"><button class="btn ${danger ? 'danger' : 'pri'} cf-ok" data-nav>${ok}</button><button class="btn cf-no" data-nav>${cancel}</button></div></div>`;
  overlay.appendChild(m); UI.modal = m; wireNav(m);
  const back = overlay.querySelector('.f'), done = fn => { m.remove(); UI.modal = null; UI.closeModal = null; if (fn) fn(); else if (back && back.isConnected) setFocus(back); };
  m.querySelector('.cf-ok').onclick = () => { Snd.play('uiOk'); done(onOk); };
  m.querySelector('.cf-no').onclick = () => { Snd.play('uiBack'); done(onCancel); };
  UI.closeModal = () => { Snd.play('uiBack'); done(onCancel); };
  setFocus(m.querySelector(danger ? '.cf-no' : '.cf-ok'));
}
// 화면 전환: 검게 덮었다가 fn 뒤에 걷힘 (새 작전 시작·불러오기·타이틀로)
function fadeThen(fn, ms = 380) {
  if (UI.busy) return;
  UI.busy = true;
  const f = document.createElement('div'); f.className = 'fade'; document.body.appendChild(f);
  setTimeout(() => f.classList.add('on'), 16);
  setTimeout(() => { UI.busy = false; try { fn(); } finally { f.classList.remove('on'); setTimeout(() => f.remove(), ms + 60); } }, ms + 30);
}
// 슬라이더 줄: 왼쪽·오른쪽 키로 5씩
function nudgeSlider(row, d) {
  const inp = row.querySelector('input[type=range]');
  if (!inp) return;
  inp.value = clamp(+inp.value + (+inp.step > 1 ? Math.sign(d) * +inp.step : d), +inp.min, +inp.max); inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change')); // 칸이 큰 것(UI 크기)은 한 칸씩
}

// --- 아틀라스 그림을 메뉴에 (픽셀 그대로 키움) ---
const iconCache = new Map();
function iconURL(key, max = 120) {
  const f = key && META.frames[key];
  if (!f || !ART.ready) return '';
  const id = key + ':' + max;
  if (iconCache.has(id)) return iconCache.get(id);
  const [sx, sy, fw, fh] = f, k = Math.max(1, Math.floor(max / Math.max(fw, fh)));
  const c = document.createElement('canvas'); c.width = (fw + 2) * k; c.height = (fh + 2) * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(edged(ART.atlas, sx, sy, fw, fh), 0, 0, (fw + 2) * k, (fh + 2) * k); // 게임 UI와 같은 회색 외곽선
  const u = c.toDataURL(); iconCache.set(id, u); return u;
}
const monIcon = t => frontKey(ENEMY_ART[t].spr, ENEMY_ART[t].walk[0]);
const img = (key, max, cls = '') => { const u = iconURL(key, max); return u ? `<img class="${cls}" src="${u}" alt="">` : ''; };

// --- 로고: 굵은 글자에 정거장 벽 텍스처를 입힌 주황 금속판 (두께·반사광·결) ---
let logoURL = '', logoTex = false;
function makeLogo() {
  const text = 'VOID STATION', font = "122px Impact, 'Arial Black', sans-serif";
  const setup = q => { q.font = font; q.textAlign = 'center'; q.textBaseline = 'alphabetic'; if ('letterSpacing' in q) q.letterSpacing = '9px'; };
  const m = document.createElement('canvas').getContext('2d'); setup(m);
  const w = Math.ceil(m.measureText(text).width + 120), h = 250, x = w / 2, y = 176; // 빛 번짐만큼 여백
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); setup(g);
  g.save(); g.shadowColor = 'rgba(255,90,25,0.6)'; g.shadowBlur = 50; g.fillStyle = '#3c1204'; g.fillText(text, x, y); g.restore(); // 뒤쪽 빛
  for (let k = 10; k >= 1; k--) { g.fillStyle = `rgb(${16 + k * 4},${7 + k * 2},${5 + k})`; g.fillText(text, x + k * 0.35, y + k); } // 두께
  const f = document.createElement('canvas'); f.width = w; f.height = h;
  const q = f.getContext('2d'); setup(q);
  const gr = q.createLinearGradient(0, y - 98, 0, y + 4);
  gr.addColorStop(0, '#fff3dc'); gr.addColorStop(0.24, '#ffbe6a'); gr.addColorStop(0.5, '#ff7426'); gr.addColorStop(0.78, '#c23a0e'); gr.addColorStop(1, '#5c1504');
  q.fillStyle = gr; q.fillText(text, x, y);
  const tex = ART.ready && (ART.tex['wall_metal2'] || ART.tex['wall_support3']);
  if (tex) { // 금속 결: 텍스처를 곱하고 글자 모양으로 다시 자름
    const pat = q.createPattern(tex, 'repeat'); pat.setTransform(new DOMMatrix().scale(1.4));
    q.globalCompositeOperation = 'multiply'; q.globalAlpha = 0.38; q.fillStyle = pat; q.fillRect(0, 0, w, h);
    q.globalAlpha = 1; q.globalCompositeOperation = 'destination-in'; q.fillStyle = '#fff'; q.fillText(text, x, y);
  }
  q.globalCompositeOperation = 'source-atop';
  const hl = q.createLinearGradient(0, y - 98, 0, y - 56); hl.addColorStop(0, 'rgba(255,255,255,0.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  q.fillStyle = hl; q.fillRect(0, y - 100, w, 46); // 윗부분 반사광
  q.fillStyle = 'rgba(0,0,0,0.16)'; for (let yy = y - 100; yy < y + 8; yy += 4) q.fillRect(0, yy, w, 1); // 가로 결
  g.drawImage(f, 0, 0);
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(28,8,2,0.95)'; g.strokeText(text, x, y);
  g.lineWidth = 1; g.strokeStyle = 'rgba(255,220,180,0.32)'; g.strokeText(text, x, y - 1);
  logoTex = !!tex;
  return c.toDataURL('image/png');
}
function logoHTML() {
  if (!logoURL || (!logoTex && ART.ready)) logoURL = makeLogo();
  return `<img class="logo" src="${logoURL}" alt="VOID STATION">`;
}

// --- 저장 정보 ---
const diffBadge = k => `<span class="badge ${k}">${DIFFICULTY[k] ? DIFFICULTY[k].name : '보통'}</span>`;
function timeAgo(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`;
}
const regName = n => CAMPAIGN[clamp(n || 1, 1, CAMPAIGN.length) - 1].name;
function pipsHTML(d) { // 구역 1~9: 들어가 본 곳 · 지금 구역
  const fl = (d.field && d.field.flags) || {}, vis = fl.visited || [];
  return `<div class="pips">${CAMPAIGN.map((_, k) => `<i class="${k + 1 === d.stage ? 'c' : vis.includes(k + 1) ? 'v' : ''}"></i>`).join('')}</div>`;
}
function slotHTML(d, k, attrs) { // k: 슬롯 번호 또는 'auto' (거점 자동 저장)
  const no = k === 'auto' ? `<div class="no" style="font-size:16px">자동<small>거점</small></div>` : `<div class="no">${k + 1}<small>슬롯</small></div>`;
  if (!d) return `<button class="sl empty" data-nav ${attrs}>${no}<div><div class="t1">빈 슬롯</div></div></button>`;
  const p = d.player || {};
  return `<button class="sl" data-nav ${attrs}>${no}
    <div><div class="t1">구역 ${d.stage} ${regName(d.stage)}${diffBadge(d.diff || 'normal')}</div>
      <div class="t2"><span>Lv <b>${p.clv || 1}</b></span><span>플레이 <b>${fmtPlay(d.playtime || 0)}</b></span><span>처치 <b>${(d.kills || 0).toLocaleString()}</b></span><span>골드 <b>${(p.gold || 0).toLocaleString()}</b></span></div>
      ${pipsHTML(d)}</div>
    <div class="when"><b>${fmtTime(d.time).slice(5)}</b>${timeAgo(d.time)}</div></button>`;
}

// ===== 타이틀 배경: 정거장 구역 3(화물 터미널)을 천천히 지나가는 카메라 — 플레이어·HUD 없이 조명만 (render·drawLighting이 state 'title'을 봄) =====
const TITLE_SEED = 7340021;
let titleCam = null; // { pts: [[x, y]], cum, len, s, wait, fade }
function titleBackground() {
  inBase = true; player = newPlayer(); resetWorld();
  flags = { bosses: [], missions: [], keys: [], hubs: [], visited: [], logs: [] };
  msgs = []; hurtFlash = 0; invOpen = false; held = null; trade = null; titleCam = null;
  try { withSeed(TITLE_SEED, genField); } catch (e) { genBase(); placePlayer(...BASE_SPAWN); return; }
  fieldSeed = TITLE_SEED; resetMinimap(true);
  for (const d of doors) { d.open = 1; d.locked = false; } // 문은 열어 둠 (카메라가 지나감)
  // 카메라 길: 입구 방 → (가장 가까운 방부터) 구역의 방을 모두 거쳐 → 보스 방
  const R = regions[3], route = [R.entry], rest = R.rooms.filter(r => r !== R.entry && r !== R.exit), raw = [];
  while (rest.length) { const c = route[route.length - 1], d = bfs(c.cx, c.cy); rest.sort((a, b) => d[a.cy * MW + a.cx] - d[b.cy * MW + b.cx]); route.push(rest.shift()); }
  route.push(R.exit);
  for (let k = 1; k < route.length; k++) { // 두 방 사이: 도착 방까지의 길 거리가 줄어드는 쪽으로
    const b = route[k], dist = bfs(b.cx, b.cy);
    let i = route[k - 1].cx, j = route[k - 1].cy;
    for (let n = 0; n < 2000 && dist[j * MW + i] > 0; n++) {
      raw.push([i + 0.5, j + 0.5]);
      const nx = DIR4.map(([dx, dy]) => [i + dx, j + dy]).find(([a, c]) => dist[c * MW + a] >= 0 && dist[c * MW + a] < dist[j * MW + i]);
      if (!nx) break; [i, j] = nx;
    }
  }
  raw.push([R.exit.cx + 0.5, R.exit.cy + 0.5]);
  const pts = raw.map((_, n) => { let x = 0, y = 0, c = 0; for (let m = Math.max(0, n - 7); m <= Math.min(raw.length - 1, n + 7); m++) { x += raw[m][0]; y += raw[m][1]; c++; } return [x / c, y / c]; });
  const cum = [0]; for (let n = 1; n < pts.length; n++) cum.push(cum[n - 1] + Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]));
  // 분위기: 지나가는 방마다 쉬고 있는 몬스터, 쓰러진 해병과 핏자국, 보스 방의 타이탄
  const pool = Object.fromEntries(Object.entries(enemyPool(3)).filter(([k]) => !ENEMIES[k].nest && !ENEMIES[k].bomb));
  for (const r of R.rooms) {
    if (r === R.entry || r === R.exit) continue;
    for (let k = irnd(1, 3); k > 0; k--) { const q = randomFloorIn(r, 0.5), e = spawnEnemy(weighted(pool), q.x, q.y, 3); e.face = rnd(0, 6.28); }
  }
  const t = spawnEnemy('titan', R.exit.cx + 0.5, R.exit.cy + 0.5, 3); const look = pts[Math.max(0, pts.length - 12)]; t.face = Math.atan2(look[1] - t.y, look[0] - t.x);
  for (let k = 0; k < 9; k++) {
    const [px, py] = pts[Math.floor(rnd(0.15, 0.9) * pts.length)], x = px + rnd(-2.5, 2.5), y = py + rnd(-2.5, 2.5);
    if (collides(x, y, 0.3, false)) continue;
    corpses.push({ x, y, type: pick(['gunner', 'gunner', 'xenoid', 'crawler']), face: rnd(0, 6.28), t: 99 });
    bloodSplat(x, y, rnd(0.6, 1.1), 'rgba(120,10,10,0.85)');
  }
  titleCam = { pts, cum, len: cum[cum.length - 1], s: 0, wait: 0, fade: 1 };
  placePlayer(pts[0][0], pts[0][1]);
}
// 길 위의 거리 s에 있는 점
function titlePos(C, s) {
  let lo = 0, hi = C.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (C.cum[m] <= s) lo = m; else hi = m; }
  const seg = C.cum[hi] - C.cum[lo] || 1, t = clamp((s - C.cum[lo]) / seg, 0, 1);
  return [C.pts[lo][0] + (C.pts[hi][0] - C.pts[lo][0]) * t, C.pts[lo][1] + (C.pts[hi][1] - C.pts[lo][1]) * t];
}
// 타이틀 동안 매 프레임: 카메라가 길을 따라 흐르고 (끝에서 잠시 머문 뒤 검게 덮였다가 처음으로), 몬스터는 어슬렁, 조명 깜박임·불꽃
function titleTick(dt) {
  gtime += dt;
  const C = titleCam;
  if (C) {
    if (C.s < C.len) C.s = Math.min(C.len, C.s + 1.15 * dt); else C.wait += dt;
    if (C.wait > 7) { C.s = 0; C.wait = 0; placePlayer(...C.pts[0]); }
    [player.x, player.y] = titlePos(C, C.s);
    C.fade = C.s < 2 ? 1 - C.s / 2 : C.wait > 5.5 ? Math.min(1, (C.wait - 5.5) / 1.5) : 0;
  }
  for (const e of enemies) {
    e.anim += dt;
    if (e.d.boss || e.d.fixed) continue;
    if ((e.wander -= dt) <= 0) { e.wander = rnd(2, 5); const go = Math.random() < 0.45, a = rnd(0, 6.28); e.wx = go ? Math.cos(a) : 0; e.wy = go ? Math.sin(a) : 0; }
    e.moving = !!(e.wx || e.wy);
    if (e.moving) { moveEntity(e, e.wx * e.d.spd * 0.22 * dt, e.wy * e.d.spd * 0.22 * dt); e.face += angDiff(Math.atan2(e.wy, e.wx), e.face) * Math.min(1, dt * 5); }
  }
  if (Math.random() < dt * 0.7 && lamps.length) { // 고장 난 조명에서 튀는 불꽃
    const l = pick(lamps);
    if (Math.abs(l.x - player.x) + Math.abs(l.y - player.y) < 22) { spark(l.x, l.y, 10, pick(['#ffd27a', '#9df']), 3); flashes.push({ x: l.x, y: l.y, r: 140, t: 0.12, max: 0.12, col: '255,220,160' }); }
  }
  updateMisc(dt);
}

// ===== 시작 화면: 로고 → 그래픽을 다 불러오면 '아무 키나 누르세요' (브라우저는 사용자가 누른 뒤에야 소리를 냄) =====
function splashScreen() {
  state = 'title';
  screen(`<div class="fx-vig"></div><div class="fx-scan"></div><div class="fx-sweep"></div>
    <div class="splash scr" style="animation-duration:1.2s">
      ${logoHTML()}
      <div id="spl">${ART.ready ? '' : `<div class="load"><div class="meter"><i></i></div><div class="muted">불러오는 중</div></div>`}</div>
    </div>`, { cls: 'title', hints: false });
  const ready = () => {
    if (!$('spl')) return;
    if (!logoTex) { logoURL = makeLogo(); const l = overlay.querySelector('.logo'); if (l) l.src = logoURL; }
    $('spl').innerHTML = `<div class="press">아무 키나 누르세요</div>`;
    UI.anyKey = () => { UI.anyKey = null; Snd.init(); Snd.play('uiOk'); titleScreen(); };
    overlay.onclick = () => { if (UI.anyKey) UI.anyKey(); };
  };
  if (ART.ready) ready(); else ART.loading.then(ready);
}

// ===== 타이틀 (메인 메뉴) =====
function titleScreen() {
  state = 'title'; overlay.onclick = null;
  if (!titleCam && !tiles) titleBackground();
  Music.play(MUSIC.title);
  const S = readSaves(), last = latestSlot(), L = last !== -1 ? saveAt(S, last) : null, clears = S.log.filter(l => l.clear);
  const achN = Object.keys(codex.ach || {}).length, logN = Object.keys(codex.logs || {}).length;
  const all = ['mon', 'boss', 'uq'].map(t => codexCards(t)), got = all.reduce((a, c) => a + c.filter(x => x.known).length, 0), tot = all.reduce((a, c) => a + c.length, 0);
  const items = [
    ['cont', '이어하기', L ? `${slotName(last)}, 구역 ${L.stage} ${regName(L.stage)}, Lv ${L.player.clv || 1}, ${timeAgo(L.time)}` : '저장한 작전이 없습니다', !L],
    ['new', '새 작전', ''],
    ['load', '불러오기', ''],
    ['set', '설정', ''],
    ['man', '조작법과 가이드', ''],
    ['dbg', '디버그', ''],
    ['cred', '제작진', ''],
  ];
  screen(`<div class="shade"></div><div class="shade2"></div><div class="fx-scan"></div><div class="fx-sweep"></div>
    <div class="t-col">
      ${logoHTML()}
      <nav class="mm">${items.map(([id, t, sub, dis], n) => `<button class="mi" data-nav id="m_${id}" style="--i:${n}" ${dis ? 'disabled' : ''}><span class="lb"><span class="t">${t}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span></button>`).join('')}</nav>
    </div>
    <aside class="t-side">
      ${L ? `<div class="frm t-card"><div class="eye">마지막 저장</div>
        <div class="big">구역 ${L.stage} ${regName(L.stage)}${diffBadge(L.diff || 'normal')}</div>
        <div class="row"><span>캐릭터</span><b>Lv ${L.player.clv || 1}</b></div>
        <div class="row"><span>플레이 시간</span><b>${fmtPlay(L.playtime || 0)}</b></div>
        <div class="row"><span>저장</span><b>${timeAgo(L.time)}</b></div>${pipsHTML(L)}</div>` : ''}
      <div class="frm t-card"><div class="eye cy">기록</div>
        <div class="row"><span>수집 도감</span><b>${got} / ${tot}</b></div><div class="meter cy"><i style="--v:${tot ? got / tot : 0}"></i></div>
        <div class="row"><span>업적</span><b>${achN} / ${ACHIEVEMENTS.length}</b></div><div class="meter"><i style="--v:${achN / ACHIEVEMENTS.length}"></i></div>
        <div class="row"><span>데이터 기록</span><b>${logN} / ${LOGS.length}</b></div>
        <div class="row"><span>탈출 성공</span><b>${clears.length ? clears.length + '회' : '없음'}</b></div></div>
    </aside>
    <div class="t-foot"><span>그래픽, 소리, 음악: Freedoom (BSD)&nbsp;&nbsp;&nbsp;아이콘: knekko, Project Cordon, AlejandroHaibi (CC0)&nbsp;&nbsp;&nbsp;글꼴: Neo둥근모 (OFL)</span>
      <span class="keys-h"><span><kbd>↑</kbd><kbd>↓</kbd> 선택</span><span><kbd>Enter</kbd> 확인</span></span><span class="ver">v${VERSION}</span></div>`,
  { cls: 'title', back: null, focus: UI.lastTitle || (L ? '#m_cont' : '#m_new'), hints: false });
  const go = (id, fn) => on(id, () => { UI.lastTitle = '#' + id; fn(); }); // 돌아오면 고르던 항목에
  go('m_cont', () => fadeThen(() => loadGame(latestSlot())));
  go('m_new', newGameScreen);
  go('m_load', () => loadScreen(titleScreen));
  go('m_set', () => settingsScreen(titleScreen));
  go('m_man', () => helpScreen(titleScreen));
  go('m_dbg', () => debugScreen(titleScreen)); // debug.js
  go('m_cred', () => creditsScreen(titleScreen));
}
function toTitle() { UI.lastTitle = null; fadeThen(() => { titleBackground(); titleScreen(); }); }

// ===== 새 작전: 난이도 카드 (고르면 바로 시작) =====
function newGameScreen() {
  const art = { easy: 'crawler', normal: 'xenoid', hard: 'brute' }, desc = {
    easy: '정거장이 처음이라면. 적이 약하고 덜 아프다.',
    normal: '설계한 그대로의 작전. 장비와 스킬을 고루 갖춰야 코어까지 간다.',
    hard: '적은 단단하고 한 대 한 대가 치명적이다. 파밍과 성장이 모두 필요하다.' };
  const bar = (v, max) => `<div class="meter"><i style="--v:${v / max}"></i></div>`;
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm" style="width:min(980px,92vw)">
      <div class="hd"><div class="grow"><div class="h1">난이도 선택</div></div></div>
      <div class="bd"><div class="dcs">${Object.entries(DIFFICULTY).map(([k, D]) => `
        <button class="dc" data-nav data-diff="${k}">${k === 'normal' ? '<span class="rec">추천</span>' : ''}
          <div class="art">${img(monIcon(art[k]), 130)}</div>
          <div class="nm">${D.name}</div>
          <p>${desc[k]}</p>
          <div class="stat"><span>적 체력</span>${bar(D.hp, 1.5)}<b>${Math.round(D.hp * 100)}%</b></div>
          <div class="stat"><span>받는 피해</span>${bar(D.dmg, 1.5)}<b>${Math.round(D.dmg * 100)}%</b></div>
        </button>`).join('')}</div></div>
      <div class="ft"><span class="note"></span><button class="btn" data-nav id="nBack">뒤로</button></div>
    </div></div>`, { cls: 'dim', back: titleScreen, focus: '[data-diff="normal"]' });
  onAll('[data-diff]', b => fadeThen(() => newGame(b.dataset.diff)));
  on('nBack', titleScreen, 'uiBack');
}

// ===== 불러오기 =====
function loadScreen(back) {
  const S = readSaves(), log = S.log.slice(0, 12);
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm" style="width:min(1040px,94vw)">
      <div class="hd"><div class="grow"><div class="h1">불러오기</div></div></div>
      <div class="bd" style="display:grid;grid-template-columns:1fr 300px;gap:24px">
        <div class="slots">${[...(S.auto ? ['auto'] : []), ...S.slots.keys()].map(k => { const d = saveAt(S, k); return `<div class="sl-wrap">${slotHTML(d, k, `data-load="${k}" ${d ? '' : 'disabled'}`)}${d ? `<button class="del" data-nav data-del="${k}" title="지우기">지우기</button>` : '<span></span>'}</div>`; }).join('')}</div>
        <div><div class="sect">작전 기록</div><ul class="log">${log.length ? log.map(l => l.clear
          ? `<li class="clear"><b>${fmtTime(l.time).slice(5)}</b>★ 탈출 성공, ${DIFFICULTY[l.diff] ? DIFFICULTY[l.diff].name : ''}, ${fmtPlay(l.playtime)}</li>`
          : `<li><b>${fmtTime(l.time).slice(5)}</b>${slotName(l.slot)}, 구역 ${l.stage}, 처치 ${l.kills}</li>`).join('') : ''}</ul></div>
      </div>
      <div class="ft"><span class="note"></span><button class="btn" data-nav id="lBack">뒤로</button></div>
    </div></div>`, { cls: 'dim', back, focus: '[data-load]:not(:disabled)' });
  const slotOf = v => v === 'auto' ? 'auto' : +v;
  onAll('[data-load]', b => fadeThen(() => loadGame(slotOf(b.dataset.load))));
  onAll('[data-del]', b => confirmBox({ title: `${slotName(slotOf(b.dataset.del))}을(를) 지울까요?`, text: '지운 저장은 되돌릴 수 없습니다.', ok: '지우기', danger: true,
    onOk: () => { const s2 = readSaves(), k = slotOf(b.dataset.del); if (k === 'auto') s2.auto = null; else s2.slots[k] = null; writeSaves(s2); Snd.play('crate'); loadScreen(back); } }), 'uiMove');
  on('lBack', back, 'uiBack');
}

// ===== 저장 (보급 거점의 기록 단말기) =====
function saveScreen(title, doneLabel, onDone, saved = -1) {
  const S = readSaves();
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm" style="width:min(820px,92vw)">
      <div class="hd"><div class="grow"><div class="h1">${title}</div></div></div>
      <div class="bd"><div class="slots">${S.slots.map((d, k) => slotHTML(d, k, `data-save="${k}"`).replace('<div class="no">', `<div class="no"${k === saved ? ' style="color:var(--good)"' : ''}>`)).join('')}</div></div>
      <div class="ft"><span class="note">${saved >= 0 ? `<span style="color:var(--good)">✔ 슬롯 ${saved + 1}에 저장했습니다</span>` : ''}</span><button class="btn" data-nav id="sDone">${doneLabel}</button></div>
    </div></div>`, { cls: 'dim', back: onDone, focus: saved >= 0 ? '#sDone' : 0 });
  const save = k => { const ok = saveGame(k); if (ok) saveScreen(title, doneLabel, onDone, k); else confirmBox({ title: '저장하지 못했습니다', text: '브라우저 저장소를 쓸 수 없습니다.', ok: '확인', cancel: '닫기' }); };
  onAll('[data-save]', b => { const k = +b.dataset.save; if (S.slots[k]) confirmBox({ title: `슬롯 ${k + 1}에 덮어쓸까요?`, text: `지금 저장된 작전 (구역 ${S.slots[k].stage}, Lv ${S.slots[k].player.clv || 1})은 사라집니다.`, ok: '덮어쓰기', danger: true, onOk: () => save(k) }); else save(k); }, 'uiMove');
  on('sDone', onDone, 'uiBack');
}

// ===== 설정: 소리 · 화면 · 게임 · 조작 (바로 적용, 저장) =====
let setTab = 'sound';
function settingsScreen(back, tab = setTab) {
  Snd.init(); setTab = tab;
  const tabs = [['sound', '소리'], ['view', '화면'], ['game', '게임'], ['keys', '조작']];
  const slider = (k, label, sub = '', min = 0, max = 100, step = 1) => `<div class="opt" data-nav tabindex="0" data-slider="${k}"><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${Math.round(settings[k] * 100)}" tabindex="-1" style="--v:${(settings[k] * 100 - min) / (max - min)}"><span class="val">${Math.round(settings[k] * 100)}%</span></div>`;
  const toggle = (k, label, sub = '') => `<button class="opt ${settings[k] ? 'on' : ''}" data-nav data-toggle="${k}"><span class="lbl">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw"></span><span class="val">${settings[k] ? '켜짐' : '꺼짐'}</span></button>`;
  const cur = MUSIC_INFO[Music.want];
  const body = {
    sound: `<div class="sect">음량</div>${slider('master', '전체 음량')}${slider('music', '배경음악')}${slider('sfx', '효과음')}${slider('amb', '환경음')}
      ${cur ? `<div class="obj" style="margin-top:18px"><small class="eye">재생 중</small>${escHtml(cur[0])} (${escHtml(cur[1])})</div>` : ''}`,
    view: `<div class="sect">화면</div>${slider('uiScale', 'UI 크기', '', 75, 200, 25)}${slider('shake', '화면 흔들림')}${toggle('dmgNums', '피해 숫자')}${toggle('hurtFx', '피격 화면 효과')}
      <button class="opt act" data-nav id="oFull"><span class="lbl">전체 화면</span><span></span><span class="val">${document.fullscreenElement ? '켜짐' : '꺼짐'}</span></button>`,
    game: `<div class="sect">안내</div>${toggle('tips', '첫 플레이 안내')}
      <button class="opt act" data-nav id="oTips"><span class="lbl">본 안내 처음부터 다시 보기<small>지금까지 ${tipsSeen.size}개를 봤습니다</small></span><span></span><span class="val">초기화</span></button>
      <div class="sect" style="margin-top:18px">전투</div>${toggle('autoAim', '자동 조준')}
      <div class="sect" style="margin-top:18px">전리품</div>${toggle('hideCommon', '바닥의 일반 등급 장비 숨기기')}`,
    keys: keysHTML(),
  }[tab];
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm" style="width:min(${tab === 'keys' ? 1080 : 760}px,94vw)">
      <div class="hd"><div class="grow"><div class="h1">설정</div></div>
        <div class="tabs">${tabs.map(([id, t]) => `<button class="tab ${id === tab ? 'on' : ''}" data-nav data-tab="${id}">${t}</button>`).join('')}</div></div>
      <div class="bd scroll" style="max-height:min(560px,64vh)">${body}</div>
      <div class="ft"><span class="note"></span><button class="btn" data-nav id="oBack">뒤로</button></div>
    </div></div>`, { cls: 'dim', back, focus: `[data-tab="${tab}"]`, hints: '<span><kbd>←</kbd><kbd>→</kbd> 값 조절</span>' });
  onAll('[data-tab]', b => { if (b.dataset.tab !== tab) settingsScreen(back, b.dataset.tab); }, 'uiMove');
  for (const row of overlay.querySelectorAll('[data-slider]')) {
    const k = row.dataset.slider, inp = row.querySelector('input'), val = row.querySelector('.val');
    inp.oninput = () => { settings[k] = inp.value / 100; inp.style.setProperty('--v', (inp.value - inp.min) / (inp.max - inp.min)); val.textContent = inp.value + '%'; applyVolume(); };
    inp.onchange = () => { saveSettings(); if (k === 'sfx' || k === 'master') Snd.play('pickup'); if (k === 'uiScale') applyUiScale(); }; // UI 크기: 놓으면 메뉴도 그 크기로
  }
  onAll('[data-toggle]', b => {
    const k = b.dataset.toggle; settings[k] = !settings[k]; saveSettings();
    if (k === 'tips' && !settings.tips) { tipQueue = []; tipNow = null; }
    b.classList.toggle('on', settings[k]); b.querySelector('.val').textContent = settings[k] ? '켜짐' : '꺼짐';
  });
  on('oFull', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); setTimeout(() => settingsScreen(back, 'view'), 250); });
  on('oTips', () => confirmBox({ title: '안내를 처음부터 다시 볼까요?', text: '지금까지 본 첫 플레이 안내 카드가 다시 나옵니다.', ok: '초기화', onOk: () => { resetTips(); settingsScreen(back, 'game'); } }));
  on('oBack', back, 'uiBack');
}

// ===== 조작법 · 가이드 =====
const KEY_GROUPS = [
  ['이동과 전투', [
    [['W', 'A', 'S', 'D'], '이동', '방향키도 됨'], [['마우스'], '조준', '커서 쪽으로 쏨 (설정에서 자동 조준을 켜면 조준한 쪽의 가장 가까운 적)'],
    [['좌클릭'], '공격', '자동화기는 누르고 있기'], [['우클릭'], '수류탄 던지기', '커서 위치로'], [['G'], '수류탄 종류 바꾸기'],
    [['R'], '재장전'], [['Shift'], '달리기', '스태미너를 계속 씀'], [['Space'], '회피 대시', `잠깐 무적, 대기 ${DASH_CD}초`], [['1', '~', '4'], '무기 슬롯', '휠로도 바꿈']]],
  ['아이템과 스킬', [
    [['Q'], '메디킷', '최대 체력의 40% 회복'], [['E'], '치료제', '중독, 화상, 감전 해제'], [['T'], '아드레날린', '잠시 빨라짐'],
    [['Z', 'X', 'V', 'B'], '스킬', '스킬 창에 끼운 쉘'], [['F'], '줍기, 사용', '무기, 자판기, 단말기, 보물함']]],
  ['창과 시스템', [
    [['I'], '인벤토리', '장비 (Tab도 됨)'], [['K'], '스킬', '장착 스킬, 특성'], [['J'], '수집 도감', '몬스터, 장비, 기록, 업적'],
    [['M'], '전체 지도'], [['H'], '안내 카드 닫기', '데이터 기록 재생도'], [['Esc'], '일시정지', '열린 창 닫기']]],
];
function keysHTML() {
  return `<div class="kgrid">${KEY_GROUPS.map(([t, rows]) => `<div class="kgroup"><div class="h1" style="font:16px var(--f-disp);margin-bottom:8px">${t}</div>
    ${rows.map(([ks, what, sub]) => `<div class="krow"><span class="keys">${ks.map(k => k === '~' ? '~' : `<kbd>${k}</kbd>`).join('')}</span><span>${what}${sub ? `<small>${sub}</small>` : ''}</span></div>`).join('')}</div>`).join('')}</div>`;
}
const GUIDE = [
  ['hub', '보급 거점', 'icon_case_white', `정거장 곳곳의 <b>안전 지대</b>. 몬스터와 적 탄환이 들어오지 못하고, 안에서는 싸울 수 없다. 자판기 앞에서 <b>[F]</b>: 보급(사기·팔기), 개조(장비 개조, 파츠, 분해), 기록(저장), 보관함(창고).<br>가운데 <b>순간이동 패드</b>로 찾아 둔 다른 거점에 간다. 체력이 0이 되면 몇 초 동안 <b>기어 다니며</b> 싸울 수 있고 (쏘기·장전이 느리고 맞으면 버틸 시간이 줄어듦), 그동안 피해를 주거나 적을 처치하거나 탄약을 주우면 다시 일어난다 (자주 쓰러지면 버틸 시간이 줄었다가 살아 있으면 다시 늘어남). 그래도 죽으면 누르고 있어 마지막으로 들른 거점에서 다시 일어난다 (골드 ${Math.round(DEATH_GOLD * 100)}% 잃음). 레벨은 그대로지만 지금 레벨에서 모은 경험치는 쓰러진 자리에 떨어지고, 주우면 ${Math.round(DEATH_XP * 100)}%를 되찾는다.`],
  ['gate', '봉쇄 격벽과 키카드', 'bkeya0', `다음 구역으로 가는 길목의 주황빛 <b>봉쇄 격벽</b>은 구역 3·6의 보스를 처치하거나 구역 8의 통제 단말기를 해킹해야 열린다 (키카드로는 안 열림).<br>양 끝에 색 표시등이 있는 <b>파란·노란 보안문</b>은 그 구역에서 같은 색 키카드를 주워야 열린다.<br>왼쪽 위 목표의 아래 줄은 그 구역의 할 일 (키카드 · 보스 · 다음 구역), 작은 지도의 <b>초록 화살표</b>는 다음 구역 쪽.`],
  ['mission', '구역 임무', 'sswva1', `섬멸 말고도 <b>생존자 구출</b>(거점 패드까지 데려가기), <b>해킹</b>(단말기의 보안 단계: 전선 연결, 암호 찾기, 순서 기억, 회로 연결), <b>둥지 파괴</b>가 있다. 화면 왼쪽 위에 목표, 미니맵에 위치가 나온다.`],
  ['event', '돌발 상황', 'tlmpa0', `구역 2부터 가끔 (막마다 두 가지를 번갈아): <b>정전</b>(손전등만 남음), <b>독가스 누출</b>(치료제), <b>선체 파손</b>(구멍에서 멀어지거나 다른 방으로). 보급 거점 안은 안전하다.`],
  ['melee', '근접 무기', 'icon_knife', `총과 역할이 다르다. <b>근접으로 처치</b>하면 체력이 조금 차고 탄약(장착한 총 중 가장 모자란 탄)이 튀어나온다. 정예·보스는 더 많이.<br>휘두르면 날아오는 <b>적 탄을 쳐내고</b>, <b>장갑을 무시</b>하며 <b>방패를 3배로</b> 부순다. 기절·빙결한 적에게는 더 아프고, 돌진·투척·불기둥·되살리는 주문 같은 <b>준비 동작을 끊는다</b>.<br><b>전동 체인톱</b>은 누르고 있는 동안 계속 갈아 내고 처치하면 탄약이 반드시 넉넉히 나온다(탄은 못 쳐냄). <b>방전 진압봉</b>은 기절시키고 번개가 가까운 적 셋에게 튄다. <b>플라즈마 블레이드</b>는 넓게 휘두르고 쳐낸 탄을 앞쪽의 적에게 되돌려 보낸다.`],
  ['attach', '무기 파츠', 'att_scope', `조준경, 소음기, 탄창 같은 무기 부품. 총은 <b>총구, 조준경, 탄창, 개머리판, 하부</b>, 근접 무기는 <b>날, 손잡이, 모듈</b> 칸에 하나씩 끼운다. 끼운 파츠는 무기 그림에도 붙어 보인다.<br>적과 상자에서 떨어지고(일반, 고급, 희귀) 보급 자판기의 <b>파츠</b> 탭에서도 판다. 끼우고 빼는 것은 <b>보급 거점의 개조 자판기</b>(파츠 개조 탭)에서만 한다. 무기를 클릭해 고르고, 가방의 파츠를 끌어다 놓거나 우클릭한다.`],
  ['mod', '장비 개조', 'arm1a0', `개조 자판기의 <b>장비 개조</b> 탭에서 고른 방어구에 개조를 단다. 장비 종류마다 달 수 있는 개조가 정해져 있다: ${Object.entries(ARMOR_SLOTS).map(([s, n]) => `${n}(${Object.values(MODS).filter(M => M.slot === s).map(M => M.name).join(', ')})`).join(', ')}.<br>한 장비에 올릴 수 있는 단계는 등급에 따라 일반 ${MOD_CAP[0]}, 고급 ${MOD_CAP[1]}, 희귀 ${MOD_CAP[2]}, 전설 이상 ${MOD_CAP[3]}. 단계마다 골드와 <b>부품</b>(분해로 얻음)이 들고, 효과는 그 장비를 장착했을 때만 난다.`],
  ['slots', '무기 슬롯', 'icon_assault', `무기 슬롯은 처음 <b>${WEAPON_SLOTS.base}칸</b>. 어떤 무기든 끼울 수 있다. 막 보스(구역 ${WEAPON_SLOTS.bosses.join('·')}의 보스)를 처치할 때마다 한 칸씩 늘어난다 (최대 ${WEAPON_SLOTS.max}칸).`],
  ['gear', '장비 등급과 고유 전설', 'icon_revolver', `등급: 일반, <b style="color:#66aaff">고급</b>, <b style="color:#ffdd55">희귀</b>, <b style="color:#ff9933">전설</b>, <b style="color:#dcc283">★ 고유 전설</b>(이름과 고유 효과, 바닥에서 빛기둥). 무기 위에서 [F]로 줍고, 인벤토리에서 끌어서 장착한다.`],
  ['skill', '스킬 쉘', 'bfe1d0', `스킬은 <b>스킬 쉘</b>을 스킬 창 <b>[K]</b>의 칸(Z X V B)에 끼워야 쓴다. 쉘의 등급·옵션, 캐릭터 레벨, 강화장신구로 강해진다. 스킬마다 동작이 바뀌는 고유 전설 쉘도 있다.`],
  ['grow', '성장', 'pstra0', `레벨이 오를 때마다 특성 1점(스킬 창 <b>[K]</b>)을 얻고 모든 스킬의 위력이 ${Math.round(SKILL_PER_LEVEL * 100)}% 오른다. 특성은 사격·생존·전술 트리로, 위 단은 이어진 아래 칸을 배우고 레벨이 되어야 열린다. <b>강화칩</b>은 몸 능력(체력·이동·재장전·회피), <b>강화장신구</b>는 모든 스킬(위력·대기시간·지속·범위)을 키운다.`],
  ['super', '고유 정예와 금고', 'yskua0', `구역마다 이름 붙은 <b>고유 정예</b>가 부하와 함께 있다. 처치하면 금고 열쇠를 얻는다. 금빛 금고 문 뒤의 보물함을 [F]로 연다.`],
  ['spot', '필드 사건', 'tlp2a0', `<b>보급 캐시</b>: 열면 보급품, 대신 적이 몰려온다.`],
  ['shrine', '신단', 'soula0', `필드 곳곳에 떠 있는 구체 (구역마다 ${SHRINE_PER}개까지). [F]로 쓰면 ${SHRINES.power.t}초 동안 강해진다: ${Object.values(SHRINES).map(S => `<b>${S.name}</b>(${S.desc.replace(/^\d+초 동안 /, '')})`).join(', ')}. 한 번에 하나만 걸린다.`],
  ['trial', '시련의 방', 'icon_case_gold', `구역 ${TRIAL.from}부터 대부분의 구역에 하나씩. 가운데에 봉인된 보물함이 있고, 들어서면 입구가 <b>붉은 막</b>으로 잠긴 채 적 무리가 ${TRIAL.waves}번 몰려온다. 모두 처치하면 막이 걷히고 보물함이 열린다. 쓰러지면 다시 도전할 수 있다.`],
  ['boss', '구역 보스', 'cybra1', `구역마다 기둥이 흩어진 넓은 <b>보스방</b>에 보스가 있다 (구역 3·6은 봉쇄 격벽 길목, 9는 코어). 보스방 문은 닫혀 있어 밖에서는 안이 보이지 않는다. 문으로 걸어 들어가면 열렸다가 들어서면 닫히고, 입구가 <b>붉은 막</b>으로 잠겨 보스를 처치하거나 쓰러져야 열린다. 갇힌 동안 작은 적이 계속 나타나는데, 처치하면 가끔 가장 모자란 탄약을 떨어뜨린다. 보스는 보스방 밖으로 나오지 않는다. 패턴이 다 다르고 체력이 절반 밑이면 <b>격노</b>한다.`],
  ['thief', '보물 약탈자', 'sthfa1', `금빛 제복의 약탈자. 들키면 달아나다 몇 초 뒤 차원 틈으로 사라진다. 맞을 때마다 골드를 흘리고, 잡으면 보물이 쏟아진다.`],
  ['log', '데이터 기록과 업적', 'pmapa0', `구역마다 휴대 단말기 둘. 주우면 승무원의 기록이 재생된다. <b>업적</b>은 모든 저장에서 함께 쌓인다. 둘 다 [J] 수집 도감에 모인다.`],
];
let helpTab = 'keys', guideSel = 'hub';
const guideDet = sel => { const G = GUIDE.find(g => g[0] === sel) || GUIDE[0]; return `<div class="gh">${G[2] ? img(G[2], 128) : ''}<div><div class="h1" style="font-size:32px">${G[1]}</div></div></div><p>${G[3]}</p>`; };
function helpScreen(back, tab = helpTab, sel = guideSel) {
  helpTab = tab; guideSel = sel;
  const body = tab === 'keys' ? keysHTML() : `<div class="guide" style="height:min(500px,58vh)">
      <div class="glist">${GUIDE.map(([id, t, ic]) => `<button class="gi ${id === sel ? 'on' : ''}" data-nav data-g="${id}">${ic ? img(ic, 56) : '<span style="width:28px"></span>'}${t}</button>`).join('')}</div>
      <div class="gdet">${guideDet(sel)}</div></div>`;
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm" style="width:min(1080px,94vw)">
      <div class="hd"><div class="grow"><div class="h1">${tab === 'keys' ? '조작법' : '정거장 생존 지침'}</div></div>
        <div class="tabs"><button class="tab ${tab === 'keys' ? 'on' : ''}" data-nav data-tab="keys">조작</button><button class="tab ${tab === 'guide' ? 'on' : ''}" data-nav data-tab="guide">가이드</button></div></div>
      <div class="bd">${body}</div>
      <div class="ft"><span class="note"></span><button class="btn" data-nav id="hBack">뒤로</button></div>
    </div></div>`, { cls: 'dim', back, focus: tab === 'guide' ? `[data-g="${sel}"]` : `[data-tab="${tab}"]` });
  onAll('[data-tab]', b => { if (b.dataset.tab !== tab) helpScreen(back, b.dataset.tab, sel); }, 'uiMove');
  for (const b of overlay.querySelectorAll('[data-g]')) b.onpick = () => { // 고른 항목의 설명 (마우스·키보드)
    if (b.dataset.g === guideSel) return;
    guideSel = b.dataset.g; overlay.querySelector('.gdet').innerHTML = guideDet(guideSel);
    for (const o of overlay.querySelectorAll('[data-g]')) o.classList.toggle('on', o === b);
  };
  on('hBack', back, 'uiBack');
}

// ===== 제작진 (천천히 올라가는 목록) =====
function creditsScreen(back) {
  const songs = Object.entries(MUSIC_INFO).map(([, [t, by]]) => `<p>${escHtml(t)}<small>${escHtml(by)}</small></p>`).join('');
  screen(`<div class="fx-vig"></div><div class="roll"><div class="roll-in">
      ${logoHTML()}
      <h3><span class="eye">그래픽, 소리, 음악</span></h3><p>Freedoom 프로젝트<small>스프라이트, 텍스처, 효과음, 배경음악 (BSD 라이선스)<br>기여자 전체 목록: assets/CREDITS-freedoom.txt</small></p>
      <h3><span class="eye">무기, 방어구 아이콘</span></h3><p>knekko: Futuristic Guns, Weapons and Items<small>CC0 (퍼블릭 도메인)</small></p>
      <h3><span class="eye">강화칩, 강화장신구 아이콘</span></h3><p>knekko: Cybericons, Microchips<small>CC0 (퍼블릭 도메인)</small></p>
      <h3><span class="eye">헬멧, 조끼, 전투화, 소모품 아이콘</span></h3><p>Project Cordon Sprites<small>doficia와 기여자들, CC0</small></p>
      <h3><span class="eye">핏자국</span></h3><p>AlejandroHaibi: Liquid Splatter Pixel Texture<small>CC0</small></p>
      <h3><span class="eye">음악</span></h3>${songs}
      <h3><span class="eye">글꼴</span></h3><p>Neo둥근모 (정은빈, 원작 둥근모꼴 김중태)<small>SIL Open Font License 1.1</small></p><p>Impact<small>로고, 시스템 글꼴</small></p>
      <h3 style="margin-top:90px"><span class="eye">감사합니다</span></h3><p>끝까지 함께해 주셔서 고맙습니다</p>
    </div></div>
    <div class="row-btns" style="position:absolute;right:40px;bottom:26px;margin:0"><button class="btn" data-nav id="cBack">닫기</button></div>`, { cls: 'solid', back, hints: false });
  on('cBack', back, 'uiBack');
}

// ===== 일시정지 =====
function pauseGame(from) {
  state = 'pause'; mouse.down = false; closeInventory();
  const p = player, box = !inBase && objectiveBox(), xpF = p.xp / xpNeed(p.clv);
  const where = `${actOf(level).name} · 구역 ${level} ${regName(level)}`;
  const items = [['res', '계속하기'], ['set', '설정'], ['man', '조작법과 가이드'], ['dbg', '디버그'], ['title', '메인 메뉴로']];
  screen(`<div class="pz-wrap"><div class="pz"><div class="h1">일시정지</div>
      <nav class="mm">${items.map(([id, t], n) => `<button class="mi" data-nav id="p_${id}" style="--i:${n}"><span class="t">${t}</span></button>`).join('')}</nav></div>
    <aside class="pz-side frm" style="padding:22px 24px">
      <div class="eye cy">작전 현황</div><div class="h1" style="font-size:32px">${where}</div>
      ${box ? `<div class="obj"><small class="eye">목표</small>${escHtml(box.t)}</div>` : ''}
      <div class="stat-grid">
        <div><small>캐릭터 레벨</small><b>Lv ${p.clv}</b><div class="meter cy"><i style="--v:${clamp(xpF, 0, 1)}"></i></div></div>
        <div><small>난이도</small><b>${DIFFICULTY[difficulty].name}</b></div>
        <div><small>플레이 시간</small><b>${fmtPlay(playtime)}</b></div>
        <div><small>처치</small><b>${kills.toLocaleString()}</b></div>
        <div><small>골드</small><b style="color:var(--gold)">${p.gold.toLocaleString()}</b></div>
        <div><small>무기 슬롯</small><b>${slotsOpen()} / ${WEAPON_SLOTS.max}</b></div>
      </div>
      <div class="muted" style="font-size:16px;margin-top:10px;letter-spacing:.15em">v${VERSION}</div>
    </aside></div>`, { cls: 'dim', back: resumeGame, focus: from || 0 });
  on('p_res', resumeGame);
  on('p_set', () => settingsScreen(() => pauseGame('#p_set')));
  on('p_man', () => helpScreen(() => pauseGame('#p_man')));
  on('p_dbg', () => debugScreen(() => pauseGame('#p_dbg'))); // debug.js
  on('p_title', () => confirmBox({ title: '메인 메뉴로 나갈까요?', text: '마지막으로 저장한 뒤의 진행은 사라집니다.', ok: '나가기', danger: true, onOk: toTitle }));
}
function resumeGame() { hideOverlay(); state = 'play'; mouse.down = false; }

// ===== 작전 실패 (자폭에 휘말림 등) =====
function gameOverScreen(reason) {
  const last = latestSlot(), p = player;
  screen(`<div class="fx-scan"></div><div class="center" style="position:absolute;inset:0;flex-direction:column;text-align:center">
      <div class="eye" style="color:var(--bad)">신호 끊김</div><div class="big-t">작전 실패</div>
      <div class="lead">${escHtml(reason)}</div>
      <div class="stats"><div><small>도달 구역</small><b>${level}</b></div><div><small>레벨</small><b>${p.clv}</b></div><div><small>처치</small><b>${kills.toLocaleString()}</b></div><div><small>플레이 시간</small><b>${fmtPlay(playtime)}</b></div></div>
      <div class="row-btns">${last !== -1 ? `<button class="btn pri" data-nav id="gLast">마지막 저장 불러오기 <span class="k">${slotName(last)}</span></button>` : ''}<button class="btn" data-nav id="gLoad">불러오기</button><button class="btn" data-nav id="gTitle">메인 메뉴</button></div>
    </div>`, { cls: 'fail', back: null });
  if (last !== -1) on('gLast', () => fadeThen(() => loadGame(last)));
  on('gLoad', () => loadScreen(() => gameOverScreen(reason)));
  on('gTitle', toTitle);
}

// ===== 엔딩: 작전 기록 + 제작진 =====
function endingScreen() {
  if (state !== 'ending') return;
  const p = player;
  screen(`<div class="center" style="position:absolute;inset:0;flex-direction:column;text-align:center">
      <div class="eye">탈출 성공</div><div class="big-t">작전 완료</div>
      <div class="lead">탈출정이 케르베로스-7을 벗어나는 순간, 기지는 하얀 섬광 속에 사라졌다. 뇌를 잃은 군체도 함께 불타 없어졌다.<br>${rescued ? `구출한 승무원 <b>${rescued}명</b>과 함께 지구로 돌아간다.` : '기지의 마지막 생존자가 홀로 지구로 돌아간다.'}</div>
      <div class="stats"><div><small>난이도</small><b>${DIFFICULTY[difficulty].name}</b></div><div><small>레벨</small><b>${p.clv}</b></div><div><small>플레이 시간</small><b>${fmtPlay(playtime)}</b></div><div><small>처치</small><b>${kills.toLocaleString()}</b></div><div><small>구출</small><b>${rescued}</b></div><div><small>골드</small><b>${p.gold.toLocaleString()}</b></div></div>
      <div class="row-btns"><button class="btn pri" data-nav id="eCred">제작진</button><button class="btn" data-nav id="eTitle">메인 메뉴</button></div>
    </div>`, { cls: 'win', back: null });
  on('eCred', () => creditsScreen(endingScreen));
  on('eTitle', toTitle);
}

// ===== 순간이동 패드: 찾아 둔 거점 =====
function teleportScreen(cur) {
  state = 'menu'; mouse.down = false; closeInventory();
  const found = hubs.filter(h => h.found).length;
  const rows = hubs.map(h => h.found
    ? `<button class="wr ${h === cur ? 'here' : ''}" data-nav data-hub="${h.n}" ${h === cur ? 'disabled' : ''}><span class="rn">${h.reg}</span><span><div class="w1">${escHtml(h.name)}</div><div class="w2">구역 ${h.reg} ${regName(h.reg)}</div></span><span class="go">${h === cur ? '현재 위치' : '이동 →'}</span></button>`
    : `<div class="wr lock"><span class="rn">${h.reg}</span><span><div class="w1">미발견 거점</div><div class="w2">구역 ${h.reg} ${regName(h.reg)}</div></span><span class="go">잠김</span></div>`).join('');
  screen(`<div class="center" style="position:absolute;inset:0"><div class="frm" style="width:min(560px,94vw)">
      <div class="hd"><div class="grow"><div class="eye cy">순간이동 패드</div><div class="h1">${escHtml(cur.name)}</div></div><div class="muted num" style="font-size:16px">찾은 거점 ${found} / ${hubs.length}</div></div>
      <div class="bd"><div class="sect">보급 거점</div><div class="wlist">${rows}</div></div>
      <div class="ft"><span class="note"></span><button class="btn" data-nav id="tClose">닫기</button></div>
    </div></div>`, { cls: 'dim', back: closeMenu, focus: '[data-hub]:not(:disabled), #tClose' });
  onAll('[data-hub]', b => teleportTo(hubs[+b.dataset.hub]));
  on('tClose', closeMenu, 'uiBack');
}

// ===== 시작 =====
titleBackground();
splashScreen();
requestAnimationFrame(frame);
