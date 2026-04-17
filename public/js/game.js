/* 2D 宇宙ドッグファイト - Photon + Firestore オンライン対応版 (完全版) */
window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});
// iOS Safari ピンチズーム防止（WebKit専用のgestureイベント）
window.addEventListener("gesturestart", (e) => { e.preventDefault(); }, { passive: false });
window.addEventListener("gesturechange", (e) => { e.preventDefault(); }, { passive: false });
window.addEventListener("gestureend", (e) => { e.preventDefault(); }, { passive: false });
// 全画面でのマルチタッチによるブラウザズーム防止（ゲーム内ピンチズームは game.js 内で別途処理）
document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1) { e.preventDefault(); }
}, { passive: false });
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function isTyping() {
    const el = document.activeElement;
    return (
        el &&
        (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "NUMBER")
    );
}

/* [MOVED] キーバインド管理 -> core/keybindings.js */
/* [MOVED] オーディオマネージャー -> core/audio.js */
/* [MOVED] 入力コントロール基盤 -> core/init_controls.js */
/* [MOVED] 数学・共通関数群 -> core/utils.js */
/* [MOVED] -> core/faction.js */
/* [MOVED] -> core/settings.js */
/* [MOVED] -> core/state.js */
/* [MOVED] -> core/touch.js */
/* ========== 横画面推奨メッセージ ========== */
let landscapeDismissed = false;
const landscapeWarning = document.getElementById("landscapeWarning");
const btnDismissLandscape = document.getElementById(
    "btnDismissLandscape",
);

function checkOrientationWarning() {
    if (landscapeDismissed || !isMobileDevice) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait && landscapeWarning) {
        landscapeWarning.style.display = "flex";
    } else if (landscapeWarning) {
        landscapeWarning.style.display = "none";
    }
}

if (btnDismissLandscape) {
    btnDismissLandscape.addEventListener("click", () => {
        landscapeDismissed = true;
        landscapeWarning.style.display = "none";
    });
    btnDismissLandscape.addEventListener("touchstart", (e) => {
        e.preventDefault();
        landscapeDismissed = true;
        landscapeWarning.style.display = "none";
    });
}

window.addEventListener("resize", checkOrientationWarning);
window.addEventListener("orientationchange", () => {
    setTimeout(checkOrientationWarning, 200);
});
checkOrientationWarning();

joystickArea.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (joystickActive) return;
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    joystickActive = true;
    joystickCenter = { x: touch.clientX, y: touch.clientY };
    joystickBase.style.display = "block";
    joystickBase.style.left = joystickCenter.x + "px";
    joystickBase.style.top = joystickCenter.y + "px";
    joystickNub.style.transform = `translate(-50%, -50%)`;
});

joystickArea.addEventListener(
    "touchmove",
    (e) => {
        e.preventDefault();
        if (!joystickActive) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystickTouchId) {
                let dx = touch.clientX - joystickCenter.x;
                let dy = touch.clientY - joystickCenter.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxRadius = 60;
                if (dist > maxRadius) {
                    dx = (dx / dist) * maxRadius;
                    dy = (dy / dist) * maxRadius;
                }
                joystickNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                // Normalize vector (-1 to 1)
                joystickVector.x = dx / maxRadius;
                joystickVector.y = dy / maxRadius;

                if (minecraftMode) {
                    // ポインターロックカメラモード:
                    // 水平軸 = カメラ回転（独立） → joystickVector.xをフレームループで参照
                    // 垂直軸 = 前進/ブレーキ（独立）
                    // 斜め入力で両方同時に効く
                    keys["touch_aim"] = true;
                    keys["touch_thrust"] = joystickVector.y < -0.25;
                    keys["touch_brake"] = joystickVector.y > 0.4;
                } else {
                    // 通常モード: ジョイスティックの角度 = エイム方向
                    keys["touch_aim"] = true;
                    keys["touch_angle"] = Math.atan2(
                        joystickVector.y,
                        joystickVector.x,
                    );
                    keys["touch_thrust"] =
                        Math.hypot(joystickVector.x, joystickVector.y) > 0.4;
                    keys["touch_brake"] = false;
                }

                break;
            }
        }
    },
    { passive: false },
);

function endJoystick(e) {
    if (!joystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
            joystickActive = false;
            joystickTouchId = null;
            joystickBase.style.display = "none";
            joystickVector = { x: 0, y: 0 };
            keys["touch_aim"] = false;
            keys["touch_thrust"] = false;
            keys["touch_brake"] = false;
            break;
        }
    }
}
joystickArea.addEventListener("touchend", endJoystick);
joystickArea.addEventListener("touchcancel", endJoystick);

