#!/usr/bin/env bash
# Logs connectivity state changes: router (LAN) vs internet (WAN).
# Only changes are written, so the log stays small even after days of running.
#
# Usage:
#   ./monitor.sh                      # gateway 192.168.1.1, log to ./outages.log
#   GATEWAY=192.168.0.1 LOG=/tmp/net.log INTERVAL=2 ./monitor.sh
#
# Run it in the background:
#   nohup ./monitor.sh >/dev/null 2>&1 &
#
# Log format:  2026-11-18 15:52:44 router=DOWN internet=DOWN

GATEWAY="${GATEWAY:-192.168.1.1}"
TARGETS="${TARGETS:-8.8.8.8 1.1.1.1}"
INTERVAL="${INTERVAL:-2}"
LOG="${LOG:-$(cd "$(dirname "$0")" && pwd)/outages.log}"

# ping timeout flag differs: macOS/BSD uses -t, Linux uses -W
if [[ "$(uname)" == "Darwin" ]]; then TO=(-t 1); else TO=(-W 1); fi

up() { ping -c 1 "${TO[@]}" "$1" >/dev/null 2>&1; }

prev=""
while true; do
  up "$GATEWAY" && lan=ok || lan=DOWN
  wan=DOWN
  for t in $TARGETS; do up "$t" && { wan=ok; break; }; done
  state="router=$lan internet=$wan"
  if [[ "$state" != "$prev" ]]; then
    echo "$(date '+%F %T') $state" >> "$LOG"
    prev="$state"
  fi
  sleep "$INTERVAL"
done
