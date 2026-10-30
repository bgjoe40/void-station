// ===== 해킹 미니 게임 (구역 임무 '해킹' — MISSIONS.hack, HACK_GAMES, HACK_WORDS: data.js) =====
// 단말기에서 [F]: 보안 단계(미니 게임)를 차례로 풀면 해킹 완료. 단계마다 전선 연결·암호 찾기·순서 기억·회로 연결 중 무작위 (한 해킹 안에서는 겹치지 않게)
// 창은 실시간 (게임은 계속 흐름): 해킹을 시작할 때와 마지막 단계에서 적 무리, 틀리면 보안 경보로 적 무리 (경보는 MISSIONS.hack.gap초에 한 번까지)
// Esc를 누르거나 단말기에서 HACK_RANGE칸 넘게 멀어지면 창이 닫히고, 다시 [F]로 그 단계부터 이어서 함
let hackOpen = false, hackFlash = 0; // 창이 열렸는지, 틀렸을 때 붉게 번쩍이는 남은 시간
const HACK_RANGE = 2.5;
const hackTier = reg => reg >= 8 ? 2 : reg >= 5 ? 1 : 0; // 난이도: 구역 4까지 0, 7까지 1, 8부터 2
const hackShuffle = a => { a = a.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };

// 단말기에서 [F] (useTerminal): 처음이면 해킹 시작 (보안 시스템이 알아채고 적 무리), 창 열기
function startHack(t) {
  const M = t.m;
  if (!M || M.done) return;
  closeInventory(); perkOpen = false; codexOpen = false;
  if (!M.on) { M.on = true; hackM = M; Snd.play('hack', t.i + 0.5, t.j + 0.5); hackWave(false); }
  if (!M.game) M.game = newHackGame(M);
  hackOpen = true;
}
function closeHack() { const G = hackM && hackM.game; if (G) G.drag = G.sel = -1; hackOpen = false; }
function newHackGame(M) {
  let pool = Object.keys(HACK_GAMES).filter(k => !M.used.includes(k));
  if (!pool.length) { M.used = []; pool = Object.keys(HACK_GAMES); }
  const type = pick(pool); M.used.push(type);
  return HACK_MAKE[type](hackTier(M.reg));
}
// 매 프레임 (updateMission): 멀어지면 창 닫기, 미니 게임의 시간 (순서 기억 재생, 불꽃)
function updateHack(dt) {
  hackFlash = Math.max(0, hackFlash - dt);
  const M = hackM;
  if (!M || !M.on || M.done) return;
  if (hackOpen && Math.hypot(player.x - M.term.i - 0.5, player.y - M.term.j - 0.5) > HACK_RANGE) closeHack();
  if (hackOpen && M.game && M.game.tick) M.game.tick(M.game, dt);
}
// 한 단계를 풀었을 때: 다음 단계 (마지막 단계에는 정예가 낀 적 무리), 다 풀면 해킹 완료 (보상, 구역 8은 코어 격벽)
function hackSolved() {
  const M = hackM, t = M.term;
  M.stage++; M.game = null;
  if (M.stage >= M.stages) {
    M.done = true; hackM = null; hackOpen = false; Snd.play('hackDone', t.i + 0.5, t.j + 0.5);
    msg(`${t.name} 해킹 완료`, MISSIONS.hack.color);
    missionReward(t.fi + 0.5, t.fj + 0.5, M.reg); missionDone(M);
    return;
  }
  Snd.play('unlock'); M.game = newHackGame(M);
  if (M.stage === M.stages - 1) hackWave(true);
}
// 틀렸을 때: 붉게 번쩍, 보안 경보 (적 무리 — MISSIONS.hack.gap초에 한 번까지)
function hackMistake() {
  const M = hackM;
  hackFlash = 0.45; Snd.play('deny');
  if (gtime - M.alarmT < MISSIONS.hack.gap) return;
  M.alarmT = gtime; hackWave(false);
}
// 적 무리: 단말기에서 걸어서 9~20칸 떨어진 곳에서 나타나 곧장 달려옴 (last: 크게, 정예 하나)
function hackWave(last) { const M = hackM; spawnWave(M.term.fi, M.term.fj, M.reg, MISSIONS.hack.wave * (last ? 1.6 : 1), last); }

