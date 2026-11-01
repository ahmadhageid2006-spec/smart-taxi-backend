const assert = require("node:assert/strict");
const test = require("node:test");

const notificationService = require("../services/notificationService");
const { Notification } = require("../models/associations");

test("notification deduplication keys include ride, event, and recipient", () => {
  assert.equal(
    notificationService.getDeduplicationKey(12, "RIDE_ACCEPTED", 34),
    "ride:12:RIDE_ACCEPTED:recipient:34"
  );
});

test("notification serialization excludes internal ownership and deduplication fields", () => {
  const serialized = notificationService.serializeNotification({
    id: 1,
    userId: 34,
    type: "RIDE_ACCEPTED",
    title: "title",
    message: "message",
    metadata: { rideId: 12 },
    rideId: 12,
    readAt: null,
    deduplicationKey: "internal",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  });

  assert.deepEqual(Object.keys(serialized), [
    "id",
    "type",
    "title",
    "message",
    "metadata",
    "rideId",
    "readAt",
    "createdAt",
    "updatedAt"
  ]);
  assert.equal("userId" in serialized, false);
  assert.equal("deduplicationKey" in serialized, false);
});

test("notification creation does not swallow unrelated unique constraint errors", async () => {
  const originalCreate = Notification.create;
  const unrelatedError = Object.assign(
    new Error("duplicate phone"),
    {
      name: "SequelizeUniqueConstraintError",
      fields: { phone: "existing" }
    }
  );

  Notification.create = async () => {
    throw unrelatedError;
  };

  try {
    await assert.rejects(
      notificationService.createNotification({
        userId: 10,
        recipientRole: "PASSENGER",
        type: notificationService.NOTIFICATION_TYPES.RIDE_ACCEPTED,
        rideId: 20
      }),
      (error) => error === unrelatedError
    );
  } finally {
    Notification.create = originalCreate;
  }
});
