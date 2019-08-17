'use strict';

const util = require('./util.js');

const watermark = '/Eru Ilúvatar/'
const emptyCommitment = "6a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf9";
const donateScript = Buffer.from("a914bb3310cb575409b04b7de1cb0c6ad28762078e6887", "hex");

const diff1 = BigInt('0x00000000ffff0000000000000000000000000000000000000000000000000000');

class MerkleTree {
    #steps = null;

    // Init
    constructor(data) {
        // https://en.bitcoin.it/wiki/Protocol_documentation#Merkle_Trees
        this.#steps = MerkleTree.calculateSteps(data);
    };

    withFirst(f) {
        this.#steps.forEach(function (s) {
            f = util.sha256d(Buffer.concat([f, s]));
        });
        return f;
    };

    getMerkleHashes() {
        return this.#steps.map(function (step) {
            return step.toString('hex');
        });
    };

    static merkleJoin(h1, h2) {
        let joined = Buffer.concat([h1, h2]);
        let dhashed = util.sha256d(joined);
        return dhashed;
    };

    static calculateSteps(data) {
        let L = data;
        let steps = [];
        let PreL = [null];
        let StartL = 2;
        let Ll = L.length;

        if (Ll > 1) {
            while (true) {

                if (Ll === 1)
                    break;

                steps.push(L[1]);

                if (Ll % 2)
                    L.push(L[L.length - 1]);

                let Ld = [];
                let r = util.range(StartL, Ll, 2);
                r.forEach(function (i) {
                    Ld.push(MerkleTree.merkleJoin(L[i], L[i + 1]));
                });
                L = PreL.concat(Ld);
                Ll = L.length;
            }
        }
        return steps;
    }
};

class Template {

    #bits = 0;
    #coinbasevalue = 0;
    #curtime = 0;
    #height = 0;
    #flags = '';
    #previousblockhash = '';
    #version = null;
    #witness_commitment = '';
    #longpollid = null;

    #gen1 = null;
    #gen2 = null;
    #merkleTree = [];
    #target = 0n;
    #data = [];
    #hashes = [];

    #constructor2 = (data, recipients) => {
        // Sanity checks
        if (!recipients) throw 'Recipients list is not available';
        this.#version = data.version;
        this.#previousblockhash = data.previousblockhash;
        this.#flags = data.flags;
        this.#coinbasevalue = data.coinbasevalue;
        this.#target = util.bignumFromBitsHex(data.bits);
        this.#curtime = data.curtime;
        this.#bits = data.bits;
        this.#height = data.height;
        this.#witness_commitment = data.witness_commitment;

        if (!data.hashes.length) {
            this.#hashes = [];
            this.#data = [];
            this.#merkleTree = new MerkleTree([]);
        } else {
            this.#hashes = data.hashes.map(hash => Buffer.from(hash, 'hex'));
            this.#data = data.data.map(txHex => Buffer.from(txHex, 'hex'));
            this.#merkleTree = new MerkleTree([null].concat(util.revertBuffers(this.#hashes)));
        }

        [this.#gen1, this.#gen2] = Template.createGenTx(this, recipients);
    }

    #constructor3 = (tpl, recipients, empty) => {
        // Sanity checks
        if (!recipients) throw 'Recipients list is not available';

        this.#version = tpl.version;
        this.#previousblockhash = tpl.previousblockhash;
        this.#flags = tpl.coinbaseaux.flags;
        this.#target = util.bignumFromBitsHex(tpl.bits);
        this.#curtime = tpl.curtime;
        this.#bits = tpl.bits;
        this.#height = tpl.height;
        this.#longpollid = tpl.longpollid;

