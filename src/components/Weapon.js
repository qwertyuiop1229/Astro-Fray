/**
 * Weapon コンポーネント — 武器と射撃のプロパティ
 * @param {object} opts
 * @param {number} opts.fireRate — 1秒あたりの発射数
 * @param {number} [opts.cooldown] — 現在のクールダウン（秒）
 * @param {number} [opts.projectileSpeed] — 弾速
 * @param {number} [opts.projectileDamage] — 弾の威力
 * @param {string} [opts.projectileColor] — 弾の色
 * @param {string} [opts.ownerLayer] — 'player' や 'enemy' など、元の発射者の属するレイヤー
 * @returns {object}
 */
export function createWeapon({
  fireRate = 5,
  cooldown = 0,
  projectileSpeed = 800,
  projectileDamage = 25,
  projectileColor = '#00f0ff',
  ownerLayer = 'player',
} = {}) {
  return { fireRate, cooldown, projectileSpeed, projectileDamage, projectileColor, ownerLayer };
}
