"""CLI entry point: python -m detector <source> [options]

Examples:
  python -m detector path/to/clip.mp4 --output out.mp4
  python -m detector "https://www.youtube.com/watch?v=4a-3iEM7bHk" --output brighton.mp4 --duration 30
  python -m detector --config detector/config.example.yaml --output out.mp4
"""

from __future__ import annotations

import argparse
import logging

from detector.config import CameraConfig
from detector.pipeline import run


def main() -> None:
    parser = argparse.ArgumentParser(description="Mater detector — M1 skeleton")
    parser.add_argument("source", nargs="?", help="video file path, RTSP URL, or YouTube URL")
    parser.add_argument("--config", help="path to a camera config YAML (overrides other flags except source)")
    parser.add_argument("--output", default="output.mp4", help="path to write the annotated video")
    parser.add_argument("--fps", type=int, default=5, help="target processing frame rate")
    parser.add_argument("--conf", type=float, default=0.4, help="detection confidence threshold")
    parser.add_argument("--model", default="yolov8n.pt", help="Ultralytics YOLO weights")
    parser.add_argument("--duration", type=float, default=None, help="stop after N seconds (useful for streams)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING)

    if args.config:
        config = CameraConfig.from_yaml(args.config)
        if args.source:
            config.source = args.source
    else:
        if not args.source:
            parser.error("source is required unless --config is given")
        config = CameraConfig(
            source=args.source,
            fps=args.fps,
            confidence=args.conf,
            model=args.model,
        )

    frame_count = run(config, args.output, duration_seconds=args.duration)
    print(f"wrote {frame_count} frames to {args.output}")


if __name__ == "__main__":
    main()
