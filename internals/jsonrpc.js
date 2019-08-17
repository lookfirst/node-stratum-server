// Derived from node-json-rpc-2

const https = require('https');
const http = require('http');
function getRandomId() {
    return parseInt(Math.random() * 100000);
}

class Client {
    #authNeeded = false;
    #protocol = 'http';
    #user = null;
    #password = null;
    #host = '127.0.0.1';
    #port = 8080;
    #agent = http;
    #method = "POST";
    #path = '/';

    #authData = null;

    constructor(options) {
        options = options || {};
        if ('protocol' in options) this.#protocol = options.protocol;
        if ('user' in options) this.#user = options.user;
        if ('password' in options) this.#password = options.password;
        if ('host' in options) this.#host = options.host;
        if ('method' in options) this.#method = options.method;
        if ('path' in options) this.#path = options.path;

        this.#agent = (this.#protocol === 'https') ?https: http;
        this.#port = ('port' in options) ? options.port : ((this.#protocol === 'https') ?8443 : 8080);

        if (this.#user && this.#password) {
            this.#authNeeded = true;
            this.#authData = this.#user + ':' + this.#password;
        }
    }

    call(options, callback, id) {
        let requestData = null;

        if (Array.isArray(options)) requestData = options.map(req => Client.parse(req));
        if (!Array.isArray(options)) requestData = Client.parse(options);

        requestData = JSON.stringify(requestData);
        if (this.#method == 'GET') {
            requestData = require('querystring').escape(requestData);
        }
        let requestOptions = {
            agent: this.#agent.globalAgent,
            method: this.#method,
            host: this.#host,
            port: this.#port,
            path: this.#path,
            headers: {
                'content-type': (this.#method == 'POST') ?'application/x-www-form-urlencoded': 'application/json',
                'content-length': (requestData).length
            }
        };

        if(this.#authNeeded) requestOptions.auth = this.#authData;
        if(this.#method == 'GET') requestOptions.path = requestOptions.path + requestData;

        let request = this.#agent.request(requestOptions);
        request.on('error', error => {
            callback('error:', error);
        });
        request.on('response', response => {
            let buffer = '';
            response.on('data', bytes => {
                buffer += bytes;
            });

            response.on('end', () => {
                let error, result;
                let data = buffer;

                switch (response.statusCode) {
                    case 400: {
                        error = new Error('Connection Accepted but error : 400 Bad request Unauthorized - ' + data);
                        callback(error, data);
                    }; break;
                    case 401: {
                        error = new Error('Connection Rejected : 401 Unauthorized');
                    }; break;
                    case 403: {
                        error = new Error('Connection Rejected : 403 Forbidden');
                    }; break;
                    case 500: {
                        try {
                            let tmp = JSON.parse(data);
                            error = tmp.error.message;
                        } catch(e) {
                            error = new Error('Connection Rejected : 500 Internal server error');
                        }
                    }; break;
                    case 200: case 300: {
                        if (data.length > 0) {
                            try {
                                result = JSON.parse(data);
                            } catch (err) {
                                error = new Error('Connection Accepted but error JSON :' + err);
                            }
                        }
                    }; break;

                    default: {
                        error = new Error('Connection Rejected : Unhandled status code ' + response.statusCode + '');
                    }
                }

                callback(error, result);
            });
        });

        request.end(requestData);
    }

    static parse(options) {
        let requestData = {};

        let id = getRandomId(), params = [], method = '', jsonrpc = '2.0';
        if (options) {
            if (options.hasOwnProperty('method')) {
                method = options.method;
            }
            if (options.hasOwnProperty('params')) {
                params = options.params;
            }
            if (options.hasOwnProperty('jsonrpc')) {
                jsonrpc = options.jsonrpc;
            }
            if (options.hasOwnProperty('id')) {
                id = options.id;
            }
        }

        requestData.id = id;
        requestData.method = method;
        requestData.params = params;
        requestData.jsonrpc = jsonrpc;

        return requestData;
    }
}

module.exports = Client;
