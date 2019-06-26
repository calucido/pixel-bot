"use strict";
const models = require('../models')
    , {handleError} = require('./lib/common'),

module.exports = app => {
  app.get('/auth/telegram', (req, res) => {
    res.send'<script async src="https://telegram.org/js/telegram-widget.js?6" data-telegram-login="PixelatedYearBot" data-size="large" data-auth-url="/auth/telegram/callback" data-request-access="write"></script>');
  });
  app.get('/auth/telegram/callback', passport.authenticate('telegram'), (req,res) => {
    res.redirect('http://telegram.me/PixelatedYearBot');
  });
};

passport.use(new TelegramStrategy({
  botToken: process.env.TELEGRAM_API_KEY
}, (profile, callback) => {
  User.find({username: profile.username}).then(user => {
    return callback(null, user);
  }).catch(e => {return callback(e);});
});
