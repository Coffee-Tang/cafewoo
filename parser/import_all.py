"""
Import all downloaded HTML files into the cafewoo MySQL database.

Iterates every .html file in downloaded_html/, parses each one,
and inserts posts, replies, users, and signatures into the DB.
"""

import os
import time
from parse_html import strip_wayback, extract_metadata, parse_page
from db import CafewooDb

HTML_DIR = os.path.join(os.path.dirname(__file__), '..', 'downloaded_html')
COMMIT_EVERY = 100


def main():
    db = CafewooDb()

    files = sorted(f for f in os.listdir(HTML_DIR) if f.endswith('.html'))
    total_files = len(files)

    stats = {
        'posts_inserted': 0,
        'posts_skipped_dup': 0,
        'posts_skipped_noauthor': 0,
        'replies_inserted': 0,
        'users_created': 0,
        'signatures_handled': 0,
        'errors': 0,
    }

    print(f"Starting import of {total_files} files...")
    t0 = time.time()

    for i, filename in enumerate(files, start=1):
        try:
            # Extract metadata from filename
            meta = extract_metadata(filename)
            bbsid = meta['bbsid']
            board_id = meta['board_id']
            wayback_ts = meta['wayback_ts']

            # Read and parse
            filepath = os.path.join(HTML_DIR, filename)
            with open(filepath, 'rb') as f:
                raw_bytes = f.read()

            content = strip_wayback(raw_bytes)
            post_data = parse_page(content)

            # Skip parking pages (no author)
            if not post_data.author:
                stats['posts_skipped_noauthor'] += 1
                continue

            # Main post author
            user_id = db.get_or_create_user(post_data.author)
            db.update_user_stats(user_id, post_data.posted_at)

            # Handle signature
            if post_data.signature:
                db.upsert_signature(user_id, post_data.signature, post_data.posted_at)
                stats['signatures_handled'] += 1

            # Insert main post
            post_id = db.insert_post(
                bbsid=bbsid,
                board_id=board_id,
                user_id=user_id,
                title=post_data.title,
                content=post_data.content,
                content_text=post_data.content_text,
                signature=post_data.signature,
                posted_at=post_data.posted_at,
                reply_count=len(post_data.replies),
                source_file=filename,
                wayback_ts=wayback_ts,
            )

            if post_id == -1:
                stats['posts_skipped_dup'] += 1
                continue

            stats['posts_inserted'] += 1

            # Insert replies
            for reply in post_data.replies:
                reply_user_id = db.get_or_create_user(reply.author)
                db.update_user_stats(reply_user_id, reply.posted_at)

                if reply.signature:
                    db.upsert_signature(reply_user_id, reply.signature, reply.posted_at)
                    stats['signatures_handled'] += 1

                db.insert_reply(
                    post_id=post_id,
                    user_id=reply_user_id,
                    content=reply.content,
                    content_text=reply.content_text,
                    signature=reply.signature,
                    posted_at=reply.posted_at,
                    sort_order=reply.sort_order,
                )
                stats['replies_inserted'] += 1

        except Exception as e:
            stats['errors'] += 1
            print(f"  ERROR on {filename}: {e}")

        # Commit and print progress every COMMIT_EVERY files
        if i % COMMIT_EVERY == 0:
            db.commit()
            elapsed = time.time() - t0
            print(f"  [{i}/{total_files}] {stats['posts_inserted']} posts, "
                  f"{stats['replies_inserted']} replies, "
                  f"{stats['errors']} errors  ({elapsed:.1f}s)")

    # Final: update board counts, commit, close
    db.update_board_counts()
    db.commit()
    db.close()

    elapsed = time.time() - t0
    print(f"\nImport complete in {elapsed:.1f}s")
    print(f"  Files processed:   {total_files}")
    print(f"  Posts inserted:    {stats['posts_inserted']}")
    print(f"  Posts skipped dup: {stats['posts_skipped_dup']}")
    print(f"  Posts skipped (no author): {stats['posts_skipped_noauthor']}")
    print(f"  Replies inserted:  {stats['replies_inserted']}")
    print(f"  Signatures handled:{stats['signatures_handled']}")
    print(f"  Errors:            {stats['errors']}")


if __name__ == '__main__':
    main()
