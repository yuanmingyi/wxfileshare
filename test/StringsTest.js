var strings = require(__dirname + '/../app/Strings');
var logger = require(__dirname + '/../app/logger').logger();
var utils = require(__dirname + '/utils');
var assert = require('assert');
var util = require('util');

var strres = {
    "1": "abcdefg",
    "2": "$(1)",
    "3": "$((hello world)",
    "4": "$((1)",
    "5": "$(4) is not hello world, $(3) is hello world, $(4) is $(1)",
    "6": "this is not$$(7), because $(7)like$($(7)). what is $(1)? can we use $($(2))",
    "7": "$(8)",
    "8": "2",
    "9": "$(6) is too long, I like$(5)which is shorter, but $(3) is even shorter. Maybe, $(4) is shortest, but $(5) is best",
    "0": "$(1) $(4) $(3) $(1):$(4):$(3):$(1)_$(4)_$(3)",
    "a": "hello %s world: %d"
};

var errormsg = function (key) {
    return util.format('%s:\n%s', key, strres[key]);
}

strings.compileStrings(strres);
assert.equal(strres['1'], 'abcdefg', errormsg('1'));
assert.equal(strres['2'], 'abcdefg', errormsg('2'));
assert.equal(strres['3'], '$(hello world)', errormsg('3'));
assert.equal(strres['4'], '$(1)', errormsg('4'));
assert.equal(strres['5'], '$(1) is not hello world, $(hello world) is hello world, $(1) is abcdefg', errormsg('5'));
assert.equal(strres['6'], 'this is not$2, because 2like$(2). what is abcdefg? can we use $(abcdefg)', errormsg('6'));
assert.equal(strres['7'], '2', errormsg('7'));
assert.equal(strres['8'], '2', errormsg('8'));
assert.equal(strres['9'],
    'this is not$2, because 2like$(2). what is abcdefg? can we use $(abcdefg) is too long,'
    + ' I like$(1) is not hello world, $(hello world) is hello world, $(1) is abcdefgwhich is shorter,'
    + ' but $(hello world) is even shorter. Maybe, $(1) is shortest, but '
    + '$(1) is not hello world, $(hello world) is hello world, $(1) is abcdefg is best',
    errormsg('9'));
assert.equal(strres['0'], 'abcdefg $(1) $(hello world) abcdefg:$(1):$(hello world):abcdefg_$(1)_$(hello world)', errormsg('0'));

var a = strings.getString.apply(strres, ['a', 'HELLO', 1]);
assert.equal(a, 'hello HELLO world: 1', a);
logger.info('Strings Test Pass!');
