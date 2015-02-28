var wxCallbackApiTest = (function () {
    var config = require("../config").load("wxInterface");
    var token = config.token;
    var encodingAesKey = config.encodingAesKey;
    var obj = {};

    var logger = require("../logger").logger();
    var crypto = require('crypto');

    obj.config = config;
    obj.valid = function (req) {
        logger.info("test url: " + req.url);
        var params = req.query;
        if (checkSignature(params)) {
            logger.info("signature check successfully");
            return params["echostr"];
        }

        return "";
    };

    obj.setLogger = function (newLogger) {
        logger = newLogger;
    };

    var checkSignature = function (params) {
        var signature = params["signature"];
        var timestamp = params["timestamp"];
        var nonce = params["nonce"];

        var tmpArr = [token, timestamp, nonce];
        // use SORT_STRING rule
        tmpArr.sort();
        logger.info("sorted [token, timestamp, nonce] array:");
        logger.info(tmpArr[0]);
        logger.info(tmpArr[1]);
        logger.info(tmpArr[2]);

        var tmpStr = tmpArr.join("");
        logger.info("joined string: " + tmpStr);

        var shasum = crypto.createHash('sha1');
        shasum.update(tmpStr);
        tmpStr = shasum.digest('hex');
        logger.info("validate str: " + tmpStr);
        logger.info("signature: " + signature);

        if (tmpStr == signature) {
            return true;
        } else {
            return false;
        }
    };

    return obj;
})();

module.exports = wxCallbackApiTest;
