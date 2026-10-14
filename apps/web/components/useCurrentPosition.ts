"use client";

import { useCallback, useEffect, useState } from "react";

import type { Coordinates } from "@/lib/geo";

type PositionState =
  | { status: "loading" }
  | { status: "ready"; coords: Coordinates }
  | { status: "error"; message: string };

export function useCurrentPosition() {
  const [state, setState] = useState<PositionState>({ status: "loading" });

  // State is only set from the async geolocation callbacks.
  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() =>
        setState({ status: "error", message: "Location is not available" }),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setState({
          status: "ready",
          coords: { lat: coords.latitude, lon: coords.longitude },
        }),
      (error) => setState({ status: "error", message: error.message }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  useEffect(request, [request]);

  const refresh = useCallback(() => {
    setState({ status: "loading" });
    request();
  }, [request]);

  return { ...state, refresh };
}
