const EPHEMERIS_URL = process.env.EPHEMERIS_SERVICE_URL ?? "http://localhost:8000";
const TIMEOUT_MS = 20_000; // 20 seconds max per call

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function post(path: string, body: unknown) {
  let res: Response;
  try {
    res = await fetch(`${EPHEMERIS_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: withTimeout(TIMEOUT_MS),
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(
        `Ephemeris service timed out after ${TIMEOUT_MS / 1000}s. ` +
        `Make sure the Python service is running: cd python-service && uvicorn main:app --port 8000`
      );
    }
    throw new Error(
      `Cannot reach ephemeris service at ${EPHEMERIS_URL}. ` +
      `Start it with: cd python-service && uvicorn main:app --port 8000`
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ephemeris error (${res.status}): ${text}`);
  }
  return res.json();
}

export interface ChartRequest {
  name: string; year: number; month: number; day: number;
  hour: number; minute: number; lat: number; lng: number; tz_str: string;
}

export interface DashaRequest {
  moon_abs_pos: number;
  birth_year: number; birth_month: number; birth_day: number;
}

export interface TransitRequest {
  natal_asc_sign_num: number;
  tz_str?: string;
}

export async function fetchChart(req: ChartRequest) {
  return post("/calculate", req);
}

export async function fetchDashas(req: DashaRequest) {
  return post("/dasha", req);
}

export async function fetchTransits(req: TransitRequest) {
  return post("/transits", req);
}

export async function checkEphemerisHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${EPHEMERIS_URL}/health`, {
      signal: withTimeout(3_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
