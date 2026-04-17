/**
 * Lifetime コンポーネント — Entityの寿命管理
 *
 * @param {number} maxLife — 最大寿命（秒）。この時間を過ぎるとEntityは破棄される。
 * @returns {object}
 */
export function createLifetime(maxLife = 2.0) {
  return {
    maxLife,
    currentLife: maxLife, // 残り寿命
  };
}
