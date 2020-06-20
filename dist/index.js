import _objectWithoutPropertiesLoose from '@babel/runtime/helpers/esm/objectWithoutPropertiesLoose'
import _extends from '@babel/runtime/helpers/esm/extends'
import React__default, {
  createContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  createElement,
  useContext,
  useMemo,
  Fragment
} from 'react'
import { Raycaster, Color, Matrix4 } from 'three'
import { useThree, useFrame, Canvas } from 'react-three-fiber'
import { VRButton } from 'three/examples/jsm/webxr/VRButton'
import { ARButton } from 'three/examples/jsm/webxr/ARButton'

const XRController = {
  make: (id, gl) => {
    const controller = gl.xr.getController(id)
    const grip = gl.xr.getControllerGrip(id)
    const xrController = {
      inputSource: undefined,
      grip,
      controller,
      hovering: new Set(),
      selecting: new Set()
    }
    grip.userData.name = 'grip'
    controller.userData.name = 'controller'
    return xrController
  }
}

const XRContext = createContext({
  controllers: []
})
function XR(props) {
  const { gl } = useThree()
  const [controllers, setControllers] = useState([])
  const state = useRef({
    interactable: new Set(),
    handlers: {
      onHover: new WeakMap(),
      onBlur: new WeakMap()
    }
  })
  const addInteraction = useCallback((object, eventType, handler) => {
    state.current.interactable.add(object)
    state.current.handlers[eventType].set(object, handler)
  }, [])
  useEffect(() => {
    const initialControllers = [0, 1].map((id) => XRController.make(id, gl))
    setControllers(initialControllers) // Once they are connected update them with obtained inputSource

    const updateController = (index) => (event) => {
      setControllers((existingControllers) => {
        const copy = [...existingControllers]
        copy[index] = _extends({}, copy[index], {
          inputSource: event.data
        })
        return copy
      })
    }

    initialControllers.forEach(({ controller }, i) => {
      controller.addEventListener('connected', updateController(i))
    })
  }, [gl])
  const [raycaster] = useState(() => new Raycaster())
  useFrame(() => {
    const intersect = (controller) => {
      const objects = Array.from(state.current.interactable)
      const tempMatrix = new Matrix4()
      tempMatrix.identity().extractRotation(controller.matrixWorld)
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)
      return raycaster.intersectObjects(objects, true)
    }

    const { handlers } = state.current
    controllers.forEach((it) => {
      const { controller, hovering } = it
      const hits = new Set()
      const intersections = intersect(controller)
      it.hoverRayLength = undefined
      intersections.forEach((intersection) => {
        let eventObject = intersection.object

        while (eventObject) {
          if (handlers.onHover.has(eventObject)) {
            var _it$hoverRayLength

            it.hoverRayLength = Math.min(
              (_it$hoverRayLength = it.hoverRayLength) != null ? _it$hoverRayLength : Infinity,
              intersection.distance
            )

            if (!hovering.has(eventObject) && handlers.onHover.has(eventObject)) {
              var _handlers$onHover$get

              hovering.add(eventObject)
              ;(_handlers$onHover$get = handlers.onHover.get(eventObject)) == null
                ? void 0
                : _handlers$onHover$get({
                    controller: it,
                    intersection
                  })
            }
          }

          hits.add(eventObject.id)
          eventObject = eventObject.parent
        }
      })
      hovering.forEach((object) => {
        if (!hits.has(object.id)) {
          hovering.delete(object)

          if (handlers.onBlur.has(object)) {
            var _handlers$onBlur$get

            ;(_handlers$onBlur$get = handlers.onBlur.get(object)) == null
              ? void 0
              : _handlers$onBlur$get({
                  controller: it
                })
          }
        }
      })
    })
  })
  return /*#__PURE__*/ createElement(
    XRContext.Provider,
    {
      value: {
        controllers,
        addInteraction
      }
    },
    props.children
  )
}

function XRCanvas(_ref) {
  let { children } = _ref,
    rest = _objectWithoutPropertiesLoose(_ref, ['children'])

  return /*#__PURE__*/ createElement(
    Canvas,
    _extends(
      {
        vr: true,
        colorManagement: true
      },
      rest
    ),
    /*#__PURE__*/ createElement(XR, null, children)
  )
}

