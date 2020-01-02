"use strict";
const models = require('../models')
    , {send, handleError} = require('../lib/common');

const db = models.db;

db.once('open', () => {
//  console.log('open')
  require('../models/user');
  models.User.find({}).then((users) => {
    for (let user of users) {
      for (let color of user.colors) {
        color.name = color.name.replace('“', '').replace('”', '');
        user.save(handleError);
      }
    }
  }).catch(e => {throw new Error(e)});
});

