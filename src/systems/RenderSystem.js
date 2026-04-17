/**
 * RenderSystem — Transform + 各種視覚コンポーネント を持つ Entity を Canvas に描画する
 *
 * Phase 4: 元のAstro Frayの精巧なデザイン(Canvas Path API)を完全再現
 */
import { System } from '../core/ecs/System.js';

const TEAM_COLORS = {
  1: '#00f0ff', // 味方・プレイヤー
  2: '#ff0055', // 敵
  3: '#ffb300', // ニュートラル/第三
};

const TEAM_GLOW_COLORS = {
  1: 'rgba(0,240,255,0.4)',
  2: 'rgba(255,0,85,0.4)',
  3: 'rgba(255,179,0,0.4)',
};

export class RenderSystem extends System {
  /**
   * @param {import('../core/ecs/Registry.js').Registry} registry
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} worldW
   * @param {number} worldH
   */
  constructor(registry, ctx, worldW, worldH) {
    super(registry);
    this.ctx = ctx;
    this.worldW = worldW;
    this.worldH = worldH;

    this.cameraX = 0;
    this.cameraY = 0;

    // 背景の星
    this._stars = [];
    this._initStars(300);
  }

  _initStars(count) {
    for (let i = 0; i < count; i++) {
      this._stars.push({
        x: Math.random() * this.worldW,
        y: Math.random() * this.worldH,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.3,
        parallax: Math.random() * 0.3 + 0.1,
      });
    }
  }

  followEntity(entityId) {
    const t = this.registry.getComponent(entityId, 'Transform');
    if (t) {
      this.cameraX = t.x;
      this.cameraY = t.y;
    }
  }

  update(dt) {
    const canvas = this.ctx.canvas;
    const vw = canvas.width / (window.devicePixelRatio || 1);
    const vh = canvas.height / (window.devicePixelRatio || 1);

    // 背景クリア
    this.ctx.fillStyle = '#050510';
    this.ctx.fillRect(0, 0, vw, vh);

    // 星描画
    this._drawStars(vw, vh);

    // Entity 描画 (Renderableを持つもの)
    const entities = this.registry.getEntitiesWith(['Transform', 'Renderable']);

    for (const id of entities) {
      const transform = this.registry.getComponent(id, 'Transform');
      const renderable = this.registry.getComponent(id, 'Renderable');

      if (!renderable.visible) continue;

      const screen = this._toScreen(transform.x, transform.y, vw, vh);

      // カリング (画面外なら描画しない)
      const margin = 100; // 機体やエフェクトの描画はみ出しを考慮しマージンを大きめにとる
      if (
        screen.sx < -margin || screen.sx > vw + margin ||
        screen.sy < -margin || screen.sy > vh + margin
      ) {
        continue;
      }

      this.ctx.save();
      this.ctx.translate(screen.sx, screen.sy);

      // アルファ値（透明度適用: パーティクル用）
      if (renderable.alpha !== undefined && renderable.alpha < 1.0) {
        this.ctx.globalAlpha = Math.max(0, renderable.alpha);
      }

      // 新コンポーネントによる個別ディテール描画
      const shipVis = this.registry.getComponent(id, 'ShipVisual');
      const astVis = this.registry.getComponent(id, 'AsteroidVisual');
      const team = this.registry.getComponent(id, 'Team');

      if (shipVis) {
        this._drawShip(transform, renderable, shipVis, team);
      } else if (astVis) {
        this._drawAsteroid(transform, renderable, astVis);
      } else {
        // デフォルト（弾やパーティクル）
        this._drawDefaultShape(transform, renderable);
      }

      this.ctx.restore();

      // HPバー
      if (this.registry.hasComponent(id, 'Health')) {
        this._drawHpBar(id, screen.sx, screen.sy, renderable.size);
      }
    }
  }

  // ───── 描画ヘルパー ─────

