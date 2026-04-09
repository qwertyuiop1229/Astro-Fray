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
function isTyping() {
    const el = document.activeElement;
    return (
        el &&
        (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "NUMBER")
    );
}

/* ========== キー設定 ========== */
const defaultKeyBindings = {
    turnLeft: ["a", "arrowleft"],
    turnRight: ["d", "arrowright"],
    thrust: ["w", "arrowup"],
    brake: ["s", "arrowdown"],
    shoot: [" "],
    boost: ["shift"],
    rollLeft: ["q"],
    rollRight: ["e"],
    pause: ["p"],
    restart: ["r"],
    help: ["h"],
};
function loadKeyBindings() {
    try {
        const raw = localStorage.getItem("keyBindings_v1");
        if (!raw) return JSON.parse(JSON.stringify(defaultKeyBindings));
        const obj = JSON.parse(raw);
        for (const k in defaultKeyBindings) {
            if (!obj[k])
                obj[k] = JSON.parse(JSON.stringify(defaultKeyBindings[k]));
        }
        return obj;
    } catch (e) {
        return JSON.parse(JSON.stringify(defaultKeyBindings));
    }
}
function saveKeyBindings(kb) {
    localStorage.setItem("keyBindings_v1", JSON.stringify(kb));
}
let keyBindings = loadKeyBindings();
const norm = (k) =>
    k === undefined || k === null ? "" : String(k).toLowerCase();
function asArray(b) {
    return Array.isArray(b) ? b.map(norm) : [norm(b)];
}
function isAnyPressedForBind(bind) {
    for (const kk of asArray(bind)) if (keys[kk]) return true;
    return false;
}
function matchKeyToBind(k, bind) {
    return asArray(bind).includes(norm(k));
}
function prettyKey(k) {
    k = norm(k);
    if (k === " ") return "Space";
    if (k.startsWith("arrow")) {
        if (k === "arrowup") return "↑";
        if (k === "arrowdown") return "↓";
        if (k === "arrowleft") return "←";
        if (k === "arrowright") return "→";
    }
    if (k.length === 1) return k.toUpperCase();
    return k.charAt(0).toUpperCase() + k.slice(1);
}
function displayBind(bind) {
    return asArray(bind).map(prettyKey).join(" / ");
}

/* ========== オーディオ ========== */
let audioCtx = null;
let sfxGain = null;
let musicGain = null;
let bgmAudio = null;
let boostGain = null;
let bgmGainNode = null;
let bgmSource = null;
function loadAudioSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem("audioSettings_v1"));
        if (settings)
            return {
                sfx: typeof settings.sfx === "number" ? settings.sfx : 0.4,
                bgm: typeof settings.bgm === "number" ? settings.bgm : 0.3,
                boostSound: typeof settings.boostSound === "boolean" ? settings.boostSound : false,
                warpBass: typeof settings.warpBass === "boolean" ? settings.warpBass : false,
            };
    } catch (e) { }
    return { sfx: 0.4, bgm: 0.3, boostSound: false, warpBass: false };
}
function saveAudioSettings(sfxVol, bgmVol, boostSoundFlag, warpBassFlag) {
    localStorage.setItem(
        "audioSettings_v1",
        JSON.stringify({
            sfx: sfxVol,
            bgm: bgmVol,
            boostSound: boostSoundFlag,
            warpBass: warpBassFlag,
        }),
    );
}
let audioSettings = loadAudioSettings();

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = audioSettings.sfx;
    sfxGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.04;
    musicGain.connect(audioCtx.destination);
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.value = audioSettings.bgm;
    bgmGainNode.connect(audioCtx.destination);

    // BGMシンセサイザ初期化
    const oscA = audioCtx.createOscillator();
    oscA.type = "sine";
    oscA.frequency.value = 60;
    const oscB = audioCtx.createOscillator();
    oscB.type = "triangle";
    oscB.frequency.value = 110;
    const gA = audioCtx.createGain();
    gA.gain.value = 0.32;
    const gB = audioCtx.createGain();
    gB.gain.value = 0.08;
    oscA.connect(gA);
    gA.connect(musicGain);
    oscB.connect(gB);
    gB.connect(musicGain);
    oscA.start();
    oscB.start();
    const lfo = audioCtx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.04;
    const lfoG = audioCtx.createGain();
    lfoG.gain.value = 30;
    lfo.connect(lfoG);
    lfoG.connect(oscA.frequency);
    lfo.start();

    // ブーストサウンド用ノイズジェネレーター
    if (!boostGain) {
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(
            1,
            bufferSize,
            audioCtx.sampleRate,
        );
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        noiseSrc.loop = true;

        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.value = 120; // 低い周波数で「ゴゴゴゴ」感を出す
        noiseFilter.Q.value = 2.0;

        boostGain = audioCtx.createGain();
        boostGain.gain.value = 0;

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(boostGain);
        boostGain.connect(sfxGain);

        noiseSrc.start();
    }

    if (!bgmAudio) {
        bgmAudio = new Audio();
        // モバイルなどでの初回タッチによる再生ブロック解除用の無音WAV
        bgmAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        bgmAudio.loop = true;
        try {
            bgmSource = audioCtx.createMediaElementSource(bgmAudio);
            bgmSource.connect(bgmGainNode);
        } catch (e) { }
    }

    let bgmAudioList = { title: [], battle: [] };
    fetch("oto/audio-list.json")
        .then(r => r.json())
        .then(list => {
            bgmAudioList = list;
            if (window._currentBgmReq === "battle") {
                if (typeof window.playBattleBGM === "function") window.playBattleBGM();
            } else if (window._currentBgmReq === "title") {
                if (typeof window.playTitleBGM === "function") window.playTitleBGM();
            }
        })
        .catch(e => console.warn("Audio list load skipped or failed.", e));

    let currentBgmMode = null;
    let battleBgmQueue = [];

    window._currentBgmReq = "title";

    function shuffleArray(arr) {
        let a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    let fadeTimeout = null;
    function fadeMusicOut(callback) {
        if (fadeTimeout) {
            clearTimeout(fadeTimeout);
            fadeTimeout = null;
        }
        if (!bgmGainNode || !audioCtx || !bgmAudio || bgmAudio.paused) {
            if (bgmGainNode && audioCtx) {
                bgmGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
                bgmGainNode.gain.setValueAtTime(audioSettings.bgm, audioCtx.currentTime);
            }
            if (callback) callback();
            return;
        }
        const now = audioCtx.currentTime;
        const vol = bgmGainNode.gain.value;
        bgmGainNode.gain.cancelScheduledValues(now);
        bgmGainNode.gain.setValueAtTime(vol, now);
        bgmGainNode.gain.linearRampToValueAtTime(0, now + 1.2);

        fadeTimeout = setTimeout(() => {
            fadeTimeout = null;
            bgmAudio.pause();
            bgmGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            bgmGainNode.gain.setValueAtTime(0, audioCtx.currentTime); // 完全にミュート状態を維持
            if (callback) callback();
        }, 1250);
    }

    window.playTitleBGM = function () {
        window._currentBgmReq = "title";
        if (!audioCtx || audioCtx.state === "suspended") return;
        if (!bgmAudioList.title || bgmAudioList.title.length === 0) {
            currentBgmMode = null;
            return;
        }
        if (currentBgmMode === "title") return;
        currentBgmMode = "title";

        fadeMusicOut(() => {
            if (currentBgmMode !== "title") return;
            bgmAudio.src = bgmAudioList.title[0];
            bgmAudio.loop = true;
            bgmAudio.onended = null;
            bgmGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
            bgmGainNode.gain.setValueAtTime(audioSettings.bgm, audioCtx.currentTime);
            bgmAudio.play().catch(e => { });
        });
    };

    window.playBattleBGM = function () {
        window._currentBgmReq = "battle";
        if (!audioCtx || audioCtx.state === "suspended") return;
        if (!bgmAudioList.battle || bgmAudioList.battle.length === 0) {
            currentBgmMode = null;
            return;
        }
        if (currentBgmMode === "battle") return;
        currentBgmMode = "battle";

        fadeMusicOut(() => {
            if (currentBgmMode !== "battle") return;
            battleBgmQueue = shuffleArray(bgmAudioList.battle);
            let idx = 0;

            function playNext() {
                if (currentBgmMode !== "battle") return;
                if (idx >= battleBgmQueue.length) {
                    battleBgmQueue = shuffleArray(bgmAudioList.battle);
                    idx = 0;
                }
                bgmAudio.src = battleBgmQueue[idx++];
                // 終わったら次を再生（1曲ごとに）
                bgmAudio.loop = false;
                bgmGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
                bgmGainNode.gain.setValueAtTime(audioSettings.bgm, audioCtx.currentTime);
                bgmAudio.play().catch(e => { });
            }

            bgmAudio.onended = () => {
                setTimeout(playNext, 2000);
            };
            playNext();
        });
    };

    window.stopBGM = function () {
        currentBgmMode = null;
        fadeMusicOut();
    };

    // AudioContextが既に動いていたら初期状態でタイトルBGMを鳴らす
    if (audioCtx.state === "running") {
        if (typeof window.playTitleBGM === "function") window.playTitleBGM();
    }
}

// --- UI効果音 (2種類: 通常クリック / 戻る) ---
// オーディオが未初期化でもボタンクリック時に初期化して即再生する
function playClickSound() {
    if (!audioCtx) { enableAudioGlobally(); }
    if (!audioCtx || audioCtx.state === "suspended") {
        if (audioCtx) audioCtx.resume().catch(() => { });
        return;
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.setValueAtTime(950, now + 0.015);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(2.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.04);
}

function playCancelSound() {
    if (!audioCtx) { enableAudioGlobally(); }
    if (!audioCtx || audioCtx.state === "suspended") {
        if (audioCtx) audioCtx.resume().catch(() => { });
        return;
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(2.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
}

// 全てのボタンにクリック音を委譲で追加
document.addEventListener("mousedown", (e) => {
    if (!(e.target.closest("button") || e.target.closest(".toggle") ||
        e.target.closest(".team-btn") || e.target.closest('input[type="checkbox"]'))) return;
    // ボタンクリック時にオーディオが未初期化なら初期化する
    enableAudioGlobally();
    const btn = e.target.closest("button");
    // 戻る・閉じるボタンだけ別音
    if (btn && (
        btn.id === "btnBack" || btn.id === "btnBackToTitle" ||
        btn.id === "btnResultToHome" || btn.id === "btnLeaveMultiplayer" ||
        btn.id === "btnLeaveSingleplayer" || btn.id === "btnCancelCreateRoom" ||
        btn.id === "btnLeaveRoom" || btn.id === "leBtnClose" ||
        btn.id === "btnDismissLandscape" || btn.id === "btnBackToPauseMain" ||
        btn.id === "btnBackFromDifficulty" ||
        btn.classList.contains("btn-red")
    )) {
        playCancelSound();
        return;
    }
    playClickSound();
});

function playLaserSound(x, y) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // 距離による音量減衰を計算
    let volMod = 1.0;
    if (x !== undefined && y !== undefined) {
        const p = ships.find((s) => s.id === playerId);
        if (p && !p.isGhost) {
            // 自機が生きている場合のみ相対距離で計算
            const d = Math.sqrt(torusDist2(x, y, p.x, p.y));
            // 距離減衰カーブを極端に（近くは大きく、遠くは急激にかすかな音に）
            volMod = 1.0 / (1.0 + Math.pow(d / 200, 3));
        }
    }
    // 完全に遠すぎる場合は鳴らさない
    if (volMod < 0.01) return;

    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    // 基本の音量も少し大きめに確保しつつ、距離による減衰をかける
    g.gain.exponentialRampToValueAtTime(
        Math.max(0.15 * volMod, 0.0001),
        now + 0.01,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
}
function playExplosionSound(size = "medium") {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const len = size === "large" ? 1.5 : 0.9;
    const buf = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * len,
        audioCtx.sampleRate,
    );
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
        d[i] =
            (Math.random() * 2 - 1) *
            (1 - i / d.length) *
            (Math.random() * 0.8 + 0.2);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const flt = audioCtx.createBiquadFilter();
    flt.type = "bandpass";
    // 機体爆発時(large)は周波数を低くして「ドカーン」という重低音に
    flt.frequency.setValueAtTime(size === "large" ? 400 : 1800, now);
    flt.Q.value = 0.9;
    flt.frequency.exponentialRampToValueAtTime(150, now + len * 0.7);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    // largeの時のゲイン(音量)を大幅に上げて他の音にかき消されないようにする
    g.gain.exponentialRampToValueAtTime(
        size === "large" ? 3.5 : 1.2,
        now + 0.02,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    src.start(now);
    src.stop(now + len);
}
function playPowerUpSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    osc.frequency.setValueAtTime(800, now + 0.2);
    osc.frequency.setValueAtTime(1200, now + 0.3);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.5);
}

/* ========== 初期化コントロール ========== */
// PCはデフォルトでエイムマウス同期(mouse)、スマホは最初からタッチUI使用
let defaultControlMode = "mouse";

let controlMode = localStorage.getItem("controlMode_v1") || defaultControlMode;
let minecraftMode = localStorage.getItem("minecraftMode_v1") === "1";
let minecraftSensitivity = parseFloat(localStorage.getItem("minecraftSensitivity_v1") || "5");
// デバイス判定: navigator.userAgentData (高精度) → UA文字列 → タッチ機能のフォールバック
const isMobileDevice = (() => {
    // 1. navigator.userAgentData が使える場合（Chrome 90+ 等）
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
        return navigator.userAgentData.mobile;
    }
    // 2. UA文字列 + タッチ機能で判定
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
    ) ||
        ("ontouchstart" in window && navigator.maxTouchPoints > 0 &&
            !/Windows NT/i.test(navigator.userAgent));
})();
let forceTouchUI_saved = localStorage.getItem("forceTouchUI_v1");
let useTouchUI =
    forceTouchUI_saved !== null
        ? forceTouchUI_saved === "1"
        : isMobileDevice; // スマホ初期値=表示、PC初期値=非表示

const audioHint = document.getElementById("audioHint");

// 画面のどこかをクリック/キー入力した段階で即座にオーディオを有効化する
function enableAudioGlobally() {
    if (!audioCtx) initAudio();

    // ユーザー操作の同期コールスタック内で直接playを呼ぶことでSafariの制限を解除する
    if (bgmAudio && bgmAudio.paused) {
        let p = bgmAudio.play();
        if (p && p.catch) p.catch(() => { });
    }

    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().then(() => {
            if (window._currentBgmReq === "battle" && typeof window.playBattleBGM === "function") window.playBattleBGM();
            else if (window._currentBgmReq === "title" && typeof window.playTitleBGM === "function") window.playTitleBGM();
        }).catch(() => { });
    } else if (audioCtx && audioCtx.state === "running") {
        if (window._currentBgmReq === "battle" && typeof window.playBattleBGM === "function") window.playBattleBGM();
        else if (window._currentBgmReq === "title" && typeof window.playTitleBGM === "function") window.playTitleBGM();
    }
}
window.addEventListener("mousedown", () => {
    enableAudioGlobally();
    audioHint.style.display = "none";
});
window.addEventListener(
    "touchstart",
    () => {
        enableAudioGlobally();
        audioHint.style.display = "none";
    },
    { passive: true },
);
window.addEventListener("keydown", () => {
    enableAudioGlobally();
    audioHint.style.display = "none";
});

function resumeAudioOnFirstGesture() {
    // すでにオーディオが有効化されていればヒントは表示しない
    if (audioCtx && audioCtx.state === "running") {
        audioHint.style.display = "none";
        return;
    }
    audioHint.style.display = "block";
}

/* ========== 画面トランジション ========== */
const _fadeOverlay = document.getElementById("screenFadeOverlay");
function screenFadeOut(duration, color, callback) {
    if (typeof color === "function") {
        callback = color;
        color = "#050510"; // デフォルトは暗転
    }
    if (!_fadeOverlay) { if (callback) callback(); return; }
    _fadeOverlay.style.pointerEvents = 'all'; // 演出中はクリック・タップをすべてブロックする
    _fadeOverlay.style.transition = 'none';
    _fadeOverlay.style.opacity = '0';
    _fadeOverlay.style.backgroundColor = color || "#050510";
    _fadeOverlay.offsetHeight; // reflow
    _fadeOverlay.style.transition = 'opacity ' + duration + 'ms ease-in';
    _fadeOverlay.style.opacity = '1';
    setTimeout(() => { if (callback) callback(); }, duration);
}
function screenFadeIn(duration, delay) {
    if (!_fadeOverlay) return;
    setTimeout(() => {
        _fadeOverlay.style.transition = 'opacity ' + duration + 'ms ease-out';
        _fadeOverlay.style.opacity = '0';
        setTimeout(() => {
            _fadeOverlay.style.pointerEvents = 'none'; // フェードイン完了後にブロック解除
        }, duration);
    }, delay || 0);
}

// 超光速ワームホール（ハイパースペース）トランジション
function playWarpTransition(callback) {
    const overlay = document.getElementById("warpTransitionOverlay");
    const canvas = document.getElementById("warpStarCanvas");
    if (!overlay || !canvas) {
        screenFadeOut(1200, "#ffffff", () => {
            screenFadeIn(1200, 0);
            if (callback) callback();
        });
        return;
    }

    // アクティブなUI要素（モーダルなど）をゆっくりフェードアウトさせる
    const activeModals = document.querySelectorAll('.setting-modal[style*="display: block"], .setting-modal[style*="display: flex"], #modeSelectModal[style*="display: block"], #roomWaitModal[style*="display: flex"]');
    activeModals.forEach(el => {
        el.style.transition = "opacity 0.6s ease-in-out";
        el.style.opacity = "0";
        setTimeout(() => {
            el.style.display = "none";
            el.style.opacity = "1";
        }, 600);
    });

    // ワープ空間（オーバーレイ）をUIのフェードアウトと同時にクロスフェードで表示する
    overlay.style.opacity = "0";
    overlay.style.display = "block";
    overlay.style.backgroundColor = "transparent"; // 背後の星空の上にワープを重ねる
    overlay.offsetHeight;
    overlay.style.transition = "opacity 0.6s ease-in-out";
    overlay.style.opacity = "1";

    const ctx = canvas.getContext("2d", { alpha: false });
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let cx = w / 2;
    let cy = h / 2;

    window.addEventListener("resize", () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w / 2;
        cy = h / 2;
    });

    const particles = [];
    const PARTICLE_COUNT = 400;
    const rings = [];
    let animationId;
    let startTime = performance.now();
    const DURATION = 2800; // アニメーション全体の長さ

    // パーティクル（星・光の筋）初期化
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: (Math.random() - 0.5) * w,
            y: (Math.random() - 0.5) * h,
            z: Math.random() * 1000 + 100, // Z深度
            prevZ: 0,
            baseColor: Math.random() > 0.5 ? [0, 240, 255] : [255, 255, 255],
            size: Math.random() * 2 + 0.5
        });
    }

    // トンネル（3Dリング）初期化
    for (let i = 0; i < 20; i++) {
        rings.push({
            z: i * 150,
            radius: 800 + Math.random() * 200,
            sides: 6 + Math.floor(Math.random() * 4),
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.05
        });
    }

    startTime = performance.now();

    // オーディオ演出（没入感のある重低音＋加速シンセ）
    if (audioCtx && audioCtx.state !== "suspended") {
        const now = audioCtx.currentTime;

        // 全てのワープサウンドは設定でONのときのみ鳴る
        if (audioSettings.warpBass) {
            // 低音のうなり（ベース）
            const oscBase = audioCtx.createOscillator();
            oscBase.type = "sine";
            oscBase.frequency.setValueAtTime(40, now);
            oscBase.frequency.exponentialRampToValueAtTime(150, now + 1.5);
            const gainBase = audioCtx.createGain();
            gainBase.gain.setValueAtTime(0, now);
            gainBase.gain.linearRampToValueAtTime(1.2, now + 0.5);
            gainBase.gain.linearRampToValueAtTime(0.01, now + 2.5);
            oscBase.connect(gainBase);
            gainBase.connect(sfxGain);
            oscBase.start(now);
            oscBase.stop(now + 2.6);

            // 加速する高音（シンセ）
            const oscHigh = audioCtx.createOscillator();
            oscHigh.type = "sawtooth";
            oscHigh.frequency.setValueAtTime(100, now + 0.5);
            oscHigh.frequency.exponentialRampToValueAtTime(2000, now + 2.2);
            const gainHigh = audioCtx.createGain();
            gainHigh.gain.setValueAtTime(0, now + 0.5);
            gainHigh.gain.linearRampToValueAtTime(0.8, now + 1.8);
            gainHigh.gain.exponentialRampToValueAtTime(0.01, now + 2.6);

            // フィルターでこもった音から開く演出
            const filter = audioCtx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(200, now + 0.5);
            filter.frequency.exponentialRampToValueAtTime(8000, now + 2.0);

            oscHigh.connect(filter);
            filter.connect(gainHigh);
            gainHigh.connect(sfxGain);
            oscHigh.start(now + 0.5);
            oscHigh.stop(now + 2.7);

            // 爆発音（フラッシュ）
            setTimeout(() => {
                try { playExplosionSound("large"); } catch (e) { }
            }, 2200);
        }
    } // end of audio if

    let isFinished = false;

    // メイン描画ループ
    function render(time) {
        if (isFinished) return;
        const elapsed = time - startTime;
        let progress = Math.min(elapsed / DURATION, 1.0); // 0.0 to 1.0

        // 残像効果のためのクリア
        ctx.fillStyle = `rgba(5, 5, 10, ${0.15 + (1 - progress) * 0.2})`;
        ctx.fillRect(0, 0, w, h);

        // アニメーション進行度による速度変化
        const baseSpeed = 10;
        const speedMultiplier = 1 + Math.pow(progress, 3) * 60; // 指数関数的に加速
        const currentSpeed = baseSpeed * speedMultiplier;

        // グリッチ/フラッシュの強さ
        let flashIntensity = 0;
        let shake = 0;
        if (progress > 0.8) {
            flashIntensity = (progress - 0.8) * 5; // 0 to 1
            shake = flashIntensity * 15;
            // 画面のランダムな揺れ
            if (shake > 0) {
                ctx.save();
                ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
            }
        }

        // カメラ（視界）の中心オフセット
        const camX = cx + Math.sin(time * 0.002) * (50 * progress);
        const camY = cy + Math.cos(time * 0.003) * (50 * progress);

        // トンネル（ワイヤフレーム）の描画
        ctx.lineWidth = 1 + progress * 2;
        const ringZOffset = Math.sin(time * 0.001) * 20;

        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            ring.z -= currentSpeed * 0.5;
            if (ring.z < 10) {
                ring.z = 3000; // 奥へループ再配置
                ring.rotSpeed = (Math.random() - 0.5) * 0.08;
            }
            ring.rotation += ring.rotSpeed * Math.min(progress * 3 + 1, 10);

            // 3D -> 2D投影
            const zRatio = 800 / Math.max(ring.z + ringZOffset, 1);
            if (zRatio < 0) continue; // 後ろにあるものは描画しない

            const r2d = ring.radius * zRatio;
            const alpha = Math.min(1.0, zRatio * 0.5) * (1 - Math.pow((3000 - ring.z) / 3000, 4));

            // 赤/シアンのサイバーカラーへ変化
            const colorR = Math.floor(0 + progress * 255);
            const colorG = Math.floor(240 - progress * 200);
            const colorB = Math.floor(255 - progress * 100);

            ctx.strokeStyle = `rgba(${colorR}, ${colorG}, ${colorB}, ${alpha * (0.1 + progress * 0.5)})`;
            ctx.beginPath();

            for (let s = 0; s <= ring.sides; s++) {
                const angle = ring.rotation + (s / ring.sides) * Math.PI * 2;
                const px = camX + Math.cos(angle) * r2d + (Math.sin(time * 0.005 + ring.z * 0.01) * 30 * progress);
                const py = camY + Math.sin(angle) * r2d + (Math.cos(time * 0.004 + ring.z * 0.01) * 30 * progress);
                if (s === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // パーティクル（ワープ星）の描画
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            p.prevZ = p.z;
            p.z -= currentSpeed;

            if (p.z <= 10) {
                p.x = (Math.random() - 0.5) * w * 2;
                p.y = (Math.random() - 0.5) * h * 2;
                p.z = 2000 + Math.random() * 1000;
                p.prevZ = p.z;
                p.size = Math.random() * 2 + 0.5;
            }

            // 投影
            const scale = 800 / p.z;
            const prevScale = 800 / Math.max(p.prevZ, 1);

            const px = camX + p.x * scale;
            const py = camY + p.y * scale;
            const ppx = camX + p.x * prevScale;
            const ppy = camY + p.y * prevScale;

            // 透過度と色
            const alpha = Math.min(1.0, 1500 / p.z);
            let [r, g, b] = p.baseColor;

            if (progress > 0.5) {
                // 赤方偏移/青方偏移のシミュレーション（手首は赤・オレンジへ）
                r = Math.min(255, r + progress * 100);
                g = Math.max(50, g - progress * 100);
                b = Math.max(50, b - progress * 100);
            }

            ctx.lineWidth = p.size * scale;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ppx, ppy);
            ctx.lineTo(px, py);
            ctx.stroke();

            // フレア
            if (p.size > 2) {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                ctx.beginPath();
                ctx.arc(px, py, p.size * scale * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (shake > 0) ctx.restore(); // 画面揺れリセット

        // グリッチエフェクト (終盤)
        if (flashIntensity > 0.3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity * 0.1})`;
            ctx.fillRect(0, Math.random() * h, w, Math.random() * 50);

            if (Math.random() > 0.7) {
                // 色収差のような横ずれ
                const sliceY = Math.random() * h;
                const sliceH = Math.random() * 100;
                const imgData = ctx.getImageData(0, sliceY, w, sliceH);
                ctx.putImageData(imgData, (Math.random() - 0.5) * 50 * flashIntensity, sliceY);
            }
        }

        // ホワイトアウト
        if (flashIntensity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.pow(flashIntensity, 2)})`;
            ctx.fillRect(0, 0, w, h);
        }

        if (elapsed < DURATION) {
            animationId = requestAnimationFrame(render);
        } else {
            // アニメーション完了
            isFinished = true;
            if (callback) callback();

            // 白フラッシュで抜ける演出 (既存関数を使用)
            screenFadeOut(50, "#ffffff", () => {
                overlay.style.opacity = "0";
                setTimeout(() => {
                    overlay.style.display = "none";
                    ctx.clearRect(0, 0, w, h);
                }, 300);
                screenFadeIn(1200, 0);
            });
        }
    }

    // アニメーション開始
    animationId = requestAnimationFrame(render);
}

