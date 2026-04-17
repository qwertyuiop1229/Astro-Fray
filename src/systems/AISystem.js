/**
 * AISystem — AIControl を持つ Entity の仮想入力 (PlayerInput) を生成する
 */
import { System } from '../core/ecs/System.js';

export class AISystem extends System {
  /**
   * @param {number} dt
   */
  update(dt) {
    const aiEntities = this.registry.getEntitiesWith(['AIControl', 'Transform', 'PlayerInput', 'Velocity']);

    for (const aiId of aiEntities) {
      const ai = this.registry.getComponent(aiId, 'AIControl');
      const transform = this.registry.getComponent(aiId, 'Transform');
      const input = this.registry.getComponent(aiId, 'PlayerInput');
      const vel = this.registry.getComponent(aiId, 'Velocity');

      // 毎フレーム入力を一旦リセット
      input.thrust = false;
      input.brake = false;
      input.shoot = false;
      input.turnLeft = false;
      input.turnRight = false;
      input.useAimAngle = false;

      if (ai.targetId !== -1 && this.registry.isAlive(ai.targetId)) {
        const targetTransform = this.registry.getComponent(ai.targetId, 'Transform');
        
        if (targetTransform) {
          // ターゲットへの方向を計算
          // FIXME: 本格的なトーラスワールド対応の場合、画面端越しの最短距離を計算する必要があるが、
          // 一旦は単純な直線計算で実装する。
          const dx = targetTransform.x - transform.x;
          const dy = targetTransform.y - transform.y;
          const distSq = dx * dx + dy * dy;
          const aimAngle = Math.atan2(dy, dx);

          // エイム（自動旋回）
          input.aimAngle = aimAngle;
          input.useAimAngle = true;

          // 対象に向かっての推力制御
          // ターゲットとの距離が遠ければ推進し、近ければ止まる
          const stopDist = 300;
          if (distSq > stopDist * stopDist) {
            input.thrust = true;
          } else {
            input.brake = true;
          }

          // 向いている方向とターゲットへの方向の誤差を計算
          let angleDiff = aimAngle - transform.rotation;
          angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
          if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          // 正面にターゲットがいて、距離が射程圏内（600以内）なら射撃
          if (Math.abs(angleDiff) < 0.2 && distSq < 600 * 600) {
            input.shoot = true;
          }
        } else {
          // ターゲットが見つからない場合ターゲット解除
          ai.targetId = -1;
        }
      } else {
        // ターゲットがいない（Idle状態）の場合はゆっくり巡回
        // 適当なAIロジック（そのまま直進するか適当に回る）
        input.thrust = true;
        // 小さな確率で旋回方向を変えるなどの処理を本来は入れる
      }
    }
  }
}
