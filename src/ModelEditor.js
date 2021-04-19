import React from "react"
import util from "quick-n-dirty-utils"
import { mixins, Popup, ToggleSection, NotificationBar } from "quick-n-dirty-react"
import LayerEditor from "./LayerEditor"
import CopyLayerForm from "./CopyLayerForm"
import Timeseries3D from "./Timeseries3D"

const DEFAULT_HEIGHT = 50
const DEFAULT_LAYER_EDITOR_HEIGHT = 450
const SNAP_PROXIMITY = 8

const style = {
    layerTitle: {
        ...mixins.relative,
        border: "1px solid #333",
        borderRadius: "5px",
        background: "#f3f3f3",
        fontSize: "20px",
        padding: "15px",
        marginTop: "15px",
    },
    layerLabel: {
        ...mixins.clickable,
        display: "inline-block",
        width: "calc(100% - 140px)",
    },
    deleteLayer: {
        ...mixins.clickable,
        fontSize: "20px",
        color: "#aaa",
        position: "absolute",
        top: "15px",
        right: "15px",
    },
    copyLayer: {
        ...mixins.clickable,
        ...mixins.textLink,
        textDecoration: "none",
        position: "absolute",
        fontSize: "14px",
        top: "17px",
        right: "45px",
    },
    sortLayer: {
        position: "absolute",
        fontSize: "24px",
        top: "10px",
        right: "100px",
    },
    addLayer: {
        ...mixins.clickable,
        marginTop: "15px",
        marginBottom: "15px",
        padding: "15px",
        border: "1px solid #333",
        borderRadius: "5px",
        background: "#f3f3f3",
        textAlign: "center",
        fontSize: "20px",
    },
    modelConfig: {
        display: "grid",
        gridTemplateColumns: "150px 150px",
        gridColumnGap: "10px",
    },
    layerForm: {
        display: "grid",
        gridTemplateColumns: "150px 60px 150px 100px",
        gridColumnGap: "10px",
    },
}

const generateGuidelines = model => {
    const result = { vertical: [], horizontal: [] }
    const blocked = { vertical: [], horizontal: [] }

    const handleCandidate = (orientation, value) => {
        if (!blocked[orientation].includes(value)) {
            result[orientation].push(value)
            blocked[orientation] = blocked[orientation].concat(
                ...util.range(value - SNAP_PROXIMITY, value + SNAP_PROXIMITY)
            )
        }
    }
    model.layers.forEach(layer => {
        layer.components.forEach(component => {
            handleCandidate("vertical", component.x) // left border
            handleCandidate("vertical", component.x + component.size[0]) // right border
            handleCandidate("horizontal", component.y) // top border
            handleCandidate("horizontal", component.y + component.size[1]) // bottom border
        })
    })
    return result
}

/*
 * Properties:
 * - height: the height of the layer editor canvas - default 450
 * - model: optional, if you want to already provide a model
 */

class ModelEditor extends React.Component {
    constructor(props) {
        super(props)

        const initModel = props.model || {
            layers: [],
        }
        this.state = {
            // model to be edited
            currentModel: initModel,
            guideLines: generateGuidelines(initModel),

            // behaviour states
            expandedLayers: [],
            askRemoveLayerIndex: null,
            copyLayerIndex: null,

            // display state
            editorWidth: 1000,

            lastWidth: null,
            lastHeight: null,
        }

        this.layers = {}

        // model operations
        this.exportModel = this.exportModel.bind(this)
        this.importModel = this.importModel.bind(this)
        // layer operations
        this.addLayer = this.addLayer.bind(this)
        this.askRemoveLayer = this.askRemoveLayer.bind(this)
        this.removeLayer = this.removeLayer.bind(this)
        this.toggleLayer = this.toggleLayer.bind(this)
        this.updateLayerHeight = this.updateLayerHeight.bind(this)
        this.updateLayerLabel = this.updateLayerLabel.bind(this)
        this.askCopyLayer = this.askCopyLayer.bind(this)
        this.copyLayer = this.copyLayer.bind(this)
        // component operations
        this.addComponent = this.addComponent.bind(this)
        this.removeComponent = this.removeComponent.bind(this)
    }

    componentDidMount() {
        // update the editor width with the current display width
        this.setState({
            editorWidth: this.addLayerDiv.offsetWidth - 2, // remove border (1 on each side)
        })
    }

    askCopyLayer(index) {
        return () => {
            // this will toggle the copy layer popup
            this.setState({ copyLayerIndex: index })
        }
    }

