/* @flow */

import type VueRouter from '../index'
import { parsePath, resolvePath } from './path'
import { resolveQuery } from './query'
import { fillParams } from './params'
import { warn } from './warn'
import { extend } from './misc'
/**
 * 当 current 存在时，
 * 1. next.path 不存在而next.params存在时，生成相对于 current.params 的相对参数Location对象，
 * 2. next.path 存在时，忽略next.params 和 current.params，生成相对于 current.path 的相对路径Location对象
 * @param {*} raw 
 * @param {*} current 
 * @param {*} append 
 * @param {*} router 
 */
export function normalizeLocation (
  raw: RawLocation,
  current: ?Route,
  append: ?boolean,
  router: ?VueRouter
): Location {
  let next: Location = typeof raw === 'string' ? { path: raw } : raw
  // named target
  if (next._normalized) {
    return next
  } else if (next.name) {
    // 浅拷贝一份raw给next
    next = extend({}, raw)
    const params = next.params
    // 此时params还指向原始raw上的params对象
    if (params && typeof params === 'object') {
      next.params = extend({}, params)
    }
    return next
  }

  // relative params
  // 如果next.path不存在，同时next.params 和 current 存在，则相对于current的参数进行导航:
  if (!next.path && next.params && current) {
    next = extend({}, next)
    next._normalized = true
    // 用next.params(也就是raw.params)上的属性和current.params的属性合并，
    // 相同属性名的next.params会覆盖current.params，但不影响current.params本身
    // 1.则最终 next 的params是在current.params 的基础上合并生成的
    const params: any = extend(extend({}, current.params), next.params)
    // 2.如果current.name存在，则优先用 current.name 作为 next.name，
    // create-matcher.js 中的 match() 方法会优先用该 name 查找对应的 RouteRecord 对象
    if (current.name) {
      next.name = current.name
      next.params = params
    } else if (current.matched.length) {
      // current.name不存在时，用current.matched 末尾的 RouteRecord
      //（也就是当前 current 所对应的 RouteRecord，它会在 current.matched 数组
      // 的末尾） 的 path
      //（也就是路由配置时传入的path）作为 next.path
      // create-matcher.js 中的 match() 方法会用该 path 查找对应的 RouteRecord 对象
      const rawPath = current.matched[current.matched.length - 1].path
      next.path = fillParams(rawPath, params, `path ${current.path}`)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(false, `relative params navigation requires a current route.`)
    }
    return next
  }
  // 注意：当next.path存在时，以下的代码中没再用到 next.params 和 current.params，
  // 这就是文档中说的，路径对象Location中存在 path 时，params会被忽略
  const parsedPath = parsePath(next.path || '')
  // 如果 next.path 和 current.path 同时存在，
  // 则最终生成的 path 是current.path+next.path 这样拼成的
  // 也就是 next.path 相对于 current.path 的路径
  const basePath = (current && current.path) || '/'
  const path = parsedPath.path
    ? resolvePath(parsedPath.path, basePath, append || next.append)
    : basePath

  const query = resolveQuery(
    parsedPath.query,
    next.query,
    router && router.options.parseQuery
  )
  // 当next的hash字段有值时，优先采用该值作为最终的hash，
  // 否则才使用从 next.path 中解析出来的hash
  let hash = next.hash || parsedPath.hash
  if (hash && hash.charAt(0) !== '#') {
    hash = `#${hash}`
  }

  return {
    _normalized: true,
    path,
    query,
    hash
  }
}
