"use strict";
const models = require('../models')
    , {send, handleError} = require('../lib/common');

const db = models.db;

db.once('open', () => {
 console.log('open')
  require('../models/user');
  models.User.find({}).then((users) => {
    console.log(users)
    users.forEach(user => {
      console.log(user, send)
      setTimeout(() => {
        send(user.chatId, "Remember to set your moods before midnight!", handleError);
      }, 35);
    });
  }).catch(e => {throw new Error(e)});
});
