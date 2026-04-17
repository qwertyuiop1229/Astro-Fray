/**
 * AIControl コンポーネント — 敵のステートとターゲット
 *
 * @param {object} opts
 * @param {string} [opts.state] — 'idle', 'chase', 'flee' などの行動ステート
 * @param {number} [opts.targetId] — 狙っている Entity の ID (-1 はターゲットなし)
 * @returns {object}
 */
export function createAIControl({
  state = 'idle',
  targetId = -1,
} = {}) {
  return { state, targetId };
}
