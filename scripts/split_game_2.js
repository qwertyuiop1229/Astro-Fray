const fs = require('fs');
const path = require('path');
const GAME_JS = path.join(__dirname, '..', 'public', 'js', 'game.js');
const JS_DIR = path.join(__dirname, '..', 'public', 'js');

let lines = fs.readFileSync(GAME_JS, 'utf8').split('\n');

const markerRegex = /^\/\* =+ (.*?) =+ \*\/\s*$/;
const sections = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(markerRegex);
  if (m) sections.push({ line: i, title: m[1].trim() });
}

// Extraction Plan Batch 2
const extractionPlan = [
  {
    startTitle: 'キー設定',
    endTitle: 'オーディオ',
    file: 'core/keybindings.js',
    description: 'キーバインド管理'
  },
  {
    startTitle: 'オーディオ',
    endTitle: '初期化コントロール',
    file: 'core/audio.js',
    description: 'オーディオマネージャー'
  },
  {
    startTitle: '初期化コントロール',
    endTitle: '基本ユーティリティ', // 画面トランジションは既に抜かれているため、次に出現するのは基本ユーティリティ
    file: 'core/init_controls.js',
    description: '入力コントロール基盤'
  },
  {
    startTitle: '基本ユーティリティ',
    endTitle: 'チーム・ファクション判定',
    file: 'core/utils.js',
    description: '数学・共通関数群'
  },
  {
    startTitle: 'UI Layout Manager',
    endTitle: 'ゲーム状態',
    file: 'ui/layout_manager.js',
    description: 'UI操作レイアウトマネージャー'
  },
  {
    startTitle: 'デベロッパーモード',
    endTitle: 'スタート画面',
    file: 'ui/devmode.js',
    description: '開発・テストプレイ用ツール'
  },
  {
    startTitle: 'スタート画面',
    endTitle: 'UI Layout Editor Logic', // Layout editor is already extracted, but placeholder exists! Wait, no, placeholder is /* [MOVED] UI レイアウトエディター -> ui/layout_editor.js */
    // Instead of relying on end title, let's just make it a fixed length extraction or search for the placeholder.
    file: 'ui/start_screen.js',
    description: 'スタート画面・ロビーUI',
    matchEndPlaceholder: 'UI レイアウトエディター -> ui/layout_editor.js'
  }
];

function findSection(titlePart) {
  return sections.find(s => s.title.includes(titlePart));
}

function findPlaceholderLine(placeholderText) {
   for (let i=0; i<lines.length; i++) {
      if (lines[i].includes(placeholderText)) return i;
   }
   return -1;
}

const extractions = [];
for (const plan of extractionPlan) {
  const startSec = findSection(plan.startTitle);
  if (!startSec) { console.log(`SKIP: start ${plan.startTitle}`); continue; }

  let endLine = lines.length;
  if (plan.endTitle) {
    const endSec = findSection(plan.endTitle);
    if (endSec) {
      endLine = endSec.line;
    } else {
       console.log(`SKIP: end ${plan.endTitle}`); continue;
    }
  } else if (plan.matchEndPlaceholder) {
     const pLine = findPlaceholderLine(plan.matchEndPlaceholder);
     if (pLine !== -1) endLine = pLine;
     else { console.log(`SKIP: placeholder ${plan.matchEndPlaceholder}`); continue; }
  }

  extractions.push({
    startLine: startSec.line,
    endLine: endLine,
    file: plan.file,
    description: plan.description,
    content: lines.slice(startSec.line, endLine).join('\n')
  });
}

extractions.sort((a, b) => b.startLine - a.startLine);

for (const ext of extractions) {
  const outPath = path.join(JS_DIR, ext.file);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const header = `/* ===== ${ext.description} ===== */\n/* Extracted from game.js */\n\n`;
  fs.writeFileSync(outPath, header + ext.content, 'utf8');
  console.log(`Written: ${ext.file} (${ext.content.split('\n').length} lines)`);

  const placeholder = `/* [MOVED] ${ext.description} -> ${ext.file} */`;
  lines.splice(ext.startLine, ext.endLine - ext.startLine, placeholder);
}

fs.writeFileSync(GAME_JS, lines.join('\n'), 'utf8');
console.log(`Updated game.js: ${lines.length} lines`);
