/* ===== Extracted from game.js ===== */

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
