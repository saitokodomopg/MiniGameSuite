// ジャンプでよけるランのルールの計算。画面（React）や canvas には依存しない純粋関数だけを置く。
// 状態は書き換えず、毎回新しいオブジェクトを返す（テストしやすくするため）。

export type ObstacleKind = 'low' | 'high'
export type Obstacle = { x: number; kind: ObstacleKind }
export type GameStatus = 'playing' | 'over'

export type GameState = {
  status: GameStatus
  height: number // 地面からキャラの足もとまでの高さ（0 なら地面の上）
  velocity: number // 上向きがプラス
  obstacles: readonly Obstacle[]
  distance: number // 走った距離（ピクセル）
  elapsed: number // 遊んでいる時間（秒）
  speed: number // 流れる速さ（ピクセル/秒）
  untilNextSpawn: number // 次の障害物が出るまで、あと何ピクセル走るか
}

export const WORLD_WIDTH = 600
export const WORLD_HEIGHT = 300
export const GROUND_Y = 240 // 画面の上から地面までの位置
export const PLAYER_X = 80
export const PLAYER_SIZE = 32
export const OBSTACLE_WIDTH = 28
export const OBSTACLE_HEIGHTS: Record<ObstacleKind, number> = {
  low: 36,
  high: 64,
}
export const FIXED_DT = 1 / 120 // 1回の計算で進める時間（秒）

const GRAVITY = 2200
const JUMP_VELOCITY = 760
const START_SPEED = 300
const SPEED_UP_PER_SECOND = 8
export const MAX_SPEED = 560 // これ以上は速くしない
const FIRST_SPAWN_SECONDS = 1.5
const MIN_GAP_SECONDS = 1.0 // 障害物どうしの間は、最低でもこの秒数ぶん空ける
const GAP_RANGE_SECONDS = 0.8
const HIT_MARGIN = 4 // 当たり判定をキャラより少し小さくして、きわどい所はセーフにする
const METERS_PER_PIXEL = 0.05

export function createGame(): GameState {
  return {
    status: 'playing',
    height: 0,
    velocity: 0,
    obstacles: [],
    distance: 0,
    elapsed: 0,
    speed: START_SPEED,
    untilNextSpawn: START_SPEED * FIRST_SPAWN_SECONDS,
  }
}

// 地面にいるときだけジャンプできる（空中では何も起きない）
export function jump(state: GameState): GameState {
  if (state.status !== 'playing' || state.height > 0) return state
  return { ...state, velocity: JUMP_VELOCITY }
}

// キャラと障害物がぶつかっているか
export function isHit(state: GameState): boolean {
  const left = PLAYER_X + HIT_MARGIN
  const right = PLAYER_X + PLAYER_SIZE - HIT_MARGIN
  return state.obstacles.some((obstacle) => {
    const overlapsX = obstacle.x < right && obstacle.x + OBSTACLE_WIDTH > left
    const feetBelowTop =
      state.height + HIT_MARGIN < OBSTACLE_HEIGHTS[obstacle.kind]
    return overlapsX && feetBelowTop
  })
}

// 時間を dt 秒だけ進める。random は 0 以上 1 未満の数を返す関数
// （外から渡せるようにして、テストで結果を固定できるようにする）
export function step(
  state: GameState,
  dt: number,
  random: () => number = Math.random,
): GameState {
  if (state.status !== 'playing') return state

  const elapsed = state.elapsed + dt
  const speed = Math.min(MAX_SPEED, START_SPEED + SPEED_UP_PER_SECOND * elapsed)
  const moved = speed * dt

  // ジャンプの動き（重力で下向きに引っぱられ、地面で止まる）
  let velocity = state.velocity - GRAVITY * dt
  let height = state.height + velocity * dt
  if (height <= 0) {
    height = 0
    velocity = 0
  }

  // 障害物は左へ流れ、画面の外に出たら消す
  const obstacles: Obstacle[] = state.obstacles
    .map((o) => ({ ...o, x: o.x - moved }))
    .filter((o) => o.x + OBSTACLE_WIDTH > 0)

  // 次の障害物を出す
  let untilNextSpawn = state.untilNextSpawn - moved
  if (untilNextSpawn <= 0) {
    obstacles.push({
      x: WORLD_WIDTH,
      kind: random() < 0.5 ? 'low' : 'high',
    })
    untilNextSpawn = speed * (MIN_GAP_SECONDS + random() * GAP_RANGE_SECONDS)
  }

  const next: GameState = {
    ...state,
    height,
    velocity,
    obstacles,
    distance: state.distance + moved,
    elapsed,
    speed,
    untilNextSpawn,
  }
  return isHit(next) ? { ...next, status: 'over' } : next
}

// 画面に出す距離（メートル）
export function meters(state: GameState): number {
  return Math.floor(state.distance * METERS_PER_PIXEL)
}
