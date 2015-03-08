var https = require('https');
var http = require('http');
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');
var parseXml = require('xml2js').parseString;
var logger = require(__dirname + '/../logger').logger();

var __debug = process.env.__DEBUG;
var __use_emulator = process.env.__AZURE_STORAGE_EMULATOR;

var config = require(__dirname + "/../config").load(__use_emulator ? "azure-storage-emulator" : "azure-storage");
var clientId = process.env.WEBJOBS_NAME || "wxfileservice";

if (__use_emulator) {
    logger.info('USE AZURE STORAGE EMULATOR');
}

function constructCanonicalizedHeaders(options) {
    var headers = options.headers;
    var msHeaders = [];
    for (var key in headers) {
        if (headers.hasOwnProperty(key) && key.toLowerCase().indexOf('x-ms-') === 0) {
            // logger.info(util.format('key: %s, value: %s', key, headers[key]));
            msHeaders.push(key.trim().toLowerCase() + ':' + headers[key].trim().replace(/\s{2,}/g, ' '));
        }
    }

    msHeaders.sort(function (h1, h2) {
        return h1.slice(0, h1.indexOf(':')).localeCompare(h2.slice(0, h2.indexOf(':')));
    });

    return msHeaders.join('\n');
}

function constructCanonicalizedResource(options) {
    var path = options.path;
    var queryStart = path.indexOf('?');
    var pathname = path;
    var query = [];
    if (queryStart !== -1) {
        pathname = path.slice(0, queryStart);
        query = path.slice(queryStart + 1).split('&');
    }

    var canonicalizedResourceString = "/" + config.account + pathname;

    for (var k = 0; k < query.length; k++) {
        var param = query[k];
        var separator = param.indexOf('=');
        var key = param.slice(0, separator);
        var value = param.slice(separator + 1);
        query[k] = key.toLowerCase() + '=' + value;
    }

    query.sort(function (q1, q2) {
        return q1.slice(0, q1.indexOf('=')).localeCompare(q2.slice(0, q2.indexOf('=')));
    });

    for (var k = 0; k < query.length; k++) {
        var param = query[k];
        var separator = param.indexOf('=');
        var key = param.slice(0, separator);
        var value = param.slice(separator + 1);
        query[k] = decodeURIComponent(key) + ':' + decodeURIComponent(value);
    }

    if (query.length > 0) {
        canonicalizedResourceString += '\n' + query.join('\n');
    }

    return canonicalizedResourceString;
}

function constructHeadersWithoutAuth(type, version, date, cid, data) {
    var headers = {
        'x-ms-version': version,
        'x-ms-date': date,
        'x-ms-client-request-id': cid,
        'Accept': 'application/json;odata=nometadata',
        'Accept-Charset': 'UTF-8',
        'Prefer': 'return-no-content'
    };

    if (type === 'table') {
        headers['DataServiceVersion'] = config.dataServiceVersion;
        headers['MaxDataServiceVersion'] = config.maxDataServiceVersion;
    }

    if (data && typeof data === 'object') {
        // data is json
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = JSON.stringify(data).length;
    } else if (data && typeof data === 'string') {
        headers['Content-Type'] = 'application/atom+xml';
        headers['Content-Length'] = data.length;
    }

    return headers;
}

var generateSignature = exports.generateSignature = function (secureKey, stringToSign) {
    // Encoding the Signature
    // Signature=Base64(HMAC-SHA256(UTF8(StringToSign)))
    var shahmac = crypto.createHmac("SHA256", new Buffer(secureKey, 'base64'));
    return shahmac.update(stringToSign, 'utf-8').digest('base64');
};

