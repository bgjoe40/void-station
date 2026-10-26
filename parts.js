// ===== 무기 파츠 (ATTACH — data.js) =====
// 무기마다 칸(총: 총구·조준경·탄창·개머리판·하부 / 근접: 날·손잡이·모듈)에 파츠를 하나씩 끼움 — 보급 거점의 개조 자판기 '파츠 개조' 탭에서만.
// 파츠 개체: { kind: 'attach', id, rarity } (가방에서 s.size칸), 무기 개체의 att: { 칸: { id, rarity } }
// 수치는 weaponStats 끝의 applyAttach, 그림은 무기 그림의 붙는 자리(META.anchors)에 파츠 그림(att_*)을 겹친 것 (weaponArt — 조합마다 한 번 그려 둠)

const ATT_NEED = { bullet: b => !b.proj, single: b => !b.proj && !(b.pellets > 1), pellets: b => b.pellets > 1, auto: b => !!b.auto, mag: b => b.mag >= 3 };
const ATT_NEED_TEXT = { bullet: '탄을 쏘는 총 (에너지·로켓 무기 제외)', single: '산탄이 아닌 총 (에너지·로켓 무기 제외)', pellets: '샷건', auto: '자동 화기', mag: '장탄 3발 이상인 총' };
const ATT_ORDER = ['stock', 'mag', 'under', 'muzzle', 'sight', 'grip', 'module', 'edge']; // 그리는 순서 (뒤에 그린 것이 위)
// 무기의 파츠 칸 (보여 주는 순서)
function attachSlots(id) {
  const b = WEAPONS[id];
  if (!b) return [];
  if (b.type === 'melee') return ['edge', 'grip', 'module'];
  return ['muzzle', 'sight', 'mag', 'stock', 'under'].filter(k => !(k === 'muzzle' && b.proj) && !(k === 'stock' && b.cat === 1 && !b.auto));
}
const canAttach = (w, id) => { const A = ATTACH[id], b = w && !w.kind && WEAPONS[w.id]; return !!(A && b) && attachSlots(w.id).includes(A.slot) && (!A.need || ATT_NEED[A.need](b)); };
function makeAttach(id, rarity = 0) {
  return { uid: uidSeq++, kind: 'attach', id, rarity, affixes: [], gx: 0, gy: 0, s: { size: ATTACH[id].size, weight: 0 }, name: ATTACH[id].name };
}
const attachValue = it => ATTACH[it.id].price * ATTACH_MUL[it.rarity];
// 등급: 구역이 깊을수록, bonus(정예·보스)가 클수록 좋게
const attachRarity = (bonus = 0) => +weighted({ 0: Math.max(1, 8 - level * 0.6 - bonus * 2), 1: 3 + level * 0.5 + bonus, 2: 0.4 + level * 0.3 + bonus * 0.8 });
// 무작위 파츠 하나 (w를 주면 그 무기에 맞는 것만)
function randomAttach(bonus = 0, w = null) {
  const ids = Object.keys(ATTACH).filter(k => !w || canAttach(w, k));
  return ids.length ? makeAttach(pick(ids), attachRarity(bonus)) : null;
}
// 떨어진 희귀 이상 무기: 가끔 맞는 파츠 하나를 달고 나옴
function lootAttach(w) {
  if (w.rarity < 2 || Math.random() >= ATTACH_ON_LOOT) return w;
  const a = randomAttach(w.rarity - 2, w);
  if (a) { w.att = { [ATTACH[a.id].slot]: { id: a.id, rarity: a.rarity } }; refreshWeapon(w); w.mag = w.s.mag; }
  return w;
}
// 저장에서 읽은 파츠: 없어진 종류·맞지 않는 칸은 버림
function okAttach(id, att) {
  const out = {};
  for (const [k, a] of Object.entries(att || {})) if (a && ATTACH[a.id] && ATTACH[a.id].slot === k && canAttach({ id }, a.id)) out[k] = { id: a.id, rarity: clamp(a.rarity || 0, 0, 2) };
  return out;
}

