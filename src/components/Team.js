/**
 * Team コンポーネント — 所属チームを管理し、色分けなどを決定する。
 *
 * @param {object} opts
 * @param {number} opts.teamId — チームID（1: 味方/プレイヤー, 2: 敵, 3: 第三勢力など）
 * @returns {object}
 */
export function createTeam({ teamId = 1 } = {}) {
  return { teamId };
}
