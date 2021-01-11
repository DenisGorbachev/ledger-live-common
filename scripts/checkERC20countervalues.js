// @flow
/* eslint-disable no-console */

const { log, listen } = require("@ledgerhq/logs");
const zip = require("lodash/zip");
const chunk = require("lodash/chunk");
const {
  listTokensForCryptoCurrency,
  getCryptoCurrencyById,
  getFiatCurrencyByTicker,
} = require("../lib/currencies");
const api = require("../lib/countervalues/api").default;
const network = require("../lib/network").default;
const { delay } = require("../lib/promise");

const ethereum = getCryptoCurrencyById("ethereum");
const usd = getFiatCurrencyByTicker("USD");

async function fetchPriceFromEtherscan(token) {
  const { data } = await network({
    method: "GET",
    url: `https://etherscan.io/token/${token.contractAddress}`,
  });
  let str = data.replace(/\s/g, "");
  const prefix = 'Price</span></div><spanclass="d-block">';
  const i = str.indexOf(prefix);
  if (i === -1) return;
  str = str.slice(i + prefix.length);
  const j = str.indexOf("<");
  str = str.slice(0, j);
  if (str[0] !== "$") return;
  str = str.slice(1).replace(",", "");
  const value = parseFloat(str);
  if (isNaN(value)) return;
  return value;
}

if (process.env.VERBOSE) {
  listen((l) => console.log(JSON.stringify(l)));
}

async function main() {
  const tokens = listTokensForCryptoCurrency(ethereum);
  for (const c of chunk(tokens, 5)) {
    const latest = await api.fetchLatest(c.map((from) => ({ from, to: usd })));
    const etherscan = await Promise.all(c.map(fetchPriceFromEtherscan));
    zip(latest, etherscan, c).forEach(([ours, theirs, token]) => {
      log("check", `${c.id} ${latest || 0} ${etherscan || 0}`);
      if (!ours && !theirs) return;
      const id = `${token.id} (${token.contractAddress})`;
      if (ours && !theirs) {
        if (!token.disableCountervalue) {
          console.log(
            `${id} in countervalues, but not in etherscan. should probably DISABLE the token (crypto-assets repo).`
          );
        }
      } else if (!ours && theirs) {
        if (!token.disableCountervalue) {
          console.log(
            `${id} in etherscan, not ours. should contact the countervalues provider (it could be an alias) about this OR decide to DISABLE.`
          );
        }
      } else {
        const ratio = ours > theirs ? ours / theirs : theirs / ours;
        if (ratio > 5) {
          if (!token.disableCountervalue) {
            console.log(`${id}: PRICE MISMATCH! $${ours} vs $${theirs}`);
          }
        } else if (token.disableCountervalue) {
          console.log(
            `${id} should be ENABLED (crypto-assets repo). (${ours} looks close enough to ${theirs})`
          );
        }
      }
    });
    await delay(3000);
  }
  console.log("finished to run on " + tokens.length + " tokens");
}

main();
