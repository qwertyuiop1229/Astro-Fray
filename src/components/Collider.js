/**
 * Collider コンポーネント — 当たり判定の定義
 * @param {object} opts
 * @param {'circle'|'aabb'} opts.type — 形状タイプ
 * @param {number} opts.radius — 円の半径（type='circle' 時）
 * @param {number} [opts.width] — AABBの横幅
 * @param {number} [opts.height] — AABBの縦幅
 * @param {string} [opts.layer] — 衝突レイヤー ('player','bullet','asteroid' etc.)
 * @returns {object}
 */
export function createCollider({
  type = 'circle',
  radius = 14,
  width = 0,
  height = 0,
  layer = 'default',
} = {}) {
  return { type, radius, width, height, layer };
}
