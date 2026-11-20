#!/usr/bin/env node
import { runCli } from "./lib/blog-deploy.mjs";

try {
  await runCli(process.argv.slice(2));
} catch (error) {
  console.error("[deploy:blog] " + error.message);
  process.exitCode = 1;
}
