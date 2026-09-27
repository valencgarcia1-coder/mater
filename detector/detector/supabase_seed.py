"""One-time (and safely repeatable) setup: creates the property and camera in
Supabase if they don't exist and syncs spaces.yaml into the spaces table, then
prints the SUPABASE_CAMERA_ID to put in the detector's environment.

  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
    python -m detector.supabase_seed --property "Ski Lot" --camera "Main lot"

Uses the service-role key, so run it from your own machine only.
"""

from __future__ import annotations

import argparse
import os
import sys

import httpx

from detector.config import load_spaces_file


def _headers(key: str, prefer: str | None = None) -> dict:
    h = {"apikey": key, "Content-Type": "application/json"}
    if key.startswith("eyJ"):  # legacy JWT service_role key; sb_secret_* keys go in apikey only
        h["Authorization"] = f"Bearer {key}"
    if prefer:
        h["Prefer"] = prefer
    return h


def _find_or_create(client: httpx.Client, base: str, key: str, table: str, match: dict, create: dict) -> str:
    query = {"select": "id", **{k: f"eq.{v}" for k, v in match.items()}}
    resp = client.get(f"{base}/rest/v1/{table}", headers=_headers(key), params=query)
    resp.raise_for_status()
    rows = resp.json()
    if rows:
        return rows[0]["id"]
    resp = client.post(f"{base}/rest/v1/{table}", headers=_headers(key, "return=representation"), json=create)
    resp.raise_for_status()
    return resp.json()[0]["id"]


def seed(url: str, key: str, property_name: str, camera_name: str, spaces_file: str, timezone: str, address: str | None) -> str:
    spaces = load_spaces_file(spaces_file)
    if not spaces:
        raise SystemExit(f"no valid spaces found in {spaces_file}")
    base = url.rstrip("/")
    with httpx.Client(timeout=15) as client:
        prop_id = _find_or_create(
            client, base, key, "properties", {"name": property_name},
            {"name": property_name, "timezone": timezone, "address": address},
        )
        camera_id = _find_or_create(
            client, base, key, "cameras", {"property_id": prop_id, "name": camera_name},
            {"property_id": prop_id, "name": camera_name},
        )
        rows = [{"camera_id": camera_id, "label": s.label, "zone": s.zone, "polygon": s.polygon} for s in spaces]
        resp = client.post(
            f"{base}/rest/v1/spaces",
            headers=_headers(key, "resolution=merge-duplicates,return=minimal"),
            params={"on_conflict": "camera_id,label"},
            json=rows,
        )
        resp.raise_for_status()
    print(f"synced {len(spaces)} spaces to camera '{camera_name}' of property '{property_name}'")
    return camera_id


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--property", required=True, dest="property_name")
    parser.add_argument("--camera", required=True)
    parser.add_argument("--spaces-file", default="spaces.yaml")
    parser.add_argument("--timezone", default="America/Denver")
    parser.add_argument("--address")
    args = parser.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first")

    camera_id = seed(url, key, args.property_name, args.camera, args.spaces_file, args.timezone, args.address)
    print(f"\nSUPABASE_CAMERA_ID={camera_id}")


if __name__ == "__main__":
    main()
