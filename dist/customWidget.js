"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var shortid = require("shortid");
(function () {
    var funcRealtime;
    var funcStart;
    var funcError;
    var widgetVariables;
    var pool = [];
    function receiveMessage(event) {
        var data = event.data;
        if (data) {
            if (data.realtime && funcRealtime) {
                funcRealtime(data.realtime[0]);
            }
            if (data.widget) {
                widgetVariables = data.widget.display.variables;
                funcStart(data.widget);
            }
            if (data.status && data.key) {
                pool[data.key](data);
            }
            if (data.status === false && data.key) {
                funcError(data);
                pool[data.key](null, data);
            }
        }
    }
    function sendMessage(message) {
        window.parent.postMessage(message, "*");
    }
    window.TagoIO.onStart = function (callback) {
        funcStart = callback;
        sendMessage({ loaded: true });
        window.addEventListener("message", receiveMessage, false);
    };
    window.TagoIO.onRealtime = function (callback) {
        funcRealtime = callback;
    };
    window.TagoIO.onError = function (callback) {
        funcError = callback;
    };
    window.TagoIO.onSendData = function (variables, options, callback) {
        var uniqueKey = shortid.generate();
        pool[uniqueKey] = callback;
        var autoFillArray = [];
        if (options && options.autoFill && widgetVariables) {
            variables.map(function (userVar) {
                widgetVariables.map(function (widgetVar) {
                    if (userVar.variable == widgetVar.variable) {
                        autoFillArray.push(__assign({ bucket: widgetVar.origin.bucket || "", origin: widgetVar.origin.id || "" }, userVar));
                    }
                });
            });
        }
        if (window.Promise && !callback) {
            return new Promise(function (resolve, reject) {
                pool[uniqueKey] = function (success, error) {
                    if (error)
                        reject(error);
                    resolve(success);
                };
            });
        }
        sendMessage({
            variables: (options && options.autoFill) ? autoFillArray : variables,
            key: uniqueKey
        });
    };
})();
