/**
 * ECS Registry — Entity と Component の中央管理
 *
 * データ指向設計: コンポーネントは「名前 → Map<EntityId, データ>」で管理され、
 * System は必要なコンポーネント名のリストで Entity を高速にクエリできる。
 */

let _nextId = 0;

export class Registry {
  constructor() {
    /**
     * コンポーネントストア
     * key: コンポーネント名 (string)
     * value: Map<number, object> — EntityId をキーに持つデータMap
     * @type {Map<string, Map<number, object>>}
     */
    this._stores = new Map();

    /**
     * 生存中の全 Entity ID のセット
     * @type {Set<number>}
     */
    this._alive = new Set();

    /**
     * Entity が持つコンポーネント名のセット（高速な has/query 用）
     * @type {Map<number, Set<string>>}
     */
    this._masks = new Map();
  }

  // ───────── Entity ライフサイクル ─────────

  /**
   * 新しい Entity を作成し、そのIDを返す
   * @returns {number} entityId
   */
  createEntity() {
    const id = _nextId++;
    this._alive.add(id);
    this._masks.set(id, new Set());
    return id;
  }

  /**
   * Entity を破棄し、すべての紐づくコンポーネントを除去する
   * @param {number} id
   */
  destroyEntity(id) {
    if (!this._alive.has(id)) return;

    const mask = this._masks.get(id);
    if (mask) {
      for (const name of mask) {
        const store = this._stores.get(name);
        if (store) store.delete(id);
      }
    }
    this._masks.delete(id);
    this._alive.delete(id);
  }

  /**
   * Entity が存在するか
   * @param {number} id
   * @returns {boolean}
   */
  isAlive(id) {
    return this._alive.has(id);
  }

  // ───────── Component 操作 ─────────

  /**
   * Entity にコンポーネントを追加する
   * @param {number} id - EntityId
   * @param {string} name - コンポーネント名
   * @param {object} data - コンポーネントデータ（純粋オブジェクト）
   * @returns {object} 追加されたデータへの参照
   */
  addComponent(id, name, data) {
    if (!this._alive.has(id)) {
      throw new Error(`Entity ${id} does not exist`);
    }

    if (!this._stores.has(name)) {
      this._stores.set(name, new Map());
    }

    this._stores.get(name).set(id, data);
    this._masks.get(id).add(name);
    return data;
  }

  /**
   * Entity からコンポーネントを除去する
   * @param {number} id
   * @param {string} name
   */
  removeComponent(id, name) {
    const store = this._stores.get(name);
    if (store) store.delete(id);

    const mask = this._masks.get(id);
    if (mask) mask.delete(name);
  }

  /**
   * Entity のコンポーネントデータを取得する
   * @param {number} id
   * @param {string} name
   * @returns {object|undefined}
   */
  getComponent(id, name) {
    const store = this._stores.get(name);
    return store ? store.get(id) : undefined;
  }

  /**
   * Entity が指定のコンポーネントを持つか
   * @param {number} id
   * @param {string} name
   * @returns {boolean}
   */
  hasComponent(id, name) {
    const mask = this._masks.get(id);
    return mask ? mask.has(name) : false;
  }

  // ───────── クエリ ─────────

  /**
   * 指定したコンポーネント名を「全て」持つ Entity のリストを返す
   *
   * パフォーマンス最適化:
   * 最も登録数の少ないコンポーネントの Map を走査し、
   * 他の必須コンポーネントを has チェックすることで、
   * 走査対象を最小にする。
   *
   * @param {string[]} componentNames
   * @returns {number[]} マッチする EntityId の配列
   */
  getEntitiesWith(componentNames) {
    if (componentNames.length === 0) return [];

    // 最小の Store を基準に走査（交差フィルタの最適化）
    let smallest = null;
    let smallestSize = Infinity;

    for (const name of componentNames) {
      const store = this._stores.get(name);
      if (!store || store.size === 0) return []; // 1つでも空なら結果は空
      if (store.size < smallestSize) {
        smallest = store;
        smallestSize = store.size;
      }
    }

    const result = [];
    for (const id of smallest.keys()) {
      if (!this._alive.has(id)) continue;

      let match = true;
      for (const name of componentNames) {
        if (!this._masks.get(id).has(name)) {
          match = false;
          break;
        }
      }
      if (match) result.push(id);
    }

    return result;
  }

  /**
   * 全ての生存 Entity ID を返す
   * @returns {number[]}
   */
  getAllEntities() {
    return Array.from(this._alive);
  }

  /**
   * Registry 内の全データをクリアする（マッチ終了/リセット用）
   */
  clear() {
    this._stores.clear();
    this._alive.clear();
    this._masks.clear();
    _nextId = 0;
  }
}
