"use strict";
const request = require('request')
     , packageJSON = require('../package.json');

const send = (to, message, callback) => {
  const options = {
    url: `https://api.telegram.org/bot${process.env.TELEGRAM_API_KEY}/sendMessage?chat_id=${to}&text=${encodeURIComponent(message)}&parse_mode=markdown`,
    headers: {
      'User-Agent': `DailyPixelBot/${packageJSON.version}`
    }
  };
//  console.log(options);
  request.get(options, (e, response, body) => {
    if (body.ok === false) {
      e = body.description;
    }
    return callback(e);
  });
};
module.exports = app => {
  app.post(`/api/v0/cmd/${process.env.TELEGRAM_API_KEY}`, (req, res) => {
    const message = req.body.message;
    console.log(message)
    const commands = {
      'today': (callback) => {
        return callback('today');
      },
      'colors': (callback) => {
        return callback('colors');
      },
      '/start': (callback) => {
        return callback('get over yourself');
      }
    };
    try {
      commands[message.text](answer => {
        send(message.chat.id, answer, e => {
          if (e) {
            throw new Error(e);
          }
        });
      });
    }
    catch (e) {
      send(message.chat.id, "what", e => {
        if (e) {
          throw new Error(e);
        }
      });
    }
    res.sendStatus(200);
  });
}
