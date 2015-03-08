var rootPath = __dirname + '/../../../..';

var azureApis = require(rootPath + '/app/azure-utilities/azureRestRequest').restApis('https');
var tableInfo = require(rootPath + '/app/azure-utilities/tableDef');
var logger = require(rootPath + '/app/logger').logger();
var util = require('util');
var utilities = require(rootPath + '/app/utilities');
var fs = require('fs');
var config = require(rootPath + '/app/config').load("azure-storage");

var msPerHour = 3600000;
var msPerMinute = 60000;
var msPerSecond = 1000;
var expiredTimeSpan = config.expiredPeriodInHour * msPerHour;   // milliseconds
var runInterval = config.runIntervalInMin * msPerMinute;    // milliseconds
var creationDelay = config.creationDelayInSec * msPerSecond;    // milliseconds
var table = tableInfo.tableName;

var deleteEntity = function (tableName, entity) {
    azureApis.deleteEntity({ table: tableName, PartitionKey: entity.PartitionKey, RowKey: entity.RowKey }, function (result) {
        if (result) {
            logger.info(util.format('entity %s (%s) delete succeeded', entity.RowKey, entity.FileName));
        } else {
            logger.error(util.format('entity %s (%s) delete failed', entity.RowKey, entity.FileName));
        }
    });
}

var deleteBlob = function (containerName, blobName) {
    azureApis.deleteBlob({ container: containerName, blob: blobName }, function (result) {
        if (result) {
            logger.info(util.format('file blob %s delete succeeded', blobName));
        } else {
            logger.error(util.format('file blob %s delete failed', blobName));
        }
    });
};

var start = function () {
    logger.info('start scanning...');

    azureApis.queryEntities({
        table: table
    }, checkEntities);
};

var end = function () {
    setTimeout(start, runInterval);
    logger.info(util.format('waiting for %d minutes to restart...', config.runIntervalInMin));
};

var checkEntities = function (result, object) {
    if (!result) {
        logger.error("query table failed:\n %s", util.inspect(object));
        return;
    }

    var entities = object.value;
    logger.info(util.format("found %d entities", entities.length));

    checkEntityOneByOne(entities, 0, checkContainers);
};

var checkEntityOneByOne = function (entities, index, next) {
    if (index >= entities.length) {
        return next();
    }
    var entity = entities[index];
    azureApis.getBlobProperties({
        container: entity.FilePath,
        blob: entity.RowKey
    }, function (result, headers) {
        checkBlobProperties(entity, result, headers);
        checkEntityOneByOne(entities, index + 1, next);
    });
};

var checkBlobProperties = function (entity, result, headers) {
    var dateNow = new Date();
    var createDate = new Date(entity.CreateDate);
    if (!result) {
        // not found the blob
        if (dateNow - createDate < creationDelay) {
            logger.info('entry %s (%s) is just created, will check the file blob again next time', entity.RowKey, entity.FileName);
        } else {
            logger.info('file %s (%s) is not found, entity is to be deleted', entity.RowKey, entity.FileName);
            deleteEntity(table, entity);
        }
    }
    else if (dateNow - createDate > expiredTimeSpan) {
        // expired
        logger.info('entry %s (%s) is expired, would be deleted', entity.RowKey, entity.FileName);
        deleteEntity(table, entity);
    }
};

var checkContainers = function () {
    azureApis.listContainers(function (result, containers) {
        if (!result) {
            logger.error(util.format('request for Listing Containers fail:\n %s', containers));
            return;
        }
        logger.info(util.format('total %d containers', containers.length));

        checkContainerOneByOne(containers, 0, end);
    });
};

var checkContainerOneByOne = function (containers, index, next) {
    if (index >= containers.length) {
        return next();
    }
    var container = containers[index];
    azureApis.listBlobs({
        container: container.Name
    }, function (result, blobs) {
        checkBlobs(container, result, blobs);
        checkContainerOneByOne(containers, index + 1, next);
    });
};

var checkBlobs = function (container, result, blobs) {
    if (!result) {
        logger.error(util.format('request for Listing blobs fail:\n %s', blobs));
        return;
    }
    logger.info(util.format('%d blobs in container %s', blobs.length, container.Name));
    checkBlobOneByOne(container.Name, blobs, 0);
};

var checkBlobOneByOne = function (containerName, blobs, index) {
    if (index >= blobs.length) {
        return;
    }
    var blob = blobs[index];
    azureApis.queryEntities({
        table: table,
        PartitionKey: tableInfo.generatePartitionKey(blob.Name),
        RowKey: blob.Name
    }, function (result, entity) {
        checkBlobExpired(containerName, blob, result, entity);
        checkBlobOneByOne(containerName, blobs, index + 1);
    });
};

var checkBlobExpired = function (containerName, blob, result, entity) {
    var dateNow = new Date();
    var createDate = new Date(blob.Properties['Last-Modified']);
    if (!result) {
        // not found entity
        if (dateNow - createDate < creationDelay) {
            logger.info(util.format('file blob %s/%s is just created, will check table entry next time', containerName, blob.Name));
            return;
        }
        logger.info(util.format('file entry for blob %s/%s is not found, would be deleted', containerName, blob.Name));
        deleteBlob(containerName, blob.Name);
    } else if (dateNow - createDate > expiredTimeSpan) {
        // expired
        logger.info('file %s/%s (%s) is expired, would be deleted', containerName, blob.Name, entity.FileName);
        deleteBlob(containerName, blob.Name);
    }
};

start();