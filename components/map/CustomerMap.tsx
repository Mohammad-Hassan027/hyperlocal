"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fmtKm } from "@/lib/geo";
import { categoryById } from "@/lib/seed";
import type { CategoryId, Job, LatLng, Worker } from "@/lib/types";

interface CustomerMapProps {
  customerLoc: LatLng;
  radiusKm: number;
  workers: { worker: Worker; distanceKm: number }[];
  category: CategoryId;
  selectedWorkerId?: string | null;
  onSelectWorker?: (workerId: string) => void;
  activeJob?: Job | null;
  demoSpeed?: number;
}

export default function CustomerMap({
  customerLoc,
  radiusKm,
  workers,
  category,
  selectedWorkerId,
  onSelectWorker,
  activeJob,
  demoSpeed = 20,
}: CustomerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const workerMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const movingMarkerRef = useRef<L.Marker | null>(null);
  const travelLineRef = useRef<L.Polyline | null>(null);
  const etaBannerRef = useRef<HTMLDivElement>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [customerLoc.lat, customerLoc.lng],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [customerLoc.lat, customerLoc.lng]);

  // Customer marker and radius circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Customer marker
    const customerIcon = L.divIcon({
      className: "custom-customer-pin",
      html: `
        <div style="
          background: #1f2e86;
          color: #ffffff;
          border: 3px solid #0f1a4d;
          border-radius: 9999px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 8px rgba(15, 26, 77, 0.45);
          font-size: 18px;
        " title="Your location (${customerLoc.label ?? "You"})">
          📍
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });

    if (!customerMarkerRef.current) {
      customerMarkerRef.current = L.marker([customerLoc.lat, customerLoc.lng], {
        icon: customerIcon,
        zIndexOffset: 500,
      }).addTo(map);
    } else {
      customerMarkerRef.current.setLatLng([customerLoc.lat, customerLoc.lng]);
      customerMarkerRef.current.setIcon(customerIcon);
    }

    // Radius circle
    if (!radiusCircleRef.current) {
      radiusCircleRef.current = L.circle(
        [customerLoc.lat, customerLoc.lng],
        {
          radius: radiusKm * 1000,
          color: "#1f2e86",
          fillColor: "#1f2e86",
          fillOpacity: 0.08,
          weight: 2,
          dashArray: "6, 6",
        },
      ).addTo(map);
    } else {
      radiusCircleRef.current.setLatLng([customerLoc.lat, customerLoc.lng]);
      radiusCircleRef.current.setRadius(radiusKm * 1000);
    }

    map.panTo([customerLoc.lat, customerLoc.lng], { animate: true });
  }, [customerLoc.lat, customerLoc.lng, customerLoc.label, radiusKm]);

  // Worker Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const cat = categoryById(category);
    const currentMarkerMap = workerMarkersRef.current;
    const activeWorkerIds = new Set(workers.map((w) => w.worker.id));

    // Remove markers no longer present
    for (const [id, marker] of currentMarkerMap.entries()) {
      if (!activeWorkerIds.has(id)) {
        marker.remove();
        currentMarkerMap.delete(id);
      }
    }

    // Add or update markers
    for (const { worker, distanceKm } of workers) {
      const isSelected = selectedWorkerId === worker.id;
      const isOffline = !worker.online;

      const workerIcon = L.divIcon({
        className: `custom-worker-pin-${worker.id}`,
        html: `
          <div style="
            background: ${cat.tone};
            color: #0f1a4d;
            border: ${isSelected ? "3px solid #0f1a4d" : "2px solid rgba(15, 26, 77, 0.75)"};
            border-radius: 9999px;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: ${
              isSelected
                ? "0 0 0 4px #f4a300, 0 6px 12px rgba(15, 26, 77, 0.5)"
                : "0 2px 6px rgba(15, 26, 77, 0.3)"
            };
            font-size: 15px;
            opacity: ${isOffline ? "0.45" : "1"};
            filter: ${isOffline ? "grayscale(50%)" : "none"};
            transform: ${isSelected ? "scale(1.2)" : "scale(1)"};
            transition: transform 120ms ease, box-shadow 120ms ease;
            cursor: pointer;
          ">
            ${worker.emoji || "👤"}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      let marker = currentMarkerMap.get(worker.id);
      if (!marker) {
        marker = L.marker([worker.loc.lat, worker.loc.lng], {
          icon: workerIcon,
          zIndexOffset: isSelected ? 800 : 100,
        }).addTo(map);

        marker.on("click", () => {
          onSelectWorker?.(worker.id);
        });

        marker.bindPopup(
          `<div style="font-family: inherit; font-size: 14px;">
            <b>${worker.name}</b> (${cat.label})<br/>
            ⭐ ${worker.rating} • ₹${worker.baseRate} • ${fmtKm(distanceKm)}<br/>
            <span style="color: ${worker.online ? "#17783f" : "#525d89"}; font-weight: 600;">
              ${worker.online ? "● Online now" : "○ Offline"}
            </span>
          </div>`,
        );

        currentMarkerMap.set(worker.id, marker);
      } else {
        marker.setLatLng([worker.loc.lat, worker.loc.lng]);
        marker.setIcon(workerIcon);
        marker.setZIndexOffset(isSelected ? 800 : 100);
      }
    }
  }, [workers, category, selectedWorkerId, onSelectWorker]);

  // Traveling Worker Animation (after accept)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!activeJob || activeJob.status !== "accepted" || !activeJob.assignedWorkerId || !activeJob.acceptedAt) {
      if (movingMarkerRef.current) {
        movingMarkerRef.current.remove();
        movingMarkerRef.current = null;
      }
      if (travelLineRef.current) {
        travelLineRef.current.remove();
        travelLineRef.current = null;
      }
      if (etaBannerRef.current) {
        etaBannerRef.current.style.display = "none";
      }
      return;
    }

    const assigned = workers.find((w) => w.worker.id === activeJob.assignedWorkerId)?.worker;
    if (!assigned) return;

    const cat = categoryById(activeJob.category);
    const speed = demoSpeed || 20;
    // Stage arrival: takes 25s at 20x demo speed, or 500s at 1x normal speed
    const totalDurationSec = 500 / speed;

    const startLat = assigned.loc.lat;
    const startLng = assigned.loc.lng;
    const destLat = customerLoc.lat;
    const destLng = customerLoc.lng;

    // Draw travel route line
    if (!travelLineRef.current) {
      travelLineRef.current = L.polyline(
        [
          [startLat, startLng],
          [destLat, destLng],
        ],
        {
          color: "#f4a300",
          weight: 4,
          opacity: 0.85,
          dashArray: "8, 8",
        },
      ).addTo(map);
    }

    const updatePosition = () => {
      const elapsedSec = Math.max(0, (Date.now() - activeJob.acceptedAt!) / 1000);
      const fraction = Math.min(1, elapsedSec / totalDurationSec);
      const remainingSec = Math.max(0, Math.round(totalDurationSec - elapsedSec));

      let currentEta = "";
      if (fraction >= 1 || remainingSec === 0) {
        currentEta = "At your door!";
      } else if (remainingSec < 60) {
        currentEta = `${remainingSec} s`;
      } else {
        currentEta = `${Math.ceil(remainingSec / 60)} min`;
      }

      if (etaBannerRef.current) {
        etaBannerRef.current.style.display = "flex";
        const etaTextEl = etaBannerRef.current.querySelector(".eta-value");
        if (etaTextEl) etaTextEl.textContent = `ETA ${currentEta}`;
      }

      const curLat = startLat + (destLat - startLat) * fraction;
      const curLng = startLng + (destLng - startLng) * fraction;

      const movingIcon = L.divIcon({
        className: "custom-moving-worker-pin",
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; width: 80px;">
            <div style="
              background: #0f1a4d;
              color: #ffffff;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              margin-bottom: 3px;
            ">
              🏃 ${currentEta}
            </div>
            <div style="
              background: ${cat.tone};
              color: #0f1a4d;
              border: 3px solid #0f1a4d;
              border-radius: 9999px;
              width: 38px;
              height: 38px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 0 3px #f4a300, 0 4px 10px rgba(15, 26, 77, 0.5);
              font-size: 18px;
            ">
              ${assigned.emoji || "🔧"}
            </div>
          </div>
        `,
        iconSize: [80, 64],
        iconAnchor: [40, 56],
      });

      if (!movingMarkerRef.current) {
        movingMarkerRef.current = L.marker([curLat, curLng], {
          icon: movingIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        movingMarkerRef.current.setLatLng([curLat, curLng]);
        movingMarkerRef.current.setIcon(movingIcon);
      }
    };

    updatePosition();
    const interval = setInterval(updatePosition, 250);

    return () => {
      clearInterval(interval);
    };
  }, [activeJob, customerLoc.lat, customerLoc.lng, demoSpeed, workers]);

  return (
    <div className="relative w-full">
      <div
        ref={etaBannerRef}
        style={{ display: "none" }}
        className="mb-2 items-center justify-between gap-3 rounded-md bg-marigold px-3.5 py-2 text-ink shadow-[0_2px_0_var(--color-ink)] font-bold text-sm sm:text-base animate-pulse"
      >
        <span className="flex items-center gap-2">
          <span>🏃</span> Worker en route:
        </span>
        <span className="eta-value num text-base font-extrabold tracking-wide">
          ETA calculating…
        </span>
      </div>
      <div
        ref={mapContainerRef}
        aria-label="Interactive map showing nearby workers and your location"
        className="h-[320px] sm:h-[400px] w-full rounded-md border-2 border-ink shadow-[0_2px_0_var(--color-ink)] relative z-0"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>Click any pin to select the worker.</span>
        <span>Tiles &copy; OpenStreetMap</span>
      </div>
    </div>
  );
}
