var wxCallbackApiTest = (function () {
    var token = "420xxx19841029";
    var encodingAesKey = "6z0XrB4QGNEKR6oJikWAWvqDOl6CB4Pni9Z6HAjHzKS";
    var obj = {};

    var logger = require("log4js").getLogger("console");
    var crypto = require('crypto');
    var parseString = require('xml2js').parseString;

    obj.valid = function (url) {
        logger.info("test url: " + url);
        var urlobj = url.parse(url, true);
        var params = urlobj.query;
        var echoStr = params["echostr"];
        if (checkSignature(params)) {
            logger.info("signature check successfully");
            return echoStr;
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
