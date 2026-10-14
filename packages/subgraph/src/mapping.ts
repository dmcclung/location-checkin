import {
  ClaimApproved,
  DropClaimed,
  DropMinted,
  LocationDrop,
  LocationUpdated,
  ProofCreated,
  UserUpdated,
} from "../generated/LocationDrop/LocationDrop";
import { Drop, Location, Proof, User } from "../generated/schema";

export function handleUserUpdated(event: UserUpdated): void {
  const user = LocationDrop.bind(event.address).getUser(event.params.user);

  const entity = new User(event.params.user);
  entity.dropPoints = user.dropPoints;
  entity.lastBlockAwarded = user.lastBlockAwarded;
  entity.save();
}

export function handleLocationUpdated(event: LocationUpdated): void {
  const location = LocationDrop.bind(event.address).getLocation(
    event.params.locationId,
  );

  const entity = new Location(event.params.locationId.toString());
  entity.latE6 = location.latE6;
  entity.lonE6 = location.lonE6;
  entity.creator = location.creator;
  entity.name = location.name;
  entity.description = location.description;
  entity.imageUrl = location.imageUrl;
  entity.verified = location.verified;
  entity.hidden = location.hidden;
  entity.save();
}

export function handleDropMinted(event: DropMinted): void {
  const drop = LocationDrop.bind(event.address).getDrop(event.params.dropId);

  const entity = new Drop(event.params.dropId.toString());
  entity.location = event.params.locationId.toString();
  entity.creator = event.params.creator;
  entity.message = drop.message;
  entity.blockNumber = event.block.number;
  entity.createdAt = event.block.timestamp;
  entity.save();
}

export function handleProofCreated(event: ProofCreated): void {
  const entity = new Proof(
    event.transaction.hash.concatI32(event.logIndex.toI32()),
  );
  entity.drop = event.params.dropId.toString();
  entity.user = event.params.user;
  entity.proofUri = event.params.proofUri;
  entity.createdAt = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleClaimApproved(event: ClaimApproved): void {
  const entity = Drop.load(event.params.dropId.toString());
  if (entity) {
    entity.approvedClaimer = event.params.claimer;
    entity.save();
  }
}

export function handleDropClaimed(event: DropClaimed): void {
  const entity = Drop.load(event.params.dropId.toString());
  if (entity) {
    entity.claimedBy = event.params.claimer;
    entity.save();
  }
}
