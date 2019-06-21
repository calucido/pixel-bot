"use strict";

const express = require('express')
  , bodyParser = require('body-parser')
  , app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

require('./controllers/cmd')(app);

app.listen(process.env.PORT, () => {
  console.log(`Running on port ${process.env.PORT}.`);
});
