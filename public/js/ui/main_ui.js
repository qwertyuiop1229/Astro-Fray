/* ===== Extracted from game.js ===== */

/* ========== UI実装 ========== */
const keymapModal = document.getElementById("keymapModal");
const kmListDiv = document.getElementById("km-list");
const closeKeymapBtn = document.getElementById("closeKeymap");
const resetDefaultsBtn = document.getElementById("resetDefaults");
const bindingNoticeDiv = document.getElementById("bindingNotice");
const pauseSettingsMenu = document.getElementById("pauseSettingsMenu");
const openKeymapFromMenuBtn = document.getElementById("openKeymapFromMenu");
const closePauseSettingsBtn = document.getElementById("closePauseSettings");
const lightweightToggle = document.getElementById("lightweightToggle");
const changeNicknameBtn = document.getElementById("changeNicknameBtn");
const toggleAllElem = document.getElementById("toggleAll");
const toggleStarsElem = document.getElementById("toggleStars");
const toggleAimLineElem = document.getElementById("toggleAimLine");
const toggleMinimapElem = document.getElementById("toggleMinimap");
const toggleParticlesElem = document.getElementById("toggleParticles");
const toggleGlowElem = document.getElementById("toggleGlow");
const toggleMinimapAsteroidsElem = document.getElementById("toggleMinimapAsteroids");
const toggleDamageElem = document.getElementById("toggleDamage");
const toggleShakeElem = document.getElementById("toggleShake");
const toggleControlModeElem = document.getElementById("toggleControlMode");
const toggleTouchUIElem = document.getElementById("toggleTouchUI");
const toggleFullscreenElem = document.getElementById("toggleFullscreen");

const bgmVolumeSlider = document.getElementById("bgmVolume");
const sfxVolumeSlider = document.getElementById("sfxVolume");
const damageTextSizeSlider = document.getElementById("damageTextSizeSlider");
const toggleBoostSoundElem = document.getElementById("toggleBoostSound");
const toggleWarpBassElem = document.getElementById("toggleWarpBass");
const toggleMinecraftModeElem = document.getElementById("toggleMinecraftMode");

const minecraftSensitivitySlider = document.getElementById("minecraftSensitivitySlider");
if (minecraftSensitivitySlider) {
    minecraftSensitivitySlider.value = minecraftSensitivity.toString();
    minecraftSensitivitySlider.addEventListener("input", (e) => {
        minecraftSensitivity = parseFloat(e.target.value);
        localStorage.setItem("minecraftSensitivity_v1", minecraftSensitivity.toString());
    });
}

const btnOpenSettingsView = document.getElementById("btnOpenSettingsView");
const pauseMainView = document.getElementById("pauseMainView");
const pauseSettingsView = document.getElementById("pauseSettingsView");
const btnBackToPauseMain = document.getElementById("btnBackToPauseMain");

// タブ切り替えロジック
const settingsTabs = document.querySelectorAll(".settings-tab");
const settingsTabContents = document.querySelectorAll(".settings-tab-content");
settingsTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        settingsTabs.forEach(t => t.classList.remove("tab-active"));
        settingsTabContents.forEach(c => c.classList.remove("tab-visible"));
        tab.classList.add("tab-active");
        document.querySelector(`.settings-tab-content[data-tab-content="${tab.dataset.tab}"]`).classList.add("tab-visible");
    });
});

