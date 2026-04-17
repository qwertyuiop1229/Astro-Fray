/* ===== 数学・共通関数群 ===== */
/* Extracted from game.js */

/* ========== 基本ユーティリティ ========== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
let WORLD_W = 10000;
let WORLD_H = 10000;
function wrap(value, max) {
    if (value < 0) return value + max;
    if (value >= max) return value - max;
    return value;
}
function torusDelta(ax, ay, bx, by) {
    let dx = ax - bx;
    let dy = ay - by;
    dx = ((dx + WORLD_W / 2) % WORLD_W) - WORLD_W / 2;
    dy = ((dy + WORLD_H / 2) % WORLD_H) - WORLD_H / 2;
    return { dx, dy };
}
function torusDist2(ax, ay, bx, by) {
    const d = torusDelta(ax, ay, bx, by);
    return d.dx * d.dx + d.dy * d.dy;
}
function toScreen(x, y, camX, camY, vw, vh) {
    const d = torusDelta(x, y, camX, camY);
    return { sx: d.dx + vw / 2, sy: d.dy + vh / 2 };
}
function angleLerp(a, b, t) {
    let diff = ((b - a + Math.PI) % TAU) - Math.PI;
    return a + diff * t;
}
function torusLerp(current, target, max, t) {
    let diff = target - current;
    if (diff > max / 2) diff -= max;
    else if (diff < -max / 2) diff += max;
    return wrap(current + diff * t, max);
}
