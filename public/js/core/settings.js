/* ===== Extracted from game.js ===== */

/* ========== 軽量化・個別設定 ========== */

let lightweightMode = localStorage.getItem("lightweight_v1") === "1";
let PARTICLE_DRAW_LIMIT = lightweightMode ? 80 : 400;
let STAR_LAYERS = lightweightMode ? [0.15, 0.3] : [0.12, 0.3, 0.6];
let DRAW_GLOW = !lightweightMode;
let MINIMAP_ENABLED = !lightweightMode;
let ASTEROID_DRAW_LIMIT = lightweightMode ? 30 : 1000;
let DPR_FORCE_ONE = lightweightMode;
function applyLightweightMode(en) {
    lightweightMode = !!en;
    localStorage.setItem("lightweight_v1", lightweightMode ? "1" : "0");
    PARTICLE_DRAW_LIMIT = lightweightMode ? 80 : 400;
    STAR_LAYERS = lightweightMode ? [0.15, 0.3] : [0.12, 0.3, 0.6];
    DRAW_GLOW = !lightweightMode;
    MINIMAP_ENABLED = !lightweightMode;
    ASTEROID_DRAW_LIMIT = lightweightMode ? 30 : 1000;
    DPR_FORCE_ONE = lightweightMode;
    try {
        if (sfxGain)
            sfxGain.gain.value = lightweightMode
                ? audioSettings.sfx * 0.5
                : audioSettings.sfx;
        if (musicGain) musicGain.gain.value = lightweightMode ? 0.02 : 0.04;
    } catch (e) { }
    resize();
    starCacheNeedsRegen = true;
    // 軽量化モードON→シンプル画面遷移もON
    if (lightweightMode && !simpleTransition) {
        simpleTransition = true;
        localStorage.setItem('simpleTransition_v1', '1');
        const stEl = document.getElementById('toggleSimpleTransition');
        if (stEl) setToggleElem(stEl, true);
    }
}
const DEFAULT_FEATURES = {
    stars: true,
    minimap: true,
    particles: true,
    glow: true,
    minimapAsteroids: true,
    damageTextSize: 24,
    showDamage: true,
    enableShake: true,
    shakeIntensity: 1.0,
    aimLine: false,
};
function loadFeatureSettings() {
    try {
        const raw = localStorage.getItem("featureSettings_v1");
        if (!raw) return Object.assign({}, DEFAULT_FEATURES);
        return Object.assign({}, DEFAULT_FEATURES, JSON.parse(raw));
    } catch (e) {
        return Object.assign({}, DEFAULT_FEATURES);
    }
}
function saveFeatureSettings(obj) {
    try {
        localStorage.setItem("featureSettings_v1", JSON.stringify(obj));
    } catch (e) { }
    debouncedCloudSync();
}
let featureSettings = loadFeatureSettings();
let showStars = !!featureSettings.stars;
let showMinimap = !!featureSettings.minimap;
let showParticles = !!featureSettings.particles;
let showGlow = !!featureSettings.glow;
let showMinimapAsteroids = !!featureSettings.minimapAsteroids;
let damageTextBaseSize = 24;
let zoomLevel = parseFloat(localStorage.getItem("zoomLevel_v1")) || 1.0;
let showDamage = featureSettings.showDamage !== false;
let enableShake = featureSettings.enableShake !== false;
let shakeIntensity =
    featureSettings.shakeIntensity !== undefined
        ? featureSettings.shakeIntensity
        : 1.0;
let safeAreaMarginX = featureSettings.safeAreaMarginX !== undefined ? featureSettings.safeAreaMarginX : (featureSettings.safeAreaMargin || 0);
let safeAreaMarginY = featureSettings.safeAreaMarginY !== undefined ? featureSettings.safeAreaMarginY : (featureSettings.safeAreaMargin || 0);
function applyFeatureSettingsToRuntime() {
    showStars = !!featureSettings.stars;
    showMinimap = !!featureSettings.minimap;
    showParticles = !!featureSettings.particles;
    showGlow = !!featureSettings.glow;
    showMinimapAsteroids = !!featureSettings.minimapAsteroids;
    damageTextBaseSize =
        featureSettings.damageTextSize !== undefined
            ? featureSettings.damageTextSize
            : 24;
    showDamage = featureSettings.showDamage !== false;
    enableShake = featureSettings.enableShake !== false;
    shakeIntensity =
        featureSettings.shakeIntensity !== undefined
            ? featureSettings.shakeIntensity
            : 1.0;
    safeAreaMarginX = featureSettings.safeAreaMarginX !== undefined ? featureSettings.safeAreaMarginX : (featureSettings.safeAreaMargin || 0);
    safeAreaMarginY = featureSettings.safeAreaMarginY !== undefined ? featureSettings.safeAreaMarginY : (featureSettings.safeAreaMargin || 0);
    document.documentElement.style.setProperty('--safe-area-extra-x', safeAreaMarginX + 'px');
    document.documentElement.style.setProperty('--safe-area-extra-y', safeAreaMarginY + 'px');
    const safeAreaXValue = document.getElementById("safeAreaXValue");
    if (safeAreaXValue) safeAreaXValue.innerText = safeAreaMarginX + "px";
    const safeAreaYValue = document.getElementById("safeAreaYValue");
    if (safeAreaYValue) safeAreaYValue.innerText = safeAreaMarginY + "px";
}
applyFeatureSettingsToRuntime();

/* [MOVED] UI操作レイアウトマネージャー -> ui/layout_manager.js */