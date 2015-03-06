var rootPath = __dirname + '/../../../..';

var azureApis = require(rootPath + '/app/azure-utilities/azureRestRequest').restApis('https');
var tableInfo = require(rootPath + '/app/azure-utilities/tableDef');
var util = require('util');
var fs = require('fs');
var config = require(rootPath + '/app/config').load("azure-storage");

var msPerHour = 3600000;
var msPerMinute = 60000;
var msPerSecond = 1000;
var expiredTimeSpan = parseInt(config.expiredPeriod) * msPerHour;   // milliseconds
var runInterval = config.runInterval * msPerMinute;    // milliseconds

function binarySearch(arr, obj, compare) {
    if (typeof compare !== 'function') {
        compare = function (obj, ele) {
            return obj - ele;
        }
    }

    var low = 0, high = arr.length, mid;
    while (low < high) {
        mid = Math.floor((low + high) / 2);
        var res = compare(obj, arr[mid]);
        if (res < 0) {
            high = mid;
        } else if (res > 0) {
            low = mid + 1;
        } else {
            return mid;
        }
    }

    return -1;
}

//list all the container in the storage
function run() {
    console.log('start scanning...');

    azureApis.queryEntities({
        table: tableInfo.tableName
    }, function (result, object) {
        if (!result) {
            logger.error("query table failed:\n %s", util.inspect(object));
            return;
        }

        var entities = object.value;
        var dateNow = new Date();
        entities.sort(function (entry1, entry2) {
            return entry1.RowKey - entry2.RowKey;
        });

        console.log(util.format("found %d entities", entities.length));

        // verify if there are blobs not in the table
        azureApis.listContainers(function (result, containers) {
            if (!result) {
                console.log(util.format('request for Listing Containers fail:\n %s', containers));
            } else if (!!containers) {
                containers.forEach(function (container) {
                    azureApis.listBlobs({ container: container.Name }, function (result, blobs) {
                        blobs.forEach(function (blob) {
                            // search the corresponding table entry
                            var found = binarySearch(entities, blob, function (blob, entity) {
                                // compare the hashcode
                                return blob.Name - entity.RowKey;
                            });

                            if (found === -1 || dateNow - new Date(entities[found].CreateDate) > expiredTimeSpan) {
                                // not found the entry or the file is expired
                                console.log(util.format('file entry for blob %s/%s is not found or expired. would be deleted', container.Name, blob.Name));
                                azureApis.deleteBlob({ container: container.Name, blob: blob.Name }, function (result) {
                                    if (result) {
                                        console.log(util.format('file blob %s delete succeeded', blob.Name));
                                    } else {
                                        console.log(util.format('file blob %s delete failed', blob.Name));
                                    }
                                });

                                if (found) {
                                    var entity = entities[found];
                                    azureApis.deleteEntity({ table: tableInfo.tableName, partitionKey: entity.PartitionKey, rowKey: entity.RowKey }, function (result) {
                                        if (result) {
                                            console.log(util.format('entity %s (%s) delete succeeded', entity.RowKey, entity.FileName));
                                        } else {
                                            console.log(util.format('entity %s (%s) delete failed', entity.RowKey, entity.FileName));
                                        }
                                    });
                                }
                            }
                        });

                        console.log(util.format('%d blobs in container %s', blobs.length, container.Name));
                    });
                });
                console.log(util.format('total %d containers', containers.length));
            }
        });

        entities.forEach(function (entity) {
            // console.log(util.format('found entity:\n%s', util.inspect(entity)));
            azureApis.getBlobProperties({
                container: entity.FilePath,
                blob: entity.RowKey
            }, function (headers) {
                if (!headers) {
                    console.log('file %s (%s) is not found, entity is to be deleted', entity.RowKey, entity.FileName);
                    azureApis.deleteEntity({ table: tableInfo.tableName, partitionKey: entity.PartitionKey, rowKey: entity.RowKey }, function (result) {
                        if (result) {
                            console.log(util.format('entity %s delete succeeded', util.inspect(entity)));
                        } else {
                            console.log(util.format('entity %s delete failed', util.inspect(entity)));
                        }
                    });
                }
            });
        });

        setTimeout(run, runInterval);
        console.log(util.format('waiting for %d minutes to restart...', Math.floor(runInterval / msPerMinute)));
    });
}

run();