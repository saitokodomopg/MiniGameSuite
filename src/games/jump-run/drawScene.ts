// canvas に地面・障害物・キャラを描く。ルールの計算はここでしない
import {
  GROUND_Y,
  OBSTACLE_HEIGHTS,
  OBSTACLE_WIDTH,
  PLAYER_SIZE,
  PLAYER_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './rules.ts'
import type { GameState } from './rules.ts'

const SKY = '#fdf3dc'
const GROUND = '#2d3047'
const PLAYER = '#e4572e'
const PLAYER_OVER = '#8a8a8a'
const OBSTACLE = '#2d3047'

export function drawScene(canvas: HTMLCanvasElement, state: GameState): void {
  const ctx = canvas.getContext('2d')
  // テスト環境（jsdom）では canvas が使えないので、何も描かずに戻る
  if (!ctx) return

  // 高解像度の画面でもぼやけないよう、内部の大きさを画面の密度に合わせる
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== WORLD_WIDTH * dpr) {
    canvas.width = WORLD_WIDTH * dpr
    canvas.height = WORLD_HEIGHT * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  // 地面。しま模様を走った距離ぶんずらして、進んでいるように見せる
  ctx.fillStyle = GROUND
  ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y)
  ctx.fillStyle = SKY
  const offset = state.distance % 48
  for (let x = -offset; x < WORLD_WIDTH; x += 48) {
    ctx.fillRect(x, GROUND_Y + 14, 24, 4)
  }

  ctx.fillStyle = OBSTACLE
  for (const obstacle of state.obstacles) {
    const height = OBSTACLE_HEIGHTS[obstacle.kind]
    ctx.fillRect(obstacle.x, GROUND_Y - height, OBSTACLE_WIDTH, height)
  }

  const top = GROUND_Y - state.height - PLAYER_SIZE
  ctx.fillStyle = state.status === 'over' ? PLAYER_OVER : PLAYER
  ctx.fillRect(PLAYER_X, top, PLAYER_SIZE, PLAYER_SIZE)
  ctx.fillStyle = '#fff'
  ctx.fillRect(PLAYER_X + 19, top + 8, 8, 8)
  ctx.fillStyle = '#222'
  ctx.fillRect(PLAYER_X + 23, top + 10, 4, 4)
}
