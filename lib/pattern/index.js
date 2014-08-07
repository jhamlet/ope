var ObjectPathEvaluator = require('../base'),
    Handler = require('./handler'),
    Parser = require('./parser'),
    OPL = require('opl'),
    Rx = require('rx'),
    _ = require('underscore'),
    REF_KEY = OPL.REF_KEY;
/**
 * @class PatternObjectPathEvaluator
 * @extends ObjectPathEvaluator
 * @param {...PatternOPEHandler} handler
 */
function PatternObjectPathEvaluator () {
    PatternObjectPathEvaluator.superclass.call(this);
    /**
     * @member PatternObjectPathEvaluator#_handlerMatrix
     * @property {Array<PatternOPEHandler>}
     * @private
     */
    this._handlerMatrix = [];

    _.rest(arguments, 0).
        forEach(function (args) {
            this.handle.apply(this, _.isArray(args) ? args : [args]);
        }.bind(this));

}

_.extend(PatternObjectPathEvaluator, {
    /**
     * @memberof PatternObjectPathEvaluator
     * @see PatternOPEParser
     */
    Parser: Parser,
    /**
     * @memberof PatternObjectPathEvaluator
     * @see PatternOPEHandler
     */
    Handler: Handler
});

module.exports = ObjectPathEvaluator.extend(PatternObjectPathEvaluator,
    /** @lends PatternObjectPathEvaluator# */{
    /**
     * Add a new handler for a OPEndPoint
     * @param {PatternOPEHandler|PatternOPEHandler~Method} handlerOrMethod
     * @param {PatternOPEParser~Pattern} [pattern]
     * @param {PatternOPEHandler~Action} [action]
     * @returns {PatternObjectPathEvaluator} The current instance
     */
    handle: function (handlerOrMethod, pattern, action) {
        var matrix = this._handlerMatrix,
            handler = handlerOrMethod instanceof Handler ?
                handlerOrMethod :
                new Handler(handlerOrMethod, pattern, action),
            list,
            idx;

        idx = handler.pattern.length - 1;
        list = matrix[idx] || (matrix[idx] = []);
        list.push(handler);

        return this;
    },
    /**
     * @private
     */
    _handle: function (type, query, value) {
        var matrix = this._handlerMatrix,
            current = [],
            qLen = query.length,
            isGet = type === Handler.GET,
            handlers,
            hLen,
            key,
            h,
            q,
            i,
            match;

        for (q = 0; q < qLen; q++) {
            key = query[q];

            handlers = matrix[q];
            current.push(key);

            if (handlers) {
                for (i = 0, hLen = handlers.length; i < hLen; i++) {
                    h = handlers[i];
                    match = h && h.match(type, current);

                    if (match) {
                        return h.run(match, value).
                            selectMany(isGet ?
                                this._processGetRefs.bind(this, query.slice(q + 1)) :
                                Rx.Observable.returnValue
                            );
                    }
                }
            }
        }

        return Rx.Observable.
            fromArray(OPL.explode(query)).
            select(function (path) { return { path: path }; });
    },
    /**
     * @private
     */
    _processGetRefs: function (rest, pv) {
        var ref = pv.value && pv.value[REF_KEY],
            ret = Rx.Observable.returnValue(pv),
            path;

        if (ref) {
            path = ref.concat(rest);
            ret = ret.concat(this._handle('get', path));
        }

        return ret;
    },
    /**
     * @private
     * @param {...module:OPE~Query} path
     * @returns {Rx.Observable<module:OPE~PathValue>}
     */
    _get: function () {
        var handle = this._handle.bind(this, Handler.GET);

        return Rx.Observable.
            fromArray(_.rest(arguments, 0)).
            selectMany(handle);
    },
    /**
     * @private
     * @param {...module:OPE~PathValue} pv
     * @returns {Rx.Observable<module:OPE~PathValue>}
     */
    _set: function () {
        var handle = this._handle.bind(this, Handler.SET);

        return Rx.Observable.
            fromArray(_.rest(arguments, 0)).
            selectMany(function (pv) {
                return handle(pv.path, pv.value);
            });
    },
    /**
     * @private
     * @param {...module:OPE~Query} path
     * @returns {Rx.Observable<module:OPE~PathValue>}
     */
    _del: function () {
        var handle = this._handle.bind(this, Handler.DEL);

        return Rx.Observable.
            fromArray(_.rest(arguments, 0)).
            selectMany(handle);
    }
});