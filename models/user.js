"use strict";
const bcrypt = require('bcrypt')
    , mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {type: String, index: true},
  colors: [
    {name: String,
    hex: String,
    mood: String,
    used: Boolean}
  ]
});

module.exports = mongoose.model('User', userSchema);
