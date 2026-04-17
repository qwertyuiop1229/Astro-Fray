/* ===== UI操作レイアウトマネージャー ===== */
/* Extracted from game.js */

/* ===== UI Layout Manager ===== */
const UILayoutManager = (() => {
    let layoutSettings = {};
    try {
        const raw = localStorage.getItem("uiLayout_v1");
        if (raw) layoutSettings = JSON.parse(raw);
    } catch (e) { }

    const idsToHandle = [
        'btnTouchShoot', 'btnTouchPause', 'btnTouchBoost',
        'btnTouchBrake', 'btnTouchRollLeft', 'btnTouchRollRight',
        'joystickBase'
    ];

    const api = {
        get: (id) => layoutSettings[id] || null,
        set: (id, x, y, s) => {
            layoutSettings[id] = { x, y, s };
        },
        save: () => {
            try {
                localStorage.setItem("uiLayout_v1", JSON.stringify(layoutSettings));
            } catch (e) { }
            api.applyToDOM();
        },
        reset: (id) => {
            delete layoutSettings[id];
            api.save();
        },
        resetAll: () => {
            layoutSettings = {};
            try { localStorage.removeItem("uiLayout_v1"); } catch (e) { }
            api.applyToDOM();
        },
        applyToDOM: () => {
            idsToHandle.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                const cfg = layoutSettings[id];
                if (cfg) {
                    el.style.position = 'fixed';
                    el.style.left = cfg.x + 'vw';
                    el.style.top = cfg.y + 'vh';
                    el.style.right = 'auto';
                    el.style.bottom = 'auto';
                    el.style.transform = `translate(-50%, -50%) scale(${cfg.s})`;
                } else {
                    el.style.position = '';
                    el.style.left = '';
                    el.style.top = '';
                    el.style.right = '';
                    el.style.bottom = '';
                    el.style.transform = '';
                }
            });
        }
    };
    return api;
})();

// Canvas UI drawing helper
function getCanvasLayout(id, defX, defY, w = 0, h = 0) {
    const cfg = UILayoutManager.get(id);
    if (!cfg) return { x: defX, y: defY, s: 1 };
    const cw = (canvas.width / dpr);
    const ch = (canvas.height / dpr);
    const centerX = (cfg.x / 100) * cw;
    const centerY = (cfg.y / 100) * ch;
    return { x: centerX - (w * cfg.s) / 2, y: centerY - (h * cfg.s) / 2, s: cfg.s };
}

let cameraShake = 0;
function shakeCamera(amount) {
    if (!enableShake) return;
    amount *= shakeIntensity;
    if (lightweightMode) amount *= 0.5;
    cameraShake = Math.min(cameraShake + amount, 50 * shakeIntensity);
}

class FloatingText {
    constructor(x, y, text, color, life = 1.0, size = 16) {
        this.x = x;
        this.y = y;
        this.vx = rand(-10, 10);
        this.vy = rand(-20, -40);
        this.text = text;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
}
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = rand(-20, 20);
        this.vy = rand(-20, 20);
        this.type = randInt(0, 2);
        this.colors = ["#00ff66", "#00f0ff", "#f0f"];
        this.labels = ["HP回復", "拡散弾", "連射弾"];
        this.color = this.colors[this.type];
        this.life = 10.0;
        this.radius = 12;
        this.rotation = rand(0, TAU);
    }
    update(dt) {
        this.x = wrap(this.x + this.vx * dt, WORLD_W);
        this.y = wrap(this.y + this.vy * dt, WORLD_H);
        this.vx *= 0.99;
        this.vy *= 0.99;
        this.rotation += dt * 2;
        this.life -= dt;
    }
    apply(player) {
        playPowerUpSound();
        let text = this.labels[this.type];
        if (this.type === 0) {
            player.hp = Math.min(player.maxHp, player.hp + 50);
            player.healRing = { life: 0.8, maxLife: 0.8, color: "#00ff66" };
        } else if (this.type === 1) {
            player.weaponType = 1;
            player.weaponStartTime = performance.now();
            player.weaponDuration = 10000;
        } else if (this.type === 2) {
            player.weaponType = 2;
            player.weaponStartTime = performance.now();
            player.weaponDuration = 10000;
        }
        floatingTexts.push(
            new FloatingText(
                this.x,
                this.y,
                text,
                this.color,
                1.5,
                Math.max(14, damageTextBaseSize * 0.9),
            ),
        );
    }
}
function spawnPowerUp(x, y) {
    powerups.push(new PowerUp(x, y));
}
let floatingTexts = [];
let powerups = [];
