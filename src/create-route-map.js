/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'

export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)
  // 把 routes 中配置的每个路由对象，以及 children 子路由，以及别名路由，都解析成 RouteRecord 对象，
  // 然后添加到 pathList, pathMap, nameMap（只有定义了 name 属性的命名路由会添加到 nameMap 中） 中
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route)
  })

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      // 把通配符移到队列尾部，所以需要遍历的结束下标 l 右移一位，
      // 因为原先 i 位置上的元素被删掉了，当前 i 位置上是原先 (i + 1) 位置的值，该值还没有判断，所以 i 需要减一
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
    // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')
    // 找出 path 格式没有以 '/' 开头的，做出提示
    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
      // 除了 children 中的嵌套子路由的 path外，其他 path 都应该以 '/' 开头，通配符 '*' 除外,
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord, // 处理 children 子路由时，parent 是父级路由对象
  matchAs?: string // 处理路由别名时，matchAs 是当前 route 对象实际所代表的目标路径 path
) {
  // pathList: ['/a/b', '/a/b/c',]，所有 path 组成的数组
  // pathMap: {'/a/b': record, '/a/b/c': record2, }, 以 path 为 key，record为值的 map 对象
  // nameMap: {'name1': record, 'name2': record2, }, 以 name 为 key, record 为值的 map 对象
  // 该函数其实是把配置的 route 对象，及其树状的 children 结构给扁平化的全部保存进 pathList, pathMap, nameMap
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )
  }

  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {}
  const normalizedPath = normalizePath(path, parent, pathToRegexpOptions.strict)

  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    // 只有当 route.props 和 route.components 属性同时配置时，该项才取 route.props，
    // 只配置了 route.props 时，该项是 { default: route.props }
    // 在多视图路由中，route.props 的配置和 route.components 的格式一样，key: value，key是
    // 视图名，value 是针对该视图的 props 值（boolean | object | function）
    // 而只有默认视图时，就转成 { default: route.props } 的形式
    props:
      route.props == null
        ? {}
        : route.components
          ? route.props
          : { default: route.props }
  }

  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    // 没有指定 redirect 的命名路由，如果存在 path 为 '' 或者 '/' 这样的默认子路由，
    // 当你想要通过 name 来跳转到该命名路由时，它的这个默认子路由是不会被渲染的
    // path 是 '' 或者 '/' 的是默认路由.
    if (process.env.NODE_ENV !== 'production') {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${
              route.name
            }'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        )
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      // 以当前构造的 record 为 parent，继续为每个 child 构造自己的record
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path)
    pathMap[record.path] = record
  }

  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      // 不要把 alias 和 path 配成一样的.
      if (process.env.NODE_ENV !== 'production' && alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue
      }

      const aliasRoute = {
        path: alias,
        children: route.children
      }
      // 把 alias 也当作一个 path路径对象 添加进 pathList, pathMap, nameMap
      // 注意，alias 的 matchAs 是它对应的 path，当路径匹配到 alias 时，其实会去执行 matchAs 的匹配
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    }
  }

  if (name) {
    // 如果配置了 route.name，才会往 nameMap 中添加，而且不能重复.
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex (
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  // 把 path 转成正则式，如果path中存在 ':bar' 这样的变量时，会把这些提取成 key，存在重复的 key 时会告警
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  // 非严格模式下，把 path 末尾的'/' 删掉
  if (!strict) path = path.replace(/\/$/, '')
  // 以 '/' 开头的 path 直接返回
  // 也就是说，在 children 嵌套子路由中的 path 不能以 '/' 开头，否则将不会和其父 path 拼接成正确的路径
  if (path[0] === '/') return path
  if (parent == null) return path
  // 在构造 children 属性中的子路由时，就会有 parent，就把子路由的 path 拼在 parent.path 的后面
  return cleanPath(`${parent.path}/${path}`)
}
