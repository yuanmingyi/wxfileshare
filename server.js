var express = require("express");
var Busboy = require("busboy");
var util = require("util");
var fs = require("fs");
var ejs = require('ejs');

var config = require(__dirname + '/app/config').load('server');
var log = require(__dirname + '/app/logger');
var wxInterface = require(__dirname + '/app/wx/wxInterface');
var sharingFiles = require(__dirname + '/app/sharingFiles');
var utilities = require(__dirname + '/app/utilities');
var Strings = require(__dirname + '/app/Strings');

var app = express();
var logger = log.logger();

var maxFileSize = config.maxFileSize;
var connectionTmeout = config.connectionTimeout;      // seconds

var port = process.env.port || config.defaultPort;

log.use(app);

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.use(function (err, req, res, next) {
    logger.error(err.stack);
    res.send(500, Strings.ResUnexpectedError);
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
    var userid = '';
    var fileChunk = [];
    var length = 0;

    busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated) {
        logger.trace(util.format('field get: [name] %s [value] %s', fieldname, val));
        if (fieldname === 'uid') {
            userid = wxInterface.verifyUserId(val);
        }
    });

    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
        file.on('data', function (chunk) {
            fileChunk.push(chunk);
            length += chunk.length;
        });
        file.on('end', function () {
            logger.trace(util.format('File [%s] Finished', fieldname));
            logger.trace("busboy start file upload");
            var fileData = Buffer.concat(fileChunk, length);

            try {
                sharingFiles.uploadData(userid, filename, fileData, connectionTmeout, function (result, hashcode) {
                    if (result) {
                        logger.trace("File %s (%d bytes) upload succeeded", filename, fileData.length);
                        var downloadUrl = utilities.makeDownloadUrl(req, hashcode);
                        utilities.sendSafeResponse(res, 200, { filename: filename, url: downloadUrl, truncated: file.truncated });
                    } else {
                        logger.info("File %s upload failed", filename);
                        utilities.sendSafeResponse(res, 500, Strings.ResUploadFailed);
                    }
                });
            } catch (exception) {
                logger.error(util.format('exception:\n%s', util.inspect(exception)));
                utilities.sendSafeResponse(res, 500, Strings.getString("ResUploadFailedMessage", exception.message));
            }
        });
    });

    busboy.on('finish', function () {
        logger.trace("busboy finished");
    });

    busboy.on('error', function (err) {
        logger.error(util.format("error on busboy: %s", util.inspect(err)));
    });

    req.pipe(busboy);
});

// upload with user open id
app.get(config.route.upload + ':userid', function (req, res) {
    var userid = wxInterface.verifyUserId(req.params.userid);
    var src = fs.readFileSync('./views/upload-mobile.ejs', 'utf8');
    var ret = ejs.compile(src)({ maxFileSize: maxFileSize, userId: userid });
    res.send(ret);
    //res.render("upload", { maxFileSize: maxFileSize, userId: userid });
});

// fetch shared files
app.get(config.route.show + ':code', function (req, res) {
    var code = req.params.code;
    var userid = sharingFiles.parseFileListPageCode(code);
    if (userid === '') {
        return res.send(403, Strings.ResBadRequest);
    }
    if (code === config.testUserId) {
        userid = '';
    }
    sharingFiles.sharedFiles(userid, function (result, fileList) {
        if (!result) {
            res.send(404, Strings.ResNoFileFound);
            return;
        }
        fileList.forEach(function (file) {
            file.url = utilities.makeDownloadUrl(req, file.hashCode);
            logger.trace('file info:\n%s', util.inspect(file));
        });
        res.render("showupload", { fileList: fileList });
    });
});

// download files
app.get(config.route.download + ":hashcode", function (req, res) {
    var hashcode = req.params.hashcode;
    sharingFiles.fileInfo(hashcode, function (result, fileinfo) {
        if (result) {
            logger.trace(util.format('fileinfo:\n%s', util.inspect(fileinfo)));

            res.attachment(fileinfo.fileName);
            sharingFiles.writeToStream(fileinfo.path, hashcode, res, function (result, blob) {
                if (!result) {
                    utilities.sendSafeResponse(res, 500, Strings.ResDownloadFailed);
                }
            });

        } else {
            res.send(500, Strings.ResGetFileInfoFailed);
        }
    });
});

app.listen(port);
logger.info('Express started on port ' + port);