// --- 효과 ---
const attV = (v, r) => Array.isArray(v) ? v[r] : v;
const addProc = (s, k, v) => { s.gemProc = s.gemProc || {}; s.gemProc[k] = (s.gemProc[k] || 0) + v; }; // 명중 시 확률 효과 (보석과 같은 자리 — weaponHit)
const ATT_APPLY = {
  dmg: (s, v) => { s.dmg *= 1 + v; }, spread: (s, v) => { s.spread = (s.spread || 0) * (1 - v); }, crit: (s, v) => { s.crit += v; },
  range: (s, v) => { s.range = (s.range || 16) * (1 + v); }, rangeN: (s, v) => { s.range = (s.range || 16) + v; }, speed: (s, v) => { s.speed = (s.speed || 28) * (1 + v); },
  mag: (s, v) => { s.mag = Math.max(s.mag + 1, Math.round(s.mag * (1 + v))); }, reload: (s, v) => { s.reload *= 1 - v; }, rate: (s, v) => { s.rate /= 1 + v; },
  weight: (s, v) => { s.weight += v; }, lighter: (s, v) => { s.weight *= 1 - v; }, shake: (s, v) => { s.shake = (s.shake || 1.5) * (1 - v); },
  elite: (s, v) => { s.eliteDmg = (s.eliteDmg || 0) + v; }, ap: (s, v) => { s.ap = Math.max(s.ap || 0, v); },
  fire: (s, v) => addProc(s, 'fire', v), cryo: (s, v) => addProc(s, 'cryo', v), shock: (s, v) => addProc(s, 'shock', v),
  knock: (s, v) => { s.knock *= 1 + v; }, stun: (s, v) => { s.stun = (s.stun || 0) + v; }, stamina: (s, v) => { s.stamina *= 1 - v; },
  quiet: s => { s.quiet = true; }, thermal: s => { s.thermal = true; },
};
// weaponStats 끝에서: 끼운 파츠의 효과를 모두 더함
function applyAttach(s, w) {
  for (const a of Object.values(w.att || {})) {
    const A = a && ATTACH[a.id];
    if (A) for (const [k, v] of Object.entries(A.fx)) ATT_APPLY[k](s, attV(v, a.rarity));
  }
}
const attFx = (id, r) => Object.entries(ATTACH[id].fx).map(([k, v]) => ATT_FX[k](attV(v, r)));
const withAttach = (w, id, rarity) => weaponStats({ ...w, att: { ...(w.att || {}), [ATTACH[id].slot]: { id, rarity } } }); // 이 파츠를 끼웠을 때의 수치

// --- 비교할 수치: [이름, 값, 소수 자리, 낮을수록 좋음, 단위] ---
const ATT_STATS = {
  gun: [['피해', s => s.dmg * (s.pellets || 1), 0], ['DPS', weaponDps, 0], ['발사 간격', s => s.rate, 2, true, '초'], ['장탄', s => s.mag, 0], ['재장전', s => s.reload, 1, true, '초'],
    ['탄퍼짐', s => s.spread, 3, true], ['사거리', s => s.range || 16, 1], ['치명타', s => s.crit * 100, 0, false, '%'], ['무게', s => s.weight, 1, true]],
  melee: [['피해', s => s.dmg, 0], ['DPS', weaponDps, 0], ['공격 간격', s => s.rate, 2, true, '초'], ['사거리', s => s.range, 2], ['넉백', s => s.knock, 2],
    ['기절', s => s.stun || 0, 2, false, '초'], ['스태미너', s => s.stamina, 1, true], ['치명타', s => s.crit * 100, 0, false, '%'], ['무게', s => s.weight, 1, true]],
};
const statRows = s => ATT_STATS[s.type === 'melee' ? 'melee' : 'gun'];
const fmtStat = (v, d) => (+v.toFixed(d)).toString();
// 두 수치에서 달라진 것: "탄퍼짐 0.06 → 0.04" (좋아지면 good)
function statDiffs(a, b) {
  const out = [];
  for (const [name, f, d, low, unit = ''] of statRows(a)) {
    const x = f(a), y = f(b);
    if (fmtStat(x, d) === fmtStat(y, d)) continue;
    out.push({ t: `${name} ${fmtStat(x, d)}${unit} → ${fmtStat(y, d)}${unit}`, good: low ? y < x : y > x });
  }
  return out;
}

