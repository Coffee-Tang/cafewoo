// Database query layer for CafeWoo

export const PAGE_SIZE = 20

// --- Types ---

export interface Board {
  id: number
  name: string
  description: string | null
  post_count: number
}

export interface PostSummary {
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

export interface PostDetail extends PostSummary {
  content: string
  content_text: string
  signature: string | null
}

export interface Reply {
  id: number
  post_id: number
  user_id: number
  nickname: string
  content: string
  content_text: string
  signature: string | null
  posted_at: string
  sort_order: number
}

export interface User {
  id: number
  nickname: string
  post_count: number
  first_post_at: string | null
  last_post_at: string | null
}

export interface Signature {
  id: number
  user_id: number
  content: string
  first_seen_at: string | null
  last_seen_at: string | null
}

export interface GuestbookEntry {
  id: number
  nickname: string
  content: string
  ip_hash: string | null
  created_at: string
}

export interface Stats {
  total_posts: number
  total_replies: number
  total_users: number
  total_boards: number
}

// --- Query Functions ---

export async function getStats(db: D1Database): Promise<Stats> {
  const r = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM replies) as total_replies,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM boards WHERE post_count > 0) as total_boards`
    )
    .first<Stats>()
  return r!
}

export async function getBoards(db: D1Database): Promise<Board[]> {
  const { results } = await db
    .prepare('SELECT id, name, description, post_count FROM boards WHERE post_count > 0 ORDER BY id')
    .all<Board>()
  return results
}

export async function getBoard(db: D1Database, id: number): Promise<Board | null> {
  return db.prepare('SELECT id, name, description, post_count FROM boards WHERE id = ?').bind(id).first<Board>()
}

export async function getBoardPosts(
  db: D1Database,
  boardId: number,
  page: number
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const [countRow, { results }] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE board_id = ?').bind(boardId).first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT p.id, p.bbsid, p.board_id, b.name as board_name, p.user_id, u.nickname,
                p.title, p.posted_at, p.reply_count
         FROM posts p
         JOIN boards b ON b.id = p.board_id
         JOIN users u ON u.id = p.user_id
         WHERE p.board_id = ?
         ORDER BY p.posted_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(boardId, PAGE_SIZE, offset)
      .all<PostSummary>(),
  ])
  return { posts: results, total: countRow?.cnt ?? 0 }
}

export async function getPost(db: D1Database, bbsid: number): Promise<PostDetail | null> {
  return db
    .prepare(
      `SELECT p.id, p.bbsid, p.board_id, b.name as board_name, p.user_id, u.nickname,
              p.title, p.posted_at, p.reply_count, p.content, p.content_text, p.signature
       FROM posts p
       JOIN boards b ON b.id = p.board_id
       JOIN users u ON u.id = p.user_id
       WHERE p.bbsid = ?`
    )
    .bind(bbsid)
    .first<PostDetail>()
}

export async function getReplies(db: D1Database, postId: number): Promise<Reply[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.post_id, r.user_id, u.nickname, r.content, r.content_text,
              r.signature, r.posted_at, r.sort_order
       FROM replies r
       JOIN users u ON u.id = r.user_id
       WHERE r.post_id = ?
       ORDER BY r.sort_order`
    )
    .bind(postId)
    .all<Reply>()
  return results
}

export async function getUser(db: D1Database, nickname: string): Promise<User | null> {
  return db.prepare(
    `SELECT u.id, u.nickname, u.first_post_at, u.last_post_at,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
     FROM users u WHERE u.nickname = ?`
  ).bind(nickname).first<User>()
}

export async function getUserPosts(
  db: D1Database,
  userId: number,
  page: number
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const [countRow, { results }] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?').bind(userId).first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT p.id, p.bbsid, p.board_id, b.name as board_name, p.user_id, u.nickname,
                p.title, p.posted_at, p.reply_count
         FROM posts p
         JOIN boards b ON b.id = p.board_id
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?
         ORDER BY p.posted_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(userId, PAGE_SIZE, offset)
      .all<PostSummary>(),
  ])
  return { posts: results, total: countRow?.cnt ?? 0 }
}

