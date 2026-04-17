/**
 * MovementSystem — Transform + Velocity を持つ Entity の位置を更新する
 *
 * 権威サーバーモデルでは、このサーバー側で稼動する。
 * クライアントは結果（Transform）のみ受け取って描画する。
 *
 * トーラスワールド対応: ワールド境界をラップする。
 */
import { System } from '../core/ecs/System.js';

import { createTransform } from '../components/Transform.js';
import { createVelocity } from '../components/Velocity.js';
import { createRenderable } from '../components/Renderable.js';
import { createLifetime } from '../components/Lifetime.js';
import { createParticle } from '../components/Particle.js';

export class MovementSystem extends System {
  /**
   * @param {import('../core/ecs/Registry.js').Registry} registry
   * @param {number} worldW - ワールド横幅
   * @param {number} worldH - ワールド縦幅
   */
  constructor(registry, worldW, worldH) {
    super(registry);
    this.worldW = worldW;
    this.worldH = worldH;
  }

  /**
   * @param {number} dt — 秒
   */
  update(dt) {
    const entities = this.registry.getEntitiesWith(['Transform', 'Velocity']);

    for (const id of entities) {
      const transform = this.registry.getComponent(id, 'Transform');
      const vel = this.registry.getComponent(id, 'Velocity');

      // PlayerInput があればそれに基づいて速度を変更する
      if (this.registry.hasComponent(id, 'PlayerInput')) {
        const input = this.registry.getComponent(id, 'PlayerInput');
        this._applyInput(transform, vel, input, dt);
      }

      // 減衰（ドラッグ）の適用
      vel.vx *= Math.pow(vel.drag, dt * 60);
      vel.vy *= Math.pow(vel.drag, dt * 60);

      // 速度制限
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      if (speed > vel.maxSpeed) {
        const ratio = vel.maxSpeed / speed;
        vel.vx *= ratio;
        vel.vy *= ratio;
      }

      // 位置の更新
      transform.x += vel.vx * dt;
      transform.y += vel.vy * dt;

      // トーラスラップ
      transform.x = ((transform.x % this.worldW) + this.worldW) % this.worldW;
      transform.y = ((transform.y % this.worldH) + this.worldH) % this.worldH;
    }
  }

  /**
   * PlayerInput に基づいて推力と旋回を適用する
   * @private
   */
  _applyInput(transform, vel, input, dt) {
    const TURN_SPEED = 4.0;   // ラジアン/秒
    const THRUST_POWER = 400; // ピクセル/秒²

    // ─── 旋回 ───
    if (input.useAimAngle) {
      // マウスエイム: aimAngle に向かって滑らかに旋回
      let diff = input.aimAngle - transform.rotation;
      // -PI ~ PI にラップ
      diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;

      const maxTurn = TURN_SPEED * 2 * dt;
      if (Math.abs(diff) < maxTurn) {
        transform.rotation = input.aimAngle;
      } else {
        transform.rotation += Math.sign(diff) * maxTurn;
      }
    } else {
      // キーボード旋回
      if (input.turnLeft) transform.rotation -= TURN_SPEED * dt;
      if (input.turnRight) transform.rotation += TURN_SPEED * dt;
    }

    // 回転の正規化 (0 ~ 2PI)
    transform.rotation = ((transform.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // ─── 推力 ───
    if (input.thrust) {
      const power = input.boost ? THRUST_POWER * 1.8 : THRUST_POWER;
      vel.vx += Math.cos(transform.rotation) * power * dt;
      vel.vy += Math.sin(transform.rotation) * power * dt;

      // ブースターエフェクト（パーティクル生成）
      this._spawnBoosterParticle(transform, input.boost);
    }

    // ─── ブレーキ ───
    if (input.brake) {
      vel.vx *= Math.pow(0.93, dt * 60);
      vel.vy *= Math.pow(0.93, dt * 60);
    }
  }

  /**
   * エンジン噴射のパーティクルを生成
   * @private
   */
  _spawnBoosterParticle(transform, isBoost) {
    // 毎フレーム確定で出すと多すぎるため調整（約30%〜50%の確率で生成）
    if (Math.random() > (isBoost ? 0.7 : 0.4)) return;

    const pId = this.registry.createEntity();
    
    // エンジンは機体の後方（-20pxあたり）にある
    const backX = transform.x - Math.cos(transform.rotation) * 20;
    const backY = transform.y - Math.sin(transform.rotation) * 20;
    
    // パーティクルは機体の逆方向（+少しのバラつき）に飛ぶ
    const scatter = (Math.random() - 0.5) * 0.5;
    const angle = transform.rotation + Math.PI + scatter;
    const speed = isBoost ? (150 + Math.random() * 100) : (50 + Math.random() * 50);

    const color = isBoost ? '#00f0ff' : '#ffb300';

    this.registry.addComponent(pId, 'Transform', createTransform(backX, backY, angle));
    this.registry.addComponent(pId, 'Velocity', createVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed, 500, 0.9));
    this.registry.addComponent(pId, 'Renderable', createRenderable({
      shape: 'circle', size: isBoost ? 4 : 2, color: color, glowColor: color, glowRadius: 6
    }));
    this.registry.addComponent(pId, 'Lifetime', createLifetime(Math.random() * 0.3 + 0.1));
    this.registry.addComponent(pId, 'Particle', createParticle({ fade: true, shrink: true, initialSize: 5 }));
  }
}
