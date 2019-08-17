'use strict';

const { diff1 }  = require('./internals/primitives.js');


class RpcConf {
    host = '127.0.0.1';
    port = 8332;
    user = 'bitcoin';
    password = 'bitcoin_wheezy';
};

class StratumConf {
    port = 3333;
    extraNonce1Len = 4;
    recipients = {
        // 
    };
    shareTarget = diff1 / 1024n
};

module.exports.RpcConf = RpcConf;
module.exports.StratumConf = StratumConf;
