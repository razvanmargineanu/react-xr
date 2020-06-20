import * as React from 'react'
import { Object3D, Intersection } from 'three'
import { XRHandedness } from './webxr'
import { XRController } from './XRController'
import { ContainerProps } from 'react-three-fiber/targets/shared/web/ResizeContainer'
export interface XRInteractionEvent {
  intersection?: Intersection
  controller: XRController
}
export declare type XRInteractionType = 'onHover' | 'onBlur'
export declare type XRInteractionHandler = (event: XRInteractionEvent) => any
export declare function XR(props: { children: React.ReactNode }): JSX.Element
export declare function VRCanvas({ children, ...rest }: ContainerProps): JSX.Element
export declare function ARCanvas({ children, ...rest }: ContainerProps): JSX.Element
export declare const useXR: () => {
  controllers: XRController[]
  addInteraction: (object: Object3D, eventType: XRInteractionType, handler: XRInteractionHandler) => any
}
export interface XREvent {
  originalEvent: any
  controller: XRController
}
export declare type XREventType = 'select' | 'selectstart' | 'selectend' | 'squeeze' | 'squeezestart' | 'squeezeend'
export declare const useXREvent: (
  event: XREventType,
  handler: (e: XREvent) => any,
  {
    handedness
  }?: {
    handedness?: 'none' | 'left' | 'right' | undefined
  }
) => void
export declare function DefaultXRControllers(): JSX.Element
