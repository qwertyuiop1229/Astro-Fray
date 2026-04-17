/**
 * Astro Fray — ECS ミニマルプロトタイプ (Phase 4 PoC)
 */

import { Registry } from './core/ecs/Registry.js';
import { GameStore } from './core/store/Store.js';

import { createTransform } from './components/Transform.js';
import { createVelocity } from './components/Velocity.js';
import { createRenderable } from './components/Renderable.js';
import { createPlayerInput } from './components/PlayerInput.js';
import { createCollider } from './components/Collider.js';
import { createHealth } from './components/Health.js';

import { createWeapon } from './components/Weapon.js';
import { createProjectile } from './components/Projectile.js';
import { createLifetime } from './components/Lifetime.js';
import { createAIControl } from './components/AIControl.js';
import { createParticle } from './components/Particle.js';

// Phase 4 新規コンポーネント (ビジュアル・所属)
import { createTeam } from './components/Team.js';
import { createShipVisual } from './components/ShipVisual.js';
import { createAsteroidVisual } from './components/AsteroidVisual.js';

import { InputSystem } from './systems/InputSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { LifetimeSystem } from './systems/LifetimeSystem.js';
import { AISystem } from './systems/AISystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';

// ─── 定数 ───
const WORLD_W = 4000;
const WORLD_H = 4000;
const ENEMY_SHIP_COUNT = 15;
const ASTEROID_COUNT = 25;
const SPATIAL_CELL_SIZE = 200;

// ─── Canvas 設定 ───
const canvas = document.getElementById('ecsCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const debugHud = document.getElementById('debugHud');

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ─── ECS & Store 初期化 ───
const registry = new Registry();
const store = new GameStore({
  mode: 'prototype',
  phase: 'running',
  playerEntityId: -1,
  score: 0,
  tick: 0,
});

function createExplosion(x, y, color = '#ff8800', count = 10, speedMult = 1) {
  for (let i = 0; i < count; i++) {
    const pId = registry.createEntity();
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 200 + 50) * speedMult;
    registry.addComponent(pId, 'Transform', createTransform(x, y, angle));
    registry.addComponent(pId, 'Velocity', createVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed, 1000, 0.95));
    registry.addComponent(pId, 'Renderable', createRenderable({ shape: 'circle', size: Math.random() * 4 + 2, color: color, glowColor: color, glowRadius: 4 }));
    registry.addComponent(pId, 'Lifetime', createLifetime(Math.random() * 0.5 + 0.3));
    registry.addComponent(pId, 'Particle', createParticle({ fade: true, shrink: true, initialSize: 6 }));
  }
}

// ─── プレイヤー Entity ───
function spawnPlayer() {
  const playerId = registry.createEntity();
  registry.addComponent(playerId, 'Transform', createTransform(WORLD_W / 2, WORLD_H / 2, 0));
  registry.addComponent(playerId, 'Velocity', createVelocity(0, 0, 350, 0.97));
  
  // Phase 4: 本格的な機体描画用コンポーネント
  registry.addComponent(playerId, 'Renderable', createRenderable({ size: 16, visible: true }));
  registry.addComponent(playerId, 'Team', createTeam({ teamId: 1 })); // 味方
  registry.addComponent(playerId, 'ShipVisual', createShipVisual());  // Ship専用描画ON

  registry.addComponent(playerId, 'PlayerInput', createPlayerInput());
  registry.addComponent(playerId, 'Collider', createCollider({ type: 'circle', radius: 14, layer: 'player' }));
  registry.addComponent(playerId, 'Health', createHealth({ hp: 100, maxHp: 100 }));
  registry.addComponent(playerId, 'Weapon', createWeapon({
    fireRate: 8, projectileSpeed: 900, projectileDamage: 20, projectileColor: '#00f0ff', ownerLayer: 'player'
  }));

  store.setState({ playerEntityId: playerId });
  return playerId;
}
const playerId = spawnPlayer();

