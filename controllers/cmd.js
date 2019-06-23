"use strict";
const request = require('request')
    , moment = require('moment-timezone')
    , Jimp = require('jimp')
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

const sendPhoto = (to, message, photoBuffer, callback) => {
  if (to != '379133893') {
     message = "Hey! You're not my developer. Get out of here (for now)!"
  }
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

const handleError = e => {
  if (e) {
    throw new Error(e);
  }
};

module.exports = app => {
  app.post(`/api/v0/cmd/${process.env.TELEGRAM_API_KEY}`, (req, res) => {
    res.sendStatus(200);
    const message = req.body.message;
    
    models.User.findOne({userId: message.from.username}).then((user) => {
      if (message.text.match(/^\/start/)) {
        if (user) {
          return send(message.chat.id, "I already know you!", handleError);
        } else {
          user = new models.User({userId: message.from.username})
          user.save(e => {
            if (e) { throw new Error(e); }
            return send(message.chat.id, 'sup bud', handleError);
          });
        }
      } else if (message.text.match(/^\/am *|^\/pm */i)) { // see if it's a mood log "am" or "pm"
        let yearType = message.text.match(/^\/(am)|^\/(pm)/i)[1].toLowerCase(); // safe to use .toLowerCase() immediately because the string for sure exists otherwise the preceding match would have failed
        if (!user.timezone) {
          return send(message.chat.id, "What timezone are you in? (e.g. US/Eastern)", handleError);
        }
        let currentYear = moment.tz(user.timezone).format('YYYY');
        let currentMonth = Number(moment.tz(user.timezone).format('MM'));
        let currentDay = Number(moment.tz(user.timezone).format('DD'));

        models.Year.findOne({userId: message.from.username, year: currentYear, yearType}).then((year) => {
          // correct missing year
          if (!year) {
            year = new models.Year({userId: message.from.username, year: currentYear, yearType});
          }

          // correct missed months/days
          while (year.content.length < currentMonth) {
            year.content.push([]);
          }
          while (year.content[currentMonth - 1].length < (currentDay - 1)) { // June 21 is year.content[5][20]
            year.content[currentMonth - 1].push('');
          }
    
          // check whether today's mood has already been defined, and then set
          let color = message.text.replace(/^\/am *|^\/pm */i, '');
          let colorIndex = () => {
            return user.colors.findIndex(obj => {return obj.name === color.toLowerCase();});
          };
          if (color === '') {
            return send(message.chat.id, 'You need to tell me what color today was!', handleError);
          } else if (user.colors.findIndex(obj => {return obj.name === color.toLowerCase();}) === -1) {
            return send(message.chat.id, `You haven't saved a color named "${color}". Use '/color "${color}" #hexcode "mood"' to define it.`, handleError);
          }

          if (user.colors[colorIndex()].used === false) {
            user.colors[colorIndex()].used = true;
            user.save(handleError);
          }

          if (year.content[currentMonth - 1][currentDay - 1]) {
            year.content[currentMonth - 1][currentDay - 1] = color;
            year.markModified('content'); // content is a mixed type, so must ALWAYS mark it as modified in order to save any changes to it
            
            year.save(e => {
              if (e) { throw new Error(e); }
              return send(message.chat.id, `Overwrote ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
            });
          } else {
            year.content[currentMonth - 1].push(color);
            year.markModified('content');  // content is a mixed type, so must ALWAYS mark it as modified in order to save any changes to it
            year.save(e => {
              if (e) { throw new Error(e); }
              return send(message.chat.id, `Added ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
            });
          }
        }).catch(e => {throw new Error(e)});
      } else if (message.text.match(/^\/colors/i)) { // see if they're asking for their color list
        let colors = '';
        user.colors.forEach(color => {
          colors += `${color.name} (${color.hex}): ${color.mood}\n`
        });
        return send(message.chat.id, `Your defined colors are:\n${colors}`, e => {
          if (e) {
            throw new Error(e);
          }
        });
      } else if (message.text.match(/^\/color /i)) { // allow ppl to define colors
        let colorName = message.text.match(/^\/color +"?([^"]+)"? +#/i);
        let colorHex = message.text.match(/(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3})/);
        let colorMood = message.text.match(/^\/color +"?.+"? +#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}) +"(.+)"$/i);
        if (!colorHex) {
          return send(message.chat.id, "That isn't a valid hex color. Be sure to format it like #ff0000.", handleError);
        } else if (!colorName || !colorMood) {
          return send(message.chat.id, `Be sure to format the command like:\n/color "color name" #hex "mood"`, handleError);
        } else  {
          colorName = colorName[1].toLowerCase();
          colorHex = colorHex[1];
          colorMood = colorMood[1].toLowerCase();
          user.colors.push({name: colorName, hex: colorHex, mood: colorMood, used: false});
          user.save(e => {
            if (e) { throw new Error(e); }
            return send(message.chat.id, `Added color ${colorName} (${colorHex}) meaning ${colorMood}. Say /colors to see all of them.`, handleError);
          });
        }
      } else if (message.text.match(/^\/year /i)) { // respond to requests to see a graph of the year
        let requestedYear = message.text.match(/\d{4}/);
        let requestedYearType = message.text.match(/(am|pm)$/i);
        if (!requestedYear) {
          return send(message.chat.id, "You need to tell me what year you want to see.", handleError);
        } else if (!requestedYearType) {
          return send(message.chat.id, "You need to tell me what part of the year you want to see (am/pm).", handleError);
        } else {
          requestedYearType = requestedYearType[1].toLowerCase();
          models.Year.findOne({userId: message.from.username, year: Number(requestedYear), yearType: requestedYearType}).then(year => {
            if (!year) {
              return send(message.chat.id, `I couldn't find ${requestedYear} ${requestedYearType}.`, handleError);
            }
            let colorMap = {};
            user.colors.forEach(color => {
              colorMap[color.name] = color.hex;
            });
            new Jimp(240, 620, (e, image) => { // 240 = 12*20; 620 = 31*20;
              for (let month = 0; month < year.content.length; month++) {
                for (let day = 0; day < year.content[month].length; day++) {
                  if (year.content[month][day] !== '') {
                    image.scan(month*20, day*20, 20, 20, function(x, y, offset) { // 240 = 12*20; 620 = 31*20; *20 is for scaling factor;
                      this.bitmap.data.writeUInt32BE(Jimp.cssColorToHex(colorMap[year.content[month][day]]), offset, true);
                    });
                  }
                }
                if (month === (year.content.length - 1)) {
                  image.getBuffer(Jimp.MIME_PNG, (e, data) => {
                    return sendPhoto(message.chat.id, `Pixel graph for ${requestedYear}.`, data, handleError);
                  });
                }
              }
            });
          }).catch(handleError);
        }
      } else if (message.text.match(/^\/timezone /i)) {
        let timezone = message.text.replace(/^\/timezone +/i, '');
        if (!moment.tz.zone(timezone)) {
         return send(message.chat.it, "I don't recognize that timezone. Make sure to use the boring, technical name, like \"US/Eastern\".", handleError);
        }
        user.timezone = timezone;
        user.save(e => {
          if (e) { throw new Error(e); }
          return send(message.chat.id, `Set your timezone to ${user.timezone}.`, handleError);
        });
      } else if (message.text.match(/^\/help/i)) { // send list of commands
        return send(message.chat.id, `/am - Set the am mood.\n/pm - Set the pm mood.\n/color - Define a new color (usage: /color name #hex "mood")\n/year - See a graph of the year (usage: /year #### am)\n/colors - See a list of your defined colors.\n/tz - Set your timezone.`, handleError);
      } else { // I have no idea what you're saying
        return send(message.chat.id, "What does that mean? Say /help to see what I can do.", handleError);
      }
    });
  });
}
