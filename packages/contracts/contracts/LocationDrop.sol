// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LocationDrop
/// @notice Leave messages ("drops") at real-world locations for other people to
/// find. A visitor submits a proof (e.g. a photo URI) that they were there, the
/// drop's creator approves them, and the visitor claims the drop.
/// @dev Users earn drop points over time and spend them to mint drops. The
/// owner curates locations by verifying or hiding them.
contract LocationDrop is Ownable {
  struct User {
    bool registered;
    uint256 dropPoints;
    uint256 lastBlockAwarded;
  }

  struct Location {
    // Signed decimal degrees scaled by 1e6 (south and west are negative).
    int32 latE6;
    int32 lonE6;
    address creator;
    bool verified;
    bool hidden;
    string name;
    string description;
    string imageUrl;
  }

  struct Drop {
    uint256 locationId;
    uint256 blockNumber;
    address creator;
    address approvedClaimer;
    address claimedBy;
    string message;
  }

  struct Proof {
    address user;
    string proofUri;
  }

  /// @notice Number of blocks a user must wait between point awards.
  uint256 public immutable awardBlockInterval;
  /// @notice Points granted on registration and on each award.
  uint256 public immutable dropPointsAward;
  /// @notice Points spent to mint a drop.
  uint256 public immutable mintCost;

  uint256 public locationCount;
  uint256 public dropCount;

  mapping(address => User) private _users;
  mapping(uint256 => Location) private _locations;
  mapping(uint256 => Drop) private _drops;
  mapping(uint256 => uint256[]) private _dropIdsByLocation;
  mapping(address => uint256[]) private _claimedDropIds;
  mapping(uint256 => Proof[]) private _proofs;

  event UserUpdated(address indexed user);
  event LocationUpdated(uint256 indexed locationId);
  event DropMinted(
    uint256 indexed dropId,
    uint256 indexed locationId,
    address indexed creator
  );
  event ProofCreated(
    uint256 indexed dropId,
    address indexed user,
    string proofUri
  );
  event ClaimApproved(uint256 indexed dropId, address indexed claimer);
  event DropClaimed(uint256 indexed dropId, address indexed claimer);

  error AlreadyRegistered();
  error NotRegistered();
  error TooSoon(uint256 nextAwardBlock);
  error InsufficientPoints(uint256 available, uint256 required);
  error InvalidCoordinates();
  error LocationNotFound(uint256 locationId);
  error LocationHidden(uint256 locationId);
  error DropNotFound(uint256 dropId);
  error NotDropCreator();
  error NotApprovedClaimer();
  error AlreadyClaimed();

  modifier locationExists(uint256 locationId) {
    if (locationId >= locationCount) revert LocationNotFound(locationId);
    _;
  }

  modifier dropExists(uint256 dropId) {
    if (dropId >= dropCount) revert DropNotFound(dropId);
    _;
  }

  constructor(
    uint256 awardBlockInterval_,
    uint256 dropPointsAward_,
    uint256 mintCost_
  ) Ownable(msg.sender) {
    awardBlockInterval = awardBlockInterval_;
    dropPointsAward = dropPointsAward_;
    mintCost = mintCost_;
  }

  // --- Users ---

  function createUser() external {
    User storage user = _users[msg.sender];
    if (user.registered) revert AlreadyRegistered();

    user.registered = true;
    user.dropPoints = dropPointsAward;
    user.lastBlockAwarded = block.number;

    emit UserUpdated(msg.sender);
  }

  function claimDropPoints() external {
    User storage user = _registeredUser(msg.sender);
    uint256 nextAwardBlock = user.lastBlockAwarded + awardBlockInterval;
    if (block.number < nextAwardBlock) revert TooSoon(nextAwardBlock);

    user.dropPoints += dropPointsAward;
    user.lastBlockAwarded = block.number;

    emit UserUpdated(msg.sender);
  }

  function getUser(address account) external view returns (User memory) {
    return _users[account];
  }

  function getClaimedDropIds(
    address account
  ) external view returns (uint256[] memory) {
    return _claimedDropIds[account];
  }

  // --- Locations ---

  /// @notice Anyone can add a location; only the owner can verify or hide it.
  function createLocation(
    int32 latE6,
    int32 lonE6,
    string calldata name,
    string calldata description,
    string calldata imageUrl
  ) external returns (uint256 locationId) {
    if (
      latE6 < -90_000_000 ||
      latE6 > 90_000_000 ||
      lonE6 < -180_000_000 ||
      lonE6 > 180_000_000
    ) revert InvalidCoordinates();

    locationId = locationCount++;
    _locations[locationId] = Location({
      latE6: latE6,
      lonE6: lonE6,
      creator: msg.sender,
      verified: false,
      hidden: false,
      name: name,
      description: description,
      imageUrl: imageUrl
    });

    emit LocationUpdated(locationId);
  }

  function getLocation(
    uint256 locationId
  ) external view locationExists(locationId) returns (Location memory) {
    return _locations[locationId];
  }

  function setLocationVerified(
    uint256 locationId,
    bool verified
  ) external onlyOwner locationExists(locationId) {
    _locations[locationId].verified = verified;
    emit LocationUpdated(locationId);
  }

  function setLocationHidden(
    uint256 locationId,
    bool hidden
  ) external onlyOwner locationExists(locationId) {
    _locations[locationId].hidden = hidden;
    emit LocationUpdated(locationId);
  }

  // --- Drops ---

  function mintDrop(
    uint256 locationId,
    string calldata message
  ) external locationExists(locationId) returns (uint256 dropId) {
    if (_locations[locationId].hidden) revert LocationHidden(locationId);

    User storage user = _registeredUser(msg.sender);
    if (user.dropPoints < mintCost)
      revert InsufficientPoints(user.dropPoints, mintCost);
    user.dropPoints -= mintCost;

    dropId = dropCount++;
    _drops[dropId] = Drop({
      locationId: locationId,
      blockNumber: block.number,
      creator: msg.sender,
      approvedClaimer: address(0),
      claimedBy: address(0),
      message: message
    });
    _dropIdsByLocation[locationId].push(dropId);

    emit UserUpdated(msg.sender);
    emit DropMinted(dropId, locationId, msg.sender);
  }

  function getDrop(
    uint256 dropId
  ) external view dropExists(dropId) returns (Drop memory) {
    return _drops[dropId];
  }

  function getDropIdsAtLocation(
    uint256 locationId
  ) external view returns (uint256[] memory) {
    return _dropIdsByLocation[locationId];
  }

  /// @notice Submit proof of having visited the drop's location.
  function submitProof(
    uint256 dropId,
    string calldata proofUri
  ) external dropExists(dropId) {
    _proofs[dropId].push(Proof({user: msg.sender, proofUri: proofUri}));
    emit ProofCreated(dropId, msg.sender, proofUri);
  }

  function getProofs(uint256 dropId) external view returns (Proof[] memory) {
    return _proofs[dropId];
  }

  /// @notice The drop's creator approves who may claim it, typically after
  /// reviewing their proof.
  function approveClaim(
    uint256 dropId,
    address claimer
  ) external dropExists(dropId) {
    Drop storage drop = _drops[dropId];
    if (msg.sender != drop.creator) revert NotDropCreator();
    if (drop.claimedBy != address(0)) revert AlreadyClaimed();

    drop.approvedClaimer = claimer;
    emit ClaimApproved(dropId, claimer);
  }

  function claimDrop(uint256 dropId) external dropExists(dropId) {
    Drop storage drop = _drops[dropId];
    if (drop.claimedBy != address(0)) revert AlreadyClaimed();
    if (msg.sender != drop.approvedClaimer) revert NotApprovedClaimer();

    drop.claimedBy = msg.sender;
    _claimedDropIds[msg.sender].push(dropId);

    emit DropClaimed(dropId, msg.sender);
  }

  function _registeredUser(
    address account
  ) private view returns (User storage user) {
    user = _users[account];
    if (!user.registered) revert NotRegistered();
  }
}
