"use strict";
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true});
const db = mongoose.connection;

module.exports.db = db;

db.on('error', (e) => {
  throw new Error(e);
});
db.once('open', () => {
  require('./user');
  require('./year');
  module.exports.User = mongoose.model('User');
  module.exports.Year = mongoose.model('Year');
});
