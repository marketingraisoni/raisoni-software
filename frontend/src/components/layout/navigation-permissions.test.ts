import { describe, expect, it } from 'vitest'
import { PERMISSION_ACTION, PERMISSION_MODULE } from '@/constants/permissions'
import { USER_TYPE } from '@/constants/user-types'
import { getFirstAccessibleNavigationRoute } from './navigation-permissions'

const user = (
  permissions: Array<{
    module: (typeof PERMISSION_MODULE)[keyof typeof PERMISSION_MODULE]
    actions: Array<(typeof PERMISSION_ACTION)[keyof typeof PERMISSION_ACTION]>
  }>
) => ({
  userType: USER_TYPE.STAFF,
  permissions,
})

describe('getFirstAccessibleNavigationRoute', () => {
  it('uses the root route until the authenticated user is available', () => {
    expect(getFirstAccessibleNavigationRoute(null)).toBe('/')
  })

  it('uses the dashboard when it is permitted', () => {
    expect(
      getFirstAccessibleNavigationRoute(
        user([
          {
            module: PERMISSION_MODULE.DASHBOARD,
            actions: [PERMISSION_ACTION.READ],
          },
        ])
      )
    ).toBe('/')
  })

  it('uses the first permitted route in sidebar order', () => {
    expect(
      getFirstAccessibleNavigationRoute(
        user([
          {
            module: PERMISSION_MODULE.LOTS,
            actions: [PERMISSION_ACTION.READ],
          },
          {
            module: PERMISSION_MODULE.CHAT,
            actions: [PERMISSION_ACTION.READ],
          },
        ])
      )
    ).toBe('/chats')
  })

  it('respects the action required by a navigation route', () => {
    expect(
      getFirstAccessibleNavigationRoute(
        user([
          {
            module: PERMISSION_MODULE.SEMI_POLISH,
            actions: [PERMISSION_ACTION.UPDATE],
          },
        ])
      )
    ).toBe('/semi-polish/packet-scanner')
  })

  it('uses the first always-accessible route when no business module is permitted', () => {
    expect(getFirstAccessibleNavigationRoute(user([]))).toBe('/settings')
  })
})
