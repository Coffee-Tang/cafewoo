# Phase 2: Hono Web 应用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare Workers web app using Hono + D1 that dynamically renders the restored CafeWoo BBS as a "时光档案馆" with warm book-style design.

**Architecture:** Hono SSR app using `hono/html` tagged template literals for views. Each page is a route handler that queries D1 and returns rendered HTML. Shared layout wraps all pages with consistent header/footer/CSS. Post detail pages use the original BBS table layout.

**Tech Stack:** Hono 4.x, Cloudflare Workers, D1 (SQLite), Wrangler CLI, TypeScript

---

## File Structure

```
web/
  src/
    index.ts              — Hono app entry, all route registrations
    db.ts                 — D1 query functions (all SQL lives here)
    views/
      layout.ts           — shared HTML shell: <html>, CSS, header, footer
      home.ts             — homepage view
      board.ts            — board listing view
      post.ts             — post detail view (original BBS table layout)
      user.ts             — user profile view
      timeline.ts         — timeline view
      search.ts           — search results view
      guestbook.ts        — guestbook view (list + form)
      about.ts            — about page view
  public/
    screenshots/          — historical screenshots (copied from project root)
  wrangler.toml           — Cloudflare config with D1 binding
  package.json
  tsconfig.json
```

**Key design decisions:**
- All SQL queries centralized in `db.ts` — views never touch the database directly
- Views are pure functions: `(data) => HtmlEscapedString` — no side effects
- `layout.ts` exports a wrapper function used by all views
- Post detail page has its own CSS block for BBS-style table layout
- Pagination helper shared via query params `?page=N`, 20 items per page

---

### Task 1: Project Scaffolding + D1 Setup

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/wrangler.toml`
- Create: `web/src/index.ts` (minimal hello world)

- [ ] **Step 1: Create the Hono project**

```bash
cd /Users/coffee/workspace/cafewoo
mkdir -p web/src web/public
cd web
npm init -y
npm install hono
npm install -D wrangler @cloudflare/workers-types typescript
```

- [ ] **Step 2: Write wrangler.toml**

```toml
# web/wrangler.toml
name = "cafewoo"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "cafewoo"
database_id = "local"
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 4: Write minimal index.ts**

```typescript
// web/src/index.ts
import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.text('CafeWoo - 咖啡看板'))

export default app
```

- [ ] **Step 5: Create local D1 database and import data**

```bash
cd /Users/coffee/workspace/cafewoo/web

# Create local D1 database
npx wrangler d1 create cafewoo --local 2>/dev/null || true

# The D1 export is 31MB — split into smaller chunks for wrangler
# Or import directly via sqlite3 into the local D1 file
npx wrangler dev --local 2>&1 &
sleep 3
kill %1 2>/dev/null

# Find the local D1 sqlite file and import directly
find .wrangler -name "*.sqlite" 2>/dev/null
# Import using sqlite3 directly into the local D1 database
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*/db.sqlite < ../parser/cafewoo_d1.sql
```

Note: If the wrangler approach doesn't create the sqlite file automatically, use `npx wrangler d1 execute cafewoo --local --file=../parser/cafewoo_d1.sql` instead.

- [ ] **Step 6: Verify dev server starts**

```bash
cd /Users/coffee/workspace/cafewoo/web
npx wrangler dev
```
Expected: Server starts on `http://localhost:8787`, shows "CafeWoo - 咖啡看板".

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: scaffold Hono project with D1 binding and local data"
```

---

### Task 2: Database Query Layer

**Files:**
- Create: `web/src/db.ts`

- [ ] **Step 1: Write all database query functions**

```typescript
// web/src/db.ts
// 所有 D1 查询集中在此文件

export type Board = {
  id: number
  name: string
  description: string
  post_count: number
}

export type PostSummary = {
  id: number
  bbsid: number
  board_id: number
  board_name: string
  user_id: number
  nickname: string
  title: string
  posted_at: string
  reply_count: number
}

export type PostDetail = {
  id: number
  bbsid: number
  board_id: number
  board_name: string
  user_id: number
  nickname: string
  title: string
  content: string
  content_text: string
  signature: string | null
  posted_at: string
  reply_count: number
}

export type Reply = {
  id: number
  nickname: string
  user_id: number
  content: string
  content_text: string
  signature: string | null
  posted_at: string
  sort_order: number
}

