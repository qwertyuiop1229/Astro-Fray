/**
 * Particle コンポーネント — エフェクトアニメーション用のパラメータ
 *
 * 寿命(Lifetime)と連動して、徐々に透明になったり小さくなったりする。
 * 
 * @param {object} opts
 * @param {boolean} [opts.fade] — 寿命と共に透明にするか
 * @param {boolean} [opts.shrink] — 寿命と共に小さくするか
 * @param {number} [opts.initialSize] — 初期サイズ
 * @returns {object}
 */
export function createParticle({
  fade = true,
  shrink = false,
  initialSize = 5,
} = {}) {
  return { fade, shrink, initialSize };
}
