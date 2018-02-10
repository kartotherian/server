'use strict';

let Promise = require('bluebird'),
    pathLib = require('path'),
    express = require('express'),
    compression = require('compression'),
    _ = require('underscore');

module.exports.init = function(opts) {
    var sourceKey, configTemplate, config = opts.config,
        publicConfig = {};

    configTemplate = _.template(
        'var config = <%= json %>;'
    );

    for ( sourceKey in config ) {
        // Whitelist, in case opts.config has private data
        publicConfig[sourceKey] = {
            maxZoom: config[sourceKey].maxZoom
        }
    }

    return Promise.try(function () {
        let router = express.Router(),
            handlers = opts.requestHandlers || [];

        handlers.unshift(require('./tiles'), require('./info'));
        return Promise.mapSeries(handlers, function (reqHandler) {
            return reqHandler(opts.core, router);
        }).return(router);

    }).then(function (router) {
        // Add before static to prevent disk IO on each tile request
        let app = opts.app,
            staticOpts = {
                setHeaders: function (res) {
                    if (app.conf.cache) {
                        res.header('Cache-Control', app.conf.cache);
                    }
                    if (res.req.originalUrl.endsWith('.pbf')) {
                        res.header('Content-Encoding', 'gzip');
                    }
                }
            };

        app.use('/', router);

        // Compression is nativelly handled by the tiles, so only statics need its
        app.use(compression());
        app.use('/', express.static(pathLib.resolve(__dirname, '../static'), staticOpts));
        app.use('/leaflet', express.static(pathLib.dirname(require.resolve('leaflet')), staticOpts));

        app.get('/config.js', function(req, res) {
            var publicConfigJSON;

            res.setHeader('Content-Type', 'application/javascript');

            publicConfigJSON = JSON.stringify( publicConfig );

            res.send( configTemplate( { json: publicConfigJSON } ) );
        });

        opts.core.metrics.increment('init');
    });
};
