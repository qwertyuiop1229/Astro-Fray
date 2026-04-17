/**
 * GameStore — Zustand/Redux ライクな軽量パブリッシュ・サブスクライブ・ストア
 *
 * ゲーム全体のメタ状態（マッチ進行度、スコア、フェーズ etc.）を
 * 単一オブジェクトで管理し、変更時にリスナーへ通知する。
 *
 * ※ ECS の Entity/Component データは Registry が管理する。
 *   Store はそれ以外の「ゲームセッション全体の状態」を扱う。
 */
export class GameStore {
  /**
   * @param {object} initialState - 初期状態オブジェクト
   */
  constructor(initialState = {}) {
    /** @private */
    this._state = { ...initialState };

    /**
     * リスナー関数のセット。setState 時に全て呼ばれる。
     * @private
     * @type {Set<function>}
     */
    this._listeners = new Set();
  }

  /**
   * 現在の状態のスナップショットを返す（読み取り専用の意図）。
   * パフォーマンスのため浅いコピーは行わない。
   * 呼び出し側は直接変更しないこと。
   * @returns {object}
   */
  getState() {
    return this._state;
  }

  /**
   * 状態を部分的に更新し、全リスナーに通知する。
   *
   * @param {object | function} partial
   *   - object: 既存状態にシャロー・マージされる
   *   - function: (prevState) => partialState を返す関数
   */
  setState(partial) {
    const prev = this._state;

    if (typeof partial === 'function') {
      partial = partial(prev);
    }

    // 変更がなければ通知をスキップ
    if (partial === null || partial === undefined) return;

    this._state = { ...prev, ...partial };
    this._notify();
  }

  /**
   * 状態変更時に呼ばれるリスナーを登録する。
   * @param {function} listener - (state) => void
   * @returns {function} unsubscribe 関数
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * 全リスナーに現在の状態を通知する
   * @private
   */
  _notify() {
    const state = this._state;
    for (const fn of this._listeners) {
      try {
        fn(state);
      } catch (err) {
        console.error('[GameStore] Listener error:', err);
      }
    }
  }

  /**
   * ストアを完全にリセットする
   * @param {object} [newState={}]
   */
  reset(newState = {}) {
    this._state = { ...newState };
    this._notify();
  }
}
