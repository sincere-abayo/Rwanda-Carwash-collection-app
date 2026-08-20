import app, { ensureTablesInit } from "../server/app";
import type { IncomingMessage, ServerResponse } from "http";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureTablesInit();
  return app(req, res);
}
