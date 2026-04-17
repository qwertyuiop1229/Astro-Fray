/**
 * SpatialHash — O(N²) を回避する空間分割グリッド
 *
 * マップ空間を固定サイズのセル（バケット）に分割し、
 * 各 Entity を所属セルに登録することで、
 * 衝突判定の候補を近傍セルの Entity だけに絞り込む。
 *
 * トーラスワールド（上下左右がループする）に対応。
 */
export class SpatialHash {
  /**
   * @param {number} cellSize - グリッド1セルのピクセル幅/高さ
   * @param {number} worldW - ワールドの横幅
   * @param {number} worldH - ワールドの縦幅
   */
  constructor(cellSize, worldW, worldH) {
    /** @type {number} */
    this.cellSize = cellSize;

    /** @type {number} */
    this.worldW = worldW;

    /** @type {number} */
    this.worldH = worldH;

    /** セル列数・行数 */
    this.cols = Math.ceil(worldW / cellSize);
    this.rows = Math.ceil(worldH / cellSize);

    /**
     * バケット: セルキー → EntityId の配列
     * 毎フレーム clear → insert で再構築される。
     * @type {Map<string, number[]>}
     */
    this._buckets = new Map();
  }

  /**
   * 全バケットをクリアする。毎フレームの先頭で呼ぶ。
   */
  clear() {
    this._buckets.clear();
  }

  /**
   * セル座標からキー文字列を生成する
   * @param {number} cx - セル列 (0 ~ cols-1)
   * @param {number} cy - セル行 (0 ~ rows-1)
   * @returns {string}
   */
  _key(cx, cy) {
    return cx + ',' + cy;
  }

  /**
   * ワールド座標をセル座標に変換する
   * トーラス対応: 負座標や範囲外の座標もラップする
   * @param {number} x
   * @param {number} y
   * @returns {{cx: number, cy: number}}
   */
  _toCell(x, y) {
    let cx = Math.floor(x / this.cellSize);
    let cy = Math.floor(y / this.cellSize);

    // トーラスラップ
    cx = ((cx % this.cols) + this.cols) % this.cols;
    cy = ((cy % this.rows) + this.rows) % this.rows;

    return { cx, cy };
  }

  /**
   * Entity をバケットに登録する。
   * 半径を考慮し、複数セルにまたがる場合は全てに登録する。
   *
   * @param {number} entityId
   * @param {number} x - ワールドX
   * @param {number} y - ワールドY
   * @param {number} [radius=0] - Entity の半径（当たり判定の広がり）
   */
  insert(entityId, x, y, radius = 0) {
    const { cx: minCx, cy: minCy } = this._toCell(x - radius, y - radius);
    const { cx: maxCx, cy: maxCy } = this._toCell(x + radius, y + radius);

    // 半径が小さければ 1セルのみ (高速パス)
    if (minCx === maxCx && minCy === maxCy) {
      const key = this._key(minCx, minCy);
      const bucket = this._buckets.get(key);
      if (bucket) {
        bucket.push(entityId);
      } else {
        this._buckets.set(key, [entityId]);
      }
      return;
    }

    // 複数セルにまたがる場合
    // トーラスで minCx > maxCx になる場合も正しくループする
    const cellsX = this._wrapRange(minCx, maxCx, this.cols);
    const cellsY = this._wrapRange(minCy, maxCy, this.rows);

    for (const cx of cellsX) {
      for (const cy of cellsY) {
        const key = this._key(cx, cy);
        const bucket = this._buckets.get(key);
        if (bucket) {
          bucket.push(entityId);
        } else {
          this._buckets.set(key, [entityId]);
        }
      }
    }
  }

  /**
   * 指定座標の近傍にいる Entity の候補リストを返す。
   * 自身のセルと周囲8セル（計9セル）の全 Entity を重複排除して返す。
   *
   * @param {number} x
   * @param {number} y
   * @param {number} [radius=0]
   * @returns {number[]} 近傍の EntityId 配列（重複なし）
   */
  getNearby(x, y, radius = 0) {
    const { cx: minCx, cy: minCy } = this._toCell(x - radius, y - radius);
    const { cx: maxCx, cy: maxCy } = this._toCell(x + radius, y + radius);

    // 検索範囲を1セル広げて、境界付近の当たり漏れを防ぐ
    const startCx = ((minCx - 1) % this.cols + this.cols) % this.cols;
    const endCx = ((maxCx + 1) % this.cols + this.cols) % this.cols;
    const startCy = ((minCy - 1) % this.rows + this.rows) % this.rows;
    const endCy = ((maxCy + 1) % this.rows + this.rows) % this.rows;

    const cellsX = this._wrapRange(startCx, endCx, this.cols);
    const cellsY = this._wrapRange(startCy, endCy, this.rows);

    /** @type {Set<number>} */
    const seen = new Set();
    const result = [];

    for (const cx of cellsX) {
      for (const cy of cellsY) {
        const bucket = this._buckets.get(this._key(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const eid = bucket[i];
          if (!seen.has(eid)) {
            seen.add(eid);
            result.push(eid);
          }
        }
      }
    }

    return result;
  }

  /**
   * トーラスを考慮して from → to のセル座標列を生成する
   * @param {number} from
   * @param {number} to
   * @param {number} max - 列数 or 行数
   * @returns {number[]}
   * @private
   */
  _wrapRange(from, to, max) {
    const cells = [];
    let cur = from;
    // 最大でもmax個（全セル）を超えないようにガード
    const limit = max;
    for (let i = 0; i < limit; i++) {
      cells.push(cur);
      if (cur === to) break;
      cur = (cur + 1) % max;
    }
    return cells;
  }
}
