/**
 * game.js 安全分割スクリプト
 * 
 * game.js のセクションマーカー(/* ========== ... ========== *​/)を使って
 * 各セクションを別ファイルに切り出し、game.js にはプレースホルダーコメントを残す。
 * 
 * すべてのファイルは <script> タグで順番に読み込まれるため、
 * グローバル変数は従来通り共有される（ES Modules は使わない）。
 */
const fs = require('fs');
const path = require('path');

const GAME_JS = path.join(__dirname, '..', 'public', 'js', 'game.js');
const JS_DIR = path.join(__dirname, '..', 'public', 'js');

// game.js を読み込み
const src = fs.readFileSync(GAME_JS, 'utf8');
const lines = src.split('\n');

console.log(`Total lines in game.js: ${lines.length}`);

// セクションマーカーを検出
const markerRegex = /^\/\* =+ (.*?) =+ \*\/\s*$/;
const sections = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(markerRegex);
  if (m) {
    sections.push({ line: i, title: m[1].trim() });
  }
}

console.log(`\nFound ${sections.length} section markers:`);
sections.forEach((s, idx) => {
  const endLine = idx + 1 < sections.length ? sections[idx + 1].line : lines.length;
  const count = endLine - s.line;
  console.log(`  L${s.line + 1}: "${s.title}" (${count} lines)`);
});

// 抽出対象のセクション定義
// { title: マーカー名に含まれる文字列, file: 出力ファイルパス }
const extractionPlan = [
  // core/audio.js: オーディオ〜コントローラーの手前まで
  {
    startTitle: 'オーディオ',
    endTitle: 'コントローラー',  // この直前まで
    file: 'core/audio.js',
    description: 'オーディオシステム (BGM, 効果音, Web Audio API)'
  },
  // core/input.js: コントローラー + タッチコントロール
  {
    startTitle: 'コントローラー',
    endTitle: '画面トランジション',
    file: 'core/input.js',
    description: 'キーボード・マウス・コントローラー入力'
  },
  // ui/transition.js: 画面トランジション
  {
    startTitle: '画面トランジション',
    endTitle: 'ユーティリティ',
    file: 'ui/transition.js',
    description: '画面遷移エフェクト'
  },
  // network/photon.js: Photon
  {
    startTitle: 'Photon',
    endTitle: '弾',
    file: 'network/photon.js',
    description: 'Photon マルチプレイ通信'
  },
  // ui/auth.js: Firebase Auth
  {
    startTitle: 'Firebase Auth',
    endTitle: null, // ファイル末尾まで
    file: 'ui/auth.js',
    description: 'Firebase Auth / Account Linkage'
  },
  // ui/alert.js: カスタム gameAlert / gameConfirm
  {
    startTitle: 'カスタム gameAlert',
    endTitle: 'Firebase Auth',
    file: 'ui/alert.js',
    description: 'カスタムアラート・確認ダイアログ'
  },
  // ui/layout_editor.js: UI Layout Editor Logic
  {
    startTitle: 'UI Layout Editor Logic',
    endTitle: 'カスタム gameAlert',
    file: 'ui/layout_editor.js',
    description: 'UI レイアウトエディター'
  },
  // ui/devmode.js: デベロッパーモード
  {
    startTitle: 'デベロッパーモード',
    endTitle: 'スタート処理',
    file: 'ui/devmode.js',
    description: 'デベロッパーモード (テストプレイ機能)'
  },
];

// セクションのインデックスをタイトルから探す
function findSection(titlePart) {
  return sections.find(s => s.title.includes(titlePart));
}

// 実際の抽出（ドライラン）
console.log('\n--- Extraction Plan ---');
const extractions = [];

for (const plan of extractionPlan) {
  const startSec = findSection(plan.startTitle);
  if (!startSec) {
    console.log(`  SKIP: "${plan.startTitle}" not found`);
    continue;
  }

  let endLine;
  if (plan.endTitle) {
    const endSec = findSection(plan.endTitle);
    if (!endSec) {
      console.log(`  SKIP: end marker "${plan.endTitle}" not found`);
      continue;
    }
    endLine = endSec.line;
  } else {
    endLine = lines.length;
  }

  const count = endLine - startSec.line;
  console.log(`  "${plan.description}": L${startSec.line + 1}-${endLine} (${count} lines) -> ${plan.file}`);
  
  extractions.push({
    startLine: startSec.line,
    endLine: endLine,
    file: plan.file,
    description: plan.description,
    content: lines.slice(startSec.line, endLine).join('\n')
  });
}

// 確認 - startLine の降順でソート（後ろから切り取るため）
extractions.sort((a, b) => b.startLine - a.startLine);

console.log('\n--- Executing ---');

// 各セクションを書き出し、game.js から削除
let currentLines = [...lines];
for (const ext of extractions) {
  // ファイルに書き出し
  const outPath = path.join(JS_DIR, ext.file);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const header = `/* ===== ${ext.description} ===== */\n/* Extracted from game.js for modular organization */\n\n`;
  fs.writeFileSync(outPath, header + ext.content, 'utf8');
  console.log(`  Written: ${ext.file} (${ext.content.split('\n').length} lines)`);

  // game.js からそのセクションを削除し、プレースホルダーに置換
  const placeholder = `/* [MOVED] ${ext.description} -> ${ext.file} */`;
  currentLines.splice(ext.startLine, ext.endLine - ext.startLine, placeholder);
}

// 更新された game.js を書き出し
fs.writeFileSync(GAME_JS, currentLines.join('\n'), 'utf8');
console.log(`\nUpdated game.js: ${currentLines.length} lines (was ${lines.length})`);
console.log('\nDone! Remember to add <script> tags to index.html in the correct order.');
