"""Trains a small per-space occupancy classifier on PKLot crops (see
extract_crops.py) -- the same technique Amato et al.'s CNRPark-EXT/PKLot
research uses: a compact CNN that looks directly at a space's own cropped
pixels and answers occupied/empty, instead of inferring occupancy from a
detected vehicle's box/mask geometry the way the live detector pipeline
does today.

MobileNetV3-Small (ImageNet-pretrained, fine-tuned here) is the "small
model" from the plan discussed earlier -- small enough to run locally
alongside the live YOLO inference once trained, with a real pretrained
visual backbone instead of training a CNN from scratch on a comparatively
small dataset.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

IMAGE_SIZE = 96
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def build_model(num_classes: int = 2) -> nn.Module:
    model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


def build_dataloaders(crops_dir: Path, batch_size: int) -> tuple[DataLoader, DataLoader, DataLoader, list[str]]:
    train_tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    train_ds = datasets.ImageFolder(crops_dir / "train", transform=train_tf)
    val_ds = datasets.ImageFolder(crops_dir / "val", transform=eval_tf)
    test_ds = datasets.ImageFolder(crops_dir / "test", transform=eval_tf)

    # ImageFolder assigns class indices alphabetically per split -- verify
    # all three splits agree before training on one and evaluating on
    # another, or "occupied"/"vacant" could silently swap meaning.
    assert train_ds.classes == val_ds.classes == test_ds.classes, (
        f"class order mismatch across splits: {train_ds.classes} vs {val_ds.classes} vs {test_ds.classes}"
    )

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=4)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=4)
    return train_loader, val_loader, test_loader, train_ds.classes


def run_epoch(model: nn.Module, loader: DataLoader, device: torch.device, optimizer=None) -> tuple[float, float]:
    is_train = optimizer is not None
    model.train(is_train)
    total_loss, correct, total = 0.0, 0, 0
    criterion = nn.CrossEntropyLoss()

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        with torch.set_grad_enabled(is_train):
            outputs = model(images)
            loss = criterion(outputs, labels)
            if is_train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

        total_loss += loss.item() * images.size(0)
        correct += (outputs.argmax(1) == labels).sum().item()
        total += images.size(0)

    return total_loss / total, correct / total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crops-dir", default="training/pklot_crops")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--out", default="training/occupancy_classifier.pt")
    args = parser.parse_args()

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"training on device: {device}")

    train_loader, val_loader, test_loader, classes = build_dataloaders(Path(args.crops_dir), args.batch_size)
    print(f"classes (index order): {classes}")
    print(f"train/val/test sizes: {len(train_loader.dataset)}/{len(val_loader.dataset)}/{len(test_loader.dataset)}")

    model = build_model(num_classes=len(classes)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    best_val_acc = 0.0
    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss, train_acc = run_epoch(model, train_loader, device, optimizer)
        val_loss, val_acc = run_epoch(model, val_loader, device)
        print(
            f"epoch {epoch}/{args.epochs} "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f} "
            f"({time.time() - t0:.0f}s)"
        )
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({"model_state": model.state_dict(), "classes": classes}, args.out)
            print(f"  -> new best, saved to {args.out}")

    # Final, honest number: evaluate the BEST checkpoint (not just whatever
    # the last epoch happened to leave in memory) against the held-out test
    # split, which neither training nor the epoch-by-epoch model-selection
    # above ever touched.
    checkpoint = torch.load(args.out, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state"])
    test_loss, test_acc = run_epoch(model, test_loader, device)
    print(f"\nFINAL held-out test accuracy: {test_acc:.4f} (loss {test_loss:.4f})")


if __name__ == "__main__":
    main()
