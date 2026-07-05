/**
 * Esquadrão 42 Co-op — SIMULAÇÃO AUTORITATIVA NO SERVIDOR.
 * Mundo (inimigos, boss, balas, colisões, pontos) roda aqui; os clientes
 * reportam a posição do próprio avião e disparam bomba/loop.
 */
import {
  COOP_H,
  COOP_W,
  type CoopAction,
  type CoopAirEnemy,
  type CoopBoss,
  type CoopBullet,
  type CoopEvent,
  type CoopGroundEnemy,
  type CoopMode,
  type CoopPlane,
  type CoopPowerUp,
  type CoopSnapshot,
  type CoopWeapon,
} from '@mesapop/shared'
import type { GameModule } from './module'

const BOSS_INTERVAL = 300
const LOOP_DURATION = 0.9
const LOOP_COOLDOWN = 6
const REVIVE_DISTANCE = 46
const REVIVE_SECONDS = 2

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2

interface PlaneSim extends CoopPlane {
  fireTimer: number
  invincibleT: number
  loopT: number
  loopCd: number
}

export interface CoopState {
  mode: CoopMode
  time: number
  scroll: number
  planes: PlaneSim[]
  air: (CoopAirEnemy & { vx: number; vy: number; fireTimer: number; points: number })[]
  ground: (CoopGroundEnemy & { fireTimer: number; points: number })[]
  boss: (CoopBoss & { fireA: number; fireB: number }) | null
  bullets: CoopBullet[]
  enemyBullets: CoopBullet[]
  powerups: CoopPowerUp[]
  events: CoopEvent[]
  airTimer: number
  carTimer: number
  tankTimer: number
  powerupTimer: number
  bossTimer: number
  bossCount: number
  nextId: number
  finished: boolean
  winnerSeats: number[]
  draw: boolean
}

function roadX(scroll: number, y: number) {
  return COOP_W * 0.62 + Math.sin((y + scroll) * 0.005) * 26
}

function makePlane(seat: number, mode: CoopMode): PlaneSim {
  return {
    seat,
    x: COOP_W / 2 + (seat === 0 ? -60 : 60),
    y: COOP_H - 90,
    alive: true,
    downed: false,
    revive: 0,
    lives: mode === 'lado-a-lado' ? 3 : 1,
    invincible: false,
    looping: false,
    weapon: 'reto',
    ammo: 0,
    bombs: 0,
    score: 0,
    fireTimer: 0,
    invincibleT: 0,
    loopT: 0,
    loopCd: 0,
  }
}

export function initialCoopState(mode: CoopMode): CoopState {
  return {
    mode,
    time: 0,
    scroll: 0,
    planes: [makePlane(0, mode), makePlane(1, mode)],
    air: [],
    ground: [],
    boss: null,
    bullets: [],
    enemyBullets: [],
    powerups: [],
    events: [],
    airTimer: 1.5,
    carTimer: 1.5,
    tankTimer: 5,
    powerupTimer: 5,
    bossTimer: process.env.COOP_BOSS_EARLY ? 12 : BOSS_INTERVAL,
    bossCount: 0,
    nextId: 1,
    finished: false,
    winnerSeats: [],
    draw: false,
  }
}

function targets(state: CoopState): PlaneSim[] {
  return state.planes.filter((p) => p.alive && !p.downed)
}

function nearestPlane(state: CoopState, x: number, y: number): PlaneSim | null {
  const list = targets(state)
  if (!list.length) return null
  return list.reduce((a, b) => (dist2(a.x, a.y, x, y) < dist2(b.x, b.y, x, y) ? a : b))
}

function explode(state: CoopState, x: number, y: number, big = false) {
  state.events.push({ kind: big ? 'big-explosion' : 'explosion', x, y })
}

function score(state: CoopState, plane: PlaneSim, points: number, x: number, y: number) {
  plane.score += points
  state.events.push({ kind: 'text', x, y, text: `+${points}`, color: '#F4EFFF' })
}

