"use strict";
const mongoose = require('mongoose');

const yearSchema = new mongoose.Schema({
  userId: {type: String, index: true},
  timezone: String,
  year: {type: Number, index: true},
  content: []
});

module.exports = mongoose.model('Year', yearSchema);
