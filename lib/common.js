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
    body = JSON.parse(body);
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
    body = JSON.parse(body);
    if (body.ok === false) {
      e = body.description;
    }
    return callback(e);
  });
};

module.exports.sendKey = (to, privateKey, callback) => {
  const options = {
    url: `https://api.telegram.org/bot${process.env.TELEGRAM_API_KEY}/sendDocument?chat_id=${to}`,
    formData: {
      document: {
        value: privateKey, // should be in buffer form already
        options: {
          filename: `DailyPixelBotPrivateKey-${to}.pem`,
          contentType: "application/x-x509-ca-cert"
        }
      }
    }
  };
};

module.exports.handleError = e => {
  if (e) {
    throw new Error(e);
  }
};

module.exports.downloadFile = (fileId, callback) => {
  let options = {
    url: `https://api.telegram.org/bot${process.env.TELEGRAM_API_KEY}/getFile?file_id=${fileId}`,
    headers: {
      'User-Agent': `DailyPixelBot/${packageJSON.version}`
    }
  };
  request.get(options, (e, response, body) => {
    body = JSON.parse(body);
    if (body.ok === false) {
      e = body.description;
      return callback(e);
    }
    options.url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_API_KEY}/${body.result.file_path}`;
    request.get(options, (e, response, body) => {
      return callback(e, body);
    });
  });
};

module.exports.defaultColors = [
  {
   "name": "yellow",
   "hex": "#ffd966",
   "mood": "happy",
   "used": false
  },
  {
    "name": "green",
    "hex": "#38761d",
    "mood": "neutral",
    "used": false
  },
  {
    "name": "purple",
    "hex": "#674ea7",
    "mood": "annoyed",
    "used": false
  },
  {
    "name": "red",
    "hex": "#cc0000",
    "mood": "angry",
    "used": false
  },
  {
    "name": "light blue",
    "hex": "#6fa8dc",
    "mood": "sad",
    "used": false
  },
  {
    "name": "brown",
    "hex": "#b45f06",
    "mood": "anxious",
    "used": false
  }
];
