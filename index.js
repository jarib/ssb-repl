#!/usr/bin/env node

const jsonStatRepl = require('jsonstat-repl');
const fetch = require('node-fetch');
const debug = require('debug')('ssb-repl');
const argv = require('yargs')
    .number('limit')
    .string('_')
    .argv;

const tableId = argv._[0];

if (!tableId) {
    console.error('USAGE: ssb-repl [--limit n] table-id');
    process.exit(1);
}

const HEADERS = {
    'User-Agent': 'ssb-repl',
    Accept: 'application/json'
}

const apiUrl = 'http://data.ssb.no/api/v0/no/table/' + tableId;

const jsonify = (method, res) => {
    if (res.ok) {
        return res.json();
    } else {
        return res.text().then(body => {
            debug(body);

            const err = new Error('unable to ' + method + ' ' + res.url + ' for table ' + tableId + ': ' + res.status + ' ' + res.statusText);
            err.httpCode = res.status;
            err.httpBody = res.body;

            return Promise.reject(err);
        });
    }
}

// fetch metadata for the table
debug(apiUrl)
fetch(apiUrl, {headers: HEADERS})
    .then(jsonify.bind(null, 'GET'))
    .then(metadata => {
        if (metadata.variables) {
            // construct a query to fetch everything
            const query = {
                query: metadata.variables.map(v => ({
                    code: v.code,
                    selection: (argv.limit ? { filter: 'item', values: v.values.slice(0, +argv.limit) } : { filter: 'all', values: ['*'] })
                })),
                response: {
                    format: 'json-stat'
                }
            };

            const body = JSON.stringify(query, null, 2);

            debug(apiUrl);
            debug(body);

            return fetch(apiUrl, {
                method: 'POST',
                body: body,
                headers: HEADERS
            })
            .then(jsonify.bind(null, 'POST'))
            .then(jsonStatRepl.start)
            .catch(err => {
                if (err.httpCode === 403) {
                    console.error(err.message);
                    console.error('The response may be too big. Use [--limit n] to only fetch the n first values of each dimension.');
                } else {
                    return Promise.reject(err);
                }
            })
        } else {
            console.error('invalid table\n\n', metadata);
        }
    })
    .catch(console.error);