function VRCanvas(_ref2) {
  let { children } = _ref2,
    rest = _objectWithoutPropertiesLoose(_ref2, ['children'])

  return /*#__PURE__*/ createElement(
    XRCanvas,
    _extends(
      {
        onCreated: ({ gl }) => void document.body.appendChild(VRButton.createButton(gl))
      },
      rest
    ),
    children
  )
}
function ARCanvas(_ref3) {
  let { children } = _ref3,
    rest = _objectWithoutPropertiesLoose(_ref3, ['children'])

  return /*#__PURE__*/ createElement(
    XRCanvas,
    _extends(
      {
        onCreated: ({ gl }) => void document.body.appendChild(ARButton.createButton(gl))
      },
      rest
    ),
    children
  )
}
const useXR = () => useContext(XRContext)
const useXREvent = (event, handler, { handedness } = {}) => {
  const { controllers: allControllers } = useXR()
  const handleEvent = useCallback(
    (controller) => (e) =>
      handler({
        originalEvent: e,
        controller
      }),
    [handler]
  )
  useEffect(() => {
    const controllers = handedness
      ? allControllers.filter((it) => {
          var _it$inputSource

          return ((_it$inputSource = it.inputSource) == null ? void 0 : _it$inputSource.handedness) === handedness
        })
      : allControllers
    const cleanups = []
    controllers.forEach((it) => {
      const listener = handleEvent(it)
      it.controller.addEventListener(event, listener)
      cleanups.push(() => it.controller.removeEventListener(event, listener))
    })
    return () => cleanups.forEach((fn) => fn())
  }, [event, handleEvent, allControllers, handedness])
}
function DefaultXRControllers() {
  const { controllers } = useXR() // const modelFactory = React.useMemo(() => new XRControllerModelFactory(), [])

  const modelFactory = useMemo(() => {}, [])
  const [modelMap] = useState(new Map())
  const [rays] = useState(new Map())
  useFrame(() => {
    controllers.forEach((it) => {
      var _it$inputSource2

      const ray = rays.get(it.controller.id)

      if (!ray) {
        return
      }

      if (
        it.hoverRayLength === undefined ||
        ((_it$inputSource2 = it.inputSource) == null ? void 0 : _it$inputSource2.handedness) === 'none'
      ) {
        ray.visible = false
        return
      }

      ray.visible = true
      ray.scale.y = it.hoverRayLength
      ray.position.z = -it.hoverRayLength / 2
    })
  })
  useXREvent('selectstart', (e) => {
    const ray = rays.get(e.controller.controller.id)
    if (!ray) return
    ray.material.color = new Color(0x192975)
  })
  useXREvent('selectend', (e) => {
    const ray = rays.get(e.controller.controller.id)
    if (!ray) return
    ray.material.color = new Color(0xffffff)
  })
  const models = useMemo(
    () =>
      controllers.map(({ controller, grip }) => {
        // Model factory listens for 'connect' event so we can only create models on inital render
        // const model = modelMap.get(controller) ?? modelFactory.createControllerModel(controller)
        // if (modelMap.get(controller) === undefined) {
        //   modelMap.set(controller, model)
        // }
        return /*#__PURE__*/ createElement(
          Fragment,
          {
            key: controller.id
          },
          /*#__PURE__*/ createElement(
            'primitive',
            {
              object: controller
            },
            /*#__PURE__*/ createElement(
              'mesh',
              {
                rotation: [Math.PI / 2, 0, 0],
                ref: (_ref4) => rays.set(controller.id, _ref4)
              },
              /*#__PURE__*/ createElement('meshBasicMaterial', {
                attach: 'material',
                color: '#FFF',
                opacity: 0.8,
                transparent: true
              }),
              /*#__PURE__*/ createElement('boxBufferGeometry', {
                attach: 'geometry',
                args: [0.002, 1, 0.002]
              })
            )
          ),
          /*#__PURE__*/ createElement('primitive', {
            object: grip,
            dispose: null,
            key: grip.id
          })
        )
      }),
    [controllers, modelFactory, modelMap, rays]
  )
  return /*#__PURE__*/ createElement('group', null, models)
}

function Hover({ onChange, children }) {
  const ref = useRef()
  const { addInteraction } = useXR()
  const hovering = useRef(new Set())
  useEffect(() => {
    addInteraction(ref.current, 'onHover', (e) => {
      var _e$controller$inputSo

      if (hovering.current.size === 0) {
        onChange(true)
      }

      hovering.current.add((_e$controller$inputSo = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo.handedness)
    })
    addInteraction(ref.current, 'onBlur', (e) => {
      var _e$controller$inputSo2

      hovering.current.delete((_e$controller$inputSo2 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo2.handedness)

      if (hovering.current.size === 0) {
        onChange(false)
      }
    })
  }, [onChange, addInteraction])
  return /*#__PURE__*/ React__default.createElement(
    'group',
    {
      ref: ref
    },
    children
  )
}
function Select({ onSelect, children }) {
  const ref = useRef()
  const { addInteraction } = useXR()
  const hoveredHandedness = useRef(new Set())
  const onEnd = useCallback(
    (e) => {
      var _e$controller$inputSo3

      if (
        hoveredHandedness.current.has(
          (_e$controller$inputSo3 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo3.handedness
        )
      ) {
        onSelect()
      }
    },
    [onSelect]
  )
  useXREvent('selectend', onEnd)
  useEffect(() => {
    addInteraction(ref.current, 'onHover', (e) => {
      var _e$controller$inputSo4

      hoveredHandedness.current.add(
        (_e$controller$inputSo4 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo4.handedness
      )
    })
    addInteraction(ref.current, 'onBlur', (e) => {
      var _e$controller$inputSo5

      hoveredHandedness.current.delete(
        (_e$controller$inputSo5 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo5.handedness
      )
    })
  }, [addInteraction])
  return /*#__PURE__*/ React__default.createElement(
    'group',
    {
      ref: ref
    },
    children
  )
}

export { ARCanvas, DefaultXRControllers, Hover, Select, VRCanvas, XR, XRController, useXR, useXREvent }
