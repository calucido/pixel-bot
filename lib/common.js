"use strict";
const request = require('request')
    , packageJSON = require('../package.json');

module.exports.send = (to, message, callback) => {
  const options = {
    url: `https://api.telegram.org/bot${process.env.TELEGRAM_API_KEY}/sendMessage?chat_id=${to}&text=${encodeURIComponent(message)}&parse_mode=markdown`,
    headers: {
      'User-Agent': `DailyPixelBot/${packageJSON.version}`
    }
  };
  request.get(options, (e, response, body) => {
    if (body.ok === false) {
      e = body.description;
    }
    return callback(e);
  });
};

module.exports.sendPhoto = (to, message, photoBuffer, callback) => {
  const options = {
    url: `https://api.telegram.org/bot${process.env.TELEGRAM_API_KEY}/sendPhoto?chat_id=${to}&caption=${encodeURIComponent(message)}&parse_mode=markdown`,
    formData: {
      photo: {
        value: photoBuffer,
        options: {
          filename: "data.png",
          contentType: "image/png"
        }
      }
    },
    headers: {
      'User-Agent': `DailyPixelBot/${packageJSON.version}`
    }
  };
  request.post(options, (e, response, body) => {
    if (body.ok === false) {
      e = body.description;
    }
    return callback(e);
  });
};

module.exports.handleError = e => {
  if (e) {
    throw new Error(e);
  }
};
