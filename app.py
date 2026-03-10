"""
Crisis Pulse — Backend API
==========================
Flask app that wraps pytrends and serves Google Trends data
to the React dashboard. Deploy free on Render.com.

Endpoints:
  GET /api/trends?markets=AE,SA,KW,QA&days=7
  GET /api/health
"""

import time
import logging
from datetime import datetime
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from pytrends.request import TrendReq

# ── Setup ────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)  # Allow requests from any origin (StackBlitz / Vercel frontend)

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    return response
# ── Config ───────────────────────────────────────────────────────────────────

MARKET_NAMES: dict[str, str] = {
    "AE": "UAE",
    "SA": "KSA",
    "KW": "Kuwait",
    "QA": "Qatar",
}

KEYWORD_GROUPS: dict[str, list[str]] = {
    "gaming":    ["gaming"],
    "wellness":  ["wellness"],
    "news":      ["news"],
    "cheap":     ["cheap"],
    "delivery":  ["delivery"],
}

SLEEP_SECS = 6        # between pytrends calls — respect rate limits
CACHE_TTL  = 3600     # seconds — re-use last pull for 1 hour


# ── Simple in-memory cache ───────────────────────────────────────────────────

_cache: dict[str, Any] = {}


def cache_key(markets: list[str], days: int) -> str:
    return f"{'_'.join(sorted(markets))}_{days}d"


def is_cache_valid(key: str) -> bool:
    if key not in _cache:
        return False
    age = (datetime.utcnow() - _cache[key]["fetched_at"]).total_seconds()
    return age < CACHE_TTL


# ── Trend puller ─────────────────────────────────────────────────────────────

def pull_signal(
    client: TrendReq,
    keyword: str,
    geo: str,
    timeframe: str,
) -> list[float] | None:
    """Pull a single keyword for one geo. Returns daily averages or None on error."""
    try:
        client.build_payload([keyword], timeframe=timeframe, geo=geo)
        df = client.interest_over_time()
        if df.empty:
            return None
        daily = df[[keyword]].resample("D").mean().round(1)
        return daily[keyword].tolist()
    except Exception as e:
        logger.warning(f"pytrends error [{geo}][{keyword}]: {e}")
        return None


def fetch_trends(markets: list[str], days: int) -> dict:
    """Pull all signals for all requested markets. Returns structured dict."""
    client = TrendReq(hl="en-US", tz=180, timeout=(15, 30))
    timeframe = f"now {days}-d"

    result: dict[str, Any] = {
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "markets": {},
    }

    dates_set = False

    for geo_code in markets:
        market_name = MARKET_NAMES.get(geo_code, geo_code)
        logger.info(f"Pulling {market_name} ({geo_code})...")
        result["markets"][market_name] = {}

        for signal, keywords in KEYWORD_GROUPS.items():
            time.sleep(SLEEP_SECS)
            values = pull_signal(client, keywords[0], geo_code, timeframe)

            if values is not None:
                result["markets"][market_name][signal] = values
                logger.info(f"  ✓ {signal}: {len(values)} days")

                # Capture dates once
                if not dates_set:
                    try:
                        client.build_payload(keywords, timeframe=timeframe, geo=geo_code)
                        df = client.interest_over_time()
                        if not df.empty:
                            daily = df.resample("D").mean()
                            result["dates"] = [
                                d.strftime("%b %d") for d in daily.index
                            ]
                            dates_set = True
                    except Exception:
                        pass
            else:
                logger.warning(f"  ✗ {signal}: no data")

        time.sleep(10)  # extra pause between markets

    return result


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"})


@app.get("/api/trends")
def trends():
    # Parse query params
    markets_param = request.args.get("markets", "AE,SA,KW,QA")
    days_param = int(request.args.get("days", 7))
    force_refresh = request.args.get("refresh", "false").lower() == "true"

    markets = [m.strip().upper() for m in markets_param.split(",") if m.strip() in MARKET_NAMES]
    if not markets:
        return jsonify({"error": "No valid market codes provided. Use AE, SA, KW, QA."}), 400

    days = max(1, min(days_param, 7))  # clamp to 1–7 (pytrends daily limit)
    key = cache_key(markets, days)

    # Serve from cache if fresh
    if not force_refresh and is_cache_valid(key):
        logger.info(f"Cache hit for {key}")
        data = _cache[key]["data"]
        data["cached"] = True
        return jsonify(data)

    # Pull fresh data
    logger.info(f"Fresh pull for {key}")
    try:
        data = fetch_trends(markets, days)
        _cache[key] = {"data": data, "fetched_at": datetime.utcnow()}
        data["cached"] = False
        return jsonify(data)
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        return jsonify({"error": str(e)}), 500


# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
