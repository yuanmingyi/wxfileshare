var express = require("express");
var Busboy = require("busboy");
var util = require("util");
var fs = require("fs");
var format = util.format;

var config = require("./app/config").load("server");
var log = require("./app/logger");
var wxInterface = require("./app/wx/wxInterface");
var sharingFiles = require("./app/sharingFiles");

var app = express();
var logger = log.logger();

var maxFileSize = parseInt(config.maxFileSize);
var connectionTmeout = parseInt(config.connectionTimeout);

var port = process.env.port || parseInt(config.defaultPort);

log.use(app);

app.set('views', './views');
app.set('view engine', 'jade');

app.use(function (err, req, res, next) {
    logger.error(err.stack);
    res.status(500).send('Unexpected error occured!');
});

// root route, default to upload
app.get(config.route.root, function (req, res) {
    res.redirect(config.route.upload);
});

// wx interface
app.route(config.route.wx)
.get(wxInterface.httpGetHandler)
.post(wxInterface.httpPostHandler);

// upload file page
app.route(config.route.upload)
.get(function (req, res) {
    res.render("upload", { maxFileSize: maxFileSize, userId: '' });
})
.post(function (req, res) {
    var busboy = new Busboy({ headers: req.headers, limits: { fileSize: maxFileSize, files: 1} });
    var successful = true;
    var userid = '';
    var uploadStream;
    busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
        logger.trace(util.format('field get: [name] %s [value] %s', fieldname, val));
        if (fieldname === 'uid') {
            userid = wxInterface.verifyUserId(val);
        }
    });
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        logger.trace("busboy start file upload");
        sharingFiles.uploadStream(userid, filename, function (result, hashcode, stream) {
            successful = result;
            logger.trace("successful: " + successful);
            if (successful) {
                logger.trace("upload stream created");
                var downloadUrl = makeDownloadUrl(req, hashcode);
                uploadStream = stream;
                uploadStream.on('finish', function () {
                    logger.trace("upload stream finished");
                    sendSafeResponse(res, 200, { filename: filename, url: downloadUrl, truncated: file.truncated });
                });
                file.pipe(uploadStream);
            } else {
                file.resume();
            }
        });
        setTimeout(function () {
            logger.trace("upload stream timeout. successful: " + successful);
            req.unpipe(busboy);
            busboy.end();
            sendSafeResponse(res, 500, "Time out");
            if (successful) {
                file.unpipe(uploadStream);
                uploadStream.end();
            }
        }, connectionTmeout);
    });
    busboy.on('finish', function () {
        logger.trace("busboy finished");
        if (!successful) {
            sendSafeResponse(res, 500, "Upload failed");
        }
    });
    busboy.on('filesLimit', function () {
        logger.warn("file uploaded is truncated");
    });
    req.pipe(busboy);
});

// upload with user open id
app.get(config.route.upload + ':userid', function (req, res) {
    var userid = wxInterface.verifyUserId(req.params.userid);
    res.render("upload", { maxFileSize: maxFileSize, userId: userid });
});

// fetch the resources files
var getResources = function (path) {
    return function (req, res) {
        var options = {
            root: __dirname + "/resources/" + path,
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

app.get(config.route.resources +"qrcode/:name", getResources('qrcode/'));
app.get(config.route.resources + ":name", getResources(''));

// download files
app.get(config.route.download + ":hashcode", function (req, res) {
    var hashcode = req.params.hashcode;
    sharingFiles.fileInfo(hashcode, function (err, fileinfo) {
        if (!err) {
            res.set(composeDownloadHtmlHeaders(fileinfo));
            var downloadStream = sharingFiles.downloadStream(fileinfo.FileName, hashcode, function (err) {
                if (!!err) {
                    res.status(500).send("Unable to download the file");
                }
            });
            try {
                downloadStream.pipe(res);
            }
            catch (ex) {
                log.error(util.format('Exception: %s', ex));
            }
        } else {
            res.status(500).send("Unable to fetch the file information");
        }
    });
});

function makeDownloadUrl(req, hashcode) {
    return req.protocol + '://' + req.get('host') + config.route.download + hashcode;
}

function sendSafeResponse(resp, code, obj) {
    if (!resp.headersSent) {
        var msg = "response error";
        if (code === 200) {
            msg = "response OK";
        }
        logger.trace(format("%s: %s", msg, util.inspect(obj)));
        resp.status(code).send(obj);
    } else {
        logger.trace("response has already been sent");
    }
}

function composeDownloadHtmlHeaders(fileInfo) {
    var bound = fileInfo.FileName.lastIndexOf('.');
    if (bound === -1) {
        bound = fileInfo.name.length;
    }
    var basename = fileInfo.name.slice(0, bound);
    var ext = fileInfo.name.slice(bound);
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
}

app.listen(port);
logger.info('Express started on port ' + port);