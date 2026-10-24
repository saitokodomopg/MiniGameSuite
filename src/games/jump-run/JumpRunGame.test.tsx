import { act, fireEvent, render, screen } from '@testing-library/react'
import { JumpRunGame } from './JumpRunGame.tsx'

describe('JumpRunGame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom には canvas の描画機能がないので、使えない状態にそろえる
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('はじめは、きょり 0 m・ベスト 0 m で、操作の説明が出る', () => {
    render(<JumpRunGame />)
    expect(screen.getByText('きょり 0 m')).toBeInTheDocument()
    expect(screen.getByText('ベスト 0 m')).toBeInTheDocument()
    expect(screen.getByText(/スペースキー/)).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('時間がたつと、きょりが増える', () => {
    render(<JumpRunGame />)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('きょり 0 m')).not.toBeInTheDocument()
    expect(screen.getByText(/^きょり [1-9]\d* m$/)).toBeInTheDocument()
  })

  it('何もせず障害物にぶつかるとゲームオーバー。もう一度で0からやり直し、ベストは残る', () => {
    render(<JumpRunGame />)
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(screen.getByText('ゲームオーバー')).toBeInTheDocument()
    expect(screen.queryByText('ベスト 0 m')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もう一度' }))
    expect(screen.getByText('きょり 0 m')).toBeInTheDocument()
    expect(screen.queryByText('ベスト 0 m')).not.toBeInTheDocument()
    expect(screen.queryByText('ゲームオーバー')).not.toBeInTheDocument()
  })

  it('スペースキーのジャンプでは、ページがスクロールしないようにする', () => {
    render(<JumpRunGame />)
    const notCanceled = fireEvent.keyDown(window, { key: ' ' })
    expect(notCanceled).toBe(false)
  })

  it('画面をタップしてもエラーにならない', () => {
    render(<JumpRunGame />)
    fireEvent.pointerDown(screen.getByRole('img'))
    expect(screen.getByText('きょり 0 m')).toBeInTheDocument()
  })
})