/* ========== 基本ユーティリティ ========== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
let WORLD_W = 10000;
let WORLD_H = 10000;
function wrap(value, max) {
    if (value < 0) return value + max;
    if (value >= max) return value - max;
    return value;
}
function torusDelta(ax, ay, bx, by) {
    let dx = ax - bx;
    let dy = ay - by;
    dx = ((dx + WORLD_W / 2) % WORLD_W) - WORLD_W / 2;
    dy = ((dy + WORLD_H / 2) % WORLD_H) - WORLD_H / 2;
    return { dx, dy };
}
function torusDist2(ax, ay, bx, by) {
    const d = torusDelta(ax, ay, bx, by);
    return d.dx * d.dx + d.dy * d.dy;
}
function toScreen(x, y, camX, camY, vw, vh) {
    const d = torusDelta(x, y, camX, camY);
    return { sx: d.dx + vw / 2, sy: d.dy + vh / 2 };
}
function angleLerp(a, b, t) {
    let diff = ((b - a + Math.PI) % TAU) - Math.PI;
    return a + diff * t;
}
function torusLerp(current, target, max, t) {
    let diff = target - current;
    if (diff > max / 2) diff -= max;
    else if (diff < -max / 2) diff += max;
    return wrap(current + diff * t, max);
}

/* ========== チーム・ファクション判定 ========== */
const TEAM_COLORS = {
    1: "#00f0ff",
    2: "#ff0055",
    3: "#00ff66",
    4: "#ffb300",
};
function getMyTeam() {
    return window.isMultiplayer &&
        photonClient &&
        photonClient.isJoinedToRoom()
        ? photonClient.myActor().getCustomProperty("team") || 1
        : 1;
}

function areEnemies(shipA, shipB) {
    if (!shipA || !shipB) return false;
    if (shipA.id === shipB.id) return false;
    // マルチプレイ or テストプレイはチーム番号で判定
    if (window.isMultiplayer || window._testPlayMode)
        return shipA.team !== shipB.team;

    // シングルプレイの場合：プレイヤーと味方AIは同一陣営とする
    const teamA =
        shipA.faction === "player" || shipA.faction === "ally"
            ? "friend"
            : "enemy";
    const teamB =
        shipB.faction === "player" || shipB.faction === "ally"
            ? "friend"
            : "enemy";
    return teamA !== teamB;
}

/* ========== 軽量化・個別設定 ========== */

let lightweightMode = localStorage.getItem("lightweight_v1") === "1";
let PARTICLE_DRAW_LIMIT = lightweightMode ? 80 : 400;
let STAR_LAYERS = lightweightMode ? [0.15, 0.3] : [0.12, 0.3, 0.6];
let DRAW_GLOW = !lightweightMode;
let MINIMAP_ENABLED = !lightweightMode;
let ASTEROID_DRAW_LIMIT = lightweightMode ? 30 : 1000;
let DPR_FORCE_ONE = lightweightMode;
function applyLightweightMode(en) {
    lightweightMode = !!en;
    localStorage.setItem("lightweight_v1", lightweightMode ? "1" : "0");
    PARTICLE_DRAW_LIMIT = lightweightMode ? 80 : 400;
    STAR_LAYERS = lightweightMode ? [0.15, 0.3] : [0.12, 0.3, 0.6];
    DRAW_GLOW = !lightweightMode;
    MINIMAP_ENABLED = !lightweightMode;
    ASTEROID_DRAW_LIMIT = lightweightMode ? 30 : 1000;
    DPR_FORCE_ONE = lightweightMode;
    try {
        if (sfxGain)
            sfxGain.gain.value = lightweightMode
                ? audioSettings.sfx * 0.5
                : audioSettings.sfx;
        if (musicGain) musicGain.gain.value = lightweightMode ? 0.02 : 0.04;
    } catch (e) { }
    resize();
    starCacheNeedsRegen = true;
}
const DEFAULT_FEATURES = {
    stars: true,
    minimap: true,
    particles: true,
    glow: true,
    minimapAsteroids: true,
    damageTextSize: 24,
    showDamage: true,
    enableShake: true,
    shakeIntensity: 1.0,
    aimLine: false,
};
function loadFeatureSettings() {
    try {
        const raw = localStorage.getItem("featureSettings_v1");
        if (!raw) return Object.assign({}, DEFAULT_FEATURES);
        return Object.assign({}, DEFAULT_FEATURES, JSON.parse(raw));
    } catch (e) {
        return Object.assign({}, DEFAULT_FEATURES);
    }
}
function saveFeatureSettings(obj) {
    try {
        localStorage.setItem("featureSettings_v1", JSON.stringify(obj));
    } catch (e) { }
}
let featureSettings = loadFeatureSettings();
let showStars = !!featureSettings.stars;
let showMinimap = !!featureSettings.minimap;
let showParticles = !!featureSettings.particles;
let showGlow = !!featureSettings.glow;
let showMinimapAsteroids = !!featureSettings.minimapAsteroids;
let damageTextBaseSize = 24;
let zoomLevel = parseFloat(localStorage.getItem("zoomLevel_v1")) || 1.0;
let showDamage = featureSettings.showDamage !== false;
let enableShake = featureSettings.enableShake !== false;
let shakeIntensity =
    featureSettings.shakeIntensity !== undefined
        ? featureSettings.shakeIntensity
        : 1.0;
let safeAreaMarginX = featureSettings.safeAreaMarginX !== undefined ? featureSettings.safeAreaMarginX : (featureSettings.safeAreaMargin || 0);
let safeAreaMarginY = featureSettings.safeAreaMarginY !== undefined ? featureSettings.safeAreaMarginY : (featureSettings.safeAreaMargin || 0);
function applyFeatureSettingsToRuntime() {
    showStars = !!featureSettings.stars;
    showMinimap = !!featureSettings.minimap;
    showParticles = !!featureSettings.particles;
    showGlow = !!featureSettings.glow;
    showMinimapAsteroids = !!featureSettings.minimapAsteroids;
    damageTextBaseSize =
        featureSettings.damageTextSize !== undefined
            ? featureSettings.damageTextSize
            : 24;
    showDamage = featureSettings.showDamage !== false;
    enableShake = featureSettings.enableShake !== false;
    shakeIntensity =
        featureSettings.shakeIntensity !== undefined
            ? featureSettings.shakeIntensity
            : 1.0;
    safeAreaMarginX = featureSettings.safeAreaMarginX !== undefined ? featureSettings.safeAreaMarginX : (featureSettings.safeAreaMargin || 0);
    safeAreaMarginY = featureSettings.safeAreaMarginY !== undefined ? featureSettings.safeAreaMarginY : (featureSettings.safeAreaMargin || 0);
    document.documentElement.style.setProperty('--safe-area-extra-x', safeAreaMarginX + 'px');
    document.documentElement.style.setProperty('--safe-area-extra-y', safeAreaMarginY + 'px');
    const safeAreaXValue = document.getElementById("safeAreaXValue");
    if (safeAreaXValue) safeAreaXValue.innerText = safeAreaMarginX + "px";
    const safeAreaYValue = document.getElementById("safeAreaYValue");
    if (safeAreaYValue) safeAreaYValue.innerText = safeAreaMarginY + "px";
}
applyFeatureSettingsToRuntime();

/* ===== UI Layout Manager ===== */
const UILayoutManager = (() => {
    let layoutSettings = {};
    try {
        const raw = localStorage.getItem("uiLayout_v1");
        if (raw) layoutSettings = JSON.parse(raw);
    } catch (e) { }

    const idsToHandle = [
        'btnTouchShoot', 'btnTouchPause', 'btnTouchBoost',
        'btnTouchBrake', 'btnTouchRollLeft', 'btnTouchRollRight',
        'joystickBase'
    ];

    const api = {
        get: (id) => layoutSettings[id] || null,
        set: (id, x, y, s) => {
            layoutSettings[id] = { x, y, s };
        },
        save: () => {
            try {
                localStorage.setItem("uiLayout_v1", JSON.stringify(layoutSettings));
            } catch (e) { }
            api.applyToDOM();
        },
        reset: (id) => {
            delete layoutSettings[id];
            api.save();
        },
        resetAll: () => {
            layoutSettings = {};
            try { localStorage.removeItem("uiLayout_v1"); } catch (e) { }
            api.applyToDOM();
        },
        applyToDOM: () => {
            idsToHandle.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const cfg = layoutSettings[id];
                if (cfg) {
                    el.style.position = 'fixed';
                    el.style.left = cfg.x + 'vw';
                    el.style.top = cfg.y + 'vh';
                    el.style.right = 'auto';
                    el.style.bottom = 'auto';
                    el.style.transform = `translate(-50%, -50%) scale(${cfg.s})`;
                } else {
                    el.style.position = '';
                    el.style.left = '';
                    el.style.top = '';
                    el.style.right = '';
                    el.style.bottom = '';
                    el.style.transform = '';
                }
            });
        }
    };
    return api;
})();

// Canvas UI drawing helper
function getCanvasLayout(id, defX, defY, w = 0, h = 0) {
    const cfg = UILayoutManager.get(id);
    if (!cfg) return { x: defX, y: defY, s: 1 };
    const cw = (canvas.width / dpr);
    const ch = (canvas.height / dpr);
    const centerX = (cfg.x / 100) * cw;
    const centerY = (cfg.y / 100) * ch;
    return { x: centerX - (w * cfg.s) / 2, y: centerY - (h * cfg.s) / 2, s: cfg.s };
}

let cameraShake = 0;
function shakeCamera(amount) {
    if (!enableShake) return;
    amount *= shakeIntensity;
    if (lightweightMode) amount *= 0.5;
    cameraShake = Math.min(cameraShake + amount, 50 * shakeIntensity);
}

class FloatingText {
    constructor(x, y, text, color, life = 1.0, size = 16) {
        this.x = x;
        this.y = y;
        this.vx = rand(-10, 10);
        this.vy = rand(-20, -40);
        this.text = text;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
}
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = rand(-20, 20);
        this.vy = rand(-20, 20);
        this.type = randInt(0, 2);
        this.colors = ["#00ff66", "#00f0ff", "#f0f"];
        this.labels = ["HP回復", "拡散弾", "連射弾"];
        this.color = this.colors[this.type];
        this.life = 10.0;
        this.radius = 12;
        this.rotation = rand(0, TAU);
    }
    update(dt) {
        this.x = wrap(this.x + this.vx * dt, WORLD_W);
        this.y = wrap(this.y + this.vy * dt, WORLD_H);
        this.vx *= 0.99;
        this.vy *= 0.99;
        this.rotation += dt * 2;
        this.life -= dt;
    }
    apply(player) {
        playPowerUpSound();
        let text = this.labels[this.type];
        if (this.type === 0) {
            player.hp = Math.min(player.maxHp, player.hp + 50);
            player.healRing = { life: 0.8, maxLife: 0.8, color: "#00ff66" };
        } else if (this.type === 1) {
            player.weaponType = 1;
            player.weaponStartTime = performance.now();
            player.weaponDuration = 10000;
        } else if (this.type === 2) {
            player.weaponType = 2;
            player.weaponStartTime = performance.now();
            player.weaponDuration = 10000;
        }
        floatingTexts.push(
            new FloatingText(
                this.x,
                this.y,
                text,
                this.color,
                1.5,
                Math.max(14, damageTextBaseSize * 0.9),
            ),
        );
    }
}
function spawnPowerUp(x, y) {
    powerups.push(new PowerUp(x, y));
}
let floatingTexts = [];
let powerups = [];

/* ========== ゲーム状態 ========== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
let dpr = Math.max(1, window.devicePixelRatio || 1);
function resize() {
    dpr = DPR_FORCE_ONE ? 1 : Math.max(1, window.devicePixelRatio || 1);
    const vv = window.visualViewport;
    const w = vv ? vv.width : window.innerWidth;
    const h = vv ? vv.height : window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    starCacheNeedsRegen = true;
    drawSpawnMap();
}
window.addEventListener("resize", resize);
if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
}
let keys = {};
let mouse = { x: 0, y: 0, movementX: 0, movementY: 0, down: false };
let bindingAction = null;

const GAME_VERSION = "1.4.15";
let running = false,
    showHelp = false;
let isPaused = false;
let isSettingsFromHome = false;
let powerupsEnabled = true;
let hasDisconnectedAlertShown = false;
let matchEnded = false;
let matchStartTime = 0;
let isLeavingRoom = false;

function setPauseState(paused) {
    isPaused = paused;
    const pauseMainView = document.getElementById("pauseMainView");
    const pauseSettingsView = document.getElementById("pauseSettingsView");

    if (paused) {
        if (!window.isMultiplayer) running = false;
        if (!isMobileDevice && document.pointerLockElement === canvas) document.exitPointerLock();
        document.getElementById("pauseSettingsMenu").style.display = "block";

        isSettingsFromHome = false;
        pauseMainView.style.display = "block";
        pauseSettingsView.style.display = "none";
        document.getElementById("settingsMenuTitle").innerText = "PAUSE MENU";
        document.getElementById("closePauseSettings").innerText =
            "ゲームに戻る";

        if (window.isMultiplayer) {
            document.getElementById("pauseSubText").style.display = "none";
            document.getElementById("btnLeaveMultiplayer").style.display =
                "inline-block";
            document.getElementById("btnLeaveSingleplayer").style.display =
                "none";
        } else {
            document.getElementById("pauseSubText").style.display = "block";
            document.getElementById("btnLeaveMultiplayer").style.display =
                "none";
            document.getElementById("btnLeaveSingleplayer").style.display =
                "inline-block";
        }
    } else {
        if (!window.isMultiplayer) running = true;
        document.getElementById("pauseSettingsMenu").style.display = "none";
        document.querySelectorAll(".game-modal").forEach((m) => {
            if (
                [
                    "keymapModal",
                    "basicSettingsModal",
                    "audioSettingsModal",
                ].includes(m.id)
            )
                m.style.display = "none";
        });
        if (minecraftMode && controlMode === "mouse" && !isMobileDevice) {
            try { canvas.requestPointerLock(); } catch (e) { }
        }
    }
    updateTouchUIVisibility();
}

window.addEventListener("keydown", (e) => {
    if (isTyping()) return;
    const k = (e.key || "").toLowerCase();
    if (bindingAction) {
        e.preventDefault();
        if (k === "escape") {
            bindingAction = null;
            updateBindingNotice();
            return;
        }
        keyBindings[bindingAction] = [k];
        saveKeyBindings(keyBindings);
        bindingAction = null;
        renderKeymapList();
        updateBindingNotice();
        return;
    }
    keys[k] = true;

    if (matchKeyToBind(k, keyBindings.pause) || k === "escape") {
        e.preventDefault();
        const rOpen = document.getElementById("rankingModal")?.style.display.includes("block");
        const cOpen = document.getElementById("cheatWarningModal")?.style.display.includes("block");
        if (rOpen || cOpen) return;
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
    }


    if (matchKeyToBind(k, keyBindings.help)) {
        showHelp = !showHelp;
        e.preventDefault();
    }
    if (k === "+" || k === ";") {
        zoomLevel = Math.min(zoomLevel + 0.1, 3.0);
        localStorage.setItem("zoomLevel_v1", zoomLevel.toString());
        e.preventDefault();
    }
    if (k === "-") {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.3);
        localStorage.setItem("zoomLevel_v1", zoomLevel.toString());
        e.preventDefault();
    }
});
window.addEventListener("keyup", (e) => {
    if (isTyping()) return;
    keys[(e.key || "").toLowerCase()] = false;
});
window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    if (document.pointerLockElement === canvas) {
        mouse.movementX = (mouse.movementX || 0) + e.movementX;
        mouse.movementY = (mouse.movementY || 0) + e.movementY;
    }
});
window.addEventListener("mousedown", (e) => {
    if (e.target === canvas) {
        mouse.down = true;
        if (minecraftMode && !isPaused && !document.pointerLockElement && controlMode === "mouse" && !isMobileDevice) {
            try { canvas.requestPointerLock(); } catch (e) { }
        }
    }
});
window.addEventListener("mouseup", () => (mouse.down = false));
document.addEventListener("pointerlockchange", () => {
    if (minecraftMode && controlMode === "mouse" && !isMobileDevice) {
        if (document.pointerLockElement !== canvas) {
            if (!isPaused && running && !matchEnded) {
                setPauseState(true);
            }
        }
    }
});
window.addEventListener("wheel", (e) => {
    if (!running || isPaused || matchEnded) return;
    if (e.deltaY < 0) {
        zoomLevel = Math.min(zoomLevel + 0.1, 3.0);
        localStorage.setItem("zoomLevel_v1", zoomLevel.toString());
    } else if (e.deltaY > 0) {
        zoomLevel = Math.max(zoomLevel - 0.1, 0.3);
        localStorage.setItem("zoomLevel_v1", zoomLevel.toString());
    }
});

window.addEventListener("beforeunload", () => {
    if (
        window.isMultiplayer &&
        photonClient &&
        photonClient.isJoinedToRoom()
    ) {
        if (
            window.currentRoomDocId &&
            photonClient.myRoom().masterClientId ===
            photonClient.myActor().actorNr
        ) {
            if (window.deleteFirestoreRoom)
                window.deleteFirestoreRoom(window.currentRoomDocId);
        }
    }
});

/* ========== タッチコントロール実装 ========== */
const touchUI = document.getElementById("touchUI");
const joystickArea = document.getElementById("joystickArea");
const joystickBase = document.getElementById("joystickBase");
const joystickNub = document.getElementById("joystickNub");
let joystickActive = false;
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

function updateTouchUIVisibility() {
    const isGameplayActive = running && !isPaused && !matchEnded;
    const shouldShow = useTouchUI && isGameplayActive;

    const tcm = document.getElementById("toggleControlMode");
    const shootBtn = document.getElementById("btnTouchShoot");

    if (shouldShow) {
        touchUI.style.display = "block";
        controlMode = "touch";
        if (tcm) tcm.style.opacity = "0.5";
        // ゲームオーバー時は射撃ボタンをグレーアウト
        if (shootBtn) {
            if (gameOverMode) {
                shootBtn.classList.add("disabled");
            } else {
                shootBtn.classList.remove("disabled");
            }
        }
    } else {
        touchUI.style.display = "none";
        if (controlMode === "touch" && !isGameplayActive && useTouchUI) {
            // Keep controlMode touch in background
        } else if (controlMode === "touch") {
            controlMode = "mouse";
        }
        if (tcm) tcm.style.opacity = "1";
    }
    // minecraftMode時はtouchPanAreaを無効化（ジョイスティックにカメラ統合）
    if (typeof updateTouchPanVisibility === "function") updateTouchPanVisibility();
}
updateTouchUIVisibility();

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
            "#touchUI, #joystickArea, #joystickBase, #touchBtns, .game-modal, #pauseSettingsMenu",
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

/* ===== Photonのグローバル変数 & ルーム・チーム設定 ===== */
const PHOTON_APP_ID = "6fc63498-cd25-4e81-8d17-78a2ce1a54c8";
let photonClient = null;
window.isMultiplayer = false;
window.currentDifficulty = "normal"; // 'easy', 'normal', 'hard'
window.currentRoomSettings = {
    asteroids: true,
    playerHp: 250,
    playerLives: 5,
    activeTeams: 2,
    spawns: {},
    teams: {
        1: { aiCount: 0, aiHp: 45, aiLives: 0, dropRate: 0.15 },
        2: { aiCount: 0, aiHp: 45, aiLives: 0, dropRate: 0.15 },
        3: { aiCount: 0, aiHp: 45, aiLives: 0, dropRate: 0.15 },
        4: { aiCount: 0, aiHp: 45, aiLives: 0, dropRate: 0.15 },
    },
};
let syncTimer = null;
const isRoomHost = () =>
    photonClient &&
    photonClient.isJoinedToRoom() &&
    photonClient.myRoom().masterClientId === photonClient.myActor().actorNr;

function updatePhotonStatus(text) {
    const el = document.getElementById("photonStatus");
    if (el) el.innerText = text;
}

function updateRoomPlayerList() {
    const list = document.getElementById("roomPlayerList");
    if (!list || !photonClient || !photonClient.myRoomActors()) return;
    list.innerHTML = "";
    const actors = photonClient.myRoomActors();
    for (let actorNr in actors) {
        const actor = actors[actorNr];
        const name = actor.getCustomProperty("name") || `PILOT ${actorNr}`;
        const teamId = actor.getCustomProperty("team") || 1;
        const color = TEAM_COLORS[teamId];
        const li = document.createElement("li");
        li.innerHTML = `<span style="color:${color};">[チーム ${teamId}] ${name} ${actor.isLocal ? "(あなた)" : ""}</span>`;
        list.appendChild(li);
    }
}

function updateTeamSelector() {
    const ts = document.getElementById("teamSelector");
    if (!ts) return;
    ts.innerHTML = "";
    const activeTeams = window.currentRoomSettings.activeTeams || 2;
    for (let i = 1; i <= activeTeams; i++) {
        const btn = document.createElement("button");
        btn.className = `team-btn team-${i}`;
        btn.innerText = `チーム ${i}`;
        btn.onclick = () => window.selectTeam(i);
        ts.appendChild(btn);
    }
    const myTeam = photonClient?.myActor()?.getCustomProperty("team") || 1;
    window.selectTeam(myTeam);
}

