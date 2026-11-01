const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isCarCompatible,
  selectEligibleDrivers
} = require("../services/dispatchService");
const { getNewCandidates } = require("../services/rideOfferService");
const {
  registerSocket,
  unregisterSocket,
  revokeUserSockets
} = require("../socket");

const ride = (rideType) => ({
  rideType,
  pickupLatitude: 0,
  pickupLongitude: 0
});

const driver = (id, overrides = {}) => ({
  id,
  role: "DRIVER",
  isBlocked: false,
  driverStatus: "ONLINE",
  currentLatitude: 0,
  currentLongitude: 0,
  car: { type: "NORMAL" },
  ...overrides
});

test("car compatibility follows ride rules", () => {
  assert.equal(isCarCompatible("NORMAL", "NORMAL"), true);
  assert.equal(isCarCompatible("COMFORT", "NORMAL"), true);
  assert.equal(isCarCompatible("NORMAL", "COMFORT"), false);
  assert.equal(isCarCompatible("COMFORT", "COMFORT"), true);
});

test("eligible drivers are filtered and sorted by distance", () => {
  const candidates = selectEligibleDrivers(
    ride("NORMAL"),
    [
      driver(1, { currentLongitude: 0.01 }),
      driver(2, { currentLongitude: 0.02, car: { type: "COMFORT" } }),
      driver(3, { isBlocked: true }),
      driver(4, { driverStatus: "OFFLINE" }),
      driver(5, { car: null }),
      driver(6, { currentLatitude: null }),
      driver(7, { currentLongitude: 1 })
    ],
    3
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.driverId),
    [1, 2]
  );
  assert.ok(
    candidates[0].distanceToPickupKm <
      candidates[1].distanceToPickupKm
  );
});

test("normal drivers are excluded from comfort rides", () => {
  const candidates = selectEligibleDrivers(
    ride("COMFORT"),
    [
      driver(1),
      driver(2, { car: { type: "COMFORT" } })
    ],
    3
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.driverId),
    [2]
  );
});

test("radius expansion only returns newly notified drivers", () => {
  const notified = new Set([1]);
  const candidates = [
    { driverId: 1, distanceToPickupKm: 1 },
    { driverId: 2, distanceToPickupKm: 4 }
  ];

  assert.deepEqual(getNewCandidates(candidates, notified), [
    { driverId: 2, distanceToPickupKm: 4 }
  ]);
});

test("revoking a blocked passenger disconnects all of their sockets only", () => {
  const disconnected = [];
  const passengerSocketOne = {
    data: { user: { id: 20, role: "PASSENGER" } },
    disconnect: (close) => disconnected.push(["one", close])
  };
  const passengerSocketTwo = {
    data: { user: { id: 20, role: "PASSENGER" } },
    disconnect: (close) => disconnected.push(["two", close])
  };
  const unrelatedSocket = {
    data: { user: { id: 21, role: "PASSENGER" } },
    disconnect: (close) => disconnected.push(["unrelated", close])
  };

  registerSocket(passengerSocketOne);
  registerSocket(passengerSocketTwo);
  registerSocket(unrelatedSocket);
  revokeUserSockets(20);

  assert.deepEqual(disconnected, [
    ["one", true],
    ["two", true]
  ]);

  unregisterSocket(passengerSocketOne);
  unregisterSocket(passengerSocketTwo);
  unregisterSocket(unrelatedSocket);
});
