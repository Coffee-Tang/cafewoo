import { Hono } from 'hono'
import { getStats, getBoards, getRecentGuestbook, getBoard, getBoardPosts, getPost, getReplies } from './db'
import { layout } from './views/layout'
import { homeView } from './views/home'
import { boardView } from './views/board'
import { postView } from './views/post'

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

app.get('/board/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const page = parseInt(c.req.query('page') || '1')
  const board = await getBoard(c.env.DB, id)
  if (!board) return c.notFound()
  const { posts, total } = await getBoardPosts(c.env.DB, id, page)
  const totalPages = Math.ceil(total / 20)
  return c.html(layout(`${board.name} - 咖啡看板`, '', boardView(board, posts, page, totalPages)))
})

app.get('/post/:bbsid', async (c) => {
  const bbsid = parseInt(c.req.param('bbsid'))
  const post = await getPost(c.env.DB, bbsid)
  if (!post) return c.notFound()
  const replies = await getReplies(c.env.DB, post.id)
  return c.html(layout(`${post.title || '帖子'} - 咖啡看板`, '', postView(post, replies)))
})

export default app
