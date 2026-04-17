/* ===== UI レイアウトエディター ===== */
/* Extracted from game.js for modular organization */

/* ========== UI Layout Editor Logic ========== */
function setupLayoutEditor() {
    const btnOpen = document.getElementById('btnOpenUILayoutEditor');
    const overlay = document.getElementById('layoutEditorOverlay');
    const canvasLayer = document.getElementById('layoutEditorCanvas');
    const btnClose = document.getElementById('leBtnClose');
    const scaleSlider = document.getElementById('leScaleSlider');
    const scaleVal = document.getElementById('leScaleVal');
    const btnResetItem = document.getElementById('leBtnResetItem');
    const btnResetAll = document.getElementById('leBtnResetAll');
    const selName = document.getElementById('leSelectedName');
    const sizePopup = document.getElementById('leSizePopup');
    const btnClosePopup = document.getElementById('leBtnClosePopup');

    if (!btnOpen || !overlay) return;

    let selectedBox = null;

    const partsDef = [
        { id: 'hud_score', label: 'SCORE / LIVES', w: 160, h: 100, isCanvas: true, baseAnchor: 'tl' },
        { id: 'hud_teams', label: 'ENEMIES / ALLIES', w: 120, h: 60, isCanvas: true, baseAnchor: 'tr' },
        { id: 'hud_fps', label: 'FPS', w: 70, h: 22, isCanvas: true, baseAnchor: 'br' },
        { id: 'hud_minimap', label: 'MINIMAP', w: 140, h: 140, isCanvas: true, baseAnchor: 'bl' },
        { id: 'btnTouchShoot', label: 'SHOOT', isCanvas: false },
        { id: 'btnTouchPause', label: '||', isCanvas: false },
        { id: 'btnTouchBoost', label: 'BOOST', isCanvas: false },
        { id: 'btnTouchBrake', label: 'STOP', isCanvas: false },
        { id: 'btnTouchRollLeft', label: 'L-SLIDE', isCanvas: false },
        { id: 'btnTouchRollRight', label: 'R-SLIDE', isCanvas: false },
        { id: 'joystickBase', label: 'JOYSTICK', isCanvas: false }
    ];

    btnOpen.addEventListener('click', () => {
        document.getElementById('pauseSettingsMenu').style.display = 'none';
        isPaused = true;
        overlay.style.display = 'block';
        overlay.style.opacity = '0';
        if (sizePopup) sizePopup.style.display = 'none';
        requestAnimationFrame(() => {
            overlay.style.transition = 'opacity 0.25s ease';
            overlay.style.opacity = '1';
        });
        // セーフエリアガイド表示
        const guide = document.getElementById('leSafeAreaGuide');
        if (guide && (safeAreaMarginX > 0 || safeAreaMarginY > 0)) {
            guide.style.display = 'block';
            guide.style.left = safeAreaMarginX + 'px';
            guide.style.top = safeAreaMarginY + 'px';
            guide.style.width = (window.innerWidth - safeAreaMarginX * 2) + 'px';
            guide.style.height = (window.innerHeight - safeAreaMarginY * 2) + 'px';
        }
        initCanvas();
    });

    function closePopup() {
        if (!sizePopup || sizePopup.style.display === 'none') return;
        sizePopup.style.opacity = '0';
        sizePopup.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (sizePopup.style.opacity === '0') sizePopup.style.display = 'none';
        }, 200);
    }

    if (overlay) {
        overlay.addEventListener('pointerdown', (e) => {
            if (sizePopup && sizePopup.style.display !== 'none' && !sizePopup.contains(e.target)) {
                closePopup();
            }
        });
    }

    btnClose.addEventListener('click', () => {
        playClickSound();
        overlay.style.transition = 'opacity 0.2s ease';
        overlay.style.opacity = '0';
        if (sizePopup) sizePopup.style.display = 'none';
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.style.transition = '';
            const guide = document.getElementById('leSafeAreaGuide');
            if (guide) guide.style.display = 'none';
            // Return to settings menu
            const settingsMenu = document.getElementById('pauseSettingsMenu');
            if (settingsMenu) {
                settingsMenu.style.display = 'block';
            }
        }, 200);
        UILayoutManager.save();
        UILayoutManager.applyToDOM();
    });

    function selectBox(box) {
        if (selectedBox) selectedBox.style.borderColor = 'rgba(255,255,255,0.4)';
        selectedBox = box;
        if (box) {
            box.style.borderColor = '#0f0';
            selName.innerText = '★ ' + box.dataset.label + ' (長押し/右クリックでサイズ変更)';
            const s = UILayoutManager.get(box.dataset.id)?.s || 1.0;
            scaleSlider.value = s;
            scaleVal.innerText = s.toFixed(1) + 'x';
            btnResetItem.disabled = false;
        } else {
            selName.innerText = '★ 未選択';
            btnResetItem.disabled = true;
            if (sizePopup) sizePopup.style.display = 'none';
        }
    }

    if (btnClosePopup) {
        btnClosePopup.addEventListener('click', () => {
            sizePopup.style.display = 'none';
        });
    }

    scaleSlider.addEventListener('input', (e) => {
        if (!selectedBox) return;
        const val = parseFloat(e.target.value);
        scaleVal.innerText = val.toFixed(1) + 'x';
        selectedBox.style.transform = `translate(-50%, -50%) scale(${val})`;
        let existing = UILayoutManager.get(selectedBox.dataset.id) || { x: parseFloat(selectedBox.dataset.x), y: parseFloat(selectedBox.dataset.y) };
        UILayoutManager.set(selectedBox.dataset.id, existing.x, existing.y, val);
    });

    btnResetItem.addEventListener('click', () => {
        if (!selectedBox) return;
        UILayoutManager.reset(selectedBox.dataset.id);
        initCanvas();
    });

    btnResetAll.addEventListener('click', async () => {
        if (await window.gameConfirm('全てのUI配置をリセットしますか？')) {
            UILayoutManager.resetAll();
            initCanvas();
        }
    });

    function initCanvas() {
        canvasLayer.innerHTML = '';
        selectedBox = null;
        selectBox(null);

        partsDef.forEach(def => {
            if (!def.isCanvas && !document.getElementById(def.id)) return;

            const box = document.createElement('div');
            box.className = 'le-box';
            box.dataset.id = def.id;
            box.dataset.label = def.label;
            box.innerText = def.label;
            box.style.position = 'absolute';
            box.style.display = 'flex';
            box.style.alignItems = 'center';
            box.style.justifyContent = 'center';
            box.style.backgroundColor = 'rgba(0, 240, 255, 0.2)';
            box.style.border = '2px dashed rgba(255,255,255,0.4)';
            box.style.color = '#fff';
            box.style.fontSize = '12px';
            box.style.fontWeight = 'bold';
            box.style.userSelect = 'none';
            box.style.cursor = 'grab';
            box.style.textShadow = '0 0 4px #000';
            box.style.touchAction = 'none';

            let saved = UILayoutManager.get(def.id);
            let s = saved ? saved.s : 1.0;
            let xPct = saved ? saved.x : 50;
            let yPct = saved ? saved.y : 50;

            if (!saved) {
                if (!def.isCanvas) {
                    const el = document.getElementById(def.id);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        xPct = (rect.left + rect.width / 2) / window.innerWidth * 100;
                        yPct = (rect.top + rect.height / 2) / window.innerHeight * 100;
                        box.style.width = Math.max(60, rect.width) + 'px';
                        box.style.height = Math.max(60, rect.height) + 'px';
                        box.style.borderRadius = getComputedStyle(el).borderRadius;
                    }
                } else {
                    box.style.width = def.w + 'px';
                    box.style.height = def.h + 'px';
                    if (def.baseAnchor === 'tl') { xPct = (20 + def.w / 2) / window.innerWidth * 100; yPct = (36 + def.h / 2) / window.innerHeight * 100; }
                    if (def.baseAnchor === 'tr') { xPct = (window.innerWidth - 180 + def.w / 2) / window.innerWidth * 100; yPct = (36 + def.h / 2) / window.innerHeight * 100; }
                    if (def.baseAnchor === 'bl') { xPct = (32 + def.w / 2) / window.innerWidth * 100; yPct = (window.innerHeight - 172 + def.h / 2) / window.innerHeight * 100; }
                    if (def.baseAnchor === 'br') { xPct = (window.innerWidth - 86 + def.w / 2) / window.innerWidth * 100; yPct = (window.innerHeight - 34 + def.h / 2) / window.innerHeight * 100; }
                }
            } else {
                if (!def.isCanvas) {
                    const el = document.getElementById(def.id);
                    box.style.width = (el ? el.offsetWidth : 60) + 'px';
                    box.style.height = (el ? el.offsetHeight : 60) + 'px';
                    if (el) box.style.borderRadius = getComputedStyle(el).borderRadius;
                } else {
                    box.style.width = def.w + 'px';
                    box.style.height = def.h + 'px';
                }
            }

            box.dataset.x = xPct;
            box.dataset.y = yPct;
            box.style.left = xPct + '%';
            box.style.top = yPct + '%';
            box.style.transform = `translate(-50%, -50%) scale(${s})`;

            let isDragging = false;
            let offsetX, offsetY;
            let longPressTimer = null;

            function showPopup(e, x, y) {
                if (!sizePopup || !box) return;
                selectBox(box);

                sizePopup.style.transition = 'none';
                sizePopup.style.opacity = '0';
                sizePopup.style.transform = 'scale(0.9)';
                sizePopup.style.display = 'flex';

                // Clamp position
                let px = x;
                let py = y + 20;

                // Need a frame to get offsetWidth correctly
                requestAnimationFrame(() => {
                    if (px + sizePopup.offsetWidth > window.innerWidth) px = window.innerWidth - sizePopup.offsetWidth - 10;
                    if (py + sizePopup.offsetHeight > window.innerHeight) py = y - sizePopup.offsetHeight - 10;
                    px = Math.max(10, px);
                    py = Math.max(10, py);
                    sizePopup.style.left = px + 'px';
                    sizePopup.style.top = py + 'px';

                    requestAnimationFrame(() => {
                        sizePopup.style.transition = 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
                        sizePopup.style.opacity = '1';
                        sizePopup.style.transform = 'scale(1)';
                    });
                });
            }

            box.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showPopup(e, e.clientX, e.clientY);
            });

            function onPointerDown(e) {
                // Ignore right click for drag
                if (e.button === 2) return;

                e.preventDefault();
                e.stopPropagation();

                // Close popup initially to reset
                if (sizePopup && sizePopup.style.display !== 'none' && !sizePopup.contains(e.target)) {
                    closePopup();
                }

                isDragging = true;
                selectBox(box);
                const rect = box.getBoundingClientRect();
                offsetX = e.clientX - rect.left - rect.width / 2;
                offsetY = e.clientY - rect.top - rect.height / 2;
                box.setPointerCapture(e.pointerId);
                box.style.cursor = 'grabbing';

                // Long press logic for mobile
                if (e.pointerType === 'touch') {
                    longPressTimer = setTimeout(() => {
                        if (isDragging) {
                            showPopup(e, e.clientX, e.clientY);
                            isDragging = false;
                            box.releasePointerCapture(e.pointerId);
                            box.style.cursor = 'grab';
                        }
                    }, 500); // 500ms long press
                }
            }
            function onPointerMove(e) {
                if (!isDragging) return;
                e.preventDefault();

                // Drag start - close popup
                if (sizePopup && sizePopup.style.display !== 'none') closePopup();

                // If moved too much, cancel long press
                if (longPressTimer && (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3)) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }

                let nx = e.clientX - offsetX;
                let ny = e.clientY - offsetY;
                let pctX = nx / window.innerWidth * 100;
                let pctY = ny / window.innerHeight * 100;

                pctX = Math.max(2, Math.min(98, pctX));
                pctY = Math.max(2, Math.min(98, pctY));

                box.dataset.x = pctX;
                box.dataset.y = pctY;
                box.style.left = pctX + '%';
                box.style.top = pctY + '%';
                let curS = UILayoutManager.get(def.id)?.s || 1.0;
                UILayoutManager.set(def.id, pctX, pctY, curS);
            }
            function onPointerUp(e) {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                if (!isDragging) return;
                isDragging = false;
                box.releasePointerCapture(e.pointerId);
                box.style.cursor = 'grab';
            }

            box.addEventListener('pointerdown', onPointerDown);
            box.addEventListener('pointermove', onPointerMove);
            box.addEventListener('pointerup', onPointerUp);
            box.addEventListener('pointercancel', onPointerUp);

            canvasLayer.appendChild(box);
        });
    }
}
setupLayoutEditor();
UILayoutManager.applyToDOM();
