"use strict";
const mongoose = require('mongoose')
    , {send, handleError} = require('../lib/common');

mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;

db.on('error', (e) => {
  throw new Error(e);
});
db.once('open', () => {
 console.log('open')
  require('../models/user');
  const User = mongoose.model('User');
  User.find({}).then((users) => {
    console.log(users)
    users.forEach(user => {
      console.log(user, send)
        send(user.chatId, "Remember to set your moods before midnight!", handleError);
    });
  }).catch(e => {throw new Error(e)});
});
