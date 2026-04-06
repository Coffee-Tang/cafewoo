#!/usr/bin/env python3
"""Export cafewoo MySQL database to SQLite-compatible SQL for Cloudflare D1."""

import sys
import mysql.connector


def escape_sql(value):
    """Escape a value for SQLite SQL insertion."""
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    s = str(value)
    s = s.replace("'", "''")
    return f"'{s}'"


TABLES = {
    "boards": {
        "create": """CREATE TABLE boards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  post_count INTEGER DEFAULT 0
);""",
        "columns": ["id", "name", "description", "post_count"],
    },
    "users": {
        "create": """CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE,
  post_count INTEGER DEFAULT 0,
  first_post_at TEXT,
  last_post_at TEXT
);""",
        "columns": ["id", "nickname", "post_count", "first_post_at", "last_post_at"],
    },
    "user_signatures": {
        "create": """CREATE TABLE user_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  first_seen_at TEXT,
  last_seen_at TEXT
);""",
        "columns": ["id", "user_id", "content", "first_seen_at", "last_seen_at"],
    },
    "posts": {
        "create": """CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bbsid INTEGER NOT NULL UNIQUE,
  board_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  content_text TEXT,
  signature TEXT,
  posted_at TEXT,
  reply_count INTEGER DEFAULT 0,
  source_file TEXT,
  wayback_ts TEXT
);""",
        "columns": [
            "id", "bbsid", "board_id", "user_id", "title", "content",
            "content_text", "signature", "posted_at", "reply_count",
            "source_file", "wayback_ts",
        ],
    },
    "replies": {
        "create": """CREATE TABLE replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT,
  content_text TEXT,
  signature TEXT,
  posted_at TEXT,
  sort_order INTEGER DEFAULT 0
);""",
        "columns": [
            "id", "post_id", "user_id", "content", "content_text",
            "signature", "posted_at", "sort_order",
        ],
    },
}

INDEXES = [
    "CREATE INDEX idx_posts_board ON posts(board_id);",
    "CREATE INDEX idx_posts_user ON posts(user_id);",
    "CREATE INDEX idx_posts_posted ON posts(posted_at);",
    "CREATE INDEX idx_posts_bbsid ON posts(bbsid);",
    "CREATE INDEX idx_replies_post ON replies(post_id);",
    "CREATE INDEX idx_replies_user ON replies(user_id);",
    "CREATE INDEX idx_sigs_user ON user_signatures(user_id);",
]


def main():
    if len(sys.argv) < 2:
        print("Usage: python export_d1.py <output.sql>")
        sys.exit(1)

    output_path = sys.argv[1]

    conn = mysql.connector.connect(
        host="127.0.0.1",
        port=3306,
        user="root",
        password="root",
        database="cafewoo",
    )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("-- cafewoo D1 export (SQLite-compatible)\n\n")

        # Create tables and export data
        for table_name, spec in TABLES.items():
            print(f"Exporting {table_name}...")
            f.write(f"-- Table: {table_name}\n")
            f.write(f"DROP TABLE IF EXISTS {table_name};\n")
            f.write(spec["create"] + "\n\n")

            columns = spec["columns"]
            cur = conn.cursor()
            cur.execute(f"SELECT {', '.join(columns)} FROM {table_name}")

            cols_str = ", ".join(columns)
            row_count = 0
            for row in cur:
                values = ", ".join(escape_sql(v) for v in row)
                f.write(f"INSERT INTO {table_name} ({cols_str}) VALUES ({values});\n")
                row_count += 1

            f.write("\n")
            cur.close()
            print(f"  -> {row_count} rows")

        # Create indexes
        f.write("-- Indexes\n")
        for idx in INDEXES:
            f.write(idx + "\n")
        f.write("\n")

    conn.close()
    print(f"\nExport complete: {output_path}")


if __name__ == "__main__":
    main()
