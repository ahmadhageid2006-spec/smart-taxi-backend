const assert = require("node:assert/strict");
const test = require("node:test");

test("importing the application does not start an HTTP listener", () => {
  const { server } = require("../app");

  assert.equal(server.listening, false);
});