// --- 툴팁 ---
const attW = () => { const w = trade && trade.sel; return w && !w.kind && ownedItems().includes(w) ? w : null; }; // 개조 자판기에서 고른 무기
const attachTarget = () => trade && trade.mode === 'upgrade' && trade.tab === 'attach' ? attW() : null;
// 파츠 한 종류·등급의 설명 줄 (이름, 등급·칸, 설명, 효과, 맞는 무기)
function attachInfo(id, rarity) {
  const A = ATTACH[id], L = [{ t: A.name, c: RARITY[rarity].color, b: true }];
  L.push({ t: `${RARITY[rarity].name} 파츠, ${ATTACH_SLOTS[A.slot]} 칸, ${A.size[0]}x${A.size[1]}칸`, c: '#9a9' });
  for (const t of wrapWords(A.desc, 30)) L.push({ t, c: '#d8c89a' });
  for (const t of attFx(id, rarity)) L.push({ t: '◆ ' + t, c: '#8af' });
  const melee = ['edge', 'grip', 'module'].includes(A.slot);
  L.push({ t: `끼울 수 있는 무기: ${melee ? '근접 무기' : A.need ? ATT_NEED_TEXT[A.need] : '총'}`, c: '#bbb' });
  return L;
}
function attachTooltip(it) {
  const A = ATTACH[it.id], L = attachInfo(it.id, it.rarity);
  const w = attachTarget();
  if (w && canAttach(w, it.id)) {
    const old = w.att && w.att[A.slot];
    L.push({ t: `${w.name}에 끼우면${old ? ` (${ATTACH[old.id].name}과 바꿈)` : ''}:`, c: '#ffd27a', b: true });
    const ds = statDiffs(w.s, withAttach(w, it.id, it.rarity));
    for (const d of ds) L.push({ t: '   ' + d.t, c: d.good ? '#7f7' : '#f77' });
    if (!ds.length) L.push({ t: '   (수치 변화 없음, 특수 효과만)', c: '#aaa' });
    L.push({ t: '우클릭 또는 끌어다 놓기: 끼우기', c: '#9cf' });
  } else if (w) L.push({ t: `${w.name}에는 끼울 수 없음`, c: '#f77' });
  else L.push({ t: '보급 거점의 개조 자판기 → 파츠 개조 탭에서 무기에 끼움', c: '#9cf' });
  return L;
}
// 무기 툴팁의 파츠 줄: 끼운 파츠와 효과, 빈 칸
function attachLines(w, L) {
  const slots = attachSlots(w.id);
  if (!slots.length) return;
  const got = slots.filter(k => w.att && w.att[k]);
  L.push({ t: `파츠 ${got.length}/${slots.length}`, c: '#bbb' });
  for (const k of got) { const a = w.att[k]; L.push({ t: `◆ ${ATTACH_SLOTS[k]}: ${ATTACH[a.id].name} (${attFx(a.id, a.rarity).join(', ')})`, c: RARITY[a.rarity].color }); }
  if (got.length < slots.length) L.push({ t: `◇ 빈 칸: ${slots.filter(k => !got.includes(k)).map(k => ATTACH_SLOTS[k]).join(', ')}`, c: '#777' });
}

