import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

const ROUTES = ['/', '/write', '/read', '/flash', '/firmware', '/setup', '/help']

describe('App renders every route', () => {
  for (const route of ROUTES) {
    it(route, () => {
      const html = renderToString(
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>,
      )
      expect(html).toContain('sidebar')
      expect(html.length).toBeGreaterThan(500)
    })
  }
})
