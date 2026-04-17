/**
 * System 基底クラス
 *
 * すべてのゲームロジック（移動、衝突判定、描画 etc.）は
 * このクラスを継承し、update() を実装する。
 *
 * System 自体は状態を持たない（ステートレス）設計を推奨。
 * 状態は Registry のコンポーネントまたは Store に格納する。
 */
export class System {
  /**
   * @param {import('./Registry.js').Registry} registry
   */
  constructor(registry) {
    /** @type {import('./Registry.js').Registry} */
    this.registry = registry;

    /**
     * このシステムが有効かどうか。
     * false の場合、GameLoop から update() が呼ばれない。
     * @type {boolean}
     */
    this.enabled = true;
  }

  /**
   * 毎フレーム呼ばれるメインロジック。
   * サブクラスで必ずオーバーライドすること。
   *
   * @param {number} dt - 前フレームからの経過時間（秒）
   */
  update(dt) {
    // サブクラスで実装
  }
}
