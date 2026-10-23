// 型抜きのルールの計算。画面（React）や canvas には依存しない純粋関数だけを置く。
// 状態は書き換えず、毎回新しいオブジェクトを返す（テストしやすくするため）。

export type Point = { x: number; y: number }
export type Segment = { from: Point; to: Point }
export type RoundStatus = 'playing' | 'won' | 'broken' | 'timeup'

export type RoundState = {
  status: RoundStatus
  carved: readonly boolean[] // 溝の点ごとに「削ったか」
  stress: number // ひび（0〜MAX_STRESS）
  scratches: readonly Segment[] // 溝からはずれて削った跡
  cracks: readonly (readonly Point[])[] // 割れたときのひび割れ線
}

export const BOARD_SIZE = 360
export const CANDY_RADIUS = 165
export const TOLERANCE = 9 // 溝からこの距離までは「溝の上」とみなす
export const TIME_LIMIT_SECONDS = 60
export const CLEAR_RATE = 0.96 // 溝のこの割合を削れたら成功
export const MAX_STRESS = 100

const CENTER = BOARD_SIZE / 2
const SHAPE_SIZE = 250
const MAX_SHAPE_RADIUS = 140 // 真ん中から一番遠い点がこれ以内に収まるようにする
const POINT_SPACING = 3
const MOVE_STEP = 2 // 指を速く動かしても削り残しが出ないよう、この間隔で刻んで調べる
const STRESS_PER_PIXEL = 0.1
const CRACK_LINES = 9
const CRACK_POINTS = 7

export const SHAPE_NAMES = ['丸', '三角', '星', 'ハート'] as const

/* ───────── 形の作り方 ───────── */

function polar(radius: number, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius }
}

// 多角形の外周を、同じ間隔の点に並べ直す
function resample(polygon: Point[], spacing: number): Point[] {
  const count = polygon.length
  const lengths = polygon.map((a, i) => {
    const b = polygon[(i + 1) % count]
    return Math.hypot(b.x - a.x, b.y - a.y)
  })
  const total = lengths.reduce((sum, length) => sum + length, 0)
  const pointCount = Math.max(8, Math.round(total / spacing))

  const result: Point[] = []
  let index = 0
  let passed = 0
  for (let k = 0; k < pointCount; k++) {
    const target = (k * total) / pointCount
    while (index < count - 1 && passed + lengths[index] < target) {
      passed += lengths[index]
      index++
    }
    const t = (target - passed) / (lengths[index] || 1)
    const a = polygon[index]
    const b = polygon[(index + 1) % count]
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return result
}

// どの形も、盤の真ん中に置き、あめ菓子の縁にぶつからない大きさにそろえる。
// 三角のように、箱の中心から頂点までが遠い形は、少し小さくする
function fitToBoard(polygon: Point[]): Point[] {
  const xs = polygon.map((p) => p.x)
  const ys = polygon.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const farthest = Math.max(
    ...polygon.map((p) => Math.hypot(p.x - cx, p.y - cy)),
  )
  const scale = Math.min(
    SHAPE_SIZE / Math.max(maxX - minX, maxY - minY),
    MAX_SHAPE_RADIUS / farthest,
  )
  return polygon.map((p) => ({
    x: CENTER + (p.x - cx) * scale,
    y: CENTER + (p.y - cy) * scale,
  }))
}

function circlePolygon(): Point[] {
  return Array.from({ length: 180 }, (_, i) => polar(100, (i / 180) * 360))
}

function trianglePolygon(): Point[] {
  return [polar(100, -90), polar(100, 30), polar(100, 150)]
}

function starPolygon(): Point[] {
  // 外側の頂点と内側の頂点を、36度ずつずらして交互に並べる
  return Array.from({ length: 10 }, (_, i) =>
    polar(i % 2 === 0 ? 100 : 42, -90 + i * 36),
  )
}

function heartPolygon(): Point[] {
  return Array.from({ length: 400 }, (_, i) => {
    const t = (i / 400) * Math.PI * 2
    return {
      x: 16 * Math.sin(t) ** 3,
      // 画面は下向きが y のプラスなので、符号を反転する
      y: -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      ),
    }
  })
}

