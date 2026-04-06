const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title:{type:String},
  message:{type:String},
  type: {
    type: String,
    enum: ["success", "warning", "error", "info", "manager_reminder","self_reminder","status_change"], 
    default: "info",
  },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  actionUrl: {type:String},
  ticketID:{type:String}

});

module.exports = mongoose.model('Notification', NotificationSchema);
