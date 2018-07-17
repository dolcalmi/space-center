'use strict';

const _ = require('lodash');
const StellarSdk = require('stellar-sdk');
const utils = require('../utils');
const Resource = require('./base');
const TxHelper = require('../transaction-helper');

module.exports = Resource.extend({
  create(assetCode, options) {
    const self = this;
    const opts = this._defaultOptions(assetCode, options || {
      homeDomain: null,
      mustAuthorize: true,
      isRevocable: true,
    });

    const issuerAccount = StellarSdk.Keypair.fromSecret(opts.issuer.secret);
    const authorizerAccount = StellarSdk.Keypair.fromSecret(opts.authorizer.secret);
    const distributorAccount = StellarSdk.Keypair.fromSecret(opts.distributor.secret);
    const fundingAccount = StellarSdk.Keypair.fromSecret(this.getApiField('fundingAccount'));

    return this._loadAccount(fundingAccount.publicKey())
    .then(function(account) {
      const { issuer, authorizer, distributor } = opts;
      const asset = { code: assetCode, issuer: issuer.publicKey };
      const txh = new TxHelper(account);

      txh.addMemo(opts.memo);
      txh.createAccount(authorizer);
      txh.createAccount(issuer);
      txh.createAccount(distributor);
      txh.addPayment(issuer.publicKey, distributor.publicKey, opts.startingAssetBalance, asset);

      const signers = _.concat(
        [ fundingAccount, issuerAccount, authorizerAccount, distributorAccount ],
        utils.getTrustlinesSigners(authorizer.trustlines),
        utils.getTrustlinesSigners(issuer.trustlines),
        utils.getTrustlinesSigners(distributor.trustlines)
      );

      return self._buildAndSubmit(txh.getTransaction(), signers);
    })
    .then(function() {
      const { assetCode, issuer, authorizer, distributor } = opts;
      return {
        assetCode,
        issuer: utils.parseKeypair(issuer),
        authorizer: utils.parseKeypair(authorizer),
        distributor: utils.parseKeypair(distributor),
      };
    });
  },

  _defaultOptions(assetCode, opts) {
    const startingBalance = 10;
    const authorizer = this._defaultAccount({
      startingBalance,
    });

    const issuerThresholds = { masterWeight: 3, lowThreshold: 1, medThreshold: 2, highThreshold: 3 };
    const issuer = this._defaultAccount({
      startingBalance,
      thresholds: issuerThresholds,
      homeDomain: opts.homeDomain,
      mustAuthorize: opts.mustAuthorize,
      isRevocable: opts.isRevocable,
    });

    if (opts.mustAuthorize) {
      issuer.signers = [
        { publicKey: authorizer.publicKey, weight: issuerThresholds.lowThreshold },
      ];
    }

    const distributor = this._defaultAccount({
      startingBalance,
      trustlines: [
        {
          code: assetCode,
          issuer: issuer.publicKey,
          mustAuthorize: opts.mustAuthorize,
          authorizer: authorizer.secret,
          limit: null,
        },
      ],
    });

    const options = _.merge({
      assetCode,
      issuer,
      authorizer,
      distributor,
      startingAssetBalance: 900000000000,
      memo: null,
    }, opts);

    return options;
  },
});
