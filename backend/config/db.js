const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'MONGO_URI_PLACEHOLDER';

module.exports = async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, { });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
