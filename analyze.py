#!/usr/bin/env python3
"""Summarise outages.log written by monitor.sh.

Each outage starts when internet goes DOWN and ends when internet is ok again.
It is classified by what the router did meanwhile:

  REBOOT?   router unreachable for >= 60 s inside the outage (the box restarted;
            confirm with the uptime counter in the router admin page)
  LOCAL     router also unreachable, but < 60 s (Wi-Fi / LAN hiccup, AP roaming)
  ISP       router reachable the whole time, internet down (line / operator side)
  BLIP      short outage (< 10 s), usually lost pings over Wi-Fi

Usage:
  python3 analyze.py [outages.log] [--since "2026-11-18 18:00"]
"""
import argparse
import re
from datetime import datetime, timedelta

LINE = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) router=(ok|DOWN) internet=(ok|DOWN)")


def parse(path, since):
    rows = []
    with open(path) as f:
        for line in f:
            m = LINE.match(line)
            if not m:
                continue
            t = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")
            if since and t < since:
                continue
            rows.append((t, m.group(2) == "ok", m.group(3) == "ok"))
    return rows


def outages(rows):
    events, cur = [], None
    for i, (t, lan, wan) in enumerate(rows):
        nxt = rows[i + 1][0] if i + 1 < len(rows) else None
        if not wan and cur is None:
            cur = {"start": t, "router_down": timedelta(0)}
        if cur is not None and not lan and nxt:
            cur["router_down"] += nxt - t
        if wan and cur is not None:
            cur["end"] = t
            events.append(cur)
            cur = None
    if cur is not None:
        cur["end"] = None
        events.append(cur)
    return events


def router_down_periods(rows, min_s=60):
    """Separate count of router-unreachable periods >= min_s.
    During a reboot loop internet may never come back between reboots, so one
    outage can contain several reboots; this counts them individually."""
    out, start = [], None
    for t, lan, _ in rows:
        if not lan and start is None:
            start = t
        elif lan and start is not None:
            if (t - start).total_seconds() >= min_s:
                out.append((start, t - start))
            start = None
    return out


def kind(e):
    dur = (e["end"] - e["start"]) if e["end"] else None
    if dur is not None and dur < timedelta(seconds=10):
        return "BLIP"
    if e["router_down"] >= timedelta(seconds=60):
        return "REBOOT?"
    if e["router_down"] > timedelta(0):
        return "LOCAL"
    return "ISP"


def fmt(td):
    s = int(td.total_seconds())
    return f"{s // 60}m{s % 60:02d}s"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("log", nargs="?", default="outages.log")
    ap.add_argument("--since", help='e.g. "2026-11-18 18:00"')
    a = ap.parse_args()
    since = datetime.strptime(a.since, "%Y-%m-%d %H:%M") if a.since else None

    rows = parse(a.log, since)
    if not rows:
        print("no data")
        return
    ev = outages(rows)
    counts = {}
    print(f"period: {rows[0][0]}  ->  {rows[-1][0]}\n")
    print(f"{'start':19}  {'duration':>9}  {'router down':>11}  type")
    for e in ev:
        k = kind(e)
        counts[k] = counts.get(k, 0) + 1
        dur = fmt(e["end"] - e["start"]) if e["end"] else "ongoing"
        print(f"{e['start']!s:19}  {dur:>9}  {fmt(e['router_down']):>11}  {k}")
    rd = router_down_periods(rows)
    print(f"\nrouter unreachable >= 60 s (likely reboots): {len(rd)}")
    print("summary:", ", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "no outages")


if __name__ == "__main__":
    main()
