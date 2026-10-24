import {
  FIXED_DT,
  MAX_SPEED,
  OBSTACLE_WIDTH,
  PLAYER_SIZE,
  PLAYER_X,
  WORLD_WIDTH,
  createGame,
  isHit,
  jump,
  meters,
  step,
} from './rules.ts'
import type { GameState } from './rules.ts'

const fixed = (value: number) => () => value

// テスト用の、毎回同じ順番で同じ数を返す乱数（Math.random の代わり）
function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function run(state: GameState, seconds: number, random = fixed(0.5)) {
  let current = state
  for (let i = 0; i < Math.round(seconds / FIXED_DT); i++) {
    current = step(current, FIXED_DT, random)
  }
  return current
}

describe('createGame', () => {
  it('地面の上で、障害物なし・距離 0 から始まる', () => {
    const game = createGame()
    expect(game.status).toBe('playing')
    expect(game.height).toBe(0)
    expect(game.obstacles).toHaveLength(0)
    expect(meters(game)).toBe(0)
  })
})

describe('jump', () => {
  it('ジャンプすると上がって、やがて地面にもどる', () => {
    let state = jump(createGame())
    let highest = 0
    for (let i = 0; i < 120; i++) {
      state = step(state, FIXED_DT, fixed(0.5))
      highest = Math.max(highest, state.height)
    }
    // 計算上の最高点は約131。多少の誤差は許す
    expect(highest).toBeGreaterThan(125)
    expect(highest).toBeLessThan(135)
    expect(state.height).toBe(0)
  })

  it('空中では、もう一度ジャンプできない', () => {
    let state = jump(createGame())
    state = run(state, 0.2)
    expect(state.height).toBeGreaterThan(0)
    expect(jump(state)).toBe(state)
  })

  it('ゲームオーバーのあとは、ジャンプできない', () => {
    const over: GameState = { ...createGame(), status: 'over' }
    expect(jump(over)).toBe(over)
  })
})

describe('step', () => {
  it('時間がたつと速くなり、上限をこえない', () => {
    const early = run(createGame(), 1)
    const later = run({ ...createGame(), elapsed: 10 }, 0.1)
    expect(later.speed).toBeGreaterThan(early.speed)

    const capped = step(
      { ...createGame(), elapsed: 1000 },
      FIXED_DT,
      fixed(0.5),
    )
    expect(capped.speed).toBe(MAX_SPEED)
  })

  it('障害物は右のはしから出て、乱数で低い・高いが決まる', () => {
    const low = run(createGame(), 1.6, fixed(0.1))
    expect(low.obstacles).toHaveLength(1)
    expect(low.obstacles[0].kind).toBe('low')
    expect(low.obstacles[0].x).toBeLessThan(WORLD_WIDTH)

    const high = run(createGame(), 1.6, fixed(0.9))
    expect(high.obstacles[0].kind).toBe('high')
  })

  it('画面の左に出た障害物は消える', () => {
    const state: GameState = {
      ...createGame(),
      obstacles: [{ x: -OBSTACLE_WIDTH + 1, kind: 'low' }],
      untilNextSpawn: 99999,
    }
    expect(step(state, 0.1, fixed(0.5)).obstacles).toHaveLength(0)
  })

  it('ゲームオーバーのあとは、時間が進んでも何も変わらない', () => {
    const over: GameState = { ...createGame(), status: 'over' }
    expect(step(over, FIXED_DT, fixed(0.5))).toBe(over)
  })
})

describe('isHit', () => {
  const obstacleAtPlayer: GameState = {
    ...createGame(),
    obstacles: [{ x: PLAYER_X, kind: 'low' }],
  }

  it('地面にいて障害物に重なるとぶつかる', () => {
    expect(isHit(obstacleAtPlayer)).toBe(true)
    expect(step(obstacleAtPlayer, FIXED_DT, fixed(0.5)).status).toBe('over')
  })

  it('低い障害物は、ジャンプの高さがあればよけられる', () => {
    expect(isHit({ ...obstacleAtPlayer, height: 60 })).toBe(false)
  })

  it('高い障害物は、低いジャンプではぶつかる', () => {
    const high: GameState = {
      ...obstacleAtPlayer,
      obstacles: [{ x: PLAYER_X, kind: 'high' }],
    }
    expect(isHit({ ...high, height: 40 })).toBe(true)
    expect(isHit({ ...high, height: 100 })).toBe(false)
  })

  it('キャラとまだ重なっていなければ、ぶつからない', () => {
    const far: GameState = {
      ...createGame(),
      obstacles: [{ x: PLAYER_X + PLAYER_SIZE + 50, kind: 'high' }],
    }
    expect(isHit(far)).toBe(false)
  })
})

describe('meters', () => {
  it('走ったピクセルを、メートルに直す', () => {
    expect(meters({ ...createGame(), distance: 2000 })).toBe(100)
    expect(meters({ ...createGame(), distance: 19 })).toBe(0)
  })
})

describe('クリアできるか', () => {
  it('ちょうどよいタイミングでジャンプすれば、最高速度でも走り続けられる', () => {
    const random = seededRandom(12345)
    let state = createGame()
    // 90秒（最高速度になってからも長く）走らせる。障害物が近づいたらジャンプする
    for (let i = 0; i < Math.round(90 / FIXED_DT); i++) {
      const edge = PLAYER_X + PLAYER_SIZE
      const coming = state.obstacles.some(
        (o) => o.x > PLAYER_X && o.x - edge <= 0.2 * state.speed,
      )
      if (coming) state = jump(state)
      state = step(state, FIXED_DT, random)
      if (state.status === 'over') break
    }
    expect(state.status).toBe('playing')
    expect(state.speed).toBe(MAX_SPEED)
  })
})
