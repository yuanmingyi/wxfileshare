var sharingFiles = (function () {
    var crypto = require("crypto");
    var azure = require("azure-storage");
    var util = require("util");
    var iconv = require('iconv-lite');
    var utilities = require(__dirname + '/utilities');
    var tableInfo = require(__dirname + '/azure-utilities/tableDef');
    var logger = require(__dirname + '/logger').logger();
    var config = require(__dirname + '/config').load("azure-storage");

    var useEmulator = process.env.EMULATED;
    var blobSvc = useEmulator ?
    azure.createBlobService() : azure.createBlobService(config.account, config.primaryKey, config.endPoints.blob);
    var tableSvc = useEmulator ?
    azure.createTableService() : azure.createTableService(config.account, config.primaryKey, config.endPoints.table);

    tableSvc.createTableIfNotExists(tableInfo.tableName, function (err, result) {
        if (err) {
            logger.error(util.format('create user file info table failed\n%s', util.inspect(err)));
        }
    });

    var makePathFromUserId = function (userid) {
        return 'user' + userid.replace(/_+/g, function ($0) {
            return '-' + $0.length + '-';
        }).replace(/[A-Z]/g, function ($0) {
            return $0.toLowerCase() + '-0';
        });
    };

    var deleteTableEntity = function (tableName, entity) {
        tableSvc.deleteEntity(tableName, entity, function (err, result) {
            if (err) {
                logger.error(util.format('delete entity failed\n%s', util.inspect(err)));
            } else {
                logger.info(util.format('delete entity %s succeeded', util.inspect(entity)));
            }
        });
    };

    var deleteBlob = function (path, hashcode) {
        blobSvc.deleteBlobIfExists(path, hashcode, function (err, isSuccessful, res) {
            if (err) {
                logger.info(util.format('delete blob %s/%s failed:\n%s', path, hashcode, util.inspect(err)));
            } else if (isSuccessful) {
                logger.info(util.format('delete blob %s/%s succeeded', path, hashcode));
            } else {
                logger.info(util.format('blob %s/%s does not exist', path, hashcode));
            }
        });
    };

    var obj = {};

    // timeout is optional and the unit is second
    obj.uploadData = function (userid, originname, fileData, timeout, completeCallback) {
        logger.trace('>>> start sharingFiles.uploadData');

        var date = new Date();
        var tmpStr = originname + userid + date.getTime();
        var shasum = crypto.createHash("sha1");
        shasum.update(tmpStr);
        var hashcode = shasum.digest('hex');
        var path = makePathFromUserId(userid);

        if (typeof timeout === 'function') {
            completeCallback = timeout;
            timeout = 120;       // seconds
        }

        var timeoutInMs = timeout * 1000;   // milliseconds

        var tableFinished = false;
        var blobFinished = false;
        var entityInserted = false;
        var blobCreated = false;
        var entity = tableInfo.createFileInfoEntity(hashcode, path, originname, date);

        var startTime = new Date();
        tableSvc.insertEntity(tableInfo.tableName, entity, { timeoutIntervalInMs: timeoutInMs }, function (err, result) {
            if (err) {
                logger.error(util.format("insert entity failed!\n%s", util.inspect(err)));
                completeCallback(false);
                return;
            }
            logger.trace(util.format('entity inserted for hashcode: %s', hashcode));

            var passedTime = new Date() - startTime;
            blobSvc.createContainerIfNotExists(path, { publicAccessLevel: 'blob', timeoutIntervalInMs: timeoutInMs - passedTime }, function (err, result, response) {
                if (err) {
                    logger.error("create container failed!\n" + util.inspect(err));
                    deleteTableEntity(tableInfo.tableName, entity);
                    completeCallback(false);
                    return;
                }

                logger.trace(util.format('container %s is created (existing)', path));
                passedTime = new Date() - startTime;
                blobSvc.createBlockBlobFromText(path, hashcode, fileData, { timeoutIntervalInMs: timeoutInMs - passedTime }, function (err, result) {
                    if (err) {
                        logger.error(util.format("create file blob failed!\nhashcode:%s\nerror:%s", hashcode, util.inspect(err)));
                        deleteTableEntity(tableInfo.tableName, entity);
                        completeCallback(false);
                        return;
                    }

                    logger.trace(util.format('file blob is created for path: %s and hashcode: %s', path, hashcode));
                    completeCallback(true, hashcode);
                });
            });
        });
    };

    obj.sharedFiles = function (userid, timeout, callback) {
        logger.trace('>>> start sharingFiles.sharedFiles');

        var path = makePathFromUserId(userid);
        logger.trace(util.format('userid: %s\n path: %s', userid, path));
        var infoTableQuery = new azure.TableQuery().where(azure.TableQuery.stringFilter('FilePath', azure.TableUtilities.QueryComparisons.EQUAL, path));

        if (typeof timeout === 'function') {
            callback = timeout;
            timeout = 120;  // seconds
        }

        tableSvc.queryEntities(tableInfo.tableName, infoTableQuery, null, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
            if (err) {
                logger.error(util.format('query file info table for userid failed!\n%s', util.inspect(err)));
                callback(false, []);
            } else {
                logger.trace(util.format('file info for userid %s are queried', userid));
                callback(true, tableInfo.entities2filesInfo(result.entries));
            }
        });
    };

    obj.fileInfo = function (hashcode, timeout, complete) {
        logger.trace('>>> start sharingFiles.fileInfo');

        if (typeof timeout === 'function') {
            complete = timeout;
            timeout = 120;  // seconds
        }

        tableSvc.retrieveEntity(tableInfo.tableName, tableInfo.generatePartitionKey(hashcode), hashcode, { timeoutIntervalInMs: timeout }, function (err, entity) {
            if (err) {
                logger.error(util.format('retrieve entity by hashcode %s failed!:\n%s', hashcode, util.inspect(error)));
                complete(false);
                return;
            }

            logger.trace(util.format('file info for hashcode %s is retrieved:\n%s', hashcode, util.inspect(entity)));
            complete(true, tableInfo.entities2filesInfo([entity])[0]);
        });
    };

    obj.writeToStream = function (path, hashcode, writableStream, timeout, complete) {
        logger.trace('>>> start sharingFiles.writeToStream');

        if (typeof timeout === 'function' || typeof timeout === 'undefined') {
            complete = timeout;
            timeout = 120;  // seconds
        }

        blobSvc.getBlobToStream(path, hashcode, writableStream, { timeoutIntervalInMs: timeout * 1000 }, function (err, blob) {
            if (err) {
                logger.error(util.format("write blob to stream failed: %s", util.inspect(err)));
                complete(false);
            } else {
                logger.info('write blob succeeded');
                complete(true, blob);
            }
        });
    };

    obj.getDownloadUrl = function (path, hashcode) {
        var sap = {
            AccessPolicy: {
                Expiry: azure.date.hoursFromNow(config.expiredPeriodInHour)
            }
        };
        var sasToken = blobService.generateSharedAccessSignature(path, hashcode, sap);
        return blobService.getUrl(path, hashcode, sasToken, true);
    };

    obj.getBlobText = function (path, hashcode, timeout, complete) {
        logger.trace('>>> start sharingFiles.getBlobContent');

        if (typeof timeout === 'function' || typeof timeout === 'undefined') {
            complete = timeout;
            timeout = 120;  // seconds
        }

        blobSvc.getBlobToText(path, hashcode, { timeoutIntervalInMs: timeout * 1000 }, function (err, text, blob, res) {
            if (err) {
                logger.error(util.format('getBlobToText failed: %s', util.inspect(err)));
                complete(false);
            } else {
                logger.info('getBlobToText successfully');
                complete(true, text, blob);
            }
        });
    };

    obj.downloadBlob = function (path, hashcode, timeout, complete) {
        logger.trace('>>> start sharingFiles.downloadBlob');

        if (typeof timeout === 'function' || typeof timeout === 'undefined') {
            complete = timeout;
            timeout = 120;  // seconds
        }

        var filePath = __dirname + '/../tmp/' + hashcode;
        return blobSvc.getBlobToLocalFile(path, hashcode, filePath, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
            if (err) {
                logger.error(util.format("download to local file failed!\n%s", util.inspect(err)));
                complete(false);
            } else {
                logger.info('download to local file successfully');
                complete(true, filePath);
            }
        });
    };

    obj.downloadStream = function (path, hashcode, timeout, complete) {
        logger.trace('>>> start sharingFiles.downloadStream');

        if (typeof timeout === 'function' || typeof timeout === 'undefined') {
            complete = timeout;
            timeout = 120;  // seconds
        }

        return blobSvc.createReadStream(path, hashcode, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
            if (err) {
                logger.error("create readable stream failed!\n" + util.inspect(err));
                complete(false);
            } else {
                logger.info('read stream is created');
                complete(true);
            }
        });
    };

    obj.fileListPageCode = function (userid) {
        return encodeURIComponent(userid);
    };

    obj.parseFileListPageCode = function (code) {
        code = code.replace(/%([a-zA-Z0-9]{2})/g, function (_, c) {
            return String.fromCharCode(parseInt(c, 16));
        });
        var buff = new Buffer(code, 'binary');
        return iconv.decode(buff, 'gbk');
    };

    obj.setLogger = function (newLogger) {
        logger = newLogger;
    }

    return obj;
})();

module.exports = sharingFiles;