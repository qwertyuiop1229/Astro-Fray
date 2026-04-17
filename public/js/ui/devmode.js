/* ===== 開発・テストプレイ用ツール ===== */
/* Extracted from game.js */

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
    requestSessionToken(window.currentDifficulty || 'normal');
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