function populateSettingsUI() {
    setLightweightUI(lightweightMode);
    setToggleElem(toggleControlModeElem, controlMode === "mouse");
    setToggleElem(toggleMinecraftModeElem, minecraftMode);
    if (minecraftSensitivitySlider) {
        minecraftSensitivitySlider.disabled = !minecraftMode;
        minecraftSensitivitySlider.style.opacity = minecraftMode ? "1" : "0.3";
    }
    setToggleElem(toggleTouchUIElem, useTouchUI);
    setToggleElem(toggleFullscreenElem, !!document.fullscreenElement);
    setToggleElem(toggleStarsElem, showStars);
    setToggleElem(toggleAimLineElem, !!featureSettings.aimLine);
    setToggleElem(toggleMinimapElem, showMinimap);
    setToggleElem(toggleParticlesElem, showParticles);
    setToggleElem(toggleGlowElem, showGlow);
    setToggleElem(toggleMinimapAsteroidsElem, showMinimapAsteroids);
    setToggleElem(toggleDamageElem, showDamage);
    setToggleElem(toggleShakeElem, enableShake);
    setToggleElem(
        toggleAllElem,
        showStars &&
        showMinimap &&
        showParticles &&
        showGlow &&
        showMinimapAsteroids &&
        showDamage &&
        enableShake
    );
    const shakeSlider = document.getElementById("shakeIntensitySlider");
    const safeAreaXSlider = document.getElementById("safeAreaXSlider");
    const safeAreaYSlider = document.getElementById("safeAreaYSlider");
    if (shakeSlider) {
        shakeSlider.value = Math.round((featureSettings.shakeIntensity !== undefined ? featureSettings.shakeIntensity : 1.0) * 100);
    }
    if (safeAreaXSlider) {
        safeAreaXSlider.value = safeAreaMarginX;
        const safeAreaValueX = document.getElementById("safeAreaValueX");
        if (safeAreaValueX) safeAreaValueX.innerText = safeAreaMarginX + "px";
    }
    if (safeAreaYSlider) {
        safeAreaYSlider.value = safeAreaMarginY;
        const safeAreaValueY = document.getElementById("safeAreaValueY");
        if (safeAreaValueY) safeAreaValueY.innerText = safeAreaMarginY + "px";
    }
}

btnOpenSettingsView?.addEventListener("click", () => {
    pauseMainView.style.display = "none";
    pauseSettingsView.style.display = "block";
    document.getElementById("settingsMenuTitle").innerText = "SETTINGS";
    populateSettingsUI();
});

btnBackToPauseMain?.addEventListener("click", () => {
    saveFeatureSettings(featureSettings); // Save display settings
    saveAudioSettings(audioSettings.sfx, audioSettings.bgm, audioSettings.boostSound, audioSettings.warpBass); // Save audio settings

    if (isSettingsFromHome) {
        document.getElementById("pauseSettingsMenu").style.display = "none";
        document.getElementById("modeSelectModal").style.display = "block";
        isSettingsFromHome = false;
    } else {
        pauseSettingsView.style.display = "none";
        pauseMainView.style.display = "block";
        document.getElementById("settingsMenuTitle").innerText = "PAUSE MENU";
    }
});

document.getElementById("btnSettingsToTitle")?.addEventListener("click", () => {
    window.location.reload();
});

bgmVolumeSlider.value = audioSettings.bgm;
sfxVolumeSlider.value = audioSettings.sfx;
damageTextSizeSlider.value =
    featureSettings.damageTextSize !== undefined
        ? featureSettings.damageTextSize
        : 24;

document
    .getElementById("btnHomeSettings")
    ?.addEventListener("click", () => {
        document.getElementById("modeSelectModal").style.display = "none";
        document.getElementById("pauseSettingsMenu").style.display = "block";

        pauseMainView.style.display = "none";
        pauseSettingsView.style.display = "block";

        document.getElementById("settingsMenuTitle").innerText = "SETTINGS";
        document.getElementById("pauseSubText").style.display = "none";
        isSettingsFromHome = true;
        populateSettingsUI();
    });

openKeymapFromMenuBtn?.addEventListener("click", () => {
    renderKeymapList();
    keymapModal.style.display = "block";
    pauseSettingsMenu.style.display = "none";
    bindingAction = null;
    updateBindingNotice();
});
/* openBasicSettingsBtn and openAudioSettingsBtn are removed since we are using tabs */

closePauseSettingsBtn?.addEventListener("click", () => {
    setPauseState(false);
});

closeKeymapBtn?.addEventListener("click", () => {
    keymapModal.style.display = "none";
    pauseSettingsMenu.style.display = "block";
    bindingAction = null;
    updateBindingNotice();
});
resetDefaultsBtn?.addEventListener("click", () => {
    keyBindings = JSON.parse(JSON.stringify(defaultKeyBindings));
    saveKeyBindings(keyBindings);
    renderKeymapList();
    updateBindingNotice();
});

document
    .getElementById("btnLeaveMultiplayer")
    ?.addEventListener("click", () => {
        window.leaveMultiplayerRoom(false);
    });
