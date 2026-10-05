import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from './App.vue'

describe('App', () => {
  it('shows the app name when no game is open', () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Lost Atlas Tracker')
  })
})
