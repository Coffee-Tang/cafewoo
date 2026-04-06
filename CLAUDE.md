# CafeWoo - 咖啡看板 BBS 复原项目

## 项目概述

将 www.cafewoo.net 的旧 BBS 网站从 Web Archive 爬取的 HTML 文件中解析数据，存入数据库，并构建一个可部署到 Cloudflare 的现代 Web 应用来动态还原这些页面。

## 原始网站信息

- **网站名称**: 咖啡看板 (CafeWoo)
- **域名**: www.cafewoo.net
- **时期**: 1998-2008（BBS 数据主要覆盖 2001-2004）
- **历史名称**: 厦门因特咖啡屋 (intercafe.xm.fj.cn, 1998-2001) → 咖啡看板 (cafewoo.net, 2001+)
- **技术栈**: 经典 ASP + IIS
- **编码**: GB2312 (中文)
- **原始 URL 格式**: `cafewoo.net/bbs/view.asp?bbsid={id}&ParentID={parent_id}&boradid={board_id}`
- **注意**: 原站 URL 中 board 拼写为 "borad" (typo)

## 版块信息 (Board)

| Board ID | 名称       | 帖子数(约) |
|----------|-----------|-----------|
| 1        | 咖啡人物   | 218       |
| 2        | 小说客栈   | 201       |
| 3        | 影音世界   | 185       |
| 5        | 心情涂鸦   | 383       |
| 6        | 情感驿站   | 373       |
| 7        | 异域乡音   | 187       |
| 8        | (未知)     | 7         |
| 9        | 咖啡足球   | 297       |
| 10       | 菁菁校园   | 434       |
| 11       | 站务讨论   | 176       |
| 12       | 灌水乐园/口水天堂 | 385 |
| 13       | 原味咖啡   | 265       |
| 16       | 游戏部落   | 25        |

## 数据源

- **HTML 文件目录**: `downloaded_html/` (共 2713 个文件)
- **文件命名格式**: `{timestamp}_bbsid_{id}_board_{board_id}_{hash}.html`
- **下载记录**: `download_result.csv`
- **下载脚本**: `download_wayback.py`, `download_wayback_html.py`

## HTML 结构分析

每个 HTML 文件是一个帖子页面 (view.asp)，包含:

1. **Wayback Machine 包装器**: 页面开头到 `<!-- END WAYBACK TOOLBAR INSERT -->` 之间的内容需要跳过
2. **帖子标题**: 在 `<tr bgcolor="#C6E2FF">` 中，格式为 `发表主题：{标题}`
3. **主帖和回复**: 在 `<tr bgcolor="#E6E6E6">` 中
   - 第一个 `<td>`: 作者昵称
   - 第二个 `<td>`: 帖子内容 + 时间戳
4. **时间戳格式**: `YYYY-M-D H:MM:SS` (在 `<span style="font-size: 9pt">` 中)
5. **签名档**: 在 `---` 分隔符之后，`<font class="font">` 中
6. **编码**: 文件以原始字节保存 (download_wayback.py)，需要用 GB2312 解码

## 数据库

- **Host**: 127.0.0.1:3306
- **用户名**: root
- **密码**: root
- **数据库名**: cafewoo

## 历史快照

`screenshots/` 目录包含 10 张历史首页快照（1999-2008），用于"关于"页面的视觉时间线。

## 部署目标

- **平台**: Cloudflare Workers + Hono + D1
- **域名**: www.cafewoo.net (已在 Cloudflare)
- **风格**: 暖色书卷风（帖子详情页保留原始 BBS 表格布局）
- **定位**: 历史档案馆

## 页面列表

| 路径 | 说明 |
|---|---|
| `/` | 首页：统计+搜索+版块+时间线预览+留言板预览 |
| `/board/:id` | 版块帖子列表，分页 |
| `/post/:bbsid` | 帖子详情（原始 BBS 表格布局） |
| `/timeline` | 按月/年浏览帖子 |
| `/search?q=` | 全文搜索 |
| `/user/:nickname` | 用户主页+签名档历史 |
| `/guestbook` | 留言板（匿名/昵称） |
| `/about` | 网站历史（视觉时间线+快照） |

## 设计文档

详细设计 spec: `docs/superpowers/specs/2026-04-06-cafewoo-restoration-design.md`

## 开发规范

- 使用中文注释和文档
- 解析 HTML 时注意 GB2312 编码处理
- 需要清除 Wayback Machine 注入的 HTML/JS/CSS
- 保留原始帖子的时间线和回复结构
- 帖子详情页使用原始 BBS 的 `#C6E2FF` / `#E6E6E6` 表格布局