        if (empty || !tpl.transactions.length || !tpl.default_witness_commitment) {
            // Calculate coinbase reward at current height
            this.#coinbasevalue = Template.coinbaseSubsidy(tpl.height);
            // Reset transactions array
            this.#hashes = [];
            this.#data = [];
            // Empty block has a constant witness commitment value
            this.#witness_commitment = emptyCommitment
            this.#merkleTree = new MerkleTree([]);
        } else {
            this.#coinbasevalue = tpl.coinbasevalue;
            this.#hashes = tpl.transactions.map(tx => {
                if (tx.txid !== undefined) {
                    return tx.txid;
                }
                return tx.hash;
            }).map(hash => Buffer.from(hash, 'hex'));
            this.#data = tpl.transactions.map(tx => {
                return Buffer.from(tx.data, 'hex');
            });
            this.#witness_commitment = tpl.default_witness_commitment;
            this.#merkleTree = new MerkleTree([null].concat(util.revertBuffers(this.#hashes)));
        }

        [this.#gen1, this.#gen2] = Template.createGenTx(this, recipients);
    };

    constructor() {
        if ('hashes' in arguments[0])
            return this.#constructor2.apply(this, arguments);
        this.#constructor3.apply(this, arguments);

        this.#constructor3 = this.#constructor2 = () => { throw 'Don\'t call me'; };
    }

    static get extraNonceLen() {
        return 8; 
    }

    get curtime() {
        return this.#curtime;
    }

    get difficulty() {
        return diff1 / this.#target;
    }

    get longpollid() {
        return this.#longpollid;
    }

    get previousblockhash() {
        return this.#previousblockhash;
    }

    get target() {
        return this.#target;
    }

    get data() {
        return this.#data.map(tx => tx.toString('hex')); 
    }

    get full() {
        return {
            version: this.#version,
            previousblockhash: this.#previousblockhash,
            coinbasevalue: this.#coinbasevalue,
            flags: this.#flags,
            curtime: this.#curtime,
            bits: this.#bits,
            height: this.#height,
            witness_commitment: this.#witness_commitment,
            hashes: this.#hashes.map(hash => hash.toString('hex')),
            data: this.#data.map(tx => tx.toString('hex'))
        }
    }

    get short() {
        return {
            version: this.#version,
            previousblockhash: this.#previousblockhash,
            coinbasevalue: this.#coinbasevalue,
            flags: this.#flags,
            curtime: this.#curtime,
            bits: this.#bits,
            height: this.#height,
            witness_commitment: this.#witness_commitment,
            hashes: this.#hashes.map(hash => hash.toString('hex')),
            data: []
        }
    }

    loadData(mempool) {
        this.#data = this.short.hashes.map(hash => {
            let tx = mempool[hash];
            if (!tx) throw 'tx ' + hash + ' not found in memory pool';
            return Buffer.from(tx, 'hex');
        });
    }

    serializeCoinbase(extraNonce1, extraNonce2){
        let extraNonce = extraNonce1 + extraNonce2;
        return Buffer.from(this.#gen1 + extraNonce + this.#gen2, 'hex');
    };
    
    serializeHeader (coinbase, time, nonce) {
        if (!time)
            console.log(arguments);

        // https://en.bitcoin.it/wiki/Protocol_specification#Block_Headers
        let coinbaseHash = util.sha256d(coinbase);
        let merkleRoot = this.#merkleTree.withFirst(coinbaseHash).reverse().toString('hex');
        var header = Buffer.allocUnsafe(80);
        var position = 0;
        header.write(nonce, position, 4, 'hex');
        header.write(this.#bits, position += 4, 4, 'hex');
        header.write(time, position += 4, 4, 'hex');
        header.write(merkleRoot, position += 4, 32, 'hex');
        header.write(this.#previousblockhash, position += 32, 32, 'hex');
        header.writeUInt32BE(this.#version, position + 32);
        header.reverse();

        let hash = util.sha256d(header);

        return { data: header, hashBytes: hash, hashVal: util.toBigIntLE(hash) };
    }
    
    serializeBlock (coinbase, time, nonce) {
        if (this.#hashes.length && !this.#data.length)
            throw 'Trying to serialize block on stripped template. Please load transaction data first.';
        let header = this.serializeHeader(coinbase, time, nonce);
        let block = Buffer.concat([
            header.data,
            util.varIntBuffer(this.#hashes.length + 1),
            Template.segwitify(coinbase),
            Buffer.concat(this.#data)
        ]);

        return { data: block, hex: block.toString('hex'), header: header };
    }

    getJobParams (jobId, cleanjobs = false) {
        let prevHashReversed = util.revertByteOrder(Buffer.from(this.#previousblockhash, 'hex')).toString('hex');

        return [
            jobId,
            prevHashReversed,
            this.#gen1,
            this.#gen2,
            this.#merkleTree.getMerkleHashes(),
            util.packInt32BE(this.#version).toString('hex'),
            this.#bits,
            util.packUInt32BE(this.#curtime).toString('hex'),
            cleanjobs
        ];
    }

    /*
    This function creates the generation transaction that accepts the reward for
    successfully mining a new block.
    For some (probably outdated and incorrect) documentation about whats kinda going on here,
    see: https://en.bitcoin.it/wiki/Protocol_specification#tx
    */

    static generateOutputs(tpl, recipients) {
        let reward = tpl.#coinbasevalue;
        let rewardToPool = reward;
        let txOutputBuffers = [];

        for (let i = 0; i < recipients.length; ++i) {
            let recipientReward = Math.floor(recipients[i].percent * reward);
            rewardToPool -= recipientReward;

            txOutputBuffers.push(Buffer.concat([
                util.packInt64LE(recipientReward),
                util.varIntBuffer(recipients[i].script.length),
                recipients[i].script
            ]));
        }

        txOutputBuffers.unshift(Buffer.concat([
            util.packInt64LE(rewardToPool),
            util.varIntBuffer(donateScript.length),
            donateScript
        ]));

        txOutputBuffers.push(Buffer.concat([
            util.packInt64LE(0),
            util.varIntBuffer(tpl.#witness_commitment.length / 2),
            Buffer.from(tpl.#witness_commitment, 'hex')
        ]));

        return Buffer.concat([
            util.varIntBuffer(txOutputBuffers.length),
            Buffer.concat(txOutputBuffers)
        ]);
    }

    static createGenTx (tpl, recipients){
        let txInputsCount = 1;
        let txVersion = 1;
        let txLockTime = 0;
    
        let txInPrevOutHash = Buffer.alloc(32);
        let txInPrevOutIndex = Math.pow(2, 32) - 1;
        let txInSequence = 0;
    
        let scriptSigPart1 = Buffer.concat([
            util.serializeNumber(tpl.#height),
            Buffer.from(tpl.#flags, 'hex'),
            util.serializeNumber(Date.now() / 1000 | 0),
            Buffer.from([this.extraNonceLen]),
        ]);
    
        let outputs = this.generateOutputs(tpl, recipients);
        let scriptSigPart2 = util.serializeString(watermark);
    
        let p1 = Buffer.concat([
            util.packUInt32LE(txVersion),
    
            //transaction input
            util.varIntBuffer(txInputsCount),
            txInPrevOutHash,
            util.packUInt32LE(txInPrevOutIndex),
            util.varIntBuffer(scriptSigPart1.length + this.extraNonceLen + scriptSigPart2.length),
            scriptSigPart1
        ]);
    
        let p2 = Buffer.concat([
            scriptSigPart2,
            util.packUInt32LE(txInSequence),
            //end transaction input
    
            outputs,
            util.packUInt32LE(txLockTime)
        ]);
    
        return [p1.toString('hex'), p2.toString('hex')];
    };

    static coinbaseSubsidy(blockHeight) {
        let halvings = Math.floor(blockHeight / 210000);
    
        // Force block reward to zero when right shift is undefined.
        if (halvings >= 64) {
            return 0;
        }
    
        let nSubsidy = 5000000000;
    
        // Subsidy is cut in half every 210000 blocks which will occur approximately every 4 years.
        while (halvings > 0) {
            nSubsidy /= 2;
            halvings--;
        }
    
        return nSubsidy;
    }

    static segwitify(tx) {
        // Segwit marker and flag
        let witnessFlags = util.packUInt16LE(0x0100);
    
        // coinbase scriptWitness
        let witnessData = Buffer.concat([
            // One empty entry, 32 bytes long
            util.varIntBuffer(0x01),
            util.varIntBuffer(0x20),
            Buffer.alloc(32)
        ]);
    
        let tmp = Buffer.allocUnsafe(tx.length + witnessFlags.length + witnessData.length);
    
        // Copy original data
        tx.copy(tmp, 0, 0, 4);
        tx.copy(tmp, 6, 4, tx.length - 4);
        tx.copy(tmp, tmp.length - 4, tx.length - 4);
    
        // Add segwit data
        witnessFlags.copy(tmp, 4);
        witnessData.copy(tmp, tmp.length - (4 + witnessData.length));
    
        return tmp;
    }
}

module.exports.Template = Template;
module.exports.diff1 = diff1;

