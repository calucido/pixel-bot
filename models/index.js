"use strict";
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;

db.on('error', (e) => {
  throw new Error(e);
});
db.once('open', () => {
  require('./user');
  require('./year');
  module.exports.User = mongoose.model('User');
  module.exports.Year = mongoose.model('Year');
});
