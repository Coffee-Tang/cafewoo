import type { PostSummary } from '../db'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatDate(s: string): string {
  if (!s) return ''
  return s.slice(0, 16).replace('T', ' ')
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

export function timelineView(
  yearMonthCounts: { year: number; month: number; count: number }[],
  posts: PostSummary[],
  currentYear: number | null,
  currentMonth: number | null
): string {
  // Build year -> month -> count map
  const yearMap = new Map<number, Map<number, number>>()
  const yearTotals = new Map<number, number>()
  for (const row of yearMonthCounts) {
    if (!yearMap.has(row.year)) yearMap.set(row.year, new Map())
    yearMap.get(row.year)!.set(row.month, row.count)
    yearTotals.set(row.year, (yearTotals.get(row.year) || 0) + row.count)
  }
  const years = Array.from(yearMap.keys()).sort()

  // Year tabs
  const yearTabs = years
    .map((y) => {
      const active = y === currentYear ? ' active' : ''
      return `<a href="/timeline?year=${y}" class="year-tab${active}">${y}</a>`
    })
    .join('')

  const yearTabsHtml = `<div class="year-tabs">${yearTabs}</div>`

  // Month tabs (when year is selected)
  let monthTabsHtml = ''
  if (currentYear && yearMap.has(currentYear)) {
    const months = Array.from(yearMap.get(currentYear)!.keys()).sort((a, b) => a - b)
    const monthTabs = months
      .map((m) => {
        const active = m === currentMonth ? ' active' : ''
        return `<a href="/timeline?year=${currentYear}&month=${m}" class="month-tab${active}">${MONTH_NAMES[m - 1]}</a>`
      })
      .join('')
    monthTabsHtml = `<div class="month-tabs">${monthTabs}</div>`
  }

  let bodyHtml = ''

  if (!currentYear) {
    // Overview mode: show all years with monthly breakdown
    const yearCards = years
      .map((y) => {
        const total = yearTotals.get(y) || 0
        const months = Array.from(yearMap.get(y)!.entries()).sort((a, b) => a[0] - b[0])
        const maxCount = Math.max(...months.map(([, c]) => c))
        const bars = months
          .map(([m, count]) => {
            const pct = maxCount > 0 ? Math.max(4, Math.round((count / maxCount) * 100)) : 4
            return `<div class="bar-row">
              <span class="bar-label">${MONTH_NAMES[m - 1]}</span>
              <a href="/timeline?year=${y}&month=${m}" class="bar-track">
                <span class="bar-fill" style="width:${pct}%"></span>
              </a>
              <span class="bar-count">${count}</span>
            </div>`
          })
          .join('')
        return `<div class="card mb-1">
          <h3 class="section-title"><a href="/timeline?year=${y}">${y}年</a> <span class="text-muted" style="font-weight:normal;">共 ${total} 篇</span></h3>
          <div class="bar-chart">${bars}</div>
        </div>`
      })
      .join('')
    bodyHtml = yearCards
  } else if (!currentMonth) {
    // Year mode: month grid
    const months = Array.from(yearMap.get(currentYear)?.entries() || []).sort((a, b) => a[0] - b[0])
    const grid = Array.from({ length: 12 }, (_, i) => i + 1)
      .map((m) => {
        const count = yearMap.get(currentYear)?.get(m) || 0
        if (count === 0) {
          return `<div class="month-cell empty">
            <div class="month-name">${MONTH_NAMES[m - 1]}</div>
            <div class="month-count">-</div>
          </div>`
        }
        return `<a href="/timeline?year=${currentYear}&month=${m}" class="month-cell">
          <div class="month-name">${MONTH_NAMES[m - 1]}</div>
          <div class="month-count">${count} 篇</div>
        </a>`
      })
      .join('')

    const total = yearTotals.get(currentYear) || 0
    bodyHtml = `
      <div class="card mb-1">
        <h3 class="section-title">${currentYear}年 <span class="text-muted" style="font-weight:normal;">共 ${total} 篇</span></h3>
        <div class="month-grid">${grid}</div>
      </div>`
  } else {
    // Month mode: post list with timeline dots
    const title = `${currentYear}年${currentMonth}月`
    if (posts.length === 0) {
      bodyHtml = `<div class="card mb-1">
        <h3 class="section-title">${title}</h3>
        <p class="text-muted">该月暂无文章。</p>
      </div>`
    } else {
      // Group posts by date
      const postItems = posts
        .map((p) => {
          const date = p.posted_at ? p.posted_at.slice(0, 10) : ''
          const time = p.posted_at ? p.posted_at.slice(11, 16) : ''
          return `<div class="tl-item">
            <div class="tl-dot"></div>
            <div class="tl-content">
              <div class="tl-date">${date} ${time}</div>
              <div class="tl-title"><a href="/post/${p.bbsid}">${escapeHtml(p.title || '(无标题)')}</a></div>
              <div class="text-muted">
                <a href="/user/${encodeURIComponent(p.nickname)}">${escapeHtml(p.nickname)}</a>
                · <a href="/board/${p.board_id}">${escapeHtml(p.board_name)}</a>
                · ${p.reply_count} 回复
              </div>
            </div>
          </div>`
        })
        .join('')
      bodyHtml = `<div class="card mb-1">
        <h3 class="section-title">${title} <span class="text-muted" style="font-weight:normal;">共 ${posts.length} 篇</span></h3>
        <div class="timeline-list">${postItems}</div>
      </div>`
    }
  }

  const styles = `<style>
    .year-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }
    .year-tab {
      display: inline-block;
      padding: 0.4rem 0.9rem;
      border: 1px solid #e8dfd0;
      border-radius: 4px;
      font-size: 0.9rem;
      background: #fff;
      color: #6b4226;
    }
    .year-tab:hover { background: rgba(212, 165, 116, 0.15); }
    .year-tab.active {
      background: #6b4226;
      color: #fff;
      border-color: #6b4226;
    }

    .month-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-bottom: 1rem;
    }
    .month-tab {
      display: inline-block;
      padding: 0.3rem 0.6rem;
      border: 1px solid #e8dfd0;
      border-radius: 4px;
      font-size: 0.82rem;
      background: #fff;
      color: #6b4226;
    }
    .month-tab:hover { background: rgba(212, 165, 116, 0.15); }
    .month-tab.active {
      background: #d4a574;
      color: #fff;
      border-color: #d4a574;
    }

    /* Bar chart for overview */
    .bar-chart { margin-top: 0.5rem; }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.3rem;
    }
    .bar-label {
      width: 2.5rem;
      text-align: right;
      font-size: 0.8rem;
      color: #999;
      flex-shrink: 0;
    }
    .bar-track {
      flex: 1;
      height: 1.2rem;
      background: #f5efe6;
      border-radius: 3px;
      overflow: hidden;
      display: block;
    }
    .bar-fill {
      display: block;
      height: 100%;
      background: #d4a574;
      border-radius: 3px;
      transition: width 0.3s;
    }
    .bar-track:hover .bar-fill { background: #6b4226; }
    .bar-count {
      width: 2.5rem;
      font-size: 0.8rem;
      color: #999;
      flex-shrink: 0;
    }

    /* Month grid */
    .month-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .month-cell {
      display: block;
      padding: 1rem 0.5rem;
      text-align: center;
      border: 1px solid #e8dfd0;
      border-radius: 6px;
      background: #fff;
      color: #6b4226;
    }
    .month-cell:hover:not(.empty) {
      background: rgba(212, 165, 116, 0.15);
      border-color: #d4a574;
    }
    .month-cell.empty {
      color: #ccc;
      border-style: dashed;
    }
    .month-name { font-size: 1rem; font-weight: bold; }
    .month-count { font-size: 0.82rem; margin-top: 0.25rem; color: #999; }
    .month-cell:not(.empty) .month-count { color: #6b4226; }

    /* Timeline list */
    .timeline-list {
      margin-top: 0.5rem;
      padding-left: 1.5rem;
      border-left: 2px solid #e8dfd0;
    }
    .tl-item {
      position: relative;
      padding: 0.5rem 0 0.75rem 1rem;
    }
    .tl-dot {
      position: absolute;
      left: -1.75rem;
      top: 0.75rem;
      width: 0.5rem;
      height: 0.5rem;
      background: #d4a574;
      border-radius: 50%;
      border: 2px solid #faf6ef;
    }
    .tl-date { font-size: 0.78rem; color: #999; }
    .tl-title { margin-top: 0.15rem; }
    .tl-title a { color: #6b4226; font-weight: bold; }
    .tl-title a:hover { color: #d4a574; }

    @media (max-width: 600px) {
      .month-grid { grid-template-columns: repeat(3, 1fr); }
    }
  </style>`

  const breadcrumb = currentYear
    ? `<div class="text-muted mb-1">
        <a href="/timeline">时间线</a>${currentMonth ? ` › <a href="/timeline?year=${currentYear}">${currentYear}年</a> › ${currentMonth}月` : ` › ${currentYear}年`}
      </div>`
    : ''

  return styles + breadcrumb + yearTabsHtml + monthTabsHtml + bodyHtml
}
