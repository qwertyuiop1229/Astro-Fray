/* ===== Extracted from game.js ===== */

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