// --- 창: 화면 왼쪽 위 (가운데의 플레이어와 다가오는 적이 보이게), 위는 제목·보안 단계, 아래 줄은 미니 게임의 상태 ---
function hackGeom() { return { x: 12, y: 12, w: 480, h: 344 }; }
const hackArea = g => [g.x + 12, g.y + 40, g.w - 24, g.h - 40 - 34]; // 미니 게임 칸
const hackHit = (mx, my) => { const g = hackGeom(); return mx >= g.x && mx < g.x + g.w && my >= g.y && my < g.y + g.h; };
function hackMouseDown(button) { // 창 위를 클릭했으면 true (창 밖은 그대로 공격)
  if (!hackHit(mouse.x, mouse.y)) return false;
  const g = hackGeom(), G = hackM && hackM.game;
  if (inRect(closeBtn(g.x, g.y, g.w))) { if (button === 0) { closeHack(); Snd.play('menu'); } return true; }
  if (button === 0 && G) G.down(G, mouse.x, mouse.y, hackArea(g));
  return true;
}
function hackMouseUp() { const G = hackM && hackM.game; if (G && G.up) G.up(G, mouse.x, mouse.y, hackArea(hackGeom())); }
const hackPips = (g, n, on, col = HC.acc) => { for (let k = 0; k < n; k++) { ctx.fillStyle = k < on ? col : '#26282e'; ctx.fillRect(g.x + 14 + k * 12, g.y + g.h - 22, 8, 8); } };
function drawHack() {
  const M = hackM, G = M && M.game;
  if (!G) { hackOpen = false; return; }
  const g = hackGeom(), r = hackArea(g), cb = closeBtn(g.x, g.y, g.w);
  winCard(g.x, g.y, g.w, g.h); winHeader(g.x, g.y, g.w, `해킹 · ${HACK_GAMES[G.type].name}`, '', inRect(cb));
  for (let s = 0; s < M.stages; s++) { ctx.fillStyle = s < M.stage ? HC.acc : s === M.stage ? '#7a5a2e' : '#26282e'; ctx.fillRect(cb[0] - 14 - (M.stages - s) * 12, g.y + 13, 8, 8); } // 보안 단계 (푼 것은 호박색)
  G.draw(G, r, g);
  if (hackFlash > 0) { ctx.fillStyle = `rgba(255,60,60,${(hackFlash * 0.5).toFixed(3)})`; ctx.fillRect(r[0], r[1], r[2], r[3]); }
}

