import { describe, it, expect, vi, afterEach } from "vitest";
import { geocodeAddress } from "@/lib/geocode";

afterEach(() => vi.unstubAllGlobals());

describe("geocodeAddress", () => {
  it("returns parsed coords from a Nominatim hit", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify([{ lat: "32.0853", lon: "34.7818" }]), { status: 200 })
    ));
    const res = await geocodeAddress("Rothschild 1, Tel Aviv");
    expect(res).toEqual({ lat: 32.0853, lng: 34.7818 });
  });

  it("returns null when Nominatim finds nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    expect(await geocodeAddress("nowhere at all")).toBeNull();
  });

  it("returns null on a fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect(await geocodeAddress("x")).toBeNull();
  });
});
