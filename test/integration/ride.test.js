const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

require("dotenv").config();

const { createApp } = require("../../appFactory");
const { User, Car, Ride, RefreshToken } = require("../../models/associations");
const sequelize = require("../../config/database");

const DISTANCE_KM = 10;
const createdUsers = [];
const createdCars = [];
const createdRides = [];

const makeSuffix = () =>
  `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 9)}`;

const createUser = async (role, driverStatus = "OFFLINE", overrides = {}) => {
  const suffix = makeSuffix();
  const user = await User.create({
    fullName: `Ride Integration ${role}`,
    phone: `+ride-${suffix}`,
    email: `ride-${role.toLowerCase()}-${suffix}@example.test`,
    password: await bcrypt.hash("RideFixturePass123!", 10),
    role,
    driverStatus,
    ...overrides
  });
  createdUsers.push(user.id);
  return user;
};

const createCar = async (user, type = "NORMAL") => {
  const car = await Car.create({
    userId: user.id,
    type,
    manufacturer: "Toyota",
    model: "Corolla",
    color: "White",
    plateNumber: `RIDE-CAR-${makeSuffix()}`
  });
  createdCars.push({ id: car.id, ownerId: user.id });
  return car;
};

const createRide = async (passenger, overrides = {}) => {
  const ride = await Ride.create({
    userId: passenger.id,
    workerId: null,
    carId: null,
    status: "PENDING",
    pickupAddress: "Pickup",
    destinationAddress: "Destination",
    pickupLatitude: 33.5138,
    pickupLongitude: 36.2765,
    destinationLatitude: 33.5238,
    destinationLongitude: 36.2865,
    rideType: "NORMAL",
    scheduledAt: null,
    distanceKm: DISTANCE_KM,
    price: DISTANCE_KM * 2,
    ...overrides
  });
  createdRides.push({
    id: ride.id,
    passengerId: passenger.id,
    driverId: ride.workerId,
    carId: ride.carId
  });
  return ride;
};

const tokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m"
  });

const request = (server, method, path, body = {}, token) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const address = server.address();
    const headers = {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload)
    };
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const clientRequest = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              statusCode: response.statusCode,
              body: responseBody ? JSON.parse(responseBody) : null
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    clientRequest.on("error", reject);
    clientRequest.write(payload);
    clientRequest.end();
  });

const startServer = (app) => {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener("error", onError);
      reject(error);
    };
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", onError);
      resolve(server);
    });
  });
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    if (!server || !server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });

const cleanup = async () => {
  const failures = [];

  for (const tracked of createdRides) {
    try {
      const ride = await Ride.findByPk(tracked.id, {
        attributes: ["id", "userId", "workerId", "carId"]
      });
      if (!ride) continue;
      if (ride.userId !== tracked.passengerId) {
        throw new Error(`Refusing to delete Ride ${tracked.id}: fixture relationship mismatch`);
      }
      await Ride.destroy({ where: { id: tracked.id, userId: tracked.passengerId } });
    } catch (error) {
      failures.push(`Ride ${tracked.id}: ${error.message}`);
    }
  }

  for (const tracked of createdCars) {
    try {
      const car = await Car.findByPk(tracked.id, { attributes: ["id", "userId"] });
      if (!car) continue;
      if (car.userId !== tracked.ownerId) {
        throw new Error(`Refusing to delete Car ${tracked.id}: owner mismatch`);
      }
      await Car.destroy({ where: { id: tracked.id, userId: tracked.ownerId } });
    } catch (error) {
      failures.push(`Car ${tracked.id}: ${error.message}`);
    }
  }

  try {
    await RefreshToken.destroy({ where: { userId: { [Op.in]: createdUsers } } });
  } catch (error) {
    failures.push(`RefreshTokens: ${error.message}`);
  }

  for (const userId of createdUsers) {
    try {
      await User.destroy({ where: { id: userId } });
    } catch (error) {
      failures.push(`User ${userId}: ${error.message}`);
    }
  }

  if (failures.length) {
    throw new Error(`Ride integration cleanup failed: ${failures.join("; ")}`);
  }
};

const validRidePayload = (overrides = {}) => ({
  pickupAddress: "Pickup",
  destinationAddress: "Destination",
  pickupLatitude: 33.5138,
  pickupLongitude: 36.2765,
  destinationLatitude: 33.5238,
  destinationLongitude: 36.2865,
  rideType: "NORMAL",
  ...overrides
});

