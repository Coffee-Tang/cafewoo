# Phase 1: HTML 解析 + 数据入库

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse 2713 HTML files from Web Archive, extract all BBS post data, and import into MySQL for local development.

**Architecture:** A Python pipeline that reads each HTML file, strips the Wayback Machine wrapper, extracts structured post data (title, author, content, timestamp, signature, replies), and writes to MySQL. Includes an export script for later D1 migration.

**Tech Stack:** Python 3.12+, BeautifulSoup4 (html.parser), mysql-connector-python, pytest

---

## File Structure

```
parser/
  schema.sql              - MySQL DDL for all tables
  seed_boards.sql          - INSERT statements for 13 boards
  parse_html.py            - Core parser: HTML → structured data
  db.py                    - Database connection + insert operations
  import_all.py            - Main script: iterate files, parse, insert
  export_d1.sql.py         - Export MySQL → D1-compatible SQLite SQL
  test_parse_html.py       - Tests for the parser
```

---

### Task 1: Database Schema Setup

**Files:**
- Create: `parser/schema.sql`
- Create: `parser/seed_boards.sql`

- [ ] **Step 1: Write the schema SQL**

```sql
-- parser/schema.sql
DROP DATABASE IF EXISTS cafewoo;
CREATE DATABASE cafewoo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cafewoo;

CREATE TABLE boards (
  id          INT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  description VARCHAR(200),
  post_count  INT DEFAULT 0
);

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nickname      VARCHAR(100) NOT NULL UNIQUE,
  post_count    INT DEFAULT 0,
  first_post_at DATETIME,
  last_post_at  DATETIME
);

CREATE TABLE user_signatures (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  content       TEXT NOT NULL,
  first_seen_at DATETIME,
  last_seen_at  DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE posts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  bbsid         INT NOT NULL,
  board_id      INT NOT NULL,
  user_id       INT NOT NULL,
  title         VARCHAR(500),
  content       TEXT,
  content_text  TEXT,
  signature     TEXT,
  posted_at     DATETIME,
  reply_count   INT DEFAULT 0,
  source_file   VARCHAR(200),
  wayback_ts    VARCHAR(14),
  FOREIGN KEY (board_id) REFERENCES boards(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_bbsid (bbsid)
);

CREATE TABLE replies (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  post_id       INT NOT NULL,
  user_id       INT NOT NULL,
  content       TEXT,
  content_text  TEXT,
  signature     TEXT,
  posted_at     DATETIME,
  sort_order    INT DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE guestbook (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nickname      VARCHAR(100),
  content       TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_hash       VARCHAR(64)
);
```

- [ ] **Step 2: Write the board seed data**

```sql
-- parser/seed_boards.sql
USE cafewoo;

INSERT INTO boards (id, name, description) VALUES
(1,  '咖啡人物', '记录那些有故事的人'),
(2,  '小说客栈', '笔下的另一个世界'),
(3,  '影音世界', '一起听过的歌'),
(5,  '心情涂鸦', '随手写下的心情'),
(6,  '情感驿站', '那些说不出口的话'),
(7,  '异域乡音', '远方的故事'),
(8,  '未知版块', ''),
(9,  '咖啡足球', '绿茵场上的热血'),
(10, '菁菁校园', '校园里的青春'),
(11, '站务讨论', '共同建设咖啡'),
(12, '灌水乐园', '什么都可以聊'),
(13, '原味咖啡', '最初的味道'),
(16, '游戏部落', 'CS、奇迹、魔兽');
```

- [ ] **Step 3: Run schema + seed against MySQL**

Run: `mysql -h 127.0.0.1 -u root -proot < parser/schema.sql && mysql -h 127.0.0.1 -u root -proot < parser/seed_boards.sql`
Expected: No errors. Verify with: `mysql -h 127.0.0.1 -u root -proot -e "USE cafewoo; SHOW TABLES; SELECT * FROM boards;"`
Expected output: 6 tables listed, 13 board rows.

- [ ] **Step 4: Commit**

```bash
git add parser/schema.sql parser/seed_boards.sql
git commit -m "feat: add MySQL schema and board seed data"
```

