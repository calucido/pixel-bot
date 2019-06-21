"use strict";
const request = require('request')
    , packageJSON = require('../package.json')
    , models = require('../models');

const send = (to, message, callback) => {
  if (to !== '379133893') {
     message = "Hey! You're not my developer. Get out of here (for now)!"
  }
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
    if (message.text.match(/^\/start/i) {
      models.User.findOne({userId: message.from.username}).then((e, user) => {
        if (e) { throw new Error(e); }
        if (results.length) {
          return send(message.chat.id, "I already know you!", e => {
            if (e) {
              throw new Error(e);
            }
          });
        }

        let user = new models.User({userId: message.from.username})
        user.save(e => {if (e) { throw new Error(e); }});
      });
    }
    models.User.findOne({userId: message.from.username}).then((e, user) => {
      if (e) { throw new Error(e); }
      if (message.text.match(/^(am)|(pm)/i)) { // see if it's a mood log "am" or "pm"
        let yearType = message.text.match(/^(am)|(pm)/i)[0].toLowerCase();
        let today = new Date();
        models.Year.findOne({userId: message.from.username, year: today.getYear(), yearType}, (e, year) => {

          // correct missed months/days
          while (year.content.length < (today.getMonth() + 1)) {  // today.getMonth() returns the array number of the month, which starts at 0; length returns a count, which starts at 1
            year.content.push([]);
          }
          while (year.content[today.getMonth()].length < (today.getDate() - 1)) {  // today.getDate() returns the REAL date, which starts at 1; length returns a count, which starts at 1. June 21 is year.content[5][20]
            year.content[today.getMonth()].push('');
          }
    
          // check whether today has already been defined, and then set
          let color = message.text.replace(yearType, '').replace(/ */, '').toLowerCase();
          if (year.content[today.getMonth()][today.getDate() - 1]) {
            year.content[today.getMonth()][today.getDate() - 1] = color;
            send(message.chat.id, `Overwrote ${yearType} mood for ${today.getYear()}-${today.getMonth() + 1}-${today.getDate()} as ${color}.`, e => {
              if (e) {
                throw new Error(e);
              }
            });
          } else {
            year.content[today.getMonth()].push(color);
            send(message.chat.id, `Added ${yearType} mood for ${today.getYear()}-${today.getMonth() + 1}-${today.getDate()} as ${color}.`, e => {
              if (e) {
                throw new Error(e);
              }
            });
          }
        });
      } else if (message.text.match(/^colors/i)) { // see if they're asking for their color list
        let colors = '';
        for (let i = 0; i<user.colors.length; i++) {
          colors += `${user.colors[i].name}: ${user.colors[i].mood}\n`
        }
        send(message.chat.id, `Your defined colors are:\n${colors}`, e => {
          if (e) {
            throw new Error(e);
          }
        });
      } else {  // I have no idea what you're saying
        send(message.chat.id, "what does that mean", e => {
          if (e) {
            throw new Error(e);
          }
        });
      }

      res.sendStatus(200);
    });
  });
}
