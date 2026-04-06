# CafeWoo 咖啡看板 — 复原项目设计文档

## 概述

将 www.cafewoo.net（1998-2008）的 BBS 网站从 Web Archive 爬取的 HTML 中解析数据，构建一个部署到 Cloudflare Workers 的现代 Web 应用，以"时光档案馆"的定位动态还原这些页面。

**定位**: 历史档案馆 — 以"时光胶囊"的方式呈现，强调怀旧感。

**风格**: 暖色书卷风 — 米色纸张质感 + 咖啡棕色调，像翻开一本旧日记。

## 数据源

- **HTML 文件**: `downloaded_html/` 目录，共 2713 个文件
- **文件命名**: `{wayback_timestamp}_bbsid_{id}_board_{board_id}_{hash}.html`
- **编码**: GB2312（文件以原始字节保存，需 GB2312 解码）
- **快照截图**: `screenshots/` 目录，10 张历史首页快照（1999-2008）
- **原始 URL 格式**: `cafewoo.net/bbs/view.asp?bbsid={id}&ParentID={parent_id}&boradid={board_id}`

### HTML 结构

每个文件是一个帖子页面（view.asp），结构如下：

1. Wayback Machine 包装器（从开头到 `<!-- END WAYBACK TOOLBAR INSERT -->`），需跳过
2. 页面头部：`<img src="...images/feelingbanner.gif">` + 回应文章计数
3. 主帖标题：`<tr bgcolor="#C6E2FF">` 中，第二个 `<td>` 含 `发表主题：{标题}` 或 `文章主题：{标题}`
4. 帖子内容（主帖+回复）：`<tr bgcolor="#E6E6E6">` 中
   - 第一个 `<td>`: 作者昵称
   - 第二个 `<td>`: 帖子内容 + 时间戳
5. 时间戳：`<span style="font-size: 9pt">` 中，格式 `YYYY-M-D H:MM:SS`
6. 签名档：`---` 分隔符后，`<font class="font">` 标签内
7. 主帖与回复的区分：第一个 `#C6E2FF` 行含 `作者` + 标题为主帖，后续 `#C6E2FF` 行含 `回文作者` 为回复

## 版块列表

| Board ID | 名称       | 帖子数 |
|----------|-----------|-------|
| 1        | 咖啡人物   | 218   |
| 2        | 小说客栈   | 201   |
| 3        | 影音世界   | 185   |
| 5        | 心情涂鸦   | 383   |
| 6        | 情感驿站   | 373   |
| 7        | 异域乡音   | 187   |
| 8        | (未知)     | 7     |
| 9        | 咖啡足球   | 297   |
| 10       | 菁菁校园   | 434   |
| 11       | 站务讨论   | 176   |
| 12       | 灌水乐园   | 385   |
| 13       | 原味咖啡   | 265   |
| 16       | 游戏部落   | 25    |

## 数据库设计

### 本地开发

- MySQL 8.x，`127.0.0.1:3306`，用户 `root`，密码 `root`，数据库 `cafewoo`

### 生产环境

- Cloudflare D1（SQLite），数据从本地 MySQL 导出后导入

### 表结构

```sql
CREATE TABLE boards (
  id          INT PRIMARY KEY,        -- 原始 board_id
  name        VARCHAR(50) NOT NULL,   -- 版块名称
  description VARCHAR(200),           -- 版块简介
  post_count  INT DEFAULT 0           -- 帖子数
);

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nickname      VARCHAR(100) NOT NULL UNIQUE,
  post_count    INT DEFAULT 0,          -- 总发帖数（主帖+回复）
  first_post_at DATETIME,               -- 最早发帖时间
  last_post_at  DATETIME                -- 最后发帖时间
);

CREATE TABLE user_signatures (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  content       TEXT NOT NULL,            -- 签名档内容
  first_seen_at DATETIME,                 -- 首次使用时间
  last_seen_at  DATETIME,                 -- 最后使用时间
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE posts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  bbsid         INT NOT NULL,             -- 原始 bbsid
  board_id      INT NOT NULL,             -- 版块 ID
  user_id       INT NOT NULL,             -- 作者
  title         VARCHAR(500),             -- 帖子标题
  content       TEXT,                     -- 帖子内容（HTML）
  content_text  TEXT,                     -- 帖子纯文本
  signature     TEXT,                     -- 该帖使用的签名档原文
  posted_at     DATETIME,                -- 发帖时间
  reply_count   INT DEFAULT 0,           -- 回复数
  source_file   VARCHAR(200),            -- 来源 HTML 文件名
  wayback_ts    VARCHAR(14),             -- wayback 抓取时间戳
  FOREIGN KEY (board_id) REFERENCES boards(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_bbsid (bbsid)
);

CREATE TABLE replies (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  post_id       INT NOT NULL,             -- 所属主帖
  user_id       INT NOT NULL,             -- 作者
  content       TEXT,                     -- 回复内容（HTML）
  content_text  TEXT,                     -- 回复纯文本
  signature     TEXT,                     -- 签名档原文
  posted_at     DATETIME,                -- 回复时间
  sort_order    INT DEFAULT 0,           -- 在原帖中的排序
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE guestbook (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nickname      VARCHAR(100),             -- 留言昵称（可匿名）
  content       TEXT NOT NULL,            -- 留言内容
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_hash       VARCHAR(64)              -- IP 哈希（防刷）
);
```

