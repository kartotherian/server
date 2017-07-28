'use strict';

const util = require('util');
const Promise = require('bluebird');
const _ = require('underscore');
const qidx = require('quadtile-index');
const checkType = require('@kartotherian/input-validator');
const Err = require('@kartotherian/err');
const langCodeRe = /^[-_a-zA-Z]+$/;

class Route {
    constructor(core, router) {
        this.core = core;
        this.router = router;
    }

    addRoute(config) {
        const self = this;

        return Promise.try(() => {
            checkType(config, 'route', 'string-array', true, 1);
            checkType(config, 'source', 'string', true);
            checkType(config, 'type', 'string');

            self.source = this.core.getSources().getSourceById(config.source);

            const handler = self.requestHandler.bind(self);
            _.each(config.route, route => self.router.get(route, handler));
        });
    }
}

class RouteHandler {
    constructor(core, source, config) {
        this.core = core;
        this.source = source;
        this.config = config;
    }

    requestToParams(request) {
        const params = request.params;
        // request.query
        return opts;
    }

//     for (let key in Object.keys(params)) {
//     let value = params[key];
//     switch (key) {
//     case 'z':
//         result[key] = core.validateZoom(value, this.config);
//         break;
//     case 'x':
//     case 'y':
//         result[key] = checkType.strToInt(value);
//         break;
//     case 'scale':
//         result[key] = core.validateScale(value, this.config);
//         break;
//     case 'format':
//         if (!this.config.formats || !_.contains(this.config.formats, value)) {
//             throw new Err('Unknown format %j', value).metrics('err.req.format');
//         }
//         if (value === 'png') {
//             // Ensure that PNGs are not 32bit
//             // TODO: this should be source-configurable
//             value = 'png8:m=h';
//         }
//         result[key] = value;
//         break;
//     case 'lang':
//         if (!langCodeRe.test(value)) {
//             throw new Err('Incorrect lang parameter').metrics('err.req.lang');
//         }
//         result[key] = value;
//     }
// }
//
// if (result.x !== undefined && result.y !== undefined && result.z !== undefined) {
//     result.index = qidx.xyToIndex(result.x, result.y, result.z);
// }
//
// // fixme: Force all tiles to be treated as vector
// opts.treatAsVector = true;
    /**
     * Web server (express) route handler to get requested tile
     * @param req request object
     * @param res response object
     * @param next will be called if request is not handled
     */
    requestHandler(req, res, next) {

        const self = this;
        const core = this.core;
        const params = req && req.params;
        const start = Date.now();

        return Promise.try(
            () => source.getHandler().getAsync(self.requestToParams(req))
        ).then(result => {
            core.setResponseHeaders(res, self.source, result.headers);

            if (params.format === 'json') {
                // Allow JSON to be shortened to simplify debugging
                res.json(filterJson(req.query, result.data));
            } else {
                res.send(result.data);
            }

            let mx = util.format('req.%s.%s.%s', params.src, params.z, params.format);
            if (params.scale) {
                // replace '.' with ',' -- otherwise grafana treats it as a divider
                mx += '.' + (params.scale.toString().replace('.', ','));
            }
            core.metrics.endTiming(mx, start);
        }).catch(err => core.reportRequestError(err, res)).catch(next);
    }

    filterJson(query, data) {
        if ('summary' in query) {
            data = _(data).reduce((memo, layer) => {
                memo[layer.name] = {
                    features: layer.features.length,
                    jsonsize: JSON.stringify(layer).length
                };
                return memo;
            }, {});
        } else if ('nogeo' in query) {
            // Recursively remove all "geometry" fields, replacing them with geometry's size
            let filter = (val, key) => {
                if (key === 'geometry') {
                    return val.length;
                } else if (_.isArray(val)) {
                    return _.map(val, filter);
                } else if (_.isObject(val)) {
                    _.each(val, (v, k) => {
                        val[k] = filter(v, k);
                    });
                }
                return val;
            };
            data = _.map(data, filter);
        }
        return data;
    }
}

module.exports = Route;
