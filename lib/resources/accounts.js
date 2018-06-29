'use strict';

const _ = require('lodash');
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
      txh.addMemo(opts.memo).createAccount(opts);

      const signers = _.concat(
        [ fundingAccount, newAccount ],
        utils.getTrustlinesSigners(opts.trustlines)
      );

      return self._buildAndSubmit(txh.getTransaction(), signers);
    })
    .then(function() {
      const { publicKey, secret } = opts;
      return { publicKey, secret };
    });
  },
});
