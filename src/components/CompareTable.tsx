import type { Listing } from "@/types/listing";

type CompareListing = Pick<Listing, "id" | "address" | "price" | "rooms" | "sizeSqm" | "matchScore">;

export function CompareTable({ listings }: { listings: CompareListing[] }) {
  const rows: { label: string; get: (l: CompareListing) => string | number }[] = [
    { label: "Address", get: (l) => l.address },
    { label: "Price", get: (l) => `₪${l.price.toLocaleString()}` },
    { label: "Rooms", get: (l) => l.rooms },
    { label: "Size (m²)", get: (l) => l.sizeSqm },
    { label: "Match score", get: (l) => l.matchScore ?? "—" },
  ];

  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.label}</td>
            {listings.map((listing) => (
              <td key={listing.id}>{row.get(listing)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
