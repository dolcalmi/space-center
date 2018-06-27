'use strict';

const _ = require('lodash');
const StellarSdk = require('stellar-sdk');
const Resource = require('./base');
const utils = require('../utils');

module.exports = Resource.extend({
  create(options) {
    const self = this;
    const opts = _.merge(this._defaultAccount(), options);
    const minBalance = this._calcMinBalance(opts);
    const distributor = StellarSdk.Keypair.fromSecret(this._api.distributorKey);

    if (opts.startingBalance < minBalance) {
      opts.startingBalance = minBalance;
    }

    return this._loadAccount(distributor.publicKey())
    .then(function(account) {
      const txb = buildCreateAccountTx(account, opts.account.publicKey, opts.startingBalance, opts.memo);
      return self._buildAndSubmit(txb, [distributor]);
    })
    .then(function() {
      let account = opts.account.publicKey;
      if (opts.source && opts.source.publicKey !== opts.account.publicKey && opts.source.secret) {
        account = opts.source.publicKey;
      }
      return self._loadAccount(account);
    })
    .then(function(account) {
      const txb = buildAccountSetupTx(account, opts)
      const signers = [ StellarSdk.Keypair.fromSecret(opts.account.secret) ];
      if (opts.source && opts.source.publicKey !== opts.account.publicKey && opts.source.secret) {
        signers.push(StellarSdk.Keypair.fromSecret(opts.source.secret));
      }
      return self._buildAndSubmit(txb, signers);
    })
    .then(function() {
      return opts.account;
    })
  },

  _defaultAccount() {
    const stellarAccount = StellarSdk.Keypair.random();
    const plainAccount = {
      publicKey: stellarAccount.publicKey(),
      secret: stellarAccount.secret(),
    };

    const account = {
      source: _.clone(plainAccount),
      masterKey: this._api.masterKey,
      account: plainAccount,
      signers: [
        // { publicKey: this._api.masterKey, weight: 1 }
      ],
      trustlines: this._api.trustlines,
      inflationDest: this._api.inflationDest,
      memo: null,
      startingBalance: 1,
      weights: {
        masterWeight: 1, // set master key weight
        lowThreshold: 1,
        medThreshold: 1, // a payment is medium threshold
        highThreshold: 1, // make sure to have enough weight to add up to the high threshold!
      },
    };
    account.startingBalance = this._calcMinBalance(account);
    return account;
  },

  _calcMinBalance(account) {
    // + 1 is because masterkey sign
    const subentries = account.trustlines.length + account.signers.length + 1;
    const networkReserve = (2 + subentries) * 0.5;
    const reserve = this._api.extraReserve
    return networkReserve + reserve;
  }
});

function buildCreateAccountTx(distributor, publicKey, startingBalance, memo) {
  const txb = new StellarSdk.TransactionBuilder(distributor)
  .addOperation(StellarSdk.Operation.createAccount({
    destination: publicKey,
    startingBalance: startingBalance + '',
  }));


  if (memo && typeof memo === 'string') {
    txb.addMemo(StellarSdk.Memo.text(memo));
  }

  if (memo && typeof memo === 'object') {
    txb.addMemo(memo);
  }

  return txb;
}

function buildAccountSetupTx(source, opts) {
  const setupOpts = _.merge(opts.weights, {
    source: opts.account.publicKey,
    inflationDest: opts.inflationDest,
    signer: {
      ed25519PublicKey: opts.masterKey,
      weight: opts.weights.highThreshold,
    }
  });

  const txb = new StellarSdk.TransactionBuilder(source);

  opts.signers.forEach(({publicKey, weight}) => {
    txb.addOperation(StellarSdk.Operation.setOptions({
      source: opts.account.publicKey,
      signer: {
        ed25519PublicKey: publicKey,
        weight: Number(weight)
      }
    }));
  });

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

  txb.addOperation(StellarSdk.Operation.setOptions(setupOpts));

  return txb;
}
