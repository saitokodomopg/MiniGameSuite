import { register } from '../../core/registry/registry.ts'
import { JumpRunGame } from './JumpRunGame.tsx'

register({
  id: 'jump-run',
  title: 'ジャンプでよけるラン',
  author: 'ロブロ好きの人', // 本名は書かない
  description: 'ジャンプで障害物をよけて、どこまで走れるかな？',
  Component: JumpRunGame,
})
