"""
HTML parser for CafeWoo BBS pages archived by the Wayback Machine.

Handles:
- Stripping Wayback Machine wrapper HTML/JS
- Extracting metadata from filenames
- Parsing post content, replies, timestamps, signatures
"""

import re
import html
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ReplyData:
    author: str
    content: str           # cleaned HTML content
    content_text: str      # plain text
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


def strip_wayback(raw_bytes: bytes) -> str:
    """Decode raw bytes and remove all Wayback Machine injected content."""
    text = raw_bytes.decode('gb2312', errors='replace')

    # Remove everything from start to END WAYBACK TOOLBAR INSERT (inclusive)
    marker = '<!-- END WAYBACK TOOLBAR INSERT -->'
    idx = text.find(marker)
    if idx != -1:
        # Find the start of original content before the marker
        # The original <html>...<body> is before the toolbar insert
        # We need to keep the original page content but remove the toolbar
        # The toolbar is injected between <body> and the actual content
        # Strategy: remove from <!-- BEGIN WAYBACK TOOLBAR INSERT --> to the end marker
        begin_marker = '<!-- BEGIN WAYBACK TOOLBAR INSERT -->'
        begin_idx = text.find(begin_marker)
        if begin_idx != -1:
            text = text[:begin_idx] + text[idx + len(marker):]

    # Remove Wayback JS/CSS in the <head> section
    # Remove archive.org script tags
    text = re.sub(
        r'<script src="//archive\.org/includes/athena\.js"[^>]*></script>\s*',
        '', text
    )
    text = re.sub(
        r'<script type="text/javascript">window\.addEventListener\(\'DOMContentLoaded\'.*?</script>\s*',
        '', text, flags=re.DOTALL
    )
    text = re.sub(
        r'<script type="text/javascript" src="https://web-static\.archive\.org/[^"]*"[^>]*></script>\s*',
        '', text
    )
    text = re.sub(
        r'<script>window\.RufflePlayer[^<]*</script>\s*',
        '', text
    )
    text = re.sub(
        r'<script type="text/javascript">\s*__wm\.init\(.*?</script>\s*',
        '', text, flags=re.DOTALL
    )
    text = re.sub(
        r'<link rel="stylesheet"[^>]*href="https://web-static\.archive\.org/[^"]*"[^>]*/>\s*',
        '', text
    )
    text = re.sub(
        r'<!-- End Wayback Rewrite JS Include -->\s*',
        '', text
    )

    # Remove residual Wayback JS like <script>__wm.rw(0);</script>
    text = re.sub(r'<script>\s*__wm\.rw\(\d+\);\s*</script>\s*', '', text)
    text = re.sub(
        r'<script type="text/javascript">//<!\[CDATA\[\s*__wm\.bt\(.*?//\]\]></script>\s*',
        '', text, flags=re.DOTALL
    )

    # Remove trailing Wayback comments
    text = re.sub(r'<!--\s*\n\s*FILE ARCHIVED ON.*', '', text, flags=re.DOTALL)

    # Remove Wayback URL rewrites: /web/20020112070614im_/http://cafewoo.net/...
    # Replace with the original URL path
    text = re.sub(
        r'/web/\d{14}(?:im_|js_|cs_|if_)?/https?://(?:cafewoo\.net|www\.intercafe\.xm\.fj\.cn)',
        '',
        text
    )
    # Also handle full https://web.archive.org/web/... URLs
    text = re.sub(
        r'https://web\.archive\.org/web/\d{14}(?:im_|js_|cs_|if_)?/https?://(?:cafewoo\.net|www\.intercafe\.xm\.fj\.cn)',
        '',
        text
    )

    return text


def extract_metadata(filename: str) -> dict:
    """Parse metadata from a downloaded HTML filename.

    Filename format: {wayback_ts}_bbsid_{bbsid}_board_{board_id}_{hash}.html
    """
    pattern = r'^(\d{14})_bbsid_(\d+)_board_(\d+)_([0-9a-f]+)\.html$'
    m = re.match(pattern, filename)
    if not m:
        raise ValueError(f"Cannot parse filename: {filename}")
    return {
        "wayback_ts": m.group(1),
        "bbsid": int(m.group(2)),
        "board_id": int(m.group(3)),
    }


