/* ===== Photon マルチプレイ通信 ===== */
/* Extracted from game.js for modular organization */

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
        li.innerHTML = `<span style="color:${color};">[チーム ${teamId}] ${escapeHTML(name)} ${actor.isLocal ? "(あなた)" : ""}</span>`;
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
    // サーバーサイドセッション開始（非同期、失敗してもゲームは開始する）
    requestSessionToken(window.currentDifficulty || 'normal');
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
