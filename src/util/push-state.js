/* @flow */

import { inBrowser } from './dom'
import { saveScrollPosition } from './scroll'
import { genStateKey, setStateKey, getStateKey } from './state-key'
import { extend } from './misc'
/**
 * 1.��������������������� window ����
 * 2.�� userAgent �� Android 2/4 ���� Mobile Safari �Ҳ��� Chrome �� Windows Phone ʱ��
 *  ��֧�� pushState
 * 3.���⣬������� history.pushState ��������֧��
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
  // ��ȫ�ֱ��� state-key��_key���ĵ�ǰֵ��¼ҳ�浱ǰ�Ĺ���λ��
  saveScrollPosition()
  // try...catch the pushState call to get around Safari
  // DOM Exception 18 where it limits to 100 pushState calls
  const history = window.history
  try {
    if (replace) {
      // preserve existing history state as it could be overriden by the user
      const stateCopy = extend({}, history.state)
      // ��ȫ�ֱ��� state-key��_key���ĵ�ǰֵ������Ϊ������ history ��� key
      // ��Ϊ���� replaceState����һ�� history ���Ǳ��������� history ���������
      // ���Լ���ʹ����һ�� history ����ʹ�õ� state-key
      stateCopy.key = getStateKey()
      history.replaceState(stateCopy, '', url)
    } else {
      // �Ե�ǰʱ�̺���ֵ��Ϊ state-key��������ȫ�ֵ� state-key��_key��
      history.pushState({ key: setStateKey(genStateKey()) }, '', url)
    }
  } catch (e) {
    window.location[replace ? 'replace' : 'assign'](url)
  }
}

export function replaceState (url?: string) {
  pushState(url, true)
}
