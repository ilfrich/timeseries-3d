import React from "react"
import { Scene, PerspectiveCamera, WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from "three"
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { mixins } from "quick-n-dirty-react"

const DEFAULT_WIDTH = 900
const DEFAULT_HEIGHT = 700

const style = {
    searchTerm: {
        width: "150px",
    },
}

/*
 * Properties:
 * - model - the model to render
 * - width - the width of the rendering area - default 900
 * - height - the height of the rendering area - default 700
 * - layerGap - gap between layers (space) - default 10
 * - noFilter - whether filtering by id is prohibited - default false
 */

class Timeseries3D extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            searchTerm: "",
        }

        this.animate = this.animate.bind(this)
        this.createScene = this.createScene.bind(this)
        this.init = this.init.bind(this)
        this.createLayers = this.createLayers.bind(this)
        this.changeSearchTerm = this.changeSearchTerm.bind(this)
    }

    componentDidMount() {
        this.init()
        this.createScene()
        this.animate()
    }

    componentDidUpdate() {
        this.createScene() // redraw
    }

    changeSearchTerm(ev) {
        const searchTerm = ev.target.value
        if (searchTerm.length >= 2) {
            this.setState({ searchTerm })
        } else {
            this.setState({ searchTerm: "" })
        }
    }

    animate() {
        this.controls.update()
        requestAnimationFrame(this.animate)
        this.renderer.render(this.scene, this.camera)
        this.labelRenderer.render(this.scene, this.camera)
    }

    init() {
        // init
        const width = this.props.width || DEFAULT_WIDTH
        const height = this.props.height || DEFAULT_HEIGHT
        // create camera
        this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000)
        this.camera.position.set(400, 350, -120)
        // create renderer
        this.renderer = new WebGLRenderer({ antialias: true })
        this.renderer.setSize(width, height)

        this.labelRenderer = new CSS2DRenderer()
        this.labelRenderer.setSize(width, height)
        this.labelRenderer.domElement.style.position = "absolute"
        this.labelRenderer.domElement.style.top = 0

        // enable control
        this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement)
        this.controls.enabled = true
        this.controls.update()

        // mount
        this.mount.appendChild(this.renderer.domElement)
        this.mount.appendChild(this.labelRenderer.domElement)
    }

    createScene() {
        // reset scene
        this.scene = new Scene()

        // render
        this.renderer.render(this.scene, this.camera)
        this.labelRenderer.render(this.scene, this.camera)

        this.createLayers()
    }

    createLayers() {
        // find the limits of the scene
        let currentHeight = 0
        const limits = { minX: 9999, maxX: 0, minY: 9999, maxY: 0 }
        this.props.model.layers.forEach(layer => {
            currentHeight += layer.height
            layer.components.forEach(component => {
                // update limit
                limits.minX = Math.min(limits.minX, component.x)
                limits.maxX = Math.max(limits.maxX, component.x + component.size[0])
                limits.minY = Math.min(limits.minY, component.y)
                limits.maxY = Math.max(limits.maxY, component.y + component.size[1])
            })
        })
        // determine centre position of the scene
        const centre = {
            x: limits.maxX - (limits.maxX - limits.minX) / 2,
            y: currentHeight / 2,
            z: limits.maxY - (limits.maxY - limits.minY) / 2,
        }
        // reset height
        currentHeight = 0
        let currentHue = 0
        const hueStep = 360 / this.props.model.layers.length + 1
        // add the cubes
        this.props.model.layers.forEach(layer => {
            const { height } = layer
            layer.components.forEach(component => {
                const width = component.size[0]
                const depth = component.size[1]
                const geometry = new BoxGeometry(width, height, depth)
                let saturation = "100%"
                let wireframe = true
                let opacity = 0.2
                if (this.state.searchTerm !== "") {
                    // we are filtering by a search term
                    if (!component.id.toLowerCase().includes(this.state.searchTerm.toLowerCase())) {
                        // not matching search term
                        saturation = "20%"
                    } else {
                        // matching search term
                        wireframe = false
                        opacity = 0.8
                    }
                }
                const material = new MeshBasicMaterial({
                    color: `hsl(${currentHue}, ${saturation}, 70%)`,
                    wireframe,
                    opacity,
                    transparent: true,
                })
                const cube = new Mesh(geometry, material)
                // apply centre offset to each coordinate
                cube.position.set(
                    component.x - centre.x + width / 2,
                    currentHeight - centre.y + height / 2,
                    component.y - centre.z + depth / 2
                )
                this.scene.add(cube)
            })
            currentHue += hueStep
            currentHeight += height + (this.props.layerGap || 10)
        })
    }

    render() {
        return (
            <div>
                <div
                    style={mixins.relative}
                    ref={el => {
                        this.mount = el
                    }}
                ></div>
                <div style={mixins.vSpacer(15)} />
                {this.props.noFilter ? null : (
                    <div style={style.searchTerm}>
                        <input
                            type="text"
                            style={mixins.textInput}
                            placeholder="Search for component"
                            onChange={this.changeSearchTerm}
                        />
                    </div>
                )}
            </div>
        )
    }
}

export default Timeseries3D
