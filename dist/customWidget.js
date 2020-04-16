"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var shortid = require("shortid");
var utils_1 = require("./utils");
(function () {
    var funcRealtime;
    var funcStart;
    var funcError;
    var widgetVariables;
    var pool = [];
    var receiveMessage = function (event) {
        var data = event.data;
        if (data) {
            if (data.realtime && funcRealtime) {
                funcRealtime(data.realtime[0]);
            }
            if (data.widget) {
                widgetVariables = data.widget.display.variables;
                if (funcStart) {
                    funcStart(data.widget);
                }
            }
            if (data.status && data.key && pool[data.key]) {
                pool[data.key](data);
            }
            if (data.status === false) {
                if (funcError) {
                    funcError(data);
                }
                if (data.key && pool[data.key]) {
                    pool[data.key](null, data);
                }
            }
        }
    };
    var sendMessage = function (message) {
        window.parent.postMessage(message, "*");
    };
    window.TagoIO.onStart = function (callback) {
        if (callback) {
            funcStart = callback;
        }
        sendMessage({ loaded: true });
        window.addEventListener("message", receiveMessage, false);
    };
    window.TagoIO.onRealtime = function (callback) {
        funcRealtime = callback;
    };
    window.TagoIO.onError = function (callback) {
        funcError = callback;
    };
    window.TagoIO.sendData = function (variables, options, callback) {
        var uniqueKey = shortid.generate();
        pool[uniqueKey] = callback || null;
        var autoFillArray = [];
        if (options && options.autoFill && widgetVariables) {
            autoFillArray = utils_1.enableAutofill(variables, widgetVariables);
        }
        sendMessage({
            variables: options && options.autoFill ? autoFillArray : variables,
            key: uniqueKey,
        });
        if (window.Promise && !callback) {
            return new Promise(function (resolve, reject) {
                pool[uniqueKey] = function (success, error) {
                    if (error)
                        reject(error);
                    resolve(success);
                };
            });
        }
    };
})();
