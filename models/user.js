"use strict";
const mongoose = require('mongoose')
    , crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: {type: String, index: true},
  chatId: {type: String, index: true},
  timezone: String,
  colors: [
    {name: String,
    hex: String,
    mood: String,
    used: Boolean}
  ],
  publicKey: String,
  state: String
});

userSchema.methods.encrypt = (data, callback) => {
  try {
    callback(null, crypto.encryptPublic(this.publicKey, Buffer.from(data)));
  } catch(e) { callback(e, false); }
};

userSchema.methods.decrypt = (privateKey, data, callback) => {
  try {
    callback(null, crypto.decryptPrivate(privateKey, data));
  } catch(e) { callback(e, false); }
};

module.exports = mongoose.model('User', userSchema);
