"use client";

import { useConnection } from "wagmi";

import styles from "./ui.module.css";

export function Hero() {
  const { isConnected } = useConnection();

  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>NFTs for trails</h1>
      <p className={styles.description}>
        {isConnected
          ? "Share photos of your adventures on the trails below and get a cool NFT that supports trail construction and maintenance."
          : "Connect your wallet to check in on the trail, share a photo, and get a cool NFT that supports trail construction and maintenance."}
      </p>
    </section>
  );
}
