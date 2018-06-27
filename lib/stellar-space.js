const StellarSdk = require('stellar-sdk');
const Accounts = require('./resources/accounts');

StellarSpace.SP_USE_TESTNET = process.env.SP_USE_TESTNET || true;
StellarSpace.SP_PUBLIC_NET = process.env.SP_PUBLIC_NET || 'https://horizon.stellar.org';
StellarSpace.SP_TEST_NET = process.env.SP_TEST_NET || 'https://horizon-testnet.stellar.org';
// https://lumenaut.net
StellarSpace.DEFAULT_INFLATION = 'GCCD6AJOYZCUAQLX32ZJF2MKFFAUJ53PVCFQI3RHWKL3V47QYE2BNAUT';
StellarSpace.DEFAULT_EXTRA_RESERVE = 0.5;

const resources = {
  Accounts,
};

function configServer(useTestnet) {
  let uri = StellarSpace.SP_TEST_NET;
  if (useTestnet) {
    StellarSdk.Network.useTestNetwork();
  } else {
    uri = StellarSpace.SP_PUBLIC_NET;
    StellarSdk.Network.usePublicNetwork();
  }

  return new StellarSdk.Server(uri);
}

function StellarSpace(masterKey, options) {
  if (!(this instanceof StellarSpace)) {
    return new StellarSpace(masterKey, options);
  }

  const useTestnet = options.useTestnet || StellarSpace.SP_USE_TESTNET || true;

  this._api = {
    masterKey,
    distributorKey: options.distributorKey,
    useTestnet,
    server: configServer(useTestnet),
    signers: options.signers || [],
    trustlines: options.trustlines || [],
    extraReserve: StellarSpace.DEFAULT_EXTRA_RESERVE || 0.1,
    inflationDest: options.inflationDest || StellarSpace.DEFAULT_INFLATION,
  };

  this._prepResources();
}

StellarSpace.prototype = {

  _setApiField: function(key, value) {
    this._api[key] = value;
    this._prepResources();
  },

  getApiField: function(key) {
    return this._api[key];
  },

  getConstant: function(c) {
    return StellarSpace[c];
  },

  _prepResources: function() {
    for (var name in resources) {
      this[
        name[0].toLowerCase() + name.substring(1)
      ] = new resources[name](this);
    }
  }
};

module.exports = StellarSpace;
