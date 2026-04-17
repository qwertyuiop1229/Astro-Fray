/* ===== Extracted from game.js ===== */

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