function drawSpawnMap() {
    const canvas = document.getElementById("spawnMap");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Canvasのサイズをスケールに合わせてセット（高解像度化）
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
    } else {
        canvas.width = 240 * dpr;
        canvas.height = 240 * dpr;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (photonClient && photonClient.isJoinedToRoom()) {
        const actors = photonClient.myRoomActors();
        for (let id in actors) {
            const act = actors[id];

            // スポーン位置をホストの設定（spawns）または本人のカスタムプロパティから取得
            let px =
                act.getCustomProperty("spawnX") !== undefined
                    ? act.getCustomProperty("spawnX")
                    : WORLD_W / 2;
            let py =
                act.getCustomProperty("spawnY") !== undefined
                    ? act.getCustomProperty("spawnY")
                    : WORLD_H / 2;

            if (
                window.currentRoomSettings.spawns &&
                window.currentRoomSettings.spawns[id]
            ) {
                px = window.currentRoomSettings.spawns[id].x;
                py = window.currentRoomSettings.spawns[id].y;
            }

            const team = act.getCustomProperty("team") || 1;
            const cx = (px / WORLD_W) * canvas.width;
            const cy = (py / WORLD_H) * canvas.height;

            ctx.fillStyle = TEAM_COLORS[team] || "#fff";
            ctx.beginPath();
            ctx.arc(cx, cy, (act.isLocal ? 8 : 6) * dpr, 0, Math.PI * 2);
            ctx.fill();
            if (act.isLocal) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2 * dpr;
                ctx.stroke();
                ctx.fillStyle = "#fff";
                ctx.font = `${10 * dpr}px monospace`;
                ctx.fillText("YOU", cx + 10 * dpr, cy + 4 * dpr);
            } else {
                const name = act.getCustomProperty("name") || `P${id}`;
                ctx.fillStyle = "rgba(255,255,255,0.7)";
                ctx.font = `${9 * dpr}px monospace`;
                ctx.fillText(name.substring(0, 6), cx + 8 * dpr, cy + 3 * dpr);
            }
        }
    }
}

// ホスト専用のドラッグ機能の実装
let draggedActorNr = null;
const spawnMapCanvas = document.getElementById("spawnMap");
if (spawnMapCanvas) {
    spawnMapCanvas.addEventListener("mousedown", (e) => {
        if (!isRoomHost() || !photonClient || !photonClient.isJoinedToRoom())
            return;
        const rect = spawnMapCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let bestDist = 20; // ピクセル範囲内で一番近いピンを掴む
        let bestActor = null;

        const actors = photonClient.myRoomActors();
        for (let id in actors) {
            const act = actors[id];
            let px = act.getCustomProperty("spawnX") || WORLD_W / 2;
            let py = act.getCustomProperty("spawnY") || WORLD_H / 2;
            if (
                window.currentRoomSettings.spawns &&
                window.currentRoomSettings.spawns[id]
            ) {
                px = window.currentRoomSettings.spawns[id].x;
                py = window.currentRoomSettings.spawns[id].y;
            }
            const cx = (px / WORLD_W) * rect.width;
            const cy = (py / WORLD_H) * rect.height;
            const dist = Math.hypot(cx - x, cy - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestActor = id;
            }
        }
        if (bestActor) draggedActorNr = bestActor;
    });

    spawnMapCanvas.addEventListener("mousemove", (e) => {
        if (!draggedActorNr || !isRoomHost() || !photonClient) return;
        const rect = spawnMapCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const worldX = Math.max(
            0,
            Math.min(WORLD_W, (x / rect.width) * WORLD_W),
        );
        const worldY = Math.max(
            0,
            Math.min(WORLD_H, (y / rect.height) * WORLD_H),
        );

        if (!window.currentRoomSettings.spawns)
            window.currentRoomSettings.spawns = {};
        window.currentRoomSettings.spawns[draggedActorNr] = {
            x: worldX,
            y: worldY,
        };

        drawSpawnMap();
    });

    const endDrag = () => {
        if (draggedActorNr && isRoomHost()) {
            draggedActorNr = null;
            photonClient.raiseEvent(5, window.currentRoomSettings, {
                receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
            });
        }
    };
    spawnMapCanvas.addEventListener("mouseup", endDrag);
    spawnMapCanvas.addEventListener("mouseleave", endDrag);

    // タッチ対応（スマホでスポーン位置をドラッグ変更可能に）
    spawnMapCanvas.addEventListener("touchstart", (e) => {
        if (!isRoomHost() || !photonClient || !photonClient.isJoinedToRoom()) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = spawnMapCanvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        let bestDist = 30;
        let bestActor = null;
        const actors = photonClient.myRoomActors();
        for (let id in actors) {
            const act = actors[id];
            let px = act.getCustomProperty("spawnX") || WORLD_W / 2;
            let py = act.getCustomProperty("spawnY") || WORLD_H / 2;
            if (window.currentRoomSettings.spawns && window.currentRoomSettings.spawns[id]) {
                px = window.currentRoomSettings.spawns[id].x;
                py = window.currentRoomSettings.spawns[id].y;
            }
            const cx = (px / WORLD_W) * rect.width;
            const cy = (py / WORLD_H) * rect.height;
            const dist = Math.hypot(cx - x, cy - y);
            if (dist < bestDist) {
                bestDist = dist;
                bestActor = id;
            }
        }
        if (bestActor) draggedActorNr = bestActor;
    }, { passive: false });

    spawnMapCanvas.addEventListener("touchmove", (e) => {
        if (!draggedActorNr || !isRoomHost() || !photonClient) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const rect = spawnMapCanvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const worldX = Math.max(0, Math.min(WORLD_W, (x / rect.width) * WORLD_W));
        const worldY = Math.max(0, Math.min(WORLD_H, (y / rect.height) * WORLD_H));
        if (!window.currentRoomSettings.spawns) window.currentRoomSettings.spawns = {};
        window.currentRoomSettings.spawns[draggedActorNr] = { x: worldX, y: worldY };
        drawSpawnMap();
    }, { passive: false });

    spawnMapCanvas.addEventListener("touchend", endDrag);
    spawnMapCanvas.addEventListener("touchcancel", endDrag);
}

window.selectTeam = function (teamId) {
    if (photonClient && photonClient.isJoinedToRoom()) {
        photonClient.myActor().setCustomProperty("team", teamId);
    }
    document
        .querySelectorAll(".team-btn")
        .forEach((b) => b.classList.remove("team-active"));
    document.querySelector(`.team-${teamId}`)?.classList.add("team-active");
    drawSpawnMap();
    updateRoomPlayerList();
};

document.getElementById("btnAddTeam")?.addEventListener("click", () => {
    if (window.currentRoomSettings.activeTeams < 4) {
        window.currentRoomSettings.activeTeams++;
        updateTeamSelector();
        if (photonClient && photonClient.isJoinedToRoom()) {
            photonClient.raiseEvent(5, window.currentRoomSettings, {
                receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
            });
        }
    }
});

document
    .getElementById("btnRemoveTeam")
    ?.addEventListener("click", () => {
        if (window.currentRoomSettings.activeTeams > 2) {
            window.currentRoomSettings.activeTeams--;

            if (photonClient && photonClient.isJoinedToRoom()) {
                const myTeam =
                    photonClient.myActor().getCustomProperty("team") || 1;
                if (myTeam > window.currentRoomSettings.activeTeams) {
                    window.selectTeam(1);
                }
            }

            updateTeamSelector();
            if (photonClient && photonClient.isJoinedToRoom()) {
                photonClient.raiseEvent(5, window.currentRoomSettings, {
                    receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                });
            }
        }
    });

function renderTeamSettings() {
    const container = document.getElementById("teamSettingsContainer");
    if (!container) return;
    container.innerHTML = "";
    const activeTeams = window.currentRoomSettings.activeTeams || 2;
    for (let i = 1; i <= activeTeams; i++) {
        const t = window.currentRoomSettings.teams[i] || {
            aiCount: 0,
            aiHp: 45,
            aiLives: 0,
            dropRate: 0.15,
        };
        container.innerHTML += `
        <div style="margin-bottom:12px; border-bottom:1px dashed rgba(0,240,255,0.2); padding-bottom:12px;">
            <strong style="color:${TEAM_COLORS[i]}; font-size: 14px;">チーム ${i}</strong><br>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                <span style="font-size: 13px;">味方AIのスポーン数:</span>
                <input type="number" id="ts_count_${i}" value="${t.aiCount}" min="0" max="20" style="width:70px;">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px;">味方AIの最大HP (Life):</span>
                <input type="number" id="ts_hp_${i}" value="${t.aiHp}" min="10" max="1000" style="width:70px;">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px;">味方AIの残機 (Lives):</span>
                <input type="number" id="ts_lives_${i}" value="${t.aiLives !== undefined ? t.aiLives : 0}" min="0" max="100" style="width:70px;">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px;">アイテムドロップ確率:</span>
                <input type="number" id="ts_drop_${i}" value="${t.dropRate}" step="0.05" min="0" max="1" style="width:70px;">
            </div>
        </div>`;
    }
}

document
    .getElementById("btnOpenRoomSettings")
    ?.addEventListener("click", () => {
        document.getElementById("settingAsteroids").checked =
            window.currentRoomSettings.asteroids !== false;
        document.getElementById("settingMapSize").value =
            window.currentRoomSettings.mapSize || 10000;
        document.getElementById("settingPlayerHp").value =
            window.currentRoomSettings.playerHp || 250;
        document.getElementById("settingPlayerLives").value =
            window.currentRoomSettings.playerLives !== undefined
                ? window.currentRoomSettings.playerLives
                : 5;
        renderTeamSettings();
        document.getElementById("roomSettingsModal").style.display = "block";
    });

document
    .getElementById("btnApplyRoomSettings")
    ?.addEventListener("click", () => {
        window.currentRoomSettings.asteroids =
            document.getElementById("settingAsteroids").checked;
        window.currentRoomSettings.mapSize =
            parseInt(document.getElementById("settingMapSize").value) || 10000;
        WORLD_W = window.currentRoomSettings.mapSize;
        WORLD_H = window.currentRoomSettings.mapSize;
        window.currentRoomSettings.playerHp =
            parseInt(document.getElementById("settingPlayerHp").value) || 250;
        window.currentRoomSettings.playerLives =
            parseInt(document.getElementById("settingPlayerLives").value) || 0;
        const activeTeams = window.currentRoomSettings.activeTeams || 2;
        for (let i = 1; i <= activeTeams; i++) {
            window.currentRoomSettings.teams[i] = {
                aiCount:
                    parseInt(document.getElementById(`ts_count_${i}`).value) || 0,
                aiHp: parseInt(document.getElementById(`ts_hp_${i}`).value) || 45,
                aiLives:
                    parseInt(document.getElementById(`ts_lives_${i}`).value) || 0,
                dropRate:
                    parseFloat(document.getElementById(`ts_drop_${i}`).value) ||
                    0.15,
            };
        }
        document.getElementById("roomSettingsModal").style.display = "none";
        if (photonClient && photonClient.isJoinedToRoom()) {
            photonClient.raiseEvent(5, window.currentRoomSettings, {
                receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
            });
        }
    });

window.connectToPhoton = function (roomId, isHost) {
    if (typeof Photon === "undefined") {
        window.gameAlert("Photon SDK not loaded.", "ERROR");
        return;
    }
    updatePhotonStatus("通信を確立中...");

    // 本番環境とテスト環境でPhotonのマッチング空間を隔離する
    const isProd = window.currentFirebaseProjectId === "astro-fray";
    const appVersion = isProd ? "prod_1.0" : "dev_1.0";

    photonClient = new Photon.LoadBalancing.LoadBalancingClient(
        Photon.ConnectionProtocol.Wss,
        PHOTON_APP_ID,
        appVersion
    );

    photonClient.onStateChange = function (state) {
        if (
            state === Photon.LoadBalancing.LoadBalancingClient.State.JoinedLobby
        ) {
            updatePhotonStatus("ルームに参加中...");
            if (isHost) photonClient.createRoom(roomId, { maxPlayers: 10 });
            else photonClient.joinRoom(roomId);
        } else if (
            state === Photon.LoadBalancing.LoadBalancingClient.State.Joined
        ) {
            updatePhotonStatus("ルームに接続完了");
            setTimeout(() => updatePhotonStatus(""), 3000);
            window.isMultiplayer = true;
            document.getElementById("lobbyModal").style.display = "none";
            document.getElementById("roomWaitModal").style.display = "block";
            document.getElementById("hudHintText").innerText =
                "(P=ポーズ/メニュー, H=ヘルプ)";

            photonClient
                .myActor()
                .setCustomProperty(
                    "name",
                    localStorage.getItem("playerNickname_v1") || "Pilot",
                );
            photonClient.myActor().setCustomProperty("team", 1);

            // ランダム初期位置
            let mySpawnX = randInt(100, WORLD_W - 100);
            let mySpawnY = randInt(100, WORLD_H - 100);
            photonClient.myActor().setCustomProperty("spawnX", mySpawnX);
            photonClient.myActor().setCustomProperty("spawnY", mySpawnY);

            const hostFlag = isRoomHost();
            document.getElementById("btnStartGame").style.display = hostFlag
                ? "block"
                : "none";
            const btnOpenTeam = document.getElementById("btnOpenRoomSettings");
            if (btnOpenTeam)
                btnOpenTeam.style.display = hostFlag ? "inline-block" : "none";
            document.getElementById("btnAddTeam").style.display = hostFlag
                ? "inline-block"
                : "none";
            document.getElementById("btnRemoveTeam").style.display = hostFlag
                ? "inline-block"
                : "none";

            // カーソルをホストかそれ以外かで分かりやすくする
            document.getElementById("spawnMap").style.cursor = hostFlag
                ? "crosshair"
                : "default";

            updateTeamSelector();
            updateRoomPlayerList();
            setTimeout(drawSpawnMap, 100); // UIレンダリング待ち
        }
    };

    photonClient.onJoinRoomFailed = function (errorCode, errorMsg) {
        console.warn("Join Room Failed:", errorCode, errorMsg);
        updatePhotonStatus("入室に失敗しました");
        window.gameAlert(
            "ルームの入室に失敗しました。\n既に解散されたか、存在しない可能性があります。", "ROOM ERROR"
        );

        // 入室に失敗した＝無効なルームがFirestoreに残っているため、掃除する
        if (window.currentRoomDocId && window.deleteFirestoreRoom) {
            window.deleteFirestoreRoom(window.currentRoomDocId);
        }
        window.leaveMultiplayerRoom(false);
    };

    photonClient.onCreateRoomFailed = function (errorCode, errorMsg) {
        console.warn("Create Room Failed:", errorCode, errorMsg);
        updatePhotonStatus("ルーム作成に失敗しました");
        window.gameAlert("ルームの作成に失敗しました。", "ROOM ERROR");

        if (window.currentRoomDocId && window.deleteFirestoreRoom) {
            window.deleteFirestoreRoom(window.currentRoomDocId);
        }
        window.leaveMultiplayerRoom(false);
    };

    photonClient.onActorJoin = function (actor) {
        updateRoomPlayerList();
        drawSpawnMap();
        if (isRoomHost()) {
            photonClient.raiseEvent(5, window.currentRoomSettings, {
                receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
            });
        }
    };

    photonClient.onActorLeave = function (actor) {
        const name =
            actor.getCustomProperty("name") || `PILOT ${actor.actorNr}`;
        updatePhotonStatus(`⚠ ${name} が通信を切断しました`);
        setTimeout(() => updatePhotonStatus(""), 3000);

        // ホスト切断時
        if (!isLeavingRoom && (actor.isMasterClient || actor.actorNr === 1)) {
            // 残されたプレイヤーがFirestoreのルームを確実に消去する
            if (window.currentRoomDocId && window.deleteFirestoreRoom) {
                window.deleteFirestoreRoom(window.currentRoomDocId);
            }

            if (matchEnded) {
                window.gameAlert("ホストの接続が切断されました。", "DISCONNECTED");
            } else {
                window.leaveMultiplayerRoom(
                    true,
                    "ホストの接続が切断されました。ホーム画面に戻ります。",
                );
            }
            return;
        }

        if (window.isMultiplayer && running && !matchEnded) {
            const idx = ships.findIndex(
                (s) => s.id === "player_" + actor.actorNr,
            );
            if (idx !== -1) {
                if (!ships[idx].isGhost) {
                    spawnExplosion(ships[idx].x, ships[idx].y, 20, 1.5, "large");
                    spawnSmoke(ships[idx].x, ships[idx].y, 20, 4.0);
                }
                ships[idx].alive = false;
            }
        } else {
            updateRoomPlayerList();
            drawSpawnMap();
        }
    };

    photonClient.onActorPropertiesChange = function (actor) {
        updateRoomPlayerList();
        drawSpawnMap();

        let enemy = ships.find((s) => s.id === "player_" + actor.actorNr);
        if (enemy) {
            enemy.team = actor.getCustomProperty("team") || 1;
        }
    };

    photonClient.onEvent = function (code, content, actorNr) {
        if (code === 1) {
            // 位置同期
            let enemy = ships.find((s) => s.id === "player_" + actorNr);
            if (!enemy) {
                const aInfo = photonClient.myRoomActors()[actorNr];
                const eTeam = aInfo ? aInfo.getCustomProperty("team") || 1 : 1;
                enemy = {
                    id: "player_" + actorNr,
                    faction: "player",
                    team: eTeam,
                    isRemotePlayer: true,
                    x: content.x,
                    y: content.y,
                    targetX: content.x,
                    targetY: content.y,
                    vx: content.vx || 0,
                    vy: content.vy || 0,
                    angle: content.a,
                    targetAngle: content.a,
                    turnSpeed: 0.1,
                    thrust: 0.1,
                    maxSpeed: 6,
                    drag: 0.005,
                    alive: true,
                    hp: content.hp || 250,
                    maxHp: 250,
                    rollPhase: 0,
                    weaponTimer: 0,
                    weaponType: 0,
                    ai: null,
                    isGhost: content.hp <= 0,
                    lives: content.l || 0,
                };
                ships.push(enemy);
            } else {
                enemy.targetX = content.x;
                enemy.targetY = content.y;
                enemy.targetAngle = content.a;
                if (content.vx !== undefined) enemy.vx = content.vx;
                if (content.vy !== undefined) enemy.vy = content.vy;
                enemy.team = content.t !== undefined ? content.t : enemy.team;
                if (content.l !== undefined) enemy.lives = content.l;
                if (content.hp !== undefined) {
                    if (enemy.isGhost && content.hp > 0) {
                        enemy.isGhost = false;
                        enemy.alive = true;
                        enemy.x = content.x;
                        enemy.y = content.y;
                    }
                    enemy.hp = content.hp;
                    if (enemy.hp <= 0 && !enemy.isGhost) {
                        enemy.isGhost = true;
                        if (enemy.alive) {
                            spawnExplosion(enemy.x, enemy.y, 28, 2.2, "large");
                            spawnSmoke(enemy.x, enemy.y, 20, 4.0);
                        }
                    }
                }
            }
        } else if (code === 2) {
            // 射撃同期
            const shooterId = content.id ? content.id : "player_" + actorNr;
            let shooter = ships.find((s) => s.id === shooterId);
            if (shooter && !shooter.isGhost) {
                if (shooter.isRemotePlayer || shooter.isRemoteAI) {
                    shooter.targetX = content.x;
                    shooter.targetY = content.y;
                    shooter.targetAngle = content.a;
                } else {
                    shooter.x = content.x;
                    shooter.y = content.y;
                    shooter.angle = content.a;
                }
                shooter.weaponType = content.type;
                fireBullet(shooter, 47, 7.5, 0.5, true);
            }
        } else if (code === 3) {
            // 撃破イベント
            const deadPlayer = ships.find(
                (s) => s.id === "player_" + content.deadActorNr,
            );
            if (deadPlayer && !deadPlayer.isGhost) {
                spawnExplosion(deadPlayer.x, deadPlayer.y, 28, 2.2, "large");
                spawnSmoke(deadPlayer.x, deadPlayer.y, 20, 4.0);
                deadPlayer.isGhost = true;
                deadPlayer.hp = 0;
            }
        } else if (code === 4) {
            // ゲーム開始命令
            startCountdownAndPlay(content);
        } else if (code === 5) {
            // 設定同期
            window.currentRoomSettings = content;
            if (content.mapSize) {
                WORLD_W = content.mapSize;
                WORLD_H = content.mapSize;
            }
            updateTeamSelector();
            drawSpawnMap();
        } else if (code === 6) {
            // AI座標同期
            content.forEach((data) => {
                let aiShip = ships.find((s) => s.id === data.id);
                if (!aiShip) {
                    aiShip = makeAIShip("ai");
                    aiShip.id = data.id;
                    aiShip.isRemoteAI = true;
                    aiShip.team = data.team;
                    aiShip.x = data.x;
                    aiShip.y = data.y;
                    aiShip.angle = data.a;
                    aiShip.targetX = data.x;
                    aiShip.targetY = data.y;
                    aiShip.targetAngle = data.a;
                    aiShip.vx = data.vx || 0;
                    aiShip.vy = data.vy || 0;
                    aiShip.maxHp = data.mHp || 45;
                    aiShip.hp = data.hp || aiShip.maxHp;
                    aiShip.lives = data.l !== undefined ? data.l : 0;
                    ships.push(aiShip);
                } else {
                    aiShip.targetX = data.x;
                    aiShip.targetY = data.y;
                    aiShip.targetAngle = data.a;
                    if (data.vx !== undefined) aiShip.vx = data.vx;
                    if (data.vy !== undefined) aiShip.vy = data.vy;
                    aiShip.team = data.team;
                    if (data.l !== undefined) aiShip.lives = data.l;

                    if (!aiShip.alive && data.hp > 0) {
                        aiShip.alive = true;
                        aiShip.isGhost = false;
                        aiShip.x = data.x;
                        aiShip.y = data.y;
                    }

                    aiShip.hp = data.hp;
                    if (aiShip.hp <= 0 && aiShip.alive) {
                        aiShip.alive = false;
                        spawnExplosion(aiShip.x, aiShip.y, 28, 2.2, "large");
                        spawnSmoke(aiShip.x, aiShip.y, 20, 4.0);
                    }
                }
            });
        } else if (code === 8) {
            // アステロイド初期化
            asteroids = content.map((a) => ({ ...a }));
        } else if (code === 7) {
            // ダメージ同期 (ホスト権限による集約)
            const target = ships.find(s => s.id === content.targetId);
            if (target) {
                target.hp = content.newHp;
                if (showDamage) {
                    floatingTexts.push(
                        new FloatingText(target.x, target.y, `-${content.damage}`, "#ff0055", 1.0, damageTextBaseSize)
                    );
                }
                if (target.hp <= 0 && !target.isGhost) {
                    target.isGhost = true;
                    spawnExplosion(target.x, target.y, 28, 2.2, "large");
                    spawnSmoke(target.x, target.y, 20, 4.0);
                    if (target.id === playerId) {
                        lives -= 1;
                        shakeCamera(20);
                        if (lives > 0) {
                            setTimeout(() => respawnMultiplayerPlayer(), 2000);
                        }
                    }
                }
            }
        }
    };

    photonClient.connectToRegionMaster("jp");
};

function startCountdownAndPlay(settings) {
    if (typeof window.stopBGM === "function") window.stopBGM();
    playWarpTransition(() => {
        document.getElementById("roomWaitModal").style.display = "none";

        setTimeout(() => {
            const cdUI = document.getElementById("countdownUI");
            cdUI.style.display = "block";
            let count = 3;
            cdUI.innerText = count;
            cdUI.style.color = "#00f0ff";
            cdUI.style.fontSize = "100px";
            try {
                playLaserSound();
            } catch (e) { }

            const iv = setInterval(() => {
                count--;
                if (count > 0) {
                    cdUI.innerText = count;
                    try {
                        playLaserSound();
                    } catch (e) { }
                } else {
                    clearInterval(iv);
                    cdUI.innerText = "START!";
                    try {
                        playExplosionSound("small");
                    } catch (e) { }
                    setTimeout(() => {
                        cdUI.style.display = "none";
                    }, 1000);

                    window.isMultiplayer = true;
                    window.currentRoomSettings = settings;
                    initGame();
                }
            }, 1000);
        }, 2200);
    });
}

