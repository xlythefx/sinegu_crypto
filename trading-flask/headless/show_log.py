#!/usr/bin/env python3
"""Tail a log file. Usage: python headless/show_log.py <log_file_path> [title]"""

import os
import sys
import time


def main():
    if len(sys.argv) < 2:
        print("Usage: python headless/show_log.py <log_file_path> [title]", file=sys.stderr)
        sys.exit(1)
    logpath = os.path.abspath(sys.argv[1])
    title = sys.argv[2] if len(sys.argv) > 2 else "Log"
    if not os.path.isfile(logpath):
        print(f"Log file not found: {logpath}", file=sys.stderr)
        print("Waiting for it to be created...")
        while not os.path.isfile(logpath):
            time.sleep(0.5)
    print(f"[{title}] Tailing: {logpath}")
    print("-" * 60)
    with open(logpath, "r", encoding="utf-8", errors="replace") as f:
        f.seek(0, 2)
        while True:
            line = f.readline()
            if line:
                print(line, end="")
            else:
                time.sleep(0.2)


if __name__ == "__main__":
    main()
