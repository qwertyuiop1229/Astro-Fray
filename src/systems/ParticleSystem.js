/**
 * ParticleSystem — エフェクト（Particle）のスケーリングとフェードアウト
 */
import { System } from '../core/ecs/System.js';

export class ParticleSystem extends System {
  /**
   * @param {number} dt
   */
  update(dt) {
    const entities = this.registry.getEntitiesWith(['Particle', 'Lifetime', 'Renderable']);

    for (const id of entities) {
      const particle = this.registry.getComponent(id, 'Particle');
      const lifetime = this.registry.getComponent(id, 'Lifetime');
      const renderable = this.registry.getComponent(id, 'Renderable');

      // 寿命の残り割合 (1.0 -> 0.0)
      const ratio = Math.max(0, lifetime.currentLife / lifetime.maxLife);

      if (particle.shrink) {
        renderable.size = particle.initialSize * ratio;
      }

      if (particle.fade) {
        // Renderableコンポーネントにアルファ値（透明度）を適用
        renderable.alpha = ratio;
      }
    }
  }
}
