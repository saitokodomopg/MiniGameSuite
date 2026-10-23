import {
  BOARD_SIZE,
  CANDY_RADIUS,
  MAX_STRESS,
  SHAPE_NAMES,
  TIME_LIMIT_SECONDS,
  applyMove,
  buildOutline,
  carvedRate,
  createRound,
  nearestDistance,
  remainingSeconds,
  timeUp,
} from './rules.ts'

const CENTER = { x: BOARD_SIZE / 2, y: BOARD_SIZE / 2 }
const fixedRandom = () => 0.5

describe('buildOutline', () => {
  it.each(SHAPE_NAMES.map((name, level) => [name, level] as const))(
    '%s：溝の点がじゅうぶんあり、すべてあめ菓子の中に収まる',
    (_name, level) => {
      const outline = buildOutline(level)
      expect(outline.length).toBeGreaterThan(50)
      for (const p of outline) {
        const fromCenter = Math.hypot(p.x - CENTER.x, p.y - CENTER.y)
        expect(fromCenter).toBeLessThan(CANDY_RADIUS - 20)
      }
    },
  )
})

describe('nearestDistance', () => {
  it('溝の上の点では 0、丸の真ん中では半径ぶんの距離になる', () => {
    const outline = buildOutline(0)
    expect(nearestDistance(outline, outline[10])).toBe(0)
    expect(nearestDistance(outline, CENTER)).toBeCloseTo(125, 0)
  })
})

describe('applyMove', () => {
  it('溝に沿ってなぞると削れ、最後まで行くと成功になる', () => {
    const outline = buildOutline(0)
    let state = createRound(outline.length)
    expect(carvedRate(state.carved)).toBe(0)

    for (let i = 0; i < outline.length; i++) {
      state = applyMove(
        state,
        outline,
        outline[i],
        outline[(i + 1) % outline.length],
        fixedRandom,
      )
    }
    expect(state.status).toBe('won')
    expect(carvedRate(state.carved)).toBe(1)
    expect(state.stress).toBe(0)
  })

  it('溝からはずれて動かすと、ひびが増えて傷が残る', () => {
    const outline = buildOutline(0)
    const state = applyMove(
      createRound(outline.length),
      outline,
      CENTER,
      { x: CENTER.x, y: CENTER.y - 60 },
      fixedRandom,
    )
    expect(state.stress).toBeGreaterThan(0)
    expect(state.scratches.length).toBeGreaterThan(0)
    expect(state.status).toBe('playing')
  })

  it('押しただけ（動かさない）ではひびが増えない', () => {
    const outline = buildOutline(0)
    const state = applyMove(
      createRound(outline.length),
      outline,
      CENTER,
      CENTER,
      fixedRandom,
    )
    expect(state.stress).toBe(0)
  })

  it('あめ菓子の外を動かしても、ひびは増えない', () => {
    const outline = buildOutline(0)
    const state = applyMove(
      createRound(outline.length),
      outline,
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      fixedRandom,
    )
    expect(state.stress).toBe(0)
  })

  it('ひびが最大になると割れて、そのあとは何をしても変わらない', () => {
    const outline = buildOutline(0)
    let state = createRound(outline.length)
    for (let i = 0; i < 10 && state.status === 'playing'; i++) {
      state = applyMove(
        state,
        outline,
        { x: CENTER.x, y: CENTER.y - 80 },
        { x: CENTER.x, y: CENTER.y + 80 },
        fixedRandom,
      )
    }
    expect(state.status).toBe('broken')
    expect(state.stress).toBe(MAX_STRESS)
    expect(state.cracks.length).toBeGreaterThan(0)

    const after = applyMove(state, outline, outline[0], outline[1], fixedRandom)
    expect(after).toBe(state)
  })
})

describe('timeUp', () => {
  it('遊んでいる最中なら時間切れになり、割れたあとは変わらない', () => {
    const playing = createRound(10)
    expect(timeUp(playing).status).toBe('timeup')

    const broken = { ...playing, status: 'broken' as const }
    expect(timeUp(broken)).toBe(broken)
  })
})

describe('remainingSeconds', () => {
  it('始めた直後は制限時間いっぱいで、時間がたつと減り、0 より小さくならない', () => {
    expect(remainingSeconds(1000, 1000)).toBe(TIME_LIMIT_SECONDS)
    expect(remainingSeconds(0, 15_000)).toBe(TIME_LIMIT_SECONDS - 15)
    expect(remainingSeconds(0, TIME_LIMIT_SECONDS * 1000)).toBe(0)
    expect(remainingSeconds(0, 999_999)).toBe(0)
  })
})
