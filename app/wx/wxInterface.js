var wxInterface = (function () {
    var sharingFiles = require('../sharingFiles');
    var serverConfig = require('../config').load('server');
    var config = require("../config").load("wxInterface");
    var logger = require('../logger').logger();

    var util = require('util');
    var xmlParser = require('xml2js').Parser();
    var crypto = require('crypto');

    var token = config.token;
    var encodingAesKey = config.encodingAesKey;

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

    var helpDoc = '请发送upload或者u上传文件，发送show或者s获得文件下载链接';
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
                            message = '请点击链接上传文件: ' + req.protocol + '://' + req.get('host') + serverConfig.route.upload + userid;
                        } else if (text.indexOf('s') === 0) {
                            // request for showing files that already uploaded, return all the urls of the uploaded files
                            message = '已上传文件（开发中）: ' + sharingFiles.sharedFiles(userid);
                        } else {
                            message = helpDoc;
                        }
                    }
                } else if (result['MsgType'] === 'event') {
                    var event = result['Event'];
                    if (event === 'subscribe') {
                        // TODO: add user number
                        message = '欢迎使用文件共享助手。' + helpDoc;
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

    var interface = {};
    interface.httpPostHandler = function (req, res) {
        if (!checkSignature(req.query)) {
            logger.info('Invalid Signature. Not a weixin request');
            res.status(403).send('Bad request');
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
                res.status(200).send(result);
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

    return interface;
})();

module.exports = wxInterface;