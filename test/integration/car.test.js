const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const { createApp } = require("../../appFactory");
const { User, Car, RefreshToken } = require("../../models/associations");
const sequelize = require("../../config/database");

let sequence = 0;

const makeIdentity = (role) => {
  const suffix = `${Date.now()}-${process.pid}-${sequence++}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return {
    fullName: `Car Integration ${role}`,
    phone: `+car-${suffix}`,
    email: `car-${suffix}@example.test`
  };
};

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

const startTestServer = () => {
  const server = http.createServer(createApp());

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
};

const closeTestServer = async (server) => {
  if (!server || !server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};

const createUserFixture = async (role, driverStatus = "OFFLINE") => {
  const identity = makeIdentity(role);
  const password = "CarFixturePass123!";
  const user = await User.create({
    fullName: identity.fullName,
    phone: identity.phone,
    email: identity.email,
    password: await bcrypt.hash(password, 10),
    role,
    driverStatus
  });

  return {
    user,
    token: jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    )
  };
};

const carPayload = (overrides = {}) => ({
  type: "NORMAL",
  manufacturer: "Toyota",
  model: "Corolla",
  color: "White",
  plateNumber: `CAR-${Date.now()}-${sequence++}`,
  ...overrides
});

const assertValidationError = (response, field) => {
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Validation failed");
  assert.ok(response.body.details.some((detail) => detail.field === field));
};

const assertNoCarForUser = async (userId) => {
  assert.equal(await Car.count({ where: { userId } }), 0);
};

const cleanupFixtures = async (carIds, userIds) => {
  const failures = [];

  for (const { id: carId, ownerId } of carIds) {
    try {
      const car = await Car.findByPk(carId, { attributes: ["id", "userId"] });
      if (car) {
        if (car.userId !== ownerId) {
          throw new Error(
            `Refusing to delete Car ${carId}: owner ${car.userId} does not match fixture owner ${ownerId}`
          );
        }
        await Car.destroy({ where: { id: carId, userId: ownerId } });
      }
    } catch (error) {
      failures.push(`Car ${carId}: ${error.message}`);
    }
  }

  try {
    if (userIds.length > 0) {
      await RefreshToken.destroy({
        where: { userId: userIds }
      });
    }
  } catch (error) {
    failures.push(`RefreshTokens: ${error.message}`);
  }

  for (const userId of userIds) {
    try {
      await User.destroy({ where: { id: userId } });
    } catch (error) {
      failures.push(`User ${userId}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Car integration cleanup failed: ${failures.join("; ")}`);
  }
};

test("Car API integration tests", async (t) => {
  assert.equal(
    process.env.NODE_ENV,
    "integration",
    "NODE_ENV must be integration"
  );
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_NAME,
    "smart_taxi_integration_local"
  );
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_USER,
    "smart_taxi_integration"
  );

  let server;
  const carIds = [];
  const userIds = [];

  t.after(async () => {
    const failures = [];
    try {
      await cleanupFixtures(carIds, userIds);
    } catch (error) {
      failures.push(error.message);
    }
    try {
      await closeTestServer(server);
    } catch (error) {
      failures.push(`HTTP server cleanup: ${error.message}`);
    }
    try {
      await sequelize.close();
    } catch (error) {
      failures.push(`Sequelize cleanup: ${error.message}`);
    }
    if (failures.length > 0) {
      throw new Error(failures.join("; "));
    }
  });

  server = await startTestServer();

  const fixture = async (role = "DRIVER", driverStatus = "OFFLINE") => {
    const result = await createUserFixture(role, driverStatus);
    userIds.push(result.user.id);
    return result;
  };

  const createCar = async (driver, payload = carPayload()) => {
    const response = await request(
      server,
      "POST",
      "/api/cars/",
      payload,
      driver.token
    );
    if (response.statusCode === 201 && response.body.id) {
      carIds.push({ id: response.body.id, ownerId: driver.user.id });
    }
    return response;
  };

  await t.test("creates and retrieves a valid Car", async () => {
    const driver = await fixture();
    const payload = carPayload();
    const createResponse = await createCar(driver, payload);

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createResponse.body.userId, driver.user.id);
    for (const field of ["type", "manufacturer", "model", "color", "plateNumber"]) {
      assert.equal(createResponse.body[field], payload[field]);
    }

    const stored = await Car.findByPk(createResponse.body.id);
    assert.ok(stored);
    assert.equal(stored.userId, driver.user.id);
    assert.equal(await Car.count({ where: { userId: driver.user.id } }), 1);

    const getResponse = await request(
      server,
      "GET",
      "/api/cars/me",
      {},
      driver.token
    );
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.body.id, createResponse.body.id);
    assert.equal(getResponse.body.userId, driver.user.id);
    assert.equal(getResponse.body.plateNumber, payload.plateNumber);
  });

  await t.test("returns 404 when the Driver has no Car", async () => {
    const driver = await fixture();
    const response = await request(
      server,
      "GET",
      "/api/cars/me",
      {},
      driver.token
    );

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error, "Car not found");
    await assertNoCarForUser(driver.user.id);
  });

  await t.test("prevents a second Car for the same Driver", async () => {
    const driver = await fixture();
    const first = await createCar(driver);
    const second = await createCar(driver);

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 409);
    assert.equal(second.body.error, "السائق عنده سيارة مسبقاً");
    assert.equal(await Car.count({ where: { userId: driver.user.id } }), 1);
  });

  await t.test("prevents duplicate plate numbers", async () => {
    const driverA = await fixture();
    const driverB = await fixture();
    const payload = carPayload();
    const first = await createCar(driverA, payload);
    const second = await createCar(driverB, carPayload({ plateNumber: payload.plateNumber }));

    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 409);
    assert.equal(second.body.error, "رقم اللوحة مستخدم بالفعل");
    assert.equal(await Car.count({ where: { plateNumber: payload.plateNumber } }), 1);
    await assertNoCarForUser(driverB.user.id);
  });

  for (const field of ["type", "manufacturer", "model", "color", "plateNumber"]) {
    await t.test(`rejects a missing ${field}`, async () => {
      const driver = await fixture();
      const payload = carPayload();
      delete payload[field];
      const response = await createCar(driver, payload);

      assertValidationError(response, field);
      await assertNoCarForUser(driver.user.id);
    });
  }

  await t.test("rejects unsupported, empty, and non-string values", async () => {
    const cases = [
      ["type", { type: "PREMIUM" }],
      ["manufacturer", { manufacturer: "" }],
      ["model", { model: 123 }],
      ["color", { color: "" }],
      ["plateNumber", { plateNumber: 123 }]
    ];

    for (const [field, overrides] of cases) {
      const driver = await fixture();
      const response = await createCar(driver, carPayload(overrides));
      assertValidationError(response, field);
      await assertNoCarForUser(driver.user.id);
    }
  });

  for (const [role, expectedStatus] of [
    ["unauthenticated", 401],
    ["PASSENGER", 403],
    ["ADMIN", 403]
  ]) {
    await t.test(`rejects ${role} access to all Car endpoints`, async () => {
      const user = role === "unauthenticated" ? null : await fixture(role);
      const token = user ? user.token : undefined;
      const before = user ? await Car.count({ where: { userId: user.user.id } }) : null;
      const requests = [
        ["POST", "/api/cars/", carPayload()],
        ["GET", "/api/cars/me", {}],
        ["PATCH", "/api/cars/me", { color: "Black" }],
        ["DELETE", "/api/cars/me", {}]
      ];

      for (const [method, path, body] of requests) {
        const response = await request(server, method, path, body, token);
        assert.equal(response.statusCode, expectedStatus);
        assert.ok(response.body.error);
      }

      if (user) {
        assert.equal(await Car.count({ where: { userId: user.user.id } }), before);
      }
    });
  }

  await t.test("uses the authenticated Driver as Car owner", async () => {
    const driverA = await fixture();
    const driverB = await fixture();
    const response = await createCar(
      driverA,
      carPayload({ userId: driverB.user.id })
    );

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.userId, driverA.user.id);
    assert.equal(await Car.count({ where: { userId: driverB.user.id } }), 0);
  });

  await t.test("updates permitted fields and preserves ownership", async () => {
    const driverA = await fixture();
    const driverB = await fixture();
    const created = await createCar(driverA);
    const response = await request(
      server,
      "PATCH",
      "/api/cars/me",
      {
        type: "COMFORT",
        manufacturer: "Honda",
        model: "Civic",
        color: "Black",
        plateNumber: carPayload().plateNumber,
        userId: driverB.user.id
      },
      driverA.token
    );

    assert.equal(created.statusCode, 201);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.userId, driverA.user.id);
    assert.equal(response.body.type, "COMFORT");
    assert.equal(response.body.manufacturer, "Honda");
    assert.equal(response.body.model, "Civic");
    assert.equal(response.body.color, "Black");
    assert.equal(await Car.count({ where: { userId: driverB.user.id } }), 0);
  });

  await t.test("supports partial updates", async () => {
    const driver = await fixture();
    const created = await createCar(driver);
    const response = await request(
      server,
      "PATCH",
      "/api/cars/me",
      { color: "Blue" },
      driver.token
    );

    assert.equal(created.statusCode, 201);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.color, "Blue");
    assert.equal(response.body.manufacturer, created.body.manufacturer);
    assert.equal(response.body.plateNumber, created.body.plateNumber);
  });

  await t.test("rejects invalid updates without changing the Car", async () => {
    const driver = await fixture();
    const created = await createCar(driver);
    const response = await request(
      server,
      "PATCH",
      "/api/cars/me",
      { type: "PREMIUM" },
      driver.token
    );

    assert.equal(created.statusCode, 201);
    assertValidationError(response, "type");
    const stored = await Car.findByPk(created.body.id);
    assert.equal(stored.type, created.body.type);
    assert.equal(stored.plateNumber, created.body.plateNumber);
  });

  await t.test("prevents duplicate plates during update", async () => {
    const driverA = await fixture();
    const driverB = await fixture();
    const carA = await createCar(driverA);
    const carB = await createCar(driverB);
    const response = await request(
      server,
      "PATCH",
      "/api/cars/me",
      { plateNumber: carB.body.plateNumber },
      driverA.token
    );

    assert.equal(carA.statusCode, 201);
    assert.equal(carB.statusCode, 201);
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.error, "Plate number is already in use");

    const storedA = await Car.findByPk(carA.body.id);
    const storedB = await Car.findByPk(carB.body.id);
    assert.equal(storedA.plateNumber, carA.body.plateNumber);
    assert.equal(storedB.plateNumber, carB.body.plateNumber);
  });

  await t.test("returns 404 when updating or deleting without a Car", async () => {
    const driver = await fixture();
    const updateResponse = await request(
      server,
      "PATCH",
      "/api/cars/me",
      { color: "Blue" },
      driver.token
    );
    const deleteResponse = await request(
      server,
      "DELETE",
      "/api/cars/me",
      {},
      driver.token
    );

    assert.equal(updateResponse.statusCode, 404);
    assert.equal(updateResponse.body.error, "Car not found");
    assert.equal(deleteResponse.statusCode, 404);
    assert.equal(deleteResponse.body.error, "Car not found");
    await assertNoCarForUser(driver.user.id);
  });

  for (const driverStatus of ["ONLINE", "BUSY"]) {
    await t.test(`blocks deletion while Driver is ${driverStatus}`, async () => {
      const driver = await fixture("DRIVER", driverStatus);
      const created = await createCar(driver);
      const response = await request(
        server,
        "DELETE",
        "/api/cars/me",
        {},
        driver.token
      );

      assert.equal(created.statusCode, 201);
      assert.equal(response.statusCode, 409);
      assert.equal(
        response.body.error,
        "Driver cannot delete the car while ONLINE or BUSY."
      );
      assert.ok(await Car.findByPk(created.body.id));
    });
  }

  await t.test("deletes an offline Driver's Car", async () => {
    const driver = await fixture();
    const created = await createCar(driver);
    const response = await request(
      server,
      "DELETE",
      "/api/cars/me",
      {},
      driver.token
    );

    assert.equal(created.statusCode, 201);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message, "Car deleted successfully");
    assert.equal(await Car.findByPk(created.body.id), null);
    const trackedIndex = carIds.findIndex(
      (car) => car.id === created.body.id
    );
    if (trackedIndex !== -1) {
      carIds.splice(trackedIndex, 1);
    }
  });
});
