import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISale extends Document {
  nft: Types.ObjectId;
  price: number;
  currency: string;
  status: 'active' | 'sold' | 'cancelled'|'listed';
  seller: string;
  buyer?: string;
  listedDate: Date;
  soldDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  
}

const SaleSchema = new Schema<ISale>({
  nft: { type: Schema.Types.ObjectId, ref: 'NFT', required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'WETH' },
  status: { type: String, enum: ['active', 'sold', 'cancelled','listed'], default: 'active' },
  seller: { type: String, default: 'user' },
  buyer: { type: String },
  listedDate: { type: Date, default: Date.now },
  soldDate: { type: Date },
}, { timestamps: true });

export const Sale = mongoose.model<ISale>('Sale', SaleSchema);
