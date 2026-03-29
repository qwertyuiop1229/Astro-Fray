const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf-8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let jsContent = '';
while ((match = scriptRegex.exec(html)) !== null) {
  jsContent += match[1] + '\n';
}
fs.writeFileSync('extracted.js', jsContent);
