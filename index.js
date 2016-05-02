#!/usr/bin/env node
'use strict';

const jsonStatRepl = require('jsonstat-repl');
const fetch = require('node-fetch');
const fs = require('fs');
const argv = require('yargs')
    .usage('$0 <table-id> [args]')
    .option('limit', {
        alias: 'l',
        describe: 'Only fetch the first N values of each variable (to reduce size)',
        type: 'number'
    })
    .option('exclude-elimination', {
        alias: 'ee',
        describe: 'Ignore variables that can be eliminated (to reduce size)',
        type: 'boolean'
    })
    .option('metadata', {
        alias: 'm',
        describe: 'Only print metadata from the given table',
        type: 'boolean'
    })
    .option('query', {
        alias: 'q',
        describe: 'Path to file that contains the JSON query you want to execute.',
        type: 'string'
    })
    .option('debug', {
        alias: 'd',
        describe: 'Enable debug logging',
        type: 'boolean'
    })
    .string('_').demand(1)
    .help('help')
    .argv;

const errors = {
    tooBig: 'The response may be too big. Use [--limit n] to only fetch the n first values of each dimension, or [--exclude-elimination] to exclude all variables that can be eliminated.'
}

if (argv.debug) {
    process.env.DEBUG = [process.env.DEBUG, 'ssb-repl'].join(',');
}

const debug = require('debug')('ssb-repl');
debug(argv);

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
            console.log(JSON.stringify(metadata, null, 2))
            return;
        }

        if (metadata.variables) {
            let variables = metadata.variables;

            if (argv.excludeElimination) {
                variables = variables.filter(v => !v.elimination)
            }

            let query;

            if (argv.query) {
                query = JSON.parse(fs.readFileSync(argv.query, 'utf-8'));
            } else {
                query = {
                    query: variables.map(v => ({
                        code: v.code,
                        selection: (argv.limit ? { filter: 'item', values: v.values.slice(0, +argv.limit) } : { filter: 'all', values: ['*'] })
                    })),
                    response: {
                        format: 'json-stat'
                    }
                };
            }


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
                    console.error(errors.tooBig);
                } else {
                    return Promise.reject(err);
                }
            })
        } else {
            console.error('invalid table\n\n', metadata);
        }
    })
    .catch(err => console.error(err.message));
