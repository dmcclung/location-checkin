// Seeds a deployed LocationDrop with sample locations, users, drops, and proofs.
// Usage: LOCATION_DROP_ADDRESS=0x... hardhat run scripts/seed.ts --network localhost
import { network } from "hardhat";
import { isAddress } from "viem";

const address = process.env.LOCATION_DROP_ADDRESS;
if (!address || !isAddress(address)) {
  throw new Error("Set LOCATION_DROP_ADDRESS to the deployed contract address");
}

// Coordinates are decimal degrees * 1e6, negative for south/west.
const locations = [
  {
    latE6: 35_222_569,
    lonE6: -97_439_476,
    name: "Sutton Wilderness Trail",
    description: "A beautiful trail within the center of the city.",
    imageUrl: "/images/sutton-wilderness.jpg",
  },
  {
    latE6: 35_481_918,
    lonE6: -97_508_469,
    name: "Public Library",
    description: "Community public library",
    imageUrl: "",
  },
  {
    latE6: 34_120_211,
    lonE6: -96_892_112,
    name: "Local Coffee Shop",
    description: "Best coffee for sale",
    imageUrl: "",
  },
  {
    latE6: 34_893_281,
    lonE6: -96_992_112,
    name: "Gas Station",
    description: "Cheap gas",
    imageUrl: "",
  },
  {
    latE6: 35_231_553,
    lonE6: -97_558_469,
    name: "High School",
    description: "Kid's school",
    imageUrl: "",
  },
];

const { viem } = await network.create();
const publicClient = await viem.getPublicClient();
const [owner, ...users] = await viem.getWalletClients();

async function contractFor(client: typeof owner) {
  return viem.getContractAt("LocationDrop", address as `0x${string}`, {
    client: { wallet: client },
  });
}

async function send(hash: Promise<`0x${string}`>) {
  await publicClient.waitForTransactionReceipt({ hash: await hash });
}

const asOwner = await contractFor(owner);
console.log("Seeding LocationDrop at", address);

for (const [i, location] of locations.entries()) {
  const locationId = await asOwner.read.locationCount();
  console.log(`Creating location ${locationId}: ${location.name}`);
  await send(
    asOwner.write.createLocation([
      location.latE6,
      location.lonE6,
      location.name,
      location.description,
      location.imageUrl,
    ]),
  );
  // Leave the last sample unverified to exercise that state.
  if (i < locations.length - 1) {
    await send(asOwner.write.setLocationVerified([locationId, true]));
  }
}

const firstLocationId =
  (await asOwner.read.locationCount()) - BigInt(locations.length);

for (const user of users.slice(0, 4)) {
  const asUser = await contractFor(user);
  const { registered } = await asUser.read.getUser([user.account.address]);
  if (!registered) {
    console.log("Registering", user.account.address);
    await send(asUser.write.createUser());
  }

  const dropId = await asUser.read.dropCount();
  console.log(`Minting drop ${dropId} at location ${firstLocationId}`);
  await send(asUser.write.mintDrop([firstLocationId, "Hello from the trail!"]));
  await send(
    asOwner.write.submitProof([dropId, "https://fakeimg.pl/350x200/?text=Hey"]),
  );
}

console.log("Done");
