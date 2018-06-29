'use strict';

const _ = require('lodash');
const StellarSdk = require('stellar-sdk');
const utils = require('./utils');

// Provide extension mechanism for Sub-Classes
TxHelper.extend = utils.protoExtend;

function TxHelper(source) {
  this.txb = new StellarSdk.TransactionBuilder(source);
  this.initialize.apply(this, arguments);
}

TxHelper.prototype = {

  initialize: function() {},

  getTransaction() {
    return this.txb;
  },

  createAccount(opts) {
    if (!opts.exists) {
      // creates new account
      this.addCreateAccount(opts.publicKey, opts.startingBalance);
    }

    // add aditional signers. Master not included here
    this.addSigners(opts.publicKey, opts.signers)
      // add trustlines
      .addTrustlines(opts.publicKey, opts.trustlines)
      // add thresholds setup, inflation and Master key with high threshold
      .addOptions(opts.publicKey, opts);
    return this;
  },

  addMemo(memo) {
    const content = utils.parseMemo(memo);
    if (content) {
      this.txb.addMemo(content);
    }
    return this;
  },

  addCreateAccount(account, startingBalance) {
    this.txb.addOperation(StellarSdk.Operation.createAccount({
      destination: account,
      startingBalance: startingBalance + '',
    }));
    return this;
  },

  addSigners(account, signers) {
    signers.forEach(({publicKey, weight}) => {
      this.txb.addOperation(StellarSdk.Operation.setOptions({
        source: account,
        signer: {
          ed25519PublicKey: publicKey,
          weight: Number(weight)
        }
      }));
    });
    return this;
  },

  addTrustlines(account, trustlines) {
    trustlines.forEach((asset) => {
      const o = {
        source: account,
        asset: utils.parseAsset(asset)
      };
      if (asset.limit > 0) {
        o.limit = asset.limit + '';
      }
      this.txb.addOperation(StellarSdk.Operation.changeTrust(o));
      if (asset.mustAuthorize) {
        this.txb.addOperation(StellarSdk.Operation.allowTrust({
          source: asset.issuer,
          trustor: account,
          assetCode: asset.code,
          authorize: true,
        }));
      }
    });
    return this;
  },

  addOptions(account, opts) {
    // add thresholds setup, inflation and Mastker key with high threshold
    const setupOpts = utils.removeEmpty(_.merge(opts.thresholds, {
      source: account,
      inflationDest: opts.inflationDest,
      homeDomain: opts.homeDomain,
    }));

    let flags = 0;
    if (opts.mustAuthorize) {
      flags = flags | StellarSdk.AuthRequiredFlag;
    }

    if (opts.isRevocable) {
      flags = flags | StellarSdk.AuthRevocableFlag;
    }
    
    if (flags > 0) {
      setupOpts.setFlags = flags;
    }

    if (opts.masterKey) {
      setupOpts.signer = {
        ed25519PublicKey: opts.masterKey,
        weight: opts.thresholds.highThreshold,
      };
    }

    this.txb.addOperation(StellarSdk.Operation.setOptions(setupOpts));
    return this;
  },

  addPayment(source, destination, amount, asset) {
    this.txb.addOperation(StellarSdk.Operation.payment({
      source,
      destination,
      asset: utils.parseAsset(asset || 'XLM'),
      amount: amount + '',
    }));
    return this;
  },

};

module.exports = TxHelper;