def _html_to_text(html_str: str) -> str:
    """Convert HTML content to plain text."""
    text = html_str
    # Convert <br> and <br/> to newlines
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    # Convert <p...> to newlines
    text = re.sub(r'<p[^>]*>', '\n', text, flags=re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html.unescape(text)
    # Normalize whitespace on each line but preserve newlines
    lines = text.split('\n')
    lines = [line.strip() for line in lines]
    text = '\n'.join(lines)
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _extract_timestamp(body_html: str) -> Optional[datetime]:
    """Extract timestamp from a post body cell."""
    # Pattern: YYYY-M-D H:MM:SS inside a <span style="font-size: 9pt">
    m = re.search(
        r'<span\s+style="font-size:\s*9pt">\s*(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}:\d{2})\s*',
        body_html
    )
    if m:
        ts_str = m.group(1)
        return datetime.strptime(ts_str, '%Y-%m-%d %H:%M:%S')
    return None


def _extract_signature(body_html: str) -> Optional[str]:
    """Extract signature from post body (after --- separator)."""
    # Signature is after <br>---<br> and inside <font class="font">...</font>
    m = re.search(
        r'<br>---<br>\s*<font class="font">(.*?)</font>',
        body_html,
        re.DOTALL
    )
    if m:
        sig = m.group(1)
        # Convert <br> to newlines in signature
        sig = re.sub(r'<br\s*/?>', '\n', sig, flags=re.IGNORECASE)
        sig = re.sub(r'<[^>]+>', '', sig)
        sig = html.unescape(sig).strip()
        return sig
    return None


def _clean_content_html(body_html: str) -> str:
    """Clean the content HTML: remove timestamp spans, signature section, and form elements."""
    content = body_html

    # Remove timestamp section: <p align="right"><span style="font-size: 9pt">...</span></td>
    content = re.sub(
        r'\s*<p\s+align="right">\s*<span\s+style="font-size:\s*9pt">.*?(?:</span>)?\s*(?:</td>)?\s*$',
        '',
        content,
        flags=re.DOTALL | re.IGNORECASE
    )

    # Remove signature section: <br>---<br><font class="font">...</font><br>
    content = re.sub(
        r'\s*<br\s*/?>---<br\s*/?>\s*<font class="font">.*?</font>\s*(?:<br\s*/?>)?\s*',
        '',
        content,
        flags=re.DOTALL
    )

    # Remove leading <br> tags and whitespace
    content = re.sub(r'^\s*(?:<br\s*/?>|\s)*', '', content, flags=re.IGNORECASE)

    # Remove trailing <br> tags and whitespace
    content = re.sub(r'(?:<br\s*/?>|\s)*\s*$', '', content, flags=re.IGNORECASE)

    return content.strip()


def parse_page(content: str) -> PostData:
    """Parse a cleaned BBS page HTML and extract post data.

    Args:
        content: Cleaned HTML string (output of strip_wayback)

    Returns:
        PostData with title, main post, and replies
    """
    # Extract title from the first C6E2FF row
    title = None
    title_match = re.search(
        r'<tr\s+bgcolor="#C6E2FF">\s*<td[^>]*>.*?</td>\s*<td[^>]*>(?:发表主题|文章主题)：(.*?)</td>\s*</tr>',
        content,
        re.DOTALL
    )
    if title_match:
        title = title_match.group(1).strip()
        # Remove any HTML tags from title
        title = re.sub(r'<[^>]+>', '', title).strip()

    # Extract all E6E6E6 rows (post rows)
    # Each row has two <td> cells: author and body
    row_pattern = re.compile(
        r'<tr\s+bgcolor="#E6E6E6">\s*'
        r'<td[^>]*>(.*?)</td>\s*'
        r'<td[^>]*>(.*?)(?:</td>)?\s*</tr>',
        re.DOTALL
    )

    rows = row_pattern.findall(content)

    if not rows:
        # Some archived pages are parking/error pages (e.g. BlueHost)
        # with no BBS content at all.  Return an empty PostData.
        return PostData(
            title=title,
            author="",
            content="",
            content_text="",
            signature=None,
            posted_at=None,
        )

    # First row is the main post
    author_html, body_html = rows[0]
    author = re.sub(r'<[^>]+>', '', author_html).strip()
    timestamp = _extract_timestamp(body_html)
    signature = _extract_signature(body_html)
    clean_html = _clean_content_html(body_html)
    content_text = _html_to_text(clean_html)

    post = PostData(
        title=title,
        author=author,
        content=clean_html,
        content_text=content_text,
        signature=signature,
        posted_at=timestamp,
    )

    # Remaining rows are replies
    for i, (reply_author_html, reply_body_html) in enumerate(rows[1:], start=1):
        reply_author = re.sub(r'<[^>]+>', '', reply_author_html).strip()
        reply_ts = _extract_timestamp(reply_body_html)
        reply_sig = _extract_signature(reply_body_html)
        reply_clean = _clean_content_html(reply_body_html)
        reply_text = _html_to_text(reply_clean)

        post.replies.append(ReplyData(
            author=reply_author,
            content=reply_clean,
            content_text=reply_text,
            signature=reply_sig,
            posted_at=reply_ts,
            sort_order=i,
        ))

    return post
