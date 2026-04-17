import type { DataSource } from "@commit-analyzer/database";
import { NotFoundException } from "@nestjs/common";

export async function assertRepoOwnership(
  ds: DataSource,
  repoId: string,
  userId: string,
): Promise<void> {
  const result: { id: string }[] = await ds.query(
    `SELECT id FROM repositories WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [repoId, userId],
  );
  if (result.length === 0) {
    throw new NotFoundException("repository not found");
  }
}