const touchPanArea = document.getElementById("touchPanArea");
let touchPanActive = false;
let touchPanId = null;
let lastTouchPanX = 0;

// touchPanAreaの表示/非表示を制御
// minecraftMode時はジョイスティックにカメラ統合されるため不要
function updateTouchPanVisibility() {
    const el = document.getElementById("touchPanArea");
    if (!el) return;
    if (minecraftMode && controlMode === "touch") {
        el.style.pointerEvents = "none";
        el.style.display = "none";
    } else {
        el.style.pointerEvents = "auto";
        el.style.display = "";
    }
}
updateTouchPanVisibility();

touchPanArea?.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (touchPanActive) return;
    const touch = e.changedTouches[0];
    touchPanId = touch.identifier;
    touchPanActive = true;
    lastTouchPanX = touch.clientX;
});
touchPanArea?.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!touchPanActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchPanId) {
            const dx = touch.clientX - lastTouchPanX;
            lastTouchPanX = touch.clientX;
            if (minecraftMode) {
                mouse.movementX = (mouse.movementX || 0) + dx * 1.5;
            }
            break;
        }
    }
}, { passive: false });
function endTouchPan(e) {
    if (!touchPanActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchPanId) {
            touchPanActive = false;
            touchPanId = null;
            break;
        }
    }
}
touchPanArea?.addEventListener("touchend", endTouchPan);
touchPanArea?.addEventListener("touchcancel", endTouchPan);

// Pinch to Zoom support
let initialPinchDistance = null;
let pinchBlocked = false;

function isTouchOnUI(touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return false;
    return (
        el.closest(
            "#touchBtns, .game-modal, #pauseSettingsMenu, .touch-action-btn",
        ) !== null
    );
}

window.addEventListener(
    "touchstart",
    (e) => {
        if (e.touches.length === 2) {
            // スティック/ボタン/設定画面上のタッチはブロック
            pinchBlocked = false;
            for (let i = 0; i < e.touches.length; i++) {
                if (isTouchOnUI(e.touches[i])) {
                    pinchBlocked = true;
                    break;
                }
            }
            if (!pinchBlocked && running) {
                let dx = e.touches[0].clientX - e.touches[1].clientX;
                let dy = e.touches[0].clientY - e.touches[1].clientY;
                initialPinchDistance = Math.hypot(dx, dy);
            } else {
                initialPinchDistance = null;
            }
        }
    },
    { passive: false },
);

window.addEventListener(
    "touchmove",
    (e) => {
        if (
            e.touches.length === 2 &&
            initialPinchDistance !== null &&
            !pinchBlocked
        ) {
            e.preventDefault();
            let dx = e.touches[0].clientX - e.touches[1].clientX;
            let dy = e.touches[0].clientY - e.touches[1].clientY;
            let dist = Math.hypot(dx, dy);
            let diff = dist - initialPinchDistance;
            zoomLevel = Math.max(0.3, Math.min(zoomLevel + diff * 0.005, 3.0));
            localStorage.setItem("zoomLevel_v1", zoomLevel.toString());
            initialPinchDistance = dist;
        }
    },
    { passive: false },
);

window.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
        initialPinchDistance = null;
    }
});

function bindTouchBtn(id, mappedKeys) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        mappedKeys.forEach((k) => (keys[k] = true));
    });
    btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        mappedKeys.forEach((k) => (keys[k] = false));
    });
    btn.addEventListener("touchcancel", (e) => {
        e.preventDefault();
        mappedKeys.forEach((k) => (keys[k] = false));
    });
}
bindTouchBtn("btnTouchShoot", [" "]); // Space
bindTouchBtn("btnTouchBoost", ["shift"]);
bindTouchBtn("btnTouchBrake", ["s"]);
bindTouchBtn("btnTouchRollLeft", ["q"]);
bindTouchBtn("btnTouchRollRight", ["e"]);

const btnTouchPause = document.getElementById("btnTouchPause");
if (btnTouchPause) {
    btnTouchPause.addEventListener(
        "touchstart",
        (e) => {
            e.preventDefault();
            if (running || isPaused) {
                if (isSettingsFromHome) {
                    document.getElementById("pauseSettingsMenu").style.display =
                        "none";
                    document.getElementById("modeSelectModal").style.display =
                        "block";
                    isSettingsFromHome = false;
                } else {
                    setPauseState(!isPaused);
                }
            }
        },
        { passive: false },
    );
}

