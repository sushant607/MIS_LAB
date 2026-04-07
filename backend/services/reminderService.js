// JUST FOR TESTING PURPOSE
const Ticket = require('../models/Ticket');
const { createReminderNotification } = require('../routes/notifications');
const cron = require('node-cron');

class ReminderService {
  constructor() {
    this.startReminderCheck();
    // Run immediate check for testing
    setTimeout(() => {
      this.checkAndSendReminders();
    }, 5000); // Check after 5 seconds of startup

    // Cleanup old reminders daily at midnight
    cron.schedule('0 0 * * *', () => {
        this.cleanupOldReminders();
    });
  }

  startReminderCheck() {
    // Check every minute for testing (change back to '0 * * * *' for production)
    cron.schedule('* * * * *', () => {
      this.checkAndSendReminders();
    });
    
    // console.log('Reminder service started - checking every minute for testing');
  }

  async cleanupOldReminders() {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        await Ticket.updateMany(
        {},
        {
            $pull: {
            reminders: {
                isActive: false,
                createdAt: { $lt: oneDayAgo }
            }
            }
        }
        );
        // console.log('Cleaned up old inactive reminders');
    } catch (error) {
        console.error('Error cleaning up reminders:', error);
    }
    }

  async checkAndSendReminders() {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);

      const tickets = await Ticket.find({
        'reminders.isActive': true
      }).populate('reminders.setBy', 'name email');

    //   console.log(`Checking reminders at ${now}. Found ${tickets.length} tickets with reminders.`);

      for (const ticket of tickets) {
        let hasChanges = false;
        for (const reminder of ticket.reminders) {
          if (!reminder.isActive) continue;

          const reminderTime = new Date(reminder.reminderDate);
          const timeDiff = reminderTime - now;
        //   console.log(`Reminder: ${reminder.message}, Time: ${reminderTime}, Now: ${now}`);

          // 1 day before (only if more than 1 day away)
          if (!reminder.notificationsSent.oneDayBefore && 
              timeDiff <= 24 * 60 * 60 * 1000 && 
              timeDiff > 5 * 60 * 60 * 1000) {
            // console.log('Sending 1 day before reminder...');
            await createReminderNotification(reminder.setBy._id, ticket, reminder, '1 day');
            reminder.notificationsSent.oneDayBefore = true;
            hasChanges = true;
          }

          // 5 hours before (only if more than 5 hours away)
          else if (!reminder.notificationsSent.fiveHoursBefore && 
                   timeDiff <= 5 * 60 * 60 * 1000 && 
                   timeDiff > 60 * 60 * 1000) {
            // console.log('Sending 5 hours before reminder...');
            await createReminderNotification(reminder.setBy._id, ticket, reminder, '5 hours');
            reminder.notificationsSent.fiveHoursBefore = true;
            hasChanges = true;
          }

          // 1 hour before (only if more than 1 hour away)
          else if (!reminder.notificationsSent.oneHourBefore && 
                   timeDiff <= 60 * 60 * 1000 && 
                   timeDiff > 60 * 1000) {
            // console.log('Sending 1 hour before reminder...');
            await createReminderNotification(reminder.setBy._id, ticket, reminder, '1 hour');
            reminder.notificationsSent.oneHourBefore = true;
            hasChanges = true;
          }

          // 1 minute before (only if more than 1 minute away)
          else if (!reminder.notificationsSent.oneMinuteBefore && 
                   timeDiff <= 60 * 1000 && 
                   timeDiff > 0) {
            // console.log('Sending 1 minute before reminder...');
            await createReminderNotification(reminder.setBy._id, ticket, reminder, '1 minute');
            reminder.notificationsSent.oneMinuteBefore = true;
            hasChanges = true;
          }

          // Overdue (time has passed)
          else if (timeDiff <= 0 && reminder.isActive) {
            // console.log('Sending overdue reminder...');
            await createReminderNotification(reminder.setBy._id, ticket, reminder, 'overdue');
            reminder.isActive = false;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await ticket.save();
        }
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }
}

module.exports = new ReminderService();

// FOR PRODUCTION USE THIS
// const Ticket = require('../models/Ticket');
// const { createReminderNotification } = require('../routes/notifications');
// const cron = require('node-cron');

// class ReminderService {
//   constructor() {
//     this.startReminderCheck();
//   }

//   startReminderCheck() {
//     // Check every hour for due reminders
//     cron.schedule('0 * * * *', () => {
//       this.checkAndSendReminders();
//     });
    
//     console.log('Reminder service started - checking every hour');
//   }

//   async checkAndSendReminders() {
//     try {
//       const now = new Date();
//       const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
//       const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
//       const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

//       const tickets = await Ticket.find({
//         'reminders.isActive': true,
//         'reminders.reminderDate': { $gte: now }
//       }).populate('reminders.setBy', 'name email');

//       for (const ticket of tickets) {
//         for (const reminder of ticket.reminders) {
//           if (!reminder.isActive) continue;

//           const reminderTime = new Date(reminder.reminderDate);

//           // Check for 1 day before notification
//           if (!reminder.notificationsSent.oneDayBefore && 
//               reminderTime <= oneDayFromNow && reminderTime > fiveHoursFromNow) {
//             await createReminderNotification(reminder.setBy._id, ticket, reminder, '1 day');
//             reminder.notificationsSent.oneDayBefore = true;
//           }

//           // Check for 5 hours before notification
//           if (!reminder.notificationsSent.fiveHoursBefore && 
//               reminderTime <= fiveHoursFromNow && reminderTime > oneHourFromNow) {
//             await createReminderNotification(reminder.setBy._id, ticket, reminder, '5 hours');
//             reminder.notificationsSent.fiveHoursBefore = true;
//           }

//           // Check for 1 hour before notification
//           if (!reminder.notificationsSent.oneHourBefore && 
//               reminderTime <= oneHourFromNow) {
//             await createReminderNotification(reminder.setBy._id, ticket, reminder, '1 hour');
//             reminder.notificationsSent.oneHourBefore = true;
//           }

//           // Deactivate reminder if time has passed
//           if (reminderTime <= now) {
//             reminder.isActive = false;
//           }
//         }

//         await ticket.save();
//       }
//     } catch (error) {
//       console.error('Error checking reminders:', error);
//     }
//   }
// }

// module.exports = new ReminderService();
