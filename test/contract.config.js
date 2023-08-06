const AssetType = require('../src/asset-type.js')

module.exports = {
    id: 'CDFXTZCMGMJPYGRNWXGIJIDF2WVY4LOF2OQL5XYG34J7LTX3NO3PJIXQ',
    decimals: 14,
    resolution: 30000,
    network: 'Test SDF Future Network ; October 2022',
    horizonUrl: 'https://rpc-futurenet.stellar.org:443',
    adminSecret: 'SAABHX5JQZJJSCGLU2KDMYAIAJOLHUR7PLRBRLGZ5OT45QYH6CQ6HGXS',
    assets: [
        {type: AssetType.STELLAR, code: 'CCS4CSIRFMC24GMM3CK2IN26MBGC7XFU3ANRSZT42Q2EQIYTQPXG6HCP'},
        {type: AssetType.STELLAR, code: 'CCGPVN63F6DFRDJAQGKYAM7MEJMCNZCTCXIYYM4K6P6SLUTUK6GAATY6'},
        {type: AssetType.GENERIC, code: 'EUR'},
        {type: AssetType.STELLAR, code: 'CD47KXBD5FDU6XXIO25WUGOPHCUWNYSVBKUKWT5QFUO7CHXTHFICJZZY'},
        {type: AssetType.STELLAR, code: 'CCRL6YOV5PKFA3MVELSK7T7XNDAZXQXIICTMIQLVUG53WYNGOHM66AOT'},
        {type: AssetType.GENERIC, code: 'USD'}
    ]
}