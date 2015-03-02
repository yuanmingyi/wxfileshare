var sharingFiles = (function () {
    var crypto = require("crypto");
    var azure = require("azure-storage");
    var util = require("util");
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

    var deleteTableEntity = function (tableName, entity, callback, param) {
        var param = param || false;
        tableSvc.deleteEntity(tableName, entity, function (err, result) {
            if (err) {
                logger.error(util.format('delete entity failed\n%s', util.inspect(err)));
            }
            callback(param);
        });
    };

    var createFileCountEntity = function (path, fileCount) {
        return {
            PartitionKey: { '_': path, '$': 'Edm.String' },
            RowKey: { '_': '0', '$': 'Edm.String' },
            FilesCount: { '_': fileCount, '$': 'Edm.String' }
        };
    };

    var createFileInfoEntity = function (hashcode, path, filename, timestamp) {
        return {
            PartitionKey: { '_': hashcode, '$': 'Edm.String' },
            RowKey: { '_': path, '$': 'Edm.String' },
            FileName: { '_': filename, '$': 'Edm.String' },
            CreateDate: { '_': timestamp, '$': 'Edm.String' }
        };
    };

    var entities2filesInfo = function (entities) {
        var filesInfo = [];
        for (var entity in entities) {
            filesInfo.push({
                hashCode: entity.PartitionKey['_'],
                path: entity.RowKey['_'],
                fileName: entity.FileName['_'],
                createDate: entity.CreateDate['_']
            });
        }

        return filesInfo;
    };

    var obj = {};
    obj.uploadStream = function (userid, originname, completeCallback) {
        logger.trace('>>> start sharingFiles.uploadStream');

        var timestamp = new Date().getTime();
        var tmpStr = originname + userid + timestamp;
        var shasum = crypto.createHash("sha1");
        shasum.update(tmpStr);
        var hashcode = shasum.digest('hex');
        var path = makePathFromUserId(userid);
        var userFilesCount = 0;
        tableSvc.retrieveEntity(config.userUploadsCountTable, path, '0', function (err, result) {
            if (!err) {
                logger.trace(util.inspect(result));
                userFilesCount = result.FilesCount['_'];
            } else {
                logger.trace(util.format('entry not found for user: %s', userid));
            }

            if (userFilesCount > config.maxFilesPerUser) {
                logger.warn('the user has uploaded too many files');
                completeCallback(false);
                return;
            }

            var entity = createFileInfoEntity(hashcode, path, originname, timestamp);
            tableSvc.insertEntity(config.fileInfoTable, entity, function (err, result) {
                if (err) {
                    logger.error(util.format("insert entity failed!\n%s", util.inspect(err)));
                    completeCallback(false);
                    return;
                }

                logger.trace(util.format('entity inserted for hashcode: %s', hashcode));
                blobSvc.createContainerIfNotExists(path, { publicAccessLevel: 'blob' }, function (error, result, response) {
                    if (error) {
                        logger.error("create container failed!\n" + util.inspect(error));
                        deleteTableEntity(config.fileInfoTable, entity, completeCallback);
                        return;
                    }

                    logger.trace(util.format('container %s is created (existing)', path));
                    // Container exists and is private
                    var writableStream = blobSvc.createWriteStreamToBlockBlob(path, hashcode, function (error, response) {
                        if (error) {
                            logger.error(util.format("create file blob failed!\nhashcode:%s\nerror:%s", hashcode, util.inspect(error)));
                            deleteTableEntity(config.fileInfoTable, entity, completeCallback);
                            return;
                        }

                        logger.trace(util.format('writableStream is created for path: %s and hashcode: %s', path, hashcode));
                        var fileCountEntity = createFileCountEntity(path, userFilesCount + 1);
                        insertOrReplaceEntity(config.userUploadsCountTable, fileCountEntity, function (err, result) {
                            if (err) {
                                logger.error(util.format('update user upload count table with entity %s failed', util.inspect(fileCountEntity)));
                            } else {
                                logger.trace('user upload count table is updated');
                            }
                        });

                        completeCallback(true, hashcode, writableStream);
                    });
                });
            });
        });
    };

    obj.sharedFiles = function (userid, createShorterThan, callback) {
        logger.trace('>>> start sharingFiles.sharedFiles');

        var path = makePathFromUserId(userid);
        var infoTableQuery = new TableQuery()
            .where(TableQuery.stringFilter('RowKey', QueryComparisons.EQUAL, path))
            .and(TableQuery.stringFilter('CreateTime', QueryComparisons.GreaterThan, new Date().getTime() - createShorterThan));

        tableSvc.retrieveEntity(config.userUploadsCountTable, path, '0', function (err, result) {
            var filesCount = 0;
            if (err) {
                logger.error(util.format('retrieve filecount of userid %s from userUploadsCount table failed!\n%s', userid, util.inspect(err)));
                callback([]);
                return;
            }

            logger.trace(util.format('filecount for userid %s is retrieved: %s', userid, util.inspect(result)));
            filesCount = result.FilesCount['_'];
            tableSvc.queryEntities(config.fileInfoTable, infoTableQuery, null, function (err, result) {
                if (err) {
                    logger.error(util.format('query file info table for userid failed!\n%s', util.inspect(err)));
                    callback([]);
                    return;
                }

                logger.trace(util.format('file info for userid %s are queried', userid));
                var entities = result.entries;
                if (entities.length !== filesCount) {
                    logger.warn(util.format("query entities count %d from fileInfoTable does NOT equal to file count %d in userUploadsCountTable!", entities.length, filesCount));
                }

                callback(entities2filesInfo(entities));
            });
        });
    };

    obj.fileInfo = function (hashcode, complete) {
        logger.trace('>>> start sharingFiles.fileInfo');
        var infoTableQuery = new TableQuery().where(TableQuery.stringFilter('PartitionKey', QueryComparisons.EQUAL, hashcode));
        tableSvc.queryEntities(config.fileInfoTable, infoTableQuery, null, function (err, result) {
            if (err || result.entries.length <= 0) {
                logger.error("query entity by hashcode failed!\n" + util.inspect(error));
                complete(false);
                return;
            }

            logger.trace(util.format('file info for hashcode %s is retrieved: %s', hashcode, util.inspect(result)));
            if (complete) {
                complete(true, entities2filesInfo(result.entries)[0]);
            }
        });
    };

    obj.downloadStream = function (path, hashcode, errorOrResult) {
        logger.trace('>>> start sharingFiles.downloadStream');
        return blobSvc.createReadStream(path, hashcode, function (err, result) {
            if (err) {
                logger.error("create readable stream failed!\n" + util.inspect(err));
            }

            logger.trace('read stream is created');
            if (errorOrResult) {
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