document
    .getElementById("btnLeaveSingleplayer")
    ?.addEventListener("click", async () => {
        // ゲーム中（ゲームオーバーでない）なら確認ダイアログ
        if (running && !gameOverMode && !window.isMultiplayer) {
            // ポーズメニューを一時非表示にしてダイアログを見せる
            const pauseMenu = document.getElementById("pauseSettingsMenu");
            const wasVisible = pauseMenu.style.display !== "none";
            if (wasVisible) pauseMenu.style.display = "none";
            const confirmed = await window.gameConfirm(
                "ゲームを終了しますか？\n現在のスコアはランキングに登録されません。"
            );
            if (!confirmed) {
                if (wasVisible) pauseMenu.style.display = "block";
                return;
            }
        }
        // セッショントークンを無効化
        _currentSessionToken = null;
        // 画面フェードアウト → モードセレクトへ
        if (typeof window.playTitleBGM === "function") window.playTitleBGM();
        screenFadeOut(1200, "#050510", () => {
            running = false;
            gameOverMode = false;
            isPaused = false;
            matchEnded = false;
            window._testPlayMode = false;
            document
                .querySelectorAll(".game-modal")
                .forEach((m) => (m.style.display = "none"));
            document.getElementById("pauseSettingsMenu").style.display = "none";
            document.getElementById("modeSelectModal").style.display = "block";

            resetGameBackground();

            ctx.fillStyle = "#050510";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            screenFadeIn(1200, 100);
        });
    });

function renderKeymapList() {
    kmListDiv.innerHTML = "";
    const order = [
        ["thrust", "前進"],
        ["turnLeft", "左旋回"],
        ["turnRight", "右旋回"],
        ["brake", "ブレーキ"],
        ["shoot", "射撃"],
        ["boost", "ブースト"],
        ["rollLeft", "横スライド左"],
        ["rollRight", "横スライド右"],
        ["pause", "ポーズ"],
        ["restart", "リスタート/戻る"],
        ["help", "ヘルプ表示"],
    ];
    for (const [key, label] of order) {
        const row = document.createElement("div");
        row.className = "km-row";
        const lab = document.createElement("div");
        lab.textContent = label;
        const keydiv = document.createElement("div");
        keydiv.className = "km-key";
        keydiv.textContent = displayBind(keyBindings[key]);
        const actions = document.createElement("div");
        actions.className = "km-actions";
        const changeBtn = document.createElement("button");
        changeBtn.textContent = "変更";
        changeBtn.className = "cyber-btn";
        const clearBtn = document.createElement("button");
        clearBtn.textContent = "消去";
        clearBtn.className = "cyber-btn btn-red";
        changeBtn.addEventListener("click", () => {
            bindingAction = key;
            updateBindingNotice();
        });
        clearBtn.addEventListener("click", () => {
            keyBindings[key] = [];
            saveKeyBindings(keyBindings);
            renderKeymapList();
            updateBindingNotice();
        });
        actions.appendChild(changeBtn);
        actions.appendChild(clearBtn);
        row.appendChild(lab);
        row.appendChild(keydiv);
        row.appendChild(actions);
        kmListDiv.appendChild(row);
    }
}
function updateBindingNotice() {
    if (bindingAction) {
        bindingNoticeDiv.textContent = `新しいキーを押してください。Escでキャンセル`;
    } else {
        bindingNoticeDiv.textContent =
            "「変更」を押し、割り当てるキーを押してください。";
    }
}

function setToggleElem(el, on) {
    if (!el) return;
    // Add bounce animation
    el.classList.remove("bounce");
    void el.offsetWidth; // trigger reflow
    el.classList.add("bounce");

    if (on) {
        el.classList.add("on");
        el.setAttribute("aria-checked", "true");
    } else {
        el.classList.remove("on");
        el.setAttribute("aria-checked", "false");
    }
}

