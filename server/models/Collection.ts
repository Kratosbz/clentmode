import mongoose, { Document, Schema } from 'mongoose';

export interface ICollection extends Document {
  name: string;
  symbol: string;
  description?: string;
  category: string;
  imageUrl?: string;
  imagePublicId?: string;
  bannerUrl?: string;
  bannerPublicId?: string;
  royalty: number;
  blockchain: string;
  contractAddress?: string;
  nftCount: number;
  owner:string;
  totalVolume: number;
  floorPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionSchema = new Schema<ICollection>({
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  imageUrl: { type: String },
  imagePublicId: { type: String },
  bannerUrl: { type: String },
  bannerPublicId: { type: String },
  royalty: { type: Number, default: 0, min: 0, max: 10 },
  blockchain: { type: String, default: 'Ethereum' },
  contractAddress: { type: String },
  owner:{ type: String },
  nftCount: { type: Number, default: 0 },
  totalVolume: { type: Number, default: 0 },
  floorPrice: { type: Number, default: 0 },
}, { timestamps: true });

export const Collection = mongoose.model<ICollection>('Collection', CollectionSchema);
