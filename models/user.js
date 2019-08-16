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

userSchema.methods.generateKeyPair = callback => {
  return crypto.generateKeyPair('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  }, (e, publicKey, privateKey) => {
    return callback(e, publicKey, privateKey);
  });
};

userSchema.methods.encrypt = (data, callback) => {
  try {
    return callback(null, crypto.publicEncrypt(this.publicKey, Buffer.from(data)));
  } catch(e) { return callback(e, false); }
};

userSchema.methods.decrypt = (privateKey, data, callback) => {
  try {
    return callback(null, crypto.privateDecrypt(privateKey, data));
  } catch(e) { return callback(e, false); }
};

module.exports = mongoose.model('User', userSchema);
