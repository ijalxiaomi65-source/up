#!/usr/bin/env bash

set -euo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
yt_dlp="$script_dir/../node_modules/@distube/yt-dlp/bin/yt-dlp"
filtered_args=()

for arg in "$@"; do
    case "$arg" in
        --no-call-home|--no-call-home=true)
            ;;
        *)
            filtered_args+=("$arg")
            ;;
    esac
done

exec "$yt_dlp" "${filtered_args[@]}"