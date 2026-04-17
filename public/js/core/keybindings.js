/* ===== キーバインド管理 ===== */
/* Extracted from game.js */

/* ========== キー設定 ========== */
const defaultKeyBindings = {
    turnLeft: ["a", "arrowleft"],
    turnRight: ["d", "arrowright"],
    thrust: ["w", "arrowup"],
    brake: ["s", "arrowdown"],
    shoot: [" "],
    boost: ["shift"],
    rollLeft: ["q"],
    rollRight: ["e"],
    pause: ["p"],
    restart: ["r"],
    help: ["h"],
};
function loadKeyBindings() {
    try {
        const raw = localStorage.getItem("keyBindings_v1");
        if (!raw) return JSON.parse(JSON.stringify(defaultKeyBindings));
        const obj = JSON.parse(raw);
        for (const k in defaultKeyBindings) {
            if (!obj[k])
                obj[k] = JSON.parse(JSON.stringify(defaultKeyBindings[k]));
        }
        return obj;
    } catch (e) {
        return JSON.parse(JSON.stringify(defaultKeyBindings));
    }
}
function saveKeyBindings(kb) {
    localStorage.setItem("keyBindings_v1", JSON.stringify(kb));
}
let keyBindings = loadKeyBindings();
const norm = (k) =>
    k === undefined || k === null ? "" : String(k).toLowerCase();
function asArray(b) {
    return Array.isArray(b) ? b.map(norm) : [norm(b)];
}
function isAnyPressedForBind(bind) {
    for (const kk of asArray(bind)) if (keys[kk]) return true;
    return false;
}
function matchKeyToBind(k, bind) {
    return asArray(bind).includes(norm(k));
}
function prettyKey(k) {
    k = norm(k);
    if (k === " ") return "Space";
    if (k.startsWith("arrow")) {
        if (k === "arrowup") return "↑";
        if (k === "arrowdown") return "↓";
        if (k === "arrowleft") return "←";
        if (k === "arrowright") return "→";
    }
    if (k.length === 1) return k.toUpperCase();
    return k.charAt(0).toUpperCase() + k.slice(1);
}
function displayBind(bind) {
    return asArray(bind).map(prettyKey).join(" / ");
}
