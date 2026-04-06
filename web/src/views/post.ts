import type { PostDetail, Reply } from '../db'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatSignature(sig: string | null): string {
  if (!sig) return ''
  const escaped = escapeHtml(sig).replace(/\n/g, '<br>')
  return `<div class="bbs-sig">---<br>${escaped}</div>`
}

function formatDate(s: string): string {
  if (!s) return ''
  return s.slice(0, 19).replace('T', ' ')
}

export function postView(post: PostDetail, replies: Reply[]): string {
  const breadcrumb = `<div class="text-muted mb-1">
    <a href="/">首页</a> › <a href="/board/${post.board_id}">${escapeHtml(post.board_name)}</a> › ${escapeHtml(post.title || '(无标题)')}
  </div>`

  const replyRows = replies
    .map(
      (r) => `
  <tr class="bbs-header">
    <td>回文作者</td>
    <td></td>
  </tr>
  <tr class="bbs-content">
    <td class="author-cell"><a href="/user/${encodeURIComponent(r.nickname)}">${escapeHtml(r.nickname)}</a></td>
    <td class="body-cell">
      ${r.content}
      ${formatSignature(r.signature)}
      <div class="bbs-time">${formatDate(r.posted_at)}</div>
    </td>
  </tr>`
    )
    .join('\n')

  const bbsTable = `
<table class="bbs-table" border="0" cellpadding="6" cellspacing="1" bgcolor="#000000">
  <tr class="bbs-header">
    <td>作者</td>
    <td>发表主题：${escapeHtml(post.title || '(无标题)')}</td>
  </tr>
  <tr class="bbs-content">
    <td class="author-cell"><a href="/user/${encodeURIComponent(post.nickname)}">${escapeHtml(post.nickname)}</a></td>
    <td class="body-cell">
      ${post.content}
      ${formatSignature(post.signature)}
      <div class="bbs-time">${formatDate(post.posted_at)}</div>
    </td>
  </tr>
  ${replyRows}
</table>`

  const styles = `<style>
.bbs-table { width: 100%; border-collapse: separate; border-spacing: 0 1px; }
.bbs-table td { padding: 8px 12px; }
.bbs-header td { background: #C6E2FF; font-size: 14.8px; }
.bbs-content td { background: #E6E6E6; font-size: 14.8px; vertical-align: top; }
.bbs-content .author-cell { width: 18%; }
.bbs-content .body-cell { width: 82%; line-height: 1.8; }
.bbs-sig { border-top: 1px dashed #ccc; margin-top: 12px; padding-top: 8px; font-size: 9pt; color: #888; }
.bbs-time { text-align: right; font-size: 9pt; color: #999; margin-top: 8px; }
.bbs-table a { color: #000; text-decoration: none; }
.bbs-table a:hover { color: red; text-decoration: underline; }
</style>`

  return styles + breadcrumb + bbsTable
}
