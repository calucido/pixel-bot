"use strict";
const models = require('../models')
    , {send, handleError} = require('../lib/common');

const db = models.db;

db.once('open', () => {
//  console.log('open')
  require('../models/user');
  models.User.find({}).then((users) => {
    for (let i = 0; i < users.length; i++) {
      setTimeout(() => {
        send(users[i].chatId, "Remember to set your moods before midnight!", e => {
          if (e) { throw new Error(e); }
          if (i === users.length - 1) { process.exit(); }
        });
      }, 35);
    }
  }).catch(e => {throw new Error(e)});
});
