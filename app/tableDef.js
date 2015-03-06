var azure = require('azure-storage');

var generatePartitionKey = exports.generatePartitionKey = function (hashcode) {
    return '0'; // currently, we don't use special partitonkey since there are only few files
};

exports.createFileInfoEntity = function (hashcode, path, filename, date) {
    var entGen = azure.TableUtilities.entityGenerator;
    return {
        PartitionKey: entGen.String(generatePartitionKey(hashcode)),
        RowKey: entGen.String(hashcode),
        FilePath: entGen.String(path),
        FileName: entGen.String(filename),
        CreateDate: entGen.DateTime(date)
    };
};

exports.entities2filesInfo = function (entities) {
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

var tableName = require('./config').load('azure-storage').fileInfoTable;
exports.tableName = tableName;