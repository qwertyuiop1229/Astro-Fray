/**
 * CollisionSystem — SpatialHash を用いた高速衝突検出
 *
 * 毎フレーム:
 *   1. SpatialHash をクリアし全 Collider Entity を再登録
 *   2. 各 Entity の近傍をクエリし、衝突ペアを検出
 *   3. 衝突イベントをコールバックで通知
 */
import { System } from '../core/ecs/System.js';
import { SpatialHash } from '../core/physics/SpatialHash.js';

export class CollisionSystem extends System {
  /**
   * @param {import('../core/ecs/Registry.js').Registry} registry
   * @param {number} cellSize — SpatialHash のセルサイズ
   * @param {number} worldW
   * @param {number} worldH
   */
  constructor(registry, cellSize, worldW, worldH) {
    super(registry);
    this.spatialHash = new SpatialHash(cellSize, worldW, worldH);
    this.worldW = worldW;
    this.worldH = worldH;

    /**
     * 衝突時に呼ばれるコールバック群
     * @type {Array<function(number, number): void>}
     */
    this._onCollisionCallbacks = [];
  }

  /**
   * 衝突発生時のコールバックを登録する
   * @param {function(number, number): void} callback — (entityA, entityB) => void
   */
  onCollision(callback) {
    this._onCollisionCallbacks.push(callback);
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    const entities = this.registry.getEntitiesWith(['Transform', 'Collider']);

    // ── Phase 1: SpatialHash に全 Entity を登録 ──
    this.spatialHash.clear();

    for (const id of entities) {
      const t = this.registry.getComponent(id, 'Transform');
      const c = this.registry.getComponent(id, 'Collider');
      const radius = c.type === 'circle' ? c.radius : Math.max(c.width, c.height) / 2;
      this.spatialHash.insert(id, t.x, t.y, radius);
    }

    // ── Phase 2: 衝突ペアの検出 ──
    // 重複回避用セット（A-B と B-A を1回だけ処理する）
    const checked = new Set();

    for (const idA of entities) {
      const tA = this.registry.getComponent(idA, 'Transform');
      const cA = this.registry.getComponent(idA, 'Collider');
      const radiusA = cA.type === 'circle' ? cA.radius : Math.max(cA.width, cA.height) / 2;

      const nearby = this.spatialHash.getNearby(tA.x, tA.y, radiusA);

      for (const idB of nearby) {
        if (idA === idB) continue;

        // 順序正規化されたペアキーで重複チェック
        const pairKey = idA < idB ? idA + '|' + idB : idB + '|' + idA;
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        const tB = this.registry.getComponent(idB, 'Transform');
        const cB = this.registry.getComponent(idB, 'Collider');

        if (this._testCollision(tA, cA, tB, cB)) {
          // 衝突コールバックを発火
          for (const cb of this._onCollisionCallbacks) {
            cb(idA, idB);
          }
        }
      }
    }
  }

  /**
   * 2つの Collider が衝突しているかテスト（トーラス距離使用）
   * @private
   * @returns {boolean}
   */
  _testCollision(tA, cA, tB, cB) {
    // 現時点では Circle vs Circle のみ実装
    // AABB は将来の拡張で追加
    if (cA.type === 'circle' && cB.type === 'circle') {
      const dist2 = this._torusDist2(tA.x, tA.y, tB.x, tB.y);
      const radSum = cA.radius + cB.radius;
      return dist2 <= radSum * radSum;
    }

    // フォールバック: AABB を含む場合は円として近似
    const rA = cA.type === 'circle' ? cA.radius : Math.max(cA.width, cA.height) / 2;
    const rB = cB.type === 'circle' ? cB.radius : Math.max(cB.width, cB.height) / 2;
    const dist2 = this._torusDist2(tA.x, tA.y, tB.x, tB.y);
    return dist2 <= (rA + rB) * (rA + rB);
  }

  /**
   * トーラス空間上の2点間の距離の2乗
   * @private
   */
  _torusDist2(ax, ay, bx, by) {
    let dx = ax - bx;
    let dy = ay - by;
    if (dx > this.worldW / 2) dx -= this.worldW;
    else if (dx < -this.worldW / 2) dx += this.worldW;
    if (dy > this.worldH / 2) dy -= this.worldH;
    else if (dy < -this.worldH / 2) dy += this.worldH;
    return dx * dx + dy * dy;
  }
}
