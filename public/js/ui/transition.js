/* ===== 画面遷移エフェクト ===== */
/* Extracted from game.js for modular organization */

/* ========== 画面トランジション ========== */
const _fadeOverlay = document.getElementById("screenFadeOverlay");
function screenFadeOut(duration, color, callback) {
    if (typeof color === "function") {
        callback = color;
        color = "#050510"; // デフォルトは暗転
    }
    if (!_fadeOverlay) { if (callback) callback(); return; }
    _fadeOverlay.style.pointerEvents = 'all'; // 演出中はクリック・タップをすべてブロックする
    _fadeOverlay.style.transition = 'none';
    _fadeOverlay.style.opacity = '0';
    _fadeOverlay.style.backgroundColor = color || "#050510";
    _fadeOverlay.offsetHeight; // reflow
    _fadeOverlay.style.transition = 'opacity ' + duration + 'ms ease-in';
    _fadeOverlay.style.opacity = '1';
    setTimeout(() => { if (callback) callback(); }, duration);
}
function screenFadeIn(duration, delay) {
    if (!_fadeOverlay) return;
    setTimeout(() => {
        _fadeOverlay.style.transition = 'opacity ' + duration + 'ms ease-out';
        _fadeOverlay.style.opacity = '0';
        setTimeout(() => {
            _fadeOverlay.style.pointerEvents = 'none'; // フェードイン完了後にブロック解除
        }, duration);
    }, delay || 0);
}