function hitPlane(state: CoopState, plane: PlaneSim) {
  if (!plane.alive || plane.downed || plane.invincibleT > 0 || plane.loopT > 0) return
  explode(state, plane.x, plane.y, false)
  state.events.push({ kind: 'shake', x: plane.x, y: plane.y })
  if (state.mode === 'juntos') {
    plane.downed = true
    plane.revive = 0
    state.events.push({ kind: 'text', x: plane.x, y: plane.y - 20, text: 'DERRUBADO!', color: '#FF8244' })
  } else {
    plane.lives--
    plane.invincibleT = 2
    if (plane.lives <= 0) {
      plane.alive = false
      explode(state, plane.x, plane.y, true)
    }
  }
  // fim?
  const anyone = state.planes.some((p) => p.alive && !p.downed)
  if (!anyone) {
    state.finished = true
    if (state.mode === 'juntos') {
      state.draw = true // cooperativo: sem vencedor individual
    } else {
      const [a, b] = state.planes
      if (a!.score === b!.score) state.draw = true
      else state.winnerSeats = [a!.score > b!.score ? 0 : 1]
    }
  }
}

function spawnAir(state: CoopState) {
  const difficulty = Math.min(state.time / 90, 1)
  const roll = Math.random()
  const x = rand(24, COOP_W - 24)
  const id = state.nextId++
  if (roll < 0.4) {
    state.air.push({ id, kind: 'aviaozinho', x, y: -20, vx: rand(-20, 20), vy: 150 + difficulty * 110, hp: 1, maxHp: 1, points: 100, fireTimer: 99, t: rand(0, 6), flash: 0 })
  } else if (roll < 0.75) {
    state.air.push({ id, kind: 'heli', x, y: -20, vx: 0, vy: 85 + difficulty * 55, hp: 2, maxHp: 2, points: 150, fireTimer: rand(1.2, 2.4), t: rand(0, 6), flash: 0 })
  } else {
    state.air.push({ id, kind: 'aviao-grande', x, y: -30, vx: rand(-14, 14), vy: 55 + difficulty * 30, hp: 4, maxHp: 4, points: 400, fireTimer: rand(0.9, 1.6), t: 0, flash: 0 })
  }
}

function spawnPowerup(state: CoopState, x?: number, y?: number) {
  const kinds: CoopPowerUp['kind'][] = ['espalhado', 'laser', 'missil', 'bomba', 'vida']
  const kind = kinds[Math.floor(rand(0, 5))]!
  state.powerups.push({ id: state.nextId++, kind, x: x ?? rand(30, COOP_W - 30), y: y ?? -18, t: rand(0, 6) })
}

function firePlane(state: CoopState, p: PlaneSim) {
  const useSpecial = p.weapon !== 'reto' && p.ammo > 0
  const w = useSpecial ? p.weapon : 'reto'
  if (w === 'reto') {
    state.bullets.push({ x: p.x, y: p.y - 16, vx: 0, vy: -520, r: 3.5, color: '#F4EFFF' })
    p.fireTimer = 0.17
  } else if (w === 'espalhado') {
    for (const a of [-0.32, -0.12, 0.12, 0.32]) {
      state.bullets.push({ x: p.x, y: p.y - 12, vx: Math.sin(a) * 460, vy: -Math.cos(a) * 460, r: 3, color: '#FFC53D' })
    }
    p.ammo--
    p.fireTimer = 0.2
  } else if (w === 'laser') {
    for (const e of [...state.air]) {
      if (Math.abs(e.x - p.x) < 18 && e.y < p.y) damageAir(state, e, 2, p)
    }
    if (state.boss && state.boss.dying <= 0 && Math.abs(state.boss.x - p.x) < 80 && state.boss.y < p.y) {
      damageBoss(state, 2, p)
    }
    p.ammo--
    p.fireTimer = 0.09
  } else {
    state.bullets.push({ x: p.x - 8, y: p.y - 8, vx: 0, vy: -260, r: 4.5, homing: true, color: '#F252C1' })
    state.bullets.push({ x: p.x + 8, y: p.y - 8, vx: 0, vy: -260, r: 4.5, homing: true, color: '#F252C1' })
    p.ammo -= 1
    p.fireTimer = 0.34
  }
  if (p.weapon !== 'reto' && p.ammo <= 0) p.weapon = 'reto'
}

/** crédito do abate: divide o ponto quando não dá para atribuir (bomba) */
function damageAir(state: CoopState, e: CoopState['air'][0], amount: number, by: PlaneSim | null) {
  e.hp -= amount
  e.flash = 0.09
  if (e.hp <= 0) {
    explode(state, e.x, e.y, e.kind === 'aviao-grande')
    state.air = state.air.filter((x) => x !== e)
    creditPoints(state, by, e.points, e.x, e.y)
    if (e.kind === 'aviao-grande' && Math.random() < 0.45) spawnPowerup(state, e.x, e.y)
  }
}

