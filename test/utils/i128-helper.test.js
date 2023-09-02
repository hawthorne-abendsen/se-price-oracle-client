/*eslint-disable no-undef */
const {i128ToHiLo, hiLoToI128} = require('../../src/utils/i128-helper')

const testValues = [
    {
        value: BigInt('0'),
        hi: '0',
        lo: '0'
    },
    {
        value: BigInt('1'),
        hi: '0',
        lo: '1'
    },
    {
        value: BigInt('-1'),
        hi: '0',
        lo: '-1'
    },
    {
        value: BigInt('123456789012345678901234567890'),
        hi: '6692605942',
        lo: '14083847773837265618'
    },
    {
        value: BigInt('-123456789012345678901234567890'),
        hi: '-6692605942',
        lo: "-14083847773837265618"
    },
    {
        value: BigInt('170141183460469231731687303715884105727'),
        hi: '9223372036854775807',
        lo: '18446744073709551615'
    },
    {
        value: BigInt('-170141183460469231731687303715884105728'),
        hi: '-9223372036854775808',
        lo: '0'
    }
]

testValues.forEach(({value, hi, lo}) => {
    test(`i128ToHiLo should convert i128 value ${value.toString()} to hi and lo parts`, () => {
        const {hi: actualHi, lo: actualLo} = i128ToHiLo(value)
        expect(actualHi).toBe(hi)
        expect(actualLo).toBe(lo)
    })

    test(`hiLoToI128 should convert hi ${hi} and lo ${lo} parts to i128 value`, () => {
        const actualValue = hiLoToI128(BigInt(hi), BigInt(lo))
        expect(actualValue.toString()).toBe(value.toString())
    })
})