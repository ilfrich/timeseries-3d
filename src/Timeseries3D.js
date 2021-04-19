import React from "react"
import { Scene, PerspectiveCamera, WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from "three"
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { mixins } from "quick-n-dirty-react"
import util from "quick-n-dirty-utils"
import moment from "moment"

const DEFAULT_WIDTH = 900
const DEFAULT_HEIGHT = 700

const HSL_PARAMS = {
    max: 360,
    range: [180, 0],
    intervals: 180,
}
const TIMESTAMP_MULTIPLIERS = {
    s: 1000,
    ms: 0,
    ns: 1 / 1000,
}

const style = {
    filterContainer: {
        display: "grid",
        gridTemplateColumns: "150px 100px 1fr",
        gridColumnGap: "10px",
    },
    showLayer: included => ({
        color: included ? "#000" : "#ccc",
    }),
    transparency: {
        width: "100px",
    },
    colorIndex: {
        position: "absolute",
        top: "0px",
        left: "0px",
        padding: "4px",
        zIndex: "1",
    },
    colorScale: scale => ({
        backgroundImage: `linear-gradient(to right, ${scale.map(val => "rgb(" + val.join(",") + ")").join(",")})`,
        width: "250px",
        height: "14px",
        padding: "5px 4px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
    }),
    colorScaleLabel: {
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontSize: "12px",
    },
    playerControls: width => ({
        position: "absolute",
        width: `calc(${width}px - 20px)`,
        background: "#f3f3f3",
        padding: "10px",
        bottom: "0px",
        left: "0px",
        zIndex: "1",
    }),
    playPauseIcon: small => ({
        ...mixins.clickable,
        ...mixins.center,
        display: "inline-block",
        border: "1px solid #aaa",
        padding: small ? "7px 2px 7px 6px" : "3px 4px 2px 4px",
        width: "20px",
        marginTop: "-2px",
        marginRight: "8px",
        fontSize: small ? "12px" : "20px",
    }),
    scrollBar: {
        Width: "200px",
    },
    frameNumber: {
        minWidth: "90px",
        paddingTop: "8px",
        paddingLeft: "5px",
        paddingRight: "5px",
    },
}

const getMinMaxValue = props => {
    let minValue = props.minValue
    let maxValue = props.maxValue
    if ((minValue != null && maxValue != null) || props.data == null) {
        // min/max value provided or no data provided
        return { minValue, maxValue }
    }

    if (props.data.values != null) {
        // time series provided
        Object.values(props.data.values).forEach(series => {
            // respect properties
            if (props.minValue == null) {
                if (minValue == null) {
                    minValue = Math.min(...series)
                } else {
                    minValue = Math.min(minValue, ...series)
                }
            }
            if (props.maxValue == null) {
                if (maxValue == null) {
                    maxValue = Math.max(...series)
                } else {
                    maxValue = Math.max(maxValue, ...series)
                }
            }
        })
    } else {
        // single data point per component provided
        const values = Object.values(props.data)
        if (minValue == null) {
            minValue = Math.min(...values)
        }
        if (maxValue == null) {
            maxValue = Math.max(...values)
        }
    }
    
    return { minValue, maxValue }
}

/*
 * Properties:
 * - model - the model to render
 * - width - the width of the rendering area - default 900
 * - height - the height of the rendering area - default 700
 * - layerGap - gap between layers (space) - default 10
 * - noFilters - whether filtering by id/layer and adjusting transparency is prohibited - default false
 * - data - a JSON object containing either a timeseries or single data point - default null
 * - inverse - a boolean flag indicating whether the min/max are inverse
 * - colors - a 3-dimensional array providing RGB components for 3 RGB colors to use for rendering - default red->white->blue
 * - minValue - caps the lowest value to this, if not provided the component will calculate the min value automatically from the provided data - default null
 * - maxValue - caps the highest value to this, if not provided the component will calculate the min value automatically from the provided data - default null
 * - transparency - the initial transparency [0.0, 1.0] of the component, updating this property will not change the rendering - default 0.4
 * - autoplay - in case a timeseries is provided, whether to automatically start playing once the component is rendered - default false
 * - playbackSpeed - the number of milliseconds between each frame - default 500
 * - dateFormat - the momentjs date format for the player - default "LLL"
 * - timestampFormat - the format in which the timestamps are provided, supported are "s", "ms" and "ns" - default "s"
 */

class Timeseries3D extends React.Component {
    constructor(props) {
        super(props)
        this.timer = null

        let { minValue, maxValue } = getMinMaxValue(props)
        
        this.state = {
            searchTerm: "",
            visibleLayers: util.range(0, props.model.layers.length - 1),
            currentFrame: props.data != null && props.data.timestamps != null ? 0 : null,
            minValue,
            maxValue,
            transparency: props.transparency != null ? Math.min(Math.max(0.0, props.transparency), 0.95) : 0.4,
            playing: props.autoplay === true,
        }

        // general animation functions
        this.animate = this.animate.bind(this)
        this.createScene = this.createScene.bind(this)
        this.init = this.init.bind(this)
        this.createLayers = this.createLayers.bind(this)

        // layer visibility functions        
        this.changeSearchTerm = this.changeSearchTerm.bind(this)
        this.changeLayerVisible = this.changeLayerVisible.bind(this)
        this.changeTransparency = this.changeTransparency.bind(this)

        // data related functions
        this.getCustomColor = this.getCustomColor.bind(this)

        // playback related functions
        this.play = this.play.bind(this)
        this.pause = this.pause.bind(this)
        this.selectFrame = this.selectFrame.bind(this)
    }

    componentDidMount() {
        this.init()
        this.createScene()
        this.animate()
        if (this.props.autoplay === true) {
            this.play()
        }
    }

    componentDidUpdate() {
        this.createScene() // redraw
    }

    componentWillUnmount() {
        this.pause()
    }

    getCustomColor(componentId) {
        if (this.props.data == null) {
            // no data passed in, just render the model
            return null
        }

        // fetch value for this component
        let value = null
        if (this.props.data.values == null) {
            // single data point, will return null, if component doesn't provide data
            value = this.props.data[componentId]
        } else {
            // time series provided
            if (this.state.currentFrame == null) {
                // player hasn't been initialised
                return null  
            }
            const series = this.props.data.values[componentId]
            if (series == null) {
                // no time series value provided for this component
                return null
            }                
            value = series[this.state.currentFrame]
        }

        if (value == null) {
            return null
        }
        
        let percent = util.normalise(value, this.state.minValue, this.state.maxValue)
        if (this.props.inverse === true) {
            percent = 1.0 - percent
        }
        
        return util.getTricolor(percent, this.props.colors) // if colors is null, will use red->white->blue
    }

    play() {
        if (this.timer == null) {
            const playbackSpeed = this.props.playbackSpeed || 500
            this.setState({
                playing: true
            }, () => {
                this.timer = setInterval(() => {
                    // pre-flight checks
                    if (this.props.data == null || this.props.data.timestamps == null) {
                        // no data provided or no timestamps provided in data
                        return
                    }
                    
                    // init with first frame
                    let currentFrame = 0
                    if (this.state.currentFrame != null) {
                        currentFrame = this.state.currentFrame + 1
                        if (currentFrame >= this.props.data.timestamps.length - 1) {
                            // start from the beginning after reaching last frame
                            currentFrame = 0
                        }
                    }
                    this.setState({ currentFrame })
                }, playbackSpeed)
            })
            
        }        
    }

    pause() {
        if (this.timer != null) {
            clearInterval(this.timer)
            this.timer = null
            this.setState({ playing: false })
        }
    }

    selectFrame(ev) {
        const frame = parseInt(ev.target.value, 10)
        this.setState({
            currentFrame: frame
        })
    }

    changeTransparency(ev) {
        const val = parseFloat(ev.target.value)
        this.setState({ transparency: val })
    }

    changeSearchTerm(ev) {
        const searchTerm = ev.target.value
        if (searchTerm.length >= 2) {
            this.setState({ searchTerm })
        } else {
            this.setState({ searchTerm: "" })
        }
    }

    changeLayerVisible(index) {
        return () => {
            this.setState(oldState => ({
                ...oldState,
                visibleLayers: util.toggleItem(oldState.visibleLayers, index),
            }))
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
        const layerGap = this.props.layerGap != null ? this.props.layerGap : 10
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
        this.props.model.layers.forEach((layer, index) => {
            const { height } = layer
            if (!this.state.visibleLayers.includes(index)) {
                // skip this layer, it has been deactivated
                currentHue += hueStep
                currentHeight += (height + layerGap)
                return
            }
            // process components
            layer.components.forEach(component => {
                // extract geometry from component
                const width = component.size[0]
                const depth = component.size[1]
                const geometry = new BoxGeometry(width, height, depth)

                // init material parameter
                let saturation = "100%"
                let wireframe = true
                let opacity = 1.0 - this.state.transparency

                // overwrite material in case we filter by search term
                if (this.state.searchTerm !== "") {
                    // we are filtering by a search term
                    if (!component.id.toLowerCase().includes(this.state.searchTerm.toLowerCase())) {
                        // not matching search term
                        saturation = "20%"
                        opacity = 0.2
                    } else {
                        // matching search term
                        wireframe = false
                    }
                }
                // check if data was provided and overwrite color
                let color = this.getCustomColor(component.id)
                if (color != null) {
                    if (this.state.searchTerm === "") {
                        wireframe = false
                    }
                } else {
                    color = `hsl(${currentHue}, ${saturation}, 70%)`
                }

                // create material and compose cube
                const material = new MeshBasicMaterial({
                    color,
                    wireframe,
                    opacity,
                    transparent: true,
                })
                const cube = new Mesh(geometry, material)
                // apply centre offset to each coordinate and add cube to scene
                cube.position.set(
                    component.x - centre.x + width / 2,
                    currentHeight - centre.y + height / 2,
                    component.y - centre.z + depth / 2
                )
                this.scene.add(cube)
            })
            currentHue += hueStep
            currentHeight += (height + layerGap)
        })
    }

    render() {
        const dateFormat = this.props.dateFormat || "LLL"
        const tsMultiplier = TIMESTAMP_MULTIPLIERS[this.props.timestampFormat || "s"] || 1000
        return (
            <div>
                <div
                    style={mixins.relative}
                    ref={el => {
                        this.mount = el
                    }}
                >
                    {this.state.currentFrame != null ? (
                        <div style={style.playerControls(this.props.width || DEFAULT_WIDTH)}>
                            <div style={mixins.flexRow}>
                                <div>
                                    {this.state.playing ? (<span onClick={this.pause} style={style.playPauseIcon(true)}>&#9612;&#9612;</span>) : (<span onClick={this.play} style={style.playPauseIcon(false)}>&#9658;</span>)}
                                </div>
                                <div>
                                    <div style={mixins.vSpacer(5)} />
                                    <input style={style.scrollBar} type="range" min={0} max={this.props.data.timestamps.length - 1} step={1} value={this.state.currentFrame} onChange={this.selectFrame} />
                                </div>
                                <div style={style.frameNumber}>
                                    {this.state.currentFrame + 1} / {this.props.data.timestamps.length}
                                </div>
                                <div>
                                    <div style={mixins.vSpacer(8)} />
                                    {moment(new Date(this.props.data.timestamps[this.state.currentFrame] * tsMultiplier)).format(dateFormat)}
                                </div>
                            </div>
                        </div>
                    ) : null}
                    {this.state.minValue != null && this.state.maxValue != null ? (
                        <div style={style.colorIndex}>
                            <div style={style.colorScale(this.props.colors || util.redBlueTricolor)}>
                                <div style={style.colorScaleLabel}>{(this.props.inverse ? this.state.maxValue : this.state.minValue).toFixed(1)}</div>
                                <div style={{ ...style.colorScaleLabel, ...mixins.center }}>
                                    {((this.state.minValue + this.state.maxValue) / 2).toFixed(1)}
                                </div>
                                <div style={{ ...style.colorScaleLabel, ...mixins.right }}>{(this.props.inverse ? this.state.minValue : this.state.maxValue).toFixed(1)}</div>
                            </div>
                        </div>
                    ) : null}
                </div>
                <div style={mixins.vSpacer(15)} />
                {this.props.noFilters ? null : (
                    <div style={style.filterContainer}>
                        <div>
                            <div style={mixins.vSpacer(15)} />
                            <input
                                type="text"
                                style={mixins.textInput}
                                placeholder="Search for component"
                                onChange={this.changeSearchTerm}
                            />
                        </div>
                        <div>
                            <label style={mixins.label}>Transparency</label>
                            <input type="range" min={0.0} max={0.95} step={0.05} style={style.transparency} value={this.state.transparency} onChange={this.changeTransparency} />
                        </div>
                        <div>
                            <div style={mixins.vSpacer(30)} />
                            <div style={mixins.flexRow}>
                                {this.props.model.layers.map((layer, index) => (
                                    <div
                                        key={index}
                                        style={{ ...mixins.indent(15), ...mixins.clickable }}
                                        onClick={this.changeLayerVisible(index)}
                                    >
                                        <span style={style.showLayer(this.state.visibleLayers.includes(index))}>&#128065;</span>{" "}
                                        {layer.label != null && layer.label !== "" ? layer.label : `Layer ${index + 1}`}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
}

export default Timeseries3D