function startSinglePlayerCountdown() {
    if (typeof window.stopBGM === "function") window.stopBGM();
    playWarpTransition(() => {
        document.getElementById("modeSelectModal").style.display = "none";

        setTimeout(() => {
            const cdUI = document.getElementById("countdownUI");
            cdUI.style.display = "block";
            let count = 3;
            cdUI.innerText = count;
            cdUI.style.color = "#00f0ff";
            cdUI.style.fontSize = "100px";
            try {
                playLaserSound();
            } catch (e) { }

            const iv = setInterval(() => {
                count--;
                if (count > 0) {
                    cdUI.innerText = count;
                    try {
                        playLaserSound();
                    } catch (e) { }
                } else {
                    clearInterval(iv);
                    cdUI.innerText = "START!";
                    try {
                        playExplosionSound("small");
                    } catch (e) { }
                    setTimeout(() => {
                        cdUI.style.display = "none";
                    }, 1000);

                    window.isMultiplayer = false;
                    window._testPlayMode = false;
                    initGame();
                }
            }, 1000);
        }, 2200);
    });
}

/* ========== 初期化 ========== */
function initGame() {
    if (typeof window.playBattleBGM === "function") window.playBattleBGM();
    bullets = [];
    particles = [];
    asteroids = [];
    ships = [];
    floatingTexts = [];
    powerups = [];
    cameraShake = 0;
    idGen = 2;
    wave = 1;
    ScoreManager.reset();
    powerupsEnabled = true;
    message = window.isMultiplayer
        ? "TEAM DEATHMATCH: 生き残れ"
        : "敵を破壊してスコアを稼げ";
    showHelp = false;
    gameOverMode = false;
    matchEnded = false;
    isPaused = false;
    document.getElementById("pauseSettingsMenu").style.display = "none";

    if (controlMode === "initial") {
        resumeAudioOnFirstGesture();
    }

    // 自分のスポーン情報
    const mTeam =
        window.isMultiplayer && photonClient
            ? photonClient.myActor().getCustomProperty("team") || 1
            : 1;
    let mX = WORLD_W / 2;
    let mY = WORLD_H / 2;

    if (window.isMultiplayer && photonClient) {
        const myActorNr = photonClient.myActor().actorNr;
        if (
            window.currentRoomSettings.spawns &&
            window.currentRoomSettings.spawns[myActorNr]
        ) {
            mX = window.currentRoomSettings.spawns[myActorNr].x;
            mY = window.currentRoomSettings.spawns[myActorNr].y;
        } else {
            mX =
                photonClient.myActor().getCustomProperty("spawnX") || WORLD_W / 2;
            mY =
                photonClient.myActor().getCustomProperty("spawnY") || WORLD_H / 2;
        }
    }

    const spawnOffsetX = window.isMultiplayer ? rand(-50, 50) : 0;
    const spawnOffsetY = window.isMultiplayer ? rand(-50, 50) : 0;

    const initPlayerHp = window.isMultiplayer
        ? window.currentRoomSettings.playerHp || 250
        : 250;
    const initPlayerLives = window.isMultiplayer
        ? window.currentRoomSettings.playerLives !== undefined
            ? window.currentRoomSettings.playerLives
            : 5
        : 5;
    lives = initPlayerLives;

    const player = {
        id: playerId,
        faction: "player",
        team: mTeam,
        x: mX + spawnOffsetX,
        y: mY + spawnOffsetY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        turnSpeed: 0.07,
        thrust: 0.12,
        maxSpeed: 6,
        drag: 0.005,
        heat: 0,
        maxHeat: 100,
        boosting: false,
        boostTimer: 0,
        shootCd: 100,
        shootTimer: 0,
        alive: true,
        isGhost: false,
        hp: initPlayerHp,
        maxHp: initPlayerHp,
        scoreValue: 0,
        rollPhase: 0,
        ai: null,
        weaponType: 0,
        weaponTimer: 0,
    };
    ships.push(player);

    if (!window.isMultiplayer) {
        document.getElementById("hudHintText").innerText =
            "(P=ポーズ/メニュー, R=戻る, H=ヘルプ)";
        spawnAsteroids(20);
        spawnEnemyWave(1);
    } else {
        matchStartTime = performance.now();
        if (isRoomHost()) {
            if (
                window.currentRoomSettings &&
                window.currentRoomSettings.asteroids
            ) {
                spawnAsteroids(40);
                const astData = asteroids.map((a) => ({
                    x: a.x,
                    y: a.y,
                    vx: a.vx,
                    vy: a.vy,
                    r: a.r,
                    hp: a.hp,
                    rot: a.rot,
                    rotv: a.rotv,
                    spikes: a.spikes,
                    offsets: a.offsets,
                }));
                photonClient.raiseEvent(8, astData, {
                    receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                    cachingOption:
                        Photon.LoadBalancing.Constants.EventCaching.AddToRoomCache,
                });
            }
            const activeTeams = window.currentRoomSettings.activeTeams || 2;
            for (let i = 1; i <= activeTeams; i++) {
                const tConf = window.currentRoomSettings.teams[i];
                if (tConf && tConf.aiCount > 0) {
                    const pSpawns = [];
                    const actors = photonClient.myRoomActors();
                    for (let aId in actors) {
                        if (actors[aId].getCustomProperty("team") === i) {
                            let px =
                                actors[aId].getCustomProperty("spawnX") || WORLD_W / 2;
                            let py =
                                actors[aId].getCustomProperty("spawnY") || WORLD_H / 2;
                            if (
                                window.currentRoomSettings.spawns &&
                                window.currentRoomSettings.spawns[aId]
                            ) {
                                px = window.currentRoomSettings.spawns[aId].x;
                                py = window.currentRoomSettings.spawns[aId].y;
                            }
                            pSpawns.push({ x: px, y: py });
                        }
                    }

                    for (let j = 0; j < tConf.aiCount; j++) {
                        const ai = makeAIShip("ai");
                        ai.team = i;
                        ai.hp = tConf.aiHp;
                        ai.maxHp = tConf.aiHp;
                        ai.lives = tConf.aiLives !== undefined ? tConf.aiLives : 0;
                        ai.dropRate = tConf.dropRate;

                        if (pSpawns.length > 0) {
                            const base = pSpawns[randInt(0, pSpawns.length - 1)];
                            ai.x = wrap(base.x + rand(-300, 300), WORLD_W);
                            ai.y = wrap(base.y + rand(-300, 300), WORLD_H);
                        } else {
                            ai.x = rand(0, WORLD_W);
                            ai.y = rand(0, WORLD_H);
                        }
                        ships.push(ai);
                    }
                }
            }
        }

        if (syncTimer) clearInterval(syncTimer);
        syncTimer = setInterval(() => {
            if (
                window.isMultiplayer &&
                running &&
                !isPaused &&
                photonClient &&
                photonClient.isJoinedToRoom()
            ) {
                const p = ships.find((s) => s.id === playerId);
                if (p) {
                    photonClient.raiseEvent(
                        1,
                        {
                            x: p.x,
                            y: p.y,
                            vx: p.vx,
                            vy: p.vy,
                            a: p.angle,
                            hp: p.hp,
                            t: p.team,
                            l: lives,
                        },
                        {
                            receivers:
                                Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                        },
                    );
                }
                if (isRoomHost()) {
                    const aiData = ships
                        .filter(
                            (s) => s.ai && !s.isRemoteAI && (s.alive || s.lives > 0),
                        )
                        .map((s) => ({
                            id: s.id,
                            x: s.x,
                            y: s.y,
                            vx: s.vx,
                            vy: s.vy,
                            a: s.angle,
                            hp: s.hp,
                            f: s.faction,
                            team: s.team,
                            mHp: s.maxHp,
                            l: s.lives,
                        }));
                    if (aiData.length > 0)
                        photonClient.raiseEvent(6, aiData, {
                            receivers:
                                Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                        });
                }
            }
        }, 20); // Increased sync rate to 50Hz
    }
    TimeManager.setStartTime(Date.now());
    running = true;
    updateTouchUIVisibility();
}

/* ========== エンティティ生成 ========== */
function makeAIShip(faction, overrideDiff = null) {
    const id = idGen++;
    let team = 2; // デフォルト敵
    if (faction === "ally") team = window.isMultiplayer ? 1 : 3;
    const diff = overrideDiff || (window.isMultiplayer ? "normal" : window.currentDifficulty);

    // 難易度別ステータス
    let turnSpd = 0.1,
        thrustVal = 0.1,
        maxSpd = 5.5,
        shootCdVal = 140,
        thinkMin = 0.5,
        thinkMax = 2.0;
    if (diff === "easy") {
        turnSpd = 0.08;
        thrustVal = 0.08;
        maxSpd = 5.0;
        shootCdVal = 200;
        thinkMin = 1.0;
        thinkMax = 2.5;
    } else if (diff === "hard") {
        turnSpd = 0.14;
        thrustVal = 0.14;
        maxSpd = 6.2;
        shootCdVal = 85;
        thinkMin = 0.15;
        thinkMax = 0.6;
    }
    if (faction === "enemy") turnSpd += diff === "hard" ? 0.03 : 0.02;

    return {
        id,
        faction,
        team,
        x: rand(0, WORLD_W),
        y: rand(0, WORLD_H),
        vx: rand(-1, 1),
        vy: rand(-1, 1),
        angle: rand(0, TAU),
        turnSpeed: turnSpd,
        thrust: thrustVal,
        maxSpeed: maxSpd,
        drag: 0.004,
        heat: 0,
        maxHeat: 100,
        boosting: false,
        boostTimer: 0,
        shootCd: shootCdVal,
        shootTimer: 0,
        alive: true,
        isGhost: false,
        hp: 45,
        maxHp: 45,
        scoreValue: faction === "enemy" ? 150 : 0,
        dropRate: 0.15,
        lives: 0,
        ai: {
            mode: "patrol",
            targetId: null,
            thinkTimer: rand(thinkMin, thinkMax),
            formation: rand(-1, 1),
            fleeing: false,
            difficulty: diff,
        },
        rollPhase: 0,
    };
}
function spawnAsteroids(n) {
    const spawnCount = lightweightMode ? Math.max(6, Math.floor(n * 1)) : n;
    for (let i = 0; i < spawnCount; i++) {
        const r = rand(22, 60);
        const spikes = randInt(8, 14);
        const offsets = [];
        for (let j = 0; j < spikes; j++) offsets.push(rand(0.5, 1.2));
        asteroids.push({
            x: rand(0, WORLD_W),
            y: rand(0, WORLD_H),
            vx: rand(-1.2, 1.2),
            vy: rand(-1.2, 1.2),
            r,
            hp: Math.floor(r / 10),
            rot: rand(0, TAU),
            rotv: rand(-0.01, 0.01),
            spikes,
            offsets,
        });
    }
}
function splitAsteroid(a) {
    if (a.r < 22) return;
    for (let i = 0; i < 2; i++) {
        const r = a.r * rand(0.45, 0.6);
        const spikes = randInt(7, 12);
        const offsets = [];
        for (let j = 0; j < spikes; j++) offsets.push(rand(0.5, 1.2));
        asteroids.push({
            x: wrap(a.x + rand(-5, 5), WORLD_W),
            y: wrap(a.y + rand(-5, 5), WORLD_H),
            vx: a.vx + rand(-1, 1),
            vy: a.vy + rand(-1, 1),
            r,
            hp: Math.max(1, Math.floor(r / 10)),
            rot: rand(0, TAU),
            rotv: rand(-0.02, 0.02),
            spikes,
            offsets,
        });
    }
}
function spawnEnemyWave(n) {
    const count = Math.min(4 + n, 6);
    for (let i = 0; i < count; i++) {
        const s = makeAIShip("enemy");
        s.x = rand(0, WORLD_W);
        s.y = rand(0, WORLD_H);
        ships.push(s);
    }
    for (let i = 0; i < count; i++) {
        const a = makeAIShip("ally");
        a.x = rand(0, WORLD_W);
        a.y = rand(0, WORLD_H);
        ships.push(a);
    }
}
function spawnWave(enemyCount, allyCount) {
    for (let i = 0; i < Math.max(0, enemyCount); i++) {
        const s = makeAIShip("enemy");
        ships.push(s);
    }
    for (let i = 0; i < Math.max(0, allyCount); i++) {
        const a = makeAIShip("ally");
        ships.push(a);
    }
}

/* ========== 弾・エフェクト ========== */
function fireBulletBase(
    s,
    speed,
    _life,
    spread,
    angleOffset = 0,
    colorType = "laser",
    isRemote = false,
) {
    const ang = s.angle + angleOffset + rand(-spread, spread) * 0.1;
    const ca = Math.cos(ang),
        sa = Math.sin(ang);
    bullets.push({
        x: wrap(s.x + ca * 16, WORLD_W),
        y: wrap(s.y + sa * 16, WORLD_H),
        vx: s.vx + ca * speed,
        vy: s.vy + sa * speed,
        life: 5.0,
        owner: s.id,
        ownerTeam: s.team,
        radius: 3,
        type: colorType,
        length: 48,
        width: 3,
    });
    spawnExplosion(s.x + ca * 18, s.y + sa * 18, 4, 0.4);
}
function fireBullet(s, speed, _life, spread, isRemote = false) {
    if (s.isGhost) return;
    try {
        playLaserSound(s.x, s.y);
    } catch (e) { }
    if (s.weaponType === 1) {
        fireBulletBase(s, speed, _life, spread, 0, "spread", isRemote);
        fireBulletBase(s, speed, _life, spread, -0.2, "spread", isRemote);
        fireBulletBase(s, speed, _life, spread, 0.2, "spread", isRemote);
    } else if (s.weaponType === 2) {
        fireBulletBase(
            s,
            speed,
            _life,
            spread,
            rand(-0.05, 0.05),
            "rapid",
            isRemote,
        );
    } else {
        fireBulletBase(s, speed, _life, spread, 0, "laser", isRemote);
    }

    if (
        window.isMultiplayer &&
        !isRemote &&
        photonClient &&
        photonClient.isJoinedToRoom()
    ) {
        if (s.id === playerId || (isRoomHost() && s.ai && !s.isRemoteAI)) {
            const syncId = s.id === playerId ? null : s.id;
            photonClient.raiseEvent(
                2,
                { id: syncId, x: s.x, y: s.y, a: s.angle, type: s.weaponType },
                {
                    receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                },
            );
        }
    }
}
function spawnSmoke(x, y, count, power = 1) {
    const actualCount = lightweightMode
        ? Math.max(1, Math.floor(count * 0.3))
        : count;
    for (let i = 0; i < actualCount; i++) {
        particles.push({
            x: wrap(x + rand(-6, 6), WORLD_W),
            y: wrap(y + rand(-6, 6), WORLD_H),
            vx: rand(-0.6, 0.6) * power + rand(-0.2, 0.2),
            vy: rand(-0.9, 0.2) * power + rand(-0.2, 0.2),
            life: rand(0.35, 0.9),
            maxLife: 0.9,
            size: rand(2, 5) * power,
            smoke: true,
        });
    }
}
function spawnExplosion(x, y, count, power = 1, size = "medium") {
    const actualCount = lightweightMode
        ? Math.max(2, Math.floor(count * 0.35))
        : count;
    for (let i = 0; i < actualCount; i++) {
        particles.push({
            x: wrap(x, WORLD_W),
            y: wrap(y, WORLD_H),
            vx: rand(-2, 2) * power,
            vy: rand(-2, 2) * power,
            life: rand(0.3, 0.9),
            maxLife: 0.9,
            size: rand(1, 3) * power,
        });
    }
    try {
        playExplosionSound(size);
    } catch (e) { }
}

/* ========== 更新ルーチン ========== */
let last = performance.now();
// チート対策: スコアのメモリ秘匿
const ScoreManager = (function () {
    let _scoreKey = Math.floor(Math.random() * 100000000);
    let _encScore = 0 ^ _scoreKey;
    return {
        add: function (val) {
            let current = _encScore ^ _scoreKey;
            current += val;
            _scoreKey = Math.floor(Math.random() * 100000000);
            _encScore = current ^ _scoreKey;
        },
        get: function () {
            return _encScore ^ _scoreKey;
        },
        reset: function () {
            _scoreKey = Math.floor(Math.random() * 100000000);
            _encScore = 0 ^ _scoreKey;
        }
    };
})();

