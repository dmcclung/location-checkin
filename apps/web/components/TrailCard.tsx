"use client";

import { useState } from "react";
import { zeroAddress } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

import { locationDrop } from "@/lib/contract";
import {
  formatAddress,
  formatLatitude,
  formatLongitude,
  type Coordinates,
} from "@/lib/geo";
import styles from "./ui.module.css";

export type Trail = {
  id: bigint;
  name: string;
  description: string;
  imageUrl: string;
  verified: boolean;
  coords: Coordinates;
  distanceKm?: number;
};

export function TrailCard({ trail }: { trail: Trail }) {
  const [showCache, setShowCache] = useState(false);

  return (
    <article className={styles.trail}>
      <div className={styles.trailDetails}>
        <h3 className={styles.trailTitle}>{trail.name}</h3>
        {!trail.verified && <span className={styles.badge}>Unverified</span>}
        <p className={styles.trailText}>{trail.description}</p>
        {trail.distanceKm !== undefined && (
          <p className={styles.trailText}>
            {trail.distanceKm < 1
              ? `${Math.round(trail.distanceKm * 1000)} m away`
              : `${trail.distanceKm.toFixed(1)} km away`}
          </p>
        )}
        <p className={styles.coordinate}>
          Latitude {formatLatitude(trail.coords.lat)}
        </p>
        <p className={styles.coordinate}>
          Longitude {formatLongitude(trail.coords.lon)}
        </p>
        <button
          className={styles.primaryButton}
          onClick={() => setShowCache((show) => !show)}
          aria-expanded={showCache}
        >
          {showCache ? "Hide cache" : "See cache"}
        </button>
        {showCache && <Cache locationId={trail.id} />}
      </div>
      {trail.imageUrl ? (
        // On-chain image URLs can point at any host, so skip next/image here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.trailImage}
          src={trail.imageUrl}
          alt={trail.name}
        />
      ) : (
        <div className={styles.trailImagePlaceholder} aria-hidden="true" />
      )}
    </article>
  );
}

function Cache({ locationId }: { locationId: bigint }) {
  const { data: dropIds } = useReadContract({
    ...locationDrop,
    functionName: "getDropIdsAtLocation",
    args: [locationId],
  });

  const { data: drops, isPending } = useReadContracts({
    contracts: (dropIds ?? []).map((dropId) => ({
      ...locationDrop,
      functionName: "getDrop" as const,
      args: [dropId] as const,
    })),
    query: { enabled: dropIds !== undefined },
  });

  if (dropIds?.length === 0) {
    return <p className={styles.trailText}>No drops here yet.</p>;
  }
  if (isPending) {
    return <p className={styles.trailText}>Loading drops…</p>;
  }

  return (
    <ul className={styles.dropList}>
      {drops?.map((result, i) =>
        result.status === "success" ? (
          <li key={dropIds?.[i].toString()} className={styles.drop}>
            <span>“{result.result.message}”</span>
            <span className={styles.dropMeta}>
              from {formatAddress(result.result.creator)}
              {result.result.claimedBy !== zeroAddress && " · claimed"}
            </span>
          </li>
        ) : null,
      )}
    </ul>
  );
}
