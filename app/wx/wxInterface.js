var wxInterface = (function () {
    var sharingFiles = require(__dirname + '/../sharingFiles');
    var config = require(__dirname + '/../config').load("wxInterface");
    var logger = require(__dirname + '/../logger').logger();
    var utilities = require(__dirname + '/../utilities');
    var Strings = require(__dirname + '/../Strings');

    var url = require('url');
    var util = require('util');
    var xmlParser = require('xml2js').Parser();
    var crypto = require('crypto');
    var https = require('https');

    var token = config.token;
    var encodingAesKey = config.encodingAesKey;
    var lastUploadsTimeSpan = 3600000;

    var makeMessageData = function (toUser, fromUser, createTime, message) {
        var template = '<xml><ToUserName><![CDATA[%s]]></ToUserName><FromUserName><![CDATA[%s]]></FromUserName><CreateTime>%d</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[%s]]></Content></xml>';
        return util.format(template, toUser, fromUser, createTime, message);
    };

    var xml2Json = function (xmlData, callback) {
        xmlParser.parseString(xmlData, function (err, result) {
            if (result) {
                result = result.xml;
                for (var k in result) {
                    if (result.hasOwnProperty(k)) {
                        result[k] = result[k][0];
                    }
                }
            }
            callback(err, result);
        });
    };

    var helpDoc = Strings.WxHelpDoc;
    var processPostData = function (req, data, onComplete) {
        xml2Json(data, function (err, result) {
            var ret = 'success';
            if (err) {
                logger.error(util.format('parse XML data failed: %s', err));
            } else {
                var userid = result['FromUserName'];
                var myid = result['ToUserName'];
                var message = '';
                if (result['MsgType'] === 'text') {
                    var text = result['Content'];
                    if (text) {
                        text = text.toLowerCase();
                        if (text.indexOf('u') === 0) {
                            // request for upload a file, return the URL of uploading page
                            message = Strings.getString('WxUploadHint', utilities.makeUploadUrl(req, userid));
                        } else if (text.indexOf('s') === 0) {
                            // request for showing files that already uploaded, return all the urls of the uploaded files
                            sharingFiles.sharedFiles(userid, function (success, files) {
                                if (!success) {
                                    onComplete(Strings.WxReadUploadFailed);
                                } else {
                                    message = Strings.WxReadUploadFailed;
                                    var length = files.length < config.showFileCount ? files.length : config.showFileCount;
                                    for (var i = 0; i < length; i++) {
                                        message += '\r\n' + utilities.getUrlText(utilities.makeDownloadUrl(req, files[i].hashCode), files[i].createDate);
                                    }
                                    onComplete(makeMessageData(userid, myid, new Date().getTime() / 1000, message));
                                }
                            });
                            return;
                        } else if (text.indexOf('a') === 0) {
                            // request for showing all the files uploaded by the current user. return a url linking to a page with the file list.
                            message = Strings.getString('WxAllUploadedLinks', utilities.makeShowUrl(req, sharingFiles.fileListPageCode(userid)));
                        } else {
                            message = helpDoc;
                        }
                    }
                } else if (result['MsgType'] === 'event') {
                    var event = result['Event'];
                    if (event === 'subscribe') {
                        // TODO: add user number
                        message = Strings.WxWelcomeMessage;
                    } else if (event === 'unsubscribe') {
                        // TODO: reduce user number
                    }
                }

                if (message !== '') {
                    ret = makeMessageData(userid, myid, new Date().getTime() / 1000, message);
                }
            }

            onComplete(ret);
        });
    };

    var checkSignature = function (params) {
        var signature = params["signature"];
        var timestamp = params["timestamp"];
        var nonce = params["nonce"];

        var tmpArr = [token, timestamp, nonce];
        // use SORT_STRING rule
        tmpArr.sort();
        logger.trace("sorted [token, timestamp, nonce] array:");
        logger.trace(tmpArr[0]);
        logger.trace(tmpArr[1]);
        logger.trace(tmpArr[2]);

        var tmpStr = tmpArr.join("");
        logger.trace("joined string: " + tmpStr);

        var shasum = crypto.createHash('sha1');
        shasum.update(tmpStr);
        tmpStr = shasum.digest('hex');
        logger.trace("validate str: " + tmpStr);
        logger.trace("signature: " + signature);

        if (tmpStr == signature) {
            return true;
        } else {
            return false;
        }
    };

    var requestAccessTokenUrl = function () {
        return util.format(config.requestAccessTokenUrlPattern, config.appId, config.appSecret);
    };

    var requestApiTicketUrl = function (accessToken) {
        return util.format(config.requestApiTicketUrlPattern, accessToken);
    };

    var interface = {};

    var apiTicketExpiresIn = config.ticketUpdatePeriodInMs;
    var accessTokenExpiresIn = config.accessTokenUpdatePeriodInMs;

    interface.apiTicket = '';
    interface.accessToken = '';

    // update the jdk ticket
    var updateAccessToken = function () {
        var urlInfo = url.parse(requestAccessTokenUrl());
        var options = {
            hostname: urlInfo.hostname,
            path: urlInfo.path,
            method: 'POST'
        };
        var req = https.request(options, function (res) {
            var data = '';
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                var ret = JSON.parse(data);
                if (ret.access_token) {
                    interface.accessToken = ret.access_token;
                    accessTokenExpiresIn = ret.expires_in * 1000;
                    logger.info(util.format('access token: %s', ret.access_token));
                    logger.info(util.format('access token expires in: %d (s)', ret.expires_in));
                } else {
                    logger.error(util.format('failed to get the access token from wechat server: %s', util.inspect(ret)));
                }
            });
        });
        req.end();
    };

    var updateApiTicket = function () {
        if (interface.accessToken === '') {
            return;
        }
        var urlInfo = url.parse(requestApiTicketUrl(interface.accessToken));
        var options = {
            hostname: urlInfo.hostname,
            path: urlInfo.path,
            method: 'POST'
        };
        var req = https.request(options, function (res) {
            var data = '';
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                var ret = JSON.parse(data);
                if (ret.errcode === 0) {
                    interface.apiTicket = ret.ticket;
                    apiTicketExpiresIn = ret.expires_in * 1000;
                    logger.info(util.format('api ticket: %s', ret.ticket));
                    logger.info(util.format('api ticket expires in: %d (s)', ret.expires_in));
                } else {
                    logger.error(util.format('failed to update the api ticket from wechat server: %s', util.inspect(ret)));
                }
            });
        });
        req.end();
    };

    var updateAccessTokenContinuously = function (interval) {
        setTimeout(function () {
            updateAccessToken();
            updateAccessTokenContinuously(accessTokenExpiresIn);
        }, interval);
    };

    var updateApiTicketContinuously = function (interval) {
        setTimeout(function () {
            updateApiTicket();
            updateApiTicketContinuously(apiTicketExpiresIn);
        }, interval);
    };

    updateAccessTokenContinuously(accessTokenExpiresIn);
    updateApiTicketContinuously(apiTicketExpiresIn);

    interface.httpPostHandler = function (req, res) {
        if (!checkSignature(req.query)) {
            logger.info('Invalid Signature. Not a weixin request');
            res.send(403, Strings.ResBadRequest);
            return;
        }

        var data = '';
        req.on('data', function (chunk) {
            data += chunk;
        });

        req.on('end', function () {
            logger.trace(util.format('req url: %s', req.originalUrl));
            logger.trace(util.format('req body:\n%s', data));
            processPostData(req, data, function (result) {
                res.send(200, result);
            });
        });

        req.on('error', function (err) {
            logger.error(util.format('error on request: %s', err.Message));
        });
    };

    interface.httpGetHandler = function (req, res) {
        var params = req.query;
        var ret = '';
        if (checkSignature(params)) {
            logger.info("signature check successfully");
            ret = params["echostr"];
        }

        res.send(ret);
    };

    // verify if the given userid is valid open id, return userid if true, otherwise empty string
    interface.verifyUserId = function (userid) {
        if (/[^a-zA-Z0-9_]/.test(userid)) {
            // illegal user open id
            logger.trace(util.format('%s is an illegal open id', userid));
            return '';
        }
        return userid;
    };

    interface.makeSignForSdk = (function () {
        var createNonceStr = function () {
            return Math.random().toString(36).substr(2, 15);
        };

        var createTimestamp = function () {
            return parseInt(new Date().getTime() / 1000) + '';
        };

        var raw = function (args) {
            var keys = Object.keys(args);
            keys = keys.sort()
            var newArgs = {};
            keys.forEach(function (key) {
                newArgs[key.toLowerCase()] = args[key];
            });

            var string = '';
            for (var k in newArgs) {
                string += '&' + k + '=' + newArgs[k];
            }
            string = string.substr(1);
            return string;
        };

        return function (jsapi_ticket, url) {
            var ret = {
                jsapi_ticket: jsapi_ticket,
                nonceStr: createNonceStr(),
                timestamp: createTimestamp(),
                url: url
            };
            var string = raw(ret);
            //jsSHA = require('jssha');
            //shaObj = new jsSHA(string, 'TEXT');
            //ret.signature = shaObj.getHash('SHA-1', 'HEX');
            var shasum = crypto.createHash('sha1');
            shasum.update(string);
            ret.signature = shasum.digest('hex');

            return ret;
        };
    })();


    return interface;
})();

module.exports = wxInterface;