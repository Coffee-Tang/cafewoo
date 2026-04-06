import type { Board, PostSummary } from '../db'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(s: string): string {
  // posted_at is like "2002-03-15 10:30:00"
  if (!s) return ''
  return s.slice(0, 16).replace('T', ' ')
}

export function boardView(board: Board, posts: PostSummary[], page: number, totalPages: number): string {
  const breadcrumb = `<div class="text-muted mb-1">
    <a href="/">首页</a> › ${escapeHtml(board.name)}
  </div>`

  const heading = `
    <h2 class="section-title">${escapeHtml(board.name)}</h2>
    <p class="text-muted" style="margin-top:-0.5rem;margin-bottom:1rem;">共 ${board.post_count} 篇文章</p>`

  let postsHtml: string
  if (posts.length === 0) {
    postsHtml = '<p class="text-muted">暂无文章。</p>'
  } else {
    const rows = posts
      .map(
        (p) => `<tr>
          <td class="post-title"><a href="/post/${p.bbsid}">${escapeHtml(p.title || '(无标题)')}</a></td>
          <td class="post-author"><a href="/user/${encodeURIComponent(p.nickname)}">${escapeHtml(p.nickname)}</a></td>
          <td class="post-date">${formatDate(p.posted_at)}</td>
          <td class="post-replies">${p.reply_count}</td>
        </tr>`
      )
      .join('\n')

    postsHtml = `
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="post-table">
          <thead>
            <tr>
              <th class="post-title">标题</th>
              <th class="post-author">作者</th>
              <th class="post-date">时间</th>
              <th class="post-replies">回复</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }

  // Pagination
  let paginationHtml = ''
  if (totalPages > 1) {
    const prev =
      page > 1
        ? `<a href="/board/${board.id}?page=${page - 1}">&larr; 上一页</a>`
        : `<span style="color:#ccc;">&larr; 上一页</span>`
    const next =
      page < totalPages
        ? `<a href="/board/${board.id}?page=${page + 1}">下一页 &rarr;</a>`
        : `<span style="color:#ccc;">下一页 &rarr;</span>`
    paginationHtml = `
      <div class="pagination">
        ${prev}
        <span class="current">${page} / ${totalPages}</span>
        ${next}
      </div>`
  }

  const styles = `<style>
    .post-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .post-table th, .post-table td {
      padding: 0.6rem 1rem;
      text-align: left;
      border-bottom: 1px solid #e8dfd0;
    }
    .post-table thead th {
      background: #f5efe6;
      color: #6b4226;
      font-weight: bold;
      font-size: 0.85rem;
    }
    .post-table tbody tr:hover {
      background: rgba(212, 165, 116, 0.08);
    }
    .post-table .post-title { width: 50%; }
    .post-table .post-author { width: 18%; }
    .post-table .post-date { width: 22%; color: #999; font-size: 0.82rem; }
    .post-table .post-replies { width: 10%; text-align: center; color: #999; font-size: 0.82rem; }
    .post-table thead .post-replies { text-align: center; }
    .post-table a { color: #6b4226; }
    .post-table a:hover { color: #d4a574; }

    @media (max-width: 600px) {
      .post-table .post-date { display: none; }
      .post-table .post-title { width: auto; }
      .post-table th, .post-table td { padding: 0.5rem 0.6rem; }
    }
  </style>`

  return styles + breadcrumb + heading + postsHtml + paginationHtml
}
