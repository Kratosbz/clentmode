import { db } from "./db";
import {
  stats,
  nfts,
  activities,
  type Stats,
  type Nft,
  type Activity,
  type NftsResponse
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getStats(): Promise<Stats | undefined>;
  getNfts(): Promise<NftsResponse>;
  getActivities(): Promise<Activity[]>;
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getStats(): Promise<Stats | undefined> {
    const result = await db.select().from(stats).limit(1);
    return result[0];
  }

  async getNfts(): Promise<NftsResponse> {
    const allNfts = await db.select().from(nfts);
    const owned = allNfts.filter(n => n.status === 'owned');
    const listed = allNfts.filter(n => n.status === 'listed');
    const liked = allNfts.filter(n => n.status === 'liked');
    
    return {
      owned,
      listed,
      liked,
      counts: {
        owned: owned.length,
        listed: listed.length,
        liked: liked.length
      }
    };
  }

  async getActivities(): Promise<Activity[]> {
    return await db.select().from(activities).orderBy(activities.timestamp);
  }

  async seedData(): Promise<void> {
    const existingStats = await this.getStats();
    if (!existingStats) {
      await db.insert(stats).values({
        totalBalanceUsd: "0.00",
        totalBalanceEth: "0.0000",
        ethBalance: "0.0000",
        wethBalance: "0.0000",
        totalSales: 0,
        avgSalePrice: "0",
        activeListings: 0,
      });
      
      // Add some sample data to test empty states vs populated states
      // Leave empty for now to match screenshot "0" states
    }
  }
}

export const storage = new DatabaseStorage();
