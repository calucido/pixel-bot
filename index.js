"use strict";

const express = require('express')
//  , mongoSessionStore = require('connect-mongo')(session)
//  , mongoose = require('mongoose')
  , bodyParser = require('body-parser')
  , app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

require('./controllers/cmd')(app);

app.listen(8080, () => {
  console.log('Running on port 8080.');
});
