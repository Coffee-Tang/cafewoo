import type { GuestbookEntry } from '../db'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(s: string): string {
  if (!s) return ''
  try {
    const d = new Date(s + 'Z')  // 解析为 UTC
    const cn = new Date(d.getTime() + 8 * 3600 * 1000)  // 转东八区
    const y = cn.getUTCFullYear()
    const m = String(cn.getUTCMonth() + 1).padStart(2, '0')
    const day = String(cn.getUTCDate()).padStart(2, '0')
    const h = String(cn.getUTCHours()).padStart(2, '0')
    const min = String(cn.getUTCMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  } catch {
    return s.slice(0, 16).replace('T', ' ')
  }
}

export function guestbookView(
  entries: GuestbookEntry[],
  page: number,
  totalPages: number,
  message?: string
): string {
  // Message banner
  let bannerHtml = ''
  if (message === 'success') {
    bannerHtml = `<div class="gb-banner gb-success">留言成功！</div>`
  } else if (message === 'error') {
    bannerHtml = `<div class="gb-banner gb-error">留言内容不能为空</div>`
  }

  // Post form
  const formHtml = `
    <div class="card mb-1">
      <h3 class="section-title">写留言</h3>
      <form method="POST" action="/guestbook" class="gb-form">
        <div class="gb-field">
          <label for="nickname">昵称</label>
          <input type="text" id="nickname" name="nickname" placeholder="匿名访客" maxlength="50" class="gb-input">
        </div>
        <div class="gb-field">
          <label for="content">留言内容 <span class="text-muted">*</span></label>
          <textarea id="content" name="content" required maxlength="2000" rows="4" class="gb-textarea" placeholder="写下你的留言..."></textarea>
        </div>
        <button type="submit" class="gb-submit">提交留言</button>
      </form>
    </div>`

  // Entry list
  let entriesHtml: string
  if (entries.length === 0) {
    entriesHtml = '<p class="text-muted" style="margin-top:1rem;">暂无留言，来写第一条吧！</p>'
  } else {
    const items = entries
      .map(
        (e) => `<div class="gb-entry card mb-1">
          <div class="gb-meta">
            <span class="gb-nickname">${escapeHtml(e.nickname || '匿名访客')}</span>
            <span class="gb-time">${formatDate(e.created_at)}</span>
          </div>
          <div class="gb-content">${escapeHtml(e.content)}</div>
        </div>`
      )
      .join('')
    entriesHtml = `<div style="margin-top:1rem;">${items}</div>`
  }

  // Pagination
  let paginationHtml = ''
  if (totalPages > 1) {
    const prev =
      page > 1
        ? `<a href="/guestbook?page=${page - 1}">&larr; 上一页</a>`
        : `<span style="color:#ccc;">&larr; 上一页</span>`
    const next =
      page < totalPages
        ? `<a href="/guestbook?page=${page + 1}">下一页 &rarr;</a>`
        : `<span style="color:#ccc;">下一页 &rarr;</span>`
    paginationHtml = `
      <div class="pagination">
        ${prev}
        <span class="current">${page} / ${totalPages}</span>
        ${next}
      </div>`
  }

  const styles = `<style>
    .gb-banner {
      padding: 0.6rem 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .gb-success {
      background: #e8f5e9;
      color: #2e7d32;
      border: 1px solid #a5d6a7;
    }
    .gb-error {
      background: #fce4ec;
      color: #c62828;
      border: 1px solid #ef9a9a;
    }

    .gb-form { margin-top: 0.5rem; }
    .gb-field { margin-bottom: 0.75rem; }
    .gb-field label {
      display: block;
      font-size: 0.85rem;
      color: #6b4226;
      margin-bottom: 0.25rem;
    }
    .gb-input, .gb-textarea {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #e8dfd0;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9rem;
      background: #faf6ef;
      color: #333;
    }
    .gb-input:focus, .gb-textarea:focus {
      outline: none;
      border-color: #d4a574;
    }
    .gb-textarea { resize: vertical; min-height: 5rem; }
    .gb-submit {
      display: inline-block;
      padding: 0.5rem 1.5rem;
      background: #6b4226;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .gb-submit:hover { background: #d4a574; }

    .gb-entry { padding: 0.75rem 1rem; }
    .gb-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.4rem;
    }
    .gb-nickname {
      font-weight: bold;
      color: #6b4226;
      font-size: 0.9rem;
    }
    .gb-time {
      font-size: 0.78rem;
      color: #999;
    }
    .gb-content {
      font-size: 0.9rem;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>`

  return styles + bannerHtml + formHtml + entriesHtml + paginationHtml
}
