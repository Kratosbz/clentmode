import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INFT extends Document {
  name: string;
  description?: string;
  imageUrl: string;
  imagePublicId?: string;
  collectionId?: Types.ObjectId;
  tokenId?: string;
  blockchain: string;
  price?: number;
  currency: string;
  status: 'owned' | 'listed' | 'sold' | 'auction';
  owner: string;
  creator: string;
  royalty: number;
  attributes?: Array<{ trait_type: string; value: string }>;
  tags?:string[];
  views: number;
  likes: number;
  mediaType: 'image' | 'gif' | 'video' | 'audio';
  category: string;
  rarity: string;
  createdAt: Date;
  soldDate?: Date;
  updatedAt: Date;
}

const NFTSchema = new Schema<INFT>({
  name: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String, required: true },
  imagePublicId: { type: String },
  collectionId: { type: Schema.Types.ObjectId, ref: 'Collection' },
  tokenId: { type: String },
  blockchain: { type: String, default: 'Ethereum' },
  price: { type: Number },
  currency: { type: String, default: 'WETH' },
  status: { type: String, enum: ['owned', 'listed', 'sold', 'auction'], default: 'owned' },
  owner: { type: String, default: 'user' },
  creator: { type: String, default: 'user' },
  royalty: { type: Number, default: 0 },
  attributes: [{ trait_type: String, value: String }],
   tags: {
      type: [String],
      default: [],
      index: true,
    },

  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  mediaType: { type: String, enum: ['image', 'gif', 'video', 'audio'], default: 'image' },
  category: { type: String, default: 'Art' },
  rarity: { type: String, default: 'Common' },
  soldDate: { type: Date, default: undefined },
}, { timestamps: true });

export const NFT = mongoose.model<INFT>('NFT', NFTSchema);
