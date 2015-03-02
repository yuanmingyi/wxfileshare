var express = require("express");
var Busboy = require("busboy");
var util = require("util");
var fs = require("fs");

var config = require("./app/config").load("server");
var log = require("./app/logger");
var wxInterface = require("./app/wx/wxInterface");
var sharingFiles = require("./app/sharingFiles");
var utilities = require("./app/utilities");

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

app.get(config.route.resources + "qrcode/:name", utilities.getResources('qrcode/'));
app.get(config.route.resources + ":name", utilities.getResources(''));

// upload file page
app.route(config.route.upload)
.get(function (req, res) {
    res.render("upload", { maxFileSize: maxFileSize, userId: '' });
})
.post(function (req, res) {
    var busboy = new Busboy({ headers: req.headers, limits: { fileSize: maxFileSize, files: 1} });
    var successful = false;
    var userid = '';
    var uploadStream;

    busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated) {
        logger.trace(util.format('field get: [name] %s [value] %s', fieldname, val));
        if (fieldname === 'uid') {
            userid = wxInterface.verifyUserId(val);
        }
    });

    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        logger.trace("busboy start file upload");
        try {
            sharingFiles.uploadStream(userid, filename, function (result, hashcode, stream) {
                successful = result;
                logger.trace("successful: " + successful);
                if (successful) {
                    logger.trace("upload stream created");
                    var downloadUrl = utilities.makeDownloadUrl(req, hashcode);
                    uploadStream = stream;
                    uploadStream.on('finish', function () {
                        logger.trace("upload stream finished");
                        utilities.sendSafeResponse(res, 200, { filename: filename, url: downloadUrl, truncated: file.truncated });
                    });
                    file.pipe(uploadStream);
                } else {
                    file.resume();
                }
            });
        } catch (exception) {
            logger.error(util.format('exception:\n%s', util.inspect(exception)));
            return;
        }

        setTimeout(function () {
            logger.trace("upload stream timeout. successful: " + successful);
            req.unpipe(busboy);
            busboy.end();
            utilities.sendSafeResponse(res, 500, "Time out");
            if (successful) {
                file.unpipe(uploadStream);
                uploadStream.end();
            }
        }, connectionTmeout);
    });

    busboy.on('finish', function () {
        logger.trace("busboy finished");
        if (!successful) {
            utilities.sendSafeResponse(res, 500, "Upload failed");
        }
    });

    busboy.on('error', function (err) {
        logger.error(util.format("error on busboy: %s", util.inspect(err)));
    });
    req.pipe(busboy);
});

// upload with user open id
app.get(config.route.upload + ':userid', function (req, res) {
    var userid = wxInterface.verifyUserId(req.params.userid);
    res.render("upload", { maxFileSize: maxFileSize, userId: userid });
});

// fetch shared files
app.get(config.route.show + ':userid', function (req, res) {
    res.send("ok");
});

// download files
app.get(config.route.download + ":hashcode", function (req, res) {
    var hashcode = req.params.hashcode;
    sharingFiles.fileInfo(hashcode, function (err, fileinfo) {
        if (!err) {
            res.set(utilities.composeDownloadHtmlHeaders(fileinfo));
            var downloadStream = sharingFiles.downloadStream(fileinfo.path, hashcode, function (err) {
                if (!!err) {
                    res.status(500).send("Unable to download the file");
                }
            });
            try {
                downloadStream.pipe(res);
            }
            catch (ex) {
                log.error(util.format('Exception:\n%s', util.inspect(ex)));
            }
        } else {
            res.status(500).send("Unable to fetch the file information");
        }
    });
});

app.listen(port);
logger.info('Express started on port ' + port);