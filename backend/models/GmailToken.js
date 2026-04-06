// models/GmailToken.js
const mongoose = require('mongoose');

const GmailTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', unique: true, index: true, required: true },
  refresh_token: { type: String, required: true },
  access_token: { type: String, default: null },
  expiry_date: { type: Number, default: 0 },           // ms epoch
  last_history_id: { type: String, default: null },     // for incremental Gmail History
  last_fetched_at: { type: Date, default: null },
  scopes: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('GmailToken', GmailTokenSchema);
