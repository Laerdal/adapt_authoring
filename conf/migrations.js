module.exports = {
  mongodb: {
    url: "mongodb://127.0.0.1:27017/adapt-tenant-master",
    databaseName: "adapt-tenant-master"
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  useFileHash: false
};