// 簡単なSHA-256風のハッシュ文字列を生成する関数（改ざん検知用）
async function generateSignature(score, playTime) {
    const raw = score + "_" + playTime + "_AstroFraySuperSecretKey";
    const msgBuffer = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// チート対策: プレイ開始時間のメモリ秘匿
const TimeManager = (function () {
    let _timeKey = Math.floor(Math.random() * 100000);
    let _encTime = 0;
    return {
        setStartTime: function (val) {
            _timeKey = Math.floor(Math.random() * 100000);
            _encTime = val + _timeKey;
        },
        getStartTime: function () {
            return _encTime === 0 ? 0 : _encTime - _timeKey;
        }
    };
})();

let lives = 5,
    wave = 1,
    message = "";
let gameOverMode = false;
let fpsAccum = 0,
    fpsFrames = 0,
    fpsDisplay = 0;
const AI_SHOT_RESERVE = 10;
const AI_SHOT_BOX_HALF = 500;
const FLEE_HEAT_RATIO = 0.98;
const COOLED_HEAT_RATIO = 0.35;
const SAFE_DISTANCE = 600;
const SAFE_DISTANCE2 = SAFE_DISTANCE * SAFE_DISTANCE;

function addScore(v, x, y) {
    if (gameOverMode || window.isMultiplayer) return; // マルチプレイはスコア加算なし
    ScoreManager.add(v);
    if (x !== undefined && y !== undefined) {
        const size = Math.max(10, damageTextBaseSize * 0.8);
        floatingTexts.push(
            new FloatingText(x, y, `+${v}`, "#ffffff", 1.0, size),
        );
    }
}

function enterGameOverMode() {
    if (gameOverMode || window.isMultiplayer) return;
    gameOverMode = true;
    message = `GAME OVER - [Esc]キーかメニューから終了`;
    updateTouchUIVisibility();
    handleGameOverSubmit().catch(console.error);
}

async function handleGameOverSubmit() {
    const currentScore = ScoreManager.get();
    const startT = TimeManager.getStartTime();

    // TimeManagerに全く値が入っていない状態（デフォルト値等）の場合は 0 秒扱い
    const playTimeSeconds = startT === 0 ? 0 : (Date.now() - startT) / 1000;

    // 時間整合性チェック (1秒あたり最大300点稼げると仮定)
    const maxPossibleScore = playTimeSeconds * 300;

    if (currentScore > maxPossibleScore) {
        console.warn("異常なスコアを検出しました");
        message = "SCORE ERROR - 無効なプレイデータです";
        document.getElementById("cheatWarningModal").style.display = "block";
        if (running) setPauseState(true);
        return;
    }

    message = `MISSION FAILED - スコア送信中...`;
    const diff = window.currentDifficulty || "normal";
    if (window.submitScoreToServer) {
        // 署名を生成して一緒に送る
        const signature = await generateSignature(currentScore, playTimeSeconds);
        let res = await window.submitScoreToServer(currentScore, diff, playTimeSeconds, signature);
        if (res && !res.ok) {
            if (res.reason === 'permission-denied') {
                document.getElementById('cheatWarningModal').style.display = 'block';
            } else {
                document.getElementById('networkErrorModal').style.display = 'block';
            }
        }
    }
    message = `MISSION FAILED - ランキング取得中...`;
    if (window.fetchTopRanks) {
        const ranks = await window.fetchTopRanks(diff);
        const myName = localStorage.getItem("playerNickname_v1") || "UNKNOWN";
        displayRanking(ranks, diff, currentScore, myName);
    }
}

function handleMatchEnd(winningTeam) {
    if (matchEnded) return;
    matchEnded = true;
    updateTouchUIVisibility();
    let msg = winningTeam > 0 ? `TEAM ${winningTeam} 勝利!` : `DRAW!`;
    const cdUI = document.getElementById("countdownUI");
    cdUI.innerText = msg;
    const col = winningTeam > 0 ? TEAM_COLORS[winningTeam] : "#00f0ff";
    cdUI.style.color = col;
    cdUI.style.textShadow = `0 0 30px ${col}`;
    cdUI.style.fontSize = "80px";
    cdUI.style.display = "block";

    setTimeout(() => {
        cdUI.style.display = "none";
        cdUI.style.fontSize = "100px";
        showResultModal(winningTeam);
    }, 4000);
}

function showResultModal(winningTeam) {
    running = false;
    document.getElementById("resultModal").style.display = "block";
    const rt = document.getElementById("resultTitle");
    const col = winningTeam > 0 ? TEAM_COLORS[winningTeam] : "#00f0ff";
    rt.innerText =
        winningTeam > 0 ? `チーム ${winningTeam} 勝利` : `引き分け`;
    rt.style.color = col;
    rt.style.textShadow = `0 0 15px ${col}`;

    const list = document.getElementById("resultList");
    list.innerHTML = "";

    // プレイヤーの生存情報を表示
    const actors = photonClient ? photonClient.myRoomActors() : {};
    ships
        .filter((s) => s.faction === "player" || s.isRemotePlayer)
        .forEach((s) => {
            let name = "UNKNOWN";
            if (s.id === playerId) {
                name = localStorage.getItem("playerNickname_v1") || "YOU";
            } else {
                const actId = s.id.split("_")[1];
                if (actors[actId])
                    name =
                        actors[actId].getCustomProperty("name") || `PILOT ${actId}`;
            }
            const status = s.isGhost ? "撃破" : "生存";
            list.innerHTML += `<div style="color:${TEAM_COLORS[s.team]}; padding:6px; border-bottom:1px solid rgba(0,240,255,0.2);">
            [チーム ${s.team}] ${name} : ${status}
        </div>`;
        });
}

function displayRanking(ranks, currentDiff = null, myScore = null, myName = null) {
    const rankingListDiv = document.getElementById("rankingList");
    if (!rankingListDiv) return;

    if (currentDiff) {
        document.querySelectorAll(".rank-tab").forEach(tab => {
            if (tab.dataset.diff === currentDiff) {
                tab.classList.add("rank-tab-active");
            } else {
                tab.classList.remove("rank-tab-active");
            }
        });
    }

    let html = "<ul style='margin:5px 0; padding-left:10px; list-style:none;'>";
    if (ranks && ranks.length > 0) {
        ranks.forEach((r, index) => {
            const name = r.name
                ? String(r.name).replace(/</g, "&lt;").replace(/>/g, "&gt;")
                : "UNKNOWN";
            const pscore = Number.isFinite(r.score) ? r.score : 0;
            const ptime = Number.isFinite(r.playTimeSeconds) ? r.playTimeSeconds : 0;
            const mins = Math.floor(ptime / 60);
            const secs = Math.floor(ptime % 60);
            const timeStr = mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`;

            const isMe = (myScore !== null && myName !== null && pscore === myScore && r.name === myName);
            const highlightStyle = isMe ? "background:rgba(0,240,255,0.2); border:1px dashed #00f0ff; box-shadow:0 0 10px rgba(0,240,255,0.1); border-radius:4px;" : "border-bottom:1px solid rgba(255,255,255,0.1);";
            const idAttr = isMe ? "id='my-latest-rank'" : "";

            html += `<li ${idAttr} style="padding:6px; margin-bottom:4px; display:flex; align-items:center; ${highlightStyle}">
                <span style="display:inline-block; min-width:140px; font-weight:${isMe ? 'bold' : 'normal'}; color:${isMe ? '#00f0ff' : '#ccc'};">${index + 1}. ${name}</span>
                <span style="color:#ffaa00; font-weight:${isMe ? 'bold' : 'normal'};">${pscore} pt</span>
                <span style="font-size:11px; color:#aaa; margin-left:auto;">[ ${timeStr} ]</span>
            </li>`;
        });
    } else {
        html += "<li>データがありません</li>";
    }
    html += "</ul>";
    rankingListDiv.innerHTML = html;
    document.getElementById("rankingModal").style.display = "block";
    if (running && !gameOverMode) setPauseState(true);

    // ハイライト行が見つかった場合は中央へスムーズスクロール
    requestAnimationFrame(() => {
        const target = document.getElementById("my-latest-rank");
        if (target && rankingListDiv) {
            const duration = 1000; // 1秒(1000ms)
            const containerHeight = rankingListDiv.clientHeight;
            const targetTop = target.offsetTop;
            const targetHeight = target.offsetHeight;
            const scrollTargetY = targetTop - (containerHeight / 2) + (targetHeight / 2);

            const maxScrollY = rankingListDiv.scrollHeight - containerHeight;
            const finalScrollY = Math.max(0, Math.min(scrollTargetY, maxScrollY));
            const startY = rankingListDiv.scrollTop;
            const distance = finalScrollY - startY;

            if (distance === 0) return;

            const startTime = performance.now();
            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                rankingListDiv.scrollTop = startY + distance * ease;

                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            }
            requestAnimationFrame(step);
        }
    });
}

/* ========== 更新 ========== */
function update(dt) {
    if (!window.isMultiplayer && isPaused) return;

    let isAnyPlayerBoosting = false; // ブースト音用のフラグ

    const player = ships.find((s) => s.id === playerId);
    if (cameraShake > 0) {
        cameraShake *= 0.9;
        if (cameraShake < 0.5) cameraShake = 0;
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update(dt);
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].update(dt);
        if (
            player &&
            !player.isGhost &&
            !gameOverMode &&
            torusDist2(player.x, player.y, powerups[i].x, powerups[i].y) <
            (14 + powerups[i].radius) ** 2
        ) {
            powerups[i].apply(player);
            powerups.splice(i, 1);
            continue;
        }
        if (powerups[i].life <= 0) powerups.splice(i, 1);
    }
    // 武器タイマー管理（実時間ベース）
    if (player && player.weaponType > 0 && player.weaponStartTime) {
        const elapsed = performance.now() - player.weaponStartTime;
        if (elapsed >= player.weaponDuration) {
            player.weaponType = 0;
            player.weaponStartTime = 0;
            player.weaponDuration = 0;
        }
    }
    // HP回復リングエフェクト管理
    if (player && player.healRing) {
        player.healRing.life -= dt;
        if (player.healRing.life <= 0) player.healRing = null;
    }

    if (player) {
        if (!isPaused && player.alive) {
            const isGhostPlayer = player.isGhost;
            let turnLeft =
                controlMode === "keyboard" &&
                isAnyPressedForBind(keyBindings.turnLeft);
            let turnRight =
                controlMode === "keyboard" &&
                isAnyPressedForBind(keyBindings.turnRight);
            let thrustKey = isAnyPressedForBind(keyBindings.thrust);
            let brakeKey = isAnyPressedForBind(keyBindings.brake);
            const shootKey =
                !isGhostPlayer &&
                (isAnyPressedForBind(keyBindings.shoot) ||
                    mouse.down ||
                    keys[" "]);
            const boostKey =
                isAnyPressedForBind(keyBindings.boost) || keys["shift"];
            const rollLeft =
                isAnyPressedForBind(keyBindings.rollLeft) || keys["q"];
            const rollRight =
                isAnyPressedForBind(keyBindings.rollRight) || keys["e"];

            // Touch aim override
            if (minecraftMode) {
                const sensitivity = 0.003 * (minecraftSensitivity / 5);
                // PC: mouse.movementXからカメラ回転
                player.angle += mouse.movementX * sensitivity;
                mouse.movementX = 0;
                mouse.movementY = 0;
                if (controlMode === "touch") {
                    // モバイル: ジョイスティック水平軸から毎フレームカメラ回転
                    const touchCamSpeed = 0.04 * (minecraftSensitivity / 5);
                    player.angle += joystickVector.x * touchCamSpeed;
                    if (keys["touch_thrust"]) thrustKey = true;
                    if (keys["touch_brake"]) brakeKey = true;
                }
            } else if (controlMode === "touch" && keys["touch_aim"]) {
                player.angle = angleLerp(player.angle, keys["touch_angle"], 0.28);
                if (keys["touch_thrust"]) thrustKey = true;
            } else if (controlMode === "mouse") {
                const canvasRect = canvas.getBoundingClientRect();
                const aimAng = Math.atan2(
                    mouse.y - canvasRect.height / 2,
                    mouse.x - canvasRect.width / 2,
                );
                player.angle = angleLerp(player.angle, aimAng, 0.28);
            }
            if (turnLeft) player.angle -= player.turnSpeed;
            if (turnRight) player.angle += player.turnSpeed;
            const ca = Math.cos(player.angle),
                sa = Math.sin(player.angle);

            // 通常移動時の推進
            if (thrustKey) {
                player.vx += ca * player.thrust;
                player.vy += sa * player.thrust;
                // 通常移動の煙を追加 (ブースト時と同等の量に)
                if (GameFrames % 2 === 0) {
                    spawnSmoke(player.x - ca * 12, player.y - sa * 12, 3, 2.0);
                }
            }
            if (brakeKey) {
                player.vx *= 1 - player.drag * 10;
                player.vy *= 1 - player.drag * 10;
            }

            // ブースト時の推進
            if (boostKey && player.heat < player.maxHeat) {
                isAnyPlayerBoosting = true; // 音用フラグ

                player.vx += ca * player.thrust * 2.2;
                player.vy += sa * player.thrust * 2.2;
                player.heat += 30 * dt;
                player.boosting = true;
                player.boostTimer += dt;
                if (Math.random() < 0.3) shakeCamera(2);

                let baseCol =
                    window.isMultiplayer || window._testPlayMode
                        ? TEAM_COLORS[player.team]
                        : player.team === 3
                            ? TEAM_COLORS[3]
                            : TEAM_COLORS[1];
                if (!lightweightMode && GameFrames % 3 === 0) {
                    particles.push({
                        x: player.x,
                        y: player.y,
                        vx: 0,
                        vy: 0,
                        life: 0.25,
                        maxLife: 0.25,
                        size: 14,
                        smoke: true,
                        isGhost: true,
                        angle: player.angle,
                        color: baseCol,
                    });
                }
                if (GameFrames % 2 === 0) {
                    // ブースト時は煙を増量
                    spawnSmoke(player.x - ca * 12, player.y - sa * 12, 3, 2.0);
                }
            } else {
                player.boosting = false;
                player.boostTimer = Math.max(0, player.boostTimer - dt * 0.5);
            }

            if (rollLeft) {
                player.vx += -sa * 0.12;
                player.vy += ca * 0.12;
                player.rollPhase -= 0.3;
            }
            if (rollRight) {
                player.vx += sa * 0.12;
                player.vy += -ca * 0.12;
                player.rollPhase += 0.3;
            }

            player.shootTimer -= dt;
            if (
                !gameOverMode &&
                shootKey &&
                player.shootTimer <= 0 &&
                player.heat < player.maxHeat * 0.95
            ) {
                fireBullet(player, 47, 7.5, 0.5);
                player.heat += 4;
                player.shootTimer =
                    player.weaponType === 2
                        ? player.shootCd / 2500
                        : player.shootCd / 1000;
            }
        } else if (player.isGhost) {
            // 幽霊は観戦のため自由にカメラ移動可能
            const turnLeft =
                controlMode === "keyboard" &&
                isAnyPressedForBind(keyBindings.turnLeft);
            const turnRight =
                controlMode === "keyboard" &&
                isAnyPressedForBind(keyBindings.turnRight);
            if (minecraftMode) {
                const sensitivity = 0.003 * (minecraftSensitivity / 5);
                player.angle += mouse.movementX * sensitivity;
                mouse.movementX = 0;
                mouse.movementY = 0;
                if (controlMode === "touch") {
                    const touchCamSpeed = 0.04 * (minecraftSensitivity / 5);
                    player.angle += joystickVector.x * touchCamSpeed;
                }
            } else if (controlMode === "touch" && keys["touch_aim"]) {
                player.angle = angleLerp(player.angle, keys["touch_angle"], 0.28);
            } else if (controlMode === "mouse") {
                const canvasRect = canvas.getBoundingClientRect();
                const aimAng = Math.atan2(
                    mouse.y - canvasRect.height / 2,
                    mouse.x - canvasRect.width / 2,
                );
                player.angle = angleLerp(player.angle, aimAng, 0.28);
            }
            if (turnLeft) player.angle -= player.turnSpeed;
            if (turnRight) player.angle += player.turnSpeed;
            const ca = Math.cos(player.angle),
                sa = Math.sin(player.angle);
            if (isAnyPressedForBind(keyBindings.thrust) || (controlMode === "touch" && keys["touch_thrust"])) {
                player.vx += ca * player.thrust * 2;
                player.vy += sa * player.thrust * 2;
            }
            if (isAnyPressedForBind(keyBindings.brake) || (controlMode === "touch" && keys["touch_brake"])) {
                player.vx *= 1 - player.drag * 10;
                player.vy *= 1 - player.drag * 10;
            }
        }

        player.heat = clamp(player.heat - 20 * dt, 0, player.maxHeat);
        player.rollPhase *= 0.9;
        if (
            Math.hypot(player.vx, player.vy) >
            player.maxSpeed + (player.boosting ? 2.5 : 0)
        ) {
            player.vx *= 0.985;
            player.vx *= 0.985;
        }
        player.vx *= 1 - player.drag;
        player.vy *= 1 - player.drag;
        if (player.weaponTimer > 0 && !player.isGhost) {
            player.weaponTimer -= dt;
            if (player.weaponTimer <= 0) player.weaponType = 0;
        }

        player.x = wrap(player.x + player.vx, WORLD_W);
        player.y = wrap(player.y + player.vy, WORLD_H);
    }

    // 勝敗判定 (マルチプレイ)
    if (
        window.isMultiplayer &&
        running &&
        !matchEnded &&
        performance.now() - matchStartTime > 3000
    ) {
        let aliveTeams = new Set();
        ships.forEach((s) => {
            if (
                s.hp > 0 ||
                (s.lives !== undefined && s.lives > 0) ||
                (s.id === playerId && lives > 0)
            ) {
                aliveTeams.add(s.team);
            }
        });
        if (aliveTeams.size <= 1) {
            let winningTeam =
                aliveTeams.size === 1 ? Array.from(aliveTeams)[0] : 0;
            handleMatchEnd(winningTeam);
        }
    }

    for (const s of ships) {
        if (!s.alive) continue;
        if (s.isRemotePlayer || s.isRemoteAI) {
            // Dead reckoning: extrapolate with velocity, then lerp to correct position
            const lerpRate = Math.min(1, 12 * dt);
            if (s.targetX !== undefined) {
                // Apply velocity for prediction
                s.x = wrap(s.x + (s.vx || 0) * dt, WORLD_W);
                s.y = wrap(s.y + (s.vy || 0) * dt, WORLD_H);
                // Lerp toward authoritative position
                s.x = torusLerp(s.x, s.targetX, WORLD_W, lerpRate);
                s.y = torusLerp(s.y, s.targetY, WORLD_H, lerpRate);
            }
            if (s.targetAngle !== undefined)
                s.angle = angleLerp(s.angle, s.targetAngle, lerpRate);
            continue;
        }
        if (s.faction === "player" || !s.ai || s.isGhost) continue;

        if (window.isMultiplayer && !isRoomHost()) continue;

        s.ai.thinkTimer -= dt;
        if (typeof s.boostTimer !== "number") s.boostTimer = 0;
        if (s.heat >= s.maxHeat * FLEE_HEAT_RATIO) {
            s.ai.fleeing = true;
        }

        const aiDiff = s.ai.difficulty || "normal";
        const player = ships.find((p) => p.id === playerId);

        // Hard: ヒート管理ステート (80%超→回避専念、30%以下→解除)
        if (aiDiff === "hard") {
            if (!s.ai.heatFleeing && s.heat > s.maxHeat * 0.8)
                s.ai.heatFleeing = true;
            if (s.ai.heatFleeing && s.heat <= s.maxHeat * COOLED_HEAT_RATIO)
                s.ai.heatFleeing = false;
        }

        let target = s.ai.targetId
            ? ships.find((o) => o.id === s.ai.targetId)
            : null;
        if (
            s.ai.thinkTimer <= 0 ||
            !target ||
            !target.alive ||
            target.isGhost
        ) {
            let best = null;
            let bestScore = 1e12;
            for (const f of ships) {
                if (!f.alive || f.isGhost || f.id === s.id || !areEnemies(s, f))
                    continue;
                if (gameOverMode && f.id === playerId) continue;
                const d2 = torusDist2(s.x, s.y, f.x, f.y);
                const dist = Math.sqrt(d2);
                if (aiDiff === "hard") {
                    // Hard: HP低い敵+近い敵を優先 (距離1000以内なら低HPを大幅優先)
                    const hpRatio = f.hp / f.maxHp;
                    const closeBonus = dist < 1000 ? 0.15 : 0.4;
                    const effective =
                        dist * (closeBonus + hpRatio * (1.0 - closeBonus));
                    if (effective < bestScore) {
                        bestScore = effective;
                        best = f;
                    }
                } else {
                    if (d2 < bestScore) {
                        bestScore = d2;
                        best = f;
                    }
                }
            }
            s.ai.targetId = best ? best.id : null;

            // Hard: 戦術選択（ヒート管理ステートを活用）
            if (aiDiff === "hard") {
                if (s.ai.heatFleeing) {
                    // ヒート回避中でも、2発以内で倒せる近い敵がいれば攻撃続行
                    let canFinish = false;
                    if (best) {
                        const bestDist = Math.sqrt(
                            torusDist2(s.x, s.y, best.x, best.y),
                        );
                        if (best.hp <= 50 && bestDist < 1000) canFinish = true;
                    }
                    s.ai.mode = canFinish ? "attack" : "evade";
                } else if (player && !player.isGhost) {
                    const playerHeatRatio = player.heat / player.maxHeat;
                    if (playerHeatRatio > 0.7) {
                        s.ai.mode = "attack";
                    } else {
                        s.ai.mode = Math.random() < 0.08 ? "evade" : "attack";
                    }
                } else {
                    s.ai.mode = "attack";
                }
                s.ai.thinkTimer = rand(0.08, 0.3);
            } else if (aiDiff === "easy") {
                s.ai.mode = Math.random() < 0.35 ? "evade" : "attack";
                s.ai.thinkTimer = rand(1.0, 2.5);
            } else {
                s.ai.mode = Math.random() < 0.2 ? "evade" : "attack";
                s.ai.thinkTimer = rand(0.5, 1.5);
            }
        }
        if (s.ai.targetId)
            target = ships.find((o) => o.id === s.ai.targetId) || null;
        const avoidRadius = 120;
        let avoided = false;
        const priorityFightDist2 = 600 * 600;
        const targetDist2 = target
            ? torusDist2(s.x, s.y, target.x, target.y)
            : Infinity;

        for (const a of asteroids) {
            const d2 = torusDist2(s.x, s.y, a.x, a.y);
            const thresh = (avoidRadius + a.r) * (avoidRadius + a.r);
            if (target && targetDist2 < priorityFightDist2) {
                const emergencyThresh =
                    (avoidRadius / 2 + a.r) * (avoidRadius / 2 + a.r);
                if (d2 < emergencyThresh) {
                    const ex = ((s.x - a.x + WORLD_W / 2) % WORLD_W) - WORLD_W / 2;
                    const ey = ((s.y - a.y + WORLD_H / 2) % WORLD_H) - WORLD_H / 2;
                    const L = Math.hypot(ex, ey) || 0.0001;
                    const nx = ex / L,
                        ny = ey / L;
                    if (s.heat <= s.maxHeat - AI_SHOT_RESERVE) {
                        s.vx += nx * s.thrust * 2.2;
                        s.vy += ny * s.thrust * 2.2;
                        s.heat += 20;
                        s.boostTimer += 0.12;
                        s.boosting = true;
                        s.boostTimer += dt;
                    } else {
                        s.vx += nx * s.thrust * 1.4;
                        s.vy += ny * s.thrust * 1.4;
                    }
                    const angEscape = Math.atan2(ny, nx);
                    const diffE = ((angEscape - s.angle + Math.PI) % TAU) - Math.PI;
                    s.angle += clamp(diffE, -s.turnSpeed * 1.5, s.turnSpeed * 1.5);
                    avoided = true;
                    break;
                }
            } else {
                if (d2 < thresh) {
                    const ex = ((s.x - a.x + WORLD_W / 2) % WORLD_W) - WORLD_W / 2;
                    const ey = ((s.y - a.y + WORLD_H / 2) % WORLD_H) - WORLD_H / 2;
                    const L = Math.hypot(ex, ey) || 0.0001;
                    const nx = ex / L,
                        ny = ey / L;
                    s.vx += nx * s.thrust * 1.4;
                    s.vy += ny * s.thrust * 1.4;
                    const angEscape = Math.atan2(ny, nx);
                    const diffE = ((angEscape - s.angle + Math.PI) % TAU) - Math.PI;
                    s.angle += clamp(diffE, -s.turnSpeed * 1.5, s.turnSpeed * 1.5);
                    avoided = true;
                    break;
                }
            }
        }

        // Hard: ヒート回避中の弾回避行動
        if (
            !avoided &&
            aiDiff === "hard" &&
            s.ai.heatFleeing &&
            s.ai.mode === "evade"
        ) {
            let closestBullet = null;
            let closestBd = 1e12;
            for (const b of bullets) {
                if (b.owner === s.id) continue;
                const ownerShip = ships.find((x) => x.id === b.owner);
                if (ownerShip && !areEnemies(s, ownerShip)) continue;
                const bd = torusDist2(s.x, s.y, b.x, b.y);
                if (bd < closestBd) {
                    closestBd = bd;
                    closestBullet = b;
                }
            }
            if (closestBullet && closestBd < 1000 * 1000) {
                const bAng = Math.atan2(closestBullet.vy, closestBullet.vx);
                const perpDir = s.id % 2 === 0 ? 1 : -1;
                const evadeAng = bAng + (Math.PI / 2) * perpDir;
                const evadePower = aiDiff === "hard" ? 3.5 : 2.0;
                s.vx += Math.cos(evadeAng) * s.thrust * evadePower;
                s.vy += Math.sin(evadeAng) * s.thrust * evadePower;
                if (aiDiff === "hard" && s.heat < s.maxHeat - 10) {
                    s.heat += 10;
                    s.boostTimer = 0.3;
                    s.boosting = true;
                }
                avoided = true;
            }
        }
        if (!avoided) {
            const jitter =
                Math.sin(performance.now() / 300 + s.id) * 0.3 +
                (s.ai.formation || 0) * 0.5;
            if (target) {
                const dist = Math.sqrt(targetDist2);

                // 難易度別の偏差射撃予測
                let predX, predY;
                if (aiDiff === "hard") {
                    // Hard: 弾速ベースの正確な予測
                    const BULLET_SPEED = 47;
                    // 1次予測: 距離/弾速 = 飛翎時間
                    let tFlight = dist / BULLET_SPEED;
                    // ターゲットの速度ベクトル
                    const tvx = target.vx || 0,
                        tvy = target.vy || 0;
                    // 1次予測位置
                    let px1 = target.x + tvx * tFlight;
                    let py1 = target.y + tvy * tFlight;
                    // 2次予測: 予測位置への距離を再計算
                    const d2 = Math.hypot(px1 - s.x, py1 - s.y);
                    tFlight = d2 / BULLET_SPEED;
                    // 自機の速度も加味(弾は自機の速度も引き継ぐ)
                    predX = target.x + tvx * tFlight - (s.vx || 0) * tFlight * 0.3;
                    predY = target.y + tvy * tFlight - (s.vy || 0) * tFlight * 0.3;
                    // 加速方向のバイアス補正(ターゲットの旋回方向予測)
                    if (target.ai || target.faction === "player") {
                        const targetAngle = target.angle || 0;
                        const tCos = Math.cos(targetAngle),
                            tSin = Math.sin(targetAngle);
                        const accelBias = target.boosting ? 0.8 : 0.3;
                        predX += tCos * target.thrust * tFlight * accelBias;
                        predY += tSin * target.thrust * tFlight * accelBias;
                    }
                } else if (aiDiff === "easy") {
                    const laDiv = 35;
                    const lookahead = Math.min(dist / laDiv, 30);
                    predX = target.x + (target.vx || 0) * lookahead * 0.5;
                    predY = target.y + (target.vy || 0) * lookahead * 0.5;
                } else {
                    const laDiv = 25;
                    const lookahead = Math.min(dist / laDiv, 30);
                    predX = target.x + (target.vx || 0) * lookahead * 0.7;
                    predY = target.y + (target.vy || 0) * lookahead * 0.7;
                }

                const ang = Math.atan2(predY - s.y, predX - s.x);
                const diff = ((ang - s.angle + Math.PI) % TAU) - Math.PI;
                s.angle +=
                    clamp(diff, -s.turnSpeed, s.turnSpeed) +
                    jitter * (aiDiff === "hard" ? 0.003 : 0.02);
                const ca = Math.cos(s.angle),
                    sa = Math.sin(s.angle);

                if (s.ai.mode === "attack") {
                    const isFar = targetDist2 > 250 * 250;
                    const isClose = targetDist2 < 120 * 120;

                    if (aiDiff === "hard" && isClose) {
                        // Hard近距離: 円運動で背後を取る
                        const circleDir = s.id % 2 === 0 ? 1 : -1;
                        const perpAng = ang + (Math.PI / 2) * circleDir;
                        const perpCa = Math.cos(perpAng),
                            perpSa = Math.sin(perpAng);
                        s.vx += perpCa * s.thrust * 1.3;
                        s.vy += perpSa * s.thrust * 1.3;
                        s.vx += ca * s.thrust * 0.6;
                        s.vy += sa * s.thrust * 0.6;
                    } else if (isFar) {
                        const needTurn =
                            Math.abs(diff) > (aiDiff === "hard" ? 0.15 : 0.25);
                        if (
                            needTurn &&
                            s.heat <= s.maxHeat - AI_SHOT_RESERVE &&
                            s.boostTimer <= 0
                        ) {
                            s.vx += ca * s.thrust * 2.2;
                            s.vy += sa * s.thrust * 2.2;
                            s.heat += 12;
                            s.boostTimer = 0.12;
                            s.boosting = true;
                        } else {
                            s.vx += ca * s.thrust * (aiDiff === "hard" ? 1.3 : 1.0);
                            s.vy += sa * s.thrust * (aiDiff === "hard" ? 1.3 : 1.0);
                        }
                    } else {
                        s.vx += ca * s.thrust;
                        s.vy += sa * s.thrust;
                    }

                    // 射撃判定 (難易度により閾値が異なる)
                    const shootThreshold =
                        aiDiff === "hard" ? 0.25 : aiDiff === "easy" ? 0.35 : 0.2;
                    const td = torusDelta(s.x, s.y, target.x, target.y);
                    if (
                        Math.abs(td.dx) <= AI_SHOT_BOX_HALF &&
                        Math.abs(td.dy) <= AI_SHOT_BOX_HALF
                    ) {
                        if (Math.abs(diff) < shootThreshold) attemptShoot(s, target);
                    }

                    // Hard: ヒートが低く敵が近い場合、積極的にブースト追い込み
                    if (
                        aiDiff === "hard" &&
                        s.heat < s.maxHeat * 0.4 &&
                        !isFar &&
                        !isClose &&
                        s.boostTimer <= 0
                    ) {
                        s.vx += ca * s.thrust * 1.8;
                        s.vy += sa * s.thrust * 1.8;
                        s.heat += 8;
                        s.boostTimer = 0.1;
                        s.boosting = true;
                    }
                } else if (s.ai.mode === "evade") {
                    s.vx -= ca * s.thrust * 0.8;
                    s.vy -= sa * s.thrust * 0.8;
                    if (Math.random() < 0.05)
                        s.rollPhase += (Math.random() < 0.5 ? -1 : 1) * 0.6;
                    // Hard退避: 横方向にも動いて予測を困難にする
                    if (aiDiff === "hard") {
                        const evadePerp = s.id % 2 === 0 ? 1 : -1;
                        s.vx += -sa * s.thrust * 0.5 * evadePerp;
                        s.vy += ca * s.thrust * 0.5 * evadePerp;
                    }
                } else {
                    if (Math.random() < 0.6) {
                        s.vx += ca * s.thrust * 0.6;
                        s.vy += sa * s.thrust * 0.6;
                    }
                }
            } else {
                s.angle += jitter * 0.02;
                const ca = Math.cos(s.angle),
                    sa = Math.sin(s.angle);
                s.vx += ca * s.thrust * 0.3;
                s.vy += sa * s.thrust * 0.3;
            }
        }
        const sp2 = Math.hypot(s.vx, s.vy);
        if (sp2 > s.maxSpeed) {
            s.vx *= 0.99;
            s.vy *= 0.99;
        }
        s.vx *= 1 - s.drag;
        s.vy *= 1 - s.drag;
        s.shootTimer -= dt;
        s.heat = clamp(
            s.heat - (aiDiff === "hard" ? 16 : 14) * dt,
            0,
            s.maxHeat,
        );
        s.x = wrap(s.x + s.vx, WORLD_W);
        s.y = wrap(s.y + s.vy, WORLD_H);
        s.boostTimer = Math.max(0, s.boostTimer - dt);
        s.boosting = s.boostTimer > 0;
        // ランダムブースト（Hardは頻度UP）
        const boostChance =
            aiDiff === "hard" ? 0.005 : aiDiff === "easy" ? 0.001 : 0.002;
        if (
            !s.ai.fleeing &&
            s.boostTimer <= 0 &&
            Math.random() < boostChance &&
            s.heat <= s.maxHeat - AI_SHOT_RESERVE
        ) {
            s.vx += Math.cos(s.angle) * 0.6;
            s.vy += Math.sin(s.angle) * 0.6;
            s.heat += 12;
            s.boostTimer = 0.08;
            s.boosting = true;
        }

        // AIの煙と残像生成
        const ca = Math.cos(s.angle),
            sa = Math.sin(s.angle);
        if (s.boosting) {
            let baseCol =
                window.isMultiplayer || window._testPlayMode
                    ? TEAM_COLORS[s.team]
                    : s.team === 3
                        ? TEAM_COLORS[3]
                        : TEAM_COLORS[2];
            if (!lightweightMode && GameFrames % 3 === 0) {
                particles.push({
                    x: s.x,
                    y: s.y,
                    vx: 0,
                    vy: 0,
                    life: 0.25,
                    maxLife: 0.25,
                    size: 14,
                    smoke: true,
                    isGhost: true,
                    angle: s.angle,
                    color: baseCol,
                });
            }
            if (GameFrames % 2 === 0) {
                spawnSmoke(s.x - ca * 12, s.y - sa * 12, 3, 2.0);
            }
        } else if (Math.hypot(s.vx, s.vy) > s.maxSpeed * 0.3) {
            // ある程度加速している時の通常煙
            if (GameFrames % 2 === 0) {
                spawnSmoke(s.x - ca * 12, s.y - sa * 12, 3, 2.0);
            }
        }
    }

    // ブースト音のコントロール
    if (boostGain && audioCtx) {
        // スムーズに音量を遷移させる
        const targetGain =
            isAnyPlayerBoosting && audioSettings.boostSound ? 1.0 : 0.0;
        boostGain.gain.setTargetAtTime(
            targetGain,
            audioCtx.currentTime,
            0.05,
        );
    }

    for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];

        const nextX = b.x + b.vx;
        const nextY = b.y + b.vy;

        // 世界の端（境界）に到達したらループさせずに消滅させる
        if (nextX < 0 || nextX >= WORLD_W || nextY < 0 || nextY >= WORLD_H) {
            bullets.splice(j, 1);
            continue;
        }

        b.x = nextX;
        b.y = nextY;
        b.life -= dt;

        // 寿命が尽きたら消える
        if (b.life <= 0) {
            bullets.splice(j, 1);
            continue;
        }

        let hit = false;
        for (const s of ships) {
            if (!s.alive || s.isGhost || s.id === b.owner) continue;
            if (
                areEnemies(s, {
                    id: b.owner,
                    team: b.ownerTeam,
                    faction: ships.find((o) => o.id === b.owner)?.faction,
                }) === false
            )
                continue;

            // 当たり判定を拡大（機体全体をカバーする半径24に設定）
            if (torusDist2(s.x, s.y, b.x, b.y) < (24 + b.radius) ** 2) {
                bullets.splice(j, 1);
                spawnExplosion(b.x, b.y, 14, 1.2);
                spawnSmoke(b.x, b.y, 5, 2.0); // レーザーヒット時の煙を追加

                if (showDamage) {
                    let dmgColor = "#ff0055";
                    const shooter = ships.find((o) => o.id === b.owner);
                    const shooterTeam = b.ownerTeam || (shooter ? shooter.team : 2);
                    if (window.isMultiplayer) {
                        dmgColor = TEAM_COLORS[shooterTeam];
                    } else {
                        dmgColor =
                            shooterTeam === 3
                                ? TEAM_COLORS[3]
                                : shooterTeam === 1
                                    ? TEAM_COLORS[1]
                                    : TEAM_COLORS[2];
                    }
                    floatingTexts.push(
                        new FloatingText(
                            s.x,
                            s.y,
                            "-20",
                            dmgColor,
                            1.0,
                            damageTextBaseSize,
                        ),
                    );
                }

                const isMine =
                    s.id === playerId ||
                    (!window.isMultiplayer && s.ai) ||
                    (window.isMultiplayer && isRoomHost()); // マルチプレイ時はホストが全判定

                if (isMine) {
                    const damage = 20;
                    s.hp -= damage;

                    if (window.isMultiplayer && isRoomHost()) {
                        // ホストがダメージを確定させて全員に通知
                        photonClient.raiseEvent(7, {
                            targetId: s.id,
                            damage: damage,
                            newHp: s.hp,
                            killerId: b.owner
                        }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others });
                    }

                    if (s.id === playerId) shakeCamera(10);

                    if (s.hp <= 0 && s.alive) {
                        spawnExplosion(s.x, s.y, 28, 2.2, "large");
                        spawnSmoke(s.x, s.y, 20, 4.0); // 機体爆発時の煙を大量に追加

                        if (s.id === playerId) {
                            s.isGhost = true;
                            s.hp = 0;
                            if (window.isMultiplayer && isRoomHost()) {
                                // ホストが撃破を確定
                                photonClient.raiseEvent(
                                    3,
                                    {
                                        killerId: b.owner,
                                        deadActorNr: s.id === playerId ? photonClient.myActor().actorNr : parseInt(s.id.split('_')[1]),
                                        x: s.x,
                                        y: s.y,
                                    },
                                    {
                                        receivers:
                                            Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                                    },
                                );
                            }
                            lives -= 1;
                            shakeCamera(20);
                            if (lives > 0) {
                                if (window.isMultiplayer)
                                    setTimeout(() => respawnMultiplayerPlayer(), 2000);
                                else setTimeout(() => respawnPlayer(), 600);
                            } else {
                                if (!window.isMultiplayer) enterGameOverMode();
                            }
                        } else {
                            s.alive = false;
                            s.hp = 0;
                            if (powerupsEnabled && Math.random() < s.dropRate)
                                spawnPowerUp(s.x, s.y);
                            if (!window.isMultiplayer) {
                                if (b.owner === playerId) {
                                    addScore(150, s.x, s.y);
                                    shakeCamera(10);
                                } else if (b.ownerTeam === getMyTeam()) addScore(50);
                            }
                            if (
                                window.isMultiplayer &&
                                isRoomHost() &&
                                s.ai &&
                                !s.isRemoteAI
                            ) {
                                if (s.lives > 0) {
                                    s.lives--;
                                    setTimeout(() => respawnAI(s), 2000);
                                }
                            }
                        }
                    }
                } else {
                    if (b.owner === playerId) shakeCamera(2);
                }
                hit = true;
                break;
            }
        }
        if (hit) continue;

        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            if (torusDist2(a.x, a.y, b.x, b.y) < (a.r + b.radius) ** 2) {
                a.hp -= 1;
                bullets.splice(j, 1);
                spawnExplosion(b.x, b.y, 10, 1);
                spawnSmoke(b.x, b.y, 4, 1.5); // アステロイドヒット時の煙を追加

                if (b.owner === playerId) shakeCamera(2);
                if (a.hp <= 0) {
                    splitAsteroid(a);
                    spawnExplosion(a.x, a.y, Math.floor(a.r / 3), 1.6);
                    spawnSmoke(a.x, a.y, 12, 3.0); // アステロイド破壊時の煙を追加
                    asteroids.splice(i, 1);
                }
                hit = true;
                break;
            }
        }
    }

    for (const a of asteroids) {
        a.x = wrap(a.x + a.vx, WORLD_W);
        a.y = wrap(a.y + a.vy, WORLD_H);
        a.rot += a.rotv;
    }

    for (const s of ships) {
        if (!s.alive || s.isGhost) continue;
        for (const a of asteroids) {
            const r = a.r + 12;
            if (torusDist2(s.x, s.y, a.x, a.y) < r * r) {
                if (s.id === playerId && gameOverMode) continue;
                const isMine =
                    s.id === playerId ||
                    (!window.isMultiplayer && s.ai) ||
                    (window.isMultiplayer && isRoomHost()); // マルチプレイ時はホストが全判定

                if (isMine) {
                    const damage = 40 * dt;
                    s.hp -= damage;

                    if (window.isMultiplayer && isRoomHost()) {
                        photonClient.raiseEvent(7, {
                            targetId: s.id,
                            damage: Math.round(damage),
                            newHp: s.hp,
                            killerId: -1 // Asteroid
                        }, { receivers: Photon.LoadBalancing.Constants.ReceiverGroup.Others });
                    }
                }
                if (Math.random() < dt * 14) spawnSmoke(s.x, s.y, 4, 1.2);
                if (s.id === playerId && Math.random() < 0.1) shakeCamera(5);

                if (isMine && s.hp <= 0 && s.alive) {
                    spawnExplosion(s.x, s.y, 30, 2.5, "large");
                    spawnSmoke(s.x, s.y, 20, 4.0); // 衝突による爆発時の煙を追加

                    if (s.id === playerId) {
                        s.isGhost = true;
                        s.hp = 0;
                        if (window.isMultiplayer && isRoomHost())
                            photonClient.raiseEvent(
                                3,
                                {
                                    killerId: -1,
                                    deadActorNr: s.id === playerId ? photonClient.myActor().actorNr : parseInt(s.id.split('_')[1]),
                                    x: s.x,
                                    y: s.y,
                                },
                                {
                                    receivers:
                                        Photon.LoadBalancing.Constants.ReceiverGroup.Others,
                                },
                            );
                        lives -= 1;
                        shakeCamera(20);
                        if (lives > 0) {
                            if (window.isMultiplayer)
                                setTimeout(() => respawnMultiplayerPlayer(), 2000);
                            else setTimeout(() => respawnPlayer(), 600);
                        } else {
                            if (!window.isMultiplayer) enterGameOverMode();
                        }
                    } else {
                        s.alive = false;
                        s.hp = 0;
                        if (
                            window.isMultiplayer &&
                            isRoomHost() &&
                            s.ai &&
                            !s.isRemoteAI
                        ) {
                            if (s.lives > 0) {
                                s.lives--;
                                setTimeout(() => respawnAI(s), 2000);
                            }
                        }
                    }
                }
            }
        }
    }

    for (const p of particles) {
        p.life -= dt;
        if (p.isGhost) continue;
        p.x = wrap(p.x + p.vx, WORLD_W);
        p.y = wrap(p.y + p.vy, WORLD_H);
        p.vx *= 0.99;
        p.vy *= 0.99;
    }
    particles = particles.filter((p) => p.life > 0);
    if (lightweightMode && particles.length > PARTICLE_DRAW_LIMIT)
        particles.length = PARTICLE_DRAW_LIMIT;

    if (
        !window.isMultiplayer &&
        ships.filter((s) => s.faction === "enemy" && s.alive).length === 0
    ) {
        const alliesAlive = ships.filter(
            (s) => s.faction === "ally" && s.alive,
        ).length;
        const desiredRaw = alliesAlive + randInt(-1, 1);
        const target = Math.max(alliesAlive, desiredRaw, 7);
        const spawnEnemies = target;
        const spawnAllies = Math.max(0, target - alliesAlive);
        const currentAsteroids = asteroids.length;
        const targetAsteroids = randInt(25, 30);
        const need = Math.max(0, targetAsteroids - currentAsteroids);
        if (need > 0) spawnAsteroids(need);
        wave += 1;
        spawnWave(spawnEnemies, spawnAllies);
        message = `WAVE ${wave}!`;
        if (player && player.alive)
            floatingTexts.push(
                new FloatingText(
                    player.x,
                    player.y - 100,
                    `WAVE ${wave}`,
                    "#00f0ff",
                    2.0,
                    damageTextBaseSize * 1.5,
                ),
            );
    }
    fpsFrames += 1;
    fpsAccum += dt;
    if (fpsAccum >= 1.0) {
        fpsDisplay = Math.round(fpsFrames / fpsAccum);
        fpsFrames = 0;
        fpsAccum = 0;
    }
}

/* ========== 描画ルーチン ========== */
var starCaches = [];
var starCacheNeedsRegen = true;
var lastStarVW = 0,
    lastStarVH = 0;
var GameFrames = 0;
function regenStarCaches(vw, vh) {
    starCaches = [];
    lastStarVW = vw;
    lastStarVH = vh;
    starCacheNeedsRegen = false;
    const totalBase = lightweightMode ? 1000 : 1600;
    for (let li = 0; li < STAR_LAYERS.length; li++) {
        const layerFactor = 1 + li * 0.4;
        const count = Math.max(
            8,
            Math.floor((totalBase * layerFactor) / STAR_LAYERS.length),
        );
        const arr = [];
        for (let i = 0; i < count; i++) {
            const colRoll = Math.random();
            const alpha = rand(0.45, 1.0);
            const color =
                colRoll < 0.33
                    ? `rgba(138,173,221,${alpha})`
                    : colRoll < 0.66
                        ? `rgba(222,239,255,${alpha})`
                        : `rgba(255,255,255,${alpha})`;
            const size = lightweightMode
                ? Math.random() * 3.0 + 1.0
                : Math.random() * 3.0 + 1.0;
            arr.push({
                x: Math.floor(Math.random() * WORLD_W),
                y: Math.floor(Math.random() * WORLD_H),
                size: Math.max(1, Math.round(size)),
                color,
            });
        }
        starCaches.push(arr);
    }
}

function drawStars(ctx, w, h, camX, camY, vLeft, vRight, vTop, vBottom) {
    if (!showStars) return;
    if (
        !starCaches ||
        starCaches.length !== STAR_LAYERS.length ||
        starCacheNeedsRegen ||
        lastStarVW !== w ||
        lastStarVH !== h
    ) {
        regenStarCaches(w, h);
    }
    ctx.save();
    for (let li = 0; li < STAR_LAYERS.length; li++) {
        const par = STAR_LAYERS[li];
        ctx.globalAlpha = lightweightMode
            ? 0.6 + li * 0.08
            : 0.25 + li * 0.15;
        const arr = starCaches[li] || [];
        for (let si = 0; si < arr.length; si++) {
            const s = arr[si];
            const sc = toScreen(s.x, s.y, camX * par, camY * par, w, h);
            if (
                sc.sx < vLeft - 8 ||
                sc.sx > vRight + 8 ||
                sc.sy < vTop - 8 ||
                sc.sy > vBottom + 8
            )
                continue;
            ctx.fillStyle = s.color;
            ctx.fillRect(Math.round(sc.sx), Math.round(sc.sy), s.size, s.size);
        }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
}

function render() {
    GameFrames++;
    const vw = canvas.width / dpr,
        vh = canvas.height / dpr;
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(zoomLevel, zoomLevel);
    const playerForCam = ships.find((s) => s.id === playerId);
    if (minecraftMode && playerForCam && !playerForCam.isGhost) {
        ctx.rotate(-playerForCam.angle - Math.PI / 2);
    }
    ctx.translate(-vw / 2, -vh / 2);

    let halfVisW = vw / 2 / zoomLevel;
    let halfVisH = vh / 2 / zoomLevel;
    if (minecraftMode && playerForCam && !playerForCam.isGhost) {
        const maxVis = Math.max(vw, vh) / zoomLevel;
        halfVisW = maxVis;
        halfVisH = maxVis;
    }
    const vLeft = vw / 2 - halfVisW;
    const vRight = vw / 2 + halfVisW;
    const vTop = vh / 2 - halfVisH;
    const vBottom = vh / 2 + halfVisH;

    if (cameraShake > 0) {
        const sx = (rand(-cameraShake, cameraShake) * dpr) / zoomLevel;
        const sy = (rand(-cameraShake, cameraShake) * dpr) / zoomLevel;
        ctx.translate(sx, sy);
    }
    const player = ships.find((s) => s.id === playerId);
    const camX = player?.x ?? 0;
    const camY = player?.y ?? 0;
    if (showStars)
        drawStars(ctx, vw, vh, camX, camY, vLeft, vRight, vTop, vBottom);

    let drawnAsteroids = 0;
    for (const a of asteroids) {
        if (drawnAsteroids >= ASTEROID_DRAW_LIMIT) break;
        const sc = toScreen(a.x, a.y, camX, camY, vw, vh);
        if (
            sc.sx < vLeft - a.r - 10 ||
            sc.sx > vRight + a.r + 10 ||
            sc.sy < vTop - a.r - 10 ||
            sc.sy > vBottom + a.r + 10
        )
            continue;
        drawAsteroid(ctx, a, sc.sx, sc.sy);
        drawnAsteroids++;
    }

    for (const pu of powerups) {
        const sc = toScreen(pu.x, pu.y, camX, camY, vw, vh);
        if (
            sc.sx < vLeft - 20 ||
            sc.sx > vRight + 20 ||
            sc.sy < vTop - 20 ||
            sc.sy > vBottom + 20
        )
            continue;
        ctx.save();
        ctx.translate(sc.sx, sc.sy);
        ctx.rotate(pu.rotation);
        if (pu.life < 3.0 && Math.floor(pu.life * 10) % 2 === 0)
            ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = pu.color;
        ctx.strokeStyle = pu.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -pu.radius);
        ctx.lineTo(pu.radius, 0);
        ctx.lineTo(0, pu.radius);
        ctx.lineTo(-pu.radius, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    for (const b of bullets) {
        const sc = toScreen(b.x, b.y, camX, camY, vw, vh);
        const ang = Math.atan2(b.vy, b.vx);
        const owner = ships.find((s) => s.id === b.owner);
        let col = "#ffd";
        if (owner) {
            if (owner.id === playerId && gameOverMode) col = "#888";
            else
                col =
                    window.isMultiplayer || window._testPlayMode
                        ? TEAM_COLORS[owner.team]
                        : owner.team === 3
                            ? TEAM_COLORS[3]
                            : owner.id === playerId
                                ? TEAM_COLORS[1]
                                : TEAM_COLORS[2];
        }
        if (
            sc.sx < vLeft - 60 ||
            sc.sx > vRight + 60 ||
            sc.sy < vTop - 60 ||
            sc.sy > vBottom + 60
        )
            continue;
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = col;
        ctx.lineWidth = b.width || 3;
        const x1 = sc.sx,
            y1 = sc.sy,
            x2 = x1 - Math.cos(ang) * (b.length || 48),
            y2 = y1 - Math.sin(ang) * (b.length || 48);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (DRAW_GLOW && showGlow) {
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = col;
            ctx.globalAlpha = 0.12;
            ctx.lineWidth = (b.width || 3) * 6;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
        }
    }
    ctx.restore();

    const particleDrawCount = !showParticles
        ? 0
        : lightweightMode
            ? Math.min(particles.length, PARTICLE_DRAW_LIMIT)
            : particles.length;
    for (let pi = 0; pi < particleDrawCount; pi++) {
        const p = particles[pi];
        const sc = toScreen(p.x, p.y, camX, camY, vw, vh);
        if (
            sc.sx < vLeft - 30 ||
            sc.sx > vRight + 30 ||
            sc.sy < vTop - 30 ||
            sc.sy > vBottom + 30
        )
            continue;
        const t = 1 - p.life / p.maxLife;
        if (p.isGhost) {
            ctx.save();
            ctx.translate(sc.sx, sc.sy);
            ctx.rotate(p.angle);
            const scalePhase = 1.0 + t * 0.5;
            ctx.scale(scalePhase, scalePhase);
            const gCol = p.color || "#00f0ff";
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = gCol;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(5, -6);
            ctx.lineTo(-5, -16);
            ctx.lineTo(-15, -16);
            ctx.lineTo(-10, -5);
            ctx.lineTo(-20, -8);
            ctx.lineTo(-20, -3);
            ctx.lineTo(-15, 0);
            ctx.lineTo(-20, 3);
            ctx.lineTo(-20, 8);
            ctx.lineTo(-10, 5);
            ctx.lineTo(-15, 16);
            ctx.lineTo(-5, 16);
            ctx.lineTo(5, 6);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        } else {
            ctx.globalAlpha = 1 - t;
            ctx.beginPath();
            ctx.arc(sc.sx, sc.sy, p.size * (1 + t * 2), 0, TAU);
            if (p.smoke) {
                ctx.fillStyle = `rgba(160,160,170,${Math.max(0.05, 0.9 * (1 - t))})`;
            } else {
                ctx.fillStyle = t < 0.5 ? "#fbe" : "#fec";
            }
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    for (const s of ships) {
        if (!s.alive && !(s.id === playerId && gameOverMode) && !s.isGhost)
            continue;
        const sc = toScreen(s.x, s.y, camX, camY, vw, vh);
        if (
            sc.sx < vLeft - 40 ||
            sc.sx > vRight + 40 ||
            sc.sy < vTop - 40 ||
            sc.sy > vBottom + 40
        )
            continue;
        drawShip(ctx, s, sc.sx, sc.sy);

        // Draw Aim Line
        if (s.id === playerId && featureSettings.aimLine && !s.isGhost && !gameOverMode) {
            ctx.save();
            // Faint gray solid line with no glow
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = "rgba(220, 220, 220, 1.0)";
            ctx.lineWidth = 1;
            ctx.beginPath();

            // Start from slightly ahead of the ship body (offset arbitrarily instead of undefined s.size)
            const off = 25;
            const startX = sc.sx + Math.cos(s.angle) * off;
            const startY = sc.sy + Math.sin(s.angle) * off;
            const endX = startX + Math.cos(s.angle) * 2000;
            const endY = startY + Math.sin(s.angle) * 2000;

            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            ctx.restore();
        }
    }

    for (const ft of floatingTexts) {
        const sc = toScreen(ft.x, ft.y, camX, camY, vw, vh);
        if (
            sc.sx < vLeft - 40 ||
            sc.sx > vRight + 40 ||
            sc.sy < vTop - 40 ||
            sc.sy > vBottom + 40
        )
            continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
        ctx.fillStyle = ft.color;
        if (showGlow) {
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 8;
        }
        ctx.font = `bold ${ft.size}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(ft.text, sc.sx, sc.sy);
        ctx.restore();
    }

    ctx.restore();
    drawUI(ctx, vLeft, vRight, vTop, vBottom);
}

function drawAsteroid(ctx, a, sx, sy) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a.rot);
    ctx.strokeStyle = "#aab";
    ctx.fillStyle = "#556";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const spikes = a.spikes || 10,
        r = a.r;
    for (let i = 0; i < spikes; i++) {
        const ang = (i / spikes) * TAU;
        const offset =
            a.offsets && a.offsets[i]
                ? a.offsets[i]
                : 0.7 + 0.5 * Math.sin(i * 2.3);
        const rr = r * offset;
        const x = Math.cos(ang) * rr,
            y = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawShip(ctx, s, sx, sy) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(s.angle);
    let base =
        window.isMultiplayer || window._testPlayMode
            ? TEAM_COLORS[s.team]
            : s.id === playerId
                ? TEAM_COLORS[1]
                : s.team === 3
                    ? TEAM_COLORS[3]
                    : TEAM_COLORS[2];

    if (
        (s.id === playerId && gameOverMode) ||
        s.invulnerable ||
        s.isGhost
    ) {
        base = "rgba(100,100,100,0.5)";
    }
    const roll = s.rollPhase;
    ctx.scale(1, 1 + Math.sin(roll) * 0.05);

    if (showGlow && !s.isGhost && DRAW_GLOW) {
        ctx.shadowColor = base;
        ctx.shadowBlur = 10;
    }

    // 王道でかっこいいSF戦闘機デザイン
    ctx.fillStyle = "rgba(10, 15, 25, 0.95)";
    ctx.strokeStyle = base;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(24, 0); // 機首先端
    ctx.lineTo(10, -4); // 機首サイド
    ctx.lineTo(4, -6); // 主翼付け根前
    ctx.lineTo(-4, -20); // 主翼先端前
    ctx.lineTo(-12, -20); // 主翼先端後
    ctx.lineTo(-8, -6); // 主翼付け根後
    ctx.lineTo(-18, -12); // 尾翼先端
    ctx.lineTo(-20, -4); // スラスター外側
    ctx.lineTo(-16, 0); // スラスター中央
    ctx.lineTo(-20, 4); // スラスター外側
    ctx.lineTo(-18, 12); // 尾翼先端
    ctx.lineTo(-8, 6); // 主翼付け根後
    ctx.lineTo(-12, 20); // 主翼先端後
    ctx.lineTo(-4, 20); // 主翼先端前
    ctx.lineTo(4, 6); // 主翼付け根前
    ctx.lineTo(10, 4); // 機首サイド
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // キャノピー（操縦席のガラス部分）
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(2, -3);
    ctx.lineTo(-6, 0);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fillStyle = "rgba(200, 255, 255, 0.15)";
    ctx.fill();
    ctx.stroke();

    // 翼のパネルライン（アクセント）
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-8, -16);
    ctx.moveTo(0, 5);
    ctx.lineTo(-8, 16);
    ctx.stroke();
    // パワーアップリングは自機の回転を打ち消して描画（12時位置が常に上）
    ctx.rotate(-s.angle);
    if (
        s.weaponType > 0 &&
        s.weaponStartTime &&
        s.weaponDuration &&
        !s.isGhost
    ) {
        const elapsed = performance.now() - s.weaponStartTime;
        const ratio = Math.max(0, 1 - elapsed / s.weaponDuration);
        const ringColor = s.weaponType === 1 ? "#00f0ff" : "#ff00ff";
        const pulse = 0.6 + Math.sin(performance.now() / 200) * 0.15;
        // 外側リング(タイマー連動アーク、12時から時計回りに消える)
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = pulse;
        ctx.stroke();
        // グロー
        if (showGlow && DRAW_GLOW) {
            ctx.beginPath();
            ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = 8;
            ctx.globalAlpha = 0.12;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    // HP回復リングエフェクト（拡大フェードアウト）
    if (s.healRing) {
        const hr = s.healRing;
        const t = 1 - hr.life / hr.maxLife;
        const radius = 20 + t * 50;
        const alpha = (1 - t) * 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, TAU);
        ctx.strokeStyle = hr.color;
        ctx.lineWidth = 3 * (1 - t);
        ctx.globalAlpha = alpha;
        ctx.stroke();
        if (showGlow && DRAW_GLOW) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, TAU);
            ctx.strokeStyle = hr.color;
            ctx.lineWidth = 12 * (1 - t);
            ctx.globalAlpha = alpha * 0.3;
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    ctx.rotate(s.angle);

    ctx.rotate(-s.angle);
    ctx.translate(-sx, -sy);

    ctx.save();
    ctx.translate(sx, sy);
    if (minecraftMode) {
        const playerForCam = ships.find((ship) => ship.id === playerId);
        if (playerForCam && !playerForCam.isGhost) {
            ctx.rotate(playerForCam.angle + Math.PI / 2);
        }
    }

    // HPバー
    if (!s.isGhost) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.8;
        const hpw = 34,
            hpx = -hpw / 2,
            hpy = -40;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(hpx - 1, hpy - 1, hpw + 2, 5);
        ctx.fillStyle = "#222";
        ctx.fillRect(hpx, hpy, hpw, 3);
        ctx.fillStyle = base;
        ctx.fillRect(hpx, hpy, hpw * (Math.max(0, s.hp) / s.maxHp), 3);
        ctx.globalAlpha = 1;
    }

    if (s.isGhost && s.id === playerId) {
        ctx.fillStyle = "#aaa";
        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.fillText("SPECTATING", -35, -20);
    }

    // プレイヤー名の表示 (マルチプレイ時)
    if (
        window.isMultiplayer &&
        (s.faction === "player" || s.isRemotePlayer) &&
        !s.isGhost
    ) {
        let name = "UNKNOWN";
        if (s.id === playerId) {
            name = localStorage.getItem("playerNickname_v1") || "YOU";
        } else if (photonClient && photonClient.myRoomActors()) {
            const actId = s.id.split("_")[1];
            if (actId && photonClient.myRoomActors()[actId]) {
                name =
                    photonClient.myRoomActors()[actId].getCustomProperty("name") ||
                    `PILOT ${actId}`;
            }
        }
        ctx.fillStyle = base;
        ctx.font = "bold 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 4;
        ctx.fillText(name, 0, -48);
        ctx.shadowBlur = 0;
        ctx.textAlign = "start";
    }

    ctx.restore();
    ctx.restore();
}

function drawUI(ctx, vLeft, vRight, vTop, vBottom) {
    const vw = canvas.width / dpr,
        vh = canvas.height / dpr;
    const scoreLayout = getCanvasLayout('hud_score', 20 + safeAreaMarginX, 36 + safeAreaMarginY);
    ctx.save();
    ctx.translate(scoreLayout.x, scoreLayout.y);
    ctx.scale(scoreLayout.s, scoreLayout.s);

    ctx.fillStyle = "#fff";
    ctx.font = "16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 8;

    let curY = 0;
    if (!window.isMultiplayer) {
        ctx.fillText(`SCORE ${String(ScoreManager.get()).padStart(6, "0")}`, 0, curY);
        curY += 24;
    }
    ctx.fillText(`LIVES ${lives}`, 0, curY);
    curY += 24;
    if (!window.isMultiplayer) {
        ctx.fillText(`WAVE ${wave}`, 0, curY);
        curY += 24;
    }
    ctx.shadowBlur = 0;

    const p = ships.find((s) => s.id === playerId);
    if (p && !p.isGhost) {
        const w2 = 160, h2 = 8;
        curY += 12; // margin for heat gauge
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(-2, curY - 2, w2 + 4, h2 + 4);
        ctx.fillStyle = "#222";
        ctx.fillRect(0, curY, w2, h2);
        const t = p.heat / p.maxHeat;
        ctx.fillStyle = t > 0.8 ? "#ff0055" : t > 0.5 ? "#ffb300" : "#00f0ff";
        if (showGlow) {
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 5;
        }
        ctx.fillRect(0, curY, w2 * t, h2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "12px ui-monospace, monospace";
        ctx.fillText("HEAT", 0, curY - 6);
        if (p.weaponTimer > 0) {
            ctx.fillStyle = p.weaponType === 1 ? "#00f0ff" : "#f0f";
            ctx.fillText(`WPN: ${Math.ceil(p.weaponTimer)}s`, 0, curY + 24);
        }
    }
    ctx.restore();

    if (showHelp) {
        const lines = [message];
        const boxW = Math.min(700, vw - 40),
            boxH = 40,
            bx = vw / 2 - boxW / 2,
            by = 20;
        ctx.fillStyle = "rgba(0, 10, 20, 0.7)";
        ctx.fillRect(bx - 8, by - 8, boxW + 16, boxH + 16);
        ctx.strokeStyle = "rgba(0,240,255,0.4)";
        ctx.strokeRect(bx - 8, by - 8, boxW + 16, boxH + 16);
        ctx.fillStyle = "#00f0ff";
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 5;
        lines.forEach((ln, i) => ctx.fillText(ln, bx, by + 24 + i * 22));
        ctx.shadowBlur = 0;
    }

    if (isPaused) {
        ctx.fillStyle = "rgba(0, 5, 10, 0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
    const _myRef = ships.find((s) => s.id === playerId) || {
        id: playerId,
        faction: "player",
        team: getMyTeam(),
    };
    const enemiesAlive = ships.filter(
        (s) =>
            areEnemies(_myRef, s) &&
            ((s.alive && !s.isGhost) || (s.lives !== undefined && s.lives > 0)),
    ).length;
    const alliesAlive = ships.filter(
        (s) =>
            !areEnemies(_myRef, s) &&
            ((s.alive && !s.isGhost) ||
                (s.lives !== undefined && s.lives > 0) ||
                (s.id === playerId && lives > 0)),
    ).length;
    const baseEx = Math.max(16, vw - 180 - safeAreaMarginX);
    const teamLayout = getCanvasLayout('hud_teams', baseEx, 36 + safeAreaMarginY);
    ctx.save();
    ctx.translate(teamLayout.x, teamLayout.y);
    ctx.scale(teamLayout.s, teamLayout.s);
    ctx.fillStyle = "#00f0ff";
    ctx.font = "16px ui-monospace, monospace";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 8;
    ctx.fillText(
        `ENEMIES ${String(enemiesAlive).padStart(3, " ")}`,
        0,
        0,
    );
    ctx.fillText(
        `ALLIES ${String(alliesAlive).padStart(3, " ")}`,
        0,
        24,
    );
    ctx.restore();

    const cam = ships.find((s) => s.id === playerId) || {
        x: WORLD_W / 2,
        y: WORLD_H / 2,
    };
    const margin = 24;
    const hw = vw / 2 - margin,
        hh = vh / 2 - margin;
    for (const en of ships.filter(
        (s) => areEnemies(_myRef, s) && s.alive && !s.isGhost,
    )) {
        const d = torusDelta(en.x, en.y, cam.x, cam.y);
        const sx = d.dx + vw / 2,
            sy = d.dy + vh / 2;
        if (
            vLeft !== undefined &&
            sx >= vLeft &&
            sx <= vRight &&
            sy >= vTop &&
            sy <= vBottom
        )
            continue;
        let ang = Math.atan2(d.dy, d.dx);
        if (minecraftMode && cam && !cam.isGhost) {
            ang -= (cam.angle + Math.PI / 2);
        }
        const c = Math.cos(ang),
            s = Math.sin(ang);
        const eps = 1e-6;
        const scale = Math.min(
            Math.abs(c) > eps ? hw / Math.abs(c) : 1e6,
            Math.abs(s) > eps ? hh / Math.abs(s) : 1e6,
        );
        const px = vw / 2 + c * scale,
            py = vh / 2 + s * scale;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.9;
        const col =
            window.isMultiplayer || window._testPlayMode
                ? TEAM_COLORS[en.team]
                : TEAM_COLORS[2];
        ctx.fillStyle = col;
        if (showGlow) {
            ctx.shadowColor = col;
            ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-8, 10);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, -10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    for (const al of ships.filter(
        (s) =>
            !areEnemies(_myRef, s) &&
            s.id !== playerId &&
            s.alive &&
            !s.isGhost,
    )) {
        const d = torusDelta(al.x, al.y, cam.x, cam.y);
        const sx = d.dx + vw / 2,
            sy = d.dy + vh / 2;
        if (
            vLeft !== undefined &&
            sx >= vLeft &&
            sx <= vRight &&
            sy >= vTop &&
            sy <= vBottom
        )
            continue;
        let ang = Math.atan2(d.dy, d.dx);
        if (minecraftMode && cam && !cam.isGhost) {
            ang -= (cam.angle + Math.PI / 2);
        }
        const c = Math.cos(ang),
            s = Math.sin(ang);
        const eps = 1e-6;
        const scale = Math.min(
            Math.abs(c) > eps ? hw / Math.abs(c) : 1e6,
            Math.abs(s) > eps ? hh / Math.abs(s) : 1e6,
        );
        const px = vw / 2 + c * scale,
            py = vh / 2 + s * scale;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.9;
        const col =
            window.isMultiplayer || window._testPlayMode
                ? TEAM_COLORS[al.team]
                : al.faction === "ally"
                    ? TEAM_COLORS[3]
                    : TEAM_COLORS[1];
        ctx.fillStyle = col;
        if (showGlow) {
            ctx.shadowColor = col;
            ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-8, 10);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, -10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    ctx.font = "14px ui-monospace, monospace";
    const fpsText = `FPS ${String(fpsDisplay).padStart(2, " ")}`;
    const metrics = ctx.measureText(fpsText);

    const fpX = vw - metrics.width - 16 - safeAreaMarginX;
    const fpY = vh - 28 - safeAreaMarginY;
    const fpsLayout = getCanvasLayout('hud_fps', fpX, fpY);

    ctx.translate(fpsLayout.x, fpsLayout.y);
    ctx.scale(fpsLayout.s, fpsLayout.s);

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, metrics.width + 12, 22);
    ctx.fillStyle = "#00f0ff";
    ctx.fillText(fpsText, +6, +16);
    ctx.restore();

    if (showMinimap) {
        const mapW = 140,
            mapH = 140;
        const mX = 32 + safeAreaMarginX;
        const mY = vh - mapH - 32 - safeAreaMarginY;
        const mapLayout = getCanvasLayout('hud_minimap', mX, mY, mapW, mapH);

        ctx.save();
        ctx.translate(mapLayout.x, mapLayout.y);
        ctx.scale(mapLayout.s, mapLayout.s);

        const p = ships.find((s) => s.id === playerId);
        if (minecraftMode && p && !p.isGhost) {
            ctx.translate(mapW / 2, mapH / 2);
            ctx.rotate(-p.angle - Math.PI / 2);
            ctx.translate(-mapW / 2, -mapH / 2);
        }

        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "rgba(0,10,20,0.7)";
        ctx.fillRect(-4, -4, mapW + 8, mapH + 8);
        ctx.strokeStyle = "rgba(0,240,255,0.4)";
        ctx.strokeRect(-4, -4, mapW + 8, mapH + 8);
        const sx = mapW / WORLD_W,
            sy = mapH / WORLD_H;
        if (showMinimapAsteroids) {
            for (const a of asteroids) {
                ctx.fillStyle = "rgba(100,160,160,0.9)";
                ctx.fillRect(
                    (a.x % WORLD_W) * sx - 1,
                    (a.y % WORLD_H) * sy - 1,
                    2,
                    2,
                );
            }
        }
        for (const al of ships.filter(
            (s) =>
                !areEnemies(_myRef, s) &&
                s.alive &&
                !s.isGhost &&
                s.id !== playerId,
        )) {
            ctx.fillStyle =
                window.isMultiplayer || window._testPlayMode
                    ? TEAM_COLORS[al.team]
                    : al.faction === "ally"
                        ? TEAM_COLORS[3]
                        : TEAM_COLORS[1];
            ctx.fillRect(
                (al.x % WORLD_W) * sx - 2,
                (al.y % WORLD_H) * sy - 2,
                4,
                4,
            );
        }
        for (const en of ships.filter(
            (s) => areEnemies(_myRef, s) && s.alive && !s.isGhost,
        )) {
            ctx.fillStyle =
                window.isMultiplayer || window._testPlayMode
                    ? TEAM_COLORS[en.team]
                    : TEAM_COLORS[2];
            ctx.fillRect(
                (en.x % WORLD_W) * sx - 2,
                (en.y % WORLD_H) * sy - 2,
                4,
                4,
            );
        }
        if (p) {
            ctx.fillStyle =
                window.isMultiplayer || window._testPlayMode
                    ? TEAM_COLORS[p.team]
                    : TEAM_COLORS[1];
            ctx.beginPath();
            ctx.arc(
                (p.x % WORLD_W) * sx,
                (p.y % WORLD_H) * sy,
                4,
                0,
                TAU,
            );
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

/* ========== ヘルパー ========== */
function attemptShoot(s, target) {
    if (s.shootTimer > 0 || s.heat > s.maxHeat - AI_SHOT_RESERVE) return;
    const diff = s.ai?.difficulty || "normal";
    if (diff === "easy") {
        // Easy: 照準にランダムオフセットを追加
        const savedAngle = s.angle;
        s.angle += rand(-0.15, 0.15);
        fireBullet(s, 47, 7, 0.6);
        s.angle = savedAngle;
    } else {
        fireBullet(s, 47, 7, diff === "hard" ? 0.2 : 0.45);
    }
    s.heat += diff === "hard" ? 8 : 10;
    s.shootTimer = s.shootCd / 1000;
}
function respawnPlayer() {
    for (let i = ships.length - 1; i >= 0; i--) {
        if (ships[i].id === playerId) ships.splice(i, 1);
    }
    const p = {
        id: playerId,
        faction: "player",
        team: getMyTeam(),
        x: WORLD_W / 2,
        y: WORLD_H / 2,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        turnSpeed: 0.07,
        thrust: 0.12,
        maxSpeed: 6,
        drag: 0.005,
        heat: 0,
        maxHeat: 100,
        boosting: false,
        boostTimer: 0,
        shootCd: 100,
        shootTimer: 0,
        alive: true,
        isGhost: false,
        hp: 250,
        maxHp: 250,
        scoreValue: 0,
        rollPhase: 0,
        ai: null,
        weaponType: 0,
        weaponTimer: 0,
    };
    ships.push(p);
}
function respawnMultiplayerPlayer() {
    if (matchEnded || !running || !window.isMultiplayer) return;
    const p = ships.find((s) => s.id === playerId);
    if (!p) return;
    let mX = WORLD_W / 2,
        mY = WORLD_H / 2;
    if (photonClient) {
        const myActorNr = photonClient.myActor().actorNr;
        if (
            window.currentRoomSettings.spawns &&
            window.currentRoomSettings.spawns[myActorNr]
        ) {
            mX = window.currentRoomSettings.spawns[myActorNr].x;
            mY = window.currentRoomSettings.spawns[myActorNr].y;
        } else {
            mX =
                photonClient.myActor().getCustomProperty("spawnX") || WORLD_W / 2;
            mY =
                photonClient.myActor().getCustomProperty("spawnY") || WORLD_H / 2;
        }
    }
    p.x = wrap(mX + rand(-50, 50), WORLD_W);
    p.y = wrap(mY + rand(-50, 50), WORLD_H);
    p.vx = 0;
    p.vy = 0;
    p.hp = p.maxHp;
    p.heat = 0;
    p.alive = true;
    p.isGhost = false;
    p.weaponType = 0;
    p.weaponStartTime = 0;
    p.weaponDuration = 0;
}
function respawnAI(s) {
    if (matchEnded || !running || !window.isMultiplayer) return;
    s.hp = s.maxHp;
    s.alive = true;
    s.isGhost = false;
    s.heat = 0;
    s.vx = 0;
    s.vy = 0;
    const pSpawns = [];
    const actors = photonClient.myRoomActors();
    for (let aId in actors) {
        if (actors[aId].getCustomProperty("team") === s.team) {
            let px = actors[aId].getCustomProperty("spawnX") || WORLD_W / 2;
            let py = actors[aId].getCustomProperty("spawnY") || WORLD_H / 2;
            if (
                window.currentRoomSettings.spawns &&
                window.currentRoomSettings.spawns[aId]
            ) {
                px = window.currentRoomSettings.spawns[aId].x;
                py = window.currentRoomSettings.spawns[aId].y;
            }
            pSpawns.push({ x: px, y: py });
        }
    }
    if (pSpawns.length > 0) {
        const base = pSpawns[randInt(0, pSpawns.length - 1)];
        s.x = wrap(base.x + rand(-300, 300), WORLD_W);
        s.y = wrap(base.y + rand(-300, 300), WORLD_H);
    } else {
        s.x = rand(0, WORLD_W);
        s.y = rand(0, WORLD_H);
    }
}

/* ========== メインループ ========== */
function frame(t) {
    const dt = Math.min(1 / 30, (t - last) / 1000);
    last = t;
    if (running) {
        update(dt);
    } else {
        if (cameraShake > 0) {
            cameraShake *= 0.9;
            if (cameraShake < 0.5) cameraShake = 0;
        }
    }
    render();
    requestAnimationFrame(frame);
}

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
});
lightweightToggle?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        applyLightweightMode(!lightweightMode);
        setLightweightUI(lightweightMode);
        applyFeatureSettingsToRuntime();
    }
});

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
                const result = await window.checkNicknameUnique(name, currentUid);
                if (!result.unique) {
                    const errContainer = document.getElementById("nicknameErrorContainer");
                    const errMsg = document.getElementById("nicknameErrorMessage");
                    const loginBtn = document.getElementById("nicknameLoginBtn");
                    
                    if (isAnon && !result.ownerIsAnonymous) {
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
        }
        
        saveNicknameBtn.disabled = false;
        saveNicknameBtn.innerText = "システム起動";

        localStorage.setItem("playerNickname_v1", name);
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

/* ========== デベロッパーモード ========== */
let devMode = localStorage.getItem("devMode_v1") === "1";
const toggleDevModeElem = document.getElementById("toggleDevMode");
const btnTestPlay = document.getElementById("btnTestPlay");

function updateDevModeUI() {
    setToggleElem(toggleDevModeElem, devMode);
    if (btnTestPlay)
        btnTestPlay.style.display = devMode ? "inline-block" : "none";
}
updateDevModeUI();

toggleDevModeElem?.addEventListener("click", () => {
    devMode = !devMode;
    localStorage.setItem("devMode_v1", devMode ? "1" : "0");
    updateDevModeUI();
});
toggleDevModeElem?.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleDevModeElem.click();
    }
});

