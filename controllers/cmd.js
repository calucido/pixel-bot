"use strict";
const moment = require('moment-timezone')
    , Jimp = require('jimp')
    , models = require('../models')
    , {defaultColors, downloadFile, handleError, send, sendPhoto} = require('../lib/common');

module.exports = app => {
  app.post(`/api/v0/cmd/${process.env.TELEGRAM_API_KEY}`, (req, res) => {
    res.sendStatus(200);
    const message = req.body.message;
    
    models.User.findOne({username: message.from.username}).then((user) => {
      if (user && user.state === 'colors') {
        if (!message.document) {
          return send(message.chat.id, 'Please send me the private key I sent you way back when you signed up.', handleError);
        }
        downloadFile(message.document.file_id, (e, privateKey) => {
          if (e) { throw new Error(e); }
          let colors = '';
          user.colors.forEach(color => {
            user.decrypt(privateKey, color.mood, (e, decryptedMood) => {
              if (e) { throw new Error(e); }
              colors += `${color.name} (${color.hex}): ${decryptedMood.toString()}\n`
            });
          });
          return send(message.chat.id, `Your defined colors are:\n${colors}`, e => {
            if (e) { throw new Error(e); }
            user.state = '';
            user.save(handleError);
          });
        });
      } else if (message.text.match(/^\/start/)) {
        if (user) {
          return send(message.chat.id, "I already know you!", handleError);
        } else {
          user = new models.User({username: message.from.username, chatId: (message.chat.id + ''), colors: defaultColors, state: 'newUser'}); 
          user.generateKeyPair((e, publicKey, privateKey) => {
            if (e) { throw new Error(e); }
            user.publicKey = publicKey;
            for (let i = 0; i<user.colors.length; i++) { // encrypt default moods
              user.encrypt(user.colors[i].mood, (e, encryptedMood) => {
                if (e) { throw new Error(e); }
                user.colors[i].mood = encryptedMood;
              });
            }
            user.save(e => {
              if (e) { throw new Error(e); }
              send(message.chat.id, `Hi there! Very important notice: this picture is like your password, so keep it secret! But don't lose it, otherwise you won't be able to look at your year.\n${privateKey}`, handleError);
              return setTimeout(() => {return send(message.chat.id, 'Before you do anything else, can you tell me your timezone?\nE.g.: /timezone US/Eastern', handleError)}, 1000);
            });
          });
        }
      } else if (message.text.match(/^\/am|^\/pm/i)) { // see if it's a mood log "am" or "pm"
        let yearType = message.text.match(/^\/(am|pm)/i)[1].toLowerCase(); // safe to use .toLowerCase() immediately because the string for sure exists otherwise the preceding match would have failed
        if (!user.timezone) {
          return send(message.chat.id, "What timezone are you in? (e.g. US/Eastern)", handleError);
        }
        let currentYear = moment.tz(user.timezone).format('YYYY');
        let currentMonth = Number(moment.tz(user.timezone).format('MM'));
        let currentDay = Number(moment.tz(user.timezone).format('DD'));

        models.Year.findOne({username: message.from.username, year: currentYear, yearType}).then((year) => {
          // correct missing year
          if (!year) {
            year = new models.Year({username: message.from.username, year: currentYear, yearType});
          }

          // correct missed months/days
          while (year.content.length < currentMonth) {
            year.content.push([]);
          }
          while (year.content[currentMonth - 1].length < (currentDay - 1)) { // June 21 is year.content[5][20]
            year.content[currentMonth - 1].push('');
          }
    
          // check whether today's mood has already been defined, and then set
          let color = message.text.replace(/^\/am +|^\/pm +/i, '');
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
            user.encrypt(color, (e, encryptedColor) => {
              year.content[currentMonth - 1][currentDay - 1] = encryptedColor;
              year.markModified('content'); // content is a mixed type, so must ALWAYS mark it as modified in order to save any changes to it
            
              year.save(e => {
                if (e) { throw new Error(e); }
                return send(message.chat.id, `Overwrote ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
              });
            });
          } else {
            user.encrypt(color, (e, encryptedColor) => {
              year.content[currentMonth - 1].push(encryptedColor);
              year.markModified('content');  // content is a mixed type, so must ALWAYS mark it as modified in order to save any changes to it
              year.save(e => {
                if (e) { throw new Error(e); }
                return send(message.chat.id, `Added ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
              });
            });
          }
        }).catch(e => {throw new Error(e)});
      } else if (message.text.match(/^\/colors/i)) { // see if they're asking for their color list
        user.state = 'colors';
        user.save(e => {
          if (e) { throw new Error(e); }
          return send(message.chat.id, 'Please send me your private key as an image. (It\'s the one I sent you when you signed up!)', handleError);
        });
      } else if (message.text.match(/^\/color/i)) { // allow ppl to define colors
// TODO encrypt mood when adding a new color
        let colorName = message.text.match(/^\/color +"?([^"]+)"? +#/i)[1];
        let colorHex = message.text.match(/(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3})/)[1];
        let colorMood = message.text.match(/^\/color +"?.+"? +#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}) +"?([^"]+)"?$/i)[1];
        if (!colorHex) {
          return send(message.chat.id, "That isn't a valid hex color. Be sure to format it like #ff0000.", handleError);
        } else if (!colorName || !colorMood) {
          return send(message.chat.id, `Be sure to format the command like:\n/color "color name" #hex "mood"`, handleError);
        } else  {
          colorName = colorName.toLowerCase();
          colorMood = colorMood.toLowerCase();
          user.colors.push({name: colorName, hex: colorHex, mood: colorMood, used: false});
          user.save(e => {
            if (e) { throw new Error(e); }
            return send(message.chat.id, `Added color ${colorName} (${colorHex}) meaning ${colorMood}. Say /colors to see all of them.`, handleError);
          });
        }
      } else if (message.text.match(/^\/delete/i)) { // users can delete colors they haven't used
        let colorName = message.text.replace(/^\/delete +/i, '');
        let colorIndex = user.colors.map(color => {return color.name}).indexOf(colorName);
        if (colorIndex === -1) {
          return send(message.chat.id, "You haven't defined a color by that name.", handleError);
        } else if (user.colors[colorIndex].used === true) {
          return send(message.chat.id, "You can't delete that color since you've already used it.", handleError);
        } else {
          user.colors.splice(colorIndex, 1);
          user.save(e => {
            if (e) { throw new Error(e); }
            return send(message.chat.id, "Deleted!", handleError);
          });
        }
      } else if (message.text.match(/^\/year/i)) { // respond to requests to see a graph of the year
// TODO decrypt each day. messes with plan for /colors
        let requestedYear = message.text.match(/\d{4}/);
        let requestedYearType = message.text.match(/(am|pm)$/i);
        if (!requestedYear) {
          return send(message.chat.id, "You need to tell me what year you want to see.", handleError);
        } else if (!requestedYearType) {
          return send(message.chat.id, "You need to tell me what part of the year you want to see (am/pm).", handleError);
        } else {
          requestedYearType = requestedYearType[1].toLowerCase();
          models.Year.findOne({username: message.from.username, year: Number(requestedYear), yearType: requestedYearType}).then(year => {
            if (!year) {
              return send(message.chat.id, `I couldn't find ${requestedYear} ${requestedYearType}.`, handleError);
            }
            let colorMap = {};
            user.colors.forEach(color => {
              colorMap[color.name] = color.hex;
            });
            Jimp.read('year.png', (e, image) => {
              for (let month = 0; month < year.content.length; month++) {
                for (let day = 0; day < year.content[month].length; day++) {
                  if (year.content[month][day] !== '') {
                    image.scan((month+1)*84, (day+1)*84, 82, 82, function(x, y, offset) { // 1092 = (12+1)*84; 2688 = (31+1)*84; *84 is for scaling factor;
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
      } else if (message.text.match(/^\/timezone/i)) {
        let timezone = message.text.replace(/^\/timezone +/i, '');
        if (!moment.tz.zone(timezone)) {
         return send(message.chat.it, "I don't recognize that timezone. Make sure to use the boring, technical name, like \"US/Eastern\".", handleError);
        }
        user.timezone = timezone;
        if (user.state === 'newUser') {
          user.state = '';
          setTimeout(() => {return send(message.chat.id, `Thanks for taking care of that. I've set you up with some default colors. You can always add more! To see the defaults, say /colors`, handleError);}, 3000);
          setTimeout(() => {return send(message.chat.id, 'You can set your mood for the morning by saying /am "color", and the evening by saying /pm "color"', handleError);}, 5000);
        } 
        user.save(e => {
          if (e) { throw new Error(e); }
          return send(message.chat.id, `Set your timezone to ${user.timezone}.`, handleError);
        });
      } else if (message.text.match(/^\/help/i)) { // send list of commands
        return send(message.chat.id, `/am - Set the am mood.\n/pm - Set the pm mood.\n/color - Define a new color (usage: /color name #hex "mood")\n/year - See a graph of the year (usage: /year #### am)\n/colors - See a list of your defined colors.\n/timezone - Set your timezone.`, handleError);
      } else { // I have no idea what you're saying
        return send(message.chat.id, "What does that mean? Say /help to see what I can do.", handleError);
      }
    }).catch(e => {throw new Error(e);});
  });
}
