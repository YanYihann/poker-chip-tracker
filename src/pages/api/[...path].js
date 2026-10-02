import { createApp } from "../../../server/dist/app.js";

const app = createApp();
export const config = { api: { bodyParser: false, externalResolver: true } };
export default function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.url?.split("?")[0] === "/api/health") req.url = "/health";
  return app(req, res);
}
