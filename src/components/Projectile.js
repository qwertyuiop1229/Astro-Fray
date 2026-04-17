/**
 * Projectile コンポーネント — 弾としてのプロパティ
 * @param {object} opts
 * @param {number} opts.damage — 威力
 * @param {string} opts.ownerLayer — 発射した所属（'player' または 'enemy'）。同じ所属には当たらないようにする。
 * @returns {object}
 */
export function createProjectile({
  damage = 25,
  ownerLayer = 'player',
} = {}) {
  return { damage, ownerLayer };
}
