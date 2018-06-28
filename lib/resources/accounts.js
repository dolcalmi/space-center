'use strict';

const StellarSdk = require('stellar-sdk');
const utils = require('../utils');
const Resource = require('./base');
const TxHelper = require('../transaction-helper');

module.exports = Resource.extend({
  create(options) {
    const self = this;
    const opts = this._defaultAccount(options);

    const newAccount = StellarSdk.Keypair.fromSecret(opts.secret);
    const fundingAccount = StellarSdk.Keypair.fromSecret(this.getApiField('fundingAccount'));

    return this._loadAccount(fundingAccount.publicKey())
    .then(function(account) {
      const txh = new TxHelper(account);
      txh.createAccount(opts);

      const signers = utils.getTrustlinesSigners(opts.trustlines);
      signers.push(fundingAccount);
      signers.push(newAccount);

      return self._buildAndSubmit(txh.getTransaction(), signers);
    })
    .then(function() {
      const { publicKey, secret } = opts;
      return { publicKey, secret };
    })
  },
});
