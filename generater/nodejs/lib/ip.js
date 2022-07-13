const { isIPv4, isIPv6 } = require('net');

/***
 * @function IP范围转CIDR(支持IPv4和IPv6)
 * @param startIpStr {string} 范围的起始IP
 * @param endIpStr {string} 范围的结束IP
 * @return {array} 返回转换后的CIDR数组
 */
const range2Cidr = (startIpStr, endIpStr) => {
    let startIp = ip2BigInt(startIpStr);
    let endIp = ip2BigInt(endIpStr);
    let ipVersion = isIPv6(startIpStr);
    //防止两个输入为不同代数的IP
    if (ipVersion ^ isIPv6(endIpStr)) throw new Error(`Invalid inputs,one is IPv4 and one is IPv6:${startIpStr},${endIpStr}`);
    let long = ipVersion ? 128n : 32n;
    if (startIp === endIp) return [`${startIpStr}/${long}`];
    else if (startIp > endIp) return [];
    //获取最后一个1的位置
    for (let i = 0n, j = long; j > 0n; i++, j--) {
        if (startIp >> i & 1n) {
            let cidr = `${bigInt2Ip(startIp, ipVersion)}/${j}`;
            let newStartIp = startIp + (1n << i);
            return newStartIp >= endIp ? [cidr] : [cidr, ...range2Cidr(bigInt2Ip(newStartIp, ipVersion), endIpStr)];
        } else if (~endIp >> i & 1n) {
            let cidr = `${bigInt2Ip(endIp >> (i + 1n) << (i + 1n), ipVersion)}/${j}`;//右移n位再左移n位相当于把最后n位改为0
            let newEndIp = endIp - (1n << i);
            return newEndIp <= startIp ? [cidr] : [...range2Cidr(startIpStr, bigInt2Ip(newEndIp, ipVersion)), cidr];
        }
    }
}

/***
 * @function 把字符串格式的IP转换为BigInt类型
 * @param ip {string} 要转换的IP
 * @return {bigint} 返回转换后的BigInt对象
 */
const ip2BigInt = (ip) => {
    let result = 0n;
    if (isIPv4(ip)) {
        result = ip.split('.').reduce((total, value, index) => {
            return total + (BigInt(value) << BigInt(3 - index << 3));
        }, 0n);
    } else if (isIPv6(ip)) {
        let afterDoubleColon = false;
        result = ip.split(':').reduce((total, value, index, arr) => {
            if (value === '') {
                afterDoubleColon = true;
                return total;
            } else if (afterDoubleColon) {
                return total + (BigInt(`0x0${value}`) << BigInt(arr.length - index - 1 << 4));
            } else {
                return total + (BigInt(`0x0${value}`) << BigInt(7 - index << 4));
            }
        }, 0n)
    } else {
        throw new Error(`Invalid IP: ${ip}!`);
    }
    return result;
}

/***
 * @function 把BigInt格式的IP转换为字符串
 * @param ip {bigint} 要转换的IP
 * @param forceIPv6 {bool} 强制解析为IPv6(默认情况下会自动识别,小于2^32的值会解析为IPv4)
 * @return {string} 返回转换后的String对象
 */
const bigInt2Ip = (ip, forceIPv6 = false) => {
    if (ip >= 2n << 32n || forceIPv6) {
        let ipParts = [];
        for (let i = 0; i < 8; i++) {
            ipParts.unshift((ip & 0xffffn).toString(16));
            ip >>= 16n;
        }
        let ipStr = ipParts.toString().replaceAll(',', ':');
        //IPv6简化
        let multZeros = (ipStr.match(/(:(0(:|\b))+)/g) ?? []).sort((a, b) => b.length - a.length);
        ipStr = ipStr.replace(multZeros[0], '::');
        return ipStr;
    } else if (ip > 0n) {
        let ipParts = [];
        for (let i = 0; i < 4; i++) {
            ipParts.unshift(ip & 0xffn).toString();
            ip >>= 8n;
        }
        return ipParts.toString().replaceAll(',', '.');
    } else {
        throw new Error(`Invalid IP format:${ip}`);
    }
}

exports = {
    "range2Cidr": range2Cidr,
    "ip2BigInt": ip2BigInt,
    "bigInt2Ip": bigInt2Ip
}