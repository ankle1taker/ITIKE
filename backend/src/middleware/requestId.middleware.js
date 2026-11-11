import crypto from "node:crypto";

export const requestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const id =
    typeof incoming === "string" && incoming.length > 0 && incoming.length <= 100
      ? incoming
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
};