/**
 * Renderable コンポーネント — 描画に必要な視覚情報
 * @param {object} opts
 * @param {string} opts.shape — 'triangle' | 'circle' | 'rect'
 * @param {number} opts.size — 基本サイズ（半径やスケール基準）
 * @param {string} opts.color — CSS カラー文字列
 * @param {string} [opts.glowColor] — グローエフェクト用色
 * @param {number} [opts.glowRadius] — グロー半径
 * @param {number} [opts.alpha] — 透明度 (0.0 ~ 1.0)
 * @returns {object}
 */
export function createRenderable({
  shape = 'triangle',
  size = 14,
  color = '#00f0ff',
  glowColor = null,
  glowRadius = 0,
  alpha = 1.0,
} = {}) {
  return { shape, size, color, glowColor, glowRadius, alpha, visible: true };
}
