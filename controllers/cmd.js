"use strict";
const moment = require('moment-timezone')
    , Jimp = require('jimp')
    , models = require('../models')
    , {defaultColors, downloadFile, handleError, send, sendKey, sendPhoto} = require('../lib/common');

module.exports = app => {
  app.post(`/api/v0/cmd/${process.env.TELEGRAM_API_KEY}`, (req, res) => {
    if (req.body.edited_message) {
      res.sendStatus(200);
      return send(req.body.edited_message.chat.id, `Editing messages doesn't work with this bot. Send the command again!`, handleError);
    }

    const message = req.body.message

    models.User.findOne({chatId: (message.chat.id + '')}).then((user) => {
      res.sendStatus(200);

      try {

      if (user && user.state === 'colors') {

        if (!message.document) {
          return send(message.chat.id, 'Please send me the private key I sent you way back when you signed up.', handleError);
        }

        downloadFile(message.document.file_id, (e, privateKey) => {
          if (e) { throw new Error(e); }
          let colors = '';
          for (let i=0; i< user.colors.length; i++) {
            try {
              user.decrypt(privateKey, user.colors[i].mood, (e, decryptedMood) => {
                if (e) { throw new Error(e) }
                colors += `${user.colors[i].name} (${user.colors[i].hex}): ${decryptedMood.toString()}\n`
              });
            } catch(e) {
              if (e.message.match(/04099079/)) {
                return send(message.chat.id, "That key can't decrypt your data. If you think you've lost your key, look for it in the Documents tab of Shared Media.", handleError);
              } else {
                throw new Error(e);
              }
            }
          }
          return send(message.chat.id, `Your defined colors are:\n${colors}`, e => {
            if (e) { throw new Error(e); }
            user.state = '';
            user.markModified('state');
            user.save(handleError);
          });
        });

      } else if (user && user.state && user.state.intent === 'year') {

        if (!message.document) {
          return send(message.chat.id, 'Please send me the private key I sent you way back when you signed up.', handleError);
        }

        downloadFile(message.document.file_id, (e, privateKey) => {
          if (e) { throw new Error(e); }
          models.Year.findOne({chatId: (message.chat.id + ''), year: user.state.yearDate, yearType: user.state.yearType}).then(year => {
            // don't check for !year because it must exist in order for user.state.intent = 'year'
            let colorMap = {};
            user.colors.forEach(color => {
              colorMap[color.name] = color.hex;
            });
            Jimp.read('year.png', (e, image) => {
              if (e) { throw new Error(e); }
              try {
                for (let month = 0; month < year.content.length; month++) {
                  for (let day = 0; day < year.content[month].length; day++) {
                    if (year.content[month][day] !== '') { 
                      user.decrypt(privateKey, year.content[month][day].buffer, (e, decryptedColor) => {
                        if (e) { throw new Error(e); }
                        image.scan((month+1)*84, (day+1)*84, 82, 82, function(x, y, offset) { // 1092 = (12+1)*84; 2688 = (31+1)*84; *84 is for scaling factor; no arrow function because "this" must be scoped to image.scan
                          this.bitmap.data.writeUInt32BE(Jimp.cssColorToHex(colorMap[decryptedColor.toString()]), offset, true);
                        });
                      });
                    }
                  }
                  if (month === (year.content.length - 1)) { 
                    image.getBuffer(Jimp.MIME_PNG, (e, data) => {
                      if (e) { throw new Error(e); }
                      const response = `Pixel graph for ${user.state.yearDate} ${user.state.yearType}.`; // generate message while user.state is still meaningful
                      user.state = '';
                      user.markModified('state');
                      user.save(e => {
                        if (e) { throw new Error(e); }
                        return sendPhoto(message.chat.id, response, data, handleError);
                      });
                    });
                  }
                }
              } catch(e) {
                if (e.message.match(/04099079/)) {
                  send(message.chat.id, "That key can't decrypt your data. If you think you've lost your key, look for it in the Documents tab of Shared Media.", handleError);
                } else {
                  throw new Error(e);
                }
              }
            });
          }).catch(handleError);
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
              send(message.chat.id, `Hi there! Very important notice: this file is like your password, so keep it secret! But don't lose it, otherwise you won't be able to look at your year. Hint: keep it in your Saved Messages, and just forward it to me whenever you need it.`, handleError);
              sendKey(message.chat.id, privateKey, handleError);
              return setTimeout(() => {return send(message.chat.id, 'Before you do anything else, can you tell me your timezone?\nE.g.: /timezone US/Eastern', handleError)}, 1000);
            });
          });
        }

      } else if (message.text.match(/^\/am|^\/pm/i)) { // see if it's a mood log "am" or "pm"

        if (!user.timezone) {
          return send(message.chat.id, "What timezone are you in? (e.g. /timezone US/Eastern)", handleError);
        }

        let yearType = message.text.match(/^\/(am|pm)/i)[1].toLowerCase(); // safe to use [1].toLowerCase() immediately because the string for sure exists otherwise the "else if" match would have failed
        
        let currentYear = moment.tz(user.timezone).format('YYYY');
        let currentMonth = Number(moment.tz(user.timezone).format('MM'));
        let currentDay = Number(moment.tz(user.timezone).format('DD'));

        models.Year.findOne({chatId: (message.chat.id + ''), year: currentYear, yearType}).then((year) => {
          // correct missing year
          if (!year) {
            year = new models.Year({chatId: (message.chat.id + ''), username: message.from.username, year: currentYear, yearType});
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
          color = color.replace(/"/g, '');
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

          user.encrypt(color, (e, encryptedColor) => {
            if (e) { throw new Error(e); }
            if (year.content[currentMonth - 1][currentDay - 1]) {
              year.content[currentMonth - 1][currentDay - 1] = encryptedColor;
              year.markModified('content'); // content is a mixed type, so must ALWAYS mark it as modified in order to save any changes to it
              year.save(e => {
                if (e) { throw new Error(e); }
                return send(message.chat.id, `Overwrote ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
              });
            } else {
              year.content[currentMonth - 1].push(encryptedColor);
              year.markModified('content');  // content is a mixed type, so must ALWAYS mark it as modified in order to save any changes to it
              year.save(e => {
                if (e) { throw new Error(e); }
                return send(message.chat.id, `Added ${yearType} mood for ${moment.tz(user.timezone).format('YYYY-MM-DD')} as ${color}.`, handleError);
              });
            }
          });
        }).catch(e => {throw new Error(e)});

      } else if (message.text.match(/^\/colors/i)) { // see if they're asking for their color list

        user.state = 'colors';
        user.markModified('state');
        user.save(e => {
          if (e) { throw new Error(e); }
          return send(message.chat.id, 'Please send me your private key file. (It\'s the one I sent you when you signed up!)', handleError);
        });

      } else if (message.text.match(/^\/color/i)) { // allow ppl to define colors

        let colorName = message.text.match(/^\/color +("|“|”)?([^"|“|”]+)("|“|”)? +#/i);
        let colorHex = message.text.match(/(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3})/);
        let colorMood = message.text.match(/#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}) +"?“?”?([^"|“|”]+)"?“?”?$/i);

        // using 4096 bit RSA, the max amount of data that can be encrypted is (4096/8) - 42 = 117.5 bytes, which == 117.5 Unicode characters in UTF-32 encoding

        if (!colorHex) {
          return send(message.chat.id, "That isn't a valid hex color. Be sure to format it like #ff0000.", handleError);
        } else if (!colorName || !colorMood) {
          return send(message.chat.id, `Be sure to format the command like:\n/color "color name" #hex "mood"`, handleError);
        } else  {

          colorName = colorName[2].toLowerCase();

          if (user.colors.findIndex(obj => {return obj.name === colorName}) !== -1 ) {
            return send(message.chat.id, `You already have a color named ${colorName}. If you haven't used it yet, you can delete it by sending /delete ${colorName}.`, handleError);
          } else {
            colorHex = colorHex[1]; // Jimp takes any capitalization of hex colors
            colorMood = colorMood[1].toLowerCase();
            if (colorName.length > 117) { return send(message.chat.id, 'Keep your color name under 117 characters!', handleError); } 
            if (colorMood.length > 117) { return send(message.chat.id, 'Keep your mood under 117 characters!', handleError); }
            user.encrypt(colorMood, (e, encryptedMood) => {
              user.colors.push({name: colorName, hex: colorHex, mood: encryptedMood, used: false});
              user.save(e => {
                if (e) { throw new Error(e); }
                return send(message.chat.id, `Added color "${colorName}" (${colorHex}) meaning "${colorMood}". Say /colors to see all of them.`, handleError);
              });
            });
          }
        }

      } else if (message.text.match(/^\/delete/i)) { // users can delete colors they haven't used

        let colorName = message.text.replace(/^\/delete +/i, '');
        colorName = colorName.replace(/"|“|”/g, '');
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

        let requestedYear = message.text.match(/\d{4}/);
        let requestedYearType = message.text.match(/(am|pm)$/i);
        if (!requestedYear) {
          return send(message.chat.id, "You need to tell me what year you want to see.", handleError);
        } else if (!requestedYearType) {
          return send(message.chat.id, "You need to tell me what part of the year you want to see (am/pm).", handleError);
        } else {
          requestedYear = requestedYear[0];
          requestedYearType = requestedYearType[1].toLowerCase();
          models.Year.findOne({chatId: (message.chat.id + ''), year: Number(requestedYear), yearType: requestedYearType}).then(year => {
            if (!year) {
              return send(message.chat.id, `I couldn't find ${requestedYear} ${requestedYearType}.`, handleError);
            }
            user.state = {};
            user.state.intent = 'year';
            user.state.yearType = requestedYearType;
            user.state.yearDate = requestedYear;
            user.markModified('state');
            user.save(e => {
              if (e) { throw new Error(e); }
              return send(message.chat.id, 'Please send me your private key file. (It\'s the one I sent you when you signed up!)', handleError);
            });
          }).catch(handleError);
        }

      } else if (message.text.match(/^\/timezone/i)) {

        let timezone = message.text.replace(/^\/timezone +/i, '');
        if (!timezone || !moment.tz.zone(timezone)) {
         return send(message.chat.it, "I don't recognize that timezone. Make sure to use the boring, technical name, like \"US/Eastern\".", handleError);
        }
        user.timezone = timezone;
        if (user.state === 'newUser') { // messy but I don't want to give the user extra instructions before the timezone is set
          user.state = '';
          user.markModified('state');
          setTimeout(() => {return send(message.chat.id, `Thanks for taking care of that. I've set you up with some default colors. You can always add more! To see the defaults, say /colors`, handleError);}, 1000);
          setTimeout(() => {return send(message.chat.id, 'You can set your mood for the morning by saying /am "color", and the evening by saying /pm "color"', handleError);}, 2000);
        } 
        user.save(e => {
          if (e) { throw new Error(e); }
          return send(message.chat.id, `Set your timezone to ${user.timezone}.`, handleError);
        });

      } else if (message.text.match(/^\/help/i)) { // send list of commands

        return send(message.chat.id, `/am - Set the am mood.\n/pm - Set the pm mood.\n/color - Define a new color (usage: /color name #hex "mood")\n/year - See a graph of the year (usage: /year #### am)\n/colors - See a list of your defined colors.\n/timezone - Set your timezone.`, handleError);

      } else if (message.text.match(/^\/migrate2/i)) { // migrate years from username to chatId

        models.Year.find({username: message.from.username}).then(years => {
          for (let i = 0; i < years.length; i++) {
            years[i].chatId = message.chat.id;
            years[i].save(e => {
              if (e) { throw new Error(e) }
              if (i === (years.length - 1)) {
                return send(message.chat.id, `Finished upgrading.`, handleError);
              }
            });
          }
        }).catch(handleError);

      }  else { // I have no idea what you're saying

        return send(message.chat.id, "I don't understand that command. Say /help to see what I can do.", handleError);

      }

      } catch(e) {
        if (!e.match || e.match(/bot was blocked by the user/) === null) { // ignore errors that arise from trying to send a message to a user that stopped the bot. line 17 prevents telegram servers from endlessly triggering webhook with messages from stopped users. there is no processing to do on this end, so acknowledge the request and do nothing with it. 
          send(message.chat.id, 'An error occurred while processing your request. Bug @calucido. If you were sending a key, you\'ll have to send the previous command again.', handleError);
          if (user && user.state) {
            user.state = '';
            user.save(handleError);
          }
          send(process.env.ADMIN_TELEGRAM_ID, `Something broke:\n${e}`, handleError);
          throw new Error(e);
        }
      }
    }).catch(e => { throw new Error(e);});
  });
};
