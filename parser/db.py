"""CafeWoo 数据库操作"""
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
        """Get or create user, return user_id. Uses in-memory cache."""
        if nickname in self._user_cache:
            return self._user_cache[nickname]
        self.cursor.execute("SELECT id FROM users WHERE nickname = %s", (nickname,))
        row = self.cursor.fetchone()
        if row:
            self._user_cache[nickname] = row[0]
            return row[0]
        self.cursor.execute("INSERT INTO users (nickname) VALUES (%s)", (nickname,))
        user_id = self.cursor.lastrowid
        self._user_cache[nickname] = user_id
        return user_id

    def update_user_stats(self, user_id: int, posted_at: Optional[datetime]):
        """Increment post_count, update first/last post times."""
        self.cursor.execute(
            """UPDATE users SET
                post_count = post_count + 1,
                first_post_at = CASE WHEN first_post_at IS NULL OR %s < first_post_at THEN %s ELSE first_post_at END,
                last_post_at = CASE WHEN last_post_at IS NULL OR %s > last_post_at THEN %s ELSE last_post_at END
            WHERE id = %s""",
            (posted_at, posted_at, posted_at, posted_at, user_id),
        )

    def insert_post(self, bbsid, board_id, user_id, title, content, content_text,
                    signature, posted_at, reply_count, source_file, wayback_ts) -> int:
        """Insert main post. Return post_id, or -1 if bbsid already exists."""
        self.cursor.execute("SELECT id FROM posts WHERE bbsid = %s", (bbsid,))
        if self.cursor.fetchone():
            return -1
        self.cursor.execute(
            """INSERT INTO posts (bbsid, board_id, user_id, title, content, content_text,
             signature, posted_at, reply_count, source_file, wayback_ts)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (bbsid, board_id, user_id, title, content, content_text,
             signature, posted_at, reply_count, source_file, wayback_ts),
        )
        return self.cursor.lastrowid

    def insert_reply(self, post_id, user_id, content, content_text,
                     signature, posted_at, sort_order):
        """Insert a reply."""
        self.cursor.execute(
            """INSERT INTO replies (post_id, user_id, content, content_text, signature, posted_at, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (post_id, user_id, content, content_text, signature, posted_at, sort_order),
        )

    def upsert_signature(self, user_id: int, sig_content: str, seen_at: Optional[datetime]):
        """Insert or update user signature. If same content exists, update last_seen_at."""
        self.cursor.execute(
            "SELECT id FROM user_signatures WHERE user_id = %s AND content = %s",
            (user_id, sig_content),
        )
        row = self.cursor.fetchone()
        if row:
            self.cursor.execute(
                """UPDATE user_signatures SET
                    last_seen_at = CASE WHEN %s > last_seen_at OR last_seen_at IS NULL THEN %s ELSE last_seen_at END
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
        """Update boards.post_count from posts table."""
        self.cursor.execute(
            "UPDATE boards b SET post_count = (SELECT COUNT(*) FROM posts p WHERE p.board_id = b.id)"
        )
