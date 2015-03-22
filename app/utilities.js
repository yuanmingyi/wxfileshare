var util = require('util');
var config = require(__dirname + '/config').load("server");
var azureConfig = require(__dirname + '/config').load('azure-storage');
var logger = require(__dirname + '/logger').logger();
var Strings = require(__dirname + '/Strings');

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
        'Content-Disposition': 'attachment; filename="' + fileInfo.fileName + '"'
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

obj.getUrlText = function (url, date) {
    return util.format(url + ' ' + Strings.TextUrlSuffix, Math.floor(azureConfig.expiredPeriodInHour - (new Date() - date) / 3600000));
};

obj.guid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

obj.binarySearch = function (arr, obj, compare) {
    if ((typeof compare) !== 'function') {
        compare = function (obj, ele) {
            return obj - ele;
        }
    }

    var low = 0, high = arr.length, mid;
    while (low < high) {
        mid = Math.floor((low + high) / 2);
        var res = compare(obj, arr[mid]);
        if (res < 0) {
            high = mid;
        } else if (res > 0) {
            low = mid + 1;
        } else {
            return mid;
        }
    }

    return -1;
}

module.exports = obj;