// --- 전선 연결: 왼쪽 전선 끝을 같은 색·무늬의 오른쪽 단자로 끌어다 잇기 (눌렀다 떼고 단자를 눌러도 됨). 다른 색이면 불꽃 + 경보 ---
const WIRE_COLS = ['#e04848', '#4a8cf0', '#f0d040', '#48c060', '#d050d0', '#f08a30'];
const WIRE_MARK = [ // 색을 가리기 어려워도 알아보게 무늬 (5x5)
  ['.###.', '#####', '#####', '#####', '.###.'], ['#####', '#...#', '#...#', '#...#', '#####'], ['..#..', '.###.', '.###.', '#####', '#####'],
  ['..#..', '.###.', '#####', '.###.', '..#..'], ['..#..', '..#..', '#####', '..#..', '..#..'], ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']];
function makeWires(tier) {
  const n = HACK_GAMES.wires.n[tier], ids = hackShuffle([0, 1, 2, 3, 4, 5]).slice(0, n);
  return { type: 'wires', n, ids, right: hackShuffle(ids.map((_, k) => k)), links: new Array(n).fill(-1), drag: -1, sel: -1, dx: 0, dy: 0, spark: null,
    draw: drawWires, down: wiresDown, up: wiresUp, tick: (G, dt) => { if (G.spark && (G.spark.t -= dt) <= 0) G.spark = null; } };
}
const wireY = (r, n, k) => Math.round(r[1] + 26 + k * (r[3] - 52) / (n - 1));
const wireL = (r, G, k) => [r[0] + 8, wireY(r, G.n, k) - 12, 40, 24];          // 왼쪽 전선 끝 (k번 전선)
const wireR = (r, G, j) => [r[0] + r[2] - 48, wireY(r, G.n, j) - 12, 40, 24];  // 오른쪽 단자 (j번 자리 — 맞는 전선은 right[j])
function wiresDown(G, mx, my, r) {
  for (let k = 0; k < G.n; k++) if (G.links[k] < 0 && inRect(wireL(r, G, k), mx, my)) { G.drag = k; G.dx = mx; G.dy = my; G.sel = -1; Snd.play('menu'); return; }
  if (G.sel >= 0) for (let j = 0; j < G.n; j++) if (inRect(wireR(r, G, j), mx, my)) { wireTry(G, G.sel, j); return; }
  G.sel = -1;
}
function wiresUp(G, mx, my, r) {
  if (G.drag < 0) return;
  const k = G.drag; G.drag = -1;
  for (let j = 0; j < G.n; j++) if (inRect(wireR(r, G, j), mx, my)) { wireTry(G, k, j); return; }
  if (Math.hypot(mx - G.dx, my - G.dy) < 6) G.sel = k; // 눌렀다 뗌: 고른 채로 두고 단자를 누르면 이음
}
function wireTry(G, k, j) {
  G.sel = -1;
  if (G.links.includes(j)) return; // 이미 이은 단자
  if (G.right[j] !== k) { G.spark = { j, t: 0.4 }; hackMistake(); return; }
  G.links[k] = j; Snd.play('pickup');
  if (G.links.every(v => v >= 0)) hackSolved();
}
function winShape(rows, x, y, col) { const z = Z; Z = WU(); pxShape(rows, x, y, col); Z = z; }
function drawWires(G, r, g) {
  pxWell(r);
  const L = r[0] + 48, R = r[0] + r[2] - 48, w = 6;
  const bar = (x0, y0, x1, y1, col) => { ctx.fillStyle = col; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + (x0 === x1 ? w : 0), Math.abs(y1 - y0) + (y0 === y1 ? w : 0)); };
  G.links.forEach((j, k) => { // 이은 전선: 가로 → 세로 → 가로 (전선마다 세로 자리를 달리)
    if (j < 0) return;
    const y0 = wireY(r, G.n, k) - w / 2, y1 = wireY(r, G.n, j) - w / 2, mx = Math.round(L + 20 + (k + 0.5) * (R - L - 40) / G.n), col = WIRE_COLS[G.ids[k]];
    bar(L, y0, mx, y0, col); bar(mx - w / 2, y0, mx - w / 2, y1, col); bar(mx - w / 2, y1, R, y1, col);
  });
  const cur = G.drag >= 0 ? G.drag : G.sel;
  if (cur >= 0) { ctx.strokeStyle = WIRE_COLS[G.ids[cur]]; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(L, wireY(r, G.n, cur)); ctx.lineTo(clamp(mouse.x, r[0], r[0] + r[2]), clamp(mouse.y, r[1], r[1] + r[3])); ctx.stroke(); ctx.lineWidth = 1; }
  const term = (rect, id, on, sx) => { // 단자: 색 칸 + 무늬, 안쪽으로 짧은 전선 토막
    pxWell(rect, inRect(rect) || on, on ? hexRgb(WIRE_COLS[id]) : null);
    ctx.fillStyle = WIRE_COLS[id]; ctx.fillRect(sx, rect[1] + rect[3] / 2 - w / 2, 10, w);
    winShape(WIRE_MARK[id], rect[0] + rect[2] / 2 - 5, rect[1] + rect[3] / 2 - 5, WIRE_COLS[id]);
  };
  for (let k = 0; k < G.n; k++) { term(wireL(r, G, k), G.ids[k], G.links[k] >= 0 || cur === k, L); term(wireR(r, G, k), G.ids[G.right[k]], G.links.includes(k), R - 10); } // 왼쪽: 전선 끝, 오른쪽: 맞출 단자
  if (G.spark) { const q = wireR(r, G, G.spark.j); for (let n = 0; n < 10; n++) { ctx.fillStyle = Math.random() < 0.5 ? '#fff6c0' : '#ffd040'; ctx.fillRect(q[0] - 6 + Math.random() * (q[2] + 12), q[1] - 6 + Math.random() * (q[3] + 12), 3, 3); } }
  hackPips(g, G.n, G.links.filter(v => v >= 0).length);
}

