"""Tests for CafeWoo BBS HTML parser."""

import os
import pytest
from datetime import datetime
from parse_html import strip_wayback, extract_metadata, parse_page, PostData, ReplyData

# Paths to test files
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE_BOARD3 = os.path.join(BASE_DIR, "downloaded_html",
                           "20020112070614_bbsid_100238_board_3_c98688b68e.html")
FILE_BOARD11 = os.path.join(BASE_DIR, "downloaded_html",
                            "20020424210428_bbsid_102743_board_11_467a0850b6.html")


@pytest.fixture
def raw_board3():
    with open(FILE_BOARD3, "rb") as f:
        return f.read()


@pytest.fixture
def cleaned_board3(raw_board3):
    return strip_wayback(raw_board3)


@pytest.fixture
def post_board3(cleaned_board3):
    return parse_page(cleaned_board3)


@pytest.fixture
def raw_board11():
    with open(FILE_BOARD11, "rb") as f:
        return f.read()


@pytest.fixture
def cleaned_board11(raw_board11):
    return strip_wayback(raw_board11)


@pytest.fixture
def post_board11(cleaned_board11):
    return parse_page(cleaned_board11)


# ---- strip_wayback tests ----

class TestStripWayback:
    def test_removes_wayback_toolbar(self, cleaned_board3):
        assert "WAYBACK TOOLBAR" not in cleaned_board3
        assert "BEGIN WAYBACK TOOLBAR INSERT" not in cleaned_board3
        assert "END WAYBACK TOOLBAR INSERT" not in cleaned_board3

    def test_removes_wayback_js(self, cleaned_board3):
        assert "__wm.rw(" not in cleaned_board3
        assert "__wm.init(" not in cleaned_board3
        assert "__wm.bt(" not in cleaned_board3
        assert "archive_analytics" not in cleaned_board3

    def test_removes_trailing_archive_comments(self, cleaned_board3):
        assert "FILE ARCHIVED ON" not in cleaned_board3
        assert "playback timings" not in cleaned_board3

    def test_removes_wayback_url_rewrites(self, cleaned_board3):
        assert "/web/20020112070614im_/" not in cleaned_board3

    def test_keeps_real_content(self, cleaned_board3):
        # Title row should survive
        assert "One more cup of Coffee" in cleaned_board3
        # Author should survive
        assert "LuDo" in cleaned_board3
        # Post body content should survive
        assert "DuoDuo.Love" in cleaned_board3

    def test_keeps_html_structure(self, cleaned_board3):
        assert '<tr bgcolor="#C6E2FF">' in cleaned_board3
        assert '<tr bgcolor="#E6E6E6">' in cleaned_board3


# ---- extract_metadata tests ----

class TestExtractMetadata:
    def test_parses_board3_filename(self):
        meta = extract_metadata("20020112070614_bbsid_100238_board_3_c98688b68e.html")
        assert meta["wayback_ts"] == "20020112070614"
        assert meta["bbsid"] == 100238
        assert meta["board_id"] == 3

    def test_parses_board11_filename(self):
        meta = extract_metadata("20020424210428_bbsid_102743_board_11_467a0850b6.html")
        assert meta["wayback_ts"] == "20020424210428"
        assert meta["bbsid"] == 102743
        assert meta["board_id"] == 11

    def test_raises_on_bad_filename(self):
        with pytest.raises(ValueError):
            extract_metadata("garbage.html")

    def test_raises_on_missing_parts(self):
        with pytest.raises(ValueError):
            extract_metadata("20020112070614_bbsid_100238.html")


# ---- parse_page title tests ----

class TestParsePageTitle:
    def test_extracts_title_board3(self, post_board3):
        assert post_board3.title == "One more cup of Coffee"

    def test_extracts_title_board11(self, post_board11):
        assert post_board11.title is not None
        assert "域名" in post_board11.title


# ---- parse_page main post tests ----

class TestParsePageMainPost:
    def test_main_author(self, post_board3):
        assert post_board3.author == "LuDo"

    def test_main_timestamp(self, post_board3):
        assert post_board3.posted_at == datetime(2001, 4, 30, 12, 41, 0)

    def test_main_content_contains_text(self, post_board3):
        assert "空气很闷" in post_board3.content_text

    def test_main_signature(self, post_board3):
        assert post_board3.signature == "DuoDuo.Love"

    def test_content_text_is_plain(self, post_board3):
        # Should not contain HTML tags
        assert "<br>" not in post_board3.content_text
        assert "<font" not in post_board3.content_text

    def test_content_html_excludes_timestamp(self, post_board3):
        # Cleaned content HTML should not include the timestamp span
        assert "font-size: 9pt" not in post_board3.content

    def test_content_html_excludes_signature(self, post_board3):
        # Cleaned content HTML should not include the signature block
        assert "DuoDuo.Love" not in post_board3.content


# ---- parse_page replies tests ----

class TestParsePageReplies:
    def test_reply_count(self, post_board3):
        assert len(post_board3.replies) == 5

    def test_reply_authors(self, post_board3):
        expected = ["多多", "grassgirl", "回声", "昔日重来", "worrysun"]
        actual = [r.author for r in post_board3.replies]
        assert actual == expected

    def test_reply_sort_order(self, post_board3):
        orders = [r.sort_order for r in post_board3.replies]
        assert orders == [1, 2, 3, 4, 5]

    def test_first_reply_timestamp(self, post_board3):
        assert post_board3.replies[0].posted_at == datetime(2001, 4, 30, 21, 5, 0)

    def test_reply_with_signature(self, post_board3):
        # worrysun (last reply) has a signature
        worrysun = post_board3.replies[4]
        assert worrysun.signature is not None
        assert len(worrysun.signature) > 0

    def test_reply_without_signature(self, post_board3):
        # 多多 (first reply) has no signature
        assert post_board3.replies[0].signature is None


# ---- board_11 domain voting post tests ----

class TestBoard11DomainPost:
    def test_author_is_ludo(self, post_board11):
        assert post_board11.author == "LuDo"

    def test_has_70_replies(self, post_board11):
        assert len(post_board11.replies) == 70

    def test_main_timestamp(self, post_board11):
        assert post_board11.posted_at == datetime(2001, 5, 18, 16, 34, 0)

    def test_content_mentions_cafewoo(self, post_board11):
        assert "cafewoo" in post_board11.content_text.lower()

    def test_dataclass_types(self, post_board11):
        assert isinstance(post_board11, PostData)
        assert isinstance(post_board11.replies[0], ReplyData)
