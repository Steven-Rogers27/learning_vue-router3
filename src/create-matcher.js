/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'

export type Matcher = {
  match: (raw: RawLocation, current?: Route, redirectedFrom?: Location) => Route;
  addRoutes: (routes: Array<RouteConfig>) => void;
};

export function createMatcher (
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }
  /**
   * 1.当存在 currentRoute 时，先用 raw 生成相对于 currentRoute 的 location 对象
   * 2.然后根据这个 location 对象找到匹配的 RouteRecord 对象，
   * 3.最后用 location 对象和其匹配到的 RouteRecord 对象（可能没有）生成对应于
   *   该 location 的 Route 对象
   * @param {*} raw 当前实际的路径字符串/路径对象 
   * @param {*} currentRoute this.current 指向的当前 Route 对象
   * @param {*} redirectedFrom 
   */
  function match (
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location
  ): Route {
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location
    // location.name 优先于 location.path 被用来查找 RouteRecord 对象
    if (name) {
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      // 如果用 location.name 找不到 RouteRecord，则新创建的 Route 对象
      // 的 matched 字段会为空，也就是没有匹配的 RouteRecord 对象
      if (!record) return _createRoute(null, location)
      // record所对应的path中的变量参数，例如 '/users/:id'，
      // keys就是诸如[{name: 'id', prefix: '/', suffix: ''}]
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      if (typeof location.params !== 'object') {
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          // 如果当前这个 location.params 中缺少某些 RouteRecord 中配置的应该有的
          // 路径参数，而这些缺少的参数恰好在当前这个 currentRoute 中有，则新的 location
          // 会继续采用 currentRoute 的该参数的值
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }
      // 用匹配到的 RouteRecord 的 path，填充上 location.params，生成最终的 location.path
      location.path = fillParams(record.path, location.params, `named route "${name}"`)
      return _createRoute(record, location, redirectedFrom)
    } else if (location.path) {
      location.params = {}
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        const record = pathMap[path]
        // location.path 已经不是 RouteRecord.path 中形如 '/user/:id' 这样，
        // 而是路径参数已经被具体的 params 值替换的结果，形如 '/user/123'，
        // 所以要通过 RouteRecord.regex 来校验是否和 location.path 匹配
        if (matchRoute(record.regex, location.path, location.params)) {
          return _createRoute(record, location, redirectedFrom)
        }
      }
    }
    // 用 location.name 和 location.path 都没有找到匹配的 RouteRecord
    // no match
    return _createRoute(null, location)
  }

  function redirect (
    record: RouteRecord,
    location: Location
  ): Route {
    const originalRedirect = record.redirect
    // originalRedirect 如果是一个函数，它接收重定向到的目的路由对象route，
    // 然后返回目的路由的路径字符串/路径location对象，也就是说用户在路由配置时，
    // redirect 字段如果是一个函数，则需要返回目的路由的路径字符串，或者一个location对象
    let redirect = typeof originalRedirect === 'function'
      ? originalRedirect(createRoute(record, location, null, router))
      : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false, `invalid redirect option: ${JSON.stringify(redirect)}`
        )
      }
      // redirect 无效时，返回一个没有匹配任何 RouteRecord 对象的 Route 对象
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    // query, hash, params 优先用 redirect（Location对象）中的值，
    // 没有的话再用 location 中的
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params
    // 优先用 name 找匹配的 RouteRecord 对象
    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(targetRecord, `redirect failed: named route "${name}" not found.`)
      }
      return match({
        _normalized: true,
        name,
        query,
        hash,
        params
      }, undefined, location)
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(rawPath, params, `redirect route with path "${rawPath}"`)
      // 3. rematch with existing query and hash
      return match({
        _normalized: true,
        path: resolvedPath,
        query,
        hash
      }, undefined, location)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    const aliasedPath = fillParams(matchAs, location.params, `aliased route with path "${matchAs}"`)
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }
  /**
   * 
   * @param {*} record location 对象所匹配的 RouteRecord 对象 
   * @param {*} location 当前要为其生成 Route 对象的 location 对象
   * @param {*} redirectedFrom 
   */
  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    // 如果 record 还没有，或者没有 redirect 和 matchAs 属性，则新建一个route对象
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoutes
  }
}

function matchRoute (
  regex: RouteRegExp,
  path: string,
  params: Object
): boolean {
  const m = path.match(regex)
  // 举例 regex =/^\/foo(?:\/([^\/#\?]+?))[\/#\?]?$/i
  // '/foo/123'.match(regex) 的结果
  /**
   * [
   *  0: '/foo/123',
   *  1: '123',
   *  groups: undefined,
   *  index: 0,
   *  input: '/foo/123',
   *  length: 2
   * ]
   */
  // regex.keys = keys = [{ name: 'bar', prefix: '/', suffix: '', pattern: '[^\\/#\\?]+?', modifier: '' }]

  if (!m) {
    return false
  } else if (!params) {
    return true
  }
  // m 的第二个元素开始是匹配到的路径参数的值，所以 i 从 1 开始
  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    // 对路径参数值做 decode
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      // 把 location.path 中的路径参数值，又赋值给 location.params 中
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
