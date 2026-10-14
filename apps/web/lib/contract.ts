import { locationDropAbi } from "@location-checkin/contracts/abi";
import { getAddress } from "viem";

import { chain } from "./wagmi";

export const locationDrop = {
  abi: locationDropAbi,
  address: getAddress(
    process.env.NEXT_PUBLIC_LOCATION_DROP_ADDRESS ??
      "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  ),
  chainId: chain.id,
} as const;
