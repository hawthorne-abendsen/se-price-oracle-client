const {default: BigNumber} = require('bignumber.js')

const TWO_POW_64 = new BigNumber(2).pow(64)

/**
 * Converts i128 value to hi and lo parts
 * @param {BigNumber} value - i128 value
 * @returns {{hi: string, lo: string}} - hi and lo parts
 */
function i128ToHiLo(value) {
    const lo = value.modulo(TWO_POW_64).toFixed()
    const hi = value.idiv(TWO_POW_64).toFixed()
    return {hi, lo}
}

/**
 * Converts hi and lo parts to i128 value
 * @param {string} hi - hi part
 * @param {string} lo - lo part
 * @returns {BigNumber} - i128 value
 */
function hiLoToI128(hi, lo) {
    const hiPart = new BigNumber(hi).times(TWO_POW_64)
    const loPart = new BigNumber(lo)
    return hiPart.plus(loPart)
}

module.exports = {
    i128ToHiLo,
    hiLoToI128
}
