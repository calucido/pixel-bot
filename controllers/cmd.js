"use strict";
const request = require('request')
    , moment = require('moment-timezone')
    , packageJSON = require('../package.json')
    , models = require('../models');

const send = (to, message, callback) => {
  if (to != '379133893') {
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

const handleError = e => {
  if (e) {
    throw new Error(e);
  }
};

module.exports = app => {
  app.post(`/api/v0/cmd/${process.env.TELEGRAM_API_KEY}`, (req, res) => {
    res.sendStatus(200);
    const message = req.body.message;
    if (message.text.match(/^\/start/)) {
      models.User.findOne({userId: message.from.username}).then((user) => {
        if (user) {
          return send(message.chat.id, "I already know you!", e => {
            if (e) {
              throw new Error(e);
            }
          });
        }

        user = new models.User({userId: message.from.username})
        user.save(e => {if (e) { throw new Error(e); }});
        return send(message.chat.id, 'sup bud', e => {
          if (e) {
            throw new Error(e);
          }
        });
      }).catch(e => {throw new Error(e)});
    }
    models.User.findOne({userId: message.from.username}).then((user) => {
      if (message.text.match(/^am *|^pm */i)) { // see if it's a mood log "am" or "pm"
        let yearType = message.text.match(/^am|^pm/i)[0].toLowerCase();
        if (!user.timezone) {
          user.timezone = '';
        }
        let currentYear = moment.tz(user.timezone).format('YYYY');
        let currentMonth = Number(moment.tz(user.timezone).format('MM'));
        let currentDay = Number(moment.tz(user.timezone).format('DD'));

        models.Year.findOne({userId: message.from.username, year: currentYear}).then((year) => {
          // correct missing year
          if (!year) {
            year = new models.Year({userId: message.from.username, year: currentYear, yearType});
            year.save(e => {if (e) { throw new Error(e); }});
          }

          // correct missed months/days
          while (year.content.length < currentMonth) {
            year.content.push([]);
          }
          while (year.content[currentMonth - 1].length < (currentDay - 1)) {  // currentDay stores the REAL date, which starts at 1; length returns a count, which starts at 1. June 21 is year.content[5][20]
            year.content[currentMonth - 1].push('');
          }
    
          // check whether today's mood has already been defined, and then set
          let color = message.text.replace(/^am *|^pm */i, '').toLowerCase();
          if (year.content[currentMonth - 1][currentDay - 1]) {
            year.content[currentMonth - 1][currentDay - 1] = color;
            console.log(year);
            year.save(e => {
              if (e) { throw new Error(e); }
              return send(message.chat.id, `Overwrote ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
            });
          } else {
            year.content[currentMonth - 1].push(color);
            console.log(year);
            year.save(e => {
              if (e) { throw new Error(e); }
              return send(message.chat.id, `Added ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
            });
          }
        }).catch(e => {throw new Error(e)});
      } else if (message.text.match(/^colors/i)) { // see if they're asking for their color list
        let colors = '';
        for (let i = 0; i<user.colors.length; i++) {
          colors += `${user.colors[i].name}: ${user.colors[i].mood}\n`
        }
        return send(message.chat.id, `Your defined colors are:\n${colors}`, e => {
          if (e) {
            throw new Error(e);
          }
        });
      } else if (message.text.match(/^color /i)) { // allow ppl to define colors
        
      } else if (moment.tz.zone(message.text)) {
        user.timezone = message.text;
        user.save(e => {
          if (e) { throw new Error(e); }
          return send(message.chat.id, `Set your timezone to ${user.timezone}.`, handleError);
        });
      } else  {  // I have no idea what you're saying
        return send(message.chat.id, "what does that mean", handleError);
      }
    });
  });
}