function damageGround(state: CoopState, g: CoopState['ground'][0], amount: number, by: PlaneSim | null) {
  g.hp -= amount
  g.flash = 0.09
  if (g.hp <= 0) {
    explode(state, g.x, g.y, g.kind === 'tanque')
    state.ground = state.ground.filter((x) => x !== g)
    creditPoints(state, by, g.points, g.x, g.y)
  }
}

function damageBoss(state: CoopState, amount: number, by: PlaneSim | null) {
  const boss = state.boss
  if (!boss || boss.dying > 0) return
  boss.hp -= amount
  boss.flash = 0.08
  if (boss.hp <= 0) {
    boss.dying = 1.1
    state.events.push({ kind: 'shake', x: boss.x, y: boss.y })
    creditPoints(state, by, 5000, boss.x, boss.y)
  }
}

function creditPoints(state: CoopState, by: PlaneSim | null, points: number, x: number, y: number) {
  if (by) {
    score(state, by, points, x, y)
  } else {
    // sem autor claro (bomba/split): divide entre os vivos
    const alive = targets(state)
    const each = Math.ceil(points / Math.max(alive.length, 1))
    for (const p of alive) p.score += each
    state.events.push({ kind: 'text', x, y, text: `+${points}`, color: '#FFC53D' })
  }
}

export function applyCoopAction(
  state: CoopState,
  seat: number,
  action: CoopAction,
): { error: string } | { state: CoopState } {
  const plane = state.planes[seat]
  if (!plane) return { error: 'Avião inválido' }
  if (state.finished) return { error: 'A partida já terminou' }

  if (action.type === 'pos') {
    if (typeof action.x !== 'number' || typeof action.y !== 'number') {
      return { error: 'Posição inválida' }
    }
    if (plane.alive && !plane.downed) {
      plane.x = clamp(action.x, 14, COOP_W - 14)
      plane.y = clamp(action.y, 30, COOP_H - 20)
    }
    return { state }
  }
  if (action.type === 'bomb') {
    if (!plane.alive || plane.downed || plane.bombs <= 0) return { error: 'Sem bomba' }
    plane.bombs--
    state.events.push({ kind: 'big-explosion', x: plane.x, y: plane.y })
    state.events.push({ kind: 'shake', x: plane.x, y: plane.y })
    for (const e of [...state.air]) damageAir(state, e, 99, null)
    for (const g of [...state.ground]) damageGround(state, g, 99, null)
    if (state.boss) damageBoss(state, 20, plane)
    state.enemyBullets = []
    return { state }
  }
  if (action.type === 'loop') {
    if (!plane.alive || plane.downed || plane.loopT > 0 || plane.loopCd > 0) {
      return { error: 'Loop indisponível' }
    }
    plane.loopT = LOOP_DURATION
    plane.loopCd = LOOP_COOLDOWN
    plane.looping = true
    state.events.push({ kind: 'text', x: plane.x, y: plane.y - 24, text: 'LOOP!', color: '#33E0D6' })
    return { state }
  }
  return { error: 'Ação inválida' }
}

