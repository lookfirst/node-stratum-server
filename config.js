'use strict';

const { diff1 }  = require('./internals/primitives.js');

module.exports.RpcConf = {
    host: '127.0.0.1',
    port: 8332,
    user: 'bitcoin',
    password: 'bitcoin_wheezy'
};

module.exports.StratumConf = {
    port: 3333,
    extraNonce1Len: 4,
    shareTarget: diff1 / 1n
};

module.exports.Recipients = {
    //
};
