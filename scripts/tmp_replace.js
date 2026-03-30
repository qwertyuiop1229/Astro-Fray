const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Replace standard positions
html = html.replace(/left:\s*calc\(([^)]*?)var\(--safe-area-extra(?:,\s*0px)?\)([^)]*?)\);/g, 'left: calc($1var(--safe-area-extra-x, 0px)$2);');
html = html.replace(/right:\s*calc\(([^)]*?)var\(--safe-area-extra(?:,\s*0px)?\)([^)]*?)\);/g, 'right: calc($1var(--safe-area-extra-x, 0px)$2);');
html = html.replace(/top:\s*calc\(([^)]*?)var\(--safe-area-extra(?:,\s*0px)?\)([^)]*?)\);/g, 'top: calc($1var(--safe-area-extra-y, 0px)$2);');
html = html.replace(/bottom:\s*calc\(([^)]*?)var\(--safe-area-extra(?:,\s*0px)?\)([^)]*?)\);/g, 'bottom: calc($1var(--safe-area-extra-y, 0px)$2);');

// Handle direct non-calc assignments if any
html = html.replace(/left:\s*var\(--safe-area-extra(?:,\s*0px)?\);/g, 'left: var(--safe-area-extra-x, 0px);');
html = html.replace(/right:\s*var\(--safe-area-extra(?:,\s*0px)?\);/g, 'right: var(--safe-area-extra-x, 0px);');
html = html.replace(/top:\s*var\(--safe-area-extra(?:,\s*0px)?\);/g, 'top: var(--safe-area-extra-y, 0px);');
html = html.replace(/bottom:\s*var\(--safe-area-extra(?:,\s*0px)?\);/g, 'bottom: var(--safe-area-extra-y, 0px);');

// Replace the UI slider
const oldSlider = `<div class="setting-row">
                            <div>画面の角丸マージン</div>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <input type="range" id="safeAreaSlider" min="0" max="60" step="1" value="0" />
                                <span id="safeAreaValue"
                                    style="font-size:12px;color:#00f0ff;min-width:30px;text-align:right;">0px</span>
                            </div>
                        </div>`;

const newSliders = `<div class="setting-row">
                            <div>画面の横マージン</div>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <input type="range" id="safeAreaXSlider" min="0" max="60" step="1" value="0" />
                                <span id="safeAreaXValue"
                                    style="font-size:12px;color:#00f0ff;min-width:30px;text-align:right;">0px</span>
                            </div>
                        </div>
                        <div class="setting-row">
                            <div>画面の縦マージン</div>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <input type="range" id="safeAreaYSlider" min="0" max="60" step="1" value="0" />
                                <span id="safeAreaYValue"
                                    style="font-size:12px;color:#00f0ff;min-width:30px;text-align:right;">0px</span>
                            </div>
                        </div>`;

html = html.replace(oldSlider, newSliders);

fs.writeFileSync('public/index.html', html, 'utf8');

console.log('Modified HTML saved.');
