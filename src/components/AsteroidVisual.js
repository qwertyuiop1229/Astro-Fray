/**
 * AsteroidVisual コンポーネント — 小惑星描画に必要なギザギザ形状の定義を持つ
 *
 * 小惑星は生成時に各頂点のオフセット（いびつさ）が決定され、それが一生維持される。
 *
 * @param {object} opts
 * @param {number} [opts.spikes] — 頂点の数
 * @returns {object}
 */
export function createAsteroidVisual({ spikes = 10 } = {}) {
  // 生成時に各頂点のオフセット乱数を固定生成
  const offsets = new Array(spikes);
  for (let i = 0; i < spikes; i++) {
    // 古いgame.jsの `0.7 + 0.5 * Math.sin(i * 2.3)` や乱数を模倣
    // より自然な岩にするためランダム性を追加
    offsets[i] = 0.7 + Math.random() * 0.4;
  }
  
  return {
    spikes,
    offsets,
  };
}
