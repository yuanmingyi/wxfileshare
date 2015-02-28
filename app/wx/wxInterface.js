var wxInterface = (function () {
    var wxCallbackApiTest = require('./wxCallbackApiTest');
    var logger = require('../logger');
    var util = require('util');
    var config = wxCallbackApiTest.config;

    var interface = {};
    interface.postHandler = function (req, res) {
        if (req.method !== 'POST') {
            logger.error('only process POST request');
        } else {
            logger.info(util.format('request url: %s', req.originalUrl));
            logger.info(util.format('post data:\n%s', util.inspect(req.body)));
        }
        res.status(200).send('success');
    };

    interface.valid = wxCallbackApiTest.valid;

    return interface;
})();

module.exports = wxInterface;