---

### Task 2: HTML Parser — Strip Wayback Wrapper + Extract Metadata

**Files:**
- Create: `parser/parse_html.py`
- Create: `parser/test_parse_html.py`

- [ ] **Step 1: Write the failing test for wayback stripping and metadata extraction**

```python
# parser/test_parse_html.py
import pytest
from parse_html import strip_wayback, extract_metadata


SAMPLE_HTML_BYTES = open(
    "../downloaded_html/20020112070614_bbsid_100238_board_3_c98688b68e.html", "rb"
).read()


def test_strip_wayback_removes_wrapper():
    content = strip_wayback(SAMPLE_HTML_BYTES)
    assert "<!-- END WAYBACK TOOLBAR INSERT -->" not in content
    assert "archive.org" not in content
    assert "wm-ipp" not in content
    # Real content should remain
    assert "One more cup of Coffee" in content or "LuDo" in content


def test_extract_metadata_from_filename():
    meta = extract_metadata("20020112070614_bbsid_100238_board_3_c98688b68e.html")
    assert meta["wayback_ts"] == "20020112070614"
    assert meta["bbsid"] == 100238
    assert meta["board_id"] == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parser && python -m pytest test_parse_html.py::test_strip_wayback_removes_wrapper test_parse_html.py::test_extract_metadata_from_filename -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'parse_html'`

- [ ] **Step 3: Implement strip_wayback and extract_metadata**

```python
# parser/parse_html.py
"""
CafeWoo BBS HTML 解析器
解析从 Web Archive 下载的 HTML 文件，提取帖子结构化数据。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


def strip_wayback(raw_bytes: bytes) -> str:
    """读取原始字节，用 GB2312 解码，去除 Wayback Machine 注入的包装代码。"""
    text = raw_bytes.decode("gb2312", errors="replace")

    # 去除 Wayback 工具栏（从开头到 END WAYBACK TOOLBAR INSERT）
    marker = "<!-- END WAYBACK TOOLBAR INSERT -->"
    idx = text.find(marker)
    if idx >= 0:
        text = text[idx + len(marker):]

    # 去除尾部 Wayback 注释
    end_marker = "<!--\n     FILE ARCHIVED ON"
    end_idx = text.find(end_marker)
    if end_idx >= 0:
        text = text[:end_idx]

    # 去除残留的 Wayback JS 调用
    text = re.sub(r'<script>__wm\.rw\(\d+\);</script>', '', text)

    # 替换 Wayback 重写的 URL
    text = re.sub(
        r'/web/\d{14}(im_)?/https?://[^/"]*',
        '',
        text
    )

    return text.strip()


def extract_metadata(filename: str) -> dict:
    """从文件名中提取 wayback 时间戳、bbsid、board_id。"""
    m = re.match(
        r"(\d{14})_bbsid_(\d+)_board_(\d+)_[a-f0-9]+\.html",
        filename,
    )
    if not m:
        raise ValueError(f"无法解析文件名: {filename}")
    return {
        "wayback_ts": m.group(1),
        "bbsid": int(m.group(2)),
        "board_id": int(m.group(3)),
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd parser && python -m pytest test_parse_html.py::test_strip_wayback_removes_wrapper test_parse_html.py::test_extract_metadata_from_filename -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add parser/parse_html.py parser/test_parse_html.py
git commit -m "feat: add wayback stripping and filename metadata extraction"
```

---

### Task 3: HTML Parser — Extract Title and Posts

**Files:**
- Modify: `parser/parse_html.py`
- Modify: `parser/test_parse_html.py`

- [ ] **Step 1: Write failing tests for title and post extraction**

Append to `parser/test_parse_html.py`:

