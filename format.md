# IP2Info 数据库格式
> 因为所有全局索引长度皆为4个四节,所以理论支持最大数据库大小为`4TB`(2^32字节)

## 第一部分 总索引
| 第n字节 |          内容          |     备注      |
| :-----: | :--------------------: | :-----------: |
|  1～4   |    标记IPv4起始位置    | 为0表示不支持 |
|  5～8   |    标记IPv6起始位置    | 为0表示不支持 |
|  9~12   |  标记地理信息起始位置  |               |
|  13~16  | 标记运营商信息起始位置 |               |

## 第二部分 数据库
> 视情况可能有1～2个数据库(IPv4/IPv6)

### 2-1. 标识符

| 第n字节 |                 内容                 | 单位  |        备注         |
| :-----: | :----------------------------------: | :---: | :-----------------: |
|    1    |           索引的`CIDR`长度           |  bit  | 计为`PREFIX_LENGTH` |
|    2    |            每个索引的长度            | 字节  | 计为`INDEX_LENGTH`  |
|    3    |            每条数据的长度            | 字节  |                     |
|    4    |     每条数据中`CIDR后缀`的起始位     |  bit  |                     |
|    5    |  每条数据中`地理信息的位置`的起始位  |  bit  |                     |
|    6    |  每条数据中`地理信息的长度`的起始位  |  bit  |                     |
|    7    | 每条数据中`运营商信息的位置`的起始位 |  bit  |                     |
|    8    | 每条数据中`运营商信息的长度`的起始位 |  bit  |                     |

### 2.2 索引

> 持续 2^`PREFIX_LENGTH` × `INDEX_LENGTH` 个字节

索引每一个CIDR段在数据(2.3)中的起始位置


### 2.3 数据
保存所有的记录：格式如下(单位：bit)
为方便读取，总长度必须为整字节，如不够则在最后补0

IP范围: 不包含索引中的前缀的IP地址(IP位数 - `PREFIX_ LENGTH`),之后为(CIDR后缀 - `PREFIX_LENGTH`)的值

> 以下几项数据单位皆为字节,长度选取满足需求的最小值
- 地理信息在块中的位置
- 地理信息的长度
- 运营商信息在块中的位置
- 运营商索引信息的长度


## 第三部分 地理位置索引
包含所有地理位置信息的data块,每条数据的标准格式如下:
```
国家,省,市
```
也可以自行增加经纬度等信息,以`,`分割.例如:
```
国家,省,市,经度,纬度
```
为了节省空间,两条数据中间不分隔


## 第四部分 运营商索引
包含所有运营商的名称的data块,两条数据中间不分隔