import type { PostSummary } from '../db'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(s: string): string {
  if (!s) return ''
  return s.slice(0, 16).replace('T', ' ')
}

export function searchView(
  query: string,
  posts: PostSummary[],
  page: number,
  totalPages: number
): string {
  const searchForm = `
    <h2 class="section-title">搜索</h2>
    <form action="/search" method="get" style="margin-bottom:1.5rem;">
      <div style="display:flex;gap:0.5rem;">
        <input type="text" name="q" value="${escapeHtml(query)}"
          placeholder="搜索那些年的记忆..."
          style="flex:1;padding:0.5rem 0.75rem;border:1px solid #e8dfd0;border-radius:4px;font-size:0.95rem;font-family:inherit;background:#fff;color:#333;">
        <button type="submit"
          style="padding:0.5rem 1.25rem;background:#6b4226;color:#fff;border:none;border-radius:4px;font-size:0.95rem;font-family:inherit;cursor:pointer;">
          搜索
        </button>
      </div>
    </form>`

  if (!query.trim()) {
    return searchForm + `<p class="text-muted">搜索那些年的记忆...</p>`
  }

  // Results
  let postsHtml: string
  if (posts.length === 0) {
    postsHtml = `<p class="text-muted">没有找到相关结果。</p>`
  } else {
    const rows = posts
      .map(
        (p) => `<tr>
          <td class="post-title"><a href="/post/${p.bbsid}">${escapeHtml(p.title || '(无标题)')}</a></td>
          <td class="post-board"><a href="/board/${p.board_id}">${escapeHtml(p.board_name)}</a></td>
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
              <th class="post-board">版面</th>
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
  const encodedQ = encodeURIComponent(query)
  let paginationHtml = ''
  if (totalPages > 1) {
    const prev =
      page > 1
        ? `<a href="/search?q=${encodedQ}&page=${page - 1}">&larr; 上一页</a>`
        : `<span style="color:#ccc;">&larr; 上一页</span>`
    const next =
      page < totalPages
        ? `<a href="/search?q=${encodedQ}&page=${page + 1}">下一页 &rarr;</a>`
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
    .post-table .post-title { width: 35%; }
    .post-table .post-board { width: 12%; }
    .post-table .post-author { width: 15%; }
    .post-table .post-date { width: 23%; color: #999; font-size: 0.82rem; }
    .post-table .post-replies { width: 15%; text-align: center; color: #999; font-size: 0.82rem; }
    .post-table thead .post-replies { text-align: center; }
    .post-table a { color: #6b4226; }
    .post-table a:hover { color: #d4a574; }

    @media (max-width: 600px) {
      .post-table .post-date { display: none; }
      .post-table .post-author { display: none; }
      .post-table .post-title { width: auto; }
      .post-table th, .post-table td { padding: 0.5rem 0.6rem; }
    }
  </style>`

  const resultInfo = `<p class="text-muted mb-1">搜索: "${escapeHtml(query)}"</p>`

  return searchForm + styles + resultInfo + postsHtml + paginationHtml
}
