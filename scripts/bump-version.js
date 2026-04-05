const fs = require('fs');
const p = require('path');
const { execSync } = require('child_process');

const filePath = p.join(__dirname, '..', 'public', 'js', 'game.js');
let js = fs.readFileSync(filePath, 'utf-8');

let isProd = false;
try {
    const activeProject = execSync('firebase use').toString().toLowerCase();
    isProd = activeProject.includes('astro-fray') || activeProject.includes('production');
} catch (e) {
    // defaults to false
}

const match = js.match(/const GAME_VERSION = (['"])(\d+)\.(\d+)\.(\d+)\1/);
if (match) {
    const q = match[1];
    const major = parseInt(match[2]);
    let minor = parseInt(match[3]);
    let patch = parseInt(match[4]);
    
    if (isProd) {
        minor += 1;
        patch = 0; // 本番環境ではマイナーバージョンを上げ、パッチを0にリセット
    } else {
        patch += 1; // テスト環境ではパッチバージョンを上げる
    }
    
    const newVersion = `${major}.${minor}.${patch}`;
    js = js.replace(new RegExp(`const GAME_VERSION = ${q}\\d+\\.\\d+\\.\\d+${q}`), `const GAME_VERSION = ${q}${newVersion}${q}`);
    fs.writeFileSync(filePath, js, 'utf-8');
    console.log(`${isProd ? '🚀 [PROD]' : '🧪 [TEST]'} Version bumped to ${newVersion}`);
} else {
    console.log('GAME_VERSION not found, skipping.');
}
