#!/usr/bin/env python3
"""
下载并解析 Rails 版咖啡看板帖子 (2006-2009)
从 Wayback Machine 获取 /posts/{id}/show_post 格式的页面
"""
import re
import os
import time
import sys
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from db import CafewooDb

WAYBACK_URL = "https://web.archive.org/web/{timestamp}/http://{url}"
DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "downloaded_html_rails")
SLEEP = 1.0

# 从 /tmp/rails_show_posts.txt 读取 URL 列表
POSTS_FILE = "/tmp/rails_show_posts.txt"

# Rails 版版块 ID 映射（从 URL /posts/{board_id}/list 推断）
# 在 Rails 版中，URL 是 /posts/{post_id}/show_post，版块信息在页面 title 中
BOARD_NAME_TO_ID = {
    "咖啡人物": 1, "小说客栈": 2, "影音世界": 3, "心情涂鸦": 5,
    "情感驿站": 6, "异域乡音": 7, "咖啡足球": 9, "菁菁校园": 10,
    "站务讨论": 11, "灌水乐园": 12, "口水天堂": 12, "原味咖啡": 13,
    "游戏部落": 16,
}


def download_page(timestamp, original_url):
    """下载 Wayback 页面"""
    url = WAYBACK_URL.format(timestamp=timestamp, url=original_url.replace("http://", ""))
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (CafeWoo Restoration)"})
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.read()
    except (HTTPError, URLError, Exception) as e:
        print(f"  下载失败: {e}")
        return None


