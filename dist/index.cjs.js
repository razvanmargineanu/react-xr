'use strict'

Object.defineProperty(exports, '__esModule', { value: true })

function _interopDefault(ex) {
  return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex
}

var _objectWithoutPropertiesLoose = _interopDefault(require('@babel/runtime/helpers/objectWithoutPropertiesLoose'))
var _extends = _interopDefault(require('@babel/runtime/helpers/extends'))
var React = require('react')
var React__default = _interopDefault(React)
var three = require('three')
var GLTFLoader = _interopDefault(require('three-gltf-loader'))
var motionControllers_module = require('three/examples/jsm/libs/motion-controllers.module')
var reactThreeFiber = require('react-three-fiber')
var VRButton = require('three/examples/jsm/webxr/VRButton')
var ARButton = require('three/examples/jsm/webxr/ARButton')

/**
 * @author Nell Waliczek / https://github.com/NellWaliczek
 * @author Brandon Jones / https://github.com/toji
 */
var DEFAULT_PROFILES_PATH = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles'
var DEFAULT_PROFILE = 'generic-trigger'

function XRControllerModel() {
  three.Object3D.call(this)
  this.motionController = null
  this.envMap = null
}

XRControllerModel.prototype = Object.assign(Object.create(three.Object3D.prototype), {
  constructor: XRControllerModel,
  setEnvironmentMap: function setEnvironmentMap(envMap) {
    var _this = this

    if (this.envMap == envMap) {
      return this
    }

    this.envMap = envMap
    this.traverse(function (child) {
      if (child.isMesh) {
        child.material.envMap = _this.envMap
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
    three.Object3D.prototype.updateMatrixWorld.call(this, force)
    if (!this.motionController) return // Cause the MotionController to poll the Gamepad for data

    this.motionController.updateFromGamepad() // Update the 3D model to reflect the button, thumbstick, and touchpad state

    Object.values(this.motionController.components).forEach(function (component) {
      // Update node data based on the visual responses' current states
      Object.values(component.visualResponses).forEach(function (visualResponse) {
        var valueNode = visualResponse.valueNode,
          minNode = visualResponse.minNode,
          maxNode = visualResponse.maxNode,
          value = visualResponse.value,
          valueNodeProperty = visualResponse.valueNodeProperty // Skip if the visual response node is not found. No error is needed,
        // because it will have been reported at load time.

        if (!valueNode) return // Calculate the new properties based on the weight supplied

        if (valueNodeProperty === motionControllers_module.Constants.VisualResponseProperty.VISIBILITY) {
          valueNode.visible = value
        } else if (valueNodeProperty === motionControllers_module.Constants.VisualResponseProperty.TRANSFORM) {
          three.Quaternion.slerp(minNode.quaternion, maxNode.quaternion, valueNode.quaternion, value)
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
  Object.values(motionController.components).forEach(function (component) {
    var type = component.type,
      touchPointNodeName = component.touchPointNodeName,
      visualResponses = component.visualResponses

    if (type === motionControllers_module.Constants.ComponentType.TOUCHPAD) {
      component.touchPointNode = scene.getObjectByName(touchPointNodeName)

      if (component.touchPointNode) {
        // Attach a touch dot to the touchpad.
        var sphereGeometry = new three.SphereGeometry(0.001)
        var material = new three.MeshBasicMaterial({
          color: 0x0000ff
        })
        var sphere = new three.Mesh(sphereGeometry, material)
        component.touchPointNode.add(sphere)
      } else {
        console.warn('Could not find touch dot, ' + component.touchPointNodeName + ', in touchpad component ' + component.id)
      }
    } // Loop through all the visual responses to be applied to this component

    Object.values(visualResponses).forEach(function (visualResponse) {
      var valueNodeName = visualResponse.valueNodeName,
        minNodeName = visualResponse.minNodeName,
        maxNodeName = visualResponse.maxNodeName,
        valueNodeProperty = visualResponse.valueNodeProperty // If animating a transform, find the two nodes to be interpolated between.

      if (valueNodeProperty === motionControllers_module.Constants.VisualResponseProperty.TRANSFORM) {
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
    scene.traverse(function (child) {
      if (child.isMesh) {
        child.material.envMap = controllerModel.envMap
        child.material.needsUpdate = true
      }
    })
  } // Add the glTF scene to the controllerModel.

  controllerModel.add(scene)
}

var XRControllerModelFactory = (function () {
  function XRControllerModelFactory(gltfLoader) {
    if (gltfLoader === void 0) {
      gltfLoader = null
    }

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
      var _this2 = this

      var controllerModel = new XRControllerModel()
      var scene = null
      controller.addEventListener('connected', function (event) {
        var xrInputSource = event.data
        if (xrInputSource.targetRayMode !== 'tracked-pointer' || !xrInputSource.gamepad) return
        motionControllers_module
          .fetchProfile(xrInputSource, _this2.path, DEFAULT_PROFILE)
          .then(function (_ref) {
            var profile = _ref.profile,
              assetPath = _ref.assetPath
            controllerModel.motionController = new motionControllers_module.MotionController(xrInputSource, profile, assetPath)
            var cachedAsset = _this2._assetCache[controllerModel.motionController.assetUrl]

            if (cachedAsset) {
              scene = cachedAsset.scene.clone()
              addAssetSceneToControllerModel(controllerModel, scene)
            } else {
              if (!_this2.gltfLoader) {
                throw new Error('GLTFLoader not set.')
              }

              _this2.gltfLoader.setPath('')

              _this2.gltfLoader.load(
                controllerModel.motionController.assetUrl,
                function (asset) {
                  _this2._assetCache[controllerModel.motionController.assetUrl] = asset
                  scene = asset.scene.clone()
                  addAssetSceneToControllerModel(controllerModel, scene)
                },
                null,
                function () {
                  throw new Error('Asset ' + controllerModel.motionController.assetUrl + ' missing or malformed.')
                }
              )
            }
          })
          ['catch'](function (err) {
            console.warn(err)
          })
      })
      controller.addEventListener('disconnected', function () {
        controllerModel.motionController = null
        controllerModel.remove(scene)
        scene = null
      })
      return controllerModel
    }
  }
  return XRControllerModelFactory
})()

var XRController = {
  make: function make(id, gl) {
    var controller = gl.xr.getController(id)
    var grip = gl.xr.getControllerGrip(id)
    var xrController = {
      inputSource: undefined,
      grip: grip,
      controller: controller,
      hovering: new Set(),
      selecting: new Set()
    }
    grip.userData.name = 'grip'
    controller.userData.name = 'controller'
    return xrController
  }
}

var XRContext = React.createContext({
  controllers: []
})
function XR(props) {
  var _useThree = reactThreeFiber.useThree(),
    gl = _useThree.gl

  var _React$useState = React.useState([]),
    controllers = _React$useState[0],
    setControllers = _React$useState[1]

  var state = React.useRef({
    interactable: new Set(),
    handlers: {
      onHover: new WeakMap(),
      onBlur: new WeakMap()
    }
  })
  var addInteraction = React.useCallback(function (object, eventType, handler) {
    state.current.interactable.add(object)
    state.current.handlers[eventType].set(object, handler)
  }, [])
  React.useEffect(
    function () {
      var initialControllers = [0, 1].map(function (id) {
        return XRController.make(id, gl)
      })
      setControllers(initialControllers) // Once they are connected update them with obtained inputSource

      var updateController = function updateController(index) {
        return function (event) {
          setControllers(function (existingControllers) {
            var copy = [].concat(existingControllers)
            copy[index] = _extends({}, copy[index], {
              inputSource: event.data
            })
            return copy
          })
        }
      }

      initialControllers.forEach(function (_ref, i) {
        var controller = _ref.controller
        controller.addEventListener('connected', updateController(i))
      })
    },
    [gl]
  )

  var _React$useState2 = React.useState(function () {
      return new three.Raycaster()
    }),
    raycaster = _React$useState2[0]

  reactThreeFiber.useFrame(function () {
    var intersect = function intersect(controller) {
      var objects = Array.from(state.current.interactable)
      var tempMatrix = new three.Matrix4()
      tempMatrix.identity().extractRotation(controller.matrixWorld)
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)
      return raycaster.intersectObjects(objects, true)
    }

    var handlers = state.current.handlers
    controllers.forEach(function (it) {
      var controller = it.controller,
        hovering = it.hovering
      var hits = new Set()
      var intersections = intersect(controller)
      it.hoverRayLength = undefined
      intersections.forEach(function (intersection) {
        var eventObject = intersection.object

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
                    intersection: intersection
                  })
            }
          }

          hits.add(eventObject.id)
          eventObject = eventObject.parent
        }
      })
      hovering.forEach(function (object) {
        if (!hits.has(object.id)) {
          hovering['delete'](object)

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
  return /*#__PURE__*/ React.createElement(
    XRContext.Provider,
    {
      value: {
        controllers: controllers,
        addInteraction: addInteraction
      }
    },
    props.children
  )
}

function XRCanvas(_ref2) {
  var children = _ref2.children,
    rest = _objectWithoutPropertiesLoose(_ref2, ['children'])

  return /*#__PURE__*/ React.createElement(
    reactThreeFiber.Canvas,
    _extends(
      {
        vr: true,
        colorManagement: true
      },
      rest
    ),
    /*#__PURE__*/ React.createElement(XR, null, children)
  )
}

function VRCanvas(_ref3) {
  var children = _ref3.children,
    rest = _objectWithoutPropertiesLoose(_ref3, ['children'])

  return /*#__PURE__*/ React.createElement(
    XRCanvas,
    _extends(
      {
        onCreated: function onCreated(_ref4) {
          var gl = _ref4.gl
          return void document.body.appendChild(VRButton.VRButton.createButton(gl))
        }
      },
      rest
    ),
    children
  )
}
function ARCanvas(_ref5) {
  var children = _ref5.children,
    rest = _objectWithoutPropertiesLoose(_ref5, ['children'])

  return /*#__PURE__*/ React.createElement(
    XRCanvas,
    _extends(
      {
        onCreated: function onCreated(_ref6) {
          var gl = _ref6.gl
          return void document.body.appendChild(ARButton.ARButton.createButton(gl))
        }
      },
      rest
    ),
    children
  )
}
var useXR = function useXR() {
  return React.useContext(XRContext)
}
var useXREvent = function useXREvent(event, handler, _temp) {
  var _ref7 = _temp === void 0 ? {} : _temp,
    handedness = _ref7.handedness

  var _useXR = useXR(),
    allControllers = _useXR.controllers

  var handleEvent = React.useCallback(
    function (controller) {
      return function (e) {
        return handler({
          originalEvent: e,
          controller: controller
        })
      }
    },
    [handler]
  )
  React.useEffect(
    function () {
      var controllers = handedness
        ? allControllers.filter(function (it) {
            var _it$inputSource

            return ((_it$inputSource = it.inputSource) == null ? void 0 : _it$inputSource.handedness) === handedness
          })
        : allControllers
      var cleanups = []
      controllers.forEach(function (it) {
        var listener = handleEvent(it)
        it.controller.addEventListener(event, listener)
        cleanups.push(function () {
          return it.controller.removeEventListener(event, listener)
        })
      })
      return function () {
        return cleanups.forEach(function (fn) {
          return fn()
        })
      }
    },
    [event, handleEvent, allControllers, handedness]
  )
}
function DefaultXRControllers() {
  var _useXR2 = useXR(),
    controllers = _useXR2.controllers

  var modelFactory = React.useMemo(function () {
    return new XRControllerModelFactory()
  }, [])

  var _React$useState3 = React.useState(new Map()),
    modelMap = _React$useState3[0]

  var _React$useState4 = React.useState(new Map()),
    rays = _React$useState4[0]

  reactThreeFiber.useFrame(function () {
    controllers.forEach(function (it) {
      var _it$inputSource2

      var ray = rays.get(it.controller.id)

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
  useXREvent('selectstart', function (e) {
    var ray = rays.get(e.controller.controller.id)
    if (!ray) return
    ray.material.color = new three.Color(0x192975)
  })
  useXREvent('selectend', function (e) {
    var ray = rays.get(e.controller.controller.id)
    if (!ray) return
    ray.material.color = new three.Color(0xffffff)
  })
  var models = React.useMemo(
    function () {
      return controllers.map(function (_ref8) {
        var _modelMap$get

        var controller = _ref8.controller,
          grip = _ref8.grip
        // Model factory listens for 'connect' event so we can only create models on inital render
        var model = (_modelMap$get = modelMap.get(controller)) != null ? _modelMap$get : modelFactory.createControllerModel(controller)

        if (modelMap.get(controller) === undefined) {
          modelMap.set(controller, model)
        }

        return /*#__PURE__*/ React.createElement(
          React.Fragment,
          {
            key: controller.id
          },
          /*#__PURE__*/ React.createElement(
            'primitive',
            {
              object: controller
            },
            /*#__PURE__*/ React.createElement(
              'mesh',
              {
                rotation: [Math.PI / 2, 0, 0],
                ref: function ref(_ref9) {
                  return rays.set(controller.id, _ref9)
                }
              },
              /*#__PURE__*/ React.createElement('meshBasicMaterial', {
                attach: 'material',
                color: '#FFF',
                opacity: 0.8,
                transparent: true
              }),
              /*#__PURE__*/ React.createElement('boxBufferGeometry', {
                attach: 'geometry',
                args: [0.002, 1, 0.002]
              })
            )
          ),
          /*#__PURE__*/ React.createElement(
            'primitive',
            {
              object: grip,
              dispose: null,
              key: grip.id
            },
            /*#__PURE__*/ React.createElement('primitive', {
              object: model
            })
          )
        )
      })
    },
    [controllers, modelFactory, modelMap, rays]
  )
  return /*#__PURE__*/ React.createElement('group', null, models)
}

function Hover(_ref) {
  var onChange = _ref.onChange,
    children = _ref.children
  var ref = React.useRef()

  var _useXR = useXR(),
    addInteraction = _useXR.addInteraction

  var hovering = React.useRef(new Set())
  React.useEffect(
    function () {
      addInteraction(ref.current, 'onHover', function (e) {
        var _e$controller$inputSo

        if (hovering.current.size === 0) {
          onChange(true)
        }

        hovering.current.add((_e$controller$inputSo = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo.handedness)
      })
      addInteraction(ref.current, 'onBlur', function (e) {
        var _e$controller$inputSo2

        hovering.current['delete']((_e$controller$inputSo2 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo2.handedness)

        if (hovering.current.size === 0) {
          onChange(false)
        }
      })
    },
    [onChange, addInteraction]
  )
  return /*#__PURE__*/ React__default.createElement(
    'group',
    {
      ref: ref
    },
    children
  )
}
function Select(_ref2) {
  var onSelect = _ref2.onSelect,
    children = _ref2.children
  var ref = React.useRef()

  var _useXR2 = useXR(),
    addInteraction = _useXR2.addInteraction

  var hoveredHandedness = React.useRef(new Set())
  var onEnd = React.useCallback(
    function (e) {
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
  React.useEffect(
    function () {
      addInteraction(ref.current, 'onHover', function (e) {
        var _e$controller$inputSo4

        hoveredHandedness.current.add(
          (_e$controller$inputSo4 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo4.handedness
        )
      })
      addInteraction(ref.current, 'onBlur', function (e) {
        var _e$controller$inputSo5

        hoveredHandedness.current['delete'](
          (_e$controller$inputSo5 = e.controller.inputSource) == null ? void 0 : _e$controller$inputSo5.handedness
        )
      })
    },
    [addInteraction]
  )
  return /*#__PURE__*/ React__default.createElement(
    'group',
    {
      ref: ref
    },
    children
  )
}

exports.ARCanvas = ARCanvas
exports.DefaultXRControllers = DefaultXRControllers
exports.Hover = Hover
exports.Select = Select
exports.VRCanvas = VRCanvas
exports.XR = XR
exports.XRController = XRController
exports.useXR = useXR
exports.useXREvent = useXREvent