// --- 암호 찾기: 기계어 화면 속 같은 길이의 낱말 중 암호 고르기. 틀리면 '일치 n/4' (같은 자리의 같은 글자 수), 시도를 다 쓰면 경보 + 새 화면 ---
// 줄마다 주소 뒤 12칸 (기호 한 칸, 한글 두 칸): 낱말 줄은 낱말 + 앞뒤 기호 4개, 빈 줄은 기호 12개 — 칸이 옆 칸·기록을 넘지 않게
const JUNK = '#@!$%&*^~<>[]{};:?=+/|';
const hackJunk = n => Array.from({ length: n }, () => JUNK[Math.floor(Math.random() * JUNK.length)]).join('');
const likeness = (a, b) => [...a].filter((ch, k) => b[k] === ch).length;
function makeWords(tier) {
  const C = HACK_GAMES.words, n = C.n[tier], [A, B] = HACK_WORDS, pass = pick(A) + pick(B), set = new Set([pass]);
  for (let guard = 0; set.size < n && guard < 400; guard++) { // 앞이나 뒤가 같은 낱말을 섞어야 힌트가 쓸모 있음
    const q = Math.random();
    set.add((q < 0.35 ? pass.slice(0, 2) : pick(A)) + (q >= 0.35 && q < 0.7 ? pass.slice(2) : pick(B)));
  }
  const words = hackShuffle([...set]), slots = hackShuffle([...Array(18).keys()]).slice(0, words.length);
  const rows = [...Array(18).keys()].map(k => { const w = slots.indexOf(k), pre = w >= 0 ? irnd(1, 3) : 0; return { addr: (0xF400 + k * 12).toString(16).toUpperCase(), pre: hackJunk(pre), w, post: hackJunk(w >= 0 ? 4 - pre : 12) }; });
  return { type: 'words', tier, words, pass, rows, tries: C.tries, log: [], tried: [], hit: [], draw: drawWords, down: wordsDown };
}
function wordsDown(G, mx, my) {
  const h = G.hit.find(q => inRect(q.r, mx, my));
  if (!h || G.tried.includes(h.w)) return;
  const word = G.words[h.w];
  if (word === G.pass) { hackSolved(); return; }
  G.tries--; G.tried.push(h.w); G.log.push({ word, n: likeness(word, G.pass) }); Snd.play('deny');
  if (G.tries <= 0) { hackM.game = makeWords(G.tier); hackMistake(); } // 잠김: 경보 + 새 화면
}
function drawWords(G, r, g) {
  pxWell(r);
  ctx.textAlign = 'left'; ctx.font = font(FS); G.hit = [];
  const cw = Math.max(...G.rows.map(row => ctx.measureText(`0x${row.addr} ${row.pre}${row.w >= 0 ? G.words[row.w] : ''}${row.post}`).width)) + 14; // 칸 너비: 가장 긴 줄 + 사이
  G.rows.forEach((row, k) => {
    let x = r[0] + 10 + Math.floor(k / 9) * cw;
    const y = r[1] + 20 + (k % 9) * 19;
    ctx.fillStyle = '#3f6d64'; ctx.fillText(`0x${row.addr}`, x, y); x += ctx.measureText('0xF4A0 ').width;
    ctx.fillStyle = '#5a5d66'; ctx.fillText(row.pre, x, y); x += ctx.measureText(row.pre).width;
    if (row.w >= 0) {
      const word = G.words[row.w], tw = ctx.measureText(word).width, rect = [x - 1, y - 12, tw + 2, 16], dead = G.tried.includes(row.w), hot = !dead && inRect(rect);
      if (hot) { ctx.fillStyle = HC.acc; ctx.fillRect(rect[0], rect[1], rect[2], rect[3]); }
      ctx.fillStyle = dead ? '#3a3d44' : hot ? '#0d0e12' : INK; ctx.fillText(word, x, y);
      G.hit.push({ r: rect, w: row.w }); x += tw;
    }
    ctx.fillStyle = '#5a5d66'; ctx.fillText(row.post, x, y);
  });
  const lx = r[0] + 20 + 2 * cw; // 고른 낱말과 일치 수 (두 줄씩)
  ctx.fillStyle = '#26282e'; ctx.fillRect(lx - 10, r[1] + 8, 1, r[3] - 16);
  G.log.slice(-6).forEach((q, n) => {
    const y = r[1] + 20 + n * 40;
    ctx.fillStyle = HC.dim; ctx.fillText(`> ${q.word}`, lx, y);
    ctx.fillStyle = q.n ? HC.acc : '#a5544a'; ctx.fillText(`일치 ${q.n}/4`, lx + ctx.measureText('> ').width, y + 19);
  });
  hackPips(g, HACK_GAMES.words.tries, G.tries);
}

