var strings = require(__dirname + '/config').load('strings');
var util = require('util');
var utilities = require(__dirname + '/utilities');
var logger = require(__dirname + '/logger').logger();

var compileStrings = function (strings) {
    // replace some tag with variables
    var outcomingDepends = {};
    var incomingDepends = {};
    var escmarks = {};
    var stack = [];
    var varregexp = /\$\(\w*\)/g;
    var escregexp = /\$\(\(/g;

    for (var key in strings) {
        if (!strings.hasOwnProperty(key)) {
            continue;
        }

        var string = strings[key];
        var result = null;
        outcomingDepends[key] = {};
        while ((result = varregexp.exec(string)) !== null) {
            var depend = result[0].slice(2, -1);
            if (typeof outcomingDepends[key][depend] === 'undefined') {
                outcomingDepends[key][depend] = [];
            }
            outcomingDepends[key][depend].push(result.index);
            if (typeof incomingDepends[depend] === 'undefined') {
                incomingDepends[depend] = [];
            }
            if (incomingDepends[depend].indexOf(key) === -1) {
                incomingDepends[depend].push(key);
            }
        }

        if (Object.getOwnPropertyNames(outcomingDepends[key]).length === 0) {
            stack.push(key);
        }

        var replaces = [];
        while ((result = escregexp.exec(string)) !== null) {
            replaces.push(result.index);
        }

        escmarks[key] = replaces;
    }

    // replace the variables "$(VARNAME)" and escape characters "$(("
    while (stack.length > 0) {
        var key = stack.pop();

        // replace escape characters
        for (var i = escmarks[key].length - 1; i >= 0; i--) {
            var index = escmarks[key][i];
            strings[key] = strings[key].slice(0, index) + '$(' + strings[key].slice(index + 3);
        }

        var string = strings[key];

        // replace key with string in all the incoming dependent strings
        var depends = incomingDepends[key] || [];
        for (var i = 0; i < depends.length; i++) {
            var depend = depends[i];

            // duplicate a indices array
            var indices = outcomingDepends[depend][key].concat();
            var lengthDiff = string.length - (key.length + 3);

            // update the indices
            for (var dependKey in outcomingDepends[depend]) {
                if (!outcomingDepends.hasOwnProperty(dependKey)) {
                    continue;
                }

                var dependIndices = outcomingDepends[depend][dependKey];
                for (var j = 0; j < dependIndices.length; j++) {
                    var dependIndex = dependIndices[j];
                    var nKeys = 0;
                    for (; nKeys < indices.length; nKeys++) {
                        if (indices[nKeys] >= dependIndex) {
                            break;
                        }
                    }

                    dependIndices[j] = dependIndices[j] + nKeys * lengthDiff;
                }
            }
            for (var k = 0; k < escmarks[depend].length; k++) {
                var escmark = escmarks[depend][k];
                var nKeys = 0;
                for (; nKeys < indices.length; nKeys++) {
                    if (indices[nKeys] >= escmark) {
                        break;
                    }
                }

                escmarks[depend][k] = escmarks[depend][k] + nKeys * lengthDiff;
            }

            // replace the key
            for (var k = 0; k < outcomingDepends[depend][key].length; k++) {
                var index = outcomingDepends[depend][key][k];
                strings[depend] = strings[depend].slice(0, index) + string + strings[depend].slice(index + key.length + 3);
            }

            // update the reference
            delete outcomingDepends[depend][key];
            if (Object.getOwnPropertyNames(outcomingDepends[depend]).length === 0) {
                stack.push(depend);
            }
        }
    }
}

compileStrings(strings);
strings.compileStrings = compileStrings;

strings.getString = function (id) {
    var args = Array.prototype.slice.apply(arguments, [1]);
    Array.prototype.unshift.apply(args, [this[id]]);
    return util.format.apply(null, args);
};

module.exports = strings;