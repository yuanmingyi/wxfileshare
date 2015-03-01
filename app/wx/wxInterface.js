var wxInterface = (function () {
    var wxCallbackApiTest = require('./wxCallbackApiTest');
    var sharingFiles = require('../sharingFiles');
    var serverConfig = require('../config').load('server');
    var logger = require('../logger').logger();
    var util = require('util');
    var xmlParser = require('xml2js').Parser();
    var config = wxCallbackApiTest.config;

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

    var processPostData = function (req, data, onComplete) {
        xml2Json(data, function (err, r esult) {
            var ret = '';
            if (err) {
                logger.error(util.format('parse XML data failed: %s', err));
            } else {
                if (result['ToUserName'] !== config.wxid) {
                    logger.error(util.format('not expected target user name: %s', result['ToUserName']));
                } else {
                    var userid = result['FromUserName'];
                    if (result['MsgType'] === 'text') {
                        var text = result['Content'];
                        if (text) {
                            text = text.toLowerCase();
                            var message = '';
                            if (text.indexOf('u') === 0) {
                                // request for upload a file, return the URL of uploading page
                                message = '请点击链接上传文件: ' + req.protocol + '://' + req.get('host') + serverConfig.route.upload + userid;
                            } else if (text.indexOf('s') === 0) {
                                // request for showing files that already uploaded, return all the urls of the uploaded files
                                message = '已上传文件: ' + sharingFiles.sharedFiles(userid);
                            }

                            ret = makeMessageData(userid, config.wxid, new Date().getTime(), message);
                        }
                    }
                }
            }

            onComplete(ret);
        });
    };

    var interface = {};
    interface.postHandler = function (req, res) {
        if (req.method !== 'POST') {
            logger.error('only process POST request');
        }

        var data = '';
        req.on('data', function (chunk) {
            data += chunk;
        });

        req.on('end', function () {
            logger.trace(util.format('req url: %s', req.originUrl));
            logger.trace(util.format('req body:\n%s', data));
            processPostData(req, data, function (result) {
                res.status(200).send(result);
            });
        });

        req.on('error', function (err) {
            logger.error(util.format('error on request: %s', err.Message));
        });
    };

    interface.valid = wxCallbackApiTest.valid;

    return interface;
})();

module.exports = wxInterface;