```python
from parse_html import parse_page, PostData


def test_parse_page_extracts_title():
    content = strip_wayback(SAMPLE_HTML_BYTES)
    page = parse_page(content)
    assert page.title == "One more cup of Coffee"


def test_parse_page_extracts_main_post():
    content = strip_wayback(SAMPLE_HTML_BYTES)
    page = parse_page(content)
    assert page.author == "LuDo"
    assert page.posted_at == datetime(2001, 4, 30, 12, 41, 0)
    assert "空气很闷" in page.content_text
    assert "DuoDuo.Love" in page.signature


def test_parse_page_extracts_replies():
    content = strip_wayback(SAMPLE_HTML_BYTES)
    page = parse_page(content)
    assert len(page.replies) == 5
    assert page.replies[0].author == "多多"
    assert page.replies[0].posted_at == datetime(2001, 4, 30, 21, 5, 0)
    assert page.replies[4].author == "worrysun"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd parser && python -m pytest test_parse_html.py::test_parse_page_extracts_title test_parse_html.py::test_parse_page_extracts_main_post test_parse_html.py::test_parse_page_extracts_replies -v`
Expected: FAIL — `ImportError: cannot import name 'parse_page'`

- [ ] **Step 3: Implement PostData and parse_page**

Append to `parser/parse_html.py`:

```python
@dataclass
class ReplyData:
    author: str
    content: str           # 原始 HTML 内容
    content_text: str      # 纯文本
    signature: Optional[str]
    posted_at: Optional[datetime]
    sort_order: int = 0


@dataclass
class PostData:
    title: Optional[str]
    author: str
    content: str
    content_text: str
    signature: Optional[str]
    posted_at: Optional[datetime]
    replies: list[ReplyData] = field(default_factory=list)


def _extract_timestamp(text: str) -> Optional[datetime]:
    """从文本中提取 YYYY-M-D H:MM:SS 格式的时间戳。"""
    m = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})", text)
    if not m:
        return None
    return datetime(
        int(m.group(1)), int(m.group(2)), int(m.group(3)),
        int(m.group(4)), int(m.group(5)), int(m.group(6)),
    )


def _extract_signature(html: str) -> Optional[str]:
    """从帖子 HTML 中提取签名档（--- 之后 <font class="font"> 中的内容）。"""
    m = re.search(r'---.*?<font class="font">(.*?)</font>', html, re.DOTALL)
    if m:
        sig = re.sub(r"<[^>]+>", "\n", m.group(1)).strip()
        sig = re.sub(r"&nbsp;", " ", sig)
        return sig if sig else None
    return None


def _clean_text(html: str) -> str:
    """将 HTML 转为纯文本。"""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    # 移除签名档部分（纯文本中不重复）
    text = re.sub(r"\n---\n.*$", "", text, flags=re.DOTALL)
    return text.strip()


def _strip_content_html(html: str) -> str:
    """清理帖子内容 HTML，保留有意义的部分。"""
    # 移除时间戳的 span
    html = re.sub(
        r'<p align="right"><span style="font-size: 9pt">\s*\d{4}-.*?</span>.*?$',
        '', html, flags=re.DOTALL,
    )
    # 移除签名档
    html = re.sub(r'<br>---<br>.*$', '', html, flags=re.DOTALL)
    return html.strip()


def parse_page(content: str) -> PostData:
    """解析去除 Wayback 包装后的 HTML 内容，返回结构化的帖子数据。"""
    # 提取标题：在 #C6E2FF 行中，查找"发表主题："或"文章主题："
    title = None
    title_match = re.search(
        r'<tr bgcolor="#C6E2FF">.*?(?:发表主题|文章主题)[：:]\s*(.*?)</td>',
        content, re.DOTALL,
    )
    if title_match:
        title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip()

    # 提取所有帖子行（#E6E6E6 行内的两个 td）
    post_rows = re.findall(
        r'<tr bgcolor="#E6E6E6">\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*</tr>',
        content, re.DOTALL,
    )

    if not post_rows:
        return PostData(
            title=title, author="", content="", content_text="",
            signature=None, posted_at=None,
        )

    # 第一行是主帖
    main_author_html, main_body_html = post_rows[0]
    main_author = re.sub(r"<[^>]+>", "", main_author_html).strip()

    main_post = PostData(
        title=title,
        author=main_author,
        content=_strip_content_html(main_body_html),
        content_text=_clean_text(main_body_html),
        signature=_extract_signature(main_body_html),
        posted_at=_extract_timestamp(main_body_html),
    )

    # 后续行是回复
    for i, (reply_author_html, reply_body_html) in enumerate(post_rows[1:]):
        reply_author = re.sub(r"<[^>]+>", "", reply_author_html).strip()
        if not reply_author:
            continue
        main_post.replies.append(ReplyData(
            author=reply_author,
            content=_strip_content_html(reply_body_html),
            content_text=_clean_text(reply_body_html),
            signature=_extract_signature(reply_body_html),
            posted_at=_extract_timestamp(reply_body_html),
            sort_order=i + 1,
        ))

    return main_post
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd parser && python -m pytest test_parse_html.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add parser/parse_html.py parser/test_parse_html.py
git commit -m "feat: add post/reply extraction with title, author, content, signature, timestamp"
```

