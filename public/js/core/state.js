/* ===== Extracted from game.js ===== */

/* ========== ゲーム状態 ========== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
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

const GAME_VERSION = "1.13.0";
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
    if (window.debouncedCloudSync) window.debouncedCloudSync();
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
