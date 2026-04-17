/**
 * ShipVisual コンポーネント — 宇宙船描画に必要な視覚情報を持つ
 *
 * @returns {object}
 */
export function createShipVisual() {
  return {
    rollPhase: 0.0,       // 機体が旋回時の傾き・ロール表現用
    invulnerable: false,  // 無敵状態 (半透明化する)
    isGhost: false,       // ゴースト状態 (描画の影をオフにする等)
    showGlow: true,       // グローエフェクトを有効にするか
  };
}
