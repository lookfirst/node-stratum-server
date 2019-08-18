'use strict';
const rpcApi = require('./jsonrpc.js');

const { RpcConf } = require('../config.js');
const util = require('./util');

class Upstream {
    #client = null;

    constructor() {
        this.#client = new rpcApi(RpcConf);
    }

    getTemplate() {
        return new Promise((resolve, reject) => {
            this.#client.call({
                method: 'getblocktemplate',
                params: [{rules: ["segwit"]}]
            }, (error, data) => {
                if (error) return reject(error);
                return resolve(data.result);
            });
        });
    }

    longPoll(lpId) {
        return new Promise((resolve, reject) => {
            this.#client.call({
                method: 'getblocktemplate',
                params: [{rules: ["segwit"], longpollid: lpId}]
            }, (error, data) => {
                if (error) return reject(error);
                return resolve(data.result);
            });
        });
    }

    propose(data) {
        return new Promise((resolve, reject) => {
            this.#client.call({
                method: 'getblocktemplate',
                params: [ { mode : "proposal", rules : ["segwit"], data : data.toString('hex')} ]
            }, (error, data) => {
                if (error) return reject(error);
                return resolve(data.result);
            });
        });
    }

    submit(data) {
        return new Promise((resolve, reject) => {
            this.#client.call({
                method: 'submitblock',
                params: [ data.toString('hex') ]
            }, (error, data) => {
                if (error) return reject(error);
                return resolve(data.result);
            });
        });
    }
    
    getMemoryPool() {
        return new Promise((resolve, reject) => {
            this.#client.call({
                method: 'getrawmempool',
                params: [],
            }, (error, data) => {
                if (error) return reject(error);
                return this.queryMemoryPool(data.result);
            });
        });
    }
    
    queryMemoryPool(hashes) {
        return new Promise((resolve, reject) => {
            let batch = hashes.map(hash => { return { method: 'getrawtransaction', params: [hash], id: hash } });
            this.#client.call(batch, (error, data) => {
                if (error) reject(error);
                let entries = data.reduce((result, next) => {
                    result[next.id] = next.result;
                    return result;
                }, {});
    
                resolve(entries);
            });
        });
    }
}


module.exports = Upstream;

