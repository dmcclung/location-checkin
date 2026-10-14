import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress } from "viem";

const AWARD_BLOCK_INTERVAL = 100n;
const DROP_POINTS_AWARD = 500n;
const MINT_COST = 500n;

// Sutton Wilderness, Norman OK
const LAT_E6 = 35_222_569;
const LON_E6 = -97_439_476;

describe("LocationDrop", async function () {
  const { viem, networkHelpers } = await network.create();
  const [owner, alice, bob] = await viem.getWalletClients();

  async function deploy() {
    return viem.deployContract("LocationDrop", [
      AWARD_BLOCK_INTERVAL,
      DROP_POINTS_AWARD,
      MINT_COST,
    ]);
  }

  async function asUser(
    contract: Awaited<ReturnType<typeof deploy>>,
    client: typeof alice,
  ) {
    return viem.getContractAt("LocationDrop", contract.address, {
      client: { wallet: client },
    });
  }

  async function deployWithLocation() {
    const locationDrop = await deploy();
    await locationDrop.write.createLocation([
      LAT_E6,
      LON_E6,
      "Sutton Wilderness Trail",
      "A beautiful trail in the center of the city",
      "https://example.com/sutton.jpg",
    ]);
    return locationDrop;
  }

  // Alice registers and mints a drop at location 0.
  async function deployWithDrop() {
    const locationDrop = await deployWithLocation();
    const asAlice = await asUser(locationDrop, alice);
    await asAlice.write.createUser();
    await asAlice.write.mintDrop([0n, "Thanks for keeping the trail clean"]);
    return { locationDrop, asAlice, asBob: await asUser(locationDrop, bob) };
  }

  describe("locations", function () {
    it("creates a location with signed coordinates", async function () {
      const locationDrop = await deploy();

      await viem.assertions.emitWithArgs(
        locationDrop.write.createLocation([LAT_E6, LON_E6, "Trail", "", ""]),
        locationDrop,
        "LocationUpdated",
        [0n],
      );

      const location = await locationDrop.read.getLocation([0n]);
      assert.equal(location.latE6, LAT_E6);
      assert.equal(location.lonE6, LON_E6);
      assert.equal(location.creator, getAddress(owner.account.address));
      assert.equal(location.verified, false);
      assert.equal(location.hidden, false);
      assert.equal(await locationDrop.read.locationCount(), 1n);
    });

    it("rejects out-of-range coordinates", async function () {
      const locationDrop = await deploy();

      await viem.assertions.revertWithCustomError(
        locationDrop.write.createLocation([90_000_001, 0, "", "", ""]),
        locationDrop,
        "InvalidCoordinates",
      );
      await viem.assertions.revertWithCustomError(
        locationDrop.write.createLocation([0, -180_000_001, "", "", ""]),
        locationDrop,
        "InvalidCoordinates",
      );
    });

    it("reverts when reading a missing location", async function () {
      const locationDrop = await deploy();

      await viem.assertions.revertWithCustomErrorWithArgs(
        locationDrop.read.getLocation([0n]),
        locationDrop,
        "LocationNotFound",
        [0n],
      );
    });

    it("lets only the owner verify and hide locations", async function () {
      const locationDrop = await deployWithLocation();

      await locationDrop.write.setLocationVerified([0n, true]);
      await locationDrop.write.setLocationHidden([0n, true]);
      const location = await locationDrop.read.getLocation([0n]);
      assert.equal(location.verified, true);
      assert.equal(location.hidden, true);

      const asAlice = await asUser(locationDrop, alice);
      await viem.assertions.revertWithCustomError(
        asAlice.write.setLocationVerified([0n, false]),
        locationDrop,
        "OwnableUnauthorizedAccount",
      );
      await viem.assertions.revertWithCustomError(
        asAlice.write.setLocationHidden([0n, false]),
        locationDrop,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  describe("users and points", function () {
    it("registers a user with the starting award", async function () {
      const locationDrop = await deploy();
      const asAlice = await asUser(locationDrop, alice);

      await viem.assertions.emitWithArgs(
        asAlice.write.createUser(),
        locationDrop,
        "UserUpdated",
        [getAddress(alice.account.address)],
      );

      const user = await locationDrop.read.getUser([alice.account.address]);
      assert.equal(user.registered, true);
      assert.equal(user.dropPoints, DROP_POINTS_AWARD);
    });

    it("does not let a user register twice to refill points", async function () {
      const { asAlice, locationDrop } = await deployWithDrop();

      await viem.assertions.revertWithCustomError(
        asAlice.write.createUser(),
        locationDrop,
        "AlreadyRegistered",
      );
    });

    it("awards points only after the block interval", async function () {
      const locationDrop = await deploy();
      const asAlice = await asUser(locationDrop, alice);
      await asAlice.write.createUser();

      await viem.assertions.revertWithCustomError(
        asAlice.write.claimDropPoints(),
        locationDrop,
        "TooSoon",
      );

      await networkHelpers.mine(AWARD_BLOCK_INTERVAL);
      await asAlice.write.claimDropPoints();

      const user = await locationDrop.read.getUser([alice.account.address]);
      assert.equal(user.dropPoints, DROP_POINTS_AWARD * 2n);
    });

    it("requires registration to claim points or mint", async function () {
      const locationDrop = await deployWithLocation();

      await viem.assertions.revertWithCustomError(
        locationDrop.write.claimDropPoints(),
        locationDrop,
        "NotRegistered",
      );
      await viem.assertions.revertWithCustomError(
        locationDrop.write.mintDrop([0n, "hi"]),
        locationDrop,
        "NotRegistered",
      );
    });
  });

  describe("drops", function () {
    it("mints a drop and spends points", async function () {
      const locationDrop = await deployWithLocation();
      const asAlice = await asUser(locationDrop, alice);
      await asAlice.write.createUser();

      await viem.assertions.emitWithArgs(
        asAlice.write.mintDrop([0n, "Hello"]),
        locationDrop,
        "DropMinted",
        [0n, 0n, getAddress(alice.account.address)],
      );

      const drop = await locationDrop.read.getDrop([0n]);
      assert.equal(drop.message, "Hello");
      assert.equal(drop.creator, getAddress(alice.account.address));
      assert.deepEqual(await locationDrop.read.getDropIdsAtLocation([0n]), [
        0n,
      ]);

      const user = await locationDrop.read.getUser([alice.account.address]);
      assert.equal(user.dropPoints, DROP_POINTS_AWARD - MINT_COST);
    });

    it("reverts with a clear error when points run out", async function () {
      const { asAlice, locationDrop } = await deployWithDrop();

      await viem.assertions.revertWithCustomErrorWithArgs(
        asAlice.write.mintDrop([0n, "Again"]),
        locationDrop,
        "InsufficientPoints",
        [0n, MINT_COST],
      );
    });

    it("cannot mint at a hidden or missing location", async function () {
      const locationDrop = await deployWithLocation();
      const asAlice = await asUser(locationDrop, alice);
      await asAlice.write.createUser();
      await locationDrop.write.setLocationHidden([0n, true]);

      await viem.assertions.revertWithCustomErrorWithArgs(
        asAlice.write.mintDrop([0n, "Hello"]),
        locationDrop,
        "LocationHidden",
        [0n],
      );
      await viem.assertions.revertWithCustomErrorWithArgs(
        asAlice.write.mintDrop([1n, "Hello"]),
        locationDrop,
        "LocationNotFound",
        [1n],
      );
    });
  });

  describe("claiming", function () {
    it("runs the proof, approve, claim flow", async function () {
      const { locationDrop, asAlice, asBob } = await deployWithDrop();
      const bobAddress = getAddress(bob.account.address);

      await viem.assertions.emitWithArgs(
        asBob.write.submitProof([0n, "ipfs://proof"]),
        locationDrop,
        "ProofCreated",
        [0n, bobAddress, "ipfs://proof"],
      );
      const proofs = await locationDrop.read.getProofs([0n]);
      assert.equal(proofs.length, 1);
      assert.equal(proofs[0].user, bobAddress);

      await viem.assertions.emitWithArgs(
        asAlice.write.approveClaim([0n, bobAddress]),
        locationDrop,
        "ClaimApproved",
        [0n, bobAddress],
      );
      await viem.assertions.emitWithArgs(
        asBob.write.claimDrop([0n]),
        locationDrop,
        "DropClaimed",
        [0n, bobAddress],
      );

      const drop = await locationDrop.read.getDrop([0n]);
      assert.equal(drop.claimedBy, bobAddress);
      assert.deepEqual(
        await locationDrop.read.getClaimedDropIds([bobAddress]),
        [0n],
      );
    });

    it("only lets the creator approve a claimer", async function () {
      const { locationDrop, asBob } = await deployWithDrop();

      await viem.assertions.revertWithCustomError(
        asBob.write.approveClaim([0n, bob.account.address]),
        locationDrop,
        "NotDropCreator",
      );
    });

    it("only lets the approved claimer claim", async function () {
      const { locationDrop, asAlice, asBob } = await deployWithDrop();

      // The creator cannot claim their own drop without approving themselves.
      await viem.assertions.revertWithCustomError(
        asAlice.write.claimDrop([0n]),
        locationDrop,
        "NotApprovedClaimer",
      );
      await viem.assertions.revertWithCustomError(
        asBob.write.claimDrop([0n]),
        locationDrop,
        "NotApprovedClaimer",
      );
    });

    it("cannot be claimed twice or re-approved after claiming", async function () {
      const { locationDrop, asAlice, asBob } = await deployWithDrop();
      await asAlice.write.approveClaim([0n, bob.account.address]);
      await asBob.write.claimDrop([0n]);

      await viem.assertions.revertWithCustomError(
        asBob.write.claimDrop([0n]),
        locationDrop,
        "AlreadyClaimed",
      );
      await viem.assertions.revertWithCustomError(
        asAlice.write.approveClaim([0n, alice.account.address]),
        locationDrop,
        "AlreadyClaimed",
      );
    });

    it("rejects proofs and claims for missing drops", async function () {
      const locationDrop = await deployWithLocation();

      await viem.assertions.revertWithCustomErrorWithArgs(
        locationDrop.write.submitProof([5n, "ipfs://proof"]),
        locationDrop,
        "DropNotFound",
        [5n],
      );
      await viem.assertions.revertWithCustomErrorWithArgs(
        locationDrop.write.claimDrop([5n]),
        locationDrop,
        "DropNotFound",
        [5n],
      );
    });
  });
});
