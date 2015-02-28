var sharingFiles = (function () {
    var crypto = require("crypto");
    var azure = require("azure-storage");
    var util = require("util");
    var logger = require("./logger").logger();
    var config = require("./config").load("azure-storage");
    var blobname = config.blobName;
    var infoblob = config.infoBlob;
    var expiredPeriod = parseInt(config.expiredPeriod); // hours
    var blobSvc = azure.createBlobService(config.account, config.primaryKey, config.endPoints.blob);

    var obj = {};
    obj.upload = function (userid, originname, filepath, completeCallback) {
        var timestamp = new Date().getTime();
        var tmpStr = originname + userid + timestamp;
        var shasum = crypto.createHash("sha1");
        shasum.update(tmpStr);
        var hashcode = shasum.digest('hex');
        blobSvc.createContainerIfNotExists(hashcode, { publicAccessLevel: 'blob' }, function (error, result, response) {
            if (!result) {
                // the container already exists
                logger.warn("the container already exists: " + hashcode);
                completeCallback(false);
            }

            if (!error) {
                // Container exists and is private
                var fileInfo = {
                    userid: userid,
                    name: originname
                };
                blobSvc.createBlockBlobFromText(hashcode, infoblob, JSON.stringify(fileInfo), function (err) {
                    if (!!err) {
                        logger.error("create info blob failed!\nhashcode:" + hashcode + "\nerror:" + util.inspect(err));
                        completeCallback(false);
                        return;
                    }
                    blobSvc.createBlockBlobFromLocalFile(hashcode, blobname, filepath, function (error, result, response) {
                        if (!!error) {
                            logger.error("create file blob failed!\nhashcode:" + hashcode + "\nerror:" + util.inspect(error));
                            completeCallback(false);
                        } else {
                            completeCallback(true, hashcode);
                        }
                    });
                });
            } else {
                logger.error("create container failed!\n" + util.inspect(error));
                completeCallback(false);
            }
        });
    };

    obj.uploadStream = function (userid, originname, completeCallback) {
        var timestamp = new Date().getTime();
        var tmpStr = originname + userid + timestamp;
        var shasum = crypto.createHash("sha1");
        shasum.update(tmpStr);
        var hashcode = shasum.digest('hex');
        blobSvc.createContainerIfNotExists(hashcode, { publicAccessLevel: 'blob' }, function (error, result, response) {
            if (!result) {
                // the container already exists
                logger.warn("the container already exists: " + hashcode);
                completeCallback(false);
            }

            if (!error) {
                // Container exists and is private
                var fileInfo = {
                    userid: userid,
                    name: originname
                };
                blobSvc.createBlockBlobFromText(hashcode, infoblob, JSON.stringify(fileInfo), function (err) {
                    if (!!err) {
                        logger.error("create info blob failed!\nhashcode:" + hashcode + "\nerror:" + util.inspect(err));
                        completeCallback(false);
                        return;
                    }
                    var writableStream = blobSvc.createWriteStreamToBlockBlob(hashcode, blobname, function (error, response) {
                        if (!!error) {
                            logger.error("create file blob failed!\nhashcode:" + hashcode + "\nerror:" + util.inspect(error));
                        }
                    });
                    completeCallback(true, hashcode, writableStream);
                });
            } else {
                logger.error("create container failed!\n" + util.inspect(error));
                completeCallback(false);
            }
        });
    };

    obj.sharedFiles = function (userid) {
        return '';
    };

    obj.fileInfo = function (hashcode, complete) {
        blobSvc.getBlobToText(hashcode, infoblob, function (error, text, blob, res) {
            var obj = {};
            if (!!error) {
                logger.error("get file info failed!\n" + util.inspect(error));
            } else {
                obj = JSON.parse(text);
                logger.trace(util.inspect(obj));
            }
            if (!!complete) {
                complete(error, obj);
            }
        });
    };

    obj.downloadStream = function (hashcode, errorOrResult) {
        return blobSvc.createReadStream(hashcode, blobname, function (err, result, res) {
            if (!!err) {
                logger.error("create readable stream failed!\n" + util.inspect(err));
            }
            if (!!errorOrResult) {
                errorOrResult(err, result);
            }
        });
    };

    obj.setLogger = function (newLogger) {
        logger = newLogger;
    }

    return obj;
})();

module.exports = sharingFiles;