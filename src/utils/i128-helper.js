const TWO_POW_64 = 2n ** 64n

/**
 * Converts i128 value to hi and lo parts
 * @param {BigInt} value - i128 value
 * @returns {{hi: string, lo: string}} - hi and lo parts
 */
function i128ToHiLo(value) {
    const lo = (value % TWO_POW_64).toString()
    const hi = (value / TWO_POW_64).toString()
    return {hi, lo}
}

/**
 * Converts hi and lo parts to i128 value
 * @param {string} hi - hi part
 * @param {string} lo - lo part
 * @returns {BigInt} - i128 value
 */
function hiLoToI128(hi, lo) {
    const hiPart = BigInt(hi) * TWO_POW_64
    const loPart = BigInt(lo)
    return hiPart + loPart
}

module.exports = {
    i128ToHiLo,
    hiLoToI128
}