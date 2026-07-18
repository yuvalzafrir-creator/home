import { describe, it, expect, vi, afterEach } from "vitest";
import { getLocalityInsight } from "@/lib/insights";

afterEach(() => vi.unstubAllGlobals());

function ckan(records: unknown[]) {
  return new Response(JSON.stringify({ result: { records } }), { status: 200 });
}

describe("getLocalityInsight", () => {
  it("parses population and socioeconomic cluster", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ckan([
          {
            LocNameHeb: "תל אביב -יפו",
            LocalityCode: 5000,
            Total_Population: "492,872",
            Households: "210,336",
            Average_size_of_household: 2.2,
          },
        ])
      )
      .mockResolvedValueOnce(ckan([{ "LOCALITY SYMBOL": 5000, "ESHKOL 2019": 8 }]));
    vi.stubGlobal("fetch", fetchMock);

    const r = await getLocalityInsight("תל אביב");
    expect(r.name).toBe("תל אביב -יפו");
    expect(r.localityCode).toBe(5000);
    expect(r.population).toBe(492872);
    expect(r.households).toBe(210336);
    expect(r.avgHouseholdSize).toBe(2.2);
    expect(r.socioeconomicCluster).toBe(8);
  });

  it("returns nulls when the locality isn't found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ckan([])));
    const r = await getLocalityInsight("nowhere-at-all");
    expect(r.name).toBeNull();
    expect(r.population).toBeNull();
    expect(r.socioeconomicCluster).toBeNull();
  });

  it("returns nulls on a fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const r = await getLocalityInsight("x");
    expect(r.population).toBeNull();
  });

  it("still returns population when the socioeconomic lookup fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ckan([{ LocNameHeb: "רמת גן", LocalityCode: 8600, Total_Population: 170000, Households: 70000, Average_size_of_household: 2.4 }])
      )
      .mockRejectedValueOnce(new Error("ses down"));
    vi.stubGlobal("fetch", fetchMock);

    const r = await getLocalityInsight("רמת גן");
    expect(r.population).toBe(170000);
    expect(r.socioeconomicCluster).toBeNull();
  });
});
