/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 921:
/***/ ((module) => {

// This file replaces `format.js` in bundlers like webpack or Rollup,
// according to `browser` config in `package.json`.

module.exports = function (random, alphabet, size) {
  // We can’t use bytes bigger than the alphabet. To make bytes values closer
  // to the alphabet, we apply bitmask on them. We look for the closest
  // `2 ** x - 1` number, which will be bigger than alphabet size. If we have
  // 30 symbols in the alphabet, we will take 31 (00011111).
  // We do not use faster Math.clz32, because it is not available in browsers.
  var mask = (2 << Math.log(alphabet.length - 1) / Math.LN2) - 1
  // Bitmask is not a perfect solution (in our example it will pass 31 bytes,
  // which is bigger than the alphabet). As a result, we will need more bytes,
  // than ID size, because we will refuse bytes bigger than the alphabet.

  // Every hardware random generator call is costly,
  // because we need to wait for entropy collection. This is why often it will
  // be faster to ask for few extra bytes in advance, to avoid additional calls.

  // Here we calculate how many random bytes should we call in advance.
  // It depends on ID length, mask / alphabet size and magic number 1.6
  // (which was selected according benchmarks).

  // -~f => Math.ceil(f) if n is float number
  // -~i => i + 1 if n is integer number
  var step = -~(1.6 * mask * size / alphabet.length)
  var id = ''

  while (true) {
    var bytes = random(step)
    // Compact alternative for `for (var i = 0; i < step; i++)`
    var i = step
    while (i--) {
      // If random byte is bigger than alphabet even after bitmask,
      // we refuse it by `|| ''`.
      id += alphabet[bytes[i] & mask] || ''
      // More compact than `id.length + 1 === size`
      if (id.length === +size) return id
    }
  }
}


/***/ }),

/***/ 670:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = __webpack_require__(607);


/***/ }),

/***/ 829:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var randomFromSeed = __webpack_require__(946);

var ORIGINAL = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-';
var alphabet;
var previousSeed;

var shuffled;

function reset() {
    shuffled = false;
}

function setCharacters(_alphabet_) {
    if (!_alphabet_) {
        if (alphabet !== ORIGINAL) {
            alphabet = ORIGINAL;
            reset();
        }
        return;
    }

    if (_alphabet_ === alphabet) {
        return;
    }

    if (_alphabet_.length !== ORIGINAL.length) {
        throw new Error('Custom alphabet for shortid must be ' + ORIGINAL.length + ' unique characters. You submitted ' + _alphabet_.length + ' characters: ' + _alphabet_);
    }

    var unique = _alphabet_.split('').filter(function(item, ind, arr){
       return ind !== arr.lastIndexOf(item);
    });

    if (unique.length) {
        throw new Error('Custom alphabet for shortid must be ' + ORIGINAL.length + ' unique characters. These characters were not unique: ' + unique.join(', '));
    }

    alphabet = _alphabet_;
    reset();
}

function characters(_alphabet_) {
    setCharacters(_alphabet_);
    return alphabet;
}

function setSeed(seed) {
    randomFromSeed.seed(seed);
    if (previousSeed !== seed) {
        reset();
        previousSeed = seed;
    }
}

function shuffle() {
    if (!alphabet) {
        setCharacters(ORIGINAL);
    }

    var sourceArray = alphabet.split('');
    var targetArray = [];
    var r = randomFromSeed.nextValue();
    var characterIndex;

    while (sourceArray.length > 0) {
        r = randomFromSeed.nextValue();
        characterIndex = Math.floor(r * sourceArray.length);
        targetArray.push(sourceArray.splice(characterIndex, 1)[0]);
    }
    return targetArray.join('');
}

function getShuffled() {
    if (shuffled) {
        return shuffled;
    }
    shuffled = shuffle();
    return shuffled;
}

/**
 * lookup shuffled letter
 * @param index
 * @returns {string}
 */
function lookup(index) {
    var alphabetShuffled = getShuffled();
    return alphabetShuffled[index];
}

function get () {
  return alphabet || ORIGINAL;
}

