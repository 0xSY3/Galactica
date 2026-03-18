import type { Application } from "express";
import { getMoltbookStatus } from "../moltbook.js";

export function registerMoltbookRoutes(app: Application): void {
  app.get("/moltbook/status", (_req, res) => {
    res.json(getMoltbookStatus());
  });
}
