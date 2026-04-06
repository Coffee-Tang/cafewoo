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
SLEEP_SECONDS = 0.3

# 关键：用普通 Wayback URL，不用 id_
WAYBACK_URL_TEMPLATE = "https://web.archive.org/web/{timestamp}/{original_url}"


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


def build_wayback_url(timestamp: str, original_url: str) -> str:
    return WAYBACK_URL_TEMPLATE.format(
        timestamp=timestamp,
        original_url=original_url
    )


def download_raw(url: str) -> tuple[bool, int, bytes]:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urlopen(req, timeout=TIMEOUT) as resp:
            status_code = getattr(resp, "status", 200)
            raw = resp.read()
            ok = status_code == 200 and len(raw) > 0
            return ok, status_code, raw
    except HTTPError as e:
        return False, e.code, b""
    except URLError:
        return False, 0, b""
    except Exception:
        return False, 0, b""


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
                    "fetch_status": "",
                    "saved_file": "",
                    "result": "skipped_non_200",
                })
                continue

            wayback_url = build_wayback_url(timestamp, original_url)
            filename = safe_filename(timestamp, original_url)
            save_path = output_dir / filename

            ok, fetch_status, raw_bytes = download_raw(wayback_url)

            if ok:
                save_path.write_bytes(raw_bytes)
                saved += 1
                result = "saved"
                print(f"[OK] {filename}")
            else:
                failed += 1
                result = "failed"
                print(f"[FAIL] {timestamp} -> HTTP {fetch_status}")

            results.append({
                "timestamp": timestamp,
                "original_url": original_url,
                "status_in_list": status,
                "wayback_url": wayback_url,
                "fetch_status": str(fetch_status),
                "saved_file": str(save_path) if ok else "",
                "result": result,
            })

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
                "fetch_status",
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
