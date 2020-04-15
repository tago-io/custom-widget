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
function enableAutofill(variables, widgetVariables) {
    var autoFillArray = [];
    variables.map(function (userVar) {
        widgetVariables.map(function (widgetVar) {
            if (userVar.variable == widgetVar.variable) {
                autoFillArray.push(__assign({ bucket: widgetVar.origin.bucket || "", origin: widgetVar.origin.id || "" }, userVar));
            }
        });
    });
    return autoFillArray;
}
exports.enableAutofill = enableAutofill;
