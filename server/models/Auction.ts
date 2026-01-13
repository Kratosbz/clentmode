import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBid {
  bidder: string;
  amount: number;
  timestamp: Date;
}

export interface IAuction extends Document {
  nft: Types.ObjectId;
  auctionType: 'english' | 'dutch' | 'sealed';
  startingPrice: number;
  reservePrice?: number;
  minimumBid: number;
  bidIncrement: number;
  currency: string;
  currentBid?: number;
  bids: IBid[];
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'active' | 'ended' | 'cancelled';
  seller: string;
  winner?: string;
  createdAt: Date;
  updatedAt: Date;
  owner:string;
}

const BidSchema = new Schema({
  bidder: { type: String, required: true },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const AuctionSchema = new Schema<IAuction>({
  nft: { type: Schema.Types.ObjectId, ref: 'NFT', required: true },
  auctionType: { type: String, enum: ['english', 'dutch', 'sealed'], default: 'english' },
  startingPrice: { type: Number, required: true },
  reservePrice: { type: Number },
  minimumBid: { type: Number, required: true },
  bidIncrement: { type: Number, required: true },
  currency: { type: String, default: 'WETH' },
  currentBid: { type: Number },
  bids: [BidSchema],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'active', 'ended', 'cancelled'], default: 'pending' },
  seller: { type: String, default: 'user' },
   owner: { type: String, default: 'user' },
  winner: { type: String },
  
}, { timestamps: true });

export const Auction = mongoose.model<IAuction>('Auction', AuctionSchema);
