const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

require("dotenv").config();

const { createApp } = require("../../appFactory");
const { User, RefreshToken } = require("../../models/associations");
const sequelize = require("../../config/database");

const makeIdentity = () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    phone: `+integration-${suffix}`,
    email: `integration-auth-${suffix}@example.test`
  };
};

const request = (server, method, path, body) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const address = server.address();
    const clientRequest = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path,
        method,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload)
        }
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          let parsedBody;
          try {
            parsedBody = responseBody ? JSON.parse(responseBody) : null;
          } catch (error) {
            reject(error);
            return;
          }

          resolve({
            statusCode: response.statusCode,
            body: parsedBody
          });
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

const closeTestServer = (server) =>
  new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const cleanupUsers = async (identities) => {
  const phones = identities.map((identity) => identity.phone);
  const emails = identities.map((identity) => identity.email);
  const users = await User.findAll({
    where: {
      [Op.or]: [
        { phone: { [Op.in]: phones } },
        { email: { [Op.in]: emails } }
      ]
    },
    attributes: ["id"]
  });
  const userIds = users.map((user) => user.id);

  if (userIds.length > 0) {
    await RefreshToken.destroy({
      where: { userId: { [Op.in]: userIds } }
    });
    await User.destroy({
      where: { id: { [Op.in]: userIds } }
    });
  }
};

const assertNoSensitiveFields = (body) => {
  assert.equal(Object.prototype.hasOwnProperty.call(body, "password"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(body, "passwordHash"),
    false
  );
};

test("Auth API integration tests", async (t) => {
  assert.equal(
    process.env.NODE_ENV,
    "integration",
    "NODE_ENV must be integration"
  );
  assert.equal(
    process.env.SMART_TAXI_INTEGRATION_DB_NAME,
    "smart_taxi_integration_local"
  );

  const server = await startTestServer();
  const identities = [];

  t.after(async () => {
    try {
      await cleanupUsers(identities);
    } catch (error) {
      throw new Error(`Auth integration cleanup failed: ${error.message}`);
    } finally {
      await closeTestServer(server);
      await sequelize.close();
    }
  });

  await t.test("registers a user and persists a bcrypt hash", async () => {
    const identity = makeIdentity();
    identities.push(identity);
    const password = "RegisterPass123!";

    const response = await request(server, "POST", "/api/auth/register", {
      fullName: "Integration Auth User",
      phone: identity.phone,
      password,
      email: identity.email
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.phone, identity.phone);
    assert.equal(response.body.fullName, "Integration Auth User");
    assert.equal(response.body.role, "PASSENGER");
    assert.ok(response.body.id);
    assertNoSensitiveFields(response.body);

    const user = await User.findByPk(response.body.id);
    assert.ok(user);
    assert.equal(user.phone, identity.phone);
    assert.notEqual(user.password, password);
    assert.equal(await bcrypt.compare(password, user.password), true);
  });

  await t.test("rejects a duplicate phone without creating another user", async () => {
    const identity = makeIdentity();
    identities.push(identity);
    const payload = {
      fullName: "Duplicate Source",
      phone: identity.phone,
      password: "DuplicatePass123!",
      email: identity.email
    };

    const firstResponse = await request(
      server,
      "POST",
      "/api/auth/register",
      payload
    );
    assert.equal(firstResponse.statusCode, 201);

    const duplicateResponse = await request(
      server,
      "POST",
      "/api/auth/register",
      {
        ...payload,
        fullName: "Duplicate Attempt",
        email: `duplicate-${identity.email}`
      }
    );

    assert.equal(duplicateResponse.statusCode, 409);
    assert.equal(
      duplicateResponse.body.error,
      "User with this phone number already exists"
    );

    assert.equal(
      await User.count({ where: { phone: identity.phone } }),
      1
    );
  });

  for (const [field, payload] of [
    ["fullName", { phone: makeIdentity().phone, password: "MissingPass123!" }],
    ["phone", { fullName: "Missing Phone", password: "MissingPass123!" }],
    ["password", { fullName: "Missing Password", phone: makeIdentity().phone }]
  ]) {
    await t.test(`rejects registration with missing ${field}`, async () => {
      const identity = makeIdentity();
      if (payload.phone) {
        payload.phone = identity.phone;
      }
      if (!payload.phone) {
        payload.email = identity.email;
      }
      identities.push(identity);

      const response = await request(
        server,
        "POST",
        "/api/auth/register",
        payload
      );

      assert.equal(response.statusCode, 400);
      assert.equal(response.body.error, "Validation failed");
      assert.ok(
        response.body.details.some((detail) => detail.field === field)
      );
      assert.equal(
        await User.count({
          where: {
            [Op.or]: [
              { phone: identity.phone },
              { email: identity.email }
            ]
          }
        }),
        0
      );
    });
  }

  await t.test("logs in and returns a valid access and refresh token", async () => {
    const identity = makeIdentity();
    identities.push(identity);
    const password = "LoginPass123!";

    const registerResponse = await request(
      server,
      "POST",
      "/api/auth/register",
      {
        fullName: "Login Integration User",
        phone: identity.phone,
        password,
        email: identity.email
      }
    );
    assert.equal(registerResponse.statusCode, 201);

    const response = await request(server, "POST", "/api/auth/login", {
      phone: identity.phone,
      password
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.token);
    assert.ok(response.body.refreshToken);
    assert.equal(response.body.id, registerResponse.body.id);
    assert.equal(response.body.phone, identity.phone);
    assert.equal(response.body.role, "PASSENGER");
    assertNoSensitiveFields(response.body);

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    assert.equal(decoded.id, registerResponse.body.id);
    assert.equal(decoded.role, "PASSENGER");
  });

  await t.test("rejects login with a wrong password", async () => {
    const identity = makeIdentity();
    identities.push(identity);
    const password = "CorrectPass123!";

    const registerResponse = await request(
      server,
      "POST",
      "/api/auth/register",
      {
        fullName: "Wrong Password User",
        phone: identity.phone,
        password,
        email: identity.email
      }
    );
    assert.equal(registerResponse.statusCode, 201);

    const response = await request(server, "POST", "/api/auth/login", {
      phone: identity.phone,
      password: "WrongPass123!"
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, "Invalid credentials");
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.refreshToken, undefined);
  });

  await t.test("rejects login for a nonexistent user", async () => {
    const identity = makeIdentity();

    const response = await request(server, "POST", "/api/auth/login", {
      phone: identity.phone,
      password: "UnknownPass123!"
    });

    assert.equal(response.statusCode, 401);
    assert.equal(response.body.error, "Invalid credentials");
    assert.equal(response.body.token, undefined);
    assert.equal(response.body.refreshToken, undefined);
  });
});
