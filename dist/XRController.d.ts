import { WebGLRenderer, Group, Object3D } from 'three'
import { XRInputSource } from './webxr'
export interface XRController {
  inputSource?: XRInputSource
  grip: Group
  controller: Group
  hovering: Set<Object3D>
  hoverRayLength?: number
}
export declare const XRController: {
  make: (id: number, gl: WebGLRenderer) => XRController
}
