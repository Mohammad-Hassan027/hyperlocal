"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fmtKm } from "@/lib/geo";
import type { LatLng } from "@/lib/types";

interface WorkerMiniMapProps {
  customerLoc: LatLng;
  workerLoc: LatLng;
  distanceKm: number;
  categoryTone?: string;
  workerEmoji?: string;
}

export default function WorkerMiniMap({
  customerLoc,
  workerLoc,
  distanceKm,
  categoryTone = "#cfe4f7",
  workerEmoji = "🔧",
}: WorkerMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [
          (customerLoc.lat + workerLoc.lat) / 2,
          (customerLoc.lng + workerLoc.lng) / 2,
        ],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Customer pin
      const customerIcon = L.divIcon({
        className: "mini-customer-pin",
        html: `
          <div style="
            background: #1f2e86;
            color: #ffffff;
            border: 2px solid #0f1a4d;
            border-radius: 9999px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          " title="Customer: ${customerLoc.label ?? "Customer"}">
            📍
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      // Worker pin
      const workerIcon = L.divIcon({
        className: "mini-worker-pin",
        html: `
          <div style="
            background: ${categoryTone};
            color: #0f1a4d;
            border: 2px solid #0f1a4d;
            border-radius: 9999px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          " title="You">
            ${workerEmoji}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([customerLoc.lat, customerLoc.lng], { icon: customerIcon }).addTo(map);
      L.marker([workerLoc.lat, workerLoc.lng], { icon: workerIcon }).addTo(map);

      // Connecting distance route line
      L.polyline(
        [
          [workerLoc.lat, workerLoc.lng],
          [customerLoc.lat, customerLoc.lng],
        ],
        {
          color: "#1f2e86",
          weight: 3,
          opacity: 0.8,
          dashArray: "5, 5",
        },
      ).addTo(map);

      // Fit bounds to show both pins
      const bounds = L.latLngBounds([
        [workerLoc.lat, workerLoc.lng],
        [customerLoc.lat, customerLoc.lng],
      ]);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [customerLoc.lat, customerLoc.lng, customerLoc.label, workerLoc.lat, workerLoc.lng, categoryTone, workerEmoji]);

  return (
    <div className="overflow-hidden rounded-md border border-ink/30 bg-wall">
      <div
        ref={containerRef}
        aria-label={`Route map showing customer pin and distance of ${fmtKm(distanceKm)}`}
        className="h-[150px] w-full relative z-0"
      />
      <div className="flex items-center justify-between bg-paper px-3 py-1.5 text-xs">
        <span className="font-semibold text-ink">
          📍 {customerLoc.label ?? "Customer"}: <b>{fmtKm(distanceKm)}</b> away
        </span>
        <span className="text-muted">OpenStreetMap</span>
      </div>
    </div>
  );
}
