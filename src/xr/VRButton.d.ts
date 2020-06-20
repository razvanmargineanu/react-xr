import { WebGLRenderer } from 'three'

export interface WebXROptions {
  referenceSpaceType: string
}

export namespace VRButton {
  export function createButton(renderer: WebGLRenderer, options?: WebXROptions): HTMLElement
}
