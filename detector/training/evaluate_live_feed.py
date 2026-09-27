"""Evaluates the PKLot-trained classifier (occupancy_classifier.pt) against
real crops from Mater's own live camera. PKLot's 99.96% test accuracy only
proves the model learned the task on PKLot's own cameras/lots -- this checks
whether that actually transfers to a camera it has never seen, which is the
real question after any transfer-learning claim.

Writes an annotated frame (training/live_eval_annotated.jpg) so the model's
predictions can be checked by eye against the same frame.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import torch
import yaml
from PIL import Image
from torchvision import transforms

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.config import SpaceRegion
from detector.spaces import build_space_masks
from detector.video_source import _open_capture

from train_classifier import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD, build_model


def grab_one_frame(source: str):
    cap, _ = _open_capture(source)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise RuntimeError("failed to read a frame from source")
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frame", help="path to a saved frame instead of grabbing a fresh live one")
    parser.add_argument("--out-prefix", default="training/live_eval")
    args = parser.parse_args()

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    checkpoint = torch.load("training/occupancy_classifier.pt", map_location=device, weights_only=False)
    classes = checkpoint["classes"]
    model = build_model(num_classes=len(classes))
    model.load_state_dict(checkpoint["model_state"])
    model.to(device).eval()

    tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    if args.frame:
        frame = cv2.imread(args.frame)
        if frame is None:
            raise RuntimeError(f"could not read {args.frame}")
    else:
        frame = grab_one_frame("https://www.youtube.com/watch?v=4a-3iEM7bHk")
    cv2.imwrite(f"{args.out_prefix}_raw_frame.jpg", frame)

    with open("spaces.yaml") as f:
        raw = yaml.safe_load(f)
    spaces_cfg = [SpaceRegion(**s) for s in raw["spaces"]]
    cached = build_space_masks(spaces_cfg, frame.shape[:2])

    annotated = frame.copy()
    results = {}
    for space in cached:
        x1, y1, x2, y2 = space.bbox
        crop_bgr = frame[y1:y2, x1:x2]
        if crop_bgr.size == 0:
            continue
        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(crop_rgb)
        tensor = tf(pil).unsqueeze(0).to(device)
        with torch.no_grad():
            logits = model(tensor)
            pred_idx = int(logits.argmax(1).item())
            probs = torch.softmax(logits, dim=1)[0]
        pred_label = classes[pred_idx]
        confidence = float(probs[pred_idx].item())
        results[space.label] = (pred_label, confidence)

        color = (0, 0, 255) if pred_label == "occupied" else (0, 255, 255)
        cv2.polylines(annotated, [space.polygon], True, color, 2)
        text = f"P{space.label} {pred_label} {confidence:.2f}"
        cv2.putText(annotated, text, (x1, max(0, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    cv2.imwrite(f"{args.out_prefix}_annotated.jpg", annotated)
    for label, (pred, conf) in sorted(results.items(), key=lambda kv: int(kv[0])):
        print(f"space {label}: {pred} (confidence {conf:.3f})")


if __name__ == "__main__":
    main()
