// canvas に盤（あめ菓子・溝・傷・ひび・針）を描く。ルールの計算はここでしない
import { BOARD_SIZE, CANDY_RADIUS } from './rules.ts'
import type { Point, RoundState } from './rules.ts'

const CENTER = BOARD_SIZE / 2
const INK = '#2a1704'

export function drawBoard(
  canvas: HTMLCanvasElement,
  outline: readonly Point[],
  round: RoundState,
  needle: Point | null,
): void {
  const ctx = canvas.getContext('2d')
  // テスト環境（jsdom）では canvas が使えないので、何も描かずに戻る
  if (!ctx) return

  // 高解像度の画面でもぼやけないよう、内部の大きさを画面の密度に合わせる
  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== BOARD_SIZE * dpr) {
    canvas.width = BOARD_SIZE * dpr
    canvas.height = BOARD_SIZE * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE)

  drawCandy(ctx)
  drawOutline(ctx, outline, round)
  drawScratches(ctx, round)
  if (round.status === 'broken') drawCracks(ctx, round)
  if (needle && round.status === 'playing') drawNeedle(ctx, needle)
}

function drawCandy(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createRadialGradient(
    CENTER - 40,
    CENTER - 50,
    20,
    CENTER,
    CENTER,
    CANDY_RADIUS,
  )
  gradient.addColorStop(0, '#efc668')
  gradient.addColorStop(0.7, '#d9a441')
  gradient.addColorStop(1, '#b9801f')
  ctx.beginPath()
  ctx.arc(CENTER, CENTER, CANDY_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = '#8a5a14'
  ctx.stroke()

  // 砂糖の粒。毎回同じ位置になるよう、乱数ではなく黄金角で並べる
  ctx.fillStyle = 'rgba(255, 240, 200, 0.35)'
  for (let i = 0; i < 90; i++) {
    const angle = i * 2.399
    const radius = CANDY_RADIUS * 0.92 * Math.sqrt(i / 90)
    ctx.fillRect(
      CENTER + Math.cos(angle) * radius,
      CENTER + Math.sin(angle) * radius,
      1.5,
      1.5,
    )
  }
}

function drawOutline(
  ctx: CanvasRenderingContext2D,
  outline: readonly Point[],
  round: RoundState,
) {
  if (round.status === 'won') {
    ctx.beginPath()
    outline.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    )
    ctx.closePath()
    ctx.fillStyle = 'rgba(200, 53, 42, 0.35)'
    ctx.fill()
  }

  // 削った部分は太い黒茶、まだの部分は細い茶色で描く
  ctx.lineCap = 'round'
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineWidth = round.carved[i] ? 7 : 2.5
    ctx.strokeStyle = round.carved[i] ? INK : 'rgba(110, 60, 10, 0.6)'
    ctx.stroke()
  })
}

function drawScratches(ctx: CanvasRenderingContext2D, round: RoundState) {
  ctx.lineWidth = 1.6
  for (const { from, to } of round.scratches) {
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.strokeStyle = 'rgba(60, 30, 5, 0.75)'
    ctx.stroke()
    // 少しずらした明るい線を重ねて、削れた段差に見せる
    ctx.beginPath()
    ctx.moveTo(from.x + 1, from.y + 1)
    ctx.lineTo(to.x + 1, to.y + 1)
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.5)'
    ctx.stroke()
  }
}

function drawCracks(ctx: CanvasRenderingContext2D, round: RoundState) {
  ctx.lineWidth = 2.5
  ctx.strokeStyle = INK
  for (const line of round.cracks) {
    ctx.beginPath()
    line.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    )
    ctx.stroke()
  }
}

function drawNeedle(ctx: CanvasRenderingContext2D, needle: Point) {
  ctx.beginPath()
  ctx.arc(needle.x, needle.y, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = '#e8e8e8'
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = '#555'
  ctx.stroke()
}