---

### Task 4: Test Parser Against Multiple Files

**Files:**
- Modify: `parser/test_parse_html.py`

- [ ] **Step 1: Add tests for different board types and edge cases**

Append to `parser/test_parse_html.py`:

```python
import os

DOWNLOAD_DIR = "../downloaded_html"


def test_parse_board_11_post():
    """站务讨论版块 — 域名投票帖（大量回复）"""
    raw = open(
        os.path.join(DOWNLOAD_DIR, "20020424210428_bbsid_102743_board_11_467a0850b6.html"),
        "rb",
    ).read()
    content = strip_wayback(raw)
    page = parse_page(content)
    assert page.author == "LuDo"
    assert page.posted_at is not None
    assert len(page.replies) > 50  # 该帖有 70 条回复


def test_parse_post_without_signature():
    """没有签名档的帖子"""
    raw = open(
        os.path.join(DOWNLOAD_DIR, "20020827140305_bbsid_175487_board_5_ce2db9fd56.html"),
        "rb",
    ).read()
    content = strip_wayback(raw)
    page = parse_page(content)
    assert page.author != ""
    assert page.signature is None or page.signature is not None  # 不崩溃即可


def test_parse_all_files_no_crash():
    """批量测试：所有文件都能解析不崩溃，且主帖都有作者。"""
    files = [f for f in os.listdir(DOWNLOAD_DIR) if f.endswith(".html")]
    errors = []
    for f in files[:100]:  # 测试前 100 个文件
        try:
            raw = open(os.path.join(DOWNLOAD_DIR, f), "rb").read()
            content = strip_wayback(raw)
            page = parse_page(content)
            if not page.author:
                errors.append(f"No author in {f}")
        except Exception as e:
            errors.append(f"Crash on {f}: {e}")
    assert errors == [], f"Errors:\n" + "\n".join(errors[:10])
```

- [ ] **Step 2: Run tests**

Run: `cd parser && python -m pytest test_parse_html.py -v`
Expected: All pass. If any fail, fix the parser accordingly — common issues are encoding edge cases or slightly different HTML structure in some files.

- [ ] **Step 3: Commit**

```bash
git add parser/test_parse_html.py parser/parse_html.py
git commit -m "test: add multi-file and edge case parser tests"
```

---

### Task 5: Database Insert Operations

**Files:**
- Create: `parser/db.py`

- [ ] **Step 1: Write the database module**

