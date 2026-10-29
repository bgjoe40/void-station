// VOID STATION 데스크톱 판 (Electron): 게임 폴더를 app://game/ 으로 열어 브라우저 판과 똑같이 실행
// file:// 에서는 fetch(효과음·음악)가 막히므로 fetch를 허용한 app:// 주소를 씀. 저장은 이 앱의 localStorage (브라우저 판과 따로)
// --smoke=<파일>: 창을 띄우지 않고 불러온 뒤 점검 결과를 JSON으로 쓰고 끝냄 (빌드 확인용)
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const SMOKE = (process.argv.find(a => a.startsWith('--smoke=')) || '').slice(8);

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); // 데스크톱에서는 첫 입력 전에도 소리

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, useContentSize: true, minWidth: 960, minHeight: 540, show: !SMOKE,
    backgroundColor: '#04070b', title: 'Void Station', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; }); // 바깥 주소는 기본 브라우저로
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => { // F11·Alt+Enter: 전체 화면
    if (input.type === 'keyDown' && (input.key === 'F11' || (input.key === 'Enter' && input.alt))) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL('app://game/index.html');
  return win;
}

// 점검: 스크립트·아틀라스·글꼴·효과음 fetch가 되는지, 콘솔 오류가 없는지
function smoke(win) {
  const errors = [];
  win.webContents.on('console-message', (e) => { if (e.level === 'error') errors.push(e.message); });
  win.webContents.on('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 4000));
    let result;
    try {
      result = await win.webContents.executeJavaScript(`(async () => ({
        game: typeof newGame === 'function', version: typeof VERSION !== 'undefined' ? VERSION : null,
        atlas: typeof ART !== 'undefined' && ART.ready, font: document.fonts.check("16px 'NeoDunggeunmo'"),
        sfx: (await fetch('assets/sfx/dspistol.wav')).ok, music: (await fetch('assets/music/d_e1m1.mid')).ok,
        save: (() => { try { localStorage.setItem('voidstation.smoke', '1'); localStorage.removeItem('voidstation.smoke'); return true; } catch (e) { return false; } })(),
      }))()`);
    } catch (e) { result = { error: String(e) }; }
    try {
      fs.writeFileSync(SMOKE, JSON.stringify({ ...result, errors }, null, 2));
      fs.writeFileSync(SMOKE.replace(/(\.json)?$/, '.png'), (await win.webContents.capturePage()).toPNG()); // 첫 화면
    } catch (e) { console.error(e); }
    app.exit(result.game && result.atlas && result.font && result.sfx && !errors.length ? 0 : 1);
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url).pathname)));
    if (!file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null); // 메뉴 막대와 그 단축키(새로고침·개발자 도구) 없음
  const win = createWindow();
  if (SMOKE) smoke(win);
});
app.on('window-all-closed', () => app.quit());
