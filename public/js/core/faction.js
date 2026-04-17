/* ===== Extracted from game.js ===== */

/* ========== チーム・ファクション判定 ========== */
const TEAM_COLORS = {
    1: "#00f0ff",
    2: "#ff0055",
    3: "#00ff66",
    4: "#ffb300",
};
function getMyTeam() {
    return window.isMultiplayer &&
        photonClient &&
        photonClient.isJoinedToRoom()
        ? photonClient.myActor().getCustomProperty("team") || 1
        : 1;
}

function areEnemies(shipA, shipB) {
    if (!shipA || !shipB) return false;
    if (shipA.id === shipB.id) return false;
    // マルチプレイ or テストプレイはチーム番号で判定
    if (window.isMultiplayer || window._testPlayMode)
        return shipA.team !== shipB.team;

    // シングルプレイの場合：プレイヤーと味方AIは同一陣営とする
    const teamA =
        shipA.faction === "player" || shipA.faction === "ally"
            ? "friend"
            : "enemy";
    const teamB =
        shipB.faction === "player" || shipB.faction === "ally"
            ? "friend"
            : "enemy";
    return teamA !== teamB;
}