window.leaveMultiplayerRoom = function (showAlert = false, msg = "") {
    if (hasDisconnectedAlertShown) return;
    isLeavingRoom = true;
    if (showAlert) {
        hasDisconnectedAlertShown = true;
        window.gameAlert(msg, "DISCONNECTED");
    }

    // フェードアウトの待機(1.2秒)を消し、即座にPhoton切断とFirestore削除を行う
    if (photonClient && photonClient.isJoinedToRoom()) {
        if (
            window.currentRoomDocId &&
            photonClient.myRoom().masterClientId ===
            photonClient.myActor().actorNr
        ) {
            if (window.deleteFirestoreRoom)
                window.deleteFirestoreRoom(window.currentRoomDocId);
        }
        photonClient.leaveRoom();
        photonClient.disconnect();
    }
    window.currentRoomDocId = null; // IDをリセットして重複処理を防ぐ

    // 画面フェードアウト → BGMフェードアウトを同時に行い、完了後にモードセレクトへ
    if (typeof window.playTitleBGM === "function") window.playTitleBGM();
    screenFadeOut(1200, "#050510", () => {
        running = false;
        isPaused = false;
        matchEnded = false;

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
    if (showAlert)
        setTimeout(() => {
            hasDisconnectedAlertShown = false;
        }, 2000);
    setTimeout(() => {
        isLeavingRoom = false;
    }, 1000);
};

function resetGameBackground() {
    ships = [];
    bullets = [];
    particles = [];
    asteroids = [];
    floatingTexts = [];
    powerups = [];
}

let bullets = [];
let particles = [];
let asteroids = [];
let ships = [];
let idGen = 2;
const playerId = 1;

/* [MOVED] Photon マルチプレイ通信 -> network/photon.js */
/* [MOVED] -> entities/bullet_effect.js */
/* [MOVED] -> core/update.js */

/* [MOVED] -> core/render.js */
/* [MOVED] -> core/helpers.js */
/* [MOVED] -> core/loop.js */
/* [MOVED] -> ui/main_ui.js */
/* ========== タブ離脱時の音楽停止 ========== */
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // タブ非アクティブ → BGM一時停止
        if (bgmAudio && !bgmAudio.paused) bgmAudio.pause();
        if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
    } else {
        // タブ復帰 → BGM再開
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        if (bgmAudio && bgmAudio.paused) bgmAudio.play().catch(() => { });
    }
});

/* ニックネーム、モード選択のロジック */
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");
const rankingModal = document.getElementById("rankingModal");
const closeRankingBtn = document.getElementById("closeRankingBtn");
const nicknameModalTitle = document.getElementById("nicknameModalTitle");
const nicknameModalDesc = document.getElementById("nicknameModalDesc");

