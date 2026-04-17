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

// Extraction Plan Batch 3 (Final)
const extractionPlan = [
  { startTitle: 'チーム・ファクション判定', endTitle: '軽量化・個別設定', file: 'core/faction.js' },
  { startTitle: '軽量化・個別設定', endTitle: 'ゲーム状態', file: 'core/settings.js' },
  { startTitle: 'ゲーム状態', endTitle: 'タッチコントロール実装', file: 'core/state.js' },
  { startTitle: 'タッチコントロール実装', endTitle: '横画面推奨メッセージ', file: 'core/touch.js' },
  { startTitle: '横画面推奨メッセージ', file: 'ui/orientation.js', matchEndPlaceholder: 'Photonのグローバル変数' },
  { startTitle: '初期化', endTitle: 'エンティティ生成', file: 'core/init.js' },
  { startTitle: 'エンティティ生成', endTitle: '弾・エフェクト', file: 'entities/spawner.js' },
  { startTitle: '弾・エフェクト', endTitle: '更新ルーチン', file: 'entities/bullet_effect.js' },
  { startTitle: '更新ルーチン', endTitle: '更新', file: 'core/update_routine.js' },
  { startTitle: '更新', endTitle: '描画ルーチン', file: 'core/update.js' },
  { startTitle: '描画ルーチン', endTitle: 'ヘルパー', file: 'core/render.js' },
  { startTitle: 'ヘルパー', endTitle: 'メインループ', file: 'core/helpers.js' },
  { startTitle: 'メインループ', endTitle: 'UI実装', file: 'core/loop.js' },
  { startTitle: 'UI実装', endTitle: 'タブ離脱時の音楽停止', file: 'ui/main_ui.js' },
  { startTitle: 'タブ離脱時の音楽停止', file: 'core/tab_focus.js', matchEndPlaceholder: 'デベロッパーモード' },
  { startTitle: 'スタート画面', file: 'ui/start_screen.js', matchEndPlaceholder: 'UI Layout Editor Logic' }
];

function findSection(titlePart) {
  return sections.find(s => s.title.includes(titlePart));
}

function findPlaceholderLine(placeholderText) {
   for (let i=0; i<lines.length; i++) {
      if (lines[i].includes(`[MOVED]`) && lines[i].includes(placeholderText)) return i;
   }
   return -1;
}

const extractions = [];
const scriptTags = [];

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
    content: lines.slice(startSec.line, endLine).join('\n')
  });
  
  scriptTags.push({
     tag: `<script src="js/${plan.file}"></script>`,
     index: startSec.line
  });
}

extractions.sort((a, b) => b.startLine - a.startLine);

for (const ext of extractions) {
  const outPath = path.join(JS_DIR, ext.file);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const header = `/* ===== Extracted from game.js ===== */\n\n`;
  fs.writeFileSync(outPath, header + ext.content, 'utf8');
  console.log(`Written: ${ext.file} (${ext.content.split('\n').length} lines)`);

  const placeholder = `/* [MOVED] -> ${ext.file} */`;
  lines.splice(ext.startLine, ext.endLine - ext.startLine, placeholder);
}

fs.writeFileSync(GAME_JS, lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'script_tags.txt'), scriptTags.sort((a,b)=>a.index-b.index).map(x=>x.tag).join('\n'), 'utf8');
console.log(`Updated game.js: ${lines.length} lines`);
