/* @flow */

import { warn } from './warn'

const encodeReserveRE = /[!'()*]/g
const encodeReserveReplacer = c => '%' + c.charCodeAt(0).toString(16)
const commaRE = /%2C/g

// fixed encodeURIComponent which is more conformant to RFC3986:
// - escapes [!'()*]
// - preserve commas
// encodeURIComponent 原本是不会转义 A-Za-z0-9 -_~.!'*() 的，这里把 !'*() 也给转义了
// encodeURIComponent 原本是会转义 , 的，这里把 , 给保留没有转义
const encode = str =>
  encodeURIComponent(str)
    .replace(encodeReserveRE, encodeReserveReplacer)
    .replace(commaRE, ',')

const decode = decodeURIComponent
/**
 * 把 query 字符串解析成形如
 * {
 *  key1: 'value1',
 *  key2: ['p1=p2', 'value2'],
 *  key3: 'a b',
 * }
 * 这样的对象，并把 extraQuery 中的属性合并进去，同名属性，extraQuery
 * 会覆盖query中的值
 * @param {*} query 
 * @param {*} extraQuery 
 * @param {*} _parseQuery 
 */
export function resolveQuery (
  query: ?string,
  extraQuery: Dictionary<string> = {},
  _parseQuery: ?Function
): Dictionary<string> {
  const parse = _parseQuery || parseQuery
  let parsedQuery
  try {
    parsedQuery = parse(query || '')
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn(false, e.message)
    parsedQuery = {}
  }
  // 如果 extraQuery 中有和 query 中同名的key，则会覆盖 query 中的值
  for (const key in extraQuery) {
    const value = extraQuery[key]
    parsedQuery[key] = Array.isArray(value)
      ? value.map(castQueryParamValue)
      : castQueryParamValue(value)
  }
  return parsedQuery
}

const castQueryParamValue = value => (value == null || typeof value === 'object' ? value : String(value))
/**
 * 把 '?key1=value1&key2=p1=p2&key3=a+b&key2=value2' 
 *  '#key1=value1&key2=p1=p2&key3=a+b&key2=value2'
 *  '&key1=value1&key2=p1=p2&key3=a+b&key2=value2' 
 * 这样的 query
 * 解析成
 * {
 *  key1: 'value1',
 *  key2: ['p1=p2', 'value2'],
 *  key3: 'a b',
 * }
 * @param {*} query 
 */
function parseQuery (query: string): Dictionary<string> {
  const res = {}

  query = query.trim().replace(/^(\?|#|&)/, '')

  if (!query) {
    return res
  }

  query.split('&').forEach(param => {
    const parts = param.replace(/\+/g, ' ').split('=')
    const key = decode(parts.shift())
    const val = parts.length > 0 ? decode(parts.join('=')) : null

    if (res[key] === undefined) {
      res[key] = val
    } else if (Array.isArray(res[key])) {
      res[key].push(val)
    } else {
      res[key] = [res[key], val]
    }
  })

  return res
}

export function stringifyQuery (obj: Dictionary<string>): string {
  const res = obj
    ? Object.keys(obj)
      .map(key => {
        const val = obj[key]

        if (val === undefined) {
          return ''
        }

        if (val === null) {
          return encode(key)
        }

        if (Array.isArray(val)) {
          const result = []
          val.forEach(val2 => {
            if (val2 === undefined) {
              return
            }
            if (val2 === null) {
              result.push(encode(key))
            } else {
              result.push(encode(key) + '=' + encode(val2))
            }
          })
          return result.join('&')
        }

        return encode(key) + '=' + encode(val)
      })
      .filter(x => x.length > 0)
      .join('&')
    : null
  return res ? `?${res}` : ''
}
