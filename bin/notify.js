"use strict";
const models = require('../models')
    , {send, handleError} = require('../lib/common')
    , CronJob = require('cron').CronJob;

const db = models.db;

const sendReminders = () => {
  models.User.find({}).then((users) => {
    for (let i = 0; i < users.length; i++) {
      setTimeout(() => {
        send(users[i].chatId, "Remember to set your moods before midnight!", e => {
          if (e) { throw new Error(e); }
        });
      }, 35);
    }
  }).catch(e => {throw new Error(e)});
};

module.exports = () => {
  const lateReminderJob = new CronJob('00 30 23 * * *', () => {
    sendReminders();
  }, null, true, 'America/New_York');
  lateReminderJob.start();
  const earlyReminderJob = new CronJob('00 30 21 * * *', () => {
    sendReminders();
  }, null, true, 'America/New_York');
  earlyReminderJob.start();
};