module.exports = {
    get: get,
    characters: characters,
    seed: setSeed,
    lookup: lookup,
    shuffled: getShuffled
};


/***/ }),

/***/ 480:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var generate = __webpack_require__(416);
var alphabet = __webpack_require__(829);

// Ignore all milliseconds before a certain time to reduce the size of the date entropy without sacrificing uniqueness.
// This number should be updated every year or so to keep the generated id short.
// To regenerate `new Date() - 0` and bump the version. Always bump the version!
var REDUCE_TIME = 1567752802062;

// don't change unless we change the algos or REDUCE_TIME
// must be an integer and less than 16
var version = 7;

// Counter is used when shortid is called multiple times in one second.
var counter;

// Remember the last time shortid was called in case counter is needed.
var previousSeconds;

/**
 * Generate unique id
 * Returns string id
 */
function build(clusterWorkerId) {
    var str = '';

    var seconds = Math.floor((Date.now() - REDUCE_TIME) * 0.001);

    if (seconds === previousSeconds) {
        counter++;
    } else {
        counter = 0;
        previousSeconds = seconds;
    }

    str = str + generate(version);
    str = str + generate(clusterWorkerId);
    if (counter > 0) {
        str = str + generate(counter);
    }
    str = str + generate(seconds);
    return str;
}

module.exports = build;


/***/ }),

/***/ 416:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var alphabet = __webpack_require__(829);
var random = __webpack_require__(766);
var format = __webpack_require__(921);

function generate(number) {
    var loopCounter = 0;
    var done;

    var str = '';

    while (!done) {
        str = str + format(random, alphabet.get(), 1);
        done = number < (Math.pow(16, loopCounter + 1 ) );
        loopCounter++;
    }
    return str;
}

module.exports = generate;


/***/ }),

/***/ 607:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


var alphabet = __webpack_require__(829);
var build = __webpack_require__(480);
var isValid = __webpack_require__(82);

// if you are using cluster or multiple servers use this to make each instance
// has a unique value for worker
// Note: I don't know if this is automatically set when using third
// party cluster solutions such as pm2.
var clusterWorkerId = __webpack_require__(636) || 0;

/**
 * Set the seed.
 * Highly recommended if you don't want people to try to figure out your id schema.
 * exposed as shortid.seed(int)
 * @param seed Integer value to seed the random alphabet.  ALWAYS USE THE SAME SEED or you might get overlaps.
 */
function seed(seedValue) {
    alphabet.seed(seedValue);
    return module.exports;
}

/**
 * Set the cluster worker or machine id
 * exposed as shortid.worker(int)
 * @param workerId worker must be positive integer.  Number less than 16 is recommended.
 * returns shortid module so it can be chained.
 */
function worker(workerId) {
    clusterWorkerId = workerId;
    return module.exports;
}

/**
 *
 * sets new characters to use in the alphabet
 * returns the shuffled alphabet
 */
function characters(newCharacters) {
    if (newCharacters !== undefined) {
        alphabet.characters(newCharacters);
    }

    return alphabet.shuffled();
}

/**
 * Generate unique id
 * Returns string id
 */
function generate() {
  return build(clusterWorkerId);
}

// Export all other functions as properties of the generate function
module.exports = generate;
module.exports.generate = generate;
module.exports.seed = seed;
module.exports.worker = worker;
module.exports.characters = characters;
module.exports.isValid = isValid;


/***/ }),

/***/ 82:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

var alphabet = __webpack_require__(829);

function isShortId(id) {
    if (!id || typeof id !== 'string' || id.length < 6 ) {
        return false;
    }

    var nonAlphabetic = new RegExp('[^' +
      alphabet.get().replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&') +
    ']');
    return !nonAlphabetic.test(id);
}

module.exports = isShortId;


/***/ }),

/***/ 766:
/***/ ((module) => {

"use strict";


var crypto = typeof window === 'object' && (window.crypto || window.msCrypto); // IE 11 uses window.msCrypto

var randomByte;

if (!crypto || !crypto.getRandomValues) {
    randomByte = function(size) {
        var bytes = [];
        for (var i = 0; i < size; i++) {
            bytes.push(Math.floor(Math.random() * 256));
        }
        return bytes;
    };
} else {
    randomByte = function(size) {
        return crypto.getRandomValues(new Uint8Array(size));
    };
}

module.exports = randomByte;


/***/ }),

