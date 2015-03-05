var sharingFiles = (function () {
    var crypto = require("crypto");
    var azure = require("azure-storage");
    var util = require("util");
    var utilities = require("./utilities");
    var logger = require("./logger").logger();
    var config = require("./config").load("azure-storage");
    var blobSvc = azure.createBlobService(config.account, config.primaryKey, config.endPoints.blob);
    var tableSvc = azure.createTableService(config.account, config.primaryKey, config.endPoints.table);

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

    var createFileInfoEntity = function (hashcode, path, filename, date) {
        var entGen = azure.TableUtilities.entityGenerator;
        return {
            PartitionKey: entGen.String(generatePartitionKey(hashcode)),
            RowKey: entGen.String(hashcode),
            FilePath: entGen.String(path),
            FileName: entGen.String(filename),
            CreateDate: entGen.DateTime(date)
        };
    };

    var entities2filesInfo = function (entities) {
        var filesInfo = [];
        entities.forEach(function (entity) {
            filesInfo.push({
                hashCode: entity.RowKey['_'],
                path: entity.FilePath['_'],
                fileName: entity.FileName['_'],
                createDate: new Date(entity.CreateDate['_'])
            });
        });
        return filesInfo;
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
        var entity = createFileInfoEntity(hashcode, path, originname, date);

        var startTime = new Date();
        tableSvc.insertEntity(config.fileInfoTable, entity, { timeoutIntervalInMs: timeoutInMs }, function (err, result) {
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
                    deleteTableEntity(config.fileInfoTable, entity);
                    completeCallback(false);
                    return;
                }

                logger.trace(util.format('container %s is created (existing)', path));
                passedTime = new Date() - startTime;
                blobSvc.createBlockBlobFromText(path, hashcode, fileData, { timeoutIntervalInMs: timeoutInMs - passedTime }, function (err, result) {
                    if (err) {
                        logger.error(util.format("create file blob failed!\nhashcode:%s\nerror:%s", hashcode, util.inspect(err)));
                        deleteTableEntity(config.fileInfoTable, entity);
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

        tableSvc.queryEntities(config.fileInfoTable, infoTableQuery, null, { timeoutIntervalInMs: timeout * 1000 }, function (err, result) {
            if (err) {
                logger.error(util.format('query file info table for userid failed!\n%s', util.inspect(err)));
                callback([]);
            } else {
                logger.trace(util.format('file info for userid %s are queried', userid));
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

            logger.trace(util.format('file info for hashcode %s is retrieved:\n%s', hashcode, util.inspect(entity)));
            complete(true, entities2filesInfo([entity])[0]);
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
            }

            logger.trace('read stream is created');
            if (complete) {
                complete(err ? false : true);
            }
        });
    };

    obj.fileListPageCode = function (userid) {
        return encodeURIComponent('u' + userid);
    };

    obj.parseFileListPageCode = function (code) {
        return decodeURIComponent(code).slice(1);
    };

    obj.setLogger = function (newLogger) {
        logger = newLogger;
    }

    return obj;
})();

module.exports = sharingFiles;