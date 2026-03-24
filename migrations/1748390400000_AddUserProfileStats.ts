import type { ColumnDefinitions, MigrationBuilder } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns("users", {
    wins: { type: "integer", notNull: true, default: 0 },
    losses: { type: "integer", notNull: true, default: 0 },
    abandoned_games: { type: "integer", notNull: true, default: 0 },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns("users", ["wins", "losses", "abandoned_games"]);
}
