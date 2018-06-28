'use strict';

const StellarSdk = require('stellar-sdk');
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
      const signers = [ fundingAccount, newAccount ];

      txh.createAccount(opts);

      opts.trustlines.forEach((asset) => {
        if (asset.mustAuthorize && asset.authorizer) {
          signers.push(StellarSdk.Keypair.fromSecret(asset.authorizer));
        }
      });

      return self._buildAndSubmit(txh.getTransaction(), signers);
    })
    .then(function() {
      const { publicKey, secret } = opts;
      return { publicKey, secret };
    })
  },
});
