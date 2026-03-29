const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const jsPath = path.join(__dirname, 'public', 'game.js');

let html = fs.readFileSync(htmlPath, 'utf8');

// Find all <script> tags
const scriptRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/g;
let match;
let gameScriptIndex = -1;
let gameScriptContent = '';

while ((match = scriptRegex.exec(html)) !== null) {
    const attrs = match[1];
    const content = match[2];
    
    // The main game script is the one containing "宇宙ドッグファイト" or very long
    if (!attrs.includes('src') && content.length > 50000) {
        gameScriptIndex = match.index;
        gameScriptContent = content;
        break;
    }
}

if (gameScriptIndex !== -1) {
    fs.writeFileSync(jsPath, gameScriptContent);
    // Replace only the specific script block
    const fullScriptTag = html.substring(gameScriptIndex, html.indexOf('</script>', gameScriptIndex) + 9);
    const newHtml = html.replace(fullScriptTag, '<script src="./game.js"></script>');
    fs.writeFileSync(htmlPath, newHtml);
    console.log("Successfully extracted game.js to public/game.js");
} else {
    console.log("Main game script not found.");
}