// 基本設定ボタン → 画面設定モーダルを開く
document
    .getElementById("openDevSettings")
    ?.addEventListener("click", () => {
        basicSettingsModal.style.display = "block";
        pauseSettingsMenu.style.display = "none";
        updateDevModeUI();
    });

// テストプレイ
let tpSpectate = false;
let tpWaveSpawn = true;
let tpFriendlyFire = false;
let tpPowerups = true;
const toggleSpectateElem = document.getElementById("toggleSpectate");
const toggleWaveSpawnElem = document.getElementById("toggleWaveSpawn");
const toggleFriendlyFireElem =
    document.getElementById("toggleFriendlyFire");
const togglePowerupsElem = document.getElementById("togglePowerups");

function wireTestToggle(elem, getter, setter) {
    if (!elem) return;
    elem.addEventListener("click", () => {
        const v = !getter();
        setter(v);
        setToggleElem(elem, v);
    });
    elem.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            elem.click();
        }
    });
}
wireTestToggle(
    toggleSpectateElem,
    () => tpSpectate,
    (v) => (tpSpectate = v),
);
wireTestToggle(
    toggleWaveSpawnElem,
    () => tpWaveSpawn,
    (v) => (tpWaveSpawn = v),
);
wireTestToggle(
    toggleFriendlyFireElem,
    () => tpFriendlyFire,
    (v) => (tpFriendlyFire = v),
);
wireTestToggle(
    togglePowerupsElem,
    () => tpPowerups,
    (v) => (tpPowerups = v),
);