export type User = {
  id: number
  nickname: string
  post_count: number
  first_post_at: string
  last_post_at: string
}

export type Signature = {
  content: string
  first_seen_at: string
  last_seen_at: string
}

export type GuestbookEntry = {
  id: number
  nickname: string | null
  content: string
  created_at: string
}

export type Stats = {
  total_posts: number
  total_replies: number
  total_users: number
  total_boards: number
}

const PAGE_SIZE = 20

export async function getStats(db: D1Database): Promise<Stats> {
  const r = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM posts) as total_posts,
      (SELECT COUNT(*) FROM replies) as total_replies,
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM boards WHERE post_count > 0) as total_boards
  `).first<Stats>()
  return r!
}

export async function getBoards(db: D1Database): Promise<Board[]> {
  const { results } = await db.prepare(
    'SELECT * FROM boards WHERE post_count > 0 ORDER BY id'
  ).all<Board>()
  return results
}

export async function getBoard(db: D1Database, id: number): Promise<Board | null> {
  return db.prepare('SELECT * FROM boards WHERE id = ?').bind(id).first<Board>()
}

export async function getBoardPosts(
  db: D1Database, boardId: number, page: number
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const { results } = await db.prepare(`
    SELECT p.id, p.bbsid, p.board_id, b.name as board_name,
           p.user_id, u.nickname, p.title, p.posted_at, p.reply_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN boards b ON b.id = p.board_id
    WHERE p.board_id = ?
    ORDER BY p.posted_at DESC
    LIMIT ? OFFSET ?
  `).bind(boardId, PAGE_SIZE, offset).all<PostSummary>()

  const countRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM posts WHERE board_id = ?'
  ).bind(boardId).first<{ cnt: number }>()

  return { posts: results, total: countRow!.cnt }
}

export async function getPost(db: D1Database, bbsid: number): Promise<PostDetail | null> {
  return db.prepare(`
    SELECT p.*, u.nickname, b.name as board_name
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN boards b ON b.id = p.board_id
    WHERE p.bbsid = ?
  `).bind(bbsid).first<PostDetail>()
}

export async function getReplies(db: D1Database, postId: number): Promise<Reply[]> {
  const { results } = await db.prepare(`
    SELECT r.*, u.nickname
    FROM replies r
    JOIN users u ON u.id = r.user_id
    WHERE r.post_id = ?
    ORDER BY r.sort_order
  `).bind(postId).all<Reply>()
  return results
}

export async function getUser(db: D1Database, nickname: string): Promise<User | null> {
  return db.prepare('SELECT * FROM users WHERE nickname = ?').bind(nickname).first<User>()
}

export async function getUserPosts(
  db: D1Database, userId: number, page: number
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const { results } = await db.prepare(`
    SELECT p.id, p.bbsid, p.board_id, b.name as board_name,
           p.user_id, u.nickname, p.title, p.posted_at, p.reply_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN boards b ON b.id = p.board_id
    WHERE p.user_id = ?
    ORDER BY p.posted_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, PAGE_SIZE, offset).all<PostSummary>()

  const countRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?'
  ).bind(userId).first<{ cnt: number }>()

  return { posts: results, total: countRow!.cnt }
}

export async function getUserSignatures(db: D1Database, userId: number): Promise<Signature[]> {
  const { results } = await db.prepare(`
    SELECT content, first_seen_at, last_seen_at
    FROM user_signatures WHERE user_id = ? ORDER BY first_seen_at
  `).bind(userId).all<Signature>()
  return results
}

export async function searchPosts(
  db: D1Database, query: string, page: number
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const like = `%${query}%`
  const { results } = await db.prepare(`
    SELECT p.id, p.bbsid, p.board_id, b.name as board_name,
           p.user_id, u.nickname, p.title, p.posted_at, p.reply_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN boards b ON b.id = p.board_id
    WHERE p.title LIKE ? OR p.content_text LIKE ?
    ORDER BY p.posted_at DESC
    LIMIT ? OFFSET ?
  `).bind(like, like, PAGE_SIZE, offset).all<PostSummary>()

  const countRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM posts WHERE title LIKE ? OR content_text LIKE ?'
  ).bind(like, like).first<{ cnt: number }>()

  return { posts: results, total: countRow!.cnt }
}

