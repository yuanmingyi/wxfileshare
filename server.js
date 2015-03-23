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

// for wechat api configuration
app.get(config.route.resources + "wxApiConfig.js", function (req, res) {
    var path = utilities.getResourcePath("wxApiConfig.js");
    var wxConfig = wxInterface.makeSignForSdk(wxInterface.apiTicket, utilities.getFullUrl(req));
    wxConfig.updateSignUrl = config.route.updateSign;
    wxConfig.shareLink = config.route.upload;
    wxConfig.shareImageLink = config.route.resources + 'upload-icon.png';
    wxConfig.debug = !!process.env.__DEBUG;
    var src = fs.readFileSync(path, 'utf8');
    var ret = ejs.compile(src)({ wxConfig: wxConfig, strings: Strings });

    res.send(ret);
});

// loading resources (css, images, js)
app.get(config.route.resources + ":name", function (req, res) {
    var resourcePath = utilities.getResourcePath(req.params.name);
    logger.info(util.format('resource path: %s', resourcePath));
    res.sendFile(resourcePath);
});

// upload file page
app.route(config.route.upload)
.get(function (req, res) {
    renderUploadPage(req, res, '');
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
                        utilities.sendSafeResponse(res, 200, { filename: filename, url: utilities.getUrlText(downloadUrl, new Date()), truncated: file.truncated });
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
    renderUploadPage(req, res, req.params.userid);
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
            file.url = utilities.getUrlText(utilities.makeDownloadUrl(req, file.hashCode), file.createDate);
            logger.trace('file info:\n%s', util.inspect(file));
        });

        var userAgent = utilities.parseUserAgent(req);
        if (userAgent.isMobile || req.query.testmobile) {
            renderUploadEjs(res, userAgent, userid, fileList);
        } else {
            res.render("showupload", { fileList: fileList });
        }
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

// update the wx configuration
app.post(config.route.updateSign, function (req, res) {
    var url = '';
    req.on('data', function (chunk) {
        url += chunk;
    });
    req.on('end', function () {
        var wxConfig = wxInterface.makeSignForSdk(wxInterface.apiTicket, url);
        res.send(JSON.stringify(wxConfig));
    })
});

var renderUploadPage = function (req, res, userid) {
    var userAgent = utilities.parseUserAgent(req);
    if (userAgent.isMobile || req.query.testmobile) {
        renderUploadEjs(res, userAgent, userid, []);
    } else {
        res.render("upload", { maxFileSize: maxFileSize, userId: userid });
    }
}

var renderUploadEjs = function (res, userAgent, userid, fileList) {
    userid = wxInterface.verifyUserId(userid);
    var src = fs.readFileSync(__dirname + '/views/upload.ejs', 'utf8');
    var ret = ejs.compile(src)({ userAgent: userAgent, strings: Strings, maxFileSize: maxFileSize, userId: userid, fileList: fileList });

    res.send(ret);
}

app.listen(port);
logger.info('Express started on port ' + port);