function checkAndSetNickname() {
    const nickname = localStorage.getItem("playerNickname_v1");
    if (!nickname) {
        running = false;
        nicknameModal.style.display = "block";
        nicknameInput.focus();
    } else {
        running = false;
        document.getElementById("modeSelectModal").style.display = "block";
    }
}
saveNicknameBtn?.addEventListener("click", async () => {
    const name = nicknameInput.value.trim();
    if (name && name.length > 0) {
        saveNicknameBtn.disabled = true;
        saveNicknameBtn.innerText = "確認中...";
        try {
            const isAnon = window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.isAnonymous;
            const currentUid = window.firebaseAuth && window.firebaseAuth.currentUser ? window.firebaseAuth.currentUser.uid : null;
            if (window.checkNicknameUnique) {
                const currentLocalName = localStorage.getItem("playerNickname_v1");
                const isSameAsLocal = (name === currentLocalName && currentLocalName);
                const result = isSameAsLocal ? { unique: true } : await window.checkNicknameUnique(name, currentUid);
                if (!result.unique) {
                    const errContainer = document.getElementById("nicknameErrorContainer");
                    const errMsg = document.getElementById("nicknameErrorMessage");
                    const loginBtn = document.getElementById("nicknameLoginBtn");
                    
                    if (isAnon) {
                        errMsg.style.color = "#ffaa00"; 
                        errMsg.style.textShadow = "0 0 5px rgba(255,170,0,0.5)";
                        errMsg.innerText = "このコールサインは登録済みです。\nあなたのデータですか？";
                        loginBtn.style.display = "inline-block";
                    } else {
                        errMsg.style.color = "#ff0055"; 
                        errMsg.style.textShadow = "0 0 5px rgba(255,0,85,0.5)";
                        errMsg.innerText = "既に使用されています。\n別の名前を入力してください。";
                        loginBtn.style.display = "none";
                    }

                    if (errContainer) {
                        errContainer.style.maxHeight = "100px";
                        errContainer.style.opacity = "1";
                    }
                    saveNicknameBtn.disabled = false;
                    saveNicknameBtn.innerText = "システム起動";
                    return;
                }
            }
        } catch(e) {
            console.error(e);
            const errContainer = document.getElementById("nicknameErrorContainer");
            const errMsg = document.getElementById("nicknameErrorMessage");
            if (errMsg && errContainer) {
                errMsg.style.color = "#ffaa00";
                errMsg.innerText = "通信エラーか予期せぬエラーが発生しました。\n再試行してください。(" + (e.message || "Unknown error") + ")";
                errContainer.style.maxHeight = "100px";
                errContainer.style.opacity = "1";
            }
            saveNicknameBtn.disabled = false;
            saveNicknameBtn.innerText = "システム起動";
            return;
        }
        
        saveNicknameBtn.disabled = false;
        saveNicknameBtn.innerText = "システム起動";

        localStorage.setItem("playerNickname_v1", name);
        
        const currentUid = window.firebaseAuth && window.firebaseAuth.currentUser ? window.firebaseAuth.currentUser.uid : null;
        if (window.updateNicknameOnServer && currentUid) {
            window.updateNicknameOnServer(name, currentUid).catch(e => console.warn(e));
        }

        nicknameModal.style.display = "none";
        if (!gameOverMode) {
            document.getElementById("modeSelectModal").style.display = "block";
        }
    } else {
        window.gameAlert("コールサインを入力してください。", "INPUT ERROR");
    }
});
nicknameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        saveNicknameBtn.click();
    }
});
nicknameInput?.addEventListener("input", () => {
    const errContainer = document.getElementById("nicknameErrorContainer");
    if (errContainer && errContainer.style.opacity !== "0") {
        errContainer.style.maxHeight = "0";
        errContainer.style.opacity = "0";
    }
});
const nicknameLoginBtn = document.getElementById("nicknameLoginBtn");
nicknameLoginBtn?.addEventListener("click", () => {
    nicknameModal.style.display = "none";
    if (window.openAuthModal) {
        window.openAuthModal();
    }
});
closeRankingBtn?.addEventListener("click", () => {
    rankingModal.style.display = "none";
    if (!gameOverMode) {
        document.getElementById("modeSelectModal").style.display = "block";
    } else {
        if (running && isPaused) setPauseState(false);
    }
});
document.getElementById("closeCheatWarningBtn")?.addEventListener("click", () => {
    document.getElementById("cheatWarningModal").style.display = "none";
    document.getElementById("modeSelectModal").style.display = "block";
    running = false;
    gameOverMode = false;
    isPaused = false;
    matchEnded = false;
    resetGameBackground();
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});
changeNicknameBtn?.addEventListener("click", () => {
    document.getElementById("pauseSettingsView").style.display = "none";
    document.getElementById("pauseSettingsMenu").style.display = "none";
    nicknameModal.style.display = "block";
    nicknameModalTitle.textContent = "PILOT RE-REGISTRATION";
    nicknameModalDesc.textContent = "新しいコールサインを入力してください";
    nicknameInput.value = localStorage.getItem("playerNickname_v1") || "";
    nicknameInput.focus();
});
function applyBgmVolume() {
    const vol = parseFloat(bgmVolumeSlider.value);
    audioSettings.bgm = vol;
    if (bgmGainNode) bgmGainNode.gain.value = vol;
    if (bgmAudio) bgmAudio.volume = vol;
    saveAudioSettings(audioSettings.sfx, audioSettings.bgm, audioSettings.boostSound, audioSettings.warpBass);
}
function applySfxVolume() {
    const vol = parseFloat(sfxVolumeSlider.value);
    audioSettings.sfx = vol;
    if (sfxGain) sfxGain.gain.value = vol;
    saveAudioSettings(audioSettings.sfx, audioSettings.bgm, audioSettings.boostSound, audioSettings.warpBass);
}
bgmVolumeSlider?.addEventListener("input", applyBgmVolume);
bgmVolumeSlider?.addEventListener("change", applyBgmVolume);
bgmVolumeSlider?.addEventListener("touchmove", applyBgmVolume);
sfxVolumeSlider?.addEventListener("input", applySfxVolume);
sfxVolumeSlider?.addEventListener("change", applySfxVolume);
sfxVolumeSlider?.addEventListener("touchmove", applySfxVolume);