function constructAuthorizationHeader(cr, keyName, account, secureKey, verb, headers, canonicalizedHeaders, canonicalizedResource) {
    var stringToSign = '';
    for (var i = 0; i < cr.length; i++) {
        var key = cr[i];
        if (key === 'verb') {
            stringToSign += verb + '\n';
        } else {
            stringToSign += (headers[key] || '') + '\n';
        }
    }

    if (canonicalizedHeaders) {
        stringToSign += canonicalizedHeaders + '\n';
    }

    stringToSign += canonicalizedResource;
    if (__debug) {
        logger.info(util.format('sign string:\n%s', util.inspect(stringToSign)));
    }

    var signatuare = generateSignature(secureKey, stringToSign);
    return util.format('%s %s:%s', keyName, account, signatuare);
}

var getCanonicalizedResourceItem = function (lite) {
    if (lite) {
        return ['verb', 'Content-MD5', 'Content-Type', 'Date'];
    } else {
        return ['verb', 'Content-Encoding', 'Content-Language', 'Content-Length', 'Content-MD5', 'Content-Type', 'Date', 'If-Modified-Since', 'If-Match', 'If-None-Match', 'If-Unmodified-Since', 'Range'];
    }
};

var getTableCanonicalizedResourceItem = function (lite) {
    if (lite) {
        return ['x-ms-date'];
    } else {
        return ['verb', 'Content-MD5', 'Content-Type', 'x-ms-date'];
    }
}

var getSharedKeyName = function (lite) {
    return lite ? 'SharedKeyLite' : 'SharedKey';
};

var getTypeFromHost = function (host) {
    var firstDot = host.indexOf('.');
    return host.slice(firstDot + 1, host.indexOf('.', firstDot + 1));
};

// compose the REST API request headers to the azure storage,
// refer to https://msdn.microsoft.com/en-us/library/azure/dd179428.aspx
var azureRequest = exports.request = function (type, method, host, headers, path, port, callback) {
    var protocol = (port === 443 ? https : http);
    var options = {
        method: method,
        hostname: host,
        port: port,
        path: path,
        headers: headers
    };

    var canonicalizedHeaders = type === 'table' ? '' : constructCanonicalizedHeaders(options);
    var canonicalizedResource = constructCanonicalizedResource(options);
    var lite = config.lite[type];
    var cr = type === 'table' ? getTableCanonicalizedResourceItem(lite) : getCanonicalizedResourceItem(lite);

    options.headers['Authorization'] =
        constructAuthorizationHeader(cr, getSharedKeyName(lite), config.account, config.primaryKey, method, headers, canonicalizedHeaders, canonicalizedResource);

    if (__debug === 'trace') {
        logger.trace(util.format('request option:\n%s', util.inspect(options)));
    }

    return protocol.request(options, callback);
};

