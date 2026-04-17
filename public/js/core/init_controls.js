/* ===== 入力コントロール基盤 ===== */
/* Extracted from game.js */

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

/* [MOVED] 画面遷移エフェクト -> ui/transition.js */