const SHAPE_BUILDERS = [
  circlePolygon,
  trianglePolygon,
  starPolygon,
  heartPolygon,
]

// level 番目の形の「溝」を、等間隔の点の並びで返す
export function buildOutline(level: number): Point[] {
  return resample(fitToBoard(SHAPE_BUILDERS[level]()), POINT_SPACING)
}

/* ───────── ラウンドの状態 ───────── */

export function createRound(outlineLength: number): RoundState {
  return {
    status: 'playing',
    carved: new Array<boolean>(outlineLength).fill(false),
    stress: 0,
    scratches: [],
    cracks: [],
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// 針の位置から、いちばん近い溝の点までの距離
export function nearestDistance(outline: readonly Point[], p: Point): number {
  let nearest = Infinity
  for (const q of outline) {
    nearest = Math.min(nearest, distance(p, q))
  }
  return nearest
}

export function carvedRate(carved: readonly boolean[]): number {
  if (carved.length === 0) return 0
  return carved.filter(Boolean).length / carved.length
}

// 割れたとき、針の位置から外へ向かってギザギザのひび割れ線を作る。
// random を外から渡せるようにして、テストで結果を固定できるようにする
export function makeCracks(origin: Point, random: () => number): Point[][] {
  return Array.from({ length: CRACK_LINES }, (_, k) => {
    const baseAngle = (k / CRACK_LINES) * Math.PI * 2 + random() * 0.5
    const line: Point[] = [origin]
    let { x, y } = origin
    for (let j = 0; j < CRACK_POINTS; j++) {
      const angle = baseAngle + (random() - 0.5) * 0.9
      const length = 18 + random() * 22
      x += Math.cos(angle) * length
      y += Math.sin(angle) * length
      line.push({ x, y })
    }
    return line
  })
}

// 針を from から to まで動かしたときの新しい状態を返す。
// 押した瞬間は from と to を同じ点にして呼ぶ
export function applyMove(
  state: RoundState,
  outline: readonly Point[],
  from: Point,
  to: Point,
  random: () => number = Math.random,
): RoundState {
  if (state.status !== 'playing') return state

  const total = distance(from, to)
  const steps = Math.max(1, Math.ceil(total / MOVE_STEP))
  const stepLength = total / steps

  const carved = state.carved.slice()
  const scratches: Segment[] = []
  let stress = state.stress
  let previous = from
  let current = from

  for (let i = 1; i <= steps && stress < MAX_STRESS; i++) {
    current = {
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
    }
    const nearest = nearestDistance(outline, current)

    if (nearest <= TOLERANCE) {
      outline.forEach((q, index) => {
        if (distance(q, current) <= TOLERANCE) carved[index] = true
      })
    } else if (distance(current, { x: CENTER, y: CENTER }) <= CANDY_RADIUS) {
      // 溝から遠いほど、ひびが入りやすい（菓子の外を動かしても増えない）
      const farness = Math.min(nearest - TOLERANCE, 24) / 24
      stress += stepLength * STRESS_PER_PIXEL * (1 + farness)
      if (stepLength > 0) scratches.push({ from: previous, to: current })
    }
    previous = current
  }

  const next: RoundState = {
    ...state,
    carved,
    stress: Math.min(stress, MAX_STRESS),
    scratches: [...state.scratches, ...scratches],
  }

  if (stress >= MAX_STRESS) {
    return { ...next, status: 'broken', cracks: makeCracks(current, random) }
  }
  if (carvedRate(carved) >= CLEAR_RATE) {
    return { ...next, status: 'won', carved: carved.map(() => true) }
  }
  return next
}

export function timeUp(state: RoundState): RoundState {
  return state.status === 'playing' ? { ...state, status: 'timeup' } : state
}

// startedAt（ミリ秒）から now（ミリ秒）までたったとき、残りは何秒か（0 より小さくならない）
export function remainingSeconds(startedAt: number, now: number): number {
  return Math.max(0, TIME_LIMIT_SECONDS - (now - startedAt) / 1000)
}
