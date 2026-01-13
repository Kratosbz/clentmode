import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IExhibition extends Document {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  bannerUrl?: string;
  bannerPublicId?: string;
  category: string;
  status: 'draft' | 'active' | 'ended';
  startDate: Date;
  endDate: Date;
  locationType: 'virtual' | 'physical';
  virtualUrl?: string;
  physicalAddress?: string;
  nfts: Types.ObjectId[];
  views: number;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
  owner:string;
}

const ExhibitionSchema = new Schema<IExhibition>({
  title: { type: String, required: true },
  description: { type: String },
  thumbnailUrl: { type: String },
  thumbnailPublicId: { type: String },
  bannerUrl: { type: String },
  bannerPublicId: { type: String },
  category: { type: String, required: true },
  status: { type: String, enum: ['draft', 'active', 'ended'], default: 'draft' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  locationType: { type: String, enum: ['virtual', 'physical'], default: 'virtual' },
  virtualUrl: { type: String },
  physicalAddress: { type: String },
  nfts: [{ type: Schema.Types.ObjectId, ref: 'NFT' }],
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  owner: { type: String },
}, { timestamps: true });

export const Exhibition = mongoose.model<IExhibition>('Exhibition', ExhibitionSchema);
