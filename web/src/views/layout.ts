export function layout(title: string, activePage: string, body: string): string {
  const nav = [
    { label: '首页', href: '/', key: '首页' },
    { label: '时间线', href: '/timeline', key: '时间线' },
    { label: '搜索', href: '/search', key: '搜索' },
    { label: '留言板', href: '/guestbook', key: '留言板' },
    { label: '关于', href: '/about', key: '关于' },
  ]

  const navHtml = nav
    .map(
      (n) =>
        `<a href="${n.href}" class="nav-link${activePage === n.key ? ' active' : ''}">${n.label}</a>`
    )
    .join(' · ')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — 咖啡看板</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #faf6ef;
      color: #333;
      font-family: Georgia, 'Noto Serif SC', 'Songti SC', serif;
      line-height: 1.7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    a { color: #6b4226; text-decoration: none; }
    a:hover { color: #d4a574; }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 0 1rem;
      width: 100%;
    }

    /* Header */
    header {
      text-align: center;
      padding: 2rem 0 1rem;
      border-bottom: 2px solid #e8dfd0;
    }
    header .logo {
      font-size: 1.8rem;
      font-weight: bold;
      color: #6b4226;
      letter-spacing: 0.05em;
    }
    header .subtitle {
      font-size: 0.9rem;
      color: #999;
      margin-top: 0.25rem;
    }

    /* Navigation */
    nav {
      text-align: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e8dfd0;
      font-size: 0.95rem;
      color: #ccc;
    }
    nav .nav-link {
      color: #6b4226;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      transition: background 0.2s;
    }
    nav .nav-link:hover {
      background: rgba(212, 165, 116, 0.15);
    }
    nav .nav-link.active {
      color: #d4a574;
      font-weight: bold;
    }

    /* Main content */
    main {
      flex: 1;
      padding: 1.5rem 0;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 1.5rem 0;
      border-top: 2px solid #e8dfd0;
      font-size: 0.8rem;
      color: #999;
    }

    /* Shared card style */
    .card {
      background: #fff;
      border: 1px solid #e8dfd0;
      border-radius: 6px;
      padding: 1rem 1.25rem;
    }

    /* Section headings */
    .section-title {
      font-size: 1.1rem;
      color: #6b4226;
      margin-bottom: 0.75rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px dashed #e8dfd0;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }
    .pagination a, .pagination span {
      display: inline-block;
      padding: 0.3rem 0.75rem;
      border: 1px solid #e8dfd0;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .pagination span.current {
      background: #6b4226;
      color: #fff;
      border-color: #6b4226;
    }

    /* Utility */
    .text-muted { color: #999; font-size: 0.85rem; }
    .mt-1 { margin-top: 1rem; }
    .mb-1 { margin-bottom: 1rem; }

    @media (max-width: 600px) {
      header .logo { font-size: 1.4rem; }
      .container { padding: 0 0.75rem; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <div class="logo">☕ 咖啡看板</div>
      <div class="subtitle">一九九八 — 二〇〇八 · 那些年的咖啡时光</div>
    </div>
  </header>
  <nav>
    <div class="container">${navHtml}</div>
  </nav>
  <main>
    <div class="container">
      ${body}
    </div>
  </main>
  <footer>
    <div class="container">咖啡看板 · 1998–2008 · 档案由 Web Archive 保存</div>
  </footer>
  <script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "adc96aecb9094dccbd1b179fa134bf42"}'></script>
</body>
</html>`
}
