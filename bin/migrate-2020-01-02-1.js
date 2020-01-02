"use strict";
const models = require('../models')
    , {send, handleError} = require('../lib/common');

const db = models.db;

db.once('open', () => {
//  console.log('open')
  require('../models/user');
  models.User.find({}).then((users) => {
    for (let j = 0; j < users.length; j++) {
      for (let i = 0; i < users[j].colors.length; i++) {
        users[j].colors[i].name = users[j].colors[i].name.replace('“', '').replace('”', '');
        if (i === (user.colors.length - 1)) { user.save(handleError); }
      }
      if (j === users.length - 1) { process.exit(); }
    }
  }).catch(e => {throw new Error(e)});
});

