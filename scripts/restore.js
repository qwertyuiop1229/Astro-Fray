const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const gameJsPath = path.join(publicDir, 'js/game.js');
const gameJsBackupPath = path.join(publicDir, 'js/game.js.bak');
const indexHtmlPath = path.join(publicDir, 'index.html');
const indexHtmlBackupPath = path.join(publicDir, 'index.html.bak');

// バックアップが存在する場合のみ復元
if (fs.existsSync(gameJsBackupPath)) {
    console.log("♻️ [BUILD] バックアップから元の game.js を復元しています...");
    fs.copyFileSync(gameJsBackupPath, gameJsPath);
    fs.unlinkSync(gameJsBackupPath);
    console.log("✅ [BUILD] 元の game.js の復元が完了しました。");
}

if (fs.existsSync(indexHtmlBackupPath)) {
    console.log("♻️ [BUILD] バックアップから元の index.html を復元しています...");
    fs.copyFileSync(indexHtmlBackupPath, indexHtmlPath);
    fs.unlinkSync(indexHtmlBackupPath);
    console.log("✅ [BUILD] 元の index.html の復元が完了しました。");
}
