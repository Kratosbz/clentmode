import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://Harcourt:eckankar2757101@testcluster.hlwy0.gcp.mongodb.net/vault?retryWrites=true&w=majority";

export async function connectMongoDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

export { mongoose };
