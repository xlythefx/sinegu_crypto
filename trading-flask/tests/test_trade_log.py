"""Job summary aggregation + trade-log posting."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import binance_abcd.routes.webhook as webhook
import binance_abcd.exchanges as exchanges


def test_summary_counts_and_success_flag(fake_accounts, fake_assets):
    def entry(api, symbol, side, quantity, price):
        if api.api_key == "live-key-1":
            return {"result": {"orderId": 7}, "quantity": quantity}
        if api.api_key == "demo-key-2":
            return {"result": None, "error": "boom"}
        return {"result": {"orderId": 8}, "quantity": quantity}

    def _fake_api(api_key, secret_key, base_url=None):
        instance = MagicMock()
        instance.api_key = api_key
        return instance

    posted = []
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(exchanges, "BinanceAPI", side_effect=_fake_api),
        patch.object(webhook, "handle_entry", side_effect=entry),
        patch.object(webhook.engine_client, "get_json", return_value={"success": True, "positions": []}),
        patch.object(webhook.engine_client, "post_json", side_effect=lambda p, payload, **kw: posted.append((p, payload)) or {"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "BTCUSDT", 60000.0, 20, "VWMA", is_retry=False)

    assert summary["target_count"] == 3
    assert summary["filled"] == 2
    assert summary["failed"] == 1
    assert summary["skipped"] == 0
    assert summary["success"] is False  # any failure -> not a clean signal
    assert summary["category"] == "signal"
    assert summary["action"] == "BUY" and summary["ticker"] == "BTCUSDT"
    assert summary["leverage"] == 20 and summary["strategy"] == "VWMA"

    # The aggregate row went to the engine API's trade-logs endpoint...
    import time
    for _ in range(50):
        if any(path == "trade-logs" for path, _ in posted):
            break
        time.sleep(0.02)
    trade_log_posts = [payload for path, payload in posted if path == "trade-logs"]
    assert len(trade_log_posts) == 1
    assert trade_log_posts[0]["filled"] == 2


def test_local_jsonl_log_is_appended(fake_accounts, fake_assets, tmp_path):
    log_file = tmp_path / "trades.log"
    with (
        patch.object(webhook, "TRADES_LOG", log_file),
        patch.object(webhook, "fetch_accounts", return_value=[]),
        patch.object(webhook, "get_asset", side_effect=lambda t, *a, **k: fake_assets.get(t.upper())),
        patch.object(webhook.engine_client, "post_json", return_value={"success": True}),
    ):
        webhook._process_trade_job("BUY", "BTCUSDT", None, None, None)

    lines = log_file.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert entry["category"] == "rejected"
    assert entry["details"][0]["reason"] == "no_accounts"
    assert "elapsed_s" in entry


def test_rejected_signal_posts_rejection_log(fake_accounts, fake_assets):
    posted = []
    with (
        patch.object(webhook, "fetch_accounts", return_value=fake_accounts),
        patch.object(webhook, "get_asset", return_value=None),
        patch.object(webhook.engine_client, "post_json", side_effect=lambda p, payload, **kw: posted.append((p, payload)) or {"success": True}),
    ):
        summary = webhook._process_trade_job("BUY", "NOPEUSDT", None, None, None)

    assert summary["category"] == "rejected"
    assert summary["success"] is False