// --- 순서 기억: 켜지는 칸의 순서를 보고 그대로 누르기. 틀리면 경보 + 처음부터 다시 보여 줌. '다시 보기'는 경보 없이 처음부터 다시 (누른 것도 처음부터) ---
const MEM_ON = 0.5, MEM_GAP = 0.22;
function makeMemory(tier) {
  const L = HACK_GAMES.memory.len[tier], seq = [];
  while (seq.length < L) { const k = irnd(0, 8); if (k !== seq[seq.length - 1]) seq.push(k); } // 같은 칸이 잇달지 않게
  return { type: 'memory', seq, pos: 0, show: -0.6, hit: -1, ok: true, hitT: 0, draw: drawMemory, down: memoryDown, tick: memoryTick };
}
function memoryTick(G, dt) {
  if (G.show !== null && (G.show += dt) >= G.seq.length * (MEM_ON + MEM_GAP)) G.show = null; // 다 보여 줬으면 누를 차례
  G.hitT = Math.max(0, G.hitT - dt);
}
const memLit = G => { if (G.show === null || G.show < 0) return -1; const k = Math.floor(G.show / (MEM_ON + MEM_GAP)); return G.show - k * (MEM_ON + MEM_GAP) < MEM_ON ? G.seq[k] : -1; };
const memReplay = g => [g.x + g.w - 14 - 96, g.y + g.h - 30, 96, 24]; // 다시 보기 단추 (창 오른쪽 아래)
const memCell = (r, k) => { const s = Math.floor(Math.min(64, (r[3] - 32) / 3)), x0 = Math.round(r[0] + r[2] / 2 - (3 * s + 16) / 2), y0 = Math.round(r[1] + r[3] / 2 - (3 * s + 16) / 2); return [x0 + (k % 3) * (s + 8), y0 + Math.floor(k / 3) * (s + 8), s, s]; };
function memoryDown(G, mx, my, r) {
  if (G.show !== null) return; // 보여 주는 중
  if (inRect(memReplay(hackGeom()), mx, my)) { G.pos = 0; G.hitT = 0; G.show = -0.3; Snd.play('menu'); return; }
  for (let k = 0; k < 9; k++) if (inRect(memCell(r, k), mx, my)) {
    G.hit = k; G.hitT = 0.3;
    if (k === G.seq[G.pos]) { G.ok = true; G.pos++; Snd.play('menu'); if (G.pos >= G.seq.length) hackSolved(); }
    else { G.ok = false; G.pos = 0; G.show = -0.9; hackMistake(); }
    return;
  }
}
function drawMemory(G, r, g) {
  pxWell(r);
  const lit = memLit(G);
  for (let k = 0; k < 9; k++) {
    const c = memCell(r, k), fb = G.hitT > 0 && G.hit === k;
    pxWell(c, G.show === null && inRect(c), lit === k ? '216,154,58' : fb ? (G.ok ? '110,240,220' : '255,80,80') : null);
    if (lit === k || fb) { ctx.fillStyle = lit === k ? HC.acc : G.ok ? '#6ff0d8' : '#e05050'; ctx.fillRect(c[0] + 8, c[1] + 8, c[2] - 16, c[3] - 16); }
  }
  hackPips(g, G.seq.length, G.pos, G.show === null ? HC.acc : '#4a4d55');
  const b = memReplay(g); pxBtn(b, '다시 보기', inRect(b), G.show === null);
}

