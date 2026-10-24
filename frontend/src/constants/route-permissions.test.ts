import { describe, expect, it } from 'vitest'
import { PERMISSION_ACTION, PERMISSION_MODULE } from './permissions'
import { getAuthenticatedRoutePermission } from './route-permissions'

describe('authenticated route permissions', () => {
  it.each([
    ['/', PERMISSION_MODULE.DASHBOARD, PERMISSION_ACTION.READ],
    ['/lots', PERMISSION_MODULE.LOTS, PERMISSION_ACTION.READ],
    ['/packets/lot-1', PERMISSION_MODULE.ASSORTMENT, PERMISSION_ACTION.READ],
    [
      '/semi-polish/packet-scanner',
      PERMISSION_MODULE.SEMI_POLISH,
      PERMISSION_ACTION.UPDATE,
    ],
    [
      '/semi-polish/planning-returns/process-1',
      PERMISSION_MODULE.SEMI_POLISH,
      PERMISSION_ACTION.UPDATE,
    ],
    [
      '/semi-polish/ready-for-issue',
      PERMISSION_MODULE.SEMI_POLISH,
      PERMISSION_ACTION.CREATE,
    ],
    [
      '/semi-polish/history',
      PERMISSION_MODULE.SEMI_POLISH,
      PERMISSION_ACTION.READ,
    ],
    ['/permissions', PERMISSION_MODULE.PERMISSIONS, PERMISSION_ACTION.READ],
    ['/chats', PERMISSION_MODULE.CHAT, PERMISSION_ACTION.READ],
  ])('maps %s to %s:%s', (path, module, action) => {
    expect(getAuthenticatedRoutePermission(path)).toEqual({ module, action })
  })

  it('leaves authenticated utility pages without a module restriction', () => {
    expect(getAuthenticatedRoutePermission('/help-center')).toBeNull()
  })
})
