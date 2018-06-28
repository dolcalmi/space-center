'use strict';

const _ = require('lodash');
const StellarSdk = require('stellar-sdk');
const Resource = require('./base');
const utils = require('../utils');

module.exports = Resource.extend({
  create(options) {
    const self = this;
    const opts = _.merge(this._defaultAccount(), options);

    const newAccount = StellarSdk.Keypair.fromSecret(opts.account.secret);
    const distributor = StellarSdk.Keypair.fromSecret(this._api.distributorKey);

    const minBalance = this._calcMinBalance(opts);
    if (opts.startingBalance < minBalance) {
      opts.startingBalance = minBalance;
    }

    return this._loadAccount(distributor.publicKey())
    .then(function(account) {
      const txb = buildAccountSetupTx(account, opts);
      const signers = [ distributor, newAccount ];
      return self._buildAndSubmit(txb, signers);
    })
    .then(function() {
      return opts.account;
    })
  },

  _defaultAccount() {
    const stellarAccount = StellarSdk.Keypair.random();
    const account = {
      publicKey: stellarAccount.publicKey(),
      secret: stellarAccount.secret(),
    };

    const options = {
      masterKey: this._api.masterKey,
      account: account,
      signers: [ /* { publicKey: '', weight: 1 } */ ],
      trustlines: this._api.trustlines || [],
      inflationDest: this._api.inflationDest,
      memo: null,
      startingBalance: 1,
      thresholds: { masterWeight: 1, lowThreshold: 1, medThreshold: 1, highThreshold: 1 },
    };

    options.startingBalance = this._calcMinBalance(options);

    return options;
  },

  _calcMinBalance(account) {
    // + 1 because we always add masterkey as signer
    const subentries = account.trustlines.length + account.signers.length + 1;
    const networkReserve = (2 + subentries) * 0.5;
    const reserve = this._api.extraReserve
    return networkReserve + reserve;
  }
});

function buildAccountSetupTx(source, opts) {
  const txb = new StellarSdk.TransactionBuilder(source)
  // creates new account
  .addOperation(StellarSdk.Operation.createAccount({
    destination: opts.account.publicKey,
    startingBalance: opts.startingBalance + '',
  }));

  const memo = utils.parseMemo(opts.memo);

  if (memo) {
    txb.addMemo(memo);
  }

  // add aditional signers. Master not included here
  opts.signers.forEach(({publicKey, weight}) => {
    txb.addOperation(StellarSdk.Operation.setOptions({
      source: opts.account.publicKey,
      signer: {
        ed25519PublicKey: publicKey,
        weight: Number(weight)
      }
    }));
  });

  // add trustlines
  opts.trustlines.forEach((asset) => {
    const o = {
      source: opts.account.publicKey,
      asset: utils.parseAsset(asset)
    };
    if (asset.limit > 0) {
      o.limit = asset.limit + '';
    }
    txb.addOperation(StellarSdk.Operation.changeTrust(o));
  });

  // add thresholds setup, inflation and Mastker key with high threshold
  const setupOpts = _.merge(opts.thresholds, {
    source: opts.account.publicKey,
    inflationDest: opts.inflationDest,
    signer: {
      ed25519PublicKey: opts.masterKey,
      weight: opts.thresholds.highThreshold,
    }
  });
  txb.addOperation(StellarSdk.Operation.setOptions(setupOpts));

  return txb;
}
