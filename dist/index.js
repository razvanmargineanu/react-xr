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
import { Object3D, Quaternion, SphereGeometry, MeshBasicMaterial, Mesh, Raycaster, Color, Matrix4 } from 'three'
import GLTFLoader from 'three-gltf-loader'
import { Constants, fetchProfile, MotionController } from 'three/examples/jsm/libs/motion-controllers.module'
import { useThree, useFrame, Canvas } from 'react-three-fiber'
import { VRButton } from 'three/examples/jsm/webxr/VRButton'
import { ARButton } from 'three/examples/jsm/webxr/ARButton'

/**
 * @author Nell Waliczek / https://github.com/NellWaliczek
 * @author Brandon Jones / https://github.com/toji
 */
const DEFAULT_PROFILES_PATH = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles'
const DEFAULT_PROFILE = 'generic-trigger'

function XRControllerModel() {
  Object3D.call(this)
  this.motionController = null
  this.envMap = null
}

XRControllerModel.prototype = Object.assign(Object.create(Object3D.prototype), {
  constructor: XRControllerModel,
  setEnvironmentMap: function setEnvironmentMap(envMap) {
    if (this.envMap == envMap) {
      return this
    }

    this.envMap = envMap
    this.traverse((child) => {
      if (child.isMesh) {
        child.material.envMap = this.envMap
        child.material.needsUpdate = true
      }
    })
    return this
  },

  /**
   * Polls data from the XRInputSource and updates the model's components to match
   * the real world data
   */
  updateMatrixWorld: function updateMatrixWorld(force) {
    Object3D.prototype.updateMatrixWorld.call(this, force)
    if (!this.motionController) return // Cause the MotionController to poll the Gamepad for data

    this.motionController.updateFromGamepad() // Update the 3D model to reflect the button, thumbstick, and touchpad state

    Object.values(this.motionController.components).forEach((component) => {
      // Update node data based on the visual responses' current states
      Object.values(component.visualResponses).forEach((visualResponse) => {
        const { valueNode, minNode, maxNode, value, valueNodeProperty } = visualResponse // Skip if the visual response node is not found. No error is needed,
        // because it will have been reported at load time.

        if (!valueNode) return // Calculate the new properties based on the weight supplied

        if (valueNodeProperty === Constants.VisualResponseProperty.VISIBILITY) {
          valueNode.visible = value
        } else if (valueNodeProperty === Constants.VisualResponseProperty.TRANSFORM) {
          Quaternion.slerp(minNode.quaternion, maxNode.quaternion, valueNode.quaternion, value)
          valueNode.position.lerpVectors(minNode.position, maxNode.position, value)
        }
      })
    })
  }
})
/**
 * Walks the model's tree to find the nodes needed to animate the components and
 * saves them to the motionContoller components for use in the frame loop. When
 * touchpads are found, attaches a touch dot to them.
 */

function findNodes(motionController, scene) {
  // Loop through the components and find the nodes needed for each components' visual responses
  Object.values(motionController.components).forEach((component) => {
    const { type, touchPointNodeName, visualResponses } = component

    if (type === Constants.ComponentType.TOUCHPAD) {
      component.touchPointNode = scene.getObjectByName(touchPointNodeName)

      if (component.touchPointNode) {
        // Attach a touch dot to the touchpad.
        const sphereGeometry = new SphereGeometry(0.001)
        const material = new MeshBasicMaterial({
          color: 0x0000ff
        })
        const sphere = new Mesh(sphereGeometry, material)
        component.touchPointNode.add(sphere)
      } else {
        console.warn('Could not find touch dot, ' + component.touchPointNodeName + ', in touchpad component ' + component.id)
      }
    } // Loop through all the visual responses to be applied to this component

    Object.values(visualResponses).forEach((visualResponse) => {
      const { valueNodeName, minNodeName, maxNodeName, valueNodeProperty } = visualResponse // If animating a transform, find the two nodes to be interpolated between.

      if (valueNodeProperty === Constants.VisualResponseProperty.TRANSFORM) {
        visualResponse.minNode = scene.getObjectByName(minNodeName)
        visualResponse.maxNode = scene.getObjectByName(maxNodeName) // If the extents cannot be found, skip this animation

        if (!visualResponse.minNode) {
          console.warn('Could not find ' + minNodeName + ' in the model')
          return
        }

        if (!visualResponse.maxNode) {
          console.warn('Could not find ' + maxNodeName + ' in the model')
          return
        }
      } // If the target node cannot be found, skip this animation

      visualResponse.valueNode = scene.getObjectByName(valueNodeName)

      if (!visualResponse.valueNode) {
        console.warn('Could not find ' + valueNodeName + ' in the model')
      }
    })
  })
}

