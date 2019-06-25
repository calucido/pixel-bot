"use strict";
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {type: String, index: true},
  chatId: {type: String, index: true},
  timezone: String,
  colors: [
    {name: String,
    hex: String,
    mood: String,
    used: Boolean}
  ]
});

module.exports = mongoose.model('User', userSchema);
