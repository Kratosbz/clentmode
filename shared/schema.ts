import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const stats = pgTable("stats", {
  id: serial("id").primaryKey(),
  totalBalanceUsd: numeric("total_balance_usd").notNull(),
  totalBalanceEth: numeric("total_balance_eth").notNull(),
  ethBalance: numeric("eth_balance").notNull(),
  wethBalance: numeric("weth_balance").notNull(),
  totalSales: integer("total_sales").notNull(),
  avgSalePrice: numeric("avg_sale_price").notNull(),
  activeListings: integer("active_listings").notNull(),
});

export const nfts = pgTable("nfts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  collection: text("collection").notNull(),
  imageUrl: text("image_url"),
  status: text("status", { enum: ["owned", "listed", "liked"] }).notNull(),
  price: numeric("price"),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'sale', 'purchase', 'listing', 'transfer'
  description: text("description").notNull(),
  amount: numeric("amount"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// === SCHEMAS ===
export const insertStatsSchema = createInsertSchema(stats).omit({ id: true });
export const insertNftSchema = createInsertSchema(nfts).omit({ id: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, timestamp: true });

// === EXPLICIT TYPES ===
export type Stats = typeof stats.$inferSelect;
export type Nft = typeof nfts.$inferSelect;
export type Activity = typeof activities.$inferSelect;

export type NftResponse = Nft;
export type StatsResponse = Stats;
export type ActivityResponse = Activity;

export type NftsResponse = {
  owned: Nft[];
  listed: Nft[];
  liked: Nft[];
  counts: {
    owned: number;
    listed: number;
    liked: number;
  }
};
