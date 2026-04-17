/* ===== Extracted from game.js ===== */

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
