const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { io: createSocketClient } = require("socket.io-client");
const { Op } = require("sequelize");

require("dotenv").config();

const { createApp } = require("../../appFactory");
const { initializeSocket } = require("../../socket");
const dispatchService = require("../../services/rideOfferService");
const { User, Car, Ride, RefreshToken } = require("../../models/associations");
const sequelize = require("../../config/database");

const createdUsers = [];
const createdCars = [];
const createdRides = [];
const DISPATCH_COMPLETION_WAIT_MS = 50500;

const makeSuffix = () =>
  `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 9)}`;

const createUser = async (role, driverStatus = "OFFLINE", overrides = {}) => {
  const suffix = makeSuffix();
  const user = await User.create({
    fullName: `Socket Integration ${role}`,
    phone: `+socket-${suffix}`,
    email: `socket-${role.toLowerCase()}-${suffix}@example.test`,
    password: await bcrypt.hash("SocketFixturePass123!", 10),
    role,
    driverStatus,
    ...overrides
  });
  createdUsers.push(user.id);
  return user;
};

const createCar = async (user) => {
  const car = await Car.create({
    userId: user.id,
    type: "NORMAL",
    manufacturer: "Toyota",
    model: "Corolla",
    color: "White",
    plateNumber: `SOCKET-CAR-${makeSuffix()}`
  });
  createdCars.push({ id: car.id, ownerId: user.id });
  return car;
};

const createRide = async (passenger) => {
  const ride = await Ride.create({
    userId: passenger.id,
    workerId: null,
    carId: null,
    status: "PENDING",
    pickupAddress: "Socket Pickup",
    destinationAddress: "Socket Destination",
    pickupLatitude: 33.5138,
    pickupLongitude: 36.2765,
    destinationLatitude: 33.5238,
    destinationLongitude: 36.2865,
    rideType: "NORMAL",
    scheduledAt: null,
    distanceKm: 10,
    price: 20
  });
  createdRides.push({ id: ride.id, passengerId: passenger.id });
  return ride;
};

const tokenFor = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "15m"
  });

const request = (server, method, path, body, token) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body || {});
    const headers = {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
      authorization: `Bearer ${token}`
    };
    const address = server.address();
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

const closeSocket = (socket) =>
  new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve();
      return;
    }
    socket.once("disconnect", resolve);
    socket.disconnect();
  });

const connectSocket = (server, token) =>
  new Promise((resolve, reject) => {
    const socket = createSocketClient(
      `http://127.0.0.1:${server.address().port}`,
      {
        auth: { token },
        transports: ["websocket"],
        forceNew: true
      }
    );
    const onConnectError = (error) => {
      socket.close();
      reject(error);
    };
    socket.once("connect", () => {
      socket.removeListener("connect_error", onConnectError);
      resolve(socket);
    });
    socket.once("connect_error", onConnectError);
  });

const waitForOffer = (socket, rideId) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener("ride:offer", onOffer);
      reject(new Error(`Timed out waiting for ride offer ${rideId}`));
    }, 5000);
    const onOffer = (offer) => {
      if (offer.rideId !== rideId) return;
      clearTimeout(timer);
      socket.removeListener("ride:offer", onOffer);
      resolve(offer);
    };
    socket.on("ride:offer", onOffer);
  });

const waitForNoEvent = (events, durationMs) =>
  new Promise((resolve) => {
    const initialCount = events.length;
    setTimeout(() => resolve(events.length === initialCount), durationMs);
  });

const cleanup = async () => {
  const failures = [];

  for (const tracked of createdRides) {
    try {
      const ride = await Ride.findByPk(tracked.id, {
        attributes: ["id", "userId"]
      });
      if (!ride) continue;
      if (ride.userId !== tracked.passengerId) {
        throw new Error(`Refusing to delete Ride ${tracked.id}: owner mismatch`);
      }
      await Ride.destroy({
        where: { id: tracked.id, userId: tracked.passengerId }
      });
    } catch (error) {
      failures.push(`Ride ${tracked.id}: ${error.message}`);
    }
  }

  for (const tracked of createdCars) {
    try {
      const car = await Car.findByPk(tracked.id, {
        attributes: ["id", "userId"]
      });
      if (!car) continue;
      if (car.userId !== tracked.ownerId) {
        throw new Error(`Refusing to delete Car ${tracked.id}: owner mismatch`);
      }
      await Car.destroy({
        where: { id: tracked.id, userId: tracked.ownerId }
      });
    } catch (error) {
      failures.push(`Car ${tracked.id}: ${error.message}`);
    }
  }

  try {
    await RefreshToken.destroy({
      where: { userId: { [Op.in]: createdUsers } }
    });
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
    throw new Error(`Socket integration cleanup failed: ${failures.join("; ")}`);
  }
};

