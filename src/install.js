import View from './components/view'
import Link from './components/link'

export let _Vue
/**
 * 1.把 beforeCreate 和 destroyed 两个钩子全局混入到每个组件的生命周期函数中，
 * 2.当组件实例化时执行 router 的 init 方法，
 * 3.给组件实例上注册响应式 _route 属性，_route 指向当前的路由对象
 * 4.把组件实例注册为路由实例
 * 5.给 vue 实例全局注册 $router(_router) 和 $route(_route) 引用
 * 4.把 RouterView 和 RouterLink 注册成全局组件
 * 5.定义 beforeRouteEnter, beforeRouteLeave, beforeRouteUpdate 的合并策略和
 *  created 的一样
 * @param {*} Vue
 */
export function install (Vue) {
  if (install.installed && _Vue === Vue) return
  install.installed = true

  _Vue = Vue

  const isDef = v => v !== undefined

  const registerInstance = (vm, callVal) => {
    let i = vm.$options._parentVnode
    if (isDef(i) && isDef(i = i.data) && isDef(i = i.registerRouteInstance)) {
      i(vm, callVal)
    }
  }
  // 把 beforeCreate 和 destroyed 两个钩子全局混入到每个 vue 组件中，
  // 进而可以在每个组件实例化时执行 router.init(vm) 方法
  Vue.mixin({
    beforeCreate () {
      if (isDef(this.$options.router)) {
        this._routerRoot = this
        this._router = this.$options.router
        // 执行 VueRouter 实例的 init 方法
        this._router.init(this)
        // defineReactive(targetObj, key, val)，在 vue 实例上定义一个响应式属性 _route，
        Vue.util.defineReactive(this, '_route', this._router.history.current)
      } else {
        this._routerRoot = (this.$parent && this.$parent._routerRoot) || this
      }
      // 从下向上把当前这个 vue 实例注册到它的父 vnode 上
      registerInstance(this, this)
    },
    destroyed () {
      registerInstance(this)
    }
  })

  Object.defineProperty(Vue.prototype, '$router', {
    get () { return this._routerRoot._router }
  })

  Object.defineProperty(Vue.prototype, '$route', {
    get () { return this._routerRoot._route }
  })

  Vue.component('RouterView', View)
  Vue.component('RouterLink', Link)

  const strats = Vue.config.optionMergeStrategies
  // use the same hook merging strategy for route hooks
  strats.beforeRouteEnter = strats.beforeRouteLeave = strats.beforeRouteUpdate = strats.created
}
