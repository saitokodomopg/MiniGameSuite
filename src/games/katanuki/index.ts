import { register } from '../../core/registry/registry.ts'
import { KatanukiGame } from './KatanukiGame.tsx'

register({
  id: 'katanuki',
  title: '型抜き',
  // 仮の名前。作者のニックネームが決まったら書きかえる（本名は書かない）
  author: 'ニックネーム未定',
  description: '針で溝をなぞって、割らずに形を抜こう！',
  Component: KatanukiGame,
})
