import { act, fireEvent, render, screen } from '@testing-library/react'
import { KatanukiGame } from './KatanukiGame.tsx'
import { buildOutline } from './rules.ts'

describe('KatanukiGame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom には canvas の描画機能がないので、使えない状態にそろえる
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function press(point: { x: number; y: number }) {
    fireEvent.pointerDown(screen.getByRole('img'), {
      pointerId: 1,
      clientX: point.x,
      clientY: point.y,
    })
  }

  function drag(point: { x: number; y: number }) {
    fireEvent.pointerMove(screen.getByRole('img'), {
      pointerId: 1,
      clientX: point.x,
      clientY: point.y,
    })
  }

  it('はじめは「丸」の型と、60秒の残り時間が出る', () => {
    render(<KatanukiGame />)
    expect(screen.getByText('型 丸（1/4）')).toBeInTheDocument()
    expect(screen.getByText('のこり 60 秒')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('なぞり始めてから60秒たつと時間切れになり、もう一度で最初に戻る', () => {
    render(<KatanukiGame />)
    press(buildOutline(0)[0])

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByText('のこり 30 秒')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30_200)
    })
    expect(screen.getByText('時間切れ')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もう一度' }))
    expect(screen.getByText('のこり 60 秒')).toBeInTheDocument()
    expect(screen.queryByText('時間切れ')).not.toBeInTheDocument()
  })

  it('溝からはずれて削り続けると割れて、もう一度でひびが 0 に戻る', () => {
    render(<KatanukiGame />)
    press({ x: 180, y: 100 })
    for (let i = 0; i < 4; i++) {
      drag({ x: 180, y: 260 })
      drag({ x: 180, y: 100 })
    }
    expect(screen.getByText('割れた…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'ひび' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    )

    fireEvent.click(screen.getByRole('button', { name: 'もう一度' }))
    expect(screen.getByRole('progressbar', { name: 'ひび' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
  })

  it('溝を最後までなぞると成功になり、次の型へ進める', () => {
    render(<KatanukiGame />)
    const outline = buildOutline(0)
    press(outline[0])
    for (const point of outline) drag(point)
    drag(outline[0])

    expect(screen.getByText('抜けた！')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '次の型へ' }))
    expect(screen.getByText('型 三角（2/4）')).toBeInTheDocument()
  })
})