def parse_rails_page(raw_bytes, post_id):
    """解析 Rails 版帖子页面"""
    text = raw_bytes.decode("utf-8", errors="replace")

    # 去除 Wayback 包装
    marker = "<!-- END WAYBACK TOOLBAR INSERT -->"
    idx = text.find(marker)
    if idx >= 0:
        text = text[idx + len(marker):]
    end_marker = "<!--\n     FILE ARCHIVED ON"
    end_idx = text.find(end_marker)
    if end_idx >= 0:
        text = text[:end_idx]

    # 标题：优先从 <legend> 提取，其次从 <title> 提取
    title = None
    board_name = None

    legend_match = re.search(r"<legend>(.*?)</legend>", text)
    if legend_match:
        title = legend_match.group(1).strip()

    title_match = re.search(r"<title>(.*?)</title>", text)
    if title_match:
        parts = title_match.group(1).split("&gt;")
        if len(parts) >= 3:
            board_name = parts[1].strip()
            if not title:
                title = parts[2].strip()
        elif len(parts) >= 2:
            if not title:
                title = parts[-1].strip()

    board_id = BOARD_NAME_TO_ID.get(board_name, 8)  # 默认放未知版块

    # 作者：作者: xxx
    author_match = re.search(r"作者:\s*(\S+)", text)
    author = author_match.group(1) if author_match else ""

    # 发帖时间：发表时间: YYYY-MM-DD HH:MM:SS
    time_match = re.search(r"发表时间:\s*(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}:\d{2})", text)
    posted_at = None
    if time_match:
        try:
            posted_at = datetime.strptime(time_match.group(1), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    # 内容：<legend>标题</legend> 后面到回复区域或页面底部
    content_match = re.search(
        r"<legend>.*?</legend>.*?发表时间:.*?\n(.*?)(?:<fieldset|<div class=\"fdiv\"|</body>)",
        text, re.DOTALL,
    )
    content = ""
    content_text = ""
    signature = None
    if content_match:
        content = content_match.group(1).strip()
        # 清理 Wayback URL 重写
        content = re.sub(r'/web/\d{14}(cs_|im_|js_)?/', '', content)
        content_text = re.sub(r"<[^>]+>", "", content)
        content_text = re.sub(r"&nbsp;", " ", content_text).strip()

    # 回复：<fieldset> 块
    replies = []
    reply_blocks = re.findall(
        r'<fieldset[^>]*>.*?<legend>(.*?)</legend>(.*?)</fieldset>',
        text, re.DOTALL,
    )
    for i, (legend, body) in enumerate(reply_blocks):
        # legend 可能包含回复标题
        r_author_match = re.search(r"作者:\s*(\S+)", body)
        r_time_match = re.search(r"发表时间:\s*(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}:\d{2})", body)
        r_author = r_author_match.group(1) if r_author_match else ""
        r_posted_at = None
        if r_time_match:
            try:
                r_posted_at = datetime.strptime(r_time_match.group(1), "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pass

        # 回复内容
        r_content_match = re.search(r"发表时间:.*?\n(.*?)$", body, re.DOTALL)
        r_content = r_content_match.group(1).strip() if r_content_match else ""
        r_content = re.sub(r'/web/\d{14}(cs_|im_|js_)?/', '', r_content)
        r_content_text = re.sub(r"<[^>]+>", "", r_content)
        r_content_text = re.sub(r"&nbsp;", " ", r_content_text).strip()

        if r_author:
            replies.append({
                "author": r_author,
                "content": r_content,
                "content_text": r_content_text,
                "posted_at": r_posted_at,
                "sort_order": i + 1,
            })

    return {
        "title": title,
        "board_id": board_id,
        "board_name": board_name,
        "author": author,
        "content": content,
        "content_text": content_text,
        "signature": signature,
        "posted_at": posted_at,
        "replies": replies,
    }


def main():
    # 读取 URL 列表
    if not os.path.exists(POSTS_FILE):
        print(f"文件不存在: {POSTS_FILE}")
        sys.exit(1)

    entries = []
    with open(POSTS_FILE) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                url, ts = parts[0], parts[1]
                post_id_match = re.search(r"/posts/(\d+)/show_post", url)
                if post_id_match:
                    entries.append((int(post_id_match.group(1)), ts, url))

    print(f"共 {len(entries)} 个 Rails 帖子待处理")

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    db = CafewooDb()

    downloaded = 0
    imported = 0
    skipped = 0
    errors = 0

    for post_id, timestamp, url in entries:
        # 检查是否已存在
        db.cursor.execute("SELECT id FROM posts WHERE bbsid = %s", (post_id,))
        if db.cursor.fetchone():
            skipped += 1
            continue

        # 下载
        save_path = os.path.join(DOWNLOAD_DIR, f"{timestamp}_rails_{post_id}.html")
        if os.path.exists(save_path):
            with open(save_path, "rb") as f:
                raw = f.read()
        else:
            print(f"  下载 post_id={post_id} (ts={timestamp})...")
            raw = download_page(timestamp, url)
            if not raw:
                errors += 1
                continue
            with open(save_path, "wb") as f:
                f.write(raw)
            downloaded += 1
            time.sleep(SLEEP)

        # 解析
        try:
            data = parse_rails_page(raw, post_id)
        except Exception as e:
            print(f"  解析失败 post_id={post_id}: {e}")
            errors += 1
            continue

        if not data["author"]:
            print(f"  无作者 post_id={post_id}")
            skipped += 1
            continue

        # 入库
        user_id = db.get_or_create_user(data["author"])
        db.update_user_stats(user_id, data["posted_at"])

        pid = db.insert_post(
            bbsid=post_id,
            board_id=data["board_id"],
            user_id=user_id,
            title=data["title"],
            content=data["content"],
            content_text=data["content_text"],
            signature=data["signature"],
            posted_at=data["posted_at"],
            reply_count=len(data["replies"]),
            source_file=f"rails_{post_id}",
            wayback_ts=timestamp,
        )

        if pid == -1:
            skipped += 1
            continue

        for reply in data["replies"]:
            r_user_id = db.get_or_create_user(reply["author"])
            db.update_user_stats(r_user_id, reply["posted_at"])
            db.insert_reply(
                post_id=pid,
                user_id=r_user_id,
                content=reply["content"],
                content_text=reply["content_text"],
                signature=None,
                posted_at=reply["posted_at"],
                sort_order=reply["sort_order"],
            )

        imported += 1

        if (imported + skipped + errors) % 20 == 0:
            db.commit()
            print(f"  进度: 已导入 {imported}, 跳过 {skipped}, 错误 {errors}, 已下载 {downloaded}")

    db.update_board_counts()
    db.commit()
    db.close()

    print(f"\n===== 完成 =====")
    print(f"已下载: {downloaded}")
    print(f"已导入: {imported}")
    print(f"跳过:   {skipped}")
    print(f"错误:   {errors}")


if __name__ == "__main__":
    main()
