/* ===== Extracted from game.js ===== */

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

// サーバーサイドセッション管理
let _currentSessionToken = null;

async function requestSessionToken(difficulty) {
    if (!window.firebaseAuth || !window.firebaseAuth.currentUser) return null;
    try {
        const idToken = await window.firebaseAuth.currentUser.getIdToken(true);
        const baseUrl = window._getWorkerBaseUrl ? window._getWorkerBaseUrl() : '';
        if (!baseUrl) return null;
        const resp = await fetch(baseUrl + '/api/start-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + idToken
            },
            body: JSON.stringify({ difficulty: difficulty || 'normal' })
        });
        const data = await resp.json();
        if (data.success && data.sessionToken) {
            _currentSessionToken = data.sessionToken;
            return data.sessionToken;
        }
    } catch (e) {
        console.warn('Session token request failed:', e);
    }
    return null;
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
        let res = await window.submitScoreToServer(currentScore, diff, playTimeSeconds, _currentSessionToken);
        if (res && !res.ok) {
            if (res.reason === 'permission-denied' || res.reason === 'cheat-detected') {
                document.getElementById('cheatWarningModal').style.display = 'block';
            } else {
                document.getElementById('networkErrorModal').style.display = 'block';
            }
        }
        // セッショントークンを無効化（1回限り）
        _currentSessionToken = null;
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
            [チーム ${s.team}] ${escapeHTML(name)} : ${status}
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
                <span style="display:inline-block; min-width:140px; font-weight:${isMe ? 'bold' : 'normal'}; color:${isMe ? '#00f0ff' : '#ccc'};">${index + 1}. ${escapeHTML(name)}</span>
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

    if (!window._shipHash && window.AstroECS) {
        window._shipHash = new window.AstroECS.Core.SpatialHash(200, WORLD_W, WORLD_H);
        window._astHash = new window.AstroECS.Core.SpatialHash(200, WORLD_W, WORLD_H);
    }
    if (window._shipHash) {
        window._shipHash.clear();
        window._astHash.clear();
        for (const s of ships) {
            if (!s.alive || s.isGhost) continue;
            window._shipHash.insert(s, s.x, s.y, 24);
        }
        for (const a of asteroids) {
            window._astHash.insert(a, a.x, a.y, a.r + 12);
        }
    }

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
        const nearbyShips = window._shipHash ? window._shipHash.getNearby(b.x, b.y, b.radius + 24) : ships;
        for (const s of nearbyShips) {
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

        const nearbyAsts = window._astHash ? window._astHash.getNearby(b.x, b.y, b.radius + 100) : asteroids;
        for (let idx = nearbyAsts.length - 1; idx >= 0; idx--) {
            const a = nearbyAsts[idx];
            const realIdx = asteroids.indexOf(a);
            if (realIdx === -1) continue;
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
                    asteroids.splice(realIdx, 1);
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
        const nearbyA2 = window._astHash ? window._astHash.getNearby(s.x, s.y, 100) : asteroids;
        for (const a of nearbyA2) {
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
