/**
 * ECSエンジンのパブリックエクスポート
 * ViteによるIIFEビルド後、 `window.AstroECS` として `game.js` 等から利用可能になります。
 */

import { Registry } from './core/ecs/Registry.js';
import { GameStore } from './core/store/Store.js';
import { SpatialHash } from './core/physics/SpatialHash.js';

// コンポーネント群
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
import { createTeam } from './components/Team.js';
import { createShipVisual } from './components/ShipVisual.js';
import { createAsteroidVisual } from './components/AsteroidVisual.js';

// システム群
import { InputSystem } from './systems/InputSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { RenderSystem } from './systems/RenderSystem.js';
import { WeaponSystem } from './systems/WeaponSystem.js';
import { LifetimeSystem } from './systems/LifetimeSystem.js';
import { AISystem } from './systems/AISystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';

export const Core = {
  Registry,
  GameStore,
  SpatialHash
};

export const Components = {
  createTransform,
  createVelocity,
  createRenderable,
  createPlayerInput,
  createCollider,
  createHealth,
  createWeapon,
  createProjectile,
  createLifetime,
  createAIControl,
  createParticle,
  createTeam,
  createShipVisual,
  createAsteroidVisual
};

export const Systems = {
  InputSystem,
  MovementSystem,
  CollisionSystem,
  RenderSystem,
  WeaponSystem,
  LifetimeSystem,
  AISystem,
  ParticleSystem
};