export async function getTimelinePosts(
  db: D1Database, year: number, month?: number
): Promise<PostSummary[]> {
  let sql = `
    SELECT p.id, p.bbsid, p.board_id, b.name as board_name,
           p.user_id, u.nickname, p.title, p.posted_at, p.reply_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    JOIN boards b ON b.id = p.board_id
    WHERE strftime('%Y', p.posted_at) = ?
  `
  const params: any[] = [String(year)]

  if (month) {
    sql += ` AND CAST(strftime('%m', p.posted_at) AS INTEGER) = ?`
    params.push(month)
  }

  sql += ' ORDER BY p.posted_at'

  const stmt = db.prepare(sql)
  const { results } = await stmt.bind(...params).all<PostSummary>()
  return results
}

export async function getYearMonthCounts(db: D1Database): Promise<
  { year: string; month: string; count: number }[]
> {
  const { results } = await db.prepare(`
    SELECT strftime('%Y', posted_at) as year,
           strftime('%m', posted_at) as month,
           COUNT(*) as count
    FROM posts
    WHERE posted_at IS NOT NULL
    GROUP BY year, month
    ORDER BY year, month
  `).all<{ year: string; month: string; count: number }>()
  return results
}

export async function getGuestbookEntries(
  db: D1Database, page: number
): Promise<{ entries: GuestbookEntry[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const { results } = await db.prepare(`
    SELECT * FROM guestbook ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).bind(PAGE_SIZE, offset).all<GuestbookEntry>()

  const countRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM guestbook'
  ).first<{ cnt: number }>()

  return { entries: results, total: countRow!.cnt }
}

export async function addGuestbookEntry(
  db: D1Database, nickname: string | null, content: string, ipHash: string
): Promise<void> {
  await db.prepare(
    'INSERT INTO guestbook (nickname, content, created_at, ip_hash) VALUES (?, ?, datetime("now"), ?)'
  ).bind(nickname || '匿名访客', content, ipHash).run()
}

export async function getRecentGuestbook(db: D1Database, limit = 3): Promise<GuestbookEntry[]> {
  const { results } = await db.prepare(
    'SELECT * FROM guestbook ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all<GuestbookEntry>()
  return results
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/coffee/workspace/cafewoo/web
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/src/db.ts
git commit -m "feat: add D1 database query layer with all page queries"
```

---

### Task 3: Layout + CSS + Homepage

**Files:**
- Create: `web/src/views/layout.ts`
- Create: `web/src/views/home.ts`
- Modify: `web/src/index.ts`

- [ ] **Step 1: Create the shared layout**

The layout wraps all pages with: `<html>`, CSS, header with navigation, main content area, footer. Uses the warm book style (米色 `#faf6ef` background, 咖啡棕 `#6b4226` accents, Georgia/serif fonts).

Create `web/src/views/layout.ts` — this is a function `layout(title: string, activePage: string, body: string): string` that returns a complete HTML document. The CSS must include:

- Base: `#faf6ef` background, `#333` text, serif fonts
- Header: centered logo "☕ 咖啡看板", subtitle, navigation links
- Navigation: highlight active page with `#d4a574` color
- Stats bar: flex row of number cards
- Cards: white background, `#e8dfd0` border, rounded corners
- Search bar: rounded input with `#d4a574` border
- Pagination: simple prev/next links
- Footer: centered, light gray text
- Responsive: stack to single column on mobile

- [ ] **Step 2: Create the homepage view**

Create `web/src/views/home.ts` — a function that takes boards, stats, recent guestbook entries, and returns the homepage body HTML. Includes:

1. Stats row (total posts, users, boards, years)
2. Search bar
3. Board grid (2 columns, each board is a card with icon + name + count + description)
4. Timeline preview (3 hardcoded milestone entries)
5. Recent guestbook entries (2-3 items) + link to full guestbook

Board icons mapping:
```
1→☕ 2→📖 3→🎵 5→✏️ 6→💌 7→🌏 8→❓ 9→⚽ 10→🏫 11→🔧 12→💧 13→☕ 16→🎮
```

- [ ] **Step 3: Wire up the homepage route**

Update `web/src/index.ts`:
```typescript
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
  const body = homeView(boards, stats, guestbook)
  return c.html(layout('咖啡看板', '首页', body))
})

export default app
```

- [ ] **Step 4: Test in browser**

```bash
cd /Users/coffee/workspace/cafewoo/web
npx wrangler dev
```
Visit `http://localhost:8787` — should see the complete homepage with stats, search bar, 13 board cards, timeline preview, and guestbook section.

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit -m "feat: add layout, CSS, and homepage with board grid and stats"
```

---

### Task 4: Board Listing Page

**Files:**
- Create: `web/src/views/board.ts`
- Modify: `web/src/index.ts` (add route)

- [ ] **Step 1: Create board view and route**

`web/src/views/board.ts` — function `boardView(board, posts, page, totalPages)` renders:
- Board name + total posts header
- Post list table: title (linked to `/post/:bbsid`), author (linked to `/user/:nickname`), time, reply count
- Pagination (prev/next)

Route in `index.ts`:
```typescript
app.get('/board/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const page = parseInt(c.req.query('page') || '1')
  const board = await getBoard(c.env.DB, id)
  if (!board) return c.notFound()
  const { posts, total } = await getBoardPosts(c.env.DB, id, page)
  const totalPages = Math.ceil(total / 20)
  const body = boardView(board, posts, page, totalPages)
  return c.html(layout(`${board.name} - 咖啡看板`, '版块', body))
})
```

- [ ] **Step 2: Test**

Visit `http://localhost:8787/board/10` — should show 菁菁校园 with 384 posts, paginated.

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add board listing page with pagination"
```

---

### Task 5: Post Detail Page (Original BBS Layout)

**Files:**
- Create: `web/src/views/post.ts`
- Modify: `web/src/index.ts` (add route)

- [ ] **Step 1: Create post detail view and route**

This is the most important page — it must reproduce the original BBS visual style.

`web/src/views/post.ts` — function `postView(post, replies, board)` renders:
- Breadcrumb: `首页 > {版块名} > {标题}`
- Original BBS table layout:
  - `<table>` with `bgcolor="#000000"`, `cellspacing="1"`, `cellpadding="6"`
  - Main post header row: `bgcolor="#C6E2FF"`, two cells: "作者" and "发表主题：{title}"
  - Main post content row: `bgcolor="#E6E6E6"`, author in left `<td>` (18% width), content in right `<td>` (82% width)
  - Content includes the original HTML from the database
  - Signature: `---` separator + small font
  - Timestamp: right-aligned, small font, format "YYYY-M-D H:MM:SS"
  - For each reply: header row "回文作者" + content row with same layout

The page includes a scoped CSS block that sets BBS-era styling:
- Font: 14.8px (matching original)
- Links: `color: #000; text-decoration: none; hover: red underline`
- `.dorp1` class styling

Route:
```typescript
app.get('/post/:bbsid', async (c) => {
  const bbsid = parseInt(c.req.param('bbsid'))
  const post = await getPost(c.env.DB, bbsid)
  if (!post) return c.notFound()
  const replies = await getReplies(c.env.DB, post.id)
  const body = postView(post, replies)
  return c.html(layout(`${post.title} - 咖啡看板`, '帖子', body))
})
```

- [ ] **Step 2: Test**

Visit `http://localhost:8787/post/100238` — should show LuDo's "One more cup of Coffee" post with 5 replies in classic BBS table layout.

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add post detail page with original BBS table layout"
```

---

### Task 6: User Profile Page

**Files:**
- Create: `web/src/views/user.ts`
- Modify: `web/src/index.ts` (add route)

- [ ] **Step 1: Create user view and route**

`web/src/views/user.ts` — function `userView(user, signatures, posts, page, totalPages)` renders:
- User nickname as heading
- Stats: post count, active period (first_post_at to last_post_at)
- Signature history list (each signature in a card with first/last seen dates)
- Post list (same format as board page, with board name column)
- Pagination

Route:
```typescript
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
  const body = userView(user, signatures, posts, page, totalPages)
  return c.html(layout(`${user.nickname} - 咖啡看板`, '用户', body))
})
```

- [ ] **Step 2: Test**

Visit `http://localhost:8787/user/LuDo` — should show LuDo's profile with posts and signatures.

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add user profile page with signature history"
```

---

### Task 7: Search Page

**Files:**
- Create: `web/src/views/search.ts`
- Modify: `web/src/index.ts` (add route)

- [ ] **Step 1: Create search view and route**

`web/src/views/search.ts` — function `searchView(query, posts, page, totalPages)` renders:
- Search form (pre-filled with current query)
- Result count
- Post list (same format as board page, with board name column)
- Content preview: first 150 chars of `content_text`, with query term wrapped in `<mark>` tags
- Pagination (preserving `?q=` param)

Route:
```typescript
app.get('/search', async (c) => {
  const q = c.req.query('q') || ''
  const page = parseInt(c.req.query('page') || '1')
  if (!q) {
    const body = searchView('', [], 1, 0)
    return c.html(layout('搜索 - 咖啡看板', '搜索', body))
  }
  const { posts, total } = await searchPosts(c.env.DB, q, page)
  const totalPages = Math.ceil(total / 20)
  const body = searchView(q, posts, page, totalPages)
  return c.html(layout(`搜索: ${q} - 咖啡看板`, '搜索', body))
})
```

- [ ] **Step 2: Test**

Visit `http://localhost:8787/search?q=咖啡` — should show search results with highlighted excerpts.

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add search page with keyword highlighting"
```

---

### Task 8: Timeline Page

**Files:**
- Create: `web/src/views/timeline.ts`
- Modify: `web/src/index.ts` (add route)

- [ ] **Step 1: Create timeline view and route**

`web/src/views/timeline.ts` — function `timelineView(yearMonthCounts, posts, currentYear, currentMonth)` renders:

- Year tabs at the top (1998-2004), clickable
- Month selector for selected year
- Left-side timeline with dots and dates
- Right-side post cards for each post in the selected month/year
- If no year selected, show overview of all years with monthly post counts

Route:
```typescript
app.get('/timeline', async (c) => {
  const year = c.req.query('year') ? parseInt(c.req.query('year')!) : null
  const month = c.req.query('month') ? parseInt(c.req.query('month')!) : undefined
  const yearMonthCounts = await getYearMonthCounts(c.env.DB)

  let posts: PostSummary[] = []
  if (year) {
    posts = await getTimelinePosts(c.env.DB, year, month)
  }

  const body = timelineView(yearMonthCounts, posts, year, month || null)
  return c.html(layout('时间线 - 咖啡看板', '时间线', body))
})
```

- [ ] **Step 2: Test**

Visit `http://localhost:8787/timeline` — should show year overview.
Visit `http://localhost:8787/timeline?year=2002` — should show 2002 posts.
Visit `http://localhost:8787/timeline?year=2002&month=7` — should show July 2002 posts.

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add timeline page with year/month navigation"
```

---

### Task 9: Guestbook Page

**Files:**
- Create: `web/src/views/guestbook.ts`
- Modify: `web/src/index.ts` (add GET + POST routes)

- [ ] **Step 1: Create guestbook view and routes**

`web/src/views/guestbook.ts` — function `guestbookView(entries, page, totalPages, message?)` renders:
- Post form at top: nickname input (optional, placeholder "匿名访客") + content textarea + submit button
- Success/error message if present
- Entry list: each entry shows nickname, timestamp, content
- Pagination

Routes:
```typescript
// GET — show guestbook
app.get('/guestbook', async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const msg = c.req.query('msg')
  const { entries, total } = await getGuestbookEntries(c.env.DB, page)
  const totalPages = Math.ceil(total / 20)
  const body = guestbookView(entries, page, totalPages, msg)
  return c.html(layout('留言板 - 咖啡看板', '留言板', body))
})