  /**
   * Astro Fray の元の関数を完全移植した機体描画処理
   */
  _drawShip(transform, renderable, shipVis, teamComp) {
    const teamId = teamComp ? teamComp.teamId : 1;
    let baseColor = TEAM_COLORS[teamId] || TEAM_COLORS[1];

    if (shipVis.invulnerable || shipVis.isGhost) {
      baseColor = 'rgba(100,100,100,0.5)';
    }

    this.ctx.rotate(transform.rotation);
    
    // ロール表現
    this.ctx.scale(1, 1 + Math.sin(shipVis.rollPhase) * 0.05);

    // グローエフェクト
    if (shipVis.showGlow && !shipVis.isGhost) {
      this.ctx.shadowColor = TEAM_GLOW_COLORS[teamId] || baseColor;
      this.ctx.shadowBlur = 10;
    }

    // 王道でかっこいいSF戦闘機デザイン
    this.ctx.fillStyle = 'rgba(10, 15, 25, 0.95)';
    this.ctx.strokeStyle = baseColor;
    this.ctx.lineWidth = 1.5;

    // TODO: sizeパラメータに応じて全体のスケールを掛ける (元はスケール固定でのハードコード)
    // ここではオリジナルサイズとの比率を取る
    const scale = renderable.size / 16;
    this.ctx.scale(scale, scale);

    this.ctx.beginPath();
    this.ctx.moveTo(24, 0); // 機首先端
    this.ctx.lineTo(10, -4); // 機首サイド
    this.ctx.lineTo(4, -6); // 主翼付け根前
    this.ctx.lineTo(-4, -20); // 主翼先端前
    this.ctx.lineTo(-12, -20); // 主翼先端後
    this.ctx.lineTo(-8, -6); // 主翼付け根後
    this.ctx.lineTo(-18, -12); // 尾翼先端
    this.ctx.lineTo(-20, -4); // スラスター外側
    this.ctx.lineTo(-16, 0); // スラスター中央
    this.ctx.lineTo(-20, 4); // スラスター外側
    this.ctx.lineTo(-18, 12); // 尾翼先端
    this.ctx.lineTo(-8, 6); // 主翼付け根後
    this.ctx.lineTo(-12, 20); // 主翼先端後
    this.ctx.lineTo(-4, 20); // 主翼先端前
    this.ctx.lineTo(4, 6); // 主翼付け根前
    this.ctx.lineTo(10, 4); // 機首サイド
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // キャノピー（操縦席のガラス部分）
    this.ctx.beginPath();
    this.ctx.moveTo(10, 0);
    this.ctx.lineTo(2, -3);
    this.ctx.lineTo(-6, 0);
    this.ctx.lineTo(2, 3);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    
    // シャドウリセット
    this.ctx.shadowBlur = 0;
  }

  /**
   * Astro Fray の元の関数を完全移植した小惑星描画処理
   */
  _drawAsteroid(transform, renderable, astVis) {
    this.ctx.rotate(transform.rotation);
    this.ctx.strokeStyle = '#aab';
    this.ctx.fillStyle = '#556';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    const spikes = astVis.spikes;
    const r = renderable.size;

    for (let i = 0; i < spikes; i++) {
      const ang = (i / spikes) * (Math.PI * 2);
      // 生成時に保存された一意のオフセットを使用
      const offset = astVis.offsets[i]; 
      const rr = r * offset;
      const x = Math.cos(ang) * rr;
      const y = Math.sin(ang) * rr;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  /**
   * 単純な図形（弾やパーティクル用）
   */
  _drawDefaultShape(transform, renderable) {
    this.ctx.rotate(transform.rotation);

    if (renderable.glowColor && renderable.glowRadius > 0) {
      this.ctx.shadowColor = renderable.glowColor;
      this.ctx.shadowBlur = renderable.glowRadius;
    }

    this.ctx.fillStyle = renderable.color;
    this.ctx.strokeStyle = renderable.color;

    const size = renderable.size;
    if (renderable.shape === 'rect') {
      this.ctx.fillRect(-size * 2, -size / 2, size * 4, size);
    } else {
      // デフォルトは丸
      this.ctx.beginPath();
      this.ctx.arc(0, 0, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.shadowBlur = 0;
  }

  /**
   * 既存のHPバー描画ロジック
   */
  _drawHpBar(id, sx, sy, size) {
    const health = this.registry.getComponent(id, 'Health');
    if (!health || health.isDead) return;
    if (health.hp >= health.maxHp) return; // 満タン時は隠す（UX向上）

    const barW = size * 2.5;
    const barH = 3;
    const barX = sx - barW / 2;
    const barY = sy - size - 15;
    const ratio = Math.max(0, health.hp / health.maxHp);

    this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.ctx.fillRect(barX, barY, barW, barH);

    let barColor = '#00ff66';
    if (ratio < 0.6) barColor = '#ffb300';
    if (ratio < 0.3) barColor = '#ff0055';

    this.ctx.fillStyle = barColor;
    this.ctx.fillRect(barX, barY, barW * ratio, barH);
  }

  // ───── 座標変換 ─────

  _drawStars(vw, vh) {
    for (const star of this._stars) {
      const screen = this._toScreen(star.x, star.y, vw, vh, star.parallax);
      this.ctx.fillStyle = `rgba(200, 220, 255, ${star.alpha})`;
      this.ctx.fillRect(screen.sx, screen.sy, star.size, star.size);
    }
  }

  _toScreen(x, y, vw, vh, parallax = 1) {
    let dx = x - this.cameraX * parallax;
    let dy = y - this.cameraY * parallax;

    const halfW = this.worldW / 2;
    const halfH = this.worldH / 2;

    if (dx > halfW) dx -= this.worldW;
    else if (dx < -halfW) dx += this.worldW;
    if (dy > halfH) dy -= this.worldH;
    else if (dy < -halfH) dy += this.worldH;

    return {
      sx: dx + vw / 2,
      sy: dy + vh / 2,
    };
  }
}
