"""Per-space occupancy classifier inference: crops each configured space out
of the frame and asks the trained MobileNetV3-Small (see training/
train_classifier.py) whether it looks occupied — judging the space's own
pixels, independent of vehicle detection/tracking/geometry.

Preprocessing must match training/train_classifier.py exactly (96x96 resize,
ImageNet normalization) or the model sees inputs it was never trained on.
CPU on purpose: a dozen tiny crops per frame is cheap, and it avoids
sharing an MPS context with the pipeline's own thread.
"""

from __future__ import annotations

import cv2
import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision import transforms
from torchvision.models import mobilenet_v3_small

from detector.spaces import _CachedSpace

IMAGE_SIZE = 96
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


class SpaceClassifier:
    def __init__(self, checkpoint_path: str) -> None:
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
        self._classes: list[str] = checkpoint["classes"]
        self._occupied_index = self._classes.index("occupied")

        model = mobilenet_v3_small(weights=None)
        model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(self._classes))
        model.load_state_dict(checkpoint["model_state"])
        self._model = model.eval()

        self._transform = transforms.Compose([
            transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])

    def predict(self, frame: np.ndarray, spaces: list[_CachedSpace]) -> dict[str, tuple[bool, float]]:
        """{space label: (is_occupied, confidence in that answer)} for every
        space whose crop is non-degenerate."""
        h, w = frame.shape[:2]
        labels: list[str] = []
        tensors: list[torch.Tensor] = []
        for space in spaces:
            x1, y1, x2, y2 = space.bbox
            x1, y1, x2, y2 = max(0, int(x1)), max(0, int(y1)), min(w, int(x2)), min(h, int(y2))
            if x2 <= x1 or y2 <= y1:
                continue
            crop = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2RGB)
            tensors.append(self._transform(Image.fromarray(crop)))
            labels.append(space.label)

        if not tensors:
            return {}

        with torch.no_grad():
            probs = torch.softmax(self._model(torch.stack(tensors)), dim=1)

        results: dict[str, tuple[bool, float]] = {}
        for label, p in zip(labels, probs):
            pred = int(p.argmax().item())
            results[label] = (pred == self._occupied_index, float(p[pred].item()))
        return results
