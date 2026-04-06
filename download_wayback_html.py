#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import csv
import hashlib
import re
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError


INPUT_FILE = "cafewoo_urls.txt"
OUTPUT_DIR = "downloaded_html"
RESULT_CSV = "download_result.csv"

ONLY_STATUS_200 = True
TIMEOUT = 20
SLEEP_SECONDS = 0.5

WAYBACK_URL_TEMPLATE = "https://web.archive.org/web/{timestamp}id_/{original_url}"


def parse_line(line: str) -> Optional[tuple[str, str, str]]:
    line = line.strip()
    if not line:
        return None

    parts = line.split()
    if len(parts) < 3:
        return None

    timestamp = parts[0]
    status = parts[-1]
    original_url = " ".join(parts[1:-1])

    if not re.fullmatch(r"\d{14}", timestamp):
        return None
    if not re.fullmatch(r"\d{3}", status):
        return None

    return timestamp, original_url, status


def safe_filename(timestamp: str, original_url: str) -> str:
    parsed = urlparse(original_url)
    qs = parse_qs(parsed.query)

    bbsid = qs.get("bbsid", [None])[0]
    boardid = qs.get("boradid", [None])[0]

    url_hash = hashlib.md5(original_url.encode("utf-8")).hexdigest()[:10]

    parts = [timestamp]
    if bbsid:
        parts.append(f"bbsid_{bbsid}")
    if boardid:
        parts.append(f"board_{boardid}")
    parts.append(url_hash)

    return "_".join(parts) + ".html"


def detect_encoding(raw: bytes, headers=None) -> str:
    # 1. 先看 HTTP Header
    if headers:
        content_type = headers.get("Content-Type", "")
        m = re.search(r"charset=([^\s;]+)", content_type, re.I)
        if m:
            return m.group(1).strip(' "\'')

    # 2. 再看 HTML 前面几 KB 里的 meta
    head_ascii = raw[:8192].decode("ascii", errors="ignore")

    meta_patterns = [
        r'<meta[^>]+charset=["\']?\s*([a-zA-Z0-9_\-]+)',
        r'<meta[^>]+content=["\'][^"\']*charset=([a-zA-Z0-9_\-]+)',
    ]
    for pattern in meta_patterns:
        m = re.search(pattern, head_ascii, re.I)
        if m:
            return m.group(1).lower()

    # 3. BOM
    if raw.startswith(b'\xef\xbb\xbf'):
        return "utf-8-sig"
    if raw.startswith(b'\xff\xfe'):
        return "utf-16le"
    if raw.startswith(b'\xfe\xff'):
        return "utf-16be"

    # 4. 常见旧网页编码兜底
    candidates = [
        "utf-8",
        "euc-kr",
        "cp949",
        "shift_jis",
        "euc-jp",
        "gb18030",
        "gbk",
        "big5",
        "iso-8859-1",
    ]

    for enc in candidates:
        try:
            raw.decode(enc)
            return enc
        except Exception:
            continue

    return "utf-8"


def download_html(timestamp: str, original_url: str) -> tuple[bool, int, str, str, str]:
    archive_url = WAYBACK_URL_TEMPLATE.format(
        timestamp=timestamp,
        original_url=original_url
    )

    req = Request(
        archive_url,
        headers={"User-Agent": "Mozilla/5.0 (WaybackHtmlDownloader/1.0)"}
    )

    try:
        with urlopen(req, timeout=TIMEOUT) as resp:
            status_code = getattr(resp, "status", 200)
            raw = resp.read()
            headers = resp.headers

            encoding = detect_encoding(raw, headers)

            try:
                html = raw.decode(encoding, errors="replace")
            except Exception:
                encoding = "utf-8"
                html = raw.decode("utf-8", errors="replace")

            ok = status_code == 200 and html.strip() != ""
            return ok, status_code, html, encoding, archive_url

    except HTTPError as e:
        return False, e.code, "", "", archive_url
    except URLError:
        return False, 0, "", "", archive_url
    except Exception:
        return False, 0, "", "", archive_url


def main() -> None:
    input_path = Path(INPUT_FILE)
    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"输入文件不存在: {input_path}")

    results = []

    total = 0
    saved = 0
    skipped = 0
    failed = 0

    with input_path.open("r", encoding="utf-8") as f:
        for raw_line in f:
            parsed = parse_line(raw_line)
            if not parsed:
                continue

            total += 1
            timestamp, original_url, status = parsed

            if ONLY_STATUS_200 and status != "200":
                skipped += 1
                results.append({
                    "timestamp": timestamp,
                    "original_url": original_url,
                    "status_in_list": status,
                    "wayback_url": "",
                    "wayback_fetch_status": "",
                    "detected_encoding": "",
                    "saved_file": "",
                    "result": "skipped_non_200"
                })
                continue

            filename = safe_filename(timestamp, original_url)
            save_path = output_dir / filename

            ok, fetch_status, html, encoding, archive_url = download_html(timestamp, original_url)

            if ok:
                # 统一保存为 utf-8
                save_path.write_text(html, encoding="utf-8")
                saved += 1
                results.append({
                    "timestamp": timestamp,
                    "original_url": original_url,
                    "status_in_list": status,
                    "wayback_url": archive_url,
                    "wayback_fetch_status": str(fetch_status),
                    "detected_encoding": encoding,
                    "saved_file": str(save_path),
                    "result": "saved"
                })
                print(f"[OK] {timestamp} -> {save_path.name} | encoding={encoding}")
            else:
                failed += 1
                results.append({
                    "timestamp": timestamp,
                    "original_url": original_url,
                    "status_in_list": status,
                    "wayback_url": archive_url,
                    "wayback_fetch_status": str(fetch_status),
                    "detected_encoding": encoding,
                    "saved_file": "",
                    "result": "failed"
                })
                print(f"[FAIL] {timestamp} -> HTTP {fetch_status}")

            time.sleep(SLEEP_SECONDS)

    csv_path = Path(RESULT_CSV)
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "timestamp",
                "original_url",
                "status_in_list",
                "wayback_url",
                "wayback_fetch_status",
                "detected_encoding",
                "saved_file",
                "result",
            ],
        )
        writer.writeheader()
        writer.writerows(results)

    print("\n===== 完成 =====")
    print(f"总记录数: {total}")
    print(f"已保存:   {saved}")
    print(f"跳过:     {skipped}")
    print(f"失败:     {failed}")
    print(f"HTML目录: {output_dir.resolve()}")
    print(f"结果CSV:  {csv_path.resolve()}")


if __name__ == "__main__":
    main()