// 超光速ワームホール（ハイパースペース）トランジション
let simpleTransition = localStorage.getItem('simpleTransition_v1') === '1';
function playWarpTransition(callback) {
    // シンプル画面遷移モード: ワープアニメーションをスキップ
    if (simpleTransition) {
        screenFadeOut(800, "#050510", () => {
            if (callback) callback();
            screenFadeIn(800, 200);
        });
        return;
    }
    const overlay = document.getElementById("warpTransitionOverlay");
    const canvas = document.getElementById("warpStarCanvas");
    if (!overlay || !canvas) {
        screenFadeOut(1200, "#ffffff", () => {
            screenFadeIn(1200, 0);
            if (callback) callback();
        });
        return;
    }

    // アクティブなUI要素（モーダルなど）をゆっくりフェードアウトさせる
    const activeModals = document.querySelectorAll('.setting-modal[style*="display: block"], .setting-modal[style*="display: flex"], #modeSelectModal[style*="display: block"], #roomWaitModal[style*="display: flex"]');
    activeModals.forEach(el => {
        el.style.transition = "opacity 0.6s ease-in-out";
        el.style.opacity = "0";
        setTimeout(() => {
            el.style.display = "none";
            el.style.opacity = "1";
        }, 600);
    });

    // ワープ空間（オーバーレイ）をUIのフェードアウトと同時にクロスフェードで表示する
    overlay.style.opacity = "0";
    overlay.style.display = "block";
    overlay.style.backgroundColor = "transparent"; // 背後の星空の上にワープを重ねる
    overlay.offsetHeight;
    overlay.style.transition = "opacity 0.6s ease-in-out";
    overlay.style.opacity = "1";

    const ctx = canvas.getContext("2d", { alpha: false });
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    let cx = w / 2;
    let cy = h / 2;

    window.addEventListener("resize", () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w / 2;
        cy = h / 2;
    });

    const particles = [];
    const PARTICLE_COUNT = 400;
    const rings = [];
    let animationId;
    let startTime = performance.now();
    const DURATION = 2800; // アニメーション全体の長さ

    // パーティクル（星・光の筋）初期化
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: (Math.random() - 0.5) * w,
            y: (Math.random() - 0.5) * h,
            z: Math.random() * 1000 + 100, // Z深度
            prevZ: 0,
            baseColor: Math.random() > 0.5 ? [0, 240, 255] : [255, 255, 255],
            size: Math.random() * 2 + 0.5
        });
    }

    // トンネル（3Dリング）初期化
    for (let i = 0; i < 20; i++) {
        rings.push({
            z: i * 150,
            radius: 800 + Math.random() * 200,
            sides: 6 + Math.floor(Math.random() * 4),
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.05
        });
    }

    startTime = performance.now();

    // オーディオ演出（没入感のある重低音＋加速シンセ）
    if (audioCtx && audioCtx.state !== "suspended") {
        const now = audioCtx.currentTime;

        // 全てのワープサウンドは設定でONのときのみ鳴る
        if (audioSettings.warpBass) {
            // 低音のうなり（ベース）
            const oscBase = audioCtx.createOscillator();
            oscBase.type = "sine";
            oscBase.frequency.setValueAtTime(40, now);
            oscBase.frequency.exponentialRampToValueAtTime(150, now + 1.5);
            const gainBase = audioCtx.createGain();
            gainBase.gain.setValueAtTime(0, now);
            gainBase.gain.linearRampToValueAtTime(1.2, now + 0.5);
            gainBase.gain.linearRampToValueAtTime(0.01, now + 2.5);
            oscBase.connect(gainBase);
            gainBase.connect(sfxGain);
            oscBase.start(now);
            oscBase.stop(now + 2.6);

            // 加速する高音（シンセ）
            const oscHigh = audioCtx.createOscillator();
            oscHigh.type = "sawtooth";
            oscHigh.frequency.setValueAtTime(100, now + 0.5);
            oscHigh.frequency.exponentialRampToValueAtTime(2000, now + 2.2);
            const gainHigh = audioCtx.createGain();
            gainHigh.gain.setValueAtTime(0, now + 0.5);
            gainHigh.gain.linearRampToValueAtTime(0.8, now + 1.8);
            gainHigh.gain.exponentialRampToValueAtTime(0.01, now + 2.6);

            // フィルターでこもった音から開く演出
            const filter = audioCtx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(200, now + 0.5);
            filter.frequency.exponentialRampToValueAtTime(8000, now + 2.0);

            oscHigh.connect(filter);
            filter.connect(gainHigh);
            gainHigh.connect(sfxGain);
            oscHigh.start(now + 0.5);
            oscHigh.stop(now + 2.7);

            // 爆発音（フラッシュ）
            setTimeout(() => {
                try { playExplosionSound("large"); } catch (e) { }
            }, 2200);
        }
    } // end of audio if

    let isFinished = false;

    // メイン描画ループ
    function render(time) {
        if (isFinished) return;
        const elapsed = time - startTime;
        let progress = Math.min(elapsed / DURATION, 1.0); // 0.0 to 1.0

        // 残像効果のためのクリア
        ctx.fillStyle = `rgba(5, 5, 10, ${0.15 + (1 - progress) * 0.2})`;
        ctx.fillRect(0, 0, w, h);

        // アニメーション進行度による速度変化
        const baseSpeed = 10;
        const speedMultiplier = 1 + Math.pow(progress, 3) * 60; // 指数関数的に加速
        const currentSpeed = baseSpeed * speedMultiplier;

        // グリッチ/フラッシュの強さ
        let flashIntensity = 0;
        let shake = 0;
        if (progress > 0.8) {
            flashIntensity = (progress - 0.8) * 5; // 0 to 1
            shake = flashIntensity * 15;
            // 画面のランダムな揺れ
            if (shake > 0) {
                ctx.save();
                ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
            }
        }

        // カメラ（視界）の中心オフセット
        const camX = cx + Math.sin(time * 0.002) * (50 * progress);
        const camY = cy + Math.cos(time * 0.003) * (50 * progress);

        // トンネル（ワイヤフレーム）の描画
        ctx.lineWidth = 1 + progress * 2;
        const ringZOffset = Math.sin(time * 0.001) * 20;

        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            ring.z -= currentSpeed * 0.5;
            if (ring.z < 10) {
                ring.z = 3000; // 奥へループ再配置
                ring.rotSpeed = (Math.random() - 0.5) * 0.08;
            }
            ring.rotation += ring.rotSpeed * Math.min(progress * 3 + 1, 10);

            // 3D -> 2D投影
            const zRatio = 800 / Math.max(ring.z + ringZOffset, 1);
            if (zRatio < 0) continue; // 後ろにあるものは描画しない

            const r2d = ring.radius * zRatio;
            const alpha = Math.min(1.0, zRatio * 0.5) * (1 - Math.pow((3000 - ring.z) / 3000, 4));

            // 赤/シアンのサイバーカラーへ変化
            const colorR = Math.floor(0 + progress * 255);
            const colorG = Math.floor(240 - progress * 200);
            const colorB = Math.floor(255 - progress * 100);

            ctx.strokeStyle = `rgba(${colorR}, ${colorG}, ${colorB}, ${alpha * (0.1 + progress * 0.5)})`;
            ctx.beginPath();

            for (let s = 0; s <= ring.sides; s++) {
                const angle = ring.rotation + (s / ring.sides) * Math.PI * 2;
                const px = camX + Math.cos(angle) * r2d + (Math.sin(time * 0.005 + ring.z * 0.01) * 30 * progress);
                const py = camY + Math.sin(angle) * r2d + (Math.cos(time * 0.004 + ring.z * 0.01) * 30 * progress);
                if (s === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        // パーティクル（ワープ星）の描画
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            p.prevZ = p.z;
            p.z -= currentSpeed;

            if (p.z <= 10) {
                p.x = (Math.random() - 0.5) * w * 2;
                p.y = (Math.random() - 0.5) * h * 2;
                p.z = 2000 + Math.random() * 1000;
                p.prevZ = p.z;
                p.size = Math.random() * 2 + 0.5;
            }

            // 投影
            const scale = 800 / p.z;
            const prevScale = 800 / Math.max(p.prevZ, 1);

            const px = camX + p.x * scale;
            const py = camY + p.y * scale;
            const ppx = camX + p.x * prevScale;
            const ppy = camY + p.y * prevScale;

            // 透過度と色
            const alpha = Math.min(1.0, 1500 / p.z);
            let [r, g, b] = p.baseColor;

            if (progress > 0.5) {
                // 赤方偏移/青方偏移のシミュレーション（手首は赤・オレンジへ）
                r = Math.min(255, r + progress * 100);
                g = Math.max(50, g - progress * 100);
                b = Math.max(50, b - progress * 100);
            }

            ctx.lineWidth = p.size * scale;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ppx, ppy);
            ctx.lineTo(px, py);
            ctx.stroke();

            // フレア
            if (p.size > 2) {
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
                ctx.beginPath();
                ctx.arc(px, py, p.size * scale * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (shake > 0) ctx.restore(); // 画面揺れリセット

        // グリッチエフェクト (終盤)
        if (flashIntensity > 0.3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity * 0.1})`;
            ctx.fillRect(0, Math.random() * h, w, Math.random() * 50);

            if (Math.random() > 0.7) {
                // 色収差のような横ずれ
                const sliceY = Math.random() * h;
                const sliceH = Math.random() * 100;
                const imgData = ctx.getImageData(0, sliceY, w, sliceH);
                ctx.putImageData(imgData, (Math.random() - 0.5) * 50 * flashIntensity, sliceY);
            }
        }

        // ホワイトアウト
        if (flashIntensity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.pow(flashIntensity, 2)})`;
            ctx.fillRect(0, 0, w, h);
        }

        if (elapsed < DURATION) {
            animationId = requestAnimationFrame(render);
        } else {
            // アニメーション完了
            isFinished = true;
            if (callback) callback();

            // 白フラッシュで抜ける演出 (既存関数を使用)
            screenFadeOut(50, "#ffffff", () => {
                overlay.style.opacity = "0";
                setTimeout(() => {
                    overlay.style.display = "none";
                    ctx.clearRect(0, 0, w, h);
                }, 300);
                screenFadeIn(1200, 0);
            });
        }
    }

    // アニメーション開始
    animationId = requestAnimationFrame(render);
}