// ─── 敵機体 (AI) Entity ───
for (let i = 0; i < ENEMY_SHIP_COUNT; i++) {
  const eid = registry.createEntity();
  registry.addComponent(eid, 'Transform', createTransform(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() * Math.PI * 2));
  registry.addComponent(eid, 'Velocity', createVelocity(0, 0, 150, 0.98));
  
  registry.addComponent(eid, 'Renderable', createRenderable({ size: 14, visible: true }));
  registry.addComponent(eid, 'Team', createTeam({ teamId: 2 })); // 敵
  registry.addComponent(eid, 'ShipVisual', createShipVisual()); // Ship専用描画ON

  registry.addComponent(eid, 'Collider', createCollider({ type: 'circle', radius: 14, layer: 'enemy' }));
  registry.addComponent(eid, 'Health', createHealth({ hp: 40, maxHp: 40 }));
  registry.addComponent(eid, 'PlayerInput', createPlayerInput());
  registry.addComponent(eid, 'AIControl', createAIControl({ state: 'chase', targetId: playerId }));
  registry.addComponent(eid, 'Weapon', createWeapon({
    fireRate: 2, projectileSpeed: 400, projectileDamage: 10, projectileColor: '#ff0055', ownerLayer: 'enemy'
  }));
}

// ─── 小惑星 Entity ───
for (let i = 0; i < ASTEROID_COUNT; i++) {
  const eid = registry.createEntity();
  const size = 15 + Math.random() * 30; // 元のデザインに近い大小ランダム
  registry.addComponent(eid, 'Transform', createTransform(Math.random() * WORLD_W, Math.random() * WORLD_H, Math.random() * Math.PI * 2));
  // 岩なのでゆっくり直進＆回転
  const speed = Math.random() * 40 + 10;
  const angle = Math.random() * Math.PI * 2;
  const vel = createVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed, 100, 1.0);
  registry.addComponent(eid, 'Velocity', vel);
  
  registry.addComponent(eid, 'Renderable', createRenderable({ size: size, visible: true }));
  // Phase 4: ランダムなギザギザ形状を付与
  registry.addComponent(eid, 'AsteroidVisual', createAsteroidVisual({ spikes: Math.floor(Math.random() * 4) + 8 }));

  registry.addComponent(eid, 'Collider', createCollider({ type: 'circle', radius: size, layer: 'enemy' }));
  registry.addComponent(eid, 'Health', createHealth({ hp: size * 3, maxHp: size * 3 }));
  
  // 岩はAIを持たず、ただ漂うだけ
}

// ─── システム初期化 ───
const aiSystem = new AISystem(registry);
const inputSystem = new InputSystem(registry, canvas);
const weaponSystem = new WeaponSystem(registry);
const movementSystem = new MovementSystem(registry, WORLD_W, WORLD_H);
const collisionSystem = new CollisionSystem(registry, SPATIAL_CELL_SIZE, WORLD_W, WORLD_H);
const particleSystem = new ParticleSystem(registry);
const lifetimeSystem = new LifetimeSystem(registry);
const renderSystem = new RenderSystem(registry, ctx, WORLD_W, WORLD_H);

