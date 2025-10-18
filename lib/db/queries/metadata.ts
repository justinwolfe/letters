/**
 * Metadata-related database queries
 */

import Database from 'better-sqlite3';

export class MetadataQueries {
  constructor(private db: Database.Database) {}

  /**
   * Get the last sync date from metadata
   *
   * @returns The last sync date as ISO string, or undefined if never synced
   *
   * @example
   * ```typescript
   * const lastSync = queries.metadata.getLastSyncDate();
   * if (lastSync) {
   *   console.log(`Last synced: ${lastSync}`);
   * } else {
   *   console.log('Never synced');
   * }
   * ```
   */
  getLastSyncDate(): string | undefined {
    const stmt = this.db.prepare(`
      SELECT value FROM sync_metadata WHERE key = ?
    `);

    const row = stmt.get('last_sync_date') as { value: string } | undefined;
    return row?.value;
  }

  /**
   * Update sync metadata with a key-value pair
   *
   * @param key - The metadata key
   * @param value - The metadata value
   *
   * @example
   * ```typescript
   * queries.metadata.updateSyncMetadata('last_sync_date', new Date().toISOString());
   * ```
   */
  updateSyncMetadata(key: string, value: string): void {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    stmt.run(key, value, now);
  }
}
