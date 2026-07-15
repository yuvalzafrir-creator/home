"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { escapeHtml } from "@/lib/escape-html";

export interface MapListing {
  id: string;
  address: string;
  price: number;
  lat: number;
  lng: number;
  matchScore: number | null;
}

export function ListingsMap({ listings, height = 420 }: { listings: MapListing[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || listings.length === 0) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      map = L.map(ref.current);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const points: [number, number][] = [];
      for (const l of listings) {
        const score = l.matchScore !== null ? ` · ${l.matchScore}/100` : "";
        L.circleMarker([l.lat, l.lng], {
          radius: 9,
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.85,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(
            `<div dir="rtl" style="font-size:13px"><strong>${escapeHtml(l.address)}</strong><br/>₪${l.price.toLocaleString()}${score}<br/><a href="/listings/${escapeHtml(l.id)}">לפרטים ←</a></div>`
          );
        points.push([l.lat, l.lng]);
      }

      if (points.length === 1) map.setView(points[0], 15);
      else map.fitBounds(points, { padding: [30, 30] });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [listings]);

  if (listings.length === 0) {
    return <div className="empty">אין מודעות עם מיקום להצגה על המפה.</div>;
  }

  return <div ref={ref} className="map-container" style={{ height }} />;
}