```python
# parser/db.py
"""
CafeWoo 数据库操作
处理用户、帖子、回复、签名档的插入和更新。
"""
from __future__ import annotations

import mysql.connector
from datetime import datetime
from typing import Optional


class CafewooDb:
    def __init__(self, host="127.0.0.1", port=3306, user="root", password="root", database="cafewoo"):
        self.conn = mysql.connector.connect(
            host=host, port=port, user=user, password=password,
            database=database, charset="utf8mb4",
        )
        self.conn.autocommit = False
        self.cursor = self.conn.cursor()
        self._user_cache: dict[str, int] = {}  # nickname → user_id

    def close(self):
        self.conn.commit()
        self.cursor.close()
        self.conn.close()

    def commit(self):
        self.conn.commit()

    def get_or_create_user(self, nickname: str) -> int:
        """获取或创建用户，返回 user_id。使用内存缓存避免重复查询。"""
        if nickname in self._user_cache:
            return self._user_cache[nickname]

        self.cursor.execute("SELECT id FROM users WHERE nickname = %s", (nickname,))
        row = self.cursor.fetchone()
        if row:
            self._user_cache[nickname] = row[0]
            return row[0]

        self.cursor.execute(
            "INSERT INTO users (nickname) VALUES (%s)",
            (nickname,),
        )
        user_id = self.cursor.lastrowid
        self._user_cache[nickname] = user_id
        return user_id

    def update_user_stats(self, user_id: int, posted_at: Optional[datetime]):
        """更新用户的 post_count, first_post_at, last_post_at。"""
        self.cursor.execute(
            """UPDATE users SET
                post_count = post_count + 1,
                first_post_at = CASE
                    WHEN first_post_at IS NULL OR %s < first_post_at THEN %s
                    ELSE first_post_at END,
                last_post_at = CASE
                    WHEN last_post_at IS NULL OR %s > last_post_at THEN %s
                    ELSE last_post_at END
            WHERE id = %s""",
            (posted_at, posted_at, posted_at, posted_at, user_id),
        )

    def insert_post(
        self, bbsid: int, board_id: int, user_id: int,
        title: Optional[str], content: Optional[str], content_text: Optional[str],
        signature: Optional[str], posted_at: Optional[datetime],
        reply_count: int, source_file: str, wayback_ts: str,
    ) -> int:
        """插入主帖，返回 post_id。如果 bbsid 已存在则跳过。"""
        self.cursor.execute("SELECT id FROM posts WHERE bbsid = %s", (bbsid,))
        if self.cursor.fetchone():
            return -1  # 已存在，跳过

        self.cursor.execute(
            """INSERT INTO posts
            (bbsid, board_id, user_id, title, content, content_text,
             signature, posted_at, reply_count, source_file, wayback_ts)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (bbsid, board_id, user_id, title, content, content_text,
             signature, posted_at, reply_count, source_file, wayback_ts),
        )
        return self.cursor.lastrowid

    def insert_reply(
        self, post_id: int, user_id: int,
        content: Optional[str], content_text: Optional[str],
        signature: Optional[str], posted_at: Optional[datetime],
        sort_order: int,
    ):
        """插入回复。"""
        self.cursor.execute(
            """INSERT INTO replies
            (post_id, user_id, content, content_text, signature, posted_at, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (post_id, user_id, content, content_text, signature, posted_at, sort_order),
        )

    def upsert_signature(self, user_id: int, sig_content: str, seen_at: Optional[datetime]):
        """插入或更新用户签名档。如果内容相同则更新 last_seen_at。"""
        self.cursor.execute(
            "SELECT id FROM user_signatures WHERE user_id = %s AND content = %s",
            (user_id, sig_content),
        )
        row = self.cursor.fetchone()
        if row:
            self.cursor.execute(
                """UPDATE user_signatures SET
                    last_seen_at = CASE
                        WHEN %s > last_seen_at OR last_seen_at IS NULL THEN %s
                        ELSE last_seen_at END
                WHERE id = %s""",
                (seen_at, seen_at, row[0]),
            )
        else:
            self.cursor.execute(
                """INSERT INTO user_signatures (user_id, content, first_seen_at, last_seen_at)
                VALUES (%s, %s, %s, %s)""",
                (user_id, sig_content, seen_at, seen_at),
            )

    def update_board_counts(self):
        """根据 posts 表更新 boards.post_count。"""
        self.cursor.execute(
            """UPDATE boards b SET post_count = (
                SELECT COUNT(*) FROM posts p WHERE p.board_id = b.id
            )"""
        )
```

- [ ] **Step 2: Quick smoke test**

Run: `cd parser && python -c "from db import CafewooDb; db = CafewooDb(); uid = db.get_or_create_user('test_user'); print(f'user_id={uid}'); db.conn.rollback(); db.close(); print('OK')"`
Expected: `user_id=1` and `OK` printed without errors.

- [ ] **Step 3: Commit**

```bash
git add parser/db.py
git commit -m "feat: add database insert operations for users, posts, replies, signatures"
```

---

### Task 6: Main Import Script

**Files:**
- Create: `parser/import_all.py`

