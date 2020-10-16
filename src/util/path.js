/* @flow */
/**
 * 把 relative 拼在 base 后面形成一个path，返回
 * @param {*} relative 
 * @param {*} base 
 * @param {*} append 
 */
export function resolvePath (
  relative: string,
  base: string,
  append?: boolean
): string {
  const firstChar = relative.charAt(0)
  if (firstChar === '/') {
    return relative
  }

  if (firstChar === '?' || firstChar === '#') {
    return base + relative
  }

  const stack = base.split('/')

  // remove trailing segment if:
  // - not appending
  // - appending to trailing slash (last segment is empty)
  if (!append || !stack[stack.length - 1]) {
    stack.pop()
  }

  // resolve relative path
  const segments = relative.replace(/^\//, '').split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    // 如果 relative 中存在 '..' 路径就往上一级跳一级，
    // 所以从 stack 末尾弹出一段
    if (segment === '..') {
      stack.pop()
    } else if (segment !== '.') {
      // 把 relative 中的路径段拼在base的路径段后面
      stack.push(segment)
    }
  }

  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('')
  }

  return stack.join('/')
}
/**
 * 把形如 '/this/is/a/path?para1=123#hash' 这样的 path，拆成
 * {
 *  path: '/this/is/a/path',
 *  query: 'para1=123',
 *  hash: 'hash'
 * }
 * @param {*} path 
 */
export function parsePath (path: string): {
  path: string;
  query: string;
  hash: string;
} {
  let hash = ''
  let query = ''

  const hashIndex = path.indexOf('#')
  if (hashIndex >= 0) {
    hash = path.slice(hashIndex)
    path = path.slice(0, hashIndex)
  }

  const queryIndex = path.indexOf('?')
  if (queryIndex >= 0) {
    query = path.slice(queryIndex + 1)
    path = path.slice(0, queryIndex)
  }

  return {
    path,
    query,
    hash
  }
}

export function cleanPath (path: string): string {
  // 把所有的 '//' 替换成 '/'
  return path.replace(/\/\//g, '/')
}
