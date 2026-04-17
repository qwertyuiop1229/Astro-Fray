/**
 * Transform コンポーネント — 位置と回転
 * @param {number} x
 * @param {number} y
 * @param {number} rotation — ラジアン
 * @returns {object}
 */
export function createTransform(x = 0, y = 0, rotation = 0) {
  return { x, y, rotation };
}
