import { ConnectButton } from "@/components/ConnectButton";
import { Hero } from "@/components/Hero";
import { Trails } from "@/components/Trails";
import styles from "@/components/ui.module.css";

export default function Home() {
  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <span className={styles.logo}>Trails Cache</span>
        <ConnectButton />
      </header>
      <Hero />
      <Trails />
    </main>
  );
}
