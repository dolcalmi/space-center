'use strict';

const _ = require('lodash');
const utils = require('../utils');
const Error = require('../error');

// Provide extension mechanism for Sub-Classes
Resource.extend = utils.protoExtend;

function Resource(stellarSpace) {
  this.stellarSpace = stellarSpace;
  this.initialize.apply(this, arguments);
}

Resource.prototype = {

  initialize: function() {},

  getApiField(key) {
    return this.stellarSpace.getApiField(key);
  },

  _getServer() {
    return this.getApiField('server');
  },

  _loadAccount(publicKey) {
    return this._getServer().loadAccount(publicKey);
  },

  _buildAndSubmit(transaction, signers) {
    let tx = transaction.build();

    _.uniqBy(signers, function (s) {
      return s.secret();
    })
    .forEach(function (keypair) {
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

  _defaultAccount(opts) {
    const { publicKey, secret } = utils.randomKeypair();
    const options = _.merge({
      masterKey: this.getApiField('masterKey'),
      memo: null,
      publicKey,
      secret,
      exists: false,
      startingBalance: 1,
      trustlines: [],
      signers: [ /* { publicKey: '', weight: 1 } */ ],
      thresholds: { masterWeight: 1, lowThreshold: 1, medThreshold: 1, highThreshold: 2 },
      inflationDest: this.getApiField('inflationDest'),
      homeDomain: null,
      mustAuthorize: false,
      isRevocable: false,
    }, opts);

    const minBalance = this._calcMinBalance(options);
    if (options.startingBalance < minBalance) {
      options.startingBalance = minBalance;
    }

    return options;
  },

  _calcMinBalance(account) {
    const trustlines = account.trustlines.length;
    // + 1 because we always add masterkey as signer
    const signers = account.signers.length + 1;
    const reserve = this.getApiField('extraReserve');

    return utils.calcMinBalance(trustlines, signers, reserve);
  }
};

module.exports = Resource;
