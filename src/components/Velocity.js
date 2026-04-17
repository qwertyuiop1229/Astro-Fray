/**
 * Velocity コンポーネント — 速度と加速パラメータ
 * @param {number} vx
 * @param {number} vy
 * @param {number} maxSpeed — 最大速度
 * @param {number} drag — 減衰係数 (0〜1, 1=減衰なし)
 * @returns {object}
 */
export function createVelocity(vx = 0, vy = 0, maxSpeed = 300, drag = 0.98) {
  return { vx, vy, maxSpeed, drag };
}