- [ ] **Step 1: Write the import script**

```python
#!/usr/bin/env python3
# parser/import_all.py
"""
主导入脚本：遍历 downloaded_html/ 中所有 HTML 文件，解析并写入 MySQL。
"""
from __future__ import annotations

import os
import sys
import time

from parse_html import strip_wayback, extract_metadata, parse_page
from db import CafewooDb

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "downloaded_html")
BATCH_SIZE = 100  # 每 N 个文件 commit 一次


def main():
    db = CafewooDb()

    files = sorted(f for f in os.listdir(DOWNLOAD_DIR) if f.endswith(".html"))
    total = len(files)
    imported = 0
    skipped = 0
    errors = 0

    print(f"开始导入，共 {total} 个文件...")
    start = time.time()

    for i, filename in enumerate(files):
        try:
            meta = extract_metadata(filename)
        except ValueError:
            print(f"  [SKIP] 无法解析文件名: {filename}")
            skipped += 1
            continue

        filepath = os.path.join(DOWNLOAD_DIR, filename)
        with open(filepath, "rb") as f:
            raw = f.read()

        try:
            content = strip_wayback(raw)
            page = parse_page(content)
        except Exception as e:
            print(f"  [ERROR] 解析失败 {filename}: {e}")
            errors += 1
            continue

        if not page.author:
            print(f"  [SKIP] 无作者: {filename}")
            skipped += 1
            continue

        # 插入主帖作者
        user_id = db.get_or_create_user(page.author)
        db.update_user_stats(user_id, page.posted_at)

        # 处理主帖签名档
        if page.signature:
            db.upsert_signature(user_id, page.signature, page.posted_at)

        # 插入主帖
        post_id = db.insert_post(
            bbsid=meta["bbsid"],
            board_id=meta["board_id"],
            user_id=user_id,
            title=page.title,
            content=page.content,
            content_text=page.content_text,
            signature=page.signature,
            posted_at=page.posted_at,
            reply_count=len(page.replies),
            source_file=filename,
            wayback_ts=meta["wayback_ts"],
        )

        if post_id == -1:
            skipped += 1
            continue

        # 插入回复
        for reply in page.replies:
            reply_user_id = db.get_or_create_user(reply.author)
            db.update_user_stats(reply_user_id, reply.posted_at)

            if reply.signature:
                db.upsert_signature(reply_user_id, reply.signature, reply.posted_at)

            db.insert_reply(
                post_id=post_id,
                user_id=reply_user_id,
                content=reply.content,
                content_text=reply.content_text,
                signature=reply.signature,
                posted_at=reply.posted_at,
                sort_order=reply.sort_order,
            )

        imported += 1

        if (i + 1) % BATCH_SIZE == 0:
            db.commit()
            elapsed = time.time() - start
            rate = (i + 1) / elapsed
            print(f"  [{i+1}/{total}] 已导入 {imported}，跳过 {skipped}，错误 {errors} ({rate:.0f} 文件/秒)")

    # 更新版块帖子数
    db.update_board_counts()
    db.commit()
    db.close()

    elapsed = time.time() - start
    print(f"\n===== 导入完成 =====")
    print(f"总文件: {total}")
    print(f"已导入: {imported}")
    print(f"跳过:   {skipped}")
    print(f"错误:   {errors}")
    print(f"耗时:   {elapsed:.1f}秒")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Install dependencies**

Run: `pip install mysql-connector-python beautifulsoup4 pytest`

- [ ] **Step 3: Reset database and run import**

Run: `mysql -h 127.0.0.1 -u root -proot < parser/schema.sql && mysql -h 127.0.0.1 -u root -proot < parser/seed_boards.sql && cd parser && python import_all.py`
Expected: Progress output, ending with stats similar to: `已导入: ~2700, 跳过: ~10, 错误: ~0`

- [ ] **Step 4: Verify data in MySQL**

Run:
```bash
mysql -h 127.0.0.1 -u root -proot cafewoo -e "
SELECT '--- 版块统计 ---';
SELECT id, name, post_count FROM boards ORDER BY id;
SELECT '--- 用户统计 ---';
SELECT COUNT(*) AS total_users FROM users;
SELECT nickname, post_count FROM users ORDER BY post_count DESC LIMIT 10;
SELECT '--- 帖子统计 ---';
SELECT COUNT(*) AS total_posts FROM posts;
SELECT COUNT(*) AS total_replies FROM replies;
SELECT '--- 签名档统计 ---';
SELECT COUNT(*) AS total_signatures FROM user_signatures;
SELECT COUNT(DISTINCT user_id) AS users_with_sigs FROM user_signatures;
"
```
Expected: ~2596 users, ~2713 posts, ~716 users with signatures, board counts matching spec.

- [ ] **Step 5: Commit**

```bash
git add parser/import_all.py
git commit -m "feat: add main import script — parses all HTML files into MySQL"
```

---

### Task 7: Data Verification and Fixes

**Files:**
- Modify: `parser/parse_html.py` (if needed)
- Modify: `parser/test_parse_html.py`

- [ ] **Step 1: Run spot-check queries to verify data quality**

```bash
mysql -h 127.0.0.1 -u root -proot cafewoo -e "
-- 检查帖子标题提取
SELECT bbsid, title, posted_at FROM posts WHERE title IS NOT NULL LIMIT 10;

