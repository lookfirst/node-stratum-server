#!/usr/bin/env node
'use strict';

const { Template } = require('./internals/primitives');
const Upstream = require('./internals/upstream');
const { fork } = require('child_process');

let clients = fork('./stratum_workers.js');
let upstream = new Upstream;

function timestamp() {
    return new Date().toLocaleString();
}

clients.on('message', msg => {
    if (msg.what == 'share' || msg.what == 'block') {
        let { haystack, difficulty } = msg.data;
        let [user, extraNonce1, extraNonce2, time, nonce] = msg.data.needle;

        let template = new Template(haystack);
        let coinbase = template.serializeCoinbase(extraNonce1, extraNonce2);
        let block = template.serializeBlock(coinbase, time, nonce);

        upstream[(msg.what == 'share' ? 'propose' : 'submit')](block.hex)
        .then(res => {
            if (res !== null)
                return console.log(timestamp(), msg.what, 'with difficulty', difficulty, 'from', user, 'rejected by bitcoind', res);
            console.log(timestamp(), msg.what, 'with difficulty', difficulty, 'from', user, 'accepted by bitcoind');
        }).catch(e => {
            console.log(timestamp(), 'Failed to submit', msg.what, 'with difficulty', difficulty, 'from', user, ':', e);
        });
    }
});

upstream.getTemplate().then(tpl => {
    clients.send({ sender: process.pid, what: 'newjob', data: tpl });

    let lp_wait = function(longpollid) {
        upstream.longPoll(longpollid).then(lp => {
            clients.send({ sender: process.pid, what: 'newjob', data: lp});
            console.log(timestamp(), 'longpollid', lp.longpollid);
            lp_wait(lp.longpollid);
        });
    }
    lp_wait(tpl.longpollid);
}).catch(e => console.log(timestamp(), 'error', e));
