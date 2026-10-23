import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import './KatanukiGame.css'
import { drawBoard } from './drawBoard.ts'
import {
  BOARD_SIZE,
  MAX_STRESS,
  SHAPE_NAMES,
  TIME_LIMIT_SECONDS,
  applyMove,
  buildOutline,
  carvedRate,
  createRound,
  remainingSeconds,
  timeUp,
} from './rules.ts'
import type { Point, RoundStatus } from './rules.ts'

type FinishedStatus = Exclude<RoundStatus, 'playing'>

export function KatanukiGame() {
  const [level, setLevel] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const isLast = level === SHAPE_NAMES.length - 1

  function handleNext() {
    setLevel(isLast ? 0 : level + 1)
    setAttempt((current) => current + 1)
  }

  // key が変わると Round が作り直され、状態がぜんぶ最初に戻る
  return (
    <KatanukiRound
      key={`${level}-${attempt}`}
      level={level}
      isLast={isLast}
      onNext={handleNext}
      onRetry={() => setAttempt((current) => current + 1)}
    />
  )
}

type RoundProps = {
  level: number
  isLast: boolean
  onNext: () => void
  onRetry: () => void
}

function KatanukiRound({ level, isLast, onNext, onRetry }: RoundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastPoint = useRef<Point | null>(null) // 押している間だけ入る
  const outline = useMemo(() => buildOutline(level), [level])
  const [round, setRound] = useState(() => createRound(outline.length))
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [needle, setNeedle] = useState<Point | null>(null)

  // 最初に押してから遊んでいる間だけ、0.1秒ごとに残り時間を計算し直す
  useEffect(() => {
    if (startedAt === null || round.status !== 'playing') return
    const timer = setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (remainingSeconds(startedAt, time) <= 0) {
        setRound((current) => timeUp(current))
      }
    }, 100)
    return () => clearInterval(timer)
  }, [startedAt, round.status])

  useEffect(() => {
    if (canvasRef.current) drawBoard(canvasRef.current, outline, round, needle)
  }, [outline, round, needle])

  // 画面上の位置を、盤の中の座標に直す。表示サイズが変わっても針の位置がずれない
  function toBoardPoint(e: PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width > 0 ? BOARD_SIZE / rect.width : 1
    return {
      x: (e.clientX - rect.left) * scale,
      y: (e.clientY - rect.top) * scale,
    }
  }

  function handleDown(e: PointerEvent<HTMLCanvasElement>) {
    if (round.status !== 'playing') return
    // 指が盤の外に出ても、なぞり続けられるようにする（テスト環境には無い機能）
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const point = toBoardPoint(e)
    lastPoint.current = point
    setNeedle(point)
    if (startedAt === null) {
      const time = Date.now()
      setStartedAt(time)
      setNow(time)
    }
    setRound((current) => applyMove(current, outline, point, point))
  }

  function handleMove(e: PointerEvent<HTMLCanvasElement>) {
    const from = lastPoint.current
    if (from === null || round.status !== 'playing') return
    const to = toBoardPoint(e)
    lastPoint.current = to
    setNeedle(to)
    setRound((current) => applyMove(current, outline, from, to))
  }

  function handleUp() {
    lastPoint.current = null
    setNeedle(null)
  }

  const timeLeft =
    startedAt === null ? TIME_LIMIT_SECONDS : remainingSeconds(startedAt, now)

  return (
    <div className="katanuki">
      <div className="katanuki-sign" aria-hidden="true">
        型抜き
      </div>

      <div className="katanuki-main">
        <div className="katanuki-hud">
          <span>
            型 {SHAPE_NAMES[level]}（{level + 1}/{SHAPE_NAMES.length}）
          </span>
          <span>のこり {Math.ceil(timeLeft)} 秒</span>
        </div>

        <div className="katanuki-board">
          <canvas
            ref={canvasRef}
            className="katanuki-canvas"
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            role="img"
            aria-label={`${SHAPE_NAMES[level]}の型抜き。ドラッグして溝をなぞります`}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          />
          {round.status !== 'playing' && (
            <Result
              status={round.status}
              isLast={isLast}
              onNext={onNext}
              onRetry={onRetry}
            />
          )}
        </div>

        <Meter label="なぞった量" value={carvedRate(round.carved) * 100} />
        <Meter label="ひび" value={round.stress} danger />

        <p className="katanuki-hint">
          {startedAt === null
            ? '画面を押したまま溝をなぞると、タイマーが始まります。'
            : '押したまま溝に沿って動かします。はなせば休めます。'}
        </p>
      </div>
    </div>
  )
}

type ResultProps = {
  status: FinishedStatus
  isLast: boolean
  onNext: () => void
  onRetry: () => void
}

function Result({ status, isLast, onNext, onRetry }: ResultProps) {
  const messages: Record<FinishedStatus, { title: string; body: string }> = {
    won: {
      title: isLast ? '全部抜けた！' : '抜けた！',
      body: isLast
        ? '名人です。最初からもう一度遊べます。'
        : '次の型に進みましょう。',
    },
    broken: {
      title: '割れた…',
      body: '溝からはみ出すとひびが入ります。もう一度挑戦しよう。',
    },
    timeup: {
      title: '時間切れ',
      body: `${TIME_LIMIT_SECONDS}秒以内になぞり切ろう。`,
    },
  }
  const message = messages[status]

  return (
    <div className="katanuki-overlay" role="status">
      <div className="katanuki-card">
        <p className="katanuki-card-title">{message.title}</p>
        <p className="katanuki-card-body">{message.body}</p>
        <button
          className="katanuki-button"
          onClick={status === 'won' ? onNext : onRetry}
        >
          {status === 'won' ? (isLast ? '最初から' : '次の型へ') : 'もう一度'}
        </button>
      </div>
    </div>
  )
}

type MeterProps = { label: string; value: number; danger?: boolean }

function Meter({ label, value, danger = false }: MeterProps) {
  const percent = Math.max(0, Math.min(MAX_STRESS, value))
  return (
    <div className="katanuki-meter">
      <span className="katanuki-meter-label">{label}</span>
      <div
        className="katanuki-meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div
          className={
            danger
              ? 'katanuki-meter-fill katanuki-meter-fill-danger'
              : 'katanuki-meter-fill'
          }
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="katanuki-meter-value">{Math.round(percent)}%</span>
    </div>
  )
}