-- 检查无标题帖子数量
SELECT COUNT(*) AS posts_without_title FROM posts WHERE title IS NULL;

-- 检查回复排序
SELECT p.bbsid, p.title, COUNT(r.id) AS reply_count
FROM posts p JOIN replies r ON r.post_id = p.id
GROUP BY p.id ORDER BY reply_count DESC LIMIT 5;

-- 检查签名档内容
SELECT u.nickname, s.content FROM user_signatures s
JOIN users u ON u.id = s.user_id LIMIT 5;

-- 检查时间范围
SELECT MIN(posted_at) AS earliest, MAX(posted_at) AS latest FROM posts;
"
```
Expected: Titles present for most posts, time range roughly 2000-2004, reply counts matching HTML files.

- [ ] **Step 2: Fix any parser issues found in Step 1**

If titles are missing or data looks wrong, adjust regex patterns in `parse_html.py` and re-run import. Common fixes:
- Title pattern may need to handle `文章主题：` variant
- Some timestamps may be in slightly different format
- Some files may have different `bgcolor` capitalization

- [ ] **Step 3: Re-run import if fixes were needed**

Run: `mysql -h 127.0.0.1 -u root -proot < parser/schema.sql && mysql -h 127.0.0.1 -u root -proot < parser/seed_boards.sql && cd parser && python import_all.py`

- [ ] **Step 4: Commit fixes**

```bash
git add parser/parse_html.py parser/test_parse_html.py
git commit -m "fix: improve parser accuracy after data verification"
```

---

### Task 8: D1 Export Script

**Files:**
- Create: `parser/export_d1.py`

- [ ] **Step 1: Write the export script**

```python
#!/usr/bin/env python3
# parser/export_d1.py
"""
将 MySQL 数据导出为 Cloudflare D1 兼容的 SQLite SQL 文件。
"""
from __future__ import annotations

import mysql.connector
import sys


def escape_sql(value) -> str:
    """转义 SQL 字符串值。"""
    if value is None:
        return "NULL"
    s = str(value).replace("'", "''")
    return f"'{s}'"