    copyLayer() {
        this.setState(oldState => {
            const { currentModel } = oldState
            // create clone of layer
            const newLayer = { ...currentModel.layers[oldState.copyLayerIndex] }
            newLayer.components = [...newLayer.components.map(comp => ({ ...comp }))]
            // handle replacements
            const replacements = this.copyLayerForm.getReplacements()
            newLayer.components.forEach(comp => {
                replacements.forEach(repl => {
                    if (repl.find.trim() === "") {
                        // invalid replacement term
                        return
                    }
                    if (comp.id.includes(repl.find)) {
                        // update id
                        comp.id = comp.id.replace(repl.find, repl.replace)
                    }
                })
            })
            // add the new layer
            currentModel.layers.push(newLayer)

            return {
                ...oldState,
                currentModel,
                copyLayerIndex: null,
            }
        })
    }

    addLayer() {
        this.setState(
            oldState => {
                const { currentModel } = oldState
                // use last layers height or default height
                const newHeight =
                    currentModel.layers.length === 0
                        ? DEFAULT_HEIGHT
                        : currentModel.layers[currentModel.layers.length - 1].height
                // create new layer
                currentModel.layers.push({
                    components: [],
                    height: newHeight,
                    label: "",
                })
                return {
                    ...oldState,
                    currentModel,
                }
            },
            () => {
                if (this.preview != null && this.preview.changeLayerVisible != null) {
                    this.preview.changeLayerVisible(this.state.currentModel.layers.length - 1)()
                }
            }
        )
    }

    askRemoveLayer(layerIndex) {
        return () => {
            this.setState({
                askRemoveLayerIndex: layerIndex, // this will render the popup if not null
            })
        }
    }

    removeLayer() {
        this.layers = {} // reset this to not have dead references stored
        this.setState(oldState => {
            // remove the layer
            const { currentModel } = oldState
            currentModel.layers.splice(oldState.askRemoveLayerIndex, 1)
            // update state and close popup
            return {
                ...oldState,
                askRemoveLayerIndex: null,
                currentModel,
                guideLines: generateGuidelines(currentModel),
            }
        })
    }

    moveLayer(index, moveUp) {
        return () => {
            // compile list of indexes to swap
            const targetIndex = moveUp ? index - 1 : index + 1
            const updates = [index, targetIndex]
            // update model
            this.setState(
                oldState => {
                    const { currentModel } = oldState
                    // re-compose layer list
                    const layers = []
                    const shiftLayers = []
                    currentModel.layers.forEach((layer, idx) => {
                        if (!updates.includes(idx)) {
                            layers.push(layer)
                        }
                        if (idx === index || idx === targetIndex) {
                            // this is one of the elements we want to swap
                            shiftLayers.push(layer)
                        }
                        if (shiftLayers.length === 2) {
                            // reverse the 2 and append them both
                            shiftLayers.reverse()
                            layers.push(...shiftLayers.splice(0, 2)) // clear/reset this array, so we don't add these again
                        }
                    })
                    currentModel.layers = layers
                    return {
                        ...oldState,
                        currentModel,
                    }
                },
                () => {
                    // update the layer editors if they are open and re-draw the layer
                    updates.forEach(i => {
                        const ref = this.layers[i]
                        if (ref != null) {
                            ref.updateComponentList(this.state.currentModel.layers[i].components.map(comp => comp.id))
                            ref.redraw()
                        }
                    })
                    this.alert.success("Layer moved")
                }
            )
        }
    }

    toggleLayer(layerIndex) {
        return () => {
            this.layers = {}
            this.setState(oldState => ({
                ...oldState,
                expandedLayers: util.toggleItem(oldState.expandedLayers, layerIndex),
            }))
        }
    }

    updateLayerHeight(layerIndex) {
        return ev => {
            const height = parseInt(ev.target.value, 10)
            if (isNaN(height)) {
                // invalid height provided
                return
            }
            this.setState(oldState => {
                const { currentModel } = oldState
                currentModel.layers[layerIndex].height = height
                return {
                    ...oldState,
                    currentModel,
                }
            })
        }
    }

    updateLayerLabel(layerIndex) {
        return ev => {
            const newLabel = ev.target.value
            this.setState(oldState => {
                const { currentModel } = oldState
                currentModel.layers[layerIndex].label = newLabel
                return {
                    ...oldState,
                    currentModel,
                }
            })
        }
    }

    addComponent(index) {
        // component gets passed in by the caller
        return component => {
            return new Promise(resolve => {
                this.setState(
                    oldState => {
                        // add the component to the specified layer
                        const { currentModel } = oldState
                        currentModel.layers[index].components.push(component)
                        return {
                            ...oldState,
                            currentModel,
                            guideLines: generateGuidelines(currentModel),
                            lastWidth: component.size[0],
                            lastHeight: component.size[1],
                        }
                    },
                    () => {
                        // after state update, we need to redraw the canvas and re-render the 3D model
                        resolve()
                    }
                )
            })
        }
    }

    removeComponent(index) {
        return component => {
            return new Promise(resolve => {
                this.setState(
                    oldState => {
                        const { currentModel } = oldState
                        currentModel.layers[index].components = currentModel.layers[index].components.filter(
                            comp => comp.id !== component
                        )
                        return {
                            ...oldState,
                            currentModel,
                            guideLines: generateGuidelines(currentModel),
                        }
                    },
                    () => {
                        // after state update, we need to redraw the canvas and re-render the 3D model
                        resolve()
                    }
                )
            })
        }
    }

