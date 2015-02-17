var wxCallbackApiTest = (function(){
    var token = "420xxx19841029";
    var encodingAesKey = "6z0XrB4QGNEKR6oJikWAWvqDOl6CB4Pni9Z6HAjHzKS";
    var obj = {};

    var queryString = require('querystring');
    var crypto = require('crypto');
    var parseString = require('xml2js').parseString;

    obj.valid = function(url) {
        var params = queryString.parse(url);
        var echoStr = params["echostr"];
        if (checkSignature(params)) {
            return echoStr;
        }

        return "";
    };

    var checkSignature = function(params) {
        var signature = params["signature"];
        var timestamp = params["timestamp"];
        var nonce = params["nonce"];        	
		
		var tmpArr = [token, timestamp, nonce];
        // use SORT_STRING rule
        tmpArr.sort();
        var tmpStr = tmpArr.join();
        var shasum = crypto.createHash('sha1');
        shasum.update(tmpStr);
        tmpStr = shasum.digest('hex');

		console.log("signature: " + signature);
        console.log("validate str: " + tmpStr);

		if (tmpStr == signature) {
			return true;
		} else {
			return false;
		}
    };

    return obj;
})();

module.exports = wxCallbackApiTest;
