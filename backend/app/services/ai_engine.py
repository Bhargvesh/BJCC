"""Rule-based + statistical AI helpers (duplicates, spikes, optional IsolationForest)."""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from typing import Any, Dict, List, Tuple

VALID_CATEGORIES = [
    "roads",
    "water_supply",
    "electricity",
    "sanitation",
    "hospital",
    "traffic",
    "education",
    "public_transport",
    "other",
]

# Multilingual keyword hints (romanized / English — extend for demo)
KEYWORD_CATEGORY: List[Tuple[str, str]] = [
    (r"road|pothole|street|bridge|highway|سڑک|सड़क", "roads"),
    (r"water|tap|pipeline|supply|نل|पानी|jal", "water_supply"),
    (r"electric|power|blackout|transformer|بجلی|बिजली", "electricity"),
    (r"garbage|waste|drain|sewage|toilet|safai|کچرا", "sanitation"),
    (r"hospital|doctor|ambulance|clinic|صحت|अस्पताल", "hospital"),
    (r"traffic|signal|jam|parking|گاڑی", "traffic"),
    (r"school|education|teacher|کتاب|स्कूल", "education"),
    (r"bus|transport|route|گاڑی|بس", "public_transport"),
]

URGENT = r"accident|emergency|fire|collapsed|death|hospital|no water|no electricity|بجلی نہیں|پانی نہیں"
MEDIUM = r"pothole|garbage|drain|delay|leak|broken|light"


def normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower().strip())


def rule_classify(text: str) -> Dict[str, Any]:
    """Fast offline classification for Hindi/Urdu/English hints."""
    t = normalize_text(text)
    cat = "other"
    for pattern, c in KEYWORD_CATEGORY:
        if re.search(pattern, t, re.I):
            cat = c
            break
    if re.search(URGENT, t, re.I):
        sev = "high"
    elif re.search(MEDIUM, t, re.I):
        sev = "medium"
    else:
        sev = "low"
    lang = "en"
    if re.search(r"[\u0600-\u06FF]", text or ""):
        lang = "ur"
    elif re.search(r"[\u0900-\u097F]", text or ""):
        lang = "hi"
    return {
        "category": cat,
        "severity_hint": sev,
        "language_guess": lang,
        "method": "rules",
    }


def severity_to_priority(hint: str) -> str:
    h = (hint or "low").lower()
    if h in ("critical", "high"):
        return "red"
    if h == "medium":
        return "yellow"
    return "green"


def merge_priority(a: str, b: str) -> str:
    order = {"green": 0, "yellow": 1, "red": 2}
    return a if order.get(a, 0) >= order.get(b, 0) else b


def find_duplicates(
    complaints: List[Dict],
    title: str,
    description: str,
    district: str,
    threshold: float = 0.52,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    blob = normalize_text(f"{title} {description}")
    if len(blob) < 12:
        return []
    out: List[Dict[str, Any]] = []
    for c in complaints:
        if c.get("district", "").lower() != district.lower():
            continue
        other = normalize_text(f"{c.get('title', '')} {c.get('description', '')}")
        if len(other) < 8:
            continue
        ratio = SequenceMatcher(None, blob, other).ratio()
        if ratio >= threshold:
            out.append(
                {
                    "ticket_id": c["ticket_id"],
                    "similarity": round(ratio, 3),
                    "title": c.get("title", "")[:80],
                }
            )
    out.sort(key=lambda x: -x["similarity"])
    return out[:limit]


def _parse_ts(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(tzinfo=None)


def district_spike_alerts(complaints: List[Dict]) -> List[Dict[str, Any]]:
    """Statistical spike: last 24h vs rolling daily average (7d)."""
    now = datetime.utcnow()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    by_district_day: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    count_24h: Dict[str, int] = defaultdict(int)

    for c in complaints:
        try:
            ts = _parse_ts(c["created_at"])
        except Exception:
            continue
        d = c.get("district", "")
        if ts >= day_ago:
            count_24h[d] += 1
        if ts >= week_ago:
            day_key = ts.strftime("%Y-%m-%d")
            by_district_day[d][day_key] += 1

    alerts = []
    for district, n24 in count_24h.items():
        daily_counts = list(by_district_day[district].values())
        if not daily_counts:
            continue
        avg = sum(daily_counts) / max(len(daily_counts), 1)
        # spike if 24h count clearly above typical daily load
        if n24 >= 3 and n24 >= avg * 1.8 + 1:
            alerts.append(
                {
                    "district": district,
                    "type": "volume_spike",
                    "count_24h": n24,
                    "avg_daily_week": round(avg, 2),
                    "message": f"Unusual complaint volume in {district} in the last 24 hours.",
                }
            )
    return sorted(alerts, key=lambda x: -x["count_24h"])


def isolation_anomaly_scores(complaints: List[Dict]) -> List[Dict[str, Any]]:
    """Optional sklearn IsolationForest on per-district feature vectors."""
    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest
    except Exception:
        return []

    now = datetime.utcnow()
    districts = sorted({c.get("district", "") for c in complaints if c.get("district")})
    if len(districts) < 3 or len(complaints) < 8:
        return []

    rows = []
    labels = []
    for d in districts:
        c24 = c72 = c7 = cat_n = 0
        cats = set()
        for c in complaints:
            if c.get("district") != d:
                continue
            try:
                ts = _parse_ts(c["created_at"])
            except Exception:
                continue
            if (now - ts).total_seconds() <= 86400:
                c24 += 1
            if (now - ts).total_seconds() <= 259200:
                c72 += 1
            if (now - ts).total_seconds() <= 604800:
                c7 += 1
            cats.add(c.get("category", "other"))
        cat_n = len(cats)
        rows.append([c24, c72, c7, cat_n])
        labels.append(d)

    X = np.array(rows, dtype=float)
    if X.shape[0] < 4:
        return []

    clf = IsolationForest(random_state=42, contamination=0.15)
    clf.fit(X)
    scores = clf.decision_function(X)
    pred = clf.predict(X)

    out = []
    for i, d in enumerate(labels):
        if pred[i] == -1:
            out.append(
                {
                    "district": d,
                    "type": "isolation_forest",
                    "anomaly_score": round(float(scores[i]), 4),
                    "message": f"ML anomaly pattern detected for {d} (Isolation Forest).",
                }
            )
    return out
