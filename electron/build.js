// 데스크톱 판 만들기: npm run dist → dist/Void Station-win32-x64/ (실행 파일) + dist/VoidStation-<버전>-win64.zip
// 게임 파일(index.html, *.js, assets/)과 electron/main.js만 넣음. 버전은 data.js의 VERSION
const { packager } = require('@electron/packager');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))[1];
const KEEP = /^\/(index\.html|(data|game|parts|menu|debug)\.js|package\.json|electron(\/main\.js)?|assets(\/.*)?)$/; // 앱에 넣을 것

(async () => {
  const [dir] = await packager({
    dir: ROOT, out: path.join(ROOT, 'dist'), overwrite: true, platform: 'win32', arch: 'x64',
    name: 'Void Station', executableName: 'VoidStation', appVersion: VERSION, buildVersion: VERSION, asar: true,
    ignore: p => p !== '' && !KEEP.test(p),
    win32metadata: { ProductName: 'Void Station', FileDescription: 'Void Station', CompanyName: 'bgjoe40' },
  });
  const zip = path.join(ROOT, 'dist', `VoidStation-${VERSION}-win64.zip`);
  fs.rmSync(zip, { force: true });
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'); // Windows 10 이상의 tar (Git Bash의 GNU tar는 C: 를 원격 주소로 읽음)
  execFileSync(tar, ['-a', '-c', '-f', zip, '-C', path.dirname(dir), path.basename(dir)]);
  console.log(`${dir}\n${zip}`);
})().catch(e => { console.error(e); process.exit(1); });