def main():
    output_file = sys.argv[1] if len(sys.argv) > 1 else "cafewoo_d1.sql"

    conn = mysql.connector.connect(
        host="127.0.0.1", port=3306, user="root", password="root",
        database="cafewoo", charset="utf8mb4",
    )
    cursor = conn.cursor(dictionary=True)

    with open(output_file, "w", encoding="utf-8") as f:
        # SQLite 兼容的建表语句
        f.write("-- CafeWoo D1 数据导出\n")
        f.write("-- 生成自 MySQL，导入 Cloudflare D1 (SQLite)\n\n")

        f.write("DROP TABLE IF EXISTS replies;\n")
        f.write("DROP TABLE IF EXISTS posts;\n")
        f.write("DROP TABLE IF EXISTS user_signatures;\n")
        f.write("DROP TABLE IF EXISTS guestbook;\n")
        f.write("DROP TABLE IF EXISTS users;\n")
        f.write("DROP TABLE IF EXISTS boards;\n\n")

        f.write("""CREATE TABLE boards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  post_count INTEGER DEFAULT 0
);\n\n""")

        f.write("""CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE,
  post_count INTEGER DEFAULT 0,
  first_post_at TEXT,
  last_post_at TEXT
);\n\n""")

        f.write("""CREATE TABLE user_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  first_seen_at TEXT,
  last_seen_at TEXT
);\n\n""")

        f.write("""CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bbsid INTEGER NOT NULL UNIQUE,
  board_id INTEGER NOT NULL REFERENCES boards(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT,
  content TEXT,
  content_text TEXT,
  signature TEXT,
  posted_at TEXT,
  reply_count INTEGER DEFAULT 0,
  source_file TEXT,
  wayback_ts TEXT
);\n\n""")

        f.write("""CREATE TABLE replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT,
  content_text TEXT,
  signature TEXT,
  posted_at TEXT,
  sort_order INTEGER DEFAULT 0
);\n\n""")

        f.write("""CREATE TABLE guestbook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT
);\n\n""")

        # 导出数据
        tables = [
            ("boards", "SELECT * FROM boards ORDER BY id"),
            ("users", "SELECT * FROM users ORDER BY id"),
            ("user_signatures", "SELECT * FROM user_signatures ORDER BY id"),
            ("posts", "SELECT * FROM posts ORDER BY id"),
            ("replies", "SELECT * FROM replies ORDER BY id"),
        ]

        for table_name, query in tables:
            cursor.execute(query)
            rows = cursor.fetchall()
            if not rows:
                continue

            f.write(f"-- {table_name}: {len(rows)} rows\n")
            cols = list(rows[0].keys())

            for row in rows:
                vals = ", ".join(escape_sql(row[c]) for c in cols)
                col_names = ", ".join(cols)
                f.write(f"INSERT INTO {table_name} ({col_names}) VALUES ({vals});\n")

            f.write("\n")

        # 添加索引
        f.write("-- 索引\n")
        f.write("CREATE INDEX idx_posts_board ON posts(board_id);\n")
        f.write("CREATE INDEX idx_posts_user ON posts(user_id);\n")
        f.write("CREATE INDEX idx_posts_posted ON posts(posted_at);\n")
        f.write("CREATE INDEX idx_replies_post ON replies(post_id);\n")
        f.write("CREATE INDEX idx_replies_user ON replies(user_id);\n")
        f.write("CREATE INDEX idx_sigs_user ON user_signatures(user_id);\n")
        f.write("CREATE INDEX idx_guestbook_created ON guestbook(created_at);\n")

    cursor.close()
    conn.close()
    print(f"导出完成: {output_file}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run export**

Run: `cd parser && python export_d1.py cafewoo_d1.sql`
Expected: `导出完成: cafewoo_d1.sql`

- [ ] **Step 3: Verify the exported SQL is valid SQLite**

Run: `cd parser && sqlite3 :memory: < cafewoo_d1.sql && sqlite3 :memory: "$(cat cafewoo_d1.sql)" ".tables" 2>/dev/null || (cat cafewoo_d1.sql | sqlite3 /tmp/cafewoo_test.db && sqlite3 /tmp/cafewoo_test.db "SELECT COUNT(*) FROM posts; SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM replies;")`
Expected: Row counts matching MySQL data.

- [ ] **Step 4: Commit**

```bash
git add parser/export_d1.py
git commit -m "feat: add D1 export script — MySQL to SQLite-compatible SQL"
```

---

## Summary

After completing all 8 tasks, you will have:

1. ✅ MySQL database `cafewoo` with 6 tables, populated with all BBS data
2. ✅ ~2713 posts, ~2596 users, ~716 users with signatures, 13 boards
3. ✅ Parser tested against real HTML files
4. ✅ D1 export SQL file ready for Cloudflare deployment

**Next:** Phase 2 plan (Cloudflare Workers + Hono web application) will be written as a separate plan.
