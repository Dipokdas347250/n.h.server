const mongoose = require("mongoose");

exports.dbconfig = () => {
  mongoose.connect(process.env.DB_DATA_URL)
    .then(() => console.log("Database connected successfully"))
    .catch((error) => {
      console.error("Database connection failed:", error.message);
      process.exit(1);
    });
};