// モード選択ボタンの制御
document
    .getElementById("btnSinglePlayer")
    ?.addEventListener("click", () => {
        document.getElementById("modeSelectModal").style.display = "none";
        document.getElementById("difficultyModal").style.display = "block";
    });
document
    .getElementById("btnMultiPlayer")
    ?.addEventListener("click", () => {
        if (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.isAnonymous) {
            window.gameAlert("マルチプレイを遊ぶにはアカウント登録（データバックアップ）が必要です。", "ACCOUNT REQUIRED").then(() => {
                if (window.openAuthModal) window.openAuthModal();
            });
            return;
        }
        document.getElementById("modeSelectModal").style.display = "none";
        document.getElementById("lobbyModal").style.display = "block";
        if (window.subscribeRooms) window.subscribeRooms();
    });
document
    .getElementById("btnShowRanking")
    ?.addEventListener("click", () => {
        document.getElementById("modeSelectModal").style.display = "none";
        document.getElementById("rankingModal").style.display = "block";
        window._rankingDifficulty = "normal";
        updateRankingTabs();
        if (window.fetchTopRanks)
            window.fetchTopRanks("normal").then(displayRanking);
    });
document
    .getElementById("btnBackToMode")
    ?.addEventListener("click", () => {
        document.getElementById("lobbyModal").style.display = "none";
        document.getElementById("modeSelectModal").style.display = "block";
        if (window.unsubscribeRooms) window.unsubscribeRooms();
    });
document
    .getElementById("btnResultToHome")
    ?.addEventListener("click", () => {
        document.getElementById("resultModal").style.display = "none";
        window.leaveMultiplayerRoom();
    });

// ルーム待機室ボタン
document.getElementById("btnLeaveRoom")?.addEventListener("click", () => {
    window.leaveMultiplayerRoom();
});

document.getElementById("btnStartGame")?.addEventListener("click", () => {
    if (minecraftMode && controlMode === "mouse" && !isMobileDevice) {
        try { canvas.requestPointerLock(); } catch (e) { }
    }
    if (photonClient && photonClient.isJoinedToRoom()) {
        photonClient.raiseEvent(4, window.currentRoomSettings, {
            receivers: Photon.LoadBalancing.Constants.ReceiverGroup.All,
        });
        if (window.currentRoomDocId && window.updateFirestoreRoomStatus)
            window.updateFirestoreRoomStatus(window.currentRoomDocId);
    }
});

/* 初期化処理 */

// 難易度ボタンイベント
function startWithDifficulty(diff) {
    if (minecraftMode && controlMode === "mouse" && !isMobileDevice) {
        try { canvas.requestPointerLock(); } catch (e) { }
    }
    window.currentDifficulty = diff;
    document.getElementById("difficultyModal").style.display = "none";
    startSinglePlayerCountdown();
}
document
    .getElementById("btnEasy")
    ?.addEventListener("click", () => startWithDifficulty("easy"));
document
    .getElementById("btnNormal")
    ?.addEventListener("click", () => startWithDifficulty("normal"));
document
    .getElementById("btnHard")
    ?.addEventListener("click", () => startWithDifficulty("hard"));
document
    .getElementById("btnBackFromDifficulty")
    ?.addEventListener("click", () => {
        document.getElementById("difficultyModal").style.display = "none";
        document.getElementById("modeSelectModal").style.display = "block";
    });

// ランキングタブ切替
const RANK_TAB_COLORS = {
    easy: "#00ff66",
    normal: "#00f0ff",
    hard: "#ff0055",
};
function updateRankingTabs() {
    document.querySelectorAll(".rank-tab").forEach((tab) => {
        const isActive = tab.dataset.diff === window._rankingDifficulty;
        tab.classList.toggle("rank-tab-active", isActive);
        tab.style.borderBottom = isActive
            ? `2px solid ${RANK_TAB_COLORS[tab.dataset.diff]}`
            : "none";
    });
}
document.querySelectorAll(".rank-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        window._rankingDifficulty = tab.dataset.diff;
        updateRankingTabs();
        document.getElementById("rankingList").innerHTML =
            "ランキング取得中...";
        if (window.fetchTopRanks)
            window.fetchTopRanks(tab.dataset.diff).then(displayRanking);
    });
});