// --- 끼우기 · 빼기 (개조 자판기에서만) ---
// 무기 w에 파츠를 끼움: 그 칸에 있던 파츠는 가방으로 (자리가 없으면 못 끼움). 성공하면 true
function installAttach(w, part) {
  if (!canAttach(w, part.id)) { trade.note = `${w.name}에는 ${part.name}을(를) 끼울 수 없습니다`; Snd.play('deny'); return false; }
  const A = ATTACH[part.id], old = w.att && w.att[A.slot], inBag = player.bag.includes(part);
  removeFromBag(part);
  if (old) {
    const o = makeAttach(old.id, old.rarity), spot = bagFindSpot(o);
    if (!spot) { if (inBag) player.bag.push(part); trade.note = '가방에 빈자리가 없어 끼워 둔 파츠를 뺄 수 없습니다'; Snd.play('deny'); return false; }
    o.gx = spot.gx; o.gy = spot.gy; player.bag.push(o);
  }
  w.att = { ...(w.att || {}), [A.slot]: { id: part.id, rarity: part.rarity } };
  refreshWeapon(w);
  if (w.mag > w.s.mag) w.mag = w.s.mag;
  trade.note = `${w.name} ← ${part.name} (${RARITY[part.rarity].name})${old ? `, 빼낸 ${ATTACH[old.id].name}은(는) 가방으로` : ''}`;
  Snd.play('unlock'); tip('attach', 'att_' + part.id);
  return true;
}
function removeAttach(w, slot) {
  const a = w && w.att && w.att[slot];
  if (!a) { trade.note = `빈 ${ATTACH_SLOTS[slot]} 칸`; Snd.play('menu'); return; }
  const o = makeAttach(a.id, a.rarity), spot = bagFindSpot(o);
  if (!spot) { trade.note = '가방에 빈자리가 없습니다'; Snd.play('deny'); return; }
  o.gx = spot.gx; o.gy = spot.gy; player.bag.push(o);
  const att = { ...w.att };
  delete att[slot];
  w.att = att; refreshWeapon(w);
  if (w.mag > w.s.mag) w.mag = w.s.mag;
  trade.note = `${ATTACH[a.id].name}을(를) 빼서 가방에 넣었다`; Snd.play('pickup');
}

// --- 그림: 무기 + 끼운 파츠 ---
const artCache = new Map(); // 무기·파츠 조합 → { c: 캔버스, w, h, bx, by: 캔버스 안 무기 그림의 왼쪽 위 }
function weaponArt(w) {
  const att = w.att || {}, ks = ATT_ORDER.filter(k => att[k] && ATTACH[att[k].id]);
  if (!ks.length || !ART.ready) return null;
  const key = w.id + ':' + ks.map(k => att[k].id).join(',');
  if (artCache.has(key)) return artCache.get(key);
  const base = META.frames['icon_' + w.id], A = (META.anchors || {})[w.id];
  if (!base || !A) return null;
  const pcs = [[base, 0, 0]];
  for (const k of ks) { const f = META.frames['att_' + att[k].id]; if (f && A[k]) pcs.push([f, A[k][0] - f[4], A[k][1] - f[5]]); }
  const x0 = Math.min(...pcs.map(q => q[1])), y0 = Math.min(...pcs.map(q => q[2]));
  const x1 = Math.max(...pcs.map(q => q[1] + q[0][2])), y1 = Math.max(...pcs.map(q => q[2] + q[0][3]));
  const c = document.createElement('canvas');
  c.width = x1 - x0; c.height = y1 - y0;
  const g = c.getContext('2d');
  for (const [f, x, y] of pcs) g.drawImage(ART.atlas, f[0], f[1], f[2], f[3], x - x0, y - y0, f[2], f[3]);
  const out = { c, w: c.width, h: c.height, bx: -x0, by: -y0 };
  artCache.set(key, out);
  return out;
}
// 상자 안에 비율을 지켜 그림 (파츠가 없으면 무기 아이콘 그대로)
function drawWeaponArt(w, x, y, bw, bh) {
  const a = weaponArt(w);
  if (!a) { drawIcon('icon_' + w.id, x, y, bw, bh); return; }
  const k = Math.min(bw / a.w, bh / a.h);
  ctx.imageSmoothingEnabled = k < 1;
  ctx.drawImage(a.c, x + (bw - a.w * k) / 2, y + (bh - a.h * k) / 2, a.w * k, a.h * k);
  ctx.imageSmoothingEnabled = true;
}
// 바닥에 떨어진 무기: 무기 그림의 아래 가운데가 (x, y)에 오게 (drawBottom과 같은 크기)
function drawWeaponBottom(w, x, y, scale) {
  const a = weaponArt(w), f = META.frames['icon_' + w.id];
  if (!a || !f) { drawBottom('icon_' + w.id, x, y, scale); return; }
  ctx.imageSmoothingEnabled = scale < 1;
  ctx.drawImage(a.c, x - (a.bx + f[2] / 2) * scale, y - (a.by + f[3]) * scale, a.w * scale, a.h * scale);
  ctx.imageSmoothingEnabled = true;
}

