import type { User, Signature, PostSummary } from '../db'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(s: string): string {
  if (!s) return ''
  return s.slice(0, 16).replace('T', ' ')
}

function getYear(s: string | null): string {
  if (!s) return '?'
  return s.slice(0, 4)
}

export function userView(
  user: User,
  signatures: Signature[],
  posts: PostSummary[],
  page: number,
  totalPages: number
): string {
  const breadcrumb = `<div class="text-muted mb-1">
    <a href="/">首页</a> › ${escapeHtml(user.nickname)}
  </div>`

  const heading = `
    <h2 class="section-title">${escapeHtml(user.nickname)}</h2>
    <p class="text-muted" style="margin-top:-0.5rem;margin-bottom:1rem;">共 ${user.post_count} 篇文章 · 活跃于 ${getYear(user.first_post_at)} - ${getYear(user.last_post_at)}</p>`

  // Signatures section
  let sigHtml = ''
  if (signatures.length > 0) {
    const sigCards = signatures
      .map(
        (sig) => `<div class="card" style="margin-bottom:0.75rem;">
          <div style="white-space:pre-wrap;font-size:0.9rem;">${escapeHtml(sig.content)}</div>
          <div class="text-muted" style="margin-top:0.5rem;">
            首次使用: ${formatDate(sig.first_seen_at || '')} · 最后使用: ${formatDate(sig.last_seen_at || '')}
          </div>
        </div>`
      )
      .join('\n')

    sigHtml = `
      <h3 class="section-title" style="margin-top:1.5rem;">签名档</h3>
      ${sigCards}`
  }

  // Posts section
  let postsHtml: string
  if (posts.length === 0) {
    postsHtml = '<p class="text-muted" style="margin-top:1rem;">暂无文章。</p>'
  } else {
    const rows = posts
      .map(
        (p) => `<tr>
          <td class="post-title"><a href="/post/${p.bbsid}">${escapeHtml(p.title || '(无标题)')}</a></td>
          <td class="post-board"><a href="/board/${p.board_id}">${escapeHtml(p.board_name)}</a></td>
          <td class="post-date">${formatDate(p.posted_at)}</td>
          <td class="post-replies">${p.reply_count}</td>
        </tr>`
      )
      .join('\n')

    postsHtml = `
      <h3 class="section-title" style="margin-top:1.5rem;">发表的文章</h3>
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="post-table">
          <thead>
            <tr>
              <th class="post-title">标题</th>
              <th class="post-board">版面</th>
              <th class="post-date">时间</th>
              <th class="post-replies">回复</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }

  // Pagination
  const encodedNick = encodeURIComponent(user.nickname)
  let paginationHtml = ''
  if (totalPages > 1) {
    const prev =
      page > 1
        ? `<a href="/user/${encodedNick}?page=${page - 1}">&larr; 上一页</a>`
        : `<span style="color:#ccc;">&larr; 上一页</span>`
    const next =
      page < totalPages
        ? `<a href="/user/${encodedNick}?page=${page + 1}">下一页 &rarr;</a>`
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
    .post-table .post-title { width: 45%; }
    .post-table .post-board { width: 15%; }
    .post-table .post-date { width: 25%; color: #999; font-size: 0.82rem; }
    .post-table .post-replies { width: 15%; text-align: center; color: #999; font-size: 0.82rem; }
    .post-table thead .post-replies { text-align: center; }
    .post-table a { color: #6b4226; }
    .post-table a:hover { color: #d4a574; }

    @media (max-width: 600px) {
      .post-table .post-date { display: none; }
      .post-table .post-title { width: auto; }
      .post-table th, .post-table td { padding: 0.5rem 0.6rem; }
    }
  </style>`

  return styles + breadcrumb + heading + sigHtml + postsHtml + paginationHtml
}
