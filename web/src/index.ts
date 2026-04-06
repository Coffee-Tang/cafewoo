import { Hono } from 'hono'
import { getStats, getBoards, getRecentGuestbook, getBoard, getBoardPosts, getPost, getReplies, getUser, getUserPosts, getUserSignatures, searchPosts, searchUsers, getYearMonthCounts, getTimelinePosts, getGuestbookEntries, addGuestbookEntry } from './db'
import type { PostSummary } from './db'
import { layout } from './views/layout'
import { homeView } from './views/home'
import { boardView } from './views/board'
import { postView } from './views/post'
import { userView } from './views/user'
import { searchView } from './views/search'
import { timelineView } from './views/timeline'
import { guestbookView } from './views/guestbook'
import { aboutView } from './views/about'
import { peopleView, getPeopleData } from './views/people'

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

app.get('/user/:nickname', async (c) => {
  const nickname = decodeURIComponent(c.req.param('nickname'))
  const page = parseInt(c.req.query('page') || '1')
  const user = await getUser(c.env.DB, nickname)
  if (!user) return c.notFound()
  const [signatures, { posts, total }] = await Promise.all([
    getUserSignatures(c.env.DB, user.id),
    getUserPosts(c.env.DB, user.id, page),
  ])
  const totalPages = Math.ceil(total / 20)
  return c.html(layout(`${user.nickname} - 咖啡看板`, '', userView(user, signatures, posts, page, totalPages)))
})

app.get('/search', async (c) => {
  const q = c.req.query('q') || ''
  const page = parseInt(c.req.query('page') || '1')
  if (!q.trim()) {
    return c.html(layout('搜索 - 咖啡看板', '搜索', searchView('', [], [], 1, 0)))
  }
  const [{ posts, total }, users] = await Promise.all([
    searchPosts(c.env.DB, q, page),
    page === 1 ? searchUsers(c.env.DB, q) : Promise.resolve([]),
  ])
  const totalPages = Math.ceil(total / 20)
  return c.html(layout(`搜索: ${q} - 咖啡看板`, '搜索', searchView(q, posts, users, page, totalPages)))
})

app.get('/timeline', async (c) => {
  const year = c.req.query('year') ? parseInt(c.req.query('year')!) : null
  const month = c.req.query('month') ? parseInt(c.req.query('month')!) : undefined
  const yearMonthCounts = await getYearMonthCounts(c.env.DB)
  let posts: PostSummary[] = []
  if (year) {
    posts = await getTimelinePosts(c.env.DB, year, month)
  }
  return c.html(layout('时间线 - 咖啡看板', '时间线', timelineView(yearMonthCounts, posts, year, month || null)))
})

app.get('/guestbook', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const msg = c.req.query('msg') || undefined
  const { entries, total } = await getGuestbookEntries(c.env.DB, page)
  const totalPages = Math.ceil(total / 20)
  return c.html(layout('留言板 - 咖啡看板', '留言板', guestbookView(entries, page, totalPages, msg)))
})

app.get('/about', (c) => {
  return c.html(layout('关于 - 咖啡看板', '关于', aboutView()))
})

app.get('/people', (c) => {
  const data = getPeopleData()
  return c.html(layout('人物关系 - 咖啡看板', '人物', peopleView(data.circles, data.topPairs, data.keyPeople, data.timeline)))
})

app.post('/guestbook', async (c) => {
  const form = await c.req.formData()
  const nickname = (form.get('nickname') as string || '').trim() || null
  const content = (form.get('content') as string || '').trim()
  if (!content || content.length > 2000) {
    return c.redirect('/guestbook?msg=error')
  }
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const data = new TextEncoder().encode(ip + 'cafewoo-salt')
  const hash = await crypto.subtle.digest('SHA-256', data)
  const ipHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  await addGuestbookEntry(c.env.DB, nickname || '匿名访客', content, ipHash)
  return c.redirect('/guestbook?msg=success')
})

app.notFound((c) => {
  const body = `
    <div style="text-align:center;padding:80px 24px;">
      <div style="font-size:48px;color:#d4a574;">404</div>
      <p style="color:#999;margin-top:12px;">这个页面已经消失在时光里了</p>
      <a href="/" style="color:#d4a574;">返回首页</a>
    </div>
  `
  return c.html(layout('未找到 - 咖啡看板', '', body), 404)
})

export default app
