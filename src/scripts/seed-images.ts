import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";

const DATASET_DIR = path.join(process.cwd(), "dataset/images");

async function main() {
  const entries = await fs.readdir(DATASET_DIR, { withFileTypes: true });
  const categories = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  let created = 0;
  let skipped = 0;

  for (const category of categories) {
    const categoryDir = path.join(DATASET_DIR, category);
    const files = await fs.readdir(categoryDir);

    for (const file of files) {
      const filePath = path.join(categoryDir, file);
      const existing = await prisma.image.findFirst({ where: { filePath } });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.image.create({
        data: { filePath, category, status: "pending" },
      });
      created++;
    }
  }

  console.log(
    `Seeded ${created} new images, skipped ${skipped} already-seeded.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
