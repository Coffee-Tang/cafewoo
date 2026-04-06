import type { Board, Stats, GuestbookEntry } from '../db'

const BOARD_ICONS: Record<number, string> = {
  1: '☕', 2: '📖', 3: '🎵', 5: '✏️', 6: '💌', 7: '🌏',
  8: '❓', 9: '⚽', 10: '🏫', 11: '🔧', 12: '💧', 13: '☕', 16: '🎮',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDateCN(s: string): string {
  if (!s) return ''
  try {
    const d = new Date(s + 'Z')
    const cn = new Date(d.getTime() + 8 * 3600 * 1000)
    const y = cn.getUTCFullYear()
    const m = String(cn.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cn.getUTCDate()).padStart(2, '0')
    const h = String(cn.getUTCHours()).padStart(2, '0')
    const min = String(cn.getUTCMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  } catch {
    return s.slice(0, 16)
  }
}

export function homeView(boards: Board[], stats: Stats, guestbook: GuestbookEntry[]): string {
  // --- Stats Row ---
  const statsHtml = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-num">${stats.total_posts}</div><div class="stat-label">篇文字</div></div>
      <div class="stat-card"><div class="stat-num">${stats.total_users}</div><div class="stat-label">位朋友</div></div>
      <div class="stat-card"><div class="stat-num">${stats.total_boards}</div><div class="stat-label">个版块</div></div>
      <div class="stat-card"><div class="stat-num">10</div><div class="stat-label">年时光</div></div>
    </div>`

  // --- Search Bar ---
  const searchHtml = `
    <div class="search-section">
      <form action="/search" method="get" class="search-form">
        <input type="text" name="q" placeholder="搜索文章标题或内容..." class="search-input" />
        <button type="submit" class="search-btn">搜索</button>
      </form>
    </div>`

  // --- Board Grid ---
  const boardCards = boards
    .map((b) => {
      const icon = BOARD_ICONS[b.id] || '📋'
      const desc = b.description ? escapeHtml(b.description) : ''
      return `<a href="/board/${b.id}" class="board-card card">
        <div class="board-icon">${icon}</div>
        <div class="board-info">
          <div class="board-name">${escapeHtml(b.name)} <span class="text-muted">(${b.post_count})</span></div>
          ${desc ? `<div class="board-desc text-muted">${desc}</div>` : ''}
        </div>
      </a>`
    })
    .join('\n')

  const boardsHtml = `
    <div class="section mt-1">
      <h2 class="section-title">版块列表</h2>
      <div class="board-grid">${boardCards}</div>
    </div>`

  // --- Timeline Preview ---
  const timelineHtml = `
    <div class="section mt-1">
      <h2 class="section-title">时光走廊</h2>
      <div class="timeline-preview">
        <div class="tl-item">
          <div class="tl-date">1998年9月</div>
          <div class="tl-text">厦门因特咖啡屋诞生，湖滨南路的网吧里，第一批用户相遇...</div>
        </div>
        <div class="tl-item">
          <div class="tl-date">2001年5月</div>
          <div class="tl-text">网友投票选定 cafewoo.net 域名，咖啡从信息港独立...</div>
        </div>
        <div class="tl-item">
          <div class="tl-date">2002年</div>
          <div class="tl-text">社区最活跃的一年，向日葵盛开在首页...</div>
        </div>
        <div class="tl-item">
          <div class="tl-date">2004-2008年</div>
          <div class="tl-text">Five Years。网站改版，老用户偶尔回来留言...</div>
        </div>
      </div>
      <div class="mt-1" style="text-align:right;">
        <a href="/timeline">查看完整时间线 →</a>
      </div>
    </div>`

  // --- Guestbook Preview ---
  let guestbookCards = ''
  if (guestbook.length > 0) {
    guestbookCards = guestbook
      .map(
        (e) => `<div class="gb-entry card mb-1">
          <div class="gb-meta text-muted">${escapeHtml(e.nickname)} · ${formatDateCN(e.created_at)}</div>
          <div class="gb-content">${escapeHtml(e.content)}</div>
        </div>`
      )
      .join('\n')
  } else {
    guestbookCards = '<p class="text-muted">还没有留言，来写第一条吧。</p>'
  }

  const guestbookHtml = `
    <div class="section mt-1">
      <h2 class="section-title">留言板</h2>
      ${guestbookCards}
      <div class="mt-1" style="text-align:right;">
        <a href="/guestbook">写一条留言 →</a>
      </div>
    </div>`

  // --- Page-specific styles ---
  const styles = `<style>
    .stats-row {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      flex: 1;
      background: #fff;
      border: 1px solid #e8dfd0;
      border-radius: 6px;
      padding: 0.75rem 0.5rem;
      text-align: center;
    }
    .stat-num {
      font-size: 1.5rem;
      font-weight: bold;
      color: #6b4226;
    }
    .stat-label {
      font-size: 0.8rem;
      color: #999;
      margin-top: 0.15rem;
    }

    .search-section {
      margin-bottom: 1.5rem;
    }
    .search-form {
      display: flex;
      gap: 0.5rem;
    }
    .search-input {
      flex: 1;
      padding: 0.55rem 1rem;
      border: 1px solid #e8dfd0;
      border-radius: 20px;
      font-size: 0.95rem;
      font-family: inherit;
      background: #fff;
      outline: none;
    }
    .search-input:focus {
      border-color: #d4a574;
    }
    .search-btn {
      padding: 0.55rem 1.25rem;
      background: #6b4226;
      color: #fff;
      border: none;
      border-radius: 20px;
      font-family: inherit;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .search-btn:hover {
      background: #d4a574;
    }

    .board-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .board-card {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .board-card:hover {
      border-color: #d4a574;
      box-shadow: 0 2px 8px rgba(107,66,38,0.08);
    }
    .board-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
      line-height: 1;
      margin-top: 0.1rem;
    }
    .board-name {
      font-weight: bold;
      color: #6b4226;
      font-size: 0.95rem;
    }
    .board-desc {
      font-size: 0.8rem;
      margin-top: 0.15rem;
      line-height: 1.4;
    }

    .timeline-preview {
      border-left: 2px solid #d4a574;
      padding-left: 1.25rem;
      margin-left: 0.5rem;
    }
    .tl-item {
      position: relative;
      margin-bottom: 1rem;
    }
    .tl-item::before {
      content: '';
      position: absolute;
      left: -1.55rem;
      top: 0.45rem;
      width: 10px;
      height: 10px;
      background: #d4a574;
      border-radius: 50%;
      border: 2px solid #faf6ef;
    }
    .tl-date {
      font-weight: bold;
      color: #6b4226;
      font-size: 0.9rem;
    }
    .tl-text {
      color: #666;
      font-size: 0.9rem;
    }

    .gb-entry { padding: 0.75rem 1rem; }
    .gb-meta { margin-bottom: 0.25rem; }
    .gb-content { font-size: 0.9rem; }

    @media (max-width: 600px) {
      .stats-row { flex-wrap: wrap; }
      .stat-card { min-width: calc(50% - 0.5rem); }
      .board-grid { grid-template-columns: 1fr; }
    }
  </style>`

  return styles + statsHtml + searchHtml + boardsHtml + timelineHtml + guestbookHtml
}