// チーム数切替
document
    .getElementById("tpTeamCount")
    ?.addEventListener("change", (e) => {
        const count = parseInt(e.target.value);
        document.querySelectorAll(".tp-team-block").forEach((block) => {
            const teamNum = parseInt(block.dataset.team);
            block.style.display = teamNum <= count ? "" : "none";
        });
    });

btnTestPlay?.addEventListener("click", () => {
    document.getElementById("modeSelectModal").style.display = "none";
    document.getElementById("testPlayModal").style.display = "block";
});
document
    .getElementById("btnBackFromTestPlay")
    ?.addEventListener("click", () => {
        document.getElementById("testPlayModal").style.display = "none";
        document.getElementById("modeSelectModal").style.display = "block";
    });

document
    .getElementById("btnStartTestPlay")
    ?.addEventListener("click", () => {
        document.getElementById("testPlayModal").style.display = "none";

        const teamCount =
            parseInt(document.getElementById("tpTeamCount").value) || 2;
        const teams = [];
        document.querySelectorAll(".tp-team-block").forEach((block) => {
            const teamNum = parseInt(block.dataset.team);
            if (teamNum <= teamCount) {
                teams.push({
                    team: teamNum,
                    aiCount: parseInt(block.querySelector(".tpTeamAi").value) || 0,
                    difficulty:
                        block.querySelector(".tpTeamDiff").value || "normal",
                });
            }
        });

        const tpSettings = {
            teams,
            teamCount,
            playerTeam:
                parseInt(document.getElementById("tpPlayerTeam").value) || 1,
            spectate: tpSpectate,
            waveSpawn: tpWaveSpawn,
            friendlyFire: tpFriendlyFire,
            powerups: tpPowerups,
            playerHp:
                parseInt(document.getElementById("tpPlayerHp").value) || 250,
            playerBulletSpeed:
                parseInt(document.getElementById("tpPlayerBulletSpeed").value) ||
                47,
            playerLives:
                parseInt(document.getElementById("tpPlayerLives").value) || 5,
            aiHp: parseInt(document.getElementById("tpAiHp").value) || 45,
            aiShootCd:
                parseInt(document.getElementById("tpAiShootCd").value) || 140,
            aiTurnSpeed:
                parseFloat(document.getElementById("tpAiTurnSpeed").value) || 0.1,
            aiThrust:
                parseFloat(document.getElementById("tpAiThrust").value) || 0.1,
            aiMaxSpeed:
                parseFloat(document.getElementById("tpAiMaxSpeed").value) || 5.5,
            asteroidCount:
                parseInt(document.getElementById("tpAsteroidCount").value) || 20,
            worldW: parseInt(document.getElementById("tpWorldW").value) || 4000,
            worldH: parseInt(document.getElementById("tpWorldH").value) || 4000,
        };

        startTestPlay(tpSettings);
    });

