/**
 * Health コンポーネント — HP, シールド, 無敵時間
 * @param {object} opts
 * @param {number} opts.hp — 現在HP
 * @param {number} opts.maxHp — 最大HP
 * @param {number} [opts.shield] — シールドHP
 * @param {number} [opts.maxShield] — 最大シールド
 * @param {number} [opts.invincibleTimer] — 無敵残り秒数
 * @returns {object}
 */
export function createHealth({
  hp = 100,
  maxHp = 100,
  shield = 0,
  maxShield = 0,
  invincibleTimer = 0,
} = {}) {
  return { hp, maxHp, shield, maxShield, invincibleTimer, isDead: false };
}
