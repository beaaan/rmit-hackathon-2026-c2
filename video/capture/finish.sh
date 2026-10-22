#!/usr/bin/env bash
# Joins the rendered chunks, muxes the soundtrack and exports the submission file.
#   bash capture/finish.sh [soundtrack.wav]
set -euo pipefail
cd "$(dirname "$0")/.."
WAV="${1:-assets/soundtrack.wav}"
printf "file '%s'\n" part-1.mp4 part-2.mp4 part-3.mp4 part-4.mp4 > out/parts.txt
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i out/parts.txt -c copy out/picture.mp4
mkdir -p ../demo
ffmpeg -hide_banner -loglevel error -y -i out/picture.mp4 -i "$WAV" -map 0:v -map 1:a \
  -vf "scale=in_range=pc:out_range=tv" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 192k -ar 48000 -t 107.5 -movflags +faststart ../demo/demo.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 ../demo/demo.mp4
