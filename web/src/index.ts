import { Hono } from 'hono'
import { getStats, getBoards, getRecentGuestbook } from './db'
import { layout } from './views/layout'
import { homeView } from './views/home'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const [stats, boards, guestbook] = await Promise.all([
    getStats(c.env.DB),
    getBoards(c.env.DB),
    getRecentGuestbook(c.env.DB),
  ])
  return c.html(layout('咖啡看板', '首页', homeView(boards, stats, guestbook)))
})

export default app
