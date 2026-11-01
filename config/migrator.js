const path = require("path");
const { Umzug, SequelizeStorage } = require("umzug");
const sequelize = require("./database");

const migrator = new Umzug({
  migrations: {
    glob: "migrations/*.js",
    cwd: path.join(__dirname, ".."),

    resolve: ({ name, path: migrationPath, context }) => {
      const migration = require(migrationPath);

      return {
        name,

        up: async () => migration.up({ context }),

        down: async () => migration.down({ context }),
      };
    },
  },

  context: sequelize.getQueryInterface(),

  storage: new SequelizeStorage({
    sequelize,
    tableName: "SequelizeMeta",
  }),

  logger: console,
});

module.exports = migrator;