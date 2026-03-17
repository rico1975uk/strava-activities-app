const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");

const indexRouter = require("./routes");

function createApp() {
  const app = express();

  app.set("views", path.join(__dirname, "views"));
  app.set("view engine", "ejs");

  app.use(helmet());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use(
    session({
      name: "strava.sid",
      secret: process.env.SESSION_SECRET || "dev-only-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false
      }
    })
  );

  app.use("/", indexRouter);

  // Basic error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({
      error: {
        message: err.message || "Internal Server Error",
        status
      }
    });
  });

  return app;
}

module.exports = { createApp };