// ゴースト/リップルエフェクト追加
document.addEventListener('click', function (e) {
    let btn = e.target.closest('.cyber-btn');
    if (btn && !btn.disabled) {
        let ripple = document.createElement('div');
        ripple.className = 'btn-ripple';
        let rect = btn.getBoundingClientRect();
        let size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 450);
    }
});
function setLightweightUI(on) {
    setToggleElem(lightweightToggle, on);
}
function wireToggle(elem, getStateFn, setStateFn) {
    if (!elem) return;
    elem.addEventListener("click", () => {
        const newv = !getStateFn();
        setStateFn(newv);
        if (elem !== toggleAllElem) {
            setToggleElem(
                toggleAllElem,
                featureSettings.stars &&
                featureSettings.minimap &&
                featureSettings.particles &&
                featureSettings.glow &&
                featureSettings.minimapAsteroids &&
                featureSettings.showDamage !== false &&
                featureSettings.enableShake !== false,
            );
            saveFeatureSettings(featureSettings);
        }
    });
    elem.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            elem.click();
        }
    });
}
wireToggle(
    toggleStarsElem,
    () => featureSettings.stars,
    (v) => {
        featureSettings.stars = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleStarsElem, v);
        starCacheNeedsRegen = true;
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleAimLineElem,
    () => featureSettings.aimLine,
    (v) => {
        featureSettings.aimLine = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleAimLineElem, v);
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleMinimapElem,
    () => featureSettings.minimap,
    (v) => {
        featureSettings.minimap = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleMinimapElem, v);
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleParticlesElem,
    () => featureSettings.particles,
    (v) => {
        featureSettings.particles = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleParticlesElem, v);
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleGlowElem,
    () => featureSettings.glow,
    (v) => {
        featureSettings.glow = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleGlowElem, v);
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleMinimapAsteroidsElem,
    () => featureSettings.minimapAsteroids,
    (v) => {
        featureSettings.minimapAsteroids = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleMinimapAsteroidsElem, v);
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleDamageElem,
    () => featureSettings.showDamage !== false,
    (v) => {
        featureSettings.showDamage = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleDamageElem, v);
        saveFeatureSettings(featureSettings);
    },
);
wireToggle(
    toggleShakeElem,
    () => featureSettings.enableShake !== false,
    (v) => {
        featureSettings.enableShake = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleShakeElem, v);
        saveFeatureSettings(featureSettings);
    },
);

toggleControlModeElem?.addEventListener("click", () => {
    if (useTouchUI) return; // Cannot change while touch UI is active
    controlMode = controlMode === "mouse" ? "keyboard" : "mouse";
    localStorage.setItem("controlMode_v1", controlMode);
    setToggleElem(toggleControlModeElem, controlMode === "mouse");
});
toggleControlModeElem?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleControlModeElem.click();
    }
});

toggleMinecraftModeElem?.addEventListener("click", () => {
    minecraftMode = !minecraftMode;
    localStorage.setItem("minecraftMode_v1", minecraftMode ? "1" : "0");
    setToggleElem(toggleMinecraftModeElem, minecraftMode);
    if (minecraftSensitivitySlider) {
        minecraftSensitivitySlider.disabled = !minecraftMode;
        minecraftSensitivitySlider.style.opacity = minecraftMode ? "1" : "0.3";
    }
    if (!minecraftMode && !isMobileDevice && document.pointerLockElement === canvas) {
        document.exitPointerLock();
    }
    updateTouchPanVisibility();
});
toggleMinecraftModeElem?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleMinecraftModeElem.click();
    }
});

toggleTouchUIElem?.addEventListener("click", () => {
    useTouchUI = !useTouchUI;
    localStorage.setItem("forceTouchUI_v1", useTouchUI ? "1" : "0");
    setToggleElem(toggleTouchUIElem, useTouchUI);
    updateTouchUIVisibility();
});
toggleTouchUIElem?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleTouchUIElem.click();
    }
});

toggleFullscreenElem?.addEventListener("click", () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
        setToggleElem(toggleFullscreenElem, true);
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        setToggleElem(toggleFullscreenElem, false);
    }
});
toggleFullscreenElem?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleFullscreenElem.click();
    }
});

