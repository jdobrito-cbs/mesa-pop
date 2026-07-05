/**
 * Esquadrão 42 Co-op — protocolo cliente ⇄ servidor.
 *
 * O SERVIDOR simula o mundo (inimigos, boss, balas, colisões, pontuação).
 * Cada cliente move o próprio avião localmente e reporta a posição —
 * como os dois jogam CONTRA a máquina, a latência é tolerante.
 *
 * Modos:
 * - 'juntos': vida coletiva — um hit derruba o avião; o parceiro voa até
 *   ele e o REANIMA por proximidade. Os dois derrubados = fim. Score do time.
 * - 'lado-a-lado': 3 vidas e placar POR JOGADOR; sem revive. Fim quando os
 *   dois caem; vence o maior placar.
 */

export type CoopMode = 'juntos' | 'lado-a-lado'

export const COOP_W = 480
export const COOP_H = 640

export type CoopWeapon = 'reto' | 'espalhado' | 'laser' | 'missil'

export interface CoopPlane {
  seat: number
  x: number
  y: number
  alive: boolean
  /** derrubado, aguardando reanimação (modo juntos) */
  downed: boolean
  /** progresso 0..1 da reanimação pelo parceiro */
  revive: number
  lives: number
  invincible: boolean
  looping: boolean
  weapon: CoopWeapon
  ammo: number
  bombs: number
  score: number
}

export interface CoopAirEnemy {
  id: number
  kind: 'heli' | 'aviaozinho' | 'aviao-grande'
  x: number
  y: number
  hp: number
  maxHp: number
  t: number
  flash: number
}

export interface CoopGroundEnemy {
  id: number
  kind: 'carro' | 'tanque'
  x: number
  y: number
  lane: number
  hp: number
  maxHp: number
  flash: number
  color: string
}

export interface CoopBoss {
  x: number
  y: number
  hp: number
  maxHp: number
  t: number
  flash: number
  dying: number
}

export interface CoopBullet {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  homing?: boolean
  color: string
}

export interface CoopPowerUp {
  id: number
  kind: CoopWeapon | 'bomba' | 'vida'
  x: number
  y: number
  t: number
}

export interface CoopEvent {
  kind: 'explosion' | 'big-explosion' | 'text' | 'shake'
  x: number
  y: number
  text?: string
  color?: string
}

/** snapshot enviado pelo servidor (~10Hz) */
export interface CoopSnapshot {
  t: number
  mode: CoopMode
  scroll: number
  planes: CoopPlane[]
  air: CoopAirEnemy[]
  ground: CoopGroundEnemy[]
  boss: CoopBoss | null
  bullets: CoopBullet[]
  enemyBullets: CoopBullet[]
  powerups: CoopPowerUp[]
  /** efeitos disparados desde o último snapshot (fogo e fumaça no cliente) */
  events: CoopEvent[]
  finished: boolean
}

/** ações do cliente */
export type CoopAction =
  | { type: 'pos'; x: number; y: number }
  | { type: 'bomb' }
  | { type: 'loop' }