    exportModel() {
        util.exportToJson(this.state.currentModel, "model3d-export.json")
    }

    importModel(ev) {
        const file = ev.target.files[0]
        const reader = new FileReader()
        reader.readAsText(file)
        reader.onload = () => {
            const model = JSON.parse(reader.result)
            this.setState(
                {
                    currentModel: model,
                    guideLines: generateGuidelines(model),
                },
                () => {
                    model.layers.forEach((layer, index) => {
                        const ref = this.layers[index]
                        if (ref != null) {
                            ref.updateComponentList(layer.components.map(comp => comp.id))
                            ref.redraw()
                        }
                    })
                }
            )
        }
    }

    render() {
        return (
            <div>
                <NotificationBar
                    ref={el => {
                        this.alert = el
                    }}
                />
                {this.state.currentModel.layers.map((layer, index) => (
                    <div key={index}>
                        <div style={style.layerTitle}>
                            <div onClick={this.toggleLayer(index)} style={style.layerLabel}>
                                Layer {index + 1}
                                {layer.label !== "" && layer.label != null ? ` (${layer.label})` : null}
                            </div>
                            <div style={style.sortLayer}>
                                {index !== 0 ? (
                                    <span style={mixins.clickable} onClick={this.moveLayer(index, true)}>
                                        &uarr;
                                    </span>
                                ) : null}
                                <span>&nbsp;</span>
                                {index !== this.state.currentModel.layers.length - 1 ? (
                                    <span style={mixins.clickable} onClick={this.moveLayer(index, false)}>
                                        &darr;
                                    </span>
                                ) : null}
                            </div>
                            <div style={style.copyLayer} onClick={this.askCopyLayer(index)}>
                                Copy
                            </div>
                            <div style={style.deleteLayer} onClick={this.askRemoveLayer(index)}>
                                &times;
                            </div>
                        </div>
                        {this.state.expandedLayers.includes(index) ? (
                            <div>
                                <LayerEditor
                                    layer={layer}
                                    layerIndex={index}
                                    model={this.state.currentModel}
                                    height={this.props.height || DEFAULT_LAYER_EDITOR_HEIGHT}
                                    width={this.state.editorWidth}
                                    addComponent={this.addComponent(index)}
                                    removeComponent={this.removeComponent(index)}
                                    guideLines={this.state.guideLines}
                                    lastWidth={this.state.lastWidth}
                                    lastHeight={this.state.lastHeight}
                                    ref={el => {
                                        this.layers[index] = el
                                    }}
                                />
                                <div style={mixins.vSpacer(10)} />
                                <div style={style.layerForm}>
                                    <div>
                                        <label style={mixins.label}>Layer Render Height</label>
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            style={mixins.textInput}
                                            onChange={this.updateLayerHeight(index)}
                                            value={layer.height}
                                        />
                                    </div>
                                    <div style={mixins.right}>
                                        <label style={mixins.label}>Layer Label</label>
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            style={mixins.textInput}
                                            onChange={this.updateLayerLabel(index)}
                                            defaultValue={layer.label}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ))}
                <div
                    style={style.addLayer}
                    onClick={this.addLayer}
                    ref={el => {
                        this.addLayerDiv = el
                    }}
                >
                    +
                </div>
                {this.state.askRemoveLayerIndex != null ? (
                    <Popup title="Remove Layer" no={this.askRemoveLayer(null)} yes={this.removeLayer}>
                        Are you sure you want to remove this layer and all components in it?
                    </Popup>
                ) : null}

                {this.state.copyLayerIndex != null ? (
                    <Popup title="Copy Layer" cancel={this.askCopyLayer(null)} ok={this.copyLayer}>
                        <p>
                            Importing a model will remove any previously existing layers. Please specify any labels or
                            prefixes that you wish to replace.
                        </p>
                        <CopyLayerForm
                            ref={el => {
                                this.copyLayerForm = el
                            }}
                        />
                    </Popup>
                ) : null}

                <div style={mixins.vSpacer(15)} />

                <div style={mixins.flexRow}>
                    <div>
                        <span style={mixins.textLink} onClick={this.exportModel}>
                            Export Model
                        </span>
                    </div>
                    <div style={mixins.indent(20)}>
                        <label>Import Model</label>
                    </div>
                    <div style={mixins.indent(5)}>
                        <input type="file" onChange={this.importModel} />
                    </div>
                </div>
                <ToggleSection label="Preview">
                    <Timeseries3D
                        model={this.state.currentModel}
                        ref={el => {
                            this.preview = el
                        }}
                    />
                </ToggleSection>
            </div>
        )
    }
}

export default ModelEditor
