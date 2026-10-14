"use client";

import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";

import { formatAddress } from "@/lib/geo";
import styles from "./ui.module.css";

export function ConnectButton() {
  const { address, status } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();

  if (status === "connected") {
    return (
      <div className={styles.account}>
        <span className={styles.address}>{formatAddress(address)}</span>
        <button
          className={styles.secondaryButton}
          onClick={() => disconnect.mutate()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  const connector = connectors[0];
  return (
    <div className={styles.account}>
      {connect.error && (
        <span className={styles.error}>{connect.error.message}</span>
      )}
      <button
        className={styles.primaryButton}
        disabled={!connector || connect.isPending || status === "reconnecting"}
        onClick={() => connector && connect.mutate({ connector })}
      >
        {connect.isPending ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}