wireToggle(
    toggleAllElem,
    () =>
        featureSettings.stars &&
        featureSettings.minimap &&
        featureSettings.particles &&
        featureSettings.glow &&
        featureSettings.minimapAsteroids &&
        featureSettings.showDamage !== false &&
        featureSettings.enableShake !== false,
    (v) => {
        featureSettings.stars = v;
        featureSettings.minimap = v;
        featureSettings.particles = v;
        featureSettings.glow = v;
        featureSettings.minimapAsteroids = v;
        featureSettings.showDamage = v;
        featureSettings.enableShake = v;
        applyFeatureSettingsToRuntime();
        setToggleElem(toggleStarsElem, v);
        featureSettings.aimLine = v;
        setToggleElem(toggleAimLineElem, v);
        setToggleElem(toggleMinimapElem, v);
        setToggleElem(toggleParticlesElem, v);
        setToggleElem(toggleGlowElem, v);
        setToggleElem(toggleMinimapAsteroidsElem, v);
        setToggleElem(toggleDamageElem, v);
        setToggleElem(toggleShakeElem, v);
        setToggleElem(toggleAllElem, v);
        saveFeatureSettings(featureSettings);
        starCacheNeedsRegen = true;
    },
);

wireToggle(
    toggleBoostSoundElem,
    () => audioSettings.boostSound,
    (v) => {
        audioSettings.boostSound = v;
        setToggleElem(toggleBoostSoundElem, v);
        saveAudioSettings(audioSettings.sfx, audioSettings.bgm, audioSettings.boostSound, audioSettings.warpBass);
    },
);
setToggleElem(toggleBoostSoundElem, audioSettings.boostSound);

wireToggle(
    toggleWarpBassElem,
    () => audioSettings.warpBass,
    (v) => {
        audioSettings.warpBass = v;
        setToggleElem(toggleWarpBassElem, v);
        saveAudioSettings(audioSettings.sfx, audioSettings.bgm, audioSettings.boostSound, audioSettings.warpBass);
    },
);
setToggleElem(toggleWarpBassElem, audioSettings.warpBass);

lightweightToggle?.addEventListener("click", () => {
    applyLightweightMode(!lightweightMode);
    setLightweightUI(lightweightMode);
    applyFeatureSettingsToRuntime();
    debouncedCloudSync();
});
lightweightToggle?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        applyLightweightMode(!lightweightMode);
        setLightweightUI(lightweightMode);
        applyFeatureSettingsToRuntime();
        debouncedCloudSync();
    }
});

// シンプル画面遷移トグル
const toggleSimpleTransition = document.getElementById('toggleSimpleTransition');
if (toggleSimpleTransition) {
    setToggleElem(toggleSimpleTransition, simpleTransition);
    wireToggle(toggleSimpleTransition, () => simpleTransition, (v) => {
        simpleTransition = v;
        localStorage.setItem('simpleTransition_v1', v ? '1' : '0');
        setToggleElem(toggleSimpleTransition, v);
        debouncedCloudSync();
    });
}

damageTextSizeSlider?.addEventListener("input", (e) => {
    featureSettings.damageTextSize = parseInt(e.target.value);
    applyFeatureSettingsToRuntime();
    saveFeatureSettings(featureSettings);
});
const shakeIntensitySlider = document.getElementById(
    "shakeIntensitySlider",
);
shakeIntensitySlider?.addEventListener("input", (e) => {
    featureSettings.shakeIntensity = parseInt(e.target.value) / 100;
    applyFeatureSettingsToRuntime();
    saveFeatureSettings(featureSettings);
});
const safeAreaXSlider = document.getElementById("safeAreaXSlider");
const safeAreaValueX = document.getElementById("safeAreaValueX");
safeAreaXSlider?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value) || 0;
    featureSettings.safeAreaMarginX = val;
    if (safeAreaValueX) safeAreaValueX.innerText = val + "px";
    applyFeatureSettingsToRuntime();
    saveFeatureSettings(featureSettings);
});
const safeAreaYSlider = document.getElementById("safeAreaYSlider");
const safeAreaValueY = document.getElementById("safeAreaValueY");
safeAreaYSlider?.addEventListener("input", (e) => {
    const val = parseInt(e.target.value) || 0;
    featureSettings.safeAreaMarginY = val;
    if (safeAreaValueY) safeAreaValueY.innerText = val + "px";
    applyFeatureSettingsToRuntime();
    saveFeatureSettings(featureSettings);
});