// --- 회로 연결: 칸을 눌러 돌려 왼쪽 전원에서 오른쪽 단자까지 회로를 잇기. 많이 돌리면 과부하 (경보) ---
// 칸의 연결은 비트 (위 1, 오른쪽 2, 아래 4, 왼쪽 8), 한 번 누르면 시계 방향으로 90도
const rot4 = (m, k = 1) => { for (; k > 0; k--) m = ((m << 1) | (m >> 3)) & 15; return m; };
function makeCircuit(tier) {
  const s = HACK_GAMES.circuit.size[tier], sr = irnd(0, s - 1), tr = irnd(0, s - 1), seen = new Set(), path = [];
  const dfs = (x, y) => { // 전원 칸에서 단자 칸까지 무작위 길 (깊이 우선)
    seen.add(y * s + x); path.push([x, y]);
    if (x === s - 1 && y === tr) return true;
    for (const [dx, dy] of hackShuffle([[1, 0], [0, 1], [0, -1], [-1, 0]])) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < s && ny < s && !seen.has(ny * s + nx) && dfs(nx, ny)) return true; }
    path.pop(); return false;
  };
  dfs(0, sr);
  const bit = (dx, dy) => dx > 0 ? 2 : dx < 0 ? 8 : dy > 0 ? 4 : 1, sol = new Array(s * s).fill(0);
  path.forEach(([x, y], k) => { const [px, py] = k ? path[k - 1] : [x - 1, y], [nx, ny] = k < path.length - 1 ? path[k + 1] : [x + 1, y]; sol[y * s + x] = bit(px - x, py - y) | bit(nx - x, ny - y); });
  for (let k = 0; k < s * s; k++) if (!sol[k]) sol[k] = rot4(pick([5, 3, 7]), irnd(0, 3)); // 길 밖: 곧은·꺾인·세 갈래 조각
  const G = { type: 'circuit', s, sr, tr, sol, cur: sol.map(m => rot4(m, irnd(0, 3))), moves: 0, draw: drawCircuit, down: circuitDown }; // sol: 만들 때의 답 (길 밖 칸은 아무렇게나)
  const first = sr * s;
  for (let n = 0; n < 3 && circuitPower(G).done; n++) G.cur[first] = rot4(G.cur[first]); // 처음부터 이어져 있지 않게
  const par = path.reduce((t, [x, y]) => { const k = y * s + x; let n = 0; while (n < 4 && rot4(G.cur[k], n) !== sol[k]) n++; return t + n; }, 0); // 길의 칸을 맞추는 최소 회전
  G.limit = par + HACK_GAMES.circuit.slack;
  return G;
}
// 전원 칸 (왼쪽 열 sr행, 왼쪽이 열려 있어야)에서 이어진 칸들, 단자 칸 (오른쪽 열 tr행, 오른쪽이 열려 있어야)까지 닿았는지
function circuitPower(G) {
  const { s, cur } = G, on = new Uint8Array(s * s), start = G.sr * s;
  if (!(cur[start] & 8)) return { on, done: false };
  const q = [start]; on[start] = 1;
  while (q.length) {
    const k = q.pop(), x = k % s, y = Math.floor(k / s);
    for (const [b, dx, dy, back] of [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]]) {
      const nx = x + dx, ny = y + dy, n = ny * s + nx;
      if (!(cur[k] & b) || nx < 0 || ny < 0 || nx >= s || ny >= s || on[n] || !(cur[n] & back)) continue;
      on[n] = 1; q.push(n);
    }
  }
  const end = G.tr * s + s - 1;
  return { on, done: !!on[end] && !!(cur[end] & 2) };
}
const circCell = (r, G, k) => { const c = Math.floor(Math.min(44, (r[3] - 16) / G.s)), x0 = Math.round(r[0] + r[2] / 2 - G.s * c / 2), y0 = Math.round(r[1] + r[3] / 2 - G.s * c / 2); return [x0 + (k % G.s) * c, y0 + Math.floor(k / G.s) * c, c, c]; };
function circuitDown(G, mx, my, r) {
  for (let k = 0; k < G.s * G.s; k++) if (inRect(circCell(r, G, k), mx, my)) {
    G.cur[k] = rot4(G.cur[k]); G.moves++; Snd.play('menu');
    if (circuitPower(G).done) { hackSolved(); return; }
    if (G.moves >= G.limit) { G.moves = 0; hackMistake(); } // 과부하
    return;
  }
}
function drawCircuit(G, r, g) {
  pxWell(r);
  const P = circuitPower(G), w = 6;
  for (let k = 0; k < G.s * G.s; k++) {
    const c = circCell(r, G, k), cx = c[0] + c[2] / 2, cy = c[1] + c[3] / 2, m = G.cur[k];
    pxWell([c[0] + 1, c[1] + 1, c[2] - 2, c[3] - 2], inRect(c));
    ctx.fillStyle = P.on[k] ? '#6ff0d8' : '#5a5d66';
    if (m & 1) ctx.fillRect(cx - w / 2, c[1] + 1, w, c[3] / 2 - 1 + w / 2);
    if (m & 4) ctx.fillRect(cx - w / 2, cy - w / 2, w, c[3] / 2 - 1 + w / 2);
    if (m & 8) ctx.fillRect(c[0] + 1, cy - w / 2, c[2] / 2 - 1 + w / 2, w);
    if (m & 2) ctx.fillRect(cx - w / 2, cy - w / 2, c[2] / 2 - 1 + w / 2, w);
  }
  const a = circCell(r, G, G.sr * G.s), b = circCell(r, G, G.tr * G.s + G.s - 1); // 전원 (호박색), 단자 (닿으면 청록)
  ctx.fillStyle = HC.acc; ctx.fillRect(a[0] - 16, a[1] + a[3] / 2 - 7, 12, 14);
  ctx.fillStyle = P.done ? '#6ff0d8' : '#3a3d44'; ctx.fillRect(b[0] + b[2] + 4, b[1] + b[3] / 2 - 7, 12, 14);
  // 과부하 막대: 돌릴수록 차고, 다 차면 경보
  const f = clamp(G.moves / G.limit, 0, 1), bx = g.x + 14, by = g.y + g.h - 22;
  ctx.fillStyle = '#26282e'; ctx.fillRect(bx, by, 120, 8); ctx.fillStyle = f > 0.75 ? '#e05050' : HC.acc; ctx.fillRect(bx, by, Math.round(120 * f), 8);
}
const HACK_MAKE = { wires: makeWires, words: makeWords, memory: makeMemory, circuit: makeCircuit };