test("Socket.IO ride offers deliver to eligible Drivers and stop with lifecycle changes", async (t) => {
  assert.equal(process.env.NODE_ENV, "integration");
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_NAME,
    "smart_taxi_integration_local"
  );
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_USER,
    "smart_taxi_integration"
  );
  assert.equal(sequelize.getDatabaseName(), "smart_taxi_integration_local");
  assert.equal(sequelize.config.username, "smart_taxi_integration");

  const app = createApp();
  const server = await startServer(app);
  const io = initializeSocket(server);
  const sockets = [];

  t.after(async () => {
    const failures = [];
    dispatchService.stopAllDispatches();
    for (const socket of sockets) {
      try {
        await closeSocket(socket);
      } catch (error) {
        failures.push(`Socket: ${error.message}`);
      }
    }
    try {
      await new Promise((resolve, reject) => {
        io.close((error) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      failures.push(`Socket.IO: ${error.message}`);
    }
    try {
      await closeServer(server);
    } catch (error) {
      failures.push(`HTTP server: ${error.message}`);
    }
    try {
      await cleanup();
    } catch (error) {
      failures.push(error.message);
    }
    try {
      await sequelize.close();
    } catch (error) {
      failures.push(`Sequelize: ${error.message}`);
    }
    if (failures.length) throw new Error(failures.join("; "));
  });

  await t.test("delivers offers only to eligible authenticated Driver rooms", async () => {
    const passenger = await createUser("PASSENGER");
    const eligible = await createUser("DRIVER", "ONLINE", {
      currentLatitude: 33.5138,
      currentLongitude: 36.2765
    });
    const ineligible = await createUser("DRIVER", "OFFLINE", {
      currentLatitude: 33.5138,
      currentLongitude: 36.2765
    });
    await createCar(eligible);
    await createCar(ineligible);
    const ride = await createRide(passenger);
    const eligibleSocket = await connectSocket(server, tokenFor(eligible));
    const ineligibleSocket = await connectSocket(server, tokenFor(ineligible));
    sockets.push(eligibleSocket, ineligibleSocket);
    const eligibleOffers = [];
    const ineligibleOffers = [];
    eligibleSocket.on("ride:offer", (offer) => eligibleOffers.push(offer));
    ineligibleSocket.on("ride:offer", (offer) => ineligibleOffers.push(offer));

    const offerPromise = waitForOffer(eligibleSocket, ride.id);
    await dispatchService.startDispatch(ride.id);
    const offer = await offerPromise;

    assert.equal(offer.rideId, ride.id);
    assert.equal(offer.rideType, "NORMAL");
    assert.equal(offer.pickupAddress, ride.pickupAddress);
    assert.equal(offer.destinationAddress, ride.destinationAddress);
    assert.equal(offer.pickupLatitude, Number(ride.pickupLatitude));
    assert.equal(offer.pickupLongitude, Number(ride.pickupLongitude));
    assert.equal(typeof offer.distanceToPickupKm, "number");
    assert.equal(eligibleOffers.length, 1);
    assert.equal(
      await waitForNoEvent(ineligibleOffers, 300),
      true
    );
    dispatchService.stopDispatch(ride.id);
  });

  await t.test("stops dispatch after acceptance and cancellation", async () => {
    const passenger = await createUser("PASSENGER");
    const driver = await createUser("DRIVER", "ONLINE", {
      currentLatitude: 33.5138,
      currentLongitude: 36.2765
    });
    await createCar(driver);
    const driverSocket = await connectSocket(server, tokenFor(driver));
    const passengerSocket = await connectSocket(server, tokenFor(passenger));
    sockets.push(driverSocket, passengerSocket);

    const acceptedRide = await createRide(passenger);
    const acceptedOffers = [];
    const acceptedNoDriver = [];
    driverSocket.on("ride:offer", (offer) => {
      if (offer.rideId === acceptedRide.id) acceptedOffers.push(offer);
    });
    passengerSocket.on("ride:no-driver-found", (event) => {
      if (event.rideId === acceptedRide.id) acceptedNoDriver.push(event);
    });
    const acceptedOfferPromise = waitForOffer(driverSocket, acceptedRide.id);
    await dispatchService.startDispatch(acceptedRide.id);
    await acceptedOfferPromise;
    const acceptResponse = await request(
      server,
      "PATCH",
      `/api/rides/${acceptedRide.id}/accept`,
      {},
      tokenFor(driver)
    );
    assert.equal(acceptResponse.statusCode, 200);
    const storedAcceptedRide = await Ride.findByPk(acceptedRide.id);
    const storedDriver = await User.findByPk(driver.id);
    assert.equal(storedAcceptedRide.status, "ACCEPTED");
    assert.equal(storedAcceptedRide.workerId, driver.id);
    assert.equal(storedDriver.driverStatus, "BUSY");
    assert.equal(
      await waitForNoEvent(acceptedOffers, DISPATCH_COMPLETION_WAIT_MS),
      true
    );
    assert.equal(acceptedNoDriver.length, 0);

    await User.update(
      { driverStatus: "ONLINE" },
      { where: { id: driver.id } }
    );
    const cancelledRide = await createRide(passenger);
    const cancelledOffers = [];
    const cancelledNoDriver = [];
    driverSocket.on("ride:offer", (offer) => {
      if (offer.rideId === cancelledRide.id) cancelledOffers.push(offer);
    });
    passengerSocket.on("ride:no-driver-found", (event) => {
      if (event.rideId === cancelledRide.id) cancelledNoDriver.push(event);
    });
    const cancelledOfferPromise = waitForOffer(driverSocket, cancelledRide.id);
    await dispatchService.startDispatch(cancelledRide.id);
    await cancelledOfferPromise;
    const cancelResponse = await request(
      server,
      "PATCH",
      `/api/rides/${cancelledRide.id}/cancel`,
      { cancelReason: "test cancellation" },
      tokenFor(passenger)
    );
    assert.equal(cancelResponse.statusCode, 200);
    const storedCancelledRide = await Ride.findByPk(cancelledRide.id);
    assert.equal(storedCancelledRide.status, "CANCELLED");
    assert.equal(
      await waitForNoEvent(cancelledOffers, DISPATCH_COMPLETION_WAIT_MS),
      true
    );
    assert.equal(cancelledNoDriver.length, 0);
  });

  await t.test("rejects invalid Socket.IO credentials", async () => {
    await assert.rejects(
      connectSocket(server, "invalid-token"),
      /Authentication failed|websocket error|xhr poll error/
    );
  });
});