/* [MOVED] 開発・テストプレイ用ツール -> ui/devmode.js */
/* ========== スタート画面 ========== */
(function initStartScreen() {
    const startScreen = document.getElementById("startScreen");
    if (!startScreen) { checkAndSetNickname(); requestAnimationFrame(frame); return; }

    // バージョン表示
    const svEl = document.getElementById("startVersionText");
    if (svEl) svEl.textContent = "v" + GAME_VERSION;

    // デバイス判定でテキスト切替
    const actionText = document.getElementById("startActionText");
    if (actionText) {
        actionText.textContent = isMobileDevice ? "TAP TO START" : "CLICK TO START";
    }

    // 星空アニメーション
    const starCanvas = document.getElementById("startStarCanvas");
    if (starCanvas) {
        const sCtx = starCanvas.getContext("2d");
        const stars = [];
        const STAR_COUNT = 200;

        function resizeStarCanvas() {
            const oldW = starCanvas.width || 1;
            const oldH = starCanvas.height || 1;
            starCanvas.width = window.innerWidth;
            starCanvas.height = window.innerHeight;
            // Rescale existing star positions so they don't stretch on orientation changes
            if (stars.length > 0) {
                const scaleX = starCanvas.width / oldW;
                const scaleY = starCanvas.height / oldH;
                for (const s of stars) {
                    s.x *= scaleX;
                    s.y *= scaleY;
                }
            }
        }
        resizeStarCanvas();
        window.addEventListener("resize", resizeStarCanvas);

        for (let i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * starCanvas.width,
                y: Math.random() * starCanvas.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1,
                alpha: Math.random() * 0.8 + 0.2,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinklePhase: Math.random() * Math.PI * 2,
            });
        }

        // ==========================================
        // クリック/タップでスタート（シンプルなフェードアウト）
        // ==========================================
        let startTriggered = false;

        function handleStart(e) {
            if (startTriggered) return;
            startTriggered = true;

            enableAudioGlobally();

            // スタート画面全体をCSSアニメーションで自然にフェードアウト
            startScreen.classList.add("start-hidden");

            // 0.85秒（フェードアウトの完了）を待ってから次の画面へ
            setTimeout(() => {
                if (startScreen._cleanupStars) startScreen._cleanupStars();
                startScreen.style.display = "none";
                checkAndSetNickname();
            }, 850);
        }

        startScreen.addEventListener("click", handleStart);
        startScreen.addEventListener("touchend", (e) => {
            e.preventDefault();
            handleStart(e);
        });

        let startAnimId = null;
        function animateStars() {
            // 残像効果
            const trailAlpha = startTriggered ? 0.3 : 1.0;
            sCtx.fillStyle = `rgba(3, 5, 15, ${trailAlpha})`;
            sCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);

            const t = performance.now() * 0.001;

            // 平常時の星空描画
            for (const s of stars) {
                s.y -= s.speed;
                if (s.y < -5) {
                    s.y = starCanvas.height + 5;
                    s.x = Math.random() * starCanvas.width;
                }
                const twinkle = Math.sin(t * s.twinkleSpeed * 60 + s.twinklePhase) * 0.3 + 0.7;
                const a = s.alpha * twinkle;
                const blue = Math.floor(200 + s.size * 20);
                sCtx.fillStyle = `rgba(${180 + Math.floor(s.size * 30)}, ${200 + Math.floor(s.size * 20)}, ${blue}, ${a})`;
                sCtx.beginPath();
                sCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                sCtx.fill();
                if (s.size > 1.5) {
                    sCtx.fillStyle = `rgba(0, 240, 255, ${a * 0.15})`;
                    sCtx.beginPath();
                    sCtx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
                    sCtx.fill();
                }
            }

            startAnimId = requestAnimationFrame(animateStars);
        }
        animateStars();

        // クリーンアップ用
        startScreen._cleanupStars = function () {
            if (startAnimId) cancelAnimationFrame(startAnimId);
            window.removeEventListener("resize", resizeStarCanvas);
        };
    } // End of if (starCanvas)

    // ===============================================
    // 重要！！！ここを消してはいけなかった！！！
    // ゲーム描画本体のループ起動を確保（黒画面バグの修正）
    // ===============================================
    requestAnimationFrame(frame);

})();

/* [MOVED] UI レイアウトエディター -> ui/layout_editor.js */
/* [MOVED] カスタムアラート・確認ダイアログ -> ui/alert.js */
/* [MOVED] Firebase Auth / Account Linkage -> ui/auth.js */