/** um passo da simulação (dt em segundos) */
export function tickCoop(state: CoopState, dt: number) {
  if (state.finished) return
  state.time += dt
  state.scroll += 95 * dt

  // aviões: timers, fogo automático, revive por proximidade
  for (const p of state.planes) {
    p.invincibleT = Math.max(0, p.invincibleT - dt)
    p.invincible = p.invincibleT > 0
    p.loopT = Math.max(0, p.loopT - dt)
    p.loopCd = Math.max(0, p.loopCd - dt)
    p.looping = p.loopT > 0

    if (p.alive && !p.downed && p.loopT <= 0) {
      p.fireTimer -= dt
      if (p.fireTimer <= 0) firePlane(state, p)
    }

    if (p.downed) {
      const partner = state.planes[1 - p.seat]!
      if (partner.alive && !partner.downed && dist2(partner.x, partner.y, p.x, p.y) < REVIVE_DISTANCE ** 2) {
        p.revive = Math.min(1, p.revive + dt / REVIVE_SECONDS)
        if (p.revive >= 1) {
          p.downed = false
          p.revive = 0
          p.invincibleT = 2
          state.events.push({ kind: 'text', x: p.x, y: p.y - 20, text: 'DE VOLTA!', color: '#55E07F' })
        }
      } else {
        p.revive = Math.max(0, p.revive - dt / (REVIVE_SECONDS * 2))
      }
    }
  }

  // spawns (mais intensos com 2 jogadores)
  const bossActive = state.boss !== null
  state.airTimer -= dt
  if (state.airTimer <= 0) {
    spawnAir(state)
    const base = Math.max(1.05 - state.time * 0.008, 0.3)
    state.airTimer = bossActive ? base * 2.4 : base
  }
  state.carTimer -= dt
  if (state.carTimer <= 0) {
    const lane = Math.random() < 0.5 ? -13 : 13
    const colors = ['#F252C1', '#FFC53D', '#33E0D6', '#FF8244', '#F4EFFF']
    state.ground.push({
      id: state.nextId++,
      kind: 'carro',
      x: 0,
      y: lane > 0 ? -20 : COOP_H + 20,
      lane,
      hp: 1,
      maxHp: 1,
      points: 50,
      fireTimer: 99,
      flash: 0,
      color: colors[Math.floor(rand(0, colors.length))]!,
    })
    state.carTimer = rand(1.4, 2.8)
  }
  state.tankTimer -= dt
  if (state.tankTimer <= 0) {
    const side = Math.random() < 0.5 ? -1 : 1
    state.ground.push({
      id: state.nextId++,
      kind: 'tanque',
      x: clamp(roadX(state.scroll, -30) + side * rand(80, 160), 30, COOP_W - 30),
      y: -26,
      lane: 0,
      hp: 3,
      maxHp: 3,
      points: 300,
      fireTimer: rand(1.2, 2),
      flash: 0,
      color: '#4A5D3A',
    })
    state.tankTimer = rand(5, 8)
  }
  state.powerupTimer -= dt
  if (state.powerupTimer <= 0) {
    spawnPowerup(state)
    state.powerupTimer = rand(6, 10)
  }
  if (!bossActive) {
    state.bossTimer -= dt
    if (state.bossTimer <= 0) {
      state.bossCount++
      state.boss = {
        x: COOP_W / 2,
        y: -120,
        hp: 160 + state.bossCount * 50,
        maxHp: 160 + state.bossCount * 50,
        t: 0,
        flash: 0,
        dying: 0,
        fireA: 1.5,
        fireB: 3,
      }
      state.events.push({ kind: 'text', x: COOP_W / 2, y: COOP_H * 0.4, text: '⚠ BOSS! ⚠', color: '#FF8244' })
    }
  }

  // balas dos aviões
  for (const b of state.bullets) {
    if (b.homing) {
      const all: Array<{ x: number; y: number }> = [...state.air, ...state.ground]
      if (state.boss && state.boss.dying <= 0) all.push(state.boss)
      if (all.length) {
        const near = all.reduce((m, e) => (dist2(e.x, e.y, b.x, b.y) < dist2(m.x, m.y, b.x, b.y) ? e : m))
        const dx = near.x - b.x
        const dy = near.y - b.y
        const d = Math.hypot(dx, dy) || 1
        b.vx += (dx / d) * 900 * dt
        b.vy += (dy / d) * 900 * dt
        const v = Math.hypot(b.vx, b.vy)
        if (v > 420) {
          b.vx = (b.vx / v) * 420
          b.vy = (b.vy / v) * 420
        }
      }
    }
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  state.bullets = state.bullets.filter((b) => b.y > -20 && b.x > -20 && b.x < COOP_W + 20)

  // inimigos aéreos
  for (const e of state.air) {
    e.t += dt
    e.flash = Math.max(0, e.flash - dt)
    const target = nearestPlane(state, e.x, e.y)
    if (e.kind === 'heli') e.x += Math.sin(e.t * 2.2) * 70 * dt
    if (e.kind === 'aviaozinho' && target && e.y < target.y - 80) {
      e.vx = clamp((target.x - e.x) * 1.2, -150, 150)
    }
    e.x += e.vx * dt
    e.y += e.vy * dt
    e.fireTimer -= dt
    if (e.fireTimer <= 0 && (e.kind === 'heli' || e.kind === 'aviao-grande') && e.y > 0 && target) {
      const dx = target.x - e.x
      const dy = target.y - e.y
      const d = Math.hypot(dx, dy) || 1
      state.enemyBullets.push({ x: e.x, y: e.y + 14, vx: (dx / d) * 200, vy: (dy / d) * 200, r: 4, color: '#FF8244' })
      e.fireTimer = e.kind === 'aviao-grande' ? rand(1, 1.6) : rand(1.8, 3)
    }
  }
  state.air = state.air.filter((e) => e.y < COOP_H + 40 && e.x > -60 && e.x < COOP_W + 60)

  // chão
  for (const g of state.ground) {
    g.flash = Math.max(0, g.flash - dt)
    if (g.kind === 'carro') {
      g.y += (g.lane > 0 ? 95 + 70 : 95 - 55) * dt
      g.x = roadX(state.scroll, g.y) + g.lane
    } else {
      g.y += 95 * dt
      g.fireTimer -= dt
      const target = nearestPlane(state, g.x, g.y)
      if (g.fireTimer <= 0 && g.y > 30 && g.y < COOP_H - 60 && target) {
        const dx = target.x - g.x
        const dy = target.y - g.y
        const d = Math.hypot(dx, dy) || 1
        state.enemyBullets.push({ x: g.x, y: g.y, vx: (dx / d) * 170, vy: (dy / d) * 170, r: 4.5, color: '#FFC53D' })
        g.fireTimer = rand(1.8, 2.6)
      }
    }
  }
  state.ground = state.ground.filter((g) => g.y < COOP_H + 50 && g.y > -60)

  // boss
  if (state.boss) {
    const boss = state.boss
    boss.t += dt
    boss.flash = Math.max(0, boss.flash - dt)
    if (boss.dying > 0) {
      boss.dying -= dt
      if (Math.random() < 0.4) explode(state, boss.x + rand(-80, 80), boss.y + rand(-24, 24), true)
      if (boss.dying <= 0) {
        state.events.push({ kind: 'text', x: COOP_W / 2, y: COOP_H * 0.4, text: 'BOSS DERROTADO!', color: '#55E07F' })
        spawnPowerup(state, boss.x - 40, boss.y)
        spawnPowerup(state, boss.x + 40, boss.y)
        state.boss = null
        state.bossTimer = BOSS_INTERVAL
      }
    } else {
      if (boss.y < 100) boss.y += 50 * dt
      boss.x = COOP_W / 2 + Math.sin(boss.t * 0.5) * (COOP_W / 2 - 110)
      const target = nearestPlane(state, boss.x, boss.y)
      boss.fireA -= dt
      if (boss.fireA <= 0 && target) {
        const base = Math.atan2(target.y - boss.y, target.x - boss.x)
        for (const s of [-0.14, 0, 0.14]) {
          state.enemyBullets.push({ x: boss.x, y: boss.y + 26, vx: Math.cos(base + s) * 230, vy: Math.sin(base + s) * 230, r: 4.5, color: '#FF8244' })
        }
        boss.fireA = rand(1, 1.5)
      }
      boss.fireB -= dt
      if (boss.fireB <= 0) {
        for (let i = -3; i <= 3; i++) {
          const a = Math.PI / 2 + i * 0.22
          state.enemyBullets.push({ x: boss.x, y: boss.y + 26, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, r: 4, color: '#F252C1' })
        }
        boss.fireB = rand(2.6, 3.6)
      }
    }
  }

  for (const b of state.enemyBullets) {
    b.x += b.vx * dt
    b.y += b.vy * dt
  }
  state.enemyBullets = state.enemyBullets.filter(
    (b) => b.y < COOP_H + 20 && b.y > -20 && b.x > -20 && b.x < COOP_W + 20,
  )

  for (const p of state.powerups) {
    p.t += dt
    p.y += 90 * dt
    p.x += Math.sin(p.t * 2.2) * 18 * dt
  }
  state.powerups = state.powerups.filter((p) => p.y < COOP_H + 30)

  // colisões: balas dos aviões × alvos (autor = avião mais próximo do tiro)
  for (const b of [...state.bullets]) {
    let hit = false
    for (const e of state.air) {
      if (dist2(b.x, b.y, e.x, e.y) < (b.r + 13) ** 2) {
        damageAir(state, e, 1, nearestPlane(state, b.x, b.y))
        hit = true
        break
      }
    }
    if (!hit) {
      for (const g of state.ground) {
        if (dist2(b.x, b.y, g.x, g.y) < (b.r + (g.kind === 'tanque' ? 15 : 10)) ** 2) {
          damageGround(state, g, 1, nearestPlane(state, b.x, b.y))
          hit = true
          break
        }
      }
    }
    if (!hit && state.boss && state.boss.dying <= 0) {
      if (Math.abs(b.x - state.boss.x) < 85 && Math.abs(b.y - state.boss.y) < 26) {
        damageBoss(state, 1, nearestPlane(state, b.x, b.y))
        hit = true
      }
    }
    if (hit) state.bullets = state.bullets.filter((x) => x !== b)
  }

  // perigos × aviões
  for (const p of state.planes) {
    if (!p.alive || p.downed) continue
    for (const e of state.air) {
      if (dist2(p.x, p.y, e.x, e.y) < (12 + 13) ** 2) {
        hitPlane(state, p)
        break
      }
    }
    if (state.boss && state.boss.dying <= 0 && Math.abs(p.x - state.boss.x) < 85 && Math.abs(p.y - state.boss.y) < 30) {
      hitPlane(state, p)
    }
    for (const b of [...state.enemyBullets]) {
      if (dist2(p.x, p.y, b.x, b.y) < (12 + b.r) ** 2) {
        state.enemyBullets = state.enemyBullets.filter((x) => x !== b)
        hitPlane(state, p)
      }
    }
    for (const pu of [...state.powerups]) {
      if (dist2(p.x, p.y, pu.x, pu.y) < (12 + 13) ** 2) {
        state.powerups = state.powerups.filter((x) => x !== pu)
        if (pu.kind === 'vida') {
          if (state.mode === 'lado-a-lado') p.lives = Math.min(p.lives + 1, 5)
          else {
            // no modo juntos, vida reanima o parceiro derrubado à distância
            const partner = state.planes[1 - p.seat]!
            if (partner.downed) {
              partner.downed = false
              partner.invincibleT = 2
              state.events.push({ kind: 'text', x: partner.x, y: partner.y - 20, text: 'DE VOLTA!', color: '#55E07F' })
            }
          }
          state.events.push({ kind: 'text', x: pu.x, y: pu.y, text: '+♥', color: '#F252C1' })
        } else if (pu.kind === 'bomba') {
          p.bombs = Math.min(p.bombs + 1, 3)
          state.events.push({ kind: 'text', x: pu.x, y: pu.y, text: '+✹', color: '#FF8244' })
        } else {
          p.weapon = pu.kind as CoopWeapon
          p.ammo = pu.kind === 'laser' ? 90 : pu.kind === 'espalhado' ? 40 : 16
          state.events.push({ kind: 'text', x: pu.x, y: pu.y, text: 'arma nova!', color: '#33E0D6' })
        }
      }
    }
  }
}

export function coopSnapshot(state: CoopState): CoopSnapshot {
  const snap: CoopSnapshot = {
    t: state.time,
    mode: state.mode,
    scroll: state.scroll,
    planes: state.planes.map((p) => ({
      seat: p.seat,
      x: p.x,
      y: p.y,
      alive: p.alive,
      downed: p.downed,
      revive: p.revive,
      lives: p.lives,
      invincible: p.invincible,
      looping: p.looping,
      weapon: p.weapon,
      ammo: p.ammo,
      bombs: p.bombs,
      score: p.score,
    })),
    air: state.air.map(({ id, kind, x, y, hp, maxHp, t, flash }) => ({ id, kind, x, y, hp, maxHp, t, flash })),
    ground: state.ground.map(({ id, kind, x, y, lane, hp, maxHp, flash, color }) => ({ id, kind, x, y, lane, hp, maxHp, flash, color })),
    boss: state.boss
      ? { x: state.boss.x, y: state.boss.y, hp: state.boss.hp, maxHp: state.boss.maxHp, t: state.boss.t, flash: state.boss.flash, dying: state.boss.dying }
      : null,
    bullets: state.bullets,
    enemyBullets: state.enemyBullets,
    powerups: state.powerups,
    events: state.events,
    finished: state.finished,
  }
  state.events = [] // eventos são consumidos por broadcast
  return snap
}

export const esquadraoCoopModule: GameModule<CoopState, CoopAction> = {
  slug: 'esquadrao-coop',
  minPlayers: 2,
  maxPlayers: 2,
  realtime: { tickMs: 50, broadcastEvery: 2 },

  init(_playerCount, options) {
    const mode = options?.mode === 'lado-a-lado' ? 'lado-a-lado' : 'juntos'
    return initialCoopState(mode)
  },

  play(state, seat, action) {
    if (!action || typeof (action as { type?: unknown }).type !== 'string') {
      return { error: 'Ação inválida' }
    }
    return applyCoopAction(state, seat, action)
  },

  tick(state, dt) {
    tickCoop(state, dt)
  },

  getStateFor(state) {
    return coopSnapshot(state)
  },

  scoresFor(state) {
    return state.planes.map((p) => p.score)
  },

  result(state) {
    return {
      finished: state.finished,
      winnerSeats: state.winnerSeats,
      draw: state.draw,
    }
  },
}
