/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'
import { genStateKey, setStateKey, getStateKey } from './state-key'
import { extend } from './misc'
/**
 * 1.必须是浏览器环境：存在 window 对象
 * 2.当 userAgent 是 Android 2/4 且是 Mobile Safari 且不是 Chrome 和 Windows Phone 时，
 *  不支持 pushState
 * 3.此外，如果存在 history.pushState 函数，则支持
 */
export const supportsPushState =
  inBrowser &&
  (function () {
    const ua = window.navigator.userAgent

    if (
      (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
      ua.indexOf('Mobile Safari') !== -1 &&
      ua.indexOf('Chrome') === -1 &&
      ua.indexOf('Windows Phone') === -1
    ) {
      return false
    }

    return window.history && typeof window.history.pushState === 'function'
  })()

export function pushState (url?: string, replace?: boolean) {
  // 用全局变量 state-key（_key）的当前值记录页面当前的滚动位置
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      const stateCopy = extend({}, history.state)
      // 拿全局变量 state-key（_key）的当前值继续作为接下来 history 项的 key
      // 因为这是 replaceState，上一个 history 项是被接下来的 history 给顶替掉的
      // 所以继续使用上一个 history 项所使用的 state-key
      stateCopy.key = getStateKey()
      history.replaceState(stateCopy, '', url)
    } else {
      // 以当前时刻毫秒值作为 state-key，并更新全局的 state-key（_key）
      history.pushState({ key: setStateKey(genStateKey()) }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

export function replaceState (url?: string) {
  pushState(url, true)
}