## 技术架构

- **前端渲染**: Cloudflare Workers + Hono 框架（SSR）
- **数据库**: Cloudflare D1
- **域名**: www.cafewoo.net（已在 Cloudflare）
- **静态资源**: 快照图片等存放在 Cloudflare R2 或直接内联

## 页面列表

### 1. 首页 `/`

暖色书卷风，模块从上到下：

1. **Header** — Logo "☕ 咖啡看板" + 标语 "二〇〇一 — 二〇〇四 · 那些年的咖啡时光" + 导航
2. **数据统计** — 四个数字：2713 篇文字 / 2596 位朋友 / 13 个版块 / 3 年时光
3. **搜索栏** — 全文搜索入口，圆角输入框
4. **版块导航** — 两栏卡片网格，每个版块配图标 + 名称 + 帖子数 + 一句简介
5. **时间线预览** — 3 个关键时间节点 + "查看完整时间线 →" 链接
6. **留言板预览** — 最近 2-3 条留言 + "写一条留言" 入口
7. **Footer** — "咖啡看板 · 1998-2008 · 档案由 Web Archive 保存"

### 2. 版块列表 `/board/:id`

- 版块名称 + 帖子总数
- 主帖列表（标题、作者、时间、回复数），按时间倒序
- 分页

### 3. 帖子详情 `/post/:bbsid`

**使用原始 BBS 布局风格**：
- 保留原始的表格布局
- `#C6E2FF` 蓝色标题行 + `#E6E6E6` 灰色内容行
- 作者在左侧 `<td>`，内容在右侧 `<td>`
- 时间戳右对齐
- 签名档以 `---` 分隔，小字显示
- 不含 Wayback Machine 的包装代码
- 顶部加一个返回版块的面包屑导航（书卷风格式）

### 4. 时间线 `/timeline`

- 按月/年分组浏览所有帖子
- 左侧时间轴 + 右侧帖子卡片
- 可按年份跳转

### 5. 搜索 `/search?q=`

- 全文搜索帖子标题和内容
- 搜索结果列表：标题、作者、版块、时间、内容摘要（关键词高亮）
- 分页

### 6. 用户主页 `/user/:nickname`

- 用户昵称 + 统计信息（帖子数、活跃时间段）
- 签名档历史列表
- 该用户的所有帖子列表（按时间倒序）

### 7. 留言板 `/guestbook`

- 完整留言列表，按时间倒序
- 发留言表单：昵称（可选）+ 内容
- 匿名/昵称留言，无需注册

### 8. 关于 `/about`

- 简介："这是一个关于厦门、关于青春、关于一杯咖啡的故事"
- 视觉时间线走廊（配历史快照截图）：
  - 1998 — 厦门因特咖啡屋诞生（intercafe.xm.fj.cn）
  - 2000 — 千禧年版
  - 2001 — 域名投票 + 独立 + 三周年
  - 2002 — 向日葵版，最活跃时期
  - 2003 — 企鹅版
  - 2004 — Tom's Dinner，"Five Years"
  - 2006-2008 — 改版，老用户回忆
  - 2026 — 重新上线
- "那些人" — 关键人物卡片
- 帖子中原始引用作为装饰

## 导航结构

所有页面共享顶部 Header：

```
☕ 咖啡看板
二〇〇一 — 二〇〇四 · 那些年的咖啡时光
首页 · 时间线 · 搜索 · 留言板 · 关于
```

## 开发阶段

### 阶段一：HTML 解析 + 数据入库

- Python 脚本解析 2713 个 HTML 文件
- 提取：帖子标题、作者、内容（HTML + 纯文本）、时间、签名档、版块
- 区分主帖和回复
- 构建用户表和签名档历史
- 写入本地 MySQL

### 阶段二：Cloudflare Workers 应用

- Hono 框架 + D1 数据库
- 实现所有页面（首页、版块、帖子详情、时间线、搜索、用户、留言板、关于）
- 帖子详情页使用原始 BBS 表格布局
- 其他页面使用暖色书卷风

### 阶段三：数据迁移 + 部署

- MySQL 数据导出为 SQL
- 导入 Cloudflare D1
- 快照图片上传至 R2
- 绑定 cafewoo.net 域名
- 上线
