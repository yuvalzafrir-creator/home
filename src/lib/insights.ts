// Live "location insights" from Israel's open government data (data.gov.il /
// CBS). Legal, key-less, public open data — unlike commercial listing sites.
// Responses are cached for a day (these datasets refresh rarely), so the
// dashboard stays current without hammering the API.

export interface LocalityInsight {
  query: string; // what the user typed (their profile location)
  name: string | null; // matched official locality name (LocNameHeb)
  localityCode: number | null; // CBS locality symbol — the cross-dataset key
  population: number | null;
  households: number | null;
  avgHouseholdSize: number | null;
  socioeconomicCluster: number | null; // אשכול 1–10 (higher = higher SES)
  recordedOffenses: number | null; // police-recorded offenses in CRIME_YEAR
}

export const CRIME_YEAR = 2022;

const CKAN = "https://data.gov.il/api/3/action/datastore_search";
// 2022 census — population & households by locality (includes cities).
const POPULATION_RESOURCE = "38207cf8-afe2-48ed-a3b0-c8f70c796015";
// Socioeconomic cluster (אשכול 2019) by locality symbol.
const SES_RESOURCE = "7c860e04-9f8d-41c2-9f24-6249958d2081";
// Police-recorded offenses (one row per case) for CRIME_YEAR, keyed by YeshuvKod.
const CRIME_RESOURCE = "a59f3e9e-a7fe-4375-97d0-76cea68382c1";

const DAY = 60 * 60 * 24;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // data.gov.il often returns numbers as comma-grouped strings, e.g. "492,872".
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

interface CkanRecord {
  [key: string]: unknown;
}

async function ckanSearch(params: string): Promise<CkanRecord[]> {
  const res = await fetch(`${CKAN}?${params}`, {
    next: { revalidate: DAY },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { result?: { records?: CkanRecord[] } };
  return json?.result?.records ?? [];
}

// Returns just the total row count matching a query (used with limit=0).
async function ckanCount(params: string): Promise<number | null> {
  const res = await fetch(`${CKAN}?${params}`, {
    next: { revalidate: DAY },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { total?: number } };
  return typeof json?.result?.total === "number" ? json.result.total : null;
}

function empty(query: string): LocalityInsight {
  return {
    query,
    name: null,
    localityCode: null,
    population: null,
    households: null,
    avgHouseholdSize: null,
    socioeconomicCluster: null,
    recordedOffenses: null,
  };
}

export async function getLocalityInsight(query: string): Promise<LocalityInsight> {
  const trimmed = query.trim();
  if (!trimmed) return empty(query);

  try {
    const popRecords = await ckanSearch(
      `resource_id=${POPULATION_RESOURCE}&q=${encodeURIComponent(trimmed)}&limit=1`
    );
    const rec = popRecords[0];
    if (!rec) return empty(query);

    const insight: LocalityInsight = {
      query,
      name: rec.LocNameHeb ? String(rec.LocNameHeb).trim() : null,
      localityCode: toNum(rec.LocalityCode),
      population: toNum(rec.Total_Population),
      households: toNum(rec.Households),
      avgHouseholdSize: toNum(rec.Average_size_of_household),
      socioeconomicCluster: null,
      recordedOffenses: null,
    };

    if (insight.localityCode !== null) {
      // Both keyed on the CBS locality symbol; each best-effort (null on failure).
      const [ses, offenses] = await Promise.all([
        ckanSearch(
          `resource_id=${SES_RESOURCE}&filters=${encodeURIComponent(
            JSON.stringify({ "LOCALITY SYMBOL": insight.localityCode })
          )}&limit=1`
        ).catch(() => [] as CkanRecord[]),
        ckanCount(
          `resource_id=${CRIME_RESOURCE}&filters=${encodeURIComponent(
            JSON.stringify({ YeshuvKod: insight.localityCode })
          )}&limit=0`
        ).catch(() => null),
      ]);
      if (ses[0]) insight.socioeconomicCluster = toNum(ses[0]["ESHKOL 2019"]);
      insight.recordedOffenses = offenses;
    }

    return insight;
  } catch {
    return empty(query);
  }
}

export async function getLocalityInsights(queries: string[]): Promise<LocalityInsight[]> {
  return Promise.all(queries.map((q) => getLocalityInsight(q)));
}
