/**
 * PlayerInput コンポーネント — 入力状態の抽象化
 *
 * キーボード/タッチ/ゲームパッド等の生入力を
 * ゲームが理解できるアクション（推力、旋回 etc.）に変換した結果を格納する。
 *
 * @returns {object}
 */
export function createPlayerInput() {
  return {
    thrust: false,        // 推進（前進）
    brake: false,         // ブレーキ
    turnLeft: false,      // 左旋回
    turnRight: false,     // 右旋回
    shoot: false,         // 射撃
    boost: false,         // ブースト
    aimAngle: 0,          // マウス/タッチによるエイム角度（ラジアン）
    useAimAngle: false,   // aimAngle を旋回に使うか（マウス操作時 true）
  };
}
