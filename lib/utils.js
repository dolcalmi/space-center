'use strict';

const StellarSdk = require('stellar-sdk');
const hasOwn = {}.hasOwnProperty;

module.exports = {

  parseAsset(input) {
    return new StellarSdk.Asset(input.code, input.issuer);
  },

  parseMemo(input) {

    if (input && typeof input === 'string') {
      return StellarSdk.Memo.text(input)
    }

    const { type, content } = input;
    // Type must not be none
    switch(type.toUpperCase()) {
      case 'TEXT':
      case 'MEMO_TEXT':
        return StellarSdk.Memo.text(content);
      case 'ID':
      case 'MEMO_ID':
        return StellarSdk.Memo.id(content);
      case 'HASH':
      case 'MEMO_HASH':
        return StellarSdk.Memo.hash(content);
      case 'RETURN':
      case 'MEMO_RETURN':
        return StellarSdk.Memo.returnHash(content);
      default:
        return null;
    }
  },

  /**
  * Stringifies an Object, accommodating nested objects
  * (forming the conventional key 'parent[child]=value')
  */
  stringifyData: function(data) {
    return JSON.stringify(data)
  },

  /**
  * Provide simple "Class" extension mechanism
  */
  protoExtend: function(sub) {
    var Super = this;
    var Constructor = hasOwn.call(sub, 'constructor') ? sub.constructor : function() {
      Super.apply(this, arguments);
    };

    // This initialization logic is somewhat sensitive to be compatible with
    // divergent JS implementations like the one found in Qt. See here for more
    // context:
    //
    // https://github.com/stripe/stripe-node/pull/334
    Object.assign(Constructor, Super);
    Constructor.prototype = Object.create(Super.prototype);
    Object.assign(Constructor.prototype, sub);

    return Constructor;
  },

};