/***/ 946:
/***/ ((module) => {

"use strict";


// Found this seed-based random generator somewhere
// Based on The Central Randomizer 1.3 (C) 1997 by Paul Houle (houle@msc.cornell.edu)

var seed = 1;

/**
 * return a random number based on a seed
 * @param seed
 * @returns {number}
 */
function getNextValue() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed/(233280.0);
}

function setSeed(_seed_) {
    seed = _seed_;
}

module.exports = {
    nextValue: getNextValue,
    seed: setSeed
};


/***/ }),

/***/ 636:
/***/ ((module) => {

"use strict";


module.exports = 0;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";

// UNUSED EXPORTS: closeModal, deleteData, editData, editResourceData, onError, onRealtime, onStart, receiveMessage, sendData, sendMessage

// EXTERNAL MODULE: ./node_modules/shortid/index.js
var shortid = __webpack_require__(670);
;// CONCATENATED MODULE: ./src/utils.ts
var __assign = (undefined && undefined.__assign) || function () {
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
/**
 * Apply the auto-fill logic for the data records to make sure they have the necessary data before submission.
 *
 * When `window.TagoIO.autoFill = true`, there's no need to pass `bucket` and `device` (formerly `origin`) in the
 * data record objects to be submitted. TagoIO will auto-fill those fields automatically.
 *
 * To have fine-grained control over the target `device` and `bucket`, set `window.TagoIO.autoFill = false` and
 * make sure the data records being submitted have at least `device` (for Immutable and Mutable devices).
 *
 * This function also makes sure that, when auto-fill is enabled, only records matching the variables on the
 * widget itself are submitted.
 *
 * @param dataRecords Data records to be submitted.
 * @param widgetVariables Widget's variables.
 *
 * @return Array of data records for submission according to the auto-fill logic.
 */
function autoFillRecords(dataRecords, widgetVariables) {
    var autoFilledArray = [];
    if (!dataRecords || !widgetVariables) {
        return [];
    }
    dataRecords.forEach(function (dataRecord) {
        widgetVariables.forEach(function (widgetVar) {
            if (dataRecord.variable === widgetVar.variable) {
                autoFilledArray.push(__assign(__assign({ device: widgetVar.origin.id, origin: widgetVar.origin.id }, (widgetVar.origin.bucket && { bucket: widgetVar.origin.bucket })), dataRecord));
            }
        });
    });
    return autoFilledArray;
}


;// CONCATENATED MODULE: ./src/custom-widget.ts
var custom_widget_assign = (undefined && undefined.__assign) || function () {
    custom_widget_assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return custom_widget_assign.apply(this, arguments);
};


window.TagoIO = {};
/**
 * When window.TagoIO.autoFill = true, you don't have to pass a `bucket` and `origin` key inside of your
 * objects in `sendData`. TagoIO will auto fill those fields automatically for you.
 *
 * If you want to set a specific bucket and device, you must set `window.TagoIO.autoFill` = false, and then pass
 * a `bucket` and `origin` key to the objects in the `sendData` function.
 */
window.TagoIO.autoFill = true;
var funcRealtime;
var funcStart;
var funcError;
var funcSyncUserInfo;
var funcReceiveFormulaResults;
var widgetVariables;
var pool = [];
/**
 * eventListener function that receives messages sent by the parent component
 * @param event event coming from the parent component
 */
var receiveMessage = function (event) {
    var data = event.data;
    if (data) {
        if (data.userInformation && funcSyncUserInfo) {
            funcSyncUserInfo(data.userInformation);
        }
        if (data.widget) {
            widgetVariables = data.widget.display.variables;
            if (funcStart) {
                funcStart(data.widget);
            }
        }
        if (data.realtime && funcRealtime) {
            funcRealtime(data.realtime);
        }
        if (data.status && data.key && pool[data.key] && typeof pool[data.key] === "function") {
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
        if (data.formulaResults && funcReceiveFormulaResults) {
            funcReceiveFormulaResults(data.formulaResults);
        }
    }
};
window.addEventListener("message", receiveMessage, false);
/**
 * Send message to parent component
 * @param message message to send
 */
var sendMessage = function (message) {
    window.parent.postMessage(message, "*");
};
var onReady = function (options) {
    sendMessage(custom_widget_assign({ loaded: true }, options));
};
var onStart = function (callback) {
    funcStart = callback;
};
var onRealtime = function (callback) {
    funcRealtime = callback;
};
var onError = function (callback) {
    funcError = callback;
};
var onSyncUserInformation = function (callback) {
    funcSyncUserInfo = callback;
};
var sendData = function (variables, callback) {
    // generates a unique key to run the callback or promisse
    var uniqueKey = shortid.generate();
    pool[uniqueKey] = callback || null;
    var vars = Array.isArray(variables) ? variables : [variables];
    var autoFillArray = [];
    if (window.TagoIO.autoFill) {
        console.info("AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false.");
        // converts the variables to autofill
        autoFillArray = autoFillRecords(vars, widgetVariables);
    }
    else {
        vars.map(function (vari) {
            if (!vari.bucket || !vari.origin) {
                console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
            }
        });
    }
    sendMessage({
        variables: window.TagoIO.autoFill ? autoFillArray : vars,
        key: uniqueKey
    });
    // If a callback is not passed it returns the promise
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
var editData = function (variables, callback) {
    // generates a unique key to run the callback or promisse
    var uniqueKey = shortid.generate();
    pool[uniqueKey] = callback || null;
    var vars = Array.isArray(variables) ? variables : [variables];
    var autoFillArray = [];
    if (window.TagoIO.autoFill) {
        console.info("AutoFill is enabled, the bucket and origin id will be automatically generated based on the variables of the widget, this option can be disabled by setting window.TagoIO.autoFill = false.");
        // converts the variables to autofill
        autoFillArray = autoFillRecords(vars, widgetVariables);
    }
    else {
        vars.map(function (vari) {
            if (!vari.bucket || !vari.origin) {
                console.error("AutoFill is disabled, the data must contain a bucket and origin key!");
            }
        });
    }
    sendMessage({
        variables: window.TagoIO.autoFill ? autoFillArray : vars,
        method: "edit",
        key: uniqueKey
    });
    // If a callback is not passed it returns the promise
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
var deleteData = function (variables, callback) {
    // generates a unique key to run the callback or promisse
    var uniqueKey = shortid.generate();
    pool[uniqueKey] = callback || null;
    var vars = Array.isArray(variables) ? variables : [variables];
    sendMessage({
        variables: vars,
        method: "delete",
        key: uniqueKey
    });
    // If a callback is not passed it returns the promise
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
var editResourceData = function (variables, callback) {
    var uniqueKey = shortid.generate();
    pool[uniqueKey] = callback || null;
    var variablesToEdit = Array.isArray(variables) ? variables : [variables];
    sendMessage({
        variables: variablesToEdit,
        method: "edit-resource",
        key: uniqueKey
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
var openLink = function (url) {
    sendMessage({ method: "open-link", url: url });
};
var closeModal = function () {
    sendMessage({ method: "close-modal" });
};
var applyFormula = function (data, settings, options) {
    sendMessage({ method: "apply-formula", formulaOptions: { data: data, settings: settings, id: options.id } });
};
// Bind functions to the `window.TagoIO` object for access in the Custom Widget code.
window.TagoIO.ready = onReady;
window.TagoIO.onStart = onStart;
window.TagoIO.onRealtime = onRealtime;
window.TagoIO.onError = onError;
window.TagoIO.onSyncUserInformation = onSyncUserInformation;
window.TagoIO.sendData = sendData;
window.TagoIO.editData = editData;
window.TagoIO.deleteData = deleteData;
window.TagoIO.editResourceData = editResourceData;
window.TagoIO.openLink = openLink;
window.TagoIO.closeModal = closeModal;
window.TagoIO.applyFormula = applyFormula;


})();

/******/ })()
;