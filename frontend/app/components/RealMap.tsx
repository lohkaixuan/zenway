// frontend/app/components/RealMap.tsx
"use client";

import "leaflet/dist/leaflet.css";
import * as React from "react";
import L, { type LatLngLiteral } from "leaflet";
import { Route } from "../types";

type LatLngPoint = LatLngLiteral;
type TransitStop = { point: LatLngPoint; icon: L.DivIcon };

type RouteWithGeo = Route & {
    destinationCoords?: LatLngPoint;
    pathCoordinates?: LatLngPoint[];
};

interface RealMapProps {
    selectedRoute?: RouteWithGeo;
    destinationCoords?: LatLngPoint | null;
    destinationLabel?: string;
    /** 用来从外部强制居中（按一次按钮就 +1） */
    recenterToken?: number;
}

export function RealMap({
    selectedRoute,
    destinationCoords,
    destinationLabel,
    recenterToken,
}: RealMapProps) {
    const [userLocation, setUserLocation] = React.useState<LatLngPoint | null>(
        null
    );
    const [routeLine, setRouteLine] = React.useState<LatLngPoint[]>([]);

    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<L.Map | null>(null);
    const layerGroupRef = React.useRef<L.LayerGroup | null>(null);

    const firstDrawRef = React.useRef(true);
    const lastRecenterTokenRef = React.useRef<number | undefined>(undefined);

    const destinationPoint =
        selectedRoute?.destinationCoords || destinationCoords || null;

    const userIcon = React.useMemo(
        () =>
            L.icon({
                iconUrl:
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%232C7A7B'%3E%3Ccircle cx='12' cy='12' r='10' opacity='0.15'/%3E%3Ccircle cx='12' cy='12' r='5' fill='%232C7A7B'/%3E%3C/svg%3E",
                iconSize: [32, 32],
                iconAnchor: [16, 32],
            }),
        []
    );

    const destinationIcon = React.useMemo(() => {
        const color = selectedRoute?.type === "fast" ? "#3182CE" : "#E53E3E";
        return L.icon({
            iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='${encodeURIComponent(
                color
            )}'%3E%3Cpath d='M12 2C8.13 2 5 5.12 5 8.99 5 13.88 12 22 12 22s7-8.12 7-13.01C19 5.12 15.87 2 12 2zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'/%3E%3C/svg%3E`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
        });
    }, [selectedRoute?.type]);

    // 用户位置
    React.useEffect(() => {
        if (typeof window === "undefined" || !navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
            },
            (err) => {
                console.error("Geolocation error", err);
            }
        );
    }, []);

    // 计算路线：优先用 route.pathCoordinates，否则用 OSRM foot route
    React.useEffect(() => {
        if (selectedRoute?.pathCoordinates?.length) {
            setRouteLine(selectedRoute.pathCoordinates);
            return;
        }

        if (!userLocation || !destinationPoint) {
            setRouteLine([]);
            return;
        }

        const start = `${userLocation.lng},${userLocation.lat}`;
        const end = `${destinationPoint.lng},${destinationPoint.lat}`;
        const url = `https://router.project-osrm.org/route/v1/foot/${start};${end}?overview=full&geometries=geojson`;
        const controller = new AbortController();

        fetch(url, { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (!data.routes?.[0]?.geometry?.coordinates) return;
                const coords: LatLngPoint[] =
                    data.routes[0].geometry.coordinates.map((c: number[]) => ({
                        lng: c[0],
                        lat: c[1],
                    }));
                setRouteLine(coords);
            })
            .catch((e) => {
                if (e.name !== "AbortError") console.error("Routing error:", e);
            });

        return () => controller.abort();
    }, [destinationPoint, selectedRoute, userLocation]);

    // WALK / BUS / MRT 标签
    const transitIcons = React.useMemo(() => {
        const build = (label: string, bg: string) =>
            L.divIcon({
                html: `<div style="background:${bg};color:white;border-radius:12px;padding:4px 8px;font-size:10px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);transform:translateY(-4px)">${label}</div>`,
                className: "",
                iconSize: [44, 24],
                iconAnchor: [22, 24],
            });

        return {
            walk: build("WALK", "#2C7A7B"),
            bus: build("BUS", "#2B6CB0"),
            rail: build("MRT", "#6B46C1"),
        };
    }, []);

    const transitStops: TransitStop[] = React.useMemo(() => {
        if (!selectedRoute?.transportModes?.length) return [];

        const coords =
            selectedRoute.pathCoordinates && selectedRoute.pathCoordinates.length
                ? selectedRoute.pathCoordinates
                : routeLine;

        if (!coords.length) return [];

        const step = Math.max(
            1,
            Math.floor(coords.length / selectedRoute.transportModes.length)
        );

        return selectedRoute.transportModes.map((mode, idx) => {
            const point = coords[Math.min(idx * step, coords.length - 1)];
            const normalized = mode.toLowerCase();
            const icon = normalized.includes("bus")
                ? transitIcons.bus
                : normalized.includes("metro") ||
                    normalized.includes("mrt") ||
                    normalized.includes("rail")
                    ? transitIcons.rail
                    : transitIcons.walk;

            return { point, icon };
        });
    }, [
        routeLine,
        selectedRoute?.pathCoordinates,
        selectedRoute?.transportModes,
        transitIcons,
    ]);

    const center: LatLngPoint = React.useMemo(() => {
        if (userLocation) return userLocation;
        if (destinationPoint) return destinationPoint;
        return { lat: 3.139, lng: 101.686 }; // KL fallback
    }, [destinationPoint, userLocation]);

    const centerArray: [number, number] = [center.lat, center.lng];

    // 初始化 map（只一次）
    React.useEffect(() => {
        if (typeof window === "undefined") return;
        if (!containerRef.current) return;
        if (mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: centerArray,
            zoom: 14,
            zoomControl: true,
            // 默认关闭滚轮缩放，等鼠标进来再开
            scrollWheelZoom: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const group = L.layerGroup().addTo(map);

        mapRef.current = map;
        layerGroupRef.current = group;

        return () => {
            map.remove();
            mapRef.current = null;
            layerGroupRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 当 route / 目的地改变时，允许重新自动居中一次
    React.useEffect(() => {
        firstDrawRef.current = true;
    }, [selectedRoute?.id, destinationCoords?.lat, destinationCoords?.lng]);

    // 每次数据变化时更新图层 + 控制视图
    React.useEffect(() => {
        const map = mapRef.current;
        const group = layerGroupRef.current;
        if (!map || !group) return;

        group.clearLayers();

        let polylineBounds: L.LatLngBounds | null = null;

        if (routeLine.length > 1) {
            const latlngs: [number, number][] = routeLine.map((p) => [p.lat, p.lng]);
            const polyline = L.polyline(latlngs, { color: "#2C7A7B" }).addTo(group);
            polylineBounds = polyline.getBounds();
        }

        if (userLocation) {
            L.marker([userLocation.lat, userLocation.lng], {
                icon: userIcon,
            }).addTo(group);
        }

        if (destinationPoint) {
            L.marker([destinationPoint.lat, destinationPoint.lng], {
                icon: destinationIcon,
            }).addTo(group);
        }

        transitStops.forEach((stop) => {
            L.marker([stop.point.lat, stop.point.lng], {
                icon: stop.icon,
            }).addTo(group);
        });

        const lastToken = lastRecenterTokenRef.current;
        const forceRecenter =
            typeof recenterToken === "number" && recenterToken !== lastToken;
        const shouldRecenter = firstDrawRef.current || forceRecenter;

        if (shouldRecenter) {
            if (polylineBounds) {
                map.fitBounds(polylineBounds, { padding: [32, 32] });
            } else {
                map.setView(centerArray, forceRecenter ? 16 : 14);
            }
        }

        if (firstDrawRef.current) {
            firstDrawRef.current = false;
        }
        if (forceRecenter) {
            lastRecenterTokenRef.current = recenterToken;
        }
    }, [
        centerArray,
        userLocation,
        destinationPoint,
        routeLine,
        transitStops,
        userIcon,
        destinationIcon,
        recenterToken,
    ]);

    return (
        <div className="relative w-full h-full rounded-3xl overflow-hidden">
            {!destinationPoint ? (
                <>
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm text-slate-600">
                        +
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                        <div className="rounded-full bg-white/90 px-4 py-2 text-xs text-slate-600 shadow">
                            Set a destination to preview the route
                        </div>
                    </div>
                </>
            ) : destinationLabel ? (
                <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
                    <div className="rounded-full bg-white/90 px-4 py-2 text-xs text-slate-700 shadow">
                        Routing to {destinationLabel}
                    </div>
                </div>
            ) : null}

            <div
                ref={containerRef}
                className="w-full h-full"
                // 🧠 只有鼠标在地图上时才允许滚轮缩放
                onMouseEnter={() => {
                    if (mapRef.current) {
                        mapRef.current.scrollWheelZoom.enable();
                    }
                }}
                onMouseLeave={() => {
                    if (mapRef.current) {
                        mapRef.current.scrollWheelZoom.disable();
                    }
                }}
            />
        </div>
    );
}
