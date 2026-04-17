/**
 * LifetimeSystem — Entityの寿命を管理し、尽きたら破棄する
 */
import { System } from '../core/ecs/System.js';

export class LifetimeSystem extends System {
  /**
   * @param {number} dt
   */
  update(dt) {
    const entities = this.registry.getEntitiesWith(['Lifetime']);

    for (const id of entities) {
      const lifetime = this.registry.getComponent(id, 'Lifetime');
      lifetime.currentLife -= dt;

      if (lifetime.currentLife <= 0) {
        // 寿命が尽きたら Entity と全てのコンポーネントを即座に破棄
        this.registry.destroyEntity(id);
      }
    }
  }
}
