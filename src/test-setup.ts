import { defineComponent, h } from 'vue'
import { config } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

// Every mounted component gets the same plugins as the real app, without a theme.
config.global.plugins = [[PrimeVue, { theme: 'none' }], ToastService, ConfirmationService]

// PrimeVue Dialog teleports to <body> and animates. In tests it renders inline,
// so a wrapper can find the dialog's header, content and footer.
const DialogStub = defineComponent({
  name: 'Dialog',
  props: { visible: Boolean, header: String },
  emits: ['update:visible'],
  setup(props, { slots }) {
    return () =>
      props.visible
        ? h('div', { role: 'dialog' }, [h('h2', props.header), slots.header?.(), slots.default?.(), slots.footer?.()])
        : null
  },
})
config.global.stubs = { Dialog: DialogStub }

// jsdom has no matchMedia. PrimeVue overlays ask for it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
