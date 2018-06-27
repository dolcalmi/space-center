'use strict';

const utils = require('../utils');
const Error = require('../error');

// Provide extension mechanism for Nequi Resource Sub-Classes
Resource.extend = utils.protoExtend;

function Resource(stellarSpace) {
  this._api = stellarSpace._api;
  this.initialize.apply(this, arguments);
}

Resource.prototype = {

  initialize: function() {},

  _getServer() {
    return this._api.server;
  },

  _loadAccount(publicKey) {
    return this._getServer().loadAccount(publicKey);
  },

  _buildAndSubmit(transaction, signers) {
    let tx = transaction.build();
    signers.forEach(function (keypair) {
      tx.sign(keypair);
    });
    return this._getServer()
      .submitTransaction(tx)
      .catch(this._errorHandler);
  },

  _errorHandler: function(error) {
    // console.log(error.response.data ? error.response.data.extras.result_codes : error.response);
    return Promise.reject(Error.StellarError.generate(error));
  },
};

module.exports = Resource;