export async function getUserSignatures(db: D1Database, userId: number): Promise<Signature[]> {
  const { results } = await db
    .prepare('SELECT id, user_id, content, first_seen_at, last_seen_at FROM user_signatures WHERE user_id = ?')
    .bind(userId)
    .all<Signature>()
  return results
}

export async function searchUsers(
  db: D1Database,
  query: string
): Promise<User[]> {
  const like = `%${query}%`
  const { results } = await db
    .prepare(
      `SELECT u.id, u.nickname, u.first_post_at, u.last_post_at,
              (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
       FROM users u WHERE u.nickname LIKE ?
       ORDER BY post_count DESC LIMIT 10`
    )
    .bind(like)
    .all<User>()
  return results
}

export async function searchPosts(
  db: D1Database,
  query: string,
  page: number
): Promise<{ posts: PostSummary[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const like = `%${query}%`
  const [countRow, { results }] = await Promise.all([
    db
      .prepare('SELECT COUNT(*) as cnt FROM posts WHERE title LIKE ? OR content_text LIKE ?')
      .bind(like, like)
      .first<{ cnt: number }>(),
    db
      .prepare(
        `SELECT p.id, p.bbsid, p.board_id, b.name as board_name, p.user_id, u.nickname,
                p.title, p.posted_at, p.reply_count
         FROM posts p
         JOIN boards b ON b.id = p.board_id
         JOIN users u ON u.id = p.user_id
         WHERE p.title LIKE ? OR p.content_text LIKE ?
         ORDER BY p.posted_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(like, like, PAGE_SIZE, offset)
      .all<PostSummary>(),
  ])
  return { posts: results, total: countRow?.cnt ?? 0 }
}

export async function getTimelinePosts(
  db: D1Database,
  year: number,
  month?: number
): Promise<PostSummary[]> {
  let datePrefix = `${year}`
  if (month !== undefined) {
    datePrefix = `${year}-${String(month).padStart(2, '0')}`
  }
  const like = `${datePrefix}%`
  const { results } = await db
    .prepare(
      `SELECT p.id, p.bbsid, p.board_id, b.name as board_name, p.user_id, u.nickname,
              p.title, p.posted_at, p.reply_count
       FROM posts p
       JOIN boards b ON b.id = p.board_id
       JOIN users u ON u.id = p.user_id
       WHERE p.posted_at LIKE ?
       ORDER BY p.posted_at ASC`
    )
    .bind(like)
    .all<PostSummary>()
  return results
}

export async function getYearMonthCounts(
  db: D1Database
): Promise<{ year: number; month: number; count: number }[]> {
  const { results } = await db
    .prepare(
      `SELECT
         CAST(substr(posted_at, 1, 4) AS INTEGER) as year,
         CAST(substr(posted_at, 6, 2) AS INTEGER) as month,
         COUNT(*) as count
       FROM posts
       WHERE posted_at IS NOT NULL
       GROUP BY year, month
       ORDER BY year, month`
    )
    .all<{ year: number; month: number; count: number }>()
  return results
}

export async function getGuestbookEntries(
  db: D1Database,
  page: number
): Promise<{ entries: GuestbookEntry[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE
  const [countRow, { results }] = await Promise.all([
    db.prepare('SELECT COUNT(*) as cnt FROM guestbook').first<{ cnt: number }>(),
    db
      .prepare('SELECT id, nickname, content, ip_hash, created_at FROM guestbook ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(PAGE_SIZE, offset)
      .all<GuestbookEntry>(),
  ])
  return { entries: results, total: countRow?.cnt ?? 0 }
}

export async function addGuestbookEntry(
  db: D1Database,
  nickname: string,
  content: string,
  ipHash: string
): Promise<void> {
  await db
    .prepare('INSERT INTO guestbook (nickname, content, ip_hash, created_at) VALUES (?, ?, ?, datetime(\'now\'))')
    .bind(nickname, content, ipHash)
    .run()
}

export async function getRecentGuestbook(db: D1Database, limit = 3): Promise<GuestbookEntry[]> {
  const { results } = await db
    .prepare('SELECT id, nickname, content, ip_hash, created_at FROM guestbook ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<GuestbookEntry>()
  return results
}
