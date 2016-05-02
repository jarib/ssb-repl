#!/usr/bin/env node

const jsonStatRepl = require('jsonstat-repl');
const fetch = require('node-fetch');
const debug = require('debug')('ssb-repl');
const argv = require('yargs')
    .usage('$0 <table-id> [args]')
    .option('limit', {
        alias: 'l',
        describe: 'Only fetch the first N values of each variable (to reduce size)',
        type: 'number'
    })
    .option('exclude-eliminiation', {
        alias: 'ee',
        describe: 'Ignore variables that can be eliminated (to reduce size)',
        type: 'boolean'
    })
    .option('stdin', {
        alias: 's',
        describe: 'Read a custom JSON query from STDIN',
        type: 'boolean'
    })
    .option('metadata', {
        alias: 'm',
        describe: 'Only print metadata from the given table',
        type: 'boolean'
    })
    .string('_').demand(1)
    .help('help')
    .argv;

const tableId = argv._[0];

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
        if (argv.metadata) {
            // just print metadata and exit
            console.log(metadata)
        }

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
