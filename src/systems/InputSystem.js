/**
 * InputSystem — キーボード/マウス入力を PlayerInput コンポーネントに反映する
 *
 * 権威サーバーモデルにおいて、クライアントが送信するのは「入力」のみ。
 * このシステムが生の入力を抽象化し、PlayerInput コンポーネントに書き込む。
 */
import { System } from '../core/ecs/System.js';

export class InputSystem extends System {
  /**
   * @param {import('../core/ecs/Registry.js').Registry} registry
   * @param {HTMLCanvasElement} canvas
   */
  constructor(registry, canvas) {
    super(registry);

    /** @private */
    this._canvas = canvas;

    /** @private — 現在押されているキーのマップ */
    this._keys = {};

    /** @private — マウス/カーソル状態 */
    this._mouse = { x: 0, y: 0, down: false };

    this._setupListeners();
  }

  /** @private */
  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      this._keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      this._keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('mousemove', (e) => {
      const rect = this._canvas.getBoundingClientRect();
      this._mouse.x = e.clientX - rect.left;
      this._mouse.y = e.clientY - rect.top;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.target === this._canvas) this._mouse.down = true;
    });
    window.addEventListener('mouseup', () => {
      this._mouse.down = false;
    });
  }

  /**
   * PlayerInput コンポーネントを持つ全 Entity の入力状態を更新する
   * @param {number} dt
   */
  update(dt) {
    const entities = this.registry.getEntitiesWith(['PlayerInput', 'Transform']);

    for (const id of entities) {
      // AI操作のエンティティはスキップ（入力を上書きしないようにする）
      if (this.registry.hasComponent(id, 'AIControl')) continue;

      const input = this.registry.getComponent(id, 'PlayerInput');
      const transform = this.registry.getComponent(id, 'Transform');

      // キーボード入力 → アクションへのマッピング
      input.thrust = !!(this._keys['w'] || this._keys['arrowup']);
      input.brake = !!(this._keys['s'] || this._keys['arrowdown']);
      input.turnLeft = !!(this._keys['a'] || this._keys['arrowleft']);
      input.turnRight = !!(this._keys['d'] || this._keys['arrowright']);
      input.shoot = !!(this._keys[' '] || this._mouse.down);
      input.boost = !!(this._keys['shift']);

      // マウスエイム: キャンバス中心からマウスへの角度を計算
      const canvasW = this._canvas.width / (window.devicePixelRatio || 1);
      const canvasH = this._canvas.height / (window.devicePixelRatio || 1);
      const dx = this._mouse.x - canvasW / 2;
      const dy = this._mouse.y - canvasH / 2;

      // マウスが中心から十分離れている場合のみエイムを適用
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        input.aimAngle = Math.atan2(dy, dx);
        input.useAimAngle = true;
      } else {
        input.useAimAngle = false;
      }
    }
  }

  /**
   * リソースクリーンアップ用（将来的にリスナー解除が必要な場合）
   */
  destroy() {
    // 将来的にイベントリスナーを保持して解除する場合にここに追加
  }
}
