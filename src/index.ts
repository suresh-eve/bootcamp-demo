/**
 * Eve Trainer — Entry Point
 *
 * Sprint 1: starts the Express HTTP API server.
 * The LearnerProfile endpoint is available at:
 *
 *   GET /members/:member_id/learner-profile
 *
 * Sprint 0 batch test runner is retained below for reference.
 *
 * Environment variables:
 *   PORT              — HTTP port (default 3000)
 *   DATA_ADAPTER      — "mock" | "real" (default "mock")
 */

import { createApp } from "./api/server";

const PORT = parseInt(process.env["PORT"] ?? "3000", 10);

const app = createApp();

app.listen(PORT, () => {
  console.log(`Eve Trainer API server running on http://localhost:${PORT}`);
  console.log(`  GET /health`);
  console.log(`  GET /members/:member_id/learner-profile`);
});
