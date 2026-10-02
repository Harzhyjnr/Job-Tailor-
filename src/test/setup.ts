import '@testing-library/jest-dom/vitest'

// jsdom does not implement scrolling; the app calls scrollTo on navigation.
window.scrollTo = () => {}

// jsdom does not implement these APIs; components that rely on them are stubbed here.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// pdf.js v6 calls Uint8Array.prototype.toHex when fingerprinting a document.
// Every browser the app supports has it; Node does not, so shim it here to let
// the real extraction pipeline run under test.
const uint8Prototype = Uint8Array.prototype as Uint8Array & { toHex?: () => string }
if (typeof uint8Prototype.toHex !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    configurable: true,
    writable: true,
    value(this: Uint8Array) {
      return Array.from(this, (byte) => byte.toString(16).padStart(2, '0')).join('')
    },
  })
}
