/* ===== Extracted from game.js ===== */

/* ========== メインループ ========== */
function frame(t) {
    const dt = Math.min(1 / 30, (t - last) / 1000);
    last = t;
    if (running) {
        update(dt);
    } else {
        if (cameraShake > 0) {
            cameraShake *= 0.9;
            if (cameraShake < 0.5) cameraShake = 0;
        }
    }
    render();
    requestAnimationFrame(frame);
}
