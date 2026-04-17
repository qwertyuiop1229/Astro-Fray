/* ===== オーディオマネージャー ===== */
/* Extracted from game.js */

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
    debouncedCloudSync();
}

// 設定のクラウド同期（デバウンス: 2秒待ってから送信）
let _cloudSyncTimer = null;
function debouncedCloudSync() {
    if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer);
    _cloudSyncTimer = setTimeout(() => {
        if (window.saveSettingsToCloud) {
            window.saveSettingsToCloud(collectAllSettings());
        }
    }, 2000);
}
function collectAllSettings() {
    const features = loadFeatureSettings();
    const audio = loadAudioSettings();
    const keyBindings = loadKeyBindings();
    const uiLayout = JSON.parse(localStorage.getItem("uiLayout_v1") || "{}");
    
    return {
        features,
        audio,
        keyBindings,
        uiLayout,
        zoomLevel: parseFloat(localStorage.getItem("zoomLevel_v1")) || 1.0,
        minecraftSensitivity: parseFloat(localStorage.getItem("minecraftSensitivity_v1") || "5"),
        controlMode: localStorage.getItem("controlMode_v1") || "mouse",
        minecraftMode: localStorage.getItem("minecraftMode_v1") === "1",
        forceTouchUI: localStorage.getItem("forceTouchUI_v1") === "1",
        lightweight: localStorage.getItem('lightweight_v1') === '1',
        simpleTransition: localStorage.getItem('simpleTransition_v1') === '1',
        nickname: localStorage.getItem('playerNickname_v1') || 'UNKNOWN',
        devMode: localStorage.getItem("devMode_v1") === "1"
    };
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
