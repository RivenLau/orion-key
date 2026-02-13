import { rm } from "fs/promises";
import { join } from "path";

const nextDir = join(process.cwd(), ".next");
try {
  await rm(nextDir, { recursive: true, force: true });
  console.log("Deleted .next directory");
} catch (e) {
  console.log("No .next directory found or already deleted");
}
