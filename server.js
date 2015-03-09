var express = require("express");
var Busboy = require("busboy");
var util = require("util");
var fs = require("fs");

var config = require(__dirname + '/app/config').load('server');
var log = require(__dirname + '/app/logger');
var wxInterface = require(__dirname + '/app/wx/wxInterface');
var sharingFiles = require(__dirname + '/app/sharingFiles');
var utilities = require(__dirname + '/app/utilities');

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
                        utilities.sendSafeResponse(res, 500, "Upload Failed");
                    }
                });
            } catch (exception) {
                logger.error(util.format('exception:\n%s', util.inspect(exception)));
                utilities.sendSafeResponse(res, 500, util.format("Upload Failed: %s", exception.message));
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
    res.render("upload", { maxFileSize: maxFileSize, userId: userid });
});

// fetch shared files
app.get(config.route.show + ':code', function (req, res) {
    var code = req.params.code;
    var userid = sharingFiles.parseFileListPageCode(code);
    if (userid === '') {
        return res.status(403).send('Bad request');
    }
    if (code === config.testUserId) {
        userid = '';
    }
    sharingFiles.sharedFiles(userid, function (result, fileList) {
        if (!result) {
            res.send(404, 'No files found');
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

            //sharingFiles.downloadBlob(fileinfo.path, hashcode, function (result, localpath) {
            //    if (!result) {
            //        res.send(500, 'download failed');
            //    } else {
            //        //res.set(utilities.composeDownloadHtmlHeaders(fileinfo));
            //        res.download(localpath, fileinfo.fileName, function (err) {
            //            if (err) {
            //                utilities.sendSafeResponse(res, 500, 'download failed');
            //            } else {
            //                logger.info('download successfully');
            //                fs.unlinkSync(localpath);
            //                logger.info(util.format('remove local file cache %s successfully', fileinfo.Name));
            //            }
            //        });
            //    }
            //});

            var url = sharingFiles.getDownloadUrl(fileinfo.path, hashcode);
            res.redirect(url);

            // only for text file
            //sharingFiles.getBlobContent(fileinfo.path, hashcode, function (result, text, blob) {
            //    if (!result) {
            //        res.send(500, 'download failed');
            //    } else {
            //        res.set(utilities.composeDownloadHtmlHeaders(fileinfo));
            //        res.send(text);
            //    }
            //});

            //sharingFiles.writeToStream(fileinfo.path, hashcode, res, function (result, blob) {
            //    if (!result) {
            //        utilities.sendSafeResponse(res, 500, 'download failed');
            //    }
            //});

            //var downloadStream = sharingFiles.downloadStream(fileinfo.path, hashcode, function (result) {
            //    if (!result) {
            //        res.status(500).send("Unable to download the file");
            //    }
            //});
            //try {
            //    downloadStream.pipe(res);
            //}
            //catch (ex) {
            //    log.error(util.format('Exception:\n%s', util.inspect(ex)));
            //}
        } else {
            res.send(500, "Unable to fetch the file information");
        }
    });
});

app.listen(port);
logger.info('Express started on port ' + port);