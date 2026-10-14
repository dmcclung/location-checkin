import { http, createConfig, injected } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

export const chain =
  process.env.NEXT_PUBLIC_CHAIN === "sepolia" ? sepolia : hardhat;

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const config = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(rpcUrl),
    [sepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
