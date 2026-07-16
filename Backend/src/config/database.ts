import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const databaseUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cms_db';
    
    await mongoose.connect(databaseUri);
    console.log('[Database] Mongoose connection established successfully.');
  } catch (error) {
    console.error('[Database Ignition Error] Failed to connect to local MongoDB structure', error);
    process.exit(1);
  }
};