// ─── 衝突ロジック ───
collisionSystem.onCollision((idA, idB) => {
  const cA = registry.getComponent(idA, 'Collider');
  const cB = registry.getComponent(idB, 'Collider');
  if (!cA || !cB) return;

  if (cA.layer === cB.layer) return;

  const handleImpact = (targetId, projectileId) => {
    const health = registry.getComponent(targetId, 'Health');
    const proj = registry.getComponent(projectileId, 'Projectile');
    const tTarget = registry.getComponent(targetId, 'Transform');
    const tProj = registry.getComponent(projectileId, 'Transform');

    if (health && proj) {
      if (health.isDead) return;

      health.hp = Math.max(0, health.hp - proj.damage);
      createExplosion(tProj.x, tProj.y, '#ffffff', 3, 0.5);
      registry.destroyEntity(projectileId);

      if (health.hp <= 0) {
        health.isDead = true;
        const color = registry.hasComponent(targetId, 'AsteroidVisual') ? '#aab' : (cA.layer === 'player' ? '#00f0ff' : '#ff0055');
        createExplosion(tTarget.x, tTarget.y, color, registry.hasComponent(targetId, 'AsteroidVisual') ? 30 : 20, 1.5);
        registry.destroyEntity(targetId);

        if (targetId === store.getState().playerEntityId) {
          store.setState({ phase: 'gameover' });
        } else {
          store.setState(prev => ({ score: prev.score + 100 }));
        }
      }
    }
  };

  const isA_Proj = registry.hasComponent(idA, 'Projectile');
  const isB_Proj = registry.hasComponent(idB, 'Projectile');

  if (isA_Proj && !isB_Proj) handleImpact(idB, idA);
  else if (!isA_Proj && isB_Proj) handleImpact(idA, idB);
  else if (!isA_Proj && !isB_Proj) {
    const tA = registry.getComponent(idA, 'Transform');
    createExplosion(tA.x, tA.y, '#ffff00', 5, 0.5);
  }
});

// ─── ゲームループ ───
let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = 0;
let currentFps = 0;

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1.0) {
    currentFps = frameCount;
    frameCount = 0;
    fpsTimer -= 1.0;
  }

  const state = store.getState();

  if (state.phase === 'running') {
    store.setState((prev) => ({ tick: prev.tick + 1 }));

    aiSystem.update(dt);
    inputSystem.update(dt);
    weaponSystem.update(dt);
    movementSystem.update(dt);
    
    // 自機のロールフェーズ更新(描画用)
    const pId = state.playerEntityId;
    if (registry.isAlive(pId)) {
      const pVis = registry.getComponent(pId, 'ShipVisual');
      const pInput = registry.getComponent(pId, 'PlayerInput');
      if (pVis && pInput) {
        if (pInput.turnLeft) pVis.rollPhase += 5 * dt;
        else if (pInput.turnRight) pVis.rollPhase -= 5 * dt;
        else pVis.rollPhase *= Math.pow(0.9, dt * 60); // 減衰
      }
    }

    collisionSystem.update(dt);
    particleSystem.update(dt);
    lifetimeSystem.update(dt);
  }

  renderSystem.followEntity(state.playerEntityId);
  renderSystem.update(dt);

  if (state.phase === 'gameover') {
    const vw = canvas.width / (window.devicePixelRatio || 1);
    const vh = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = 'rgba(5, 5, 16, 0.4)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#ff0055';
    ctx.font = 'bold 36px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SHIP DESTROYED', vw / 2, vh / 2 - 20);
    ctx.fillStyle = '#888';
    ctx.font = '16px ui-monospace, monospace';
    ctx.fillText(`SCORE: ${state.score}  |  R キーでリスタート`, vw / 2, vh / 2 + 25);
  }

  const pId = state.playerEntityId;
  const health = registry.isAlive(pId) ? registry.getComponent(pId, 'Health') : null;
  const entityCount = registry.getAllEntities().length;
  
  document.getElementById('ecsTitle').textContent = `⬡ ECS PROTOTYPE — Phase 4 (Visual Parity) — SCORE: ${state.score}`;
  debugHud.textContent =
    `FPS: ${currentFps}  |  Entities: ${entityCount}  |  ` +
    `HP: ${health ? Math.floor(health.hp) : 0}  |  ` +
    `Phase: ${state.phase}  |  Tick: ${state.tick}`;
}

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && store.getState().phase === 'gameover') {
    location.reload(); // 手抜きリスタート（リソースクリーンナップ済のため問題なし）
  }
});

requestAnimationFrame(gameLoop);
console.log('%c[Astro Fray ECS] Phase 4 started', 'color: #00ff66; font-weight: bold');
