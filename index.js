require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const { MongoStore } = require("connect-mongo");

const { dbconfig } = require("./config/db.config");
const routes = require("./route");
const { globalerrorhandler } = require("./utils/globalerror");
const { uploadDir } = require("./utils/upload");
const { apiResponse } = require("./utils/apiResponse");
const messages = require("./utils/messages");

const app = express();
const port = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === "production";

dbconfig();

// The storefront and the dashboard both send the session cookie, so every
// allowed origin has to be listed explicitly when credentials are in play.
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

app.use(session({
  name: "ecommerce-session",
  secret: process.env.SESSION_SECRET,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  store: MongoStore.create({
    mongoUrl: process.env.DB_DATA_URL,
    collectionName: "sessions",
  }),
}));

app.get("/health", (req, res) => apiResponse(res, 200, { en: "API is running", bn: "এপিআই চালু আছে" }, { uptime: process.uptime() }));

app.use(process.env.BASE_ROUTE || "/api/v1", routes);

app.use((req, res) => apiResponse(res, 404, { en: "Route not found", bn: "রুটটি পাওয়া যায়নি" }));
app.use(globalerrorhandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
