// Thin client for the detector's Flask server (detector/detector/server.py).
// There is no product backend yet — this dashboard talks directly to the
// detection/rule-evaluation engine while that's the only real data source.
// Swapping this for a real backend later means changing this file only.

export const DETECTOR_URL =
  process.env.NEXT_PUBLIC_DETECTOR_URL ?? "http://127.0.0.1:5050";

export type SpaceState =
  | "empty"
  | "arriving"
  | "parked"
  | "violation"
  | "tow_eligible";

export type Zone = "standard" | "fire_lane" | "handicap" | "loading_zone";

export interface SpaceStatus {
  zone: Zone;
  state: SpaceState;
  elapsed: number | null;
}

export type SpacesStatus = Record<string, SpaceStatus>;

export interface DetectorStatus {
  active_tracks: number;
  frames_processed: number;
  fps_estimate: number;
}

export interface DetectorEvent {
  event: string;
  space: string;
  zone: Zone;
  detected_at: string;
  stationary_duration: number | null;
}

export interface Space {
  label: string;
  polygon: number[][];
  zone: Zone;
}

export interface Toggles {
  show_vehicles: boolean;
  show_spaces: boolean;
  read_plates: boolean;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${DETECTOR_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DETECTOR_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getStatus(): Promise<DetectorStatus> {
  return getJSON<DetectorStatus>("/status");
}

export async function getSpacesStatus(): Promise<SpacesStatus> {
  const data = await getJSON<{ spaces: SpacesStatus }>("/api/spaces/status");
  return data.spaces;
}

export async function getEvents(limit = 20): Promise<DetectorEvent[]> {
  const data = await getJSON<{ events: DetectorEvent[] }>(
    `/api/events?limit=${limit}`,
  );
  return data.events;
}

export function streamUrl(): string {
  return `${DETECTOR_URL}/stream`;
}

export async function getSpaces(): Promise<Space[]> {
  const data = await getJSON<{ spaces: Space[] }>("/api/spaces");
  return data.spaces;
}

// Replaces the whole space list on the running detector — applies live, no
// restart, since the Flask side already calls pipeline.set_spaces() on save.
export function saveSpaces(spaces: Space[]): Promise<{ ok: boolean; count: number }> {
  return postJSON("/api/spaces", { spaces });
}

export function getToggles(): Promise<Toggles> {
  return getJSON<Toggles>("/api/toggles");
}

export function setToggle(
  key: keyof Toggles,
  value: boolean,
): Promise<Toggles> {
  return postJSON<Toggles>("/api/toggles", { [key]: value });
}
