process.env.__AZURE_STORAGE_EMULATOR = true;

var assert = require('assert');
var util = require('util');

// for local simulator, the protocol will indeed be 'http'
var azureRest = require(__dirname + '/../app/azure-utilities/azureRestRequest').restApis('https');
var config = require(__dirname + '/../app/config').load('azure-storage-emulator');
var logger = require(__dirname + '/../app/logger').logger();
var utils = require(__dirname + '/utils');

var tableName = 'testTable';
var dateNow = new Date().getTime();
var expiredDate = dateNow - config.expiredPeriod * 3600000 - 1;

var entity1 = {
    PartitionKey: '123456',
    RowKey: '7890',
    FileName: 'test1.txt',
    FilePath: 'user0',
    CreateTime: expiredDate
};

var entity2 = {
    PartitionKey: '123456',
    RowKey: 'abcd',
    FileName: 'test2',
    FilePath: 'usera-b-c-0jsd-fa-df123-adfa-a12-35123dfad',
    CreateTime: dateNow
};

// test table operations

var contains = utils.contains;

// clean up the storage
logger.info('>>>start cleanup the testing environment...');
azureRest.deleteTable(tableName, function (result) {

    // create a table
    logger.info(util.format('>>>start to create table %s ...', tableName));
    azureRest.createTable(tableName, function (result) {
        assert(result, 'create table failed!');

        // insert entity1
        logger.info(util.format('>>>start to insert entity %s into table %s', util.inspect(entity1), tableName));
        azureRest.insertEntity(tableName, entity1, function (result) {
            assert(result, 'insert entity1 failed!');

            logger.info(util.format('>>>start to insert entity %s into table %s', util.inspect(entity2), tableName));
            azureRest.insertEntity(tableName, entity2, function (result) {
                assert(result, 'insert entity2 failed!');

                // query table
                logger.info(util.format('>>>start to query entities in the table %S', tableName));
                azureRest.queryEntities({ table: tableName }, function (result, entities) {
                    assert(result, 'query entities failed!');

                    // verify if inserted entity is queried
                    logger.info('get entities:\n%s', util.inspect(entities));
                    assert.equal(entities.value.length, 2, 'there should have two entities');
                    assert(contains(entities.value, entity1, false), 'entities should contain entity1');
                    assert(contains(entities.value, entity2, false), 'entities should contain entity2');

                    // query single entity
                    logger.info(util.format('>>>start to query entity %s in table %s', util.inspect(entity1), tableName));
                    azureRest.queryEntities({ table: tableName, PartitionKey: entity1.PartitionKey, RowKey: entity1.RowKey }, function (result, entity) {
                        assert(result, 'query entities for single entity failed!');

                        // verify if inserted entity is queried
                        logger.info('get entity:\n%s', util.inspect(entity));
                        assert(utils.compare(entity, entity1, false), 'entity1 should be queried');

                        logger.info(util.format('>>>start to delete entity %s in table %s', util.inspect(entity1), tableName));
                        azureRest.deleteEntity({ table: tableName, PartitionKey: entity1.PartitionKey, RowKey: entity1.RowKey }, function (result) {
                            assert(result, 'delete entity failed!');

                            // verify entity1 is deleted
                            logger.info(util.format('>>>start to verify entity %s is deleted', util.inspect(entity1)));
                            azureRest.queryEntities({ table: tableName }, function (result, entities) {
                                assert(result, 'query entities failed!');

                                // verify if only entity2 remains
                                logger.info('get entities:\n%s', util.inspect(entities));
                                assert.equal(entities.value.length, 1, 'there should have only one entity');
                                assert(contains(entities.value, entity2, false), 'entity2 should be queried');

                                // delete the table
                                logger.info(util.format('>>>start to delete table %s', tableName));
                                azureRest.deleteTable(tableName, function (result) {
                                    assert(result, 'delete table failed');

                                    // verify if the table has been deleted
                                    logger.info('>>>start to query tables');
                                    azureRest.queryTables(function (result, tables) {
                                        assert(result, 'query tables failed');

                                        // see if tables contains the deleted table
                                        assert(!contains(tables.value, { TableName: tableName }, false), util.format('table %s should not exist anymore', tableName));
                                        logger.info('table operations test PASS!');
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});