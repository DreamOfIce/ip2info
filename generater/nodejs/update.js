const fetch = require('node-fetch');
const progress = require('progress-stream');
const unzip = require('unzipper');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { mkdir } = require('fs/promises');
const { isIPv4, isIPv6 } = require('net');
const { range2Cidr } = require('./lib/ip');
const readline = require('readline');

// 从.env加载环境变量
require('dotenv').config({ path: path.join(__dirname, '.env') });

//配置
const config = {
    czipSource: path.join(__dirname, '..', '..', 'data', "czip.txt"),
    geoLiteOutput: path.join(__dirname, '..', '..', 'data', 'geolite.csv'),
    geoliteLanguage: 'zh-CN',
    dbipOutput: path.join(__dirname, '..', '..', 'data', 'dbipv6.csv'),
    countryFile: path.join(__dirname, '..', '..', 'data', 'country.json')
}

/**
 * @function 把国家代码转换为国家名
 * @param code {string} 要转换的ISO 3166-1国家代码
 * @return {string} 返回国家的名字
 */
const countryArr = JSON.parse(fs.readFileSync(config.countryFile, { encoding: 'utf8' }));
const getCountryName = (code) => {
    return countryArr[code] ?? 'Unknown';
}
/**
* @function 对DB-IP数据进行处理,修改此函数以按照你的需求修改返回的数据
* @param input {array} 包含DB-IP除最前面的IP范围外的原始数据的数组(以","分割)
* @return {array} 这个数组将被写入生成的CSV中
*/
const dbipProcesser = (input) => {
    return [getCountryName(input[1]), input[2], input[3]];
}

//GeoLite
const getGeoLite = async (savePath) => {
    await mkdir(path.join(__dirname, 'tmp'), { recursive: true });
    const response = await fetch(`https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City-CSV&license_key=${process.env.GEOLITE_KEY}&suffix=zip`);
    const pStream = progress({
        length: response.headers.get("content-length"),
        time: 5000
    })
    pStream.on('progress', info => {
        console.log("GeoLite下载进度: %d%%", info.percentage.toFixed(1));
    })
    return response.body.pipe(pStream).pipe(unzip.Parse()).on('entry', entry => {
        switch (entry.path.split('/')[1]) { //去除前面的目录名
            case 'GeoLite2-City-Blocks-IPv4.csv':
                entry.pipe(fs.createWriteStream(path.join(__dirname, 'tmp', 'geolitedb.csv')));
                break;
            case `GeoLite2-City-Locations-${config.geoliteLanguage}.csv`:
                entry.pipe(fs.createWriteStream(path.join(__dirname, 'tmp', 'geolitelocation.csv')));
                break;
            default:
                entry.autodrain();
                break;
        }
    }).on('close', () => {
        console.log('Start processing geolite data');
    });
}

//DB-IP
const getDbip = async (savePath) => {
    const extract = zlib.createUnzip();
    await mkdir(path.dirname(savePath), { recursive: true });
    const writeStream = fs.createWriteStream(savePath);
    readline.createInterface({
        input: extract
    }).on('line', input => {
        const infos = input.split(',').map((value) => value.replace(/\"([A-Za-z])+ Shi\"/i, "$1").replace(/^\"(.*?)\"$/, "$1"));//去除两边的双引号及类似于Guangzhou Shi的NT内容
        if (isIPv6(infos[0])) {
            let cidrArr = range2Cidr(infos[0], infos[1]);
            let data = dbipProcesser(infos.slice(2)).toString();
            for (let cidr of cidrArr) {
                writeStream.write(`${cidr},${data}\n`);
            }
        }
    }).on('close', () => {
        writeStream.end();
        console.log('%c[INFO]%c DB-IP数据处理完成', "color:#D3D3D3", "");
    });
    const current = new Date();
    const response = await fetch(`https://download.db-ip.com/free/dbip-city-lite-${current.getFullYear()}-${('0' + (current.getMonth() + 1).toString()).slice(-2)}.csv.gz`);
    const pStream = progress({
        length: response.headers.get("content-length"),
        time: 5000
    }).on('progress', info => {
        console.log("%c[INFO]%c DB-IP下载进度: %d%%", "color:#D3D3D3", "", info.percentage.toFixed(1));
    })
    return response.body.pipe(pStream).pipe(extract);
}


console.log('%c[INFO]%c 开始获取最新的数据库……', "color:#D3D3D3", "");
Promise.all([/*getGeoLite(config.geoLiteOutput), */getDbip(config.dbipOutput)]).catch(err => { console.error(`%c[ERROR]%c ${err}`, "color:#FF0000", "") })