function startTestPlay(settings) {
    window.isMultiplayer = false;
    window.currentDifficulty = "normal";
    window._testPlaySettings = settings;
    window._testPlayMode = true;

    // ワールドサイズ変更
    WORLD_W = settings.worldW;
    WORLD_H = settings.worldH;

    // ゲーム初期化
    bullets = [];
    particles = [];
    asteroids = [];
    ships = [];
    floatingTexts = [];
    powerups = [];
    cameraShake = 0;
    powerupsEnabled = settings.powerups !== false;
    idGen = 2;
    wave = 1;
    ScoreManager.reset();
    message = "TEST PLAY";
    showHelp = false;
    gameOverMode = false;
    matchEnded = false;
    isPaused = false;
    document.getElementById("pauseSettingsMenu").style.display = "none";
    if (controlMode === "initial") {
        resumeAudioOnFirstGesture();
    }

    // プレイヤー生成
    const pTeam = settings.playerTeam;
    const player = {
        id: playerId,
        faction: "player",
        team: pTeam,
        x: WORLD_W / 2,
        y: WORLD_H / 2,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        turnSpeed: 0.07,
        thrust: 0.12,
        maxSpeed: 6,
        drag: 0.005,
        heat: 0,
        maxHeat: 100,
        boosting: false,
        boostTimer: 0,
        shootCd: 100,
        shootTimer: 0,
        alive: true,
        isGhost: settings.spectate,
        hp: settings.playerHp,
        maxHp: settings.playerHp,
        scoreValue: 0,
        rollPhase: 0,
        ai: null,
        weaponType: 0,
        weaponTimer: 0,
    };
    ships.push(player);
    lives = settings.spectate ? 0 : settings.playerLives;

    // 隕石生成
    spawnAsteroids(settings.asteroidCount);

    // チーム別AI生成
    for (const teamConfig of settings.teams) {
        window.currentDifficulty = teamConfig.difficulty;
        for (let i = 0; i < teamConfig.aiCount; i++) {
            const isAlly = teamConfig.team === pTeam;
            const s = makeAIShip(isAlly ? "ally" : "enemy", teamConfig.difficulty);
            s.team = teamConfig.team;
            s.hp = settings.aiHp;
            s.maxHp = settings.aiHp;
            s.shootCd = settings.aiShootCd;
            s.turnSpeed = settings.aiTurnSpeed + (isAlly ? 0 : 0.02);
            s.thrust = settings.aiThrust;
            s.maxSpeed = settings.aiMaxSpeed;
            s.ai.difficulty = teamConfig.difficulty;
            ships.push(s);
        }
    }

    document.getElementById("hudHintText").innerText = settings.spectate
        ? "(TEST: 観戦モード - P=ポーズ, R=戻る)"
        : "(TEST: P=ポーズ/メニュー, R=戻る)";

    TimeManager.setStartTime(Date.now());
    running = true;
    updateTouchUIVisibility();
}

resize();
applyLightweightMode(lightweightMode);
applyFeatureSettingsToRuntime();
const vtEl = document.getElementById("versionText");
if (vtEl) vtEl.textContent = GAME_VERSION;

// iOS Safari fix: force layout recalculation to fix fixed-position tap offset
// This mimics the zoom-in/zoom-out action that users noticed fixes the issue
if (isMobileDevice) {
    // Force a full layout pass by reading offsetHeight then scrolling
    document.body.offsetHeight;
    window.scrollTo(0, 0);
    // After a short delay, trigger resize again to ensure canvas and fixed elements are correct
    setTimeout(() => {
        window.scrollTo(0, 0);
        resize();
    }, 100);
    setTimeout(() => {
        window.scrollTo(0, 0);
        resize();
    }, 300);
}

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

/* ========== カスタム gameAlert / gameConfirm ========== */
(function() {
    const overlay = document.getElementById('gameAlertOverlay');
    const box = document.getElementById('gameAlertBox');
    const titleEl = document.getElementById('gameAlertTitle');
    const msgEl = document.getElementById('gameAlertMessage');
    const okBtn = document.getElementById('gameAlertOkBtn');
    const cancelBtn = document.getElementById('gameAlertCancelBtn');
    let _resolve = null;

    function closeAlert() {
        box.style.setProperty('animation', 'alertBoxOut 0.15s ease-in forwards', 'important');
        overlay.style.animation = 'alertOverlayOut 0.15s ease-in forwards';
        setTimeout(() => {
            overlay.classList.remove('active');
            overlay.style.animation = '';
            box.style.removeProperty('animation');
        }, 160);
    }

    /**
     * gameAlert(message, title?) - Promise<void>
     */
    window.gameAlert = function(message, title) {
        return new Promise(resolve => {
            _resolve = resolve;
            titleEl.innerText = title || 'NOTICE';
            msgEl.innerText = message;
            cancelBtn.style.display = 'none';
            okBtn.innerText = 'OK';
            overlay.classList.add('active');
            overlay.style.animation = 'alertOverlayIn 0.18s ease-out';
            box.style.setProperty('animation', 'alertBoxIn 0.2s cubic-bezier(0.16,1,0.3,1)', 'important');
            okBtn.focus();
        });
    };

    /**
     * gameConfirm(message, title?) - Promise<boolean>
     */
    window.gameConfirm = function(message, title) {
        return new Promise(resolve => {
            _resolve = resolve;
            titleEl.innerText = title || 'CONFIRM';
            msgEl.innerText = message;
            cancelBtn.style.display = '';
            okBtn.innerText = 'OK';
            overlay.classList.add('active');
            overlay.style.animation = 'alertOverlayIn 0.18s ease-out';
            box.style.setProperty('animation', 'alertBoxIn 0.2s cubic-bezier(0.16,1,0.3,1)', 'important');
            okBtn.focus();
        });
    };

    okBtn.addEventListener('click', () => {
        closeAlert();
        if (_resolve) { const r = _resolve; _resolve = null; r(true); }
    });
    cancelBtn.addEventListener('click', () => {
        closeAlert();
        if (_resolve) { const r = _resolve; _resolve = null; r(false); }
    });

    // Escでキャンセル扱い
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancelBtn.click();
    });
})();

/* ========== Firebase Auth / Account Linkage ========== */
function initFirebaseAuthUI() {
    if (!window.firebaseAuthUI || !window.firebaseAuth) {
        setTimeout(initFirebaseAuthUI, 50);
        return;
    }
    const { 
        signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        signOut, linkWithCredential, EmailAuthProvider
    } = window.firebaseAuthUI;
    const auth = window.firebaseAuth;
    
    let isGuest = true;

    // Account Status Elements
    const accountStatusText = document.getElementById("accountStatusText");
    const btnOpenAuthFromSettings = document.getElementById("btnOpenAuthFromSettings");
    const btnSignOutButton = document.getElementById("btnSignOutButton");

    // Auth Modal Elements
    const authModal = document.getElementById("authModal");
    const authEmailInput = document.getElementById("authEmailInput");
    const authPasswordInput = document.getElementById("authPasswordInput");
    const btnCancelAuth = document.getElementById("btnCancelAuth");
    const btnSubmitAuth = document.getElementById("btnSubmitAuth");
    const authErrorMsg = document.getElementById("authErrorMsg");

    // Conflict Modal
    const dataConflictModal = document.getElementById("dataConflictModal");
    const btnConfirmConflict = document.getElementById("btnConfirmConflict");
    const btnCancelConflict = document.getElementById("btnCancelConflict");
    let selectedConflictChoice = null;

    // ======== ヘルパー: Workers API のベースURL ========
    function getWorkerBaseUrl() {
        const isProd = window.currentFirebaseProjectId === "astro-fray";
        return isProd 
            ? "https://astro-fray-prod.astro-fray-server.workers.dev" 
            : "https://astro-fray-dev.astro-fray-server.workers.dev";
    }

    // ======== API 1: 古いデータの削除（Auth + Firestore） ========
    // ログイン成功直後に即呼ばれる。データ移行は行わない。
    async function deleteAnonymousAccount(oldUid, retryCount) {
        if (!oldUid) return false;
        const maxRetries = typeof retryCount === 'number' ? retryCount : 2;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const currentUser = window.firebaseAuth.currentUser;
                if (!currentUser) {
                    console.error("deleteAnonymousAccount: No current user");
                    return false;
                }
                const idToken = await currentUser.getIdToken(true); // 強制リフレッシュ

                const response = await fetch(getWorkerBaseUrl() + "/api/delete-anonymous", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + idToken
                    },
                    body: JSON.stringify({ oldUid: oldUid, token: idToken })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    console.log("🗑️ 古いデータ " + oldUid + " を整理完了");
                    return true;
                }

                console.error("データ整理失敗 (試行 " + (attempt + 1) + "/" + (maxRetries + 1) + "):", result.error, result.details || "");
            } catch (e) {
                console.error("データ整理エラー (試行 " + (attempt + 1) + "/" + (maxRetries + 1) + "):", e);
            }

            // リトライの場合は少し待つ
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        return false;
    }

    // ======== API 2: データ移行のみ（コンフリクト選択後に呼ばれる） ========
    async function migrateData(oldUid, migrateAction) {
        if (!oldUid || !migrateAction) return false;
        try {
            const currentUser = window.firebaseAuth.currentUser;
            if (!currentUser) return false;
            const idToken = await currentUser.getIdToken(true);

            const response = await fetch(getWorkerBaseUrl() + "/api/migrate-data", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + idToken
                },
                body: JSON.stringify({ oldUid: oldUid, migrateAction: migrateAction, token: idToken })
            });

            const result = await response.json();
            if (response.ok && result.success) {
                console.log("✅ データ移行完了:", migrateAction);
                return true;
            }
            console.error("データ移行失敗:", result.error || response.statusText);
            return false;
        } catch (e) {
            console.error("データ移行エラー:", e);
            return false;
        }
    }

    function updateAccountUI(user) {
        if (!user) {
            if (accountStatusText) {
                accountStatusText.innerText = "OFFLINE";
                accountStatusText.style.color = "#aaa";
            }
            if (btnOpenAuthFromSettings) btnOpenAuthFromSettings.style.display = "block";
            if (btnSignOutButton) btnSignOutButton.style.display = "none";
            return;
        }
        isGuest = user.isAnonymous;
        if (isGuest) {
            if (accountStatusText) {
                accountStatusText.innerText = "GUEST (未連携)";
                accountStatusText.style.color = "#0f0";
                accountStatusText.style.textShadow = "0 0 10px #0f0";
            }
            if (btnOpenAuthFromSettings) btnOpenAuthFromSettings.style.display = "block";
            if (btnSignOutButton) btnSignOutButton.style.display = "none";
        } else {
            if (accountStatusText) {
                accountStatusText.innerText = "LINKED (" + user.email + ")";
                accountStatusText.style.color = "#00f0ff";
                accountStatusText.style.textShadow = "0 0 10px #00f0ff";
            }
            if (btnOpenAuthFromSettings) btnOpenAuthFromSettings.style.display = "none";
            if (btnSignOutButton) btnSignOutButton.style.display = "block";
        }
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            updateAccountUI(user);
        } else {
            try {
                await signInAnonymously(auth);
            } catch(e) {
                console.error("Anonymous login failed", e);
            }
        }
    });

    window.openAuthModal = function() {
        authErrorMsg.innerText = "";
        authEmailInput.value = "";
        authPasswordInput.value = "";
        
        // 他の画面が開いていたら一時的に隠す
        const viewsToHide = ["modeSelectModal", "pauseSettingsMenu", "startScreen"];
        viewsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.style.display !== "none") {
                el.dataset.hiddenByAuth = "true";
                el.style.display = "none";
            }
        });

        authModal.style.display = "block";
    };

    btnOpenAuthFromSettings?.addEventListener("click", () => {
        window.openAuthModal();
    });

    btnSignOutButton?.addEventListener("click", async () => {
        const yes = await window.gameConfirm("サインアウトしますか？\n現在のデータからはログアウトされます。");
        if (yes) {
            await signOut(auth);
            await window.gameAlert("サインアウトしました。");
            document.getElementById("pauseSettingsView").style.display = "none";
            document.getElementById("pauseSettingsMenu").style.display = "none";
            window.location.reload();
        }
    });

    function hideAuthModal() {
        authModal.style.display = "none";
        
        // 隠していた画面を元に戻す
        const viewsToHide = ["modeSelectModal", "pauseSettingsMenu", "startScreen"];
        viewsToHide.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.dataset.hiddenByAuth === "true") {
                el.style.display = id === "startScreen" ? "flex" : "block";
                delete el.dataset.hiddenByAuth;
            }
        });
    }

    btnCancelAuth.addEventListener("click", () => {
        hideAuthModal();
    });

    btnSubmitAuth.addEventListener("click", async () => {
        const email = authEmailInput.value.trim();
        const pwd = authPasswordInput.value;
        if (!email || pwd.length < 6) {
            authErrorMsg.innerText = "有効なメールアドレスと6文字以上のパスワードを入力してください。";
            return;
        }
        authErrorMsg.innerText = "処理中...";
        authErrorMsg.style.color = "#aaa";
        btnSubmitAuth.disabled = true;

        let localData = null;
        let oldUidForPushing = null;

        try {
            // ===== 最適化フロー =====
            // 既存アカウントログイン（最も多いケース）を先に試し、
            // 不要なAPI呼び出しによる400エラーを回避する
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                oldUidForPushing = auth.currentUser.uid;
                localData = await window.getPersonalHighScoreAndData(oldUidForPushing, "normal");
            }

            // Step 1: まずサインインを試みる（既存アカウント向け）
            let signInSucceeded = false;
            try {
                authErrorMsg.innerText = "ログイン中...";
                const result = await signInWithEmailAndPassword(auth, email, pwd);
                signInSucceeded = true;
                const newUid = result.user.uid;

                // ログイン成功 → 古いデータの整理
                if (oldUidForPushing) {
                    authErrorMsg.innerText = "ログイン完了。古いデータを整理中...";
                    const deleteSuccess = await deleteAnonymousAccount(oldUidForPushing);
                    if (!deleteSuccess) {
                        await window.gameAlert(
                            "古いデータの整理に失敗しました。\nゲームプレイには影響ありません。",
                            "WARNING"
                        );
                    }
                }

                let cloudData = await window.getPersonalHighScoreAndData(newUid, "normal");
                hideAuthModal();

                if (oldUidForPushing) {
                    localData = localData || { score: 0, playTimeSeconds: 0 };
                    cloudData = cloudData || { score: 0, playTimeSeconds: 0 };
                    localData.uid = oldUidForPushing;
                    showConflictModal(localData, cloudData, newUid, oldUidForPushing);
                } else {
                    await window.gameAlert("ログインしました！", "LOGIN SUCCESS");
                }
                btnSubmitAuth.disabled = false;
                return;
            } catch (signInErr) {
                if (signInErr.code === 'auth/user-not-found' ||
                    signInErr.code === 'auth/invalid-login-credentials') {
                    // アカウントが存在しない → 新規作成フローへ
                } else if (signInErr.code === 'auth/wrong-password') {
                    throw signInErr;
                } else if (signInErr.code === 'auth/too-many-requests') {
                    throw signInErr;
                } else if (signInSucceeded) {
                    throw signInErr;
                } else {
                    // 不明なエラーでも新規作成を試みる
                }
            }

            // Step 2: 新規アカウント作成
            // 匿名ユーザーならまず linkWithCredential を試す（UIDが変わらない最善の方法）
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                try {
                    authErrorMsg.innerText = "アカウントを作成中...";
                    const credential = EmailAuthProvider.credential(email, pwd);
                    const result = await linkWithCredential(auth.currentUser, credential);
                    // リンク成功: UIDが変わらないので、Auth削除もデータ移行も不要
                    hideAuthModal();
                    await window.gameAlert("アカウントを連携しました！\nデータが安全にバックアップされています。", "LINKED");
                    updateAccountUI(auth.currentUser);
                    btnSubmitAuth.disabled = false;
                    return;
                } catch (linkErr) {
                    if (linkErr.code !== 'auth/operation-not-allowed' &&
                        linkErr.code !== 'auth/email-already-in-use' &&
                        linkErr.code !== 'auth/credential-already-in-use') {
                        throw linkErr;
                    }
                    // linkが使えない → createUserWithEmailAndPassword で新規作成
                }
            }

            // Step 3: 通常の新規作成（linkが使えない場合のフォールバック）
            authErrorMsg.innerText = "アカウントを作成中...";
            try {
                const createResult = await createUserWithEmailAndPassword(auth, email, pwd);
                if (oldUidForPushing) {
                    authErrorMsg.innerText = "アカウント作成完了。古いデータを整理中...";
                    const deleteSuccess = await deleteAnonymousAccount(oldUidForPushing);
                    if (!deleteSuccess) {
                        console.warn("古いデータの整理に失敗。リトライ済み。");
                    }
                    if (localData && localData.score > 0) {
                        await migrateData(oldUidForPushing, "local");
                    }
                }
                hideAuthModal();
                await window.gameAlert("アカウントを作成しました！\nデータが安全にバックアップされています。", "SIGNUP SUCCESS");
                updateAccountUI(auth.currentUser);
                btnSubmitAuth.disabled = false;
                return;
            } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                    // signIn で auth/invalid-login-credentials が返され、
                    // createUser でも email-already-in-use → パスワードが間違っている
                    throw { code: 'auth/wrong-password', message: 'パスワードが間違っています。' };
                }
                throw createErr;
            }
        } catch (e) {
            console.error(e);
            authErrorMsg.style.color = "#ff0055";
            let msg = "エラーが発生しました。";
            if (e.code === 'auth/email-already-in-use') msg = "このメールアドレスは既に別のアカウントに連携されています。「ログイン」をお試しください。";
            if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-login-credentials') msg = "パスワードが間違っています。";
            if (e.code === 'auth/user-not-found') msg = "このメールアドレスは登録されていません。新規登録する場合はそのまま入力してください。";
            if (e.code === 'auth/invalid-email') msg = "メールアドレスの形式が正しくありません。";
            if (e.code === 'auth/too-many-requests') msg = "試行回数が多すぎます。しばらくお待ちください。";
            if (e.code === 'auth/requires-recent-login') msg = "セッションが古くなっています。ページを更新してから再度お試しください。";
            authErrorMsg.innerText = msg;
        }
        btnSubmitAuth.disabled = false;
    });

    const conflictCards = document.querySelectorAll('.conflict-card');
    conflictCards.forEach(card => {
        card.addEventListener('click', () => {
            conflictCards.forEach(c => {
                c.style.borderColor = c.dataset.choice === 'local' ? '#00f0ff' : '#ff3355';
                c.style.boxShadow = '';
                c.style.opacity = '0.5';
            });
            card.style.opacity = '1';
            card.style.boxShadow = "0 0 15px " + (card.dataset.choice === 'local' ? 'rgba(0,240,255,0.4)' : 'rgba(255,51,85,0.4)');
            selectedConflictChoice = card.dataset.choice;
            btnConfirmConflict.disabled = false;
        });
    });

    function showConflictModal(local, cloud, newUid, oldUidForPushing) {
        selectedConflictChoice = null;
        btnConfirmConflict.disabled = true;
        conflictCards.forEach(c => {
            c.style.opacity = '1';
            c.style.boxShadow = '';
            c.style.borderColor = c.dataset.choice === 'local' ? '#00f0ff' : '#ff3355';
        });

        document.getElementById("conflictLocalScore").innerText = local.score || 0;
        document.getElementById("conflictLocalTime").innerText = local.playTimeSeconds || 0;
        
        document.getElementById("conflictCloudScore").innerText = cloud.score || 0;
        document.getElementById("conflictCloudTime").innerText = cloud.playTimeSeconds || 0;

        btnConfirmConflict.onclick = async () => {
            btnConfirmConflict.disabled = true;
            btnConfirmConflict.innerText = "処理中...";
            
            // サーバー側でデータ移行のみ実行（Auth削除は既に完了済み）
            if (oldUidForPushing) {
                const migrated = await migrateData(oldUidForPushing, selectedConflictChoice);
                if (!migrated) {
                    await window.gameAlert("データ移行に失敗しました。もう一度お試しください。", "ERROR");
                    btnConfirmConflict.disabled = false;
                    btnConfirmConflict.innerText = "選択したデータで引き継ぐ";
                    return;
                }
            }
            
            if (selectedConflictChoice === 'local') {
                await window.gameAlert("現在のプレイデータで上書きしました！", "DATA SYNCED");
            } else {
                await window.gameAlert("クラウドのデータを引き継ぎました！", "DATA SYNCED");
            }
            
            dataConflictModal.style.display = "none";
            btnConfirmConflict.innerText = "選択したデータで引き継ぐ";
            await window.gameAlert("画面を再読み込みして変更を反映します...", "RELOADING");
            window.location.reload();
        };

        // キャンセル時: Auth削除は既に完了済み。古いデータだけ消す
        btnCancelConflict.onclick = async () => {
            dataConflictModal.style.display = "none";
            if (oldUidForPushing) {
                await migrateData(oldUidForPushing, "cloud");
            }
            await window.gameAlert("キャンセルしました。クラウドのデータを引き継ぎます。", "DATA SYNCED");
            await window.gameAlert("画面を再読み込みして変更を反映します...", "RELOADING");
            window.location.reload();
        };

        dataConflictModal.style.display = "block";
    }
}
initFirebaseAuthUI();