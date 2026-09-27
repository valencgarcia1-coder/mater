"""Scores both the PKLot-trained classifier and the current geometric
pipeline's core occupancy test (ground-point-in-polygon, single-frame, no
stationary-gating/debouncing since these are isolated frames with no track
history) against a small hand-labeled ground-truth set from Mater's own
camera -- the real comparison step 1-2 asked for, not another spot check.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import torch
import yaml
from PIL import Image
from torchvision import transforms
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from detector.config import VEHICLE_CLASSES, SpaceRegion
from detector.spaces import build_space_masks, is_occupied_by_point

from train_classifier import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD, build_model

# Ground truth, hand-labeled by directly viewing each space's crop (see
# eval_review/sheet_*.jpg) -- not inferred from either system's own output.
GROUND_TRUTH = {
    "day_1": {
        "1": "vacant", "2": "vacant", "3": "vacant", "4": "vacant",
        "5": "occupied", "6": "occupied", "7": "vacant", "8": "vacant",
        "9": "occupied", "10": "occupied", "11": "occupied", "12": "occupied",
    },
    "night_1": {
        "1": "vacant", "2": "vacant", "3": "vacant", "4": "vacant",
        "5": "vacant", "6": "vacant", "7": "occupied", "8": "occupied",
        "9": "occupied", "10": "vacant", "11": "vacant", "12": "vacant",
    },
    "night_2": {
        "1": "vacant", "2": "vacant", "3": "vacant", "4": "vacant",
        "5": "vacant", "6": "vacant", "7": "vacant", "8": "occupied",
        "9": "occupied", "10": "vacant", "11": "vacant", "12": "vacant",
    },
    "fresh_1": {
        "1": "vacant", "2": "vacant", "3": "vacant", "4": "vacant",
        "5": "vacant", "6": "vacant", "7": "occupied", "8": "vacant",
        "9": "occupied", "10": "vacant", "11": "vacant", "12": "vacant",
    },
    "fresh_2": {
        "1": "vacant", "2": "vacant", "3": "vacant", "4": "vacant",
        "5": "vacant", "6": "vacant", "7": "occupied", "8": "vacant",
        "9": "occupied", "10": "vacant", "11": "vacant", "12": "vacant",
    },
    "fresh_3": {
        "1": "vacant", "2": "vacant", "3": "vacant", "4": "vacant",
        "5": "vacant", "6": "vacant", "7": "occupied", "8": "vacant",
        "9": "occupied", "10": "vacant", "11": "vacant", "12": "vacant",
    },
}


def classifier_predictions(model, tf, device, classes, frame, cached_spaces) -> dict[str, str]:
    preds = {}
    for space in cached_spaces:
        x1, y1, x2, y2 = space.bbox
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        pil = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        tensor = tf(pil).unsqueeze(0).to(device)
        with torch.no_grad():
            idx = int(model(tensor).argmax(1).item())
        preds[space.label] = classes[idx]
    return preds


def geometric_predictions(yolo_model, frame, cached_spaces) -> dict[str, str]:
    result = yolo_model(
        frame, classes=list(VEHICLE_CLASSES), conf=0.1, imgsz=1280, iou=0.2, agnostic_nms=True, verbose=False
    )[0]
    ground_points = []
    for box in result.boxes.xyxy.tolist():
        x1, y1, x2, y2 = box
        ground_points.append((float((x1 + x2) / 2), float(y2)))

    preds = {}
    for space in cached_spaces:
        occupied = any(is_occupied_by_point(space, pt) for pt in ground_points)
        preds[space.label] = "occupied" if occupied else "vacant"
    return preds


def main() -> None:
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")

    checkpoint = torch.load("training/occupancy_classifier.pt", map_location=device, weights_only=False)
    classes = checkpoint["classes"]
    clf_model = build_model(num_classes=len(classes))
    clf_model.load_state_dict(checkpoint["model_state"])
    clf_model.to(device).eval()
    tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    yolo_model = YOLO("yolov8s-seg.pt")

    with open("spaces.yaml") as f:
        raw = yaml.safe_load(f)
    spaces_cfg = [SpaceRegion(**s) for s in raw["spaces"]]

    clf_correct = geo_correct = total = 0
    clf_errors, geo_errors = [], []

    for frame_name, truth in GROUND_TRUTH.items():
        frame = cv2.imread(f"training/eval_review/{frame_name}.jpg")
        cached = build_space_masks(spaces_cfg, frame.shape[:2])

        clf_preds = classifier_predictions(clf_model, tf, device, classes, frame, cached)
        geo_preds = geometric_predictions(yolo_model, frame, cached)

        for label, true_label in truth.items():
            total += 1
            clf_pred = clf_preds.get(label)
            geo_pred = geo_preds.get(label)
            if clf_pred == true_label:
                clf_correct += 1
            else:
                clf_errors.append((frame_name, label, true_label, clf_pred))
            if geo_pred == true_label:
                geo_correct += 1
            else:
                geo_errors.append((frame_name, label, true_label, geo_pred))

    print(f"\nTotal labeled crops: {total}")
    print(f"PKLot classifier accuracy: {clf_correct}/{total} = {clf_correct/total:.1%}")
    print(f"Geometric pipeline accuracy (single-frame, no debounce): {geo_correct}/{total} = {geo_correct/total:.1%}")

    print("\nClassifier errors:")
    for frame_name, label, true_label, pred in clf_errors:
        print(f"  {frame_name} P{label}: truth={true_label} predicted={pred}")

    print("\nGeometric pipeline errors:")
    for frame_name, label, true_label, pred in geo_errors:
        print(f"  {frame_name} P{label}: truth={true_label} predicted={pred}")


if __name__ == "__main__":
    main()
