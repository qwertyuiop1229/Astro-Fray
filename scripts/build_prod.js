const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JS_DIR = path.join(__dirname, '..', 'public', 'js');
const BUNDLE_OUT = path.join(JS_DIR, 'game.bundle.js');
const OBFUSCATED_OUT = path.join(JS_DIR, 'game.obfuscated.js');

// index.html の読込順に完全一致させる必要がある27個のファイル
const modules = [
    'core/keybindings.js',
    'core/audio.js',
    'core/init_controls.js',
    'ui/transition.js',
    'core/utils.js',
    'core/faction.js',
    'core/settings.js',
    'ui/layout_manager.js',
    'core/state.js',
    'core/touch.js',
    'network/photon.js',
    'entities/bullet_effect.js',
    'core/update_routine.js',
    'core/update.js',
    'core/render.js',
    'core/helpers.js',
    'core/loop.js',
    'ui/main_ui.js',
    'ui/devmode.js',
    'ui/layout_editor.js',
    'ui/alert.js',
    'ui/auth.js',
];

console.log("=== Build Production Started ===");
console.log(`Bundling ${modules.length} modules...`);

let bundleContent = "/* Astro-Fray Production Bundle */\n\n";

for (const mod of modules) {
    const filePath = path.join(JS_DIR, mod);
    if (fs.existsSync(filePath)) {
        bundleContent += `\n/* --- MODULE: ${mod} --- */\n`;
        bundleContent += fs.readFileSync(filePath, 'utf8') + "\n";
    } else {
        console.error(`ERROR: Module not found: ${filePath}`);
        process.exit(1);
    }
}

// game.js 本体（残っているごく僅かな起動スクリプトなど）を追加
const gameJsPath = path.join(JS_DIR, 'game.js');
if (fs.existsSync(gameJsPath)) {
    bundleContent += `\n/* --- MODULE: game.js --- */\n`;
    bundleContent += fs.readFileSync(gameJsPath, 'utf8') + "\n";
}

fs.writeFileSync(BUNDLE_OUT, bundleContent, 'utf8');
console.log(`Successfully bundled to game.bundle.js (${bundleContent.split('\n').length} lines)`);

// Obfuscate
console.log("Obfuscating bundle for production (anti-cheat)...");
try {
    execSync(`npx javascript-obfuscator "${BUNDLE_OUT}" --output "${OBFUSCATED_OUT}" --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding base64`, { stdio: 'inherit' });
    console.log("SUCCESS! Obfuscated file generated: game.obfuscated.js");
} catch (e) {
    console.error("Obfuscation failed!", e.message);
    process.exit(1);
}

// 不要になった中間バンドルの削除（オプション）
// fs.unlinkSync(BUNDLE_OUT);
console.log("=== Build Complete ===");
console.log("If deploying to Firebase, temporary edit index.html to read <script src=\"js/game.obfuscated.js\"></script> instead of the 27 scripts.");
