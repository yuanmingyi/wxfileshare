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

    var deleteTableEntity = function (tableName, entity, callback, param) {
        var param = param || false;
        tableSvc.deleteEntity(tableName, entity, function (err, result) {
            if (err) {
                logger.error(util.format('delete entity failed\n%s', util.inspect(err)));
            }
            callback(param);
        });
    };

    var createFileCountEntity = function (userid, fileCount) {
        return {
            PartitionKey: { '_': userid, '$': 'Edm.String' },
            RowKey: { '_': '0', '$': 'Edm.String' },
            FilesCount: { '_': fileCount, '$': 'Edm.String' }
        };
    };

    var createFileInfoEntity = function (hashcode, userid, filename, timestamp) {
        return {
            PartitionKey: { '_': hashcode, '$': 'Edm.String' },
            RowKey: { '_': userid, '$': 'Edm.String' },
            FileName: { '_': filename, '$': 'Edm.String' },
            CreateDate: { '_': timestamp, '$': 'Edm.String' }
        };
    };

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

        var userFilesCount = 0;
        tableSvc.retrieveEntity(config.userUploadsCountTable, userid, '0', function (err, result) {
            if (!err) {
                userFilesCount = result.FilesCount;
            }

            if (userFilesCount > config.maxFilesPerUser) {
                logger.warn('the user has uploaded too many files');
                completeCallback(false);
                return;
            }

            var entity = createFileInfoEntity(hashcode, userid, originname, timestamp);
            tableSvc.insertEntity(config.fileInfoTable, entity, function (err, result) {
                if (err) {
                    logger.error(util.format("insert entity failed!\n%s", util.inspect(err)));
                    completeCallback(false);
                    return;
                }
                blobSvc.createContainerIfNotExists(userid, { publicAccessLevel: 'blob' }, function (error, result, response) {
                    if (error) {
                        logger.error("create container failed!\n" + util.inspect(error));
                        deleteTableEntity(config.fileInfoTable, entity, completeCallback);
                        return;
                    }
                    // Container exists and is private
                    var writableStream = blobSvc.createWriteStreamToBlockBlob(userid, hashcode, function (error, response) {
                        if (error) {
                            logger.error(util.format("create file blob failed!\nhashcode:%s\nerror:%s", hashcode, util.inspect(error)));
                            deleteTableEntity(config.fileInfoTable, entity, completeCallback);
                            return;
                        }
                        var fileCountEntity = createFileCountEntity(userid, userFilesCount + 1);
                        insertOrReplaceEntity(config.userUploadsCountTable, fileCountEntity, function (err, result) {
                            if (err) {
                                logger.error(util.format('update user upload count table with entity %s failed', util.inspect(fileCountEntity)));
                            }
                        });
                        completeCallback(true, hashcode, writableStream);
                    });
                });
            });
        });
    };

    obj.sharedFiles = function (userid, callback) {
        var infoTableQuery = new TableQuery().where(TableQuery.stringFilter('RowKey', QueryComparisons.EQUAL, userid));
        tableSvc.retrieveEntity(config.userUploadsCountTable, userid, '0', function (err, result) {
            var filesCount = 0;
            if (err) {
                logger.error(util.format('retrieve userid from userUploadsCount table failed!\n%s', util.inspect(err)));
                callback([]);
                return;
            }
            filesCount = result.FilesCount;
            tableSvc.queryEntities(config.fileInfoTable, infoTableQuery, null, function (err, result) {
                if (err) {
                    logger.error(util.format('query file info table for userid failed!\n%s', util.inspect(err)));
                    callback([]);
                    return;
                }

                var entities = result.entries;
                if (entities.length !== filesCount) {
                    logger.warn(util.format("query entities count %d from fileInfoTable does NOT equal to file count %d in userUploadsCountTable!", entities.length, filesCount));
                }
                callback(entities);
            });
        });
    };

    obj.fileInfo = function (hashcode, complete) {
        var infoTableQuery = new TableQuery().where(TableQuery.stringFilter('PartitionKey', QueryComparisons.EQUAL, hashcode));
        var userid = '';
        tableSvc.queryEntities(config.fileInfoTable, infoTableQuery, null, function (err, result) {
            if (err || result.entries.length <= 0) {
                logger.error("query entity by hashcode failed!\n" + util.inspect(error));
                complete(false);
                return;
            }

            if (complete) {
                complete(true, result.entries[0]);
            }
        });
    };

    obj.downloadStream = function (userid, hashcode, errorOrResult) {        
        return blobSvc.createReadStream(userid, hashcode, function (err, result) {
            if (err) {
                logger.error("create readable stream failed!\n" + util.inspect(err));
            }
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