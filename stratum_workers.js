'use strict';

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const StratumConf = require('./config.js').StratumConf;
const StratumServer = require('./internals/stratum.js');

if (cluster.isMaster) {
    console.log('Starting stratum master process');

    process.on('message', async msg => {
        switch (msg.what) {
            case 'newjob': {
                    console.log('Forwarding new job to workers');
                    for (let i in cluster.workers) {
                        cluster.workers[i].send(msg);
                    }          
            }; break;
            default:
                throw 'Unknown message ' + msg.what;
        }
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log('Stratum worker ' + worker.process.pid + ' died');
        if (worker.exitedAfterDisconnect !== true) {
            cluster.fork();
        }
    });

    cluster.on('fork', worker => {
        // Forward any worker message from their master process to our application endpoint
        worker.on('message', async msg => {
            process.send(msg);
        });
        console.log('Worker', worker.process.pid, 'started');
    });

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Termination handlers
    let killAll = () => {
        for (let i in cluster.workers) {
            console.log('Shutting down worker', cluster.workers[i].process.pid);
            cluster.workers[i].kill();
        }
        process.exit(0);
    };

    process.on('SIGINT', killAll);
    process.on('SIGTERM', killAll);

    console.log('Stratum master is running with pid', process.pid);
}

if (cluster.isWorker) {
    let server = new StratumServer(new StratumConf)

    process.on('message', async msg => {
        switch(msg.what) {
            case 'newjob': {
                let fresh = false;
                server.start(() => {
                    fresh = true;
                    server.push(msg.data);
                });
                if (!fresh) server.push(msg.data);
        
                console.log('Worker', process.pid, 'got new job containing', msg.data.hashes.length, 'transactions and timestamped at', new Date(msg.data.curtime*1000));
            }; break;
        }
    });
}
