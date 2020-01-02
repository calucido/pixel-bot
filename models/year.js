"use strict";
const mongoose = require('mongoose');

const yearSchema = new mongoose.Schema({
  username: String,
  chatId: {type: String, index: true},
  timezone: String,
  year: {type: Number, index: true},
  yearType: String,
  content: []
});

module.exports = mongoose.model('Year', yearSchema);
