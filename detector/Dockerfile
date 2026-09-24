FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY detector ./detector

RUN pip install --no-cache-dir .

ENTRYPOINT ["python", "-m", "detector"]
