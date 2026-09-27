"""Fine-tunes the PKLot-trained classifier on hand-labeled disagreement crops
from Mater's own camera (see build_label_sheets.py), mixed with a replay
sample of PKLot so it adapts to this camera without forgetting the general
task.

Scored the honest way: accuracy on the fixed 72-crop hand-labeled eval set
(score_comparison.GROUND_TRUTH) before and after. Those frames are never
trained on. Writes a NEW checkpoint; the base one is never overwritten.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import cv2
import torch
import yaml
from PIL import Image
from torch import nn
from torch.utils.data import ConcatDataset, DataLoader, Dataset
from torchvision import datasets, transforms

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from detector.config import SpaceRegion
from detector.spaces import build_space_masks
from score_comparison import GROUND_TRUTH
from train_classifier import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD, build_model

MIN_LABELED = 50


class LabeledCrops(Dataset):
    def __init__(self, items: list[tuple[Path, int]], transform) -> None:
        self.items, self.transform = items, transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path, label = self.items[i]
        return self.transform(Image.open(path).convert("RGB")), label


def eval_accuracy(model: nn.Module, classes: list[str], device: torch.device, eval_tf) -> float:
    spaces_cfg = [SpaceRegion(**s) for s in yaml.safe_load(open(HERE.parent / "spaces.yaml"))["spaces"]]
    model.eval()
    correct = total = 0
    for frame_name, truth in GROUND_TRUTH.items():
        frame = cv2.imread(str(HERE / "eval_review" / f"{frame_name}.jpg"))
        cached = {s.label: s for s in build_space_masks(spaces_cfg, frame.shape[:2])}
        for label, true_label in truth.items():
            x1, y1, x2, y2 = cached[label].bbox
            crop = Image.fromarray(cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2RGB))
            with torch.no_grad():
                pred = classes[int(model(eval_tf(crop).unsqueeze(0).to(device)).argmax(1))]
            correct += pred == true_label
            total += 1
    return correct / total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=str(HERE / "occupancy_classifier.pt"))
    parser.add_argument("--labels", default=str(HERE / "disagreement_labels.json"))
    parser.add_argument("--crops-dir", default=str(HERE.parent / "disagreement_crops"))
    parser.add_argument("--pklot-dir", default=str(HERE / "pklot_crops" / "train"))
    parser.add_argument("--replay-per-class", type=int, default=2000)
    parser.add_argument("--mater-repeat", type=int, default=10, help="oversample the (small) Mater set")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--out", default=str(HERE / "occupancy_classifier_ft.pt"))
    parser.add_argument("--force", action="store_true", help=f"allow fewer than {MIN_LABELED} labeled crops")
    args = parser.parse_args()

    labels = json.loads(Path(args.labels).read_text())
    if len(labels) < MIN_LABELED and not args.force:
        sys.exit(f"only {len(labels)} labeled crops (< {MIN_LABELED}); fine-tuning on this few would just overfit")

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    checkpoint = torch.load(args.base, map_location="cpu", weights_only=True)
    classes = checkpoint["classes"]
    model = build_model(len(classes))
    model.load_state_dict(checkpoint["model_state"])
    model.to(device)

    train_tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)), transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
        transforms.ToTensor(), transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)), transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    before = eval_accuracy(model, classes, device, eval_tf)
    print(f"held-out Mater eval BEFORE: {before:.1%}")

    mater = [(Path(args.crops_dir) / name, classes.index(lab)) for name, lab in labels.items()]
    rng = random.Random(0)
    replay = []
    for cls in classes:
        files = sorted((Path(args.pklot_dir) / cls).glob("*.jpg"))
        replay += [(f, classes.index(cls)) for f in rng.sample(files, min(args.replay_per_class, len(files)))]
    train_set = ConcatDataset([LabeledCrops(mater * args.mater_repeat, train_tf), LabeledCrops(replay, train_tf)])
    print(f"training on {len(mater)} Mater crops x{args.mater_repeat} + {len(replay)} PKLot replay")

    loader = DataLoader(train_set, batch_size=64, shuffle=True, num_workers=4)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    loss_fn = nn.CrossEntropyLoss()
    for epoch in range(1, args.epochs + 1):
        model.train()
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            opt.zero_grad()
            loss_fn(model(x), y).backward()
            opt.step()
        print(f"epoch {epoch}/{args.epochs}: held-out Mater eval {eval_accuracy(model, classes, device, eval_tf):.1%}")

    after = eval_accuracy(model, classes, device, eval_tf)
    print(f"held-out Mater eval AFTER: {after:.1%} (before {before:.1%})")
    torch.save({"model_state": model.state_dict(), "classes": classes}, args.out)
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