// POST — submit guestbook entry
app.post('/guestbook', async (c) => {
  const formData = await c.req.formData()
  const nickname = formData.get('nickname') as string || null
  const content = (formData.get('content') as string || '').trim()

  if (!content || content.length > 2000) {
    return c.redirect('/guestbook?msg=error')
  }

  // Simple IP hash for rate limiting
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const ipHash = await hashIP(ip)

  await addGuestbookEntry(c.env.DB, nickname, content, ipHash)
  return c.redirect('/guestbook?msg=success')
})
```

Add a simple `hashIP` helper in `index.ts`:
```typescript
async function hashIP(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + 'cafewoo-salt')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}
```

- [ ] **Step 2: Test**

Visit `http://localhost:8787/guestbook` — should show empty list with form.
Submit a test message — should redirect back with success message and show the entry.

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add guestbook page with post form and IP hashing"
```

---

### Task 10: About Page

**Files:**
- Create: `web/src/views/about.ts`
- Modify: `web/src/index.ts` (add route)
- Copy: screenshots to `web/public/screenshots/`

- [ ] **Step 1: Copy screenshots and set up static file serving**

```bash
cp /Users/coffee/workspace/cafewoo/screenshots/*.png /Users/coffee/workspace/cafewoo/web/public/screenshots/
```

Add static file serving to `index.ts` (before routes):
```typescript
import { serveStatic } from 'hono/cloudflare-workers'
app.use('/screenshots/*', serveStatic({ root: './' }))
```

Note: For Cloudflare Workers production, static assets need to be configured via `[site]` in `wrangler.toml`:
```toml
[site]
bucket = "./public"
```

- [ ] **Step 2: Create about page view**

`web/src/views/about.ts` — function `aboutView()` renders the complete about page with:

1. Intro text: "这是一个关于厦门、关于青春、关于一杯咖啡的故事"
2. Visual timeline with screenshot images:
   - 1998: 厦门因特咖啡屋诞生, `/screenshots/1999-intercafe-homepage.png`
   - 2000: 千禧年版, `/screenshots/2000-intercafe-homepage.png`
   - 2001: 域名投票+独立+三周年, `/screenshots/2001-cafewoo-homepage.png`
   - 2002: 向日葵版, `/screenshots/2002-cafewoo-homepage.png`
   - 2003: 企鹅版, `/screenshots/2003-cafewoo-homepage.png`
   - 2004: Tom's Dinner, `/screenshots/2004-cafewoo-homepage.png`
   - 2006-2008: 改版, `/screenshots/2008-cafewoo-last.png`
   - 2026: 重新上线 (no screenshot, just text)
3. Key quotes from posts (hardcoded):
   - 寻常百姓: "咖啡曾经清清静静，后来熙熙攘攘..."
   - LuDo (域名投票): "毕竟这个站点是从咖啡屋脱离出来的..."
   - 陈陈: "咖啡是一出没有终点的电影！！！"
   - 2008年老用户: "年三十...突然很想听起当年的随身听..."
4. "那些人" grid: LuDo (站长), Coffee (管理员), 寻常百姓/grassgirl/回声/夜猫子/水灵光/Kitty (元老), 芋茹/aiyo/Stovic/双子文心 (活跃用户)

Each person card links to `/user/:nickname`.

Timeline CSS: left border with dots, screenshot images in cards with captions.

Route:
```typescript
app.get('/about', (c) => {
  const body = aboutView()
  return c.html(layout('关于 - 咖啡看板', '关于', body))
})
```

- [ ] **Step 3: Test**

Visit `http://localhost:8787/about` — should show complete about page with screenshots and timeline.

- [ ] **Step 4: Commit**

```bash
git add web/
git commit -m "feat: add about page with historical timeline and screenshots"
```

---

### Task 11: Final Polish + 404 Page

**Files:**
- Modify: `web/src/index.ts`

- [ ] **Step 1: Add 404 handler and final touches**

```typescript
// 404 page
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
```

- [ ] **Step 2: Full smoke test — visit every page type**

```
http://localhost:8787/                    — 首页
http://localhost:8787/board/10            — 版块列表
http://localhost:8787/board/10?page=2     — 版块分页
http://localhost:8787/post/100238         — 帖子详情
http://localhost:8787/user/LuDo          — 用户主页
http://localhost:8787/search?q=咖啡       — 搜索
http://localhost:8787/timeline            — 时间线
http://localhost:8787/timeline?year=2002  — 时间线年份
http://localhost:8787/guestbook           — 留言板
http://localhost:8787/about               — 关于
http://localhost:8787/nonexistent         — 404
```

- [ ] **Step 3: Commit**

```bash
git add web/src/
git commit -m "feat: add 404 page and finalize all routes"
```

---

## Summary

After completing all 11 tasks:

1. ✅ Hono + D1 project scaffolded with local data
2. ✅ All database queries centralized in `db.ts`
3. ✅ Warm book-style layout with shared header/footer
4. ✅ Homepage with stats, boards, search, timeline preview, guestbook preview
5. ✅ Board listing with pagination
6. ✅ Post detail with original BBS table layout
7. ✅ User profile with signature history
8. ✅ Full-text search with highlighting
9. ✅ Timeline with year/month navigation
10. ✅ Guestbook with anonymous posting
11. ✅ About page with historical screenshots and timeline
12. ✅ 404 error page

**Next:** Phase 3 plan (data migration to production D1 + deploy to Cloudflare + domain binding).