const assertValidationFailure = (response, field) => {
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Validation failed");
  assert.ok(response.body.details.some((detail) => detail.field === field));
};

test("Ride API integration tests", async (t) => {
  assert.equal(process.env.NODE_ENV, "integration");
  assert.equal(process.env.SMART_TAXI_INTEGRATION_DB_NAME, "smart_taxi_integration_local");
  assert.equal(process.env.SMART_TAXI_INTEGRATION_DB_USER, "smart_taxi_integration");
  assert.equal(sequelize.getDatabaseName(), "smart_taxi_integration_local");
  assert.equal(sequelize.config.username, "smart_taxi_integration");

  const testRoutingProvider = {
    calculateRoadDistance: async () => DISTANCE_KM
  };
  const testDispatchProvider = {
    startDispatch: async () => undefined,
    stopDispatch: () => undefined,
    stopAllDispatches: () => undefined
  };
  const app = createApp({
    ride: {
      rideService: require("../../services/rideService").createRideService({
        routingProvider: testRoutingProvider,
        dispatchProvider: testDispatchProvider
      })
    }
  });
  let server;

  t.after(async () => {
    const failures = [];
    try {
      testDispatchProvider.stopAllDispatches();
      await cleanup();
    } catch (error) {
      failures.push(error.message);
    }
    try {
      await closeServer(server);
    } catch (error) {
      failures.push(`HTTP server: ${error.message}`);
    }
    try {
      await sequelize.close();
    } catch (error) {
      failures.push(`Sequelize: ${error.message}`);
    }
    if (failures.length) throw new Error(failures.join("; "));
  });

  server = await startServer(app);

  await t.test("creates NORMAL and COMFORT rides with deterministic pricing", async () => {
    const passenger = await createUser("PASSENGER");
    const token = tokenFor(passenger);
    const normal = await request(server, "POST", "/api/rides/", validRidePayload(), token);
    const comfort = await request(
      server,
      "POST",
      "/api/rides/",
      validRidePayload({ rideType: "COMFORT" }),
      token
    );
    createdRides.push(
      { id: normal.body.id, passengerId: passenger.id, driverId: null, carId: null },
      { id: comfort.body.id, passengerId: passenger.id, driverId: null, carId: null }
    );

    assert.equal(normal.statusCode, 201);
    assert.equal(normal.body.status, "PENDING");
    assert.equal(normal.body.workerId, null);
    assert.equal(normal.body.carId, null);
    assert.equal(Number(normal.body.distanceKm), DISTANCE_KM);
    assert.equal(Number(normal.body.price), 20);
    assert.equal(comfort.statusCode, 201);
    assert.equal(Number(comfort.body.price), 20.4);

    const stored = await Ride.findAll({ where: { id: { [Op.in]: [normal.body.id, comfort.body.id] } } });
    assert.equal(stored.length, 2);
    assert.ok(stored.every((ride) => ride.userId === passenger.id));
  });

  await t.test("creates a ride with a future scheduled time", async () => {
    const passenger = await createUser("PASSENGER");
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const response = await request(
      server,
      "POST",
      "/api/rides/",
      validRidePayload({ scheduledAt }),
      tokenFor(passenger)
    );
    createdRides.push({ id: response.body.id, passengerId: passenger.id, driverId: null, carId: null });
    assert.equal(response.statusCode, 201);
    assert.ok(response.body.scheduledAt);
  });

  for (const field of [
    "pickupAddress",
    "destinationAddress",
    "pickupLatitude",
    "pickupLongitude",
    "destinationLatitude",
    "destinationLongitude",
    "rideType"
  ]) {
    await t.test(`rejects missing ${field} without creating a ride`, async () => {
      const passenger = await createUser("PASSENGER");
      const payload = validRidePayload();
      delete payload[field];
      const response = await request(server, "POST", "/api/rides/", payload, tokenFor(passenger));
      assertValidationFailure(response, field);
      assert.equal(await Ride.count({ where: { userId: passenger.id } }), 0);
    });
  }

  await t.test("rejects invalid dates, equal addresses, and invalid coordinates", async () => {
    const passenger = await createUser("PASSENGER");
    const token = tokenFor(passenger);
    const cases = [
      [validRidePayload({ scheduledAt: "not-a-date" }), "scheduledAt", "validation"],
      [validRidePayload({ scheduledAt: new Date(Date.now() - 1000).toISOString() }), "scheduledAt", "service"],
      [validRidePayload({ pickupAddress: "Same", destinationAddress: "Same" }), null],
      [validRidePayload({ pickupLatitude: 91 }), "pickupLatitude"],
      [validRidePayload({ pickupLongitude: 181 }), "pickupLongitude"]
    ];
    for (const [payload, field, errorType] of cases) {
      const response = await request(server, "POST", "/api/rides/", payload, token);
      if (errorType === "service") {
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.error, "Scheduled time must be in the future");
      } else if (field) assertValidationFailure(response, field);
      else {
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.error, "Pickup and destination addresses cannot be the same");
      }
    }
    assert.equal(await Ride.count({ where: { userId: passenger.id } }), 0);
  });

  await t.test("enforces Passenger ownership on my-rides and Ride by id", async () => {
    const owner = await createUser("PASSENGER");
    const other = await createUser("PASSENGER");
    const ride = await createRide(owner);
    const ownList = await request(server, "GET", "/api/rides/my-rides", {}, tokenFor(owner));
    const otherList = await request(server, "GET", "/api/rides/my-rides", {}, tokenFor(other));
    const own = await request(server, "GET", `/api/rides/${ride.id}`, {}, tokenFor(owner));
    const denied = await request(server, "GET", `/api/rides/${ride.id}`, {}, tokenFor(other));
    assert.equal(ownList.statusCode, 200);
    assert.ok(ownList.body.some((item) => item.id === ride.id));
    assert.equal(otherList.statusCode, 200);
    assert.equal(otherList.body.some((item) => item.id === ride.id), false);
    assert.equal(own.statusCode, 200);
    assert.equal(denied.statusCode, 403);
  });

  await t.test("filters available rides by type and pending status", async () => {
    const passenger = await createUser("PASSENGER");
    const driver = await createUser("DRIVER");
    const normal = await createRide(passenger, { rideType: "NORMAL" });
    const comfort = await createRide(passenger, { rideType: "COMFORT" });
    await createRide(passenger, { status: "CANCELLED" });
    const all = await request(server, "GET", "/api/rides/available", {}, tokenFor(driver));
    const normalOnly = await request(server, "GET", "/api/rides/available?rideType=NORMAL", {}, tokenFor(driver));
    assert.equal(all.statusCode, 200);
    assert.equal(normalOnly.statusCode, 200);
    assert.ok(all.body.some((item) => item.id === normal.id));
    assert.ok(all.body.some((item) => item.id === comfort.id));
    assert.equal(all.body.some((item) => item.status === "CANCELLED"), false);
    assert.ok(normalOnly.body.some((item) => item.id === normal.id));
    assert.equal(normalOnly.body.some((item) => item.id === comfort.id), false);
  });

  await t.test("returns dispatch candidates only for eligible Drivers", async () => {
    const passenger = await createUser("PASSENGER");
    const eligible = await createUser("DRIVER", "ONLINE", {
      currentLatitude: 33.5138,
      currentLongitude: 36.2765
    });
    await createCar(eligible, "COMFORT");
    const near = await createRide(passenger, { pickupLatitude: 33.5138, pickupLongitude: 36.2765 });
    const far = await createRide(passenger, { pickupLatitude: 34.5, pickupLongitude: 36.5 });
    const response = await request(server, "GET", "/api/rides/dispatch", {}, tokenFor(eligible));
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.rides.some((ride) => ride.id === near.id));
    assert.ok(response.body.rides.some((ride) => ride.id === far.id));
    assert.ok(
      response.body.rides.find((ride) => ride.id === near.id).distanceToPickupKm <=
        response.body.rides.find((ride) => ride.id === far.id).distanceToPickupKm
    );

    const offline = await createUser("DRIVER", "OFFLINE", {
      currentLatitude: 33.5138,
      currentLongitude: 36.2765
    });
    const offlineResponse = await request(server, "GET", "/api/rides/dispatch", {}, tokenFor(offline));
    assert.equal(offlineResponse.statusCode, 409);
  });

  await t.test("accepts, starts, completes, and restores Driver status", async () => {
    const passenger = await createUser("PASSENGER");
    const driver = await createUser("DRIVER", "ONLINE");
    const car = await createCar(driver, "NORMAL");
    const ride = await createRide(passenger);
    const accept = await request(server, "PATCH", `/api/rides/${ride.id}/accept`, {}, tokenFor(driver));
    assert.equal(accept.statusCode, 200);
    assert.equal(accept.body.status, "ACCEPTED");
    assert.equal(accept.body.workerId, driver.id);
    assert.equal(accept.body.carId, car.id);
    assert.equal((await User.findByPk(driver.id)).driverStatus, "BUSY");
    const start = await request(server, "PATCH", `/api/rides/${ride.id}/start`, {}, tokenFor(driver));
    assert.equal(start.statusCode, 200);
    assert.equal(start.body.status, "IN_PROGRESS");
    const complete = await request(server, "PATCH", `/api/rides/${ride.id}/complete`, {}, tokenFor(driver));
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.body.status, "COMPLETED");
    assert.equal((await User.findByPk(driver.id)).driverStatus, "ONLINE");
  });

  await t.test("allows only one of two concurrent Drivers to accept a Ride", async () => {
    const passenger = await createUser("PASSENGER");
    const driverA = await createUser("DRIVER", "ONLINE");
    const driverB = await createUser("DRIVER", "ONLINE");
    const carA = await createCar(driverA, "NORMAL");
    const carB = await createCar(driverB, "NORMAL");
    const ride = await createRide(passenger);

    const responses = await Promise.all([
      request(server, "PATCH", `/api/rides/${ride.id}/accept`, {}, tokenFor(driverA)),
      request(server, "PATCH", `/api/rides/${ride.id}/accept`, {}, tokenFor(driverB))
    ]);

    assert.equal(responses.filter((response) => response.statusCode === 200).length, 1);
    assert.equal(responses.filter((response) => response.statusCode === 409).length, 1);

    const persistedRide = await Ride.findByPk(ride.id, {
      attributes: ["id", "status", "workerId", "carId"]
    });
    const persistedDriverA = await User.findByPk(driverA.id, {
      attributes: ["id", "driverStatus"]
    });
    const persistedDriverB = await User.findByPk(driverB.id, {
      attributes: ["id", "driverStatus"]
    });
    const persistedCar = await Car.findByPk(persistedRide.carId, {
      attributes: ["id", "userId"]
    });

    assert.equal(persistedRide.status, "ACCEPTED");
    assert.ok([driverA.id, driverB.id].includes(persistedRide.workerId));
    assert.ok([carA.id, carB.id].includes(persistedRide.carId));
    assert.equal(persistedCar.userId, persistedRide.workerId);
    assert.equal(
      persistedRide.carId,
      persistedRide.workerId === driverA.id ? carA.id : carB.id
    );
    assert.equal(
      persistedDriverA.driverStatus,
      persistedRide.workerId === driverA.id ? "BUSY" : "ONLINE"
    );
    assert.equal(
      persistedDriverB.driverStatus,
      persistedRide.workerId === driverB.id ? "BUSY" : "ONLINE"
    );
  });

  await t.test("cancels pending and accepted rides with ownership rules", async () => {
    const passenger = await createUser("PASSENGER");
    const other = await createUser("PASSENGER");
    const driver = await createUser("DRIVER", "ONLINE");
    await createCar(driver);
    const pending = await createRide(passenger);
    const denied = await request(server, "PATCH", `/api/rides/${pending.id}/cancel`, { cancelReason: "no" }, tokenFor(other));
    assert.equal(denied.statusCode, 403);
    const cancelled = await request(server, "PATCH", `/api/rides/${pending.id}/cancel`, { cancelReason: "changed plans" }, tokenFor(passenger));
    assert.equal(cancelled.statusCode, 200);
    assert.equal(cancelled.body.status, "CANCELLED");
    const accepted = await createRide(passenger);
    const acceptedResult = await request(server, "PATCH", `/api/rides/${accepted.id}/accept`, {}, tokenFor(driver));
    assert.equal(acceptedResult.statusCode, 200);
    const acceptedCancel = await request(server, "PATCH", `/api/rides/${accepted.id}/cancel`, {}, tokenFor(passenger));
    assert.equal(acceptedCancel.statusCode, 200);
    assert.equal(acceptedCancel.body.status, "CANCELLED");
    assert.equal((await User.findByPk(driver.id)).driverStatus, "ONLINE");
  });

  await t.test("rejects unauthenticated and wrong-role Ride operations", async () => {
    const passenger = await createUser("PASSENGER");
    const driver = await createUser("DRIVER");
    const ride = await createRide(passenger);
    const unauthenticated = await request(server, "GET", "/api/rides/my-rides");
    const driverCreate = await request(server, "POST", "/api/rides/", validRidePayload(), tokenFor(driver));
    const passengerAccept = await request(server, "PATCH", `/api/rides/${ride.id}/accept`, {}, tokenFor(passenger));
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(driverCreate.statusCode, 403);
    assert.equal(passengerAccept.statusCode, 403);
  });
});
