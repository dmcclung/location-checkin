"use client";

import { useMemo, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";

import { locationDrop } from "@/lib/contract";
import { distanceKm, fromE6 } from "@/lib/geo";
import { TrailCard, type Trail } from "./TrailCard";
import { useCurrentPosition } from "./useCurrentPosition";
import styles from "./ui.module.css";

export function Trails() {
  const position = useCurrentPosition();
  const [search, setSearch] = useState("");

  const { data: count, error: countError } = useReadContract({
    ...locationDrop,
    functionName: "locationCount",
  });

  const { data: results, isPending } = useReadContracts({
    contracts: Array.from({ length: Number(count ?? 0n) }, (_, i) => ({
      ...locationDrop,
      functionName: "getLocation" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count !== undefined },
  });

  const trails = useMemo(() => {
    const here = position.status === "ready" ? position.coords : undefined;
    const query = search.trim().toLowerCase();

    return (results ?? [])
      .flatMap((result, i): Trail[] => {
        if (result.status !== "success" || result.result.hidden) return [];
        const location = result.result;
        const coords = fromE6(location.latE6, location.lonE6);
        return [
          {
            id: BigInt(i),
            name: location.name,
            description: location.description,
            imageUrl: location.imageUrl,
            verified: location.verified,
            coords,
            distanceKm: here ? distanceKm(here, coords) : undefined,
          },
        ];
      })
      .filter(
        (trail) =>
          !query ||
          trail.name.toLowerCase().includes(query) ||
          trail.description.toLowerCase().includes(query),
      )
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [results, position, search]);

  return (
    <>
      <div className={styles.currentPosition}>
        <span>
          {position.status === "ready"
            ? `Current position: ${position.coords.lat.toFixed(6)}, ${position.coords.lon.toFixed(6)}`
            : position.status === "loading"
              ? "Finding your position…"
              : `Position unavailable: ${position.message}`}
        </span>
        <button
          className={styles.iconButton}
          onClick={position.refresh}
          aria-label="Refresh position"
          title="Refresh position"
        >
          <RefreshIcon />
        </button>
      </div>

      <div className={styles.nearMe}>
        <h2 className={styles.nearMeTitle}>Hiking near me</h2>
        <input
          type="search"
          className={styles.searchBox}
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className={styles.trailList}>
        {countError ? (
          <p className={styles.empty}>
            Could not reach the LocationDrop contract. Is the chain running and
            the contract deployed?
          </p>
        ) : count !== undefined && !isPending && trails.length === 0 ? (
          <p className={styles.empty}>No trails found.</p>
        ) : (
          trails.map((trail) => (
            <TrailCard key={trail.id.toString()} trail={trail} />
          ))
        )}
      </div>
    </>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
