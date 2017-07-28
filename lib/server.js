'use strict';

let Promise = require('bluebird'),
    pathLib = require('path'),
    express = require('express'),
    compression = require('compression');

module.exports.init = opts => {

    return Promise.try(() => {
        let router = express.Router(),
            handlers = opts.requestHandlers || [];

        handlers.unshift(require('./tiles'), require('./info'));
        return Promise.mapSeries(handlers,
            reqHandler => reqHandler(opts.core, router)
        ).return(router);

    }).then(router => {
        // Add before static to prevent disk IO on each tile request
        const app = opts.app;

        app.use('/', router);

        // Compression is nativelly handled by the tiles, so only statics need its
        app.use(compression());

        const staticOpts = {
            setHeaders: res => {
                if (app.conf.cache) {
                    res.header('Cache-Control', app.conf.cache);
                }
            }
        };
        app.use('/', express.static(pathLib.resolve(__dirname, '../static'), staticOpts));
        app.use('/leaflet', express.static(pathLib.dirname(require.resolve('leaflet')), staticOpts));

        opts.core.metrics.increment('init');
    });
};
