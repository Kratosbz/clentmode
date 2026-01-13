import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITransaction extends Document {
  type: 'sale' | 'purchase' | 'transfer' | 'mint' | 'bid' | 'auction_win'|'fee'|'conversion'|'sold';
  nft?: Types.ObjectId;
  collection?: Types.ObjectId;
  from: string;
  to: string;
   owner:string;
  amount?: number;
  currency: string;
  txHash?: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  type: { 
    type: String, 
    enum: ['sale', 'purchase', 'transfer', 'mint', 'bid', 'auction_win','fee','conversion','sold'], 
    required: true 
  },
  nft: { type: Schema.Types.ObjectId, ref: 'NFT' },
  collection: { type: Schema.Types.ObjectId, ref: 'Collection' },
  from: { type: String, required: true },
  to: { type: String, required: true },
   owner: { type: String, required: true },
  amount: { type: Number },
  currency: { type: String, default: 'WETH' },
  txHash: { type: String },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  description: { type: String, required: true },
}, { timestamps: true });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