exports.restApis = function (protocol) {
    var obj = {};
    var defaultProtocol = protocol || 'https';
    var defaultPort = (defaultProtocol.toLowerCase() === 'http' ? 80 : 443);
    var defaultEncoding = 'utf8';

    // create the rest api.
    var createApi = function (apiName, type, method, host, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler) {
        // the return function has three parameters:
        // (params, data, userCallback)
        // the params and data are optional, and the userCallback is required
        obj[apiName] = function () {
            var paramLen = arguments.length;
            var userCallback = null;
            var pathParam = {};
            var dataParam = null;
            var actualHost = host;
            var port = defaultPort;

            if (paramLen > 0) {
                userCallback = arguments[paramLen - 1];
            }
            if (paramLen > 1) {
                pathParam = arguments[0];
            }
            if (paramLen > 2) {
                dataParam = arguments[1];
            }
            // assert.true(paramLen <= 3);

            var pathWithParams = makePathFunction(pathParam);
            var dataSent = makeDataFunction ? makeDataFunction(dataParam) : null;

            // when use the azure storage emulator, the port is included in the host (e.g. 127.0.0.1:10000)
            if (__use_emulator) {
                var parts = actualHost.split(':');
                actualHost = parts[0];
                port = parts[1];
                pathWithParams = '/' + config.account + pathWithParams;
            }

            var headers = constructHeadersWithoutAuth(type, config.version, new Date().toUTCString(), clientId, dataSent);
            if (makeHeaderFunction) {
                makeHeaderFunction(headers);
            }
            var req = azureRequest(type, method, actualHost, headers, pathWithParams, port, function (res) {
                var output = [];
                var length = 0;

                logger.info(util.format('[%s] %s:%s - %d', apiName, actualHost, port, res.statusCode));
                res.setEncoding(defaultEncoding);

                res.on('data', function (chunk) {
                    output.push(chunk);
                    length += chunk.length;
                });

                res.on('end', function () {
                    var data = Buffer.concat(output, length);
                    responseHandler(null, res, data, userCallback);
                });

                res.on('error', function (err) {
                    var data = Buffer.concat(output, length);
                    logger.error(util.format('[%s]: %s', apiName, err.message));
                    responseHandler(err, res, data, userCallback);
                });
            });

            req.on('error', function (err) {
                logger.error(util.format('problem with request: %s\nrequest header: %s', err.message, util.inspect(req._header)));
            });

            req.write(JSON.stringify(dataSent));
            req.end();
        };
    };

    // create rest api for storage type
    var createBlobApi = function (apiName, method, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler) {
        createApi(apiName, 'blob', method, config.hosts.blob, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler);
    };

    var createTableApi = function (apiName, method, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler) {
        createApi(apiName, 'table', method, config.hosts.table, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler);
    };

    var createQueueApi = function (apiName, method, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler) {
        createApi(apiName, 'queue', method, config.hosts.queue, makeHeaderFunction, makePathFunction, makeDataFunction, responseHandler);
    };

    // usage: listContainers(params, onComplete)
    // params: object {
    //           'timeout': timeout in second (optional and default is 60s)
    //           *other parameters* (optional and refered to msdn)
    //         }
    // onComplete: function (result, containers), callback to be invoked when the response returns.
    //         result is true if succeeded. containers is the object array containing all the containers' info.
    createBlobApi('listContainers', 'GET', null, function (params) {
        var path = '/?comp=list';
        var timeout = 60;
        for (var k in params) {
            if (params.hasOwnProperty(k)) {
                if (k === 'timeOut') {
                    timeout = params[k];
                } else {
                    path += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
                }
            }
        }
        path += '&timeout=' + timeout;
        return path;
    }, null, function (err, res, data, callback) {
        var result = !err && res.statusCode === 200;
        if (result) {
            parseXml(data.toString(defaultEncoding), function (err, object) {
                if (err) {
                    logger.error(util.format('parse xml data failed: %s', util.inpsect(err)));
                    result = false;
                    object = '';
                } else {
                    object = object.EnumerationResults.Containers[0].Container || [];
                    for (var i = 0; i < object.length; i++) {
                        object[i].Name = object[i].Name[0];
                        object[i].Properties = object[i].Properties[0];
                        for (var key in object[i].Properties) {
                            if (object[i].Properties.hasOwnProperty(key)) {
                                object[i].Properties[key] = object[i].Properties[key][0];
                            }
                        }
                    }
                }
                if (callback) {
                    callback(result, object);
                }
            });
        } else {
            callback(result, data.toString(defaultEncoding));
        }
    });

    // usage: deleteContainer(params, onComplete)
    // params: object {
    //           'container': containerName,
    //           'timeout': timeout in second (optional and default is 60s)
    //         }
    //         represents the container to be delete
    // onComplete: function (result), callback to be invoked when the response returns. result is true if succeeded
    createBlobApi('deleteContainer', 'DELETE', null, function (params) {
        var containerName = params;
        var timeout = 60;
        if (typeof params === 'object') {
            containerName = params.name;
            timeout = params.timeOut || timeout;
        }
        return '/' + containerName + '?restype=container&timeout=' + timeout;
    }, null, function (err, res, data, callback) {
        var result = !err && (res.statusCode === 202);
        if (!result) {
            logger.trace(util.format('response: %s', data.toString(defaultEncoding)));
        }
        callback(result);
    });

    // usage: listBlobs(params, onComplete)
    // params: object {
    //           'container': containerName,
    //           'timeout': timeout in second (optional and default is 60s)
    //           *other parameters* (optional and refered to msdn)
    //         }
    // onComplete: function (result, blobs), callback to be invoked when the response returns.
    //         result is true if succeeded. blobs is the object array containing all the blobs' info in the container.
    createBlobApi('listBlobs', 'GET', null, function (params) {
        var path = '/' + params.container + '?restype=container&comp=list';
        var timeout = 60;
        for (var k in params) {
            if (params.hasOwnProperty(k) && k !== 'container') {
                if (k === 'timeOut') {
                    timeout = params[k];
                } else {
                    path += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
                }
            }
        }
        path += '&timeout=' + timeout;
        return path;
    }, null, function (err, res, data, callback) {
        var result = !err && res.statusCode === 200;
        if (result) {
            parseXml(data.toString(defaultEncoding), function (err, object) {
                if (err) {
                    logger.error(util.format('parse xml data failed: %s', util.inpsect(err)));
                    result = false;
                    object = '';
                } else {
                    object = object.EnumerationResults.Blobs[0].Blob || [];
                    for (var i = 0; i < object.length; i++) {
                        object[i].Name = object[i].Name[0];
                        object[i].Properties = object[i].Properties[0];
                        for (var key in object[i].Properties) {
                            if (object[i].Properties.hasOwnProperty(key)) {
                                object[i].Properties[key] = object[i].Properties[key][0];
                            }
                        }
                    }
                }
                if (callback) {
                    callback(result, object);
                }
            });
        } else {
            callback(result, data.toString(defaultEncoding));
        }
    });

    // usage: deleteBlob(params, onComplete)
    // params: object {
    //           'container': containerName,
    //           'blob': blobName,
    //           'timeout': timeout in second (optional and default is 60s)
    //         }
    //         represents the blob to be delete
    // onComplete: function (result), callback to be invoked when the response returns. result is true if succeeded
    createBlobApi('deleteBlob', 'DELETE', null, function (params) {
        var containerName = params.container;
        var blobName = params.blob;
        var timeout = params.timeOut || 60; // seconds
        return '/' + containerName + '/' + blobName + '?timeout=' + timeout;
    }, null, function (err, res, data, callback) {
        var result = !err && (res.statusCode === 202);
        if (!result) {
            logger.trace(util.format('response: %s', data.toString(defaultEncoding)));
        }
        callback(result);
    });

    // usage: getBlobProperties(params, onComplete)
    // params: object {
    //           'container': containerName,
    //           'blob': blobName,
    //           'timeout': timeout in second (optional and default is 60s)
    //         }
    //         represents the blob to be fetched
    // onComplete: function (result, blobs), callback to be invoked when the response returns.
    //         result is true if succeeded. properties is the response headers which contains the properties of the blob.
    createBlobApi('getBlobProperties', 'HEAD', null, function (params) {
        var containerName = params.container;
        var blobName = params.blob;
        var timeout = params.timeOut || 60; // seconds
        return '/' + containerName + '/' + blobName + '?timeout=' + timeout;
    }, null, function (err, res, data, callback) {
        var result = !err && res.statusCode === 200;
        callback(result, res.headers);
    });

    // usage: queryEntities(params, onComplete)
    // params: object {
    //          'table': tablename,
    //          'partitionKey': PartitionKey,   (optional)
    //          'rowKey': RowKey,               (optional)
    //          'query': query parameters       (used to compose the query string, does not work currently)
    //         }
    //         represents the entity to be deleted
    // onComplete: function (result, entities), callback to be invoked when the response returns.
    //         result is true if succeeded. and entities is the query result object
    createTableApi('queryEntities', 'GET', null, function (params) {
        var path = '/' + params.table;
        var query = '';

        if (params.PartitionKey && params.RowKey) {
            path += "(PartitionKey='" + encodeURIComponent(params.PartitionKey) + "',RowKey='" + encodeURIComponent(params.RowKey) + "')";
        } else {
            path += "()";
        }

        if (typeof params.query === 'object') {
            for (var key in params.query) {
                if (params.query.hasOwnProperty(key)) {
                    if (query === '') {
                        query = '?';
                    } else {
                        query += '&';
                    }

                    query += key + '=' + encodeURIComponent(params.query[key]);
                }
            }
        }

        return path + query;
    }, null, function (err, res, data, callback) {
        var result = !err && res.statusCode === 200;
        var text = data.toString(defaultEncoding);
        callback(result, result ? JSON.parse(text) : text);
    });

    // usage: deleteEntity(params, onComplete)
    // params: object { 'table': tablename, 'partitionKey': PartitionKey, 'rowKey': RowKey } represents the entity to be deleted
    // onComplete: function (result), callback to be invoked when the response returns. result is true if succeeded.
    createTableApi('deleteEntity', 'DELETE', function (headers) {
        headers['If-Match'] = '*';
    }, function (params) {
        var table = params.table;
        var partitionKey = params.PartitionKey;
        var rowKey = params.RowKey;
        return util.format("/%s(PartitionKey='%s',RowKey='%s')", table, partitionKey, rowKey);
    }, null, function (err, res, data, callback) {
        // 204 means no content (successful)
        var result = !err && (res.statusCode === 204);
        if (!result) {
            logger.trace(util.format('response: %s', data.toString(defaultEncoding)));
        }
        callback(result);
    });

    // usage: createTable(tableName, onComplete)
    // tableName: string name of the table to be created
    // onComplete: function (result), callback to be invoked when the response returns. result is true if succeeded.
    (function () {
        var tableName;
        createTableApi('createTable', 'POST', null, function (param) {
            tableName = param;
            return '/Tables';
        }, function () {
            return { "TableName": tableName };
        }, function (err, res, data, callback) {
            // 201 means created and 204 means no content
            var result = !err && (res.statusCode === 201) || (res.statusCode === 204);
            if (!result) {
                logger.trace(util.format('response: %s', data.toString(defaultEncoding)));
            }
            callback(result);
        });
    })();

    // usage: deleteTable(tableName, onComplete)
    // tableName: string name of the table to be deleted
    // onComplete: function (result), callback to be invoked when the response returns. result is true if succeeded.
    createTableApi('deleteTable', 'DELETE', null, function (tableName) {
        return "/Tables('" + tableName + "')";
    }, null, function (err, res, data, callback) {
        // 201 means created and 204 means no content
        var result = !err && (res.statusCode === 204);
        if (!result) {
            logger.trace(util.format('response: %s', data.toString(defaultEncoding)));
        }
        callback(result);
    });

    // usage: queryTables(onComplete)
    // onComplete (optional): function (result, tables), callback to be invoked when the response returns.
    //         result is true if succeeded. and tables is the query result object
    createTableApi('queryTables', 'GET', null, function () {
        return '/Tables';
    }, null, function (err, res, data, callback) {
        var result = !err && (res.statusCode === 200);
        var text = data.toString(defaultEncoding);
        if (callback) {
            callback(result, result ? JSON.parse(text) : text);
        }
    });

    // usage: insertEntity(tableName, entityObject, onComplete)
    // tableName: string name of the table
    // entityObject: object represents the entity, must contains "PartitionKey" and "RowKey" properties of string type
    // onComplete: function (result), callback to be invoked when the response returns. result is true if succeeded.
    createTableApi('insertEntity', 'POST', null, function (tableName) {
        return '/' + tableName;
    }, function (entityObject) {
        return entityObject;
    }, function (err, res, data, callback) {
        // 201 means created and 204 means no content
        var result = !err && ((res.statusCode === 201) || (res.statusCode === 204));
        if (!result) {
            logger.trace(util.format('response: %s', data.toString(defaultEncoding)));
        }
        callback(result);
    });

    return obj;
};
