export declare type XRHandedness = 'none' | 'left' | 'right'
export declare type XRTargetRayMode = 'gaze' | 'tracked-pointer' | 'screen'
export declare type XRSpace = EventTarget
export interface XRInputSource {
  readonly handedness: XRHandedness
  readonly targetRayMode: XRTargetRayMode
  readonly gamepad?: Gamepad
  readonly targetRaySpace: XRSpace
  readonly gripSpace?: XRSpace
  readonly profiles: string
}
