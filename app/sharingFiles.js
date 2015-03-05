var sharingFiles = (function () {
    var crypto = require("crypto");
    var azure = require("azure-storage");
    var util = require("util");
    var utilities = require("./utilities");
    var logger = require("./logger").logger();
    var config = require("./config").load("azure-storage");
    var blobSvc = azure.createBlobService(config.account, config.primaryKey, config.endPoints.blob);
    var tableSvc = azure.createTableService(config.account, config.primaryKey, config.endPoints.table);

    tableSvc.createTableIfNotExists(config.userUploadsCountTable, function (err, result) {
        if (err) {
            logger.error(util.format('create user upload count table failed\n%s', util.inspect(err)));
        }
    });

    tableSvc.createTableIfNotExists(config.fileInfoTable, function (err, result) {
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

    var generatePartitionKey = function (hashcode) {
        return '0'; // currently, we don't use special partitonkey since there are only few files
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

    var createFileInfoEntity = function (hashcode, path, filename, timestamp) {
        return {
            PartitionKey: { '_': generatePartitionKey(hashcode), '$': 'Edm.String' },
            RowKey: { '_': hashcode, '$': 'Edm.String' },
            FilePath: { '_': path, '$': 'Edm.String' },
            FileName: { '_': filename, '$': 'Edm.String' },
            CreateDate: { '_': timestamp, '$': 'Edm.String' }
        };
    };

    var entities2filesInfo = function (entities) {
        var filesInfo = [];
        for (var entity in entities) {
            filesInfo.push({
                hashCode: entity.RowKey['_'],
                path: entity.FilePath['_'],
                fileName: entity.FileName['_'],
                createDate: entity.CreateDate['_']
            });
        }

        return filesInfo;
    };

    var obj = {};

    // timeout is optional and the unit is second
    obj.uploadStream = function (userid, originname, timeout, completeCallback) {
        logger.trace('>>> start sharingFiles.uploadStream');

        var timestamp = new Date().getTime();
        var tmpStr = originname + userid + timestamp;
        var shasum = crypto.createHash("sha1");
        shasum.update(tmpStr);
        var hashcode = shasum.digest('hex');
        var path = makePathFromUserId(userid);
        var userFilesCount = 0;

        if (typeof timeout === 'function') {
            completeCallback = timeout;
            timeout = 120;       // seconds
        }

        var tableFinished = false;
        var blobFinished = false;
        var writableStream = null;
        var entityInserted = false;
        var blobCreated = false;
        var entity = createFileInfoEntity(hashcode, path, originname, timestamp);

        utilities.syncRun(timeout * 1000, function () {
            // testComplete
            return tableFinished && blobFinished;
        }, function () {
            // timeoutCallback
            logger.warn('running timeout');
            if (entityInserted) {
                deleteTableEntity(config.fileInfoTable, entity);
            }
            if (blobCreated && writableStream) {
                writableStream.end();
                deleteBlob(path, hashcode);
            }
        }, function () {
            // func
            tableSvc.insertEntity(config.fileInfoTable, entity, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
                if (err) {
                    logger.error(util.format("insert entity failed!\n%s", util.inspect(err)));
                } else {
                    logger.trace(util.format('entity inserted for hashcode: %s', hashcode));
                    entityInserted = true;
                }
                tableFinished = true;
            });

            blobSvc.createContainerIfNotExists(path, { publicAccessLevel: 'blob', timeoutIntervalInMs: timeout * 100 }, function (err, result, response) {
                if (err) {
                    logger.error("create container failed!\n" + util.inspect(err));
                    blobFinished = true;
                    return;
                }

                logger.trace(util.format('container %s is created (existing)', path));
                writableStream = blobSvc.createWriteStreamToBlockBlob(path, hashcode, { timeoutIntervalInMs: timeout * 900 }, function (err, result) {
                    if (err) {
                        logger.error(util.format("create file blob failed!\nhashcode:%s\nerror:%s", hashcode, util.inspect(err)));
                        blobFinished = true;
                        return;
                    }
                    logger.trace(util.format('writableStream is created for path: %s and hashcode: %s', path, hashcode));
                    blobCreated = true;
                    blobFinished = true;
                });
            });
        });

        if (entityInserted && blobCreated) {
            completeCallback(true, hashcode, writableStream);
        } else {
            completeCallback(false);
        }
    };

    obj.sharedFiles = function (userid, timeout, callback) {
        logger.trace('>>> start sharingFiles.sharedFiles');

        var path = makePathFromUserId(userid);
        var infoTableQuery = new TableQuery()
            .where(TableQuery.stringFilter('FilePath', QueryComparisons.EQUAL, path));

        if (typeof timeout === 'function') {
            callback = timeout;
            timeout = 120;  // seconds
        }

        tableSvc.queryEntities(config.fileInfoTable, infoTableQuery, null, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
            if (err) {
                logger.error(util.format('query file info table for userid failed!\n%s', util.inspect(err)));
                callback([]);
            } else {
                logger.trace(util.format('file info for userid %s are queried', userid));
                callback(entities2filesInfo(result.entries));
            }
        });

        blobSvc.listBlobsSegmented(path, null, { timeoutIntervalInMs: tiemout * 1000 }, function (err, result, res) {
            if (err) {
                logger.error(util.format('list blobs in container %s failed', path));
                callback([]);
            } else {
                logger.info(util.format('list blobs in container %s succeeded', path));
                callback(entities2filesInfo(result.entries));
            }
        });
    };

    obj.fileInfo = function (hashcode, timeout, complete) {
        logger.trace('>>> start sharingFiles.fileInfo');

        if (typeof timeout === 'function') {
            complete = timeout;
            timeout = 120;  // seconds
        }

        tableSvc.retrieveEntity(config.fileInfoTable, generatePartitionKey(hashcode), hashcode, { timeoutIntervalInMs: timeout }, function (err, entity) {
            if (err) {
                logger.error(util.format('retrieve entity by hashcode %s failed!:\n%s', hashcode, util.inspect(error)));
                complete(false);
                return;
            }

            logger.trace(util.format('file info for hashcode %s is retrieved: %s', hashcode, util.inspect(entity)));
            complete(true, entities2filesInfo(entity));
        });
    };

    obj.downloadStream = function (path, hashcode, timeout, errorOrResult) {
        logger.trace('>>> start sharingFiles.downloadStream');

        if (typeof timeout === 'function' || typeof timeout === 'undefined') {
            errorOrResult = timeout;
            timeout = 120;  // seconds
        }

        return blobSvc.createReadStream(path, hashcode, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
            if (err) {
                logger.error("create readable stream failed!\n" + util.inspect(err));
            }

            logger.trace('read stream is created');
            if (errorOrResult) {
                errorOrResult(err, result);
            }
        });
    };

    obj.fileListPageCode = function (userid) {
        return encodeURIComponent(userid);
    };

    obj.parseFileListPageCode = function (code) {
        return decodeURIComponent(code);
    };

    obj.setLogger = function (newLogger) {
        logger = newLogger;
    }

    return obj;
})();

module.exports = sharingFiles;