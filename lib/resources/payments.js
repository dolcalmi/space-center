'use strict';

const _ = require('lodash');
const StellarSdk = require('stellar-sdk');
const utils = require('../utils');
const Resource = require('./base');
const TxHelper = require('../transaction-helper');

const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))

module.exports = Resource.extend({

  create(options) {
    const self = this;
    const { amount, assetCode, assetIssuer, recipient, senderSecret, memo } = options;

    let asset = new StellarSdk.Asset.native();
    if (assetCode !== 'XLM') {
      asset = new StellarSdk.Asset(assetCode, assetIssuer);
    }

    const senderAccount = StellarSdk.Keypair.fromSecret(senderSecret);
    let payerAccount = this._getPayerAccount(options);

    return this._loadAccount(payerAccount.publicKey())
    .then(function(account) {
      const txh = new TxHelper(account);
      txh.addMemo(memo)
        .addPayment(senderAccount.publicKey(), recipient, amount, asset);

      const signers = [ payerAccount ];

      if (payerAccount !== senderAccount) {
        signers.push(senderAccount);
      }

      return self._buildAndSubmit(txh.getTransaction(), signers);
    })
    .then(function(response) {
      return {
        amount,
        asset: { code: assetCode, issuer: (assetCode === 'XLM') ? 'native' : assetIssuer } ,
        sender: senderAccount.publicKey(),
        recipient,
        transactionId: response.hash,
      };
    });
  },

  batch(options) {
    const { recipients } = options;
    const { assetCode, assetIssuer, senderSecret, memo } = options;
    const senderAccount = StellarSdk.Keypair.fromSecret(senderSecret);
    const payerAccount = this._getPayerAccount(options);
    let asset = new StellarSdk.Asset.native();
    if (assetCode !== 'XLM') {
      asset = new StellarSdk.Asset(assetCode, assetIssuer);
    }

    const chunks = _.chunk(recipients, 100);

    const batch = chunks.map(c => () => this._batch({
      recipients: c,
      asset,
      senderAccount,
      payerAccount,
      memo
    }));

    return promiseSerial(batch)
      .then(function(response) {
        return {
          sender: senderAccount.publicKey(),
          asset: { code: assetCode, issuer: (assetCode === 'XLM') ? 'native' : assetIssuer },
          transactions: response,
        };
      });
  },

  _batch(options) {
    const self = this;

    const { recipients, asset, senderAccount, payerAccount, memo } = options;

    return this._loadAccount(payerAccount.publicKey())
    .then(function(account) {
      const txh = new TxHelper(account);
      txh.addMemo(memo);
      recipients.forEach(function(r) {
        txh.addPayment(senderAccount.publicKey(), r.account, r.amount, asset);
      });

      const signers = [ payerAccount ];

      // if (payerAccount !== senderAccount) {
      //   signers.push(senderAccount);
      // }

      return self._buildAndSubmit(txh.getTransaction(), signers);
    })
    .then(function(response) {
      return {
        transactionId: response.hash,
        recipients,
      };
    });
  },

  _getPayerAccount(options) {
    const { payerSecret, senderSecret } = options;
    const senderAccount = StellarSdk.Keypair.fromSecret(senderSecret);
    let payerAccount = senderAccount;

    if (payerSecret) {
      payerAccount = StellarSdk.Keypair.fromSecret(payerSecret);
    }

    if (options.useFunding) {
      payerAccount = StellarSdk.Keypair.fromSecret(this.getApiField('fundingAccount'));
    }

    return payerAccount;
  },
});
