#!/bin/sh
# Stops what up.sh started, by port
for port in 3200 55500 55600; do
  for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null; done
done
sleep 2
