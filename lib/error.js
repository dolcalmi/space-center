'use strict';

var utils = require('./utils');

module.exports = _Error;

/**
* Generic Error klass to wrap any errors returned by nequi-node
*/
function _Error(/* raw*/ ) {
  this.populate.apply(this, arguments);
  this.stack = (new Error(this.message)).stack;
}

// Extend Native Error
_Error.prototype = Object.create(Error.prototype);

_Error.prototype.type = 'GenericError';
_Error.prototype.populate = function(type, message) {
  this.type = type;
  this.message = message;
};

_Error.extend = utils.protoExtend;

/**
* Create subclass of internal Error klass
* (Specifically for errors returned from Nequi's REST API)
*/
var StellarError = _Error.StellarError = _Error.extend({
  type: 'StellarError',
  populate: function(err) {
    // Move from prototype def (so it appears in stringified obj)
    this.type = this.type;

    this.stack = (new Error(err.message)).stack;
    this.rawType = err.type;
    this.code = err.code;
    this.message = err.message;
    this.transaction = err.transaction;
    this.raw = err.response.data;
  },
});

/**
* Helper factory which takes raw nequi errors and outputs wrapping instances
*/
StellarError.generate = function(rawStellarError) {
  rawStellarError.message = customMessages[rawStellarError.code] || rawStellarError.message || '';
  // switch (rawStellarError.code) {
  //   case '20-05A':
  //   return new _Error.StellarBadSequenceError(rawStellarError);
  // }
  return new _Error.StellarError(rawStellarError);
};

// Specific Nequi Error types:
_Error.StellarError = StellarError.extend({type: 'StellarError'});
_Error.StellarBadSequenceError = StellarError.extend({type: 'StellarBadSequenceError'});

var customMessages = {
  '20-05A': 'invalid sequence'
};
