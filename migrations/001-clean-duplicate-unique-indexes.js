module.exports = {
  async up({ context: queryInterface }) {
    for (let i = 2; i <= 18; i++) {
      await queryInterface.removeIndex("users", `phone_${i}`);
    }

    for (let i = 2; i <= 18; i++) {
      await queryInterface.removeIndex("users", `email_${i}`);
    }

    await queryInterface.removeIndex("cars", "plateNumber_2");
  },

  async down({ context: queryInterface }) {
    for (let i = 2; i <= 18; i++) {
      await queryInterface.addIndex("users", ["phone"], {
        unique: true,
        name: `phone_${i}`,
      });
    }

    for (let i = 2; i <= 18; i++) {
      await queryInterface.addIndex("users", ["email"], {
        unique: true,
        name: `email_${i}`,
      });
    }

    await queryInterface.addIndex("cars", ["plateNumber"], {
      unique: true,
      name: "plateNumber_2",
    });
  },
};