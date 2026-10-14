import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LocationDropModule", (m) => {
  // Users receive 500 drop points every 100 blocks and spend 500 to mint a drop.
  const awardBlockInterval = m.getParameter("awardBlockInterval", 100n);
  const dropPointsAward = m.getParameter("dropPointsAward", 500n);
  const mintCost = m.getParameter("mintCost", 500n);

  const locationDrop = m.contract("LocationDrop", [
    awardBlockInterval,
    dropPointsAward,
    mintCost,
  ]);

  return { locationDrop };
});