function addAssetSceneToControllerModel(controllerModel, scene) {
  // Find the nodes needed for animation and cache them on the motionController.
  findNodes(controllerModel.motionController, scene) // Apply any environment map that the mesh already has set.

  if (controllerModel.envMap) {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.material.envMap = controllerModel.envMap
        child.material.needsUpdate = true
      }
    })
  } // Add the glTF scene to the controllerModel.

  controllerModel.add(scene)
}

var XRControllerModelFactory = (function () {
  function XRControllerModelFactory(gltfLoader = null) {
    this.gltfLoader = gltfLoader
    this.path = DEFAULT_PROFILES_PATH
    this._assetCache = {} // If a GLTFLoader wasn't supplied to the constructor create a new one.

    if (!this.gltfLoader) {
      this.gltfLoader = new GLTFLoader()
    }
  }

  XRControllerModelFactory.prototype = {
    constructor: XRControllerModelFactory,
    createControllerModel: function createControllerModel(controller) {
      const controllerModel = new XRControllerModel()
      let scene = null
      controller.addEventListener('connected', (event) => {
        const xrInputSource = event.data
        if (xrInputSource.targetRayMode !== 'tracked-pointer' || !xrInputSource.gamepad) return
        fetchProfile(xrInputSource, this.path, DEFAULT_PROFILE)
          .then(({ profile, assetPath }) => {
            controllerModel.motionController = new MotionController(xrInputSource, profile, assetPath)
            let cachedAsset = this._assetCache[controllerModel.motionController.assetUrl]

            if (cachedAsset) {
              scene = cachedAsset.scene.clone()
              addAssetSceneToControllerModel(controllerModel, scene)
            } else {
              if (!this.gltfLoader) {
                throw new Error('GLTFLoader not set.')
              }

              this.gltfLoader.setPath('')
              this.gltfLoader.load(
                controllerModel.motionController.assetUrl,
                (asset) => {
                  this._assetCache[controllerModel.motionController.assetUrl] = asset
                  scene = asset.scene.clone()
                  addAssetSceneToControllerModel(controllerModel, scene)
                },
                null,
                () => {
                  throw new Error('Asset ' + controllerModel.motionController.assetUrl + ' missing or malformed.')
                }
              )
            }
          })
          .catch((err) => {
            console.warn(err)
          })
      })
      controller.addEventListener('disconnected', () => {
        controllerModel.motionController = null
        controllerModel.remove(scene)
        scene = null
      })
      return controllerModel
    }
  }
  return XRControllerModelFactory
})()

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
  const { controllers } = useXR()
  const modelFactory = useMemo(() => new XRControllerModelFactory(), [])
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
        var _modelMap$get

        // Model factory listens for 'connect' event so we can only create models on inital render
        const model = (_modelMap$get = modelMap.get(controller)) != null ? _modelMap$get : modelFactory.createControllerModel(controller)

        if (modelMap.get(controller) === undefined) {
          modelMap.set(controller, model)
        }

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
          /*#__PURE__*/ createElement(
            'primitive',
            {
              object: grip,
              dispose: null,
              key: grip.id
            },
            /*#__PURE__*/ createElement('primitive', {
              object: model
            })
          )
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
