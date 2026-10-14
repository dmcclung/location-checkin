# Location Check-in (Trails Cache)

Check in at real-world locations, like a trail, and leave a message ("drop")
for the next visitor. Visitors submit proof they were there, the drop's
creator approves them, and they claim the drop.

This monorepo combines three earlier projects:

| Package                                    | Was                              | Stack                                      |
| ------------------------------------------ | -------------------------------- | ------------------------------------------ |
| [`packages/contracts`](packages/contracts) | `location-checkin-solidity`      | Solidity 0.8.34, Hardhat 3, viem, Ignition |
| [`packages/subgraph`](packages/subgraph)   | `location-checkin-subgraph`      | The Graph (spec 1.3.0, graph-cli 0.98)     |
| [`apps/web`](apps/web)                     | `location-checkin-nextjs`        | Next.js 16 (App Router), React 19, wagmi 3 |
| [`design`](design)                         | Figma file from the Next.js repo | Light and dark wireframes and mockups      |

## Getting started

Requires Node.js 22+.

```sh
npm install
npm run build -w @location-checkin/contracts   # compile and export the ABI
```

Run everything locally in three terminals:

```sh
# 1. Local chain at http://127.0.0.1:8545
npm run node

# 2. Deploy and seed sample trails, users, and drops
npm run deploy:local -w @location-checkin/contracts
LOCATION_DROP_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 \
  npm run seed:local -w @location-checkin/contracts

# 3. Web app at http://localhost:3000
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

The first contract deployed on a fresh Hardhat node is always at
`0x5FbDB2315678afecb367f032d93F642f64180aa3`, which is the default address in
the web app and subgraph. To connect a wallet, add the Hardhat network
(chain id 31337, RPC `http://127.0.0.1:8545`) to MetaMask and import one of the
test accounts printed by `npm run node`.

## Scripts

| Command          | What it does                           |
| ---------------- | -------------------------------------- |
| `npm test`       | Contract tests                         |
| `npm run build`  | Build contracts, subgraph, and web app |
| `npm run lint`   | Lint the web app                       |
| `npm run format` | Prettier, including Solidity           |

## Contract

`LocationDrop` (see [`packages/contracts`](packages/contracts)):

- **Users** register with `createUser()` and get drop points. They earn more
  with `claimDropPoints()` once every `awardBlockInterval` blocks.
- **Locations** can be added by anyone with `createLocation()`. The owner
  curates them with `setLocationVerified()` and `setLocationHidden()`.
  Coordinates are signed microdegrees (`latE6`, `lonE6`).
- **Drops** are minted at a location with `mintDrop()`, which spends
  `mintCost` points.
- **Claiming** has three steps: a visitor calls `submitProof()`, the creator
  calls `approveClaim()`, and the visitor calls `claimDrop()`.

## Deploying to Sepolia

Hardhat 3 reads secrets from environment variables or its encrypted keystore:

```sh
cd packages/contracts
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
npm run deploy:sepolia
```

Then put the address and deployment block under `sepolia` in
[`packages/subgraph/networks.json`](packages/subgraph/networks.json). Set
`NEXT_PUBLIC_CHAIN=sepolia` and the address in `apps/web/.env.local`.

## Subgraph

The web app reads from the contract directly, so the subgraph is optional. It
indexes users, locations, drops, and proofs for richer queries.

```sh
cd packages/subgraph
npm run build                         # codegen and build (network: localhost)
npx graph build --network sepolia     # switch networks via networks.json
```

`deploy-local` expects a [graph-node](https://github.com/graphprotocol/graph-node/tree/master/docker)
running locally with its chain named `localhost`.
