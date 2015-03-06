var util = require('util');
var config = require(__dirname + '/config').load("server");
var logger = require(__dirname + '/logger').logger();

var obj = {};

obj.makeDownloadUrl = function (req, hashcode) {
    return req.protocol + '://' + req.get('host') + config.route.download + hashcode;
};

obj.makeShowUrl = function (req, code) {
    return req.protocol + '://' + req.get('host') + config.route.show + code;
};

obj.makeUploadUrl = function (req, userid) {
    return req.protocol + '://' + req.get('host') + config.route.upload + userid;
}

obj.sendSafeResponse = function (resp, code, obj) {
    if (!resp.headersSent) {
        var msg = "response error";
        if (code === 200) {
            msg = "response OK";
        }
        logger.trace(util.format("%s: %s", msg, util.inspect(obj)));
        resp.status(code).send(obj);
    } else {
        logger.trace("response has already been sent");
    }
};

obj.composeDownloadHtmlHeaders = function (fileInfo) {
    var bound = fileInfo.fileName.lastIndexOf('.');
    if (bound === -1) {
        bound = fileInfo.fileName.length;
    }
    var basename = fileInfo.fileName.slice(0, bound);
    var ext = fileInfo.fileName.slice(bound);
    var contentType = '';
    switch (ext.toLowerCase()) {
        case '.pdf':
            contentType = 'application/pdf';
            break;
        case '.exe':
        case '.zip':
        case '.apk':
            contentType = 'application/octet-stream';
            break;
        case '.zip':
            contentType = 'application/zip';
            break;
        case '.doc':
        case '.docx':
            contentType = 'application/msword';
            break;
        case '.xls':
        case '.xlsx':
            contentType = 'application/vnd.ms-excel';
            break;
        case '.ppt':
        case '.pptx':
            contentType = 'application/vnd.ms-powerpoint';
            break;
        case '.gif':
            contentType = 'image/gif';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpeg':
        case '.jpg':
            contentType = 'image/jpg';
            break;
        default:
            contentType = 'application/force-download';
            break;
    };
    return {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="' + basename + ext.toUpperCase() + '"'
    }
};

// fetch the resources files
obj.getResources = function (path) {
    return function (req, res) {
        var options = {
            root: "./resources/" + path,
            dotfiles: "deny",
            headers: {
                "x-timestamp": Date.now(),
                "x-sent": true
            }
        };
        var filename = req.params.name;
        res.sendFile(filename, options, function (err) {
            if (err) {
                logger.error(err);
                res.status(err.status).end();
            } else {
                logger.trace("Sent:" + filename);
            }
        });
    };
};

module.exports = obj;