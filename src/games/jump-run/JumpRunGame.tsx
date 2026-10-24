import { useEffect, useRef, useState } from 'react'
import './JumpRunGame.css'
import { drawScene } from './drawScene.ts'
import {
  FIXED_DT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  createGame,
  jump,
  meters,
  step,
} from './rules.ts'

export function JumpRunGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef(createGame())
  const [runId, setRunId] = useState(0) // 増えると、ループが最初から始まり直す
  const [phase, setPhase] = useState<'playing' | 'over'>('playing')
  const [distance, setDistance] = useState(0)
  const [best, setBest] = useState(0)

  // ゲームのループ。画面が描き直されるたびに、時間ぶんだけルールを進める
  useEffect(() => {
    let frameId = 0
    let last = performance.now()
    let rest = 0 // まだ計算していない、のこりの時間（秒）
    let shown = -1

    const frame = (time: number) => {
      // タブを切りかえて戻ったときに、一気に進みすぎないよう上限をつける
      rest += Math.min((time - last) / 1000, 0.1)
      last = time
      while (rest >= FIXED_DT) {
        gameRef.current = step(gameRef.current, FIXED_DT)
        rest -= FIXED_DT
      }

      if (canvasRef.current) drawScene(canvasRef.current, gameRef.current)
      const current = meters(gameRef.current)
      if (current !== shown) {
        shown = current
        setDistance(current)
      }

      if (gameRef.current.status === 'over') {
        setBest((previous) => Math.max(previous, current))
        setPhase('over')
        return // ゲームオーバーになったら、ループを止める
      }
      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [runId])

  // キーボードでのジャンプ（スペースと↑キー）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'ArrowUp') return
      if (gameRef.current.status !== 'playing') return
      e.preventDefault() // ページがスクロールしないようにする
      gameRef.current = jump(gameRef.current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handlePointerDown() {
    gameRef.current = jump(gameRef.current)
  }

  function handleRetry() {
    gameRef.current = createGame()
    setDistance(0)
    setPhase('playing')
    setRunId((current) => current + 1)
  }

  return (
    <div className="jump-run">
      <div className="jump-run-hud">
        <span>きょり {distance} m</span>
        <span>ベスト {best} m</span>
      </div>

      <div className="jump-run-stage">
        <canvas
          ref={canvasRef}
          className="jump-run-canvas"
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
          role="img"
          aria-label="ジャンプでよけるランの画面。タップかスペースキーでジャンプします"
          onPointerDown={handlePointerDown}
        />
        {phase === 'over' && (
          <div className="jump-run-overlay" role="status">
            <div className="jump-run-card">
              <p className="jump-run-card-title">ゲームオーバー</p>
              <p className="jump-run-card-body">{distance} m 走った！</p>
              <button className="jump-run-button" onClick={handleRetry}>
                もう一度
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="jump-run-hint">
        タップ・クリック・スペースキー・↑キーでジャンプ。空中では、もう一度ジャンプできません。
      </p>
    </div>
  )
}
