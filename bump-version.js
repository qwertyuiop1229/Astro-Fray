const fs = require('fs');
const p = require('path');
const filePath = p.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(filePath, 'utf-8');

const match = html.match(/const GAME_VERSION = (['"])(\d+)\.(\d+)\.(\d+)\1/);
if (match) {
    const q = match[1];
    const major = parseInt(match[2]);
    const minor = parseInt(match[3]);
    const patch = parseInt(match[4]) + 1;
    const newVersion = `${major}.${minor}.${patch}`;
    html = html.replace(new RegExp(`const GAME_VERSION = ${q}\\d+\\.\\d+\\.\\d+${q}`), `const GAME_VERSION = ${q}${newVersion}${q}`);
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`Version bumped to ${newVersion}`);
} else {
    console.log('GAME_VERSION not found, skipping.');
}