// --- 개조 자판기 '파츠 개조' 탭: 고른 무기를 크게, 칸 상자, 수치 비교 ---
const attLayout = g => ({ W0: VG_W * CELL, artY: g.gy, artH: 72, slotY: g.gy + 80, slotH: 64, statY: g.gy + 162 });
// 칸 상자 (클릭: 끼운 파츠를 빼서 가방으로) — tradeButtons가 버튼으로 씀
function attSlotBoxes(g) {
  const w = attW(), L = attLayout(g);
  if (!w) return [];
  const ks = attachSlots(w.id), n = ks.length, bw = Math.floor((L.W0 - (n - 1) * 6) / n);
  return ks.map((k, i) => ({ id: 'att:' + k, slot: k, x: g.gx + i * (bw + 6), y: L.slotY, w: bw, h: L.slotH, label: '', on: true, att: true }));
}
// 지금 들고 있거나 커서를 올린 가방의 파츠 (고른 무기에 맞을 때만 — 미리보기)
function attPreviewPart(w) {
  let it = held && held.inst;
  if (!it) { const h = invHit(mouse.x, mouse.y); it = h && h.area === 'grid' ? bagItemAt(h.cx, h.cy) : null; }
  return it && it.kind === 'attach' && canAttach(w, it.id) ? it : null;
}
function drawAttachArea(g) {
  const L = attLayout(g), w = attW(), blink = Math.sin(gtime * 6) > 0;
  pxWell([g.gx, L.artY, L.W0, L.artH], false, w && w.rarity > 0 ? RARITY[w.rarity].glow : null);
  if (!w) return;
  const prev = attPreviewPart(w);
  if (prev) { // 미리보기: 파츠를 끼운 모습을 흐리게 겹침
    const ghost = { ...w, att: { ...(w.att || {}), [ATTACH[prev.id].slot]: { id: prev.id, rarity: prev.rarity } } };
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(gtime * 6); drawWeaponArt(ghost, g.gx + 10, L.artY + 6, L.W0 - 20, L.artH - 10); ctx.globalAlpha = 1;
  } else drawWeaponArt(w, g.gx + 10, L.artY + 6, L.W0 - 20, L.artH - 10);
  ctx.textAlign = 'left'; ctx.font = font(FS, true); ctx.fillStyle = itemColor(w); ctx.fillText(fitText(w.name, L.W0 - 16), g.gx + 8, L.artY + 15);
  // 칸 상자: 끼운 파츠는 그림·이름 (등급 빛), 빈 칸은 그 칸 파츠의 흐린 그림, 들고 있는 파츠가 맞는 칸은 깜박임
  let hover = null;
  for (const b of attSlotBoxes(g)) {
    const a = w.att && w.att[b.slot], r = [b.x, b.y, b.w, b.h], hov = inRect(r), fit = prev && ATTACH[prev.id].slot === b.slot;
    if (hov) hover = b;
    pxWell(r, hov || (fit && blink), a ? RARITY[a.rarity].glow : null);
    ctx.textAlign = 'center'; ctx.font = font(FS); ctx.fillStyle = HC.dim; ctx.fillText(ATTACH_SLOTS[b.slot], b.x + b.w / 2, b.y + 15);
    if (a) {
      drawIcon('att_' + a.id, b.x + 6, b.y + 19, b.w - 12, 16);
      const words = ATTACH[a.id].name.split(' ');
      ctx.font = font(FS, true); ctx.fillStyle = RARITY[a.rarity].color;
      words.slice(0, 2).forEach((t, n) => ctx.fillText(fitText(n ? words.slice(1).join(' ') : t, b.w - 4), b.x + b.w / 2, b.y + b.h - (words.length > 1 ? 18 - n * 12 : 7)));
    } else { ctx.globalAlpha = 0.12; drawIcon('att_' + Object.keys(ATTACH).find(k => ATTACH[k].slot === b.slot), b.x + 8, b.y + 22, b.w - 16, b.h - 30); ctx.globalAlpha = 1; }
  }
  drawAttachStats(g, w, prev, L);
  if (hover && !held) {
    const a = w.att && w.att[hover.slot];
    const T = a ? [...attachInfo(a.id, a.rarity), { t: '클릭: 빼서 가방으로', c: '#9cf', b: true }]
      : [{ t: `빈 ${ATTACH_SLOTS[hover.slot]} 칸`, c: '#ccc', b: true },
        { t: `맞는 파츠: ${Object.keys(ATTACH).filter(k => ATTACH[k].slot === hover.slot && canAttach(w, k)).map(k => ATTACH[k].name).join(', ')}`, c: '#9a9' },
        { t: '가방의 파츠를 끌어다 놓거나 우클릭하면 끼워짐', c: '#9cf' }];
    queueTip(T, mouse.x + 18, mouse.y + 18);
  }
}
// 수치 비교: 파츠 없을 때 → 지금 (미리보기 중이면 지금 → 끼웠을 때), 아래에 특수 효과
function drawAttachStats(g, w, prev, L) {
  const base = weaponStats({ ...w, att: {} }), cur = w.s, to = prev ? withAttach(w, prev.id, prev.rarity) : cur, from = prev ? cur : base, rows = statRows(cur), cw = L.W0 / 2;
  ctx.textAlign = 'left'; ctx.font = font(FS, true); ctx.fillStyle = prev ? HC.acc : HC.dim;
  ctx.fillText(prev ? `${prev.name}을(를) 끼우면` : '파츠 효과 (파츠 없을 때 → 지금)', g.gx, L.statY);
  rows.forEach(([name, f, d, low, unit = ''], n) => {
    const x = g.gx + (n % 2) * cw, y = L.statY + 15 + Math.floor(n / 2) * 14, a = f(from), b = f(to), same = fmtStat(a, d) === fmtStat(b, d);
    ctx.font = font(FS); ctx.fillStyle = HC.dim; ctx.fillText(name, x, y);
    ctx.fillStyle = INK; ctx.fillText(same ? `${fmtStat(b, d)}${unit}` : `${fmtStat(a, d)} → `, x + 58, y);
    if (!same) { const tw = ctx.measureText(`${fmtStat(a, d)} → `).width; ctx.fillStyle = (low ? b < a : b > a) ? '#7f7' : '#f77'; ctx.fillText(`${fmtStat(b, d)}${unit}`, x + 58 + tw, y); }
  });
  const fx = [to.quiet && '소음', to.thermal && '열상', to.ap && `장갑 ${pct(to.ap)} 무시`, ...Object.entries(to.gemProc || {}).map(([k, v]) => `${{ fire: '화상', cryo: '둔화', shock: '기절', poison: '중독' }[k]} ${pct(v)}`)].filter(Boolean);
  if (fx.length) { ctx.font = font(FS); ctx.fillStyle = '#9cf'; ctx.fillText(fitText('◆ ' + fx.join(', '), L.W0), g.gx, L.statY + 15 + Math.ceil(rows.length / 2) * 14); }
}
// 개조 자판기에서 들고 있던 파츠를 놓음: 거래 창 위(고른 무기) 또는 인벤토리의 무기 위면 끼움. 처리했으면 true
function dropAttachAt(part, th, hit) {
  if (!trade || trade.mode !== 'upgrade' || trade.tab !== 'attach') return false;
  const target = th ? attW() : hit && (hit.area === 'grid' ? bagItemAt(hit.cx, hit.cy) : hit.area === 'slot' ? player.equip[hit.c] : null);
  if (!target || target.kind) { if (th) { trade.note = '먼저 무기를 고르세요'; Snd.play('deny'); } return !!th; }
  if (installAttach(target, part)) { held = null; trade.sel = target; }
  return true;
}

// --- 보급 자판기 '파츠' 탭 진열 (거점마다, 진열대와 같이 새로 채움) ---
let attachStock = [];
function rollAttachStock() { // 크게 보이게 2x2칸마다 하나씩 (스킬 쉘 진열과 같이)
  attachStock = Array.from({ length: ATTACH_STOCK }, (_, n) => {
    const a = makeAttach(pick(Object.keys(ATTACH)), Math.random() < 0.1 ? 2 : Math.random() < 0.35 ? 1 : 0);
    a.gx = (n % 5) * 2; a.gy = Math.floor(n / 5) * 2;
    return a;
  });
}
