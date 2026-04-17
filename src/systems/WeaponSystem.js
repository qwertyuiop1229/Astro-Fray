/**
 * WeaponSystem — 発射フラグに応じて弾 (Projectile) Entity を生成する
 */
import { System } from '../core/ecs/System.js';

import { createTransform } from '../components/Transform.js';
import { createVelocity } from '../components/Velocity.js';
import { createRenderable } from '../components/Renderable.js';
import { createCollider } from '../components/Collider.js';
import { createProjectile } from '../components/Projectile.js';
import { createLifetime } from '../components/Lifetime.js';

export class WeaponSystem extends System {
  /**
   * @param {number} dt
   */
  update(dt) {
    // 武器を持っていて、かつ Transform(位置)と入力手段(PlayerInput)を持つEntityを探す
    // ※ 敵AIの場合は PlayerInput コンポーネントを再利用して仮想入力として扱う
    const entities = this.registry.getEntitiesWith(['Weapon', 'Transform', 'PlayerInput']);

    for (const id of entities) {
      const weapon = this.registry.getComponent(id, 'Weapon');
      const transform = this.registry.getComponent(id, 'Transform');
      const input = this.registry.getComponent(id, 'PlayerInput');
      const velocity = this.registry.getComponent(id, 'Velocity');

      // クールダウン更新
      if (weapon.cooldown > 0) {
        weapon.cooldown -= dt;
      }

      // 射撃入力があり、クールダウン完了していれば発射
      if (input.shoot && weapon.cooldown <= 0) {
        // クールダウンリセット
        weapon.cooldown = 1.0 / weapon.fireRate;

        // 弾のEntityを生成
        this._fireProjectile(weapon, transform, velocity);
      }
    }
  }

  /**
   * 弾Entityの生成
   * @private
   */
  _fireProjectile(weapon, transform, parentVelocity) {
    const bulletId = this.registry.createEntity();

    // 弾の発射位置（機体の少し前方にオフセット）
    const offsetDistance = 20;
    const spawnX = transform.x + Math.cos(transform.rotation) * offsetDistance;
    const spawnY = transform.y + Math.sin(transform.rotation) * offsetDistance;

    // 弾の速度ベクトル（発射方向の速度ベクトルに、親の現在速度を合成する）
    let vx = Math.cos(transform.rotation) * weapon.projectileSpeed;
    let vy = Math.sin(transform.rotation) * weapon.projectileSpeed;
    
    if (parentVelocity) {
      vx += parentVelocity.vx;
      vy += parentVelocity.vy;
    }

    // 弾に必要な全コンポーネントをアタッチ
    this.registry.addComponent(bulletId, 'Transform', createTransform(spawnX, spawnY, transform.rotation));
    this.registry.addComponent(bulletId, 'Velocity', createVelocity(vx, vy, 2000, 1.0)); // 減衰なし(drag=1.0)
    
    this.registry.addComponent(bulletId, 'Renderable', createRenderable({
      shape: 'rect',    // 弾は長方形
      size: 4,          // 短辺の半分のイメージ
      color: weapon.projectileColor,
      glowColor: weapon.projectileColor,
      glowRadius: 8,
    }));

    this.registry.addComponent(bulletId, 'Collider', createCollider({
      type: 'circle',
      radius: 5,
      layer: weapon.ownerLayer, // 'player' or 'enemy'
    }));

    this.registry.addComponent(bulletId, 'Projectile', createProjectile({
      damage: weapon.projectileDamage,
      ownerLayer: weapon.ownerLayer,
    }));

    this.registry.addComponent(bulletId, 'Lifetime', createLifetime(1.5)); // 1.5秒で自動消滅
  }
}
