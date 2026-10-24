import { register } from '../../core/registry/registry.ts'
import { JumpRunGame } from './JumpRunGame.tsx'

register({
  id: 'jump-run',
  title: 'ジャンプでよけるラン',
  // 仮の名前。作者のニックネームが決まったら書きかえる（本名は書かない）
  author: 'ロブロ好きの人',
  description: 'ジャンプで障害物をよけて、どこまで走れるかな？',
  Component: JumpRunGame,
})
