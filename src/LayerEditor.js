import { NotificationBar, mixins } from "quick-n-dirty-react"
import React from "react"
import ComponentList from "./ComponentList"

const SNAP_PROXIMITY = 8

const style = {
    canvas: {
        cursor: "crosshair",
        border: "1px solid #333",
        marginTop: "15px",
        marginBottom: "15px",
    },
}

class LayerEditor extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            start: null,
            components: props.layer.components.map(comp => comp.id),
            currentComponent: null,
            showGuidelines: true,
        }

        // drawing related
        this.getCanvasCoordinates = this.getCanvasCoordinates.bind(this)
        this.onMouseDown = this.onMouseDown.bind(this)
        this.onMouseUp = this.onMouseUp.bind(this)
        this.onMouseMove = this.onMouseMove.bind(this)
        this.redraw = this.redraw.bind(this)

        // component related
        this.selectComponent = this.selectComponent.bind(this)
        this.updateComponentList = this.updateComponentList.bind(this)
        this.removeComponent = this.removeComponent.bind(this)

        // behaviour related
        this.changeGuidelines = this.changeGuidelines.bind(this)
    }

    componentDidMount() {
        this.redraw() // trigger redraw as soon as editor gets displayed (fresh layer will render guidelines only)
    }

    onMouseDown(ev) {
        if (this.state.currentComponent == null) {
            // need to select a component first
            this.alert.info("Please add and select a component first")
            return
        }
        // check if the selected component has already been drawn
        const existingIds = this.props.layer.components.map(c => c.id)
        if (existingIds.includes(this.state.currentComponent)) {
            // don't set starting point
            return
        }
        this.setState({ start: this.getCanvasCoordinates(ev) })
    }

    onMouseUp(ev) {
        if (this.state.start != null) {
            const { x, y } = this.getCanvasCoordinates(ev)
            const newItem = {
                ...this.state.start, // adds x and y
                size: [x - this.state.start.x, y - this.state.start.y], // width and height
                id: this.state.currentComponent,
            }

            // ensure x and y are in the top left corner
            if (newItem.size[0] < 0) {
                // negative width, re-arrange x
                newItem.x += newItem.size[0]
                newItem.size[0] = -newItem.size[0]
            }
            if (newItem.size[1] < 0) {
                // negative height, re-arrange y
                newItem.y += newItem.size[1]
                newItem.size[1] = -newItem.size[1]
            }

            // check if the new item is big enough and a real component
            if (newItem.size[0] < 5 || newItem.size[1] < 5) {
                this.setState({ start: null })
                this.redraw()
                return
            }

            // add component, reset start and redraw
            this.props.addComponent(newItem).then(() => {
                this.setState(
                    oldState => {
                        const index = oldState.components.indexOf(newItem.id)
                        const newId = index + 1 >= oldState.components.length ? null : oldState.components[index + 1]
                        return {
                            ...oldState,
                            start: null,
                            currentComponent: newId,
                        }
                    },
                    () => {
                        this.redraw()
                    }
                )
            })
        }
    }

    onMouseMove(ev) {
        if (this.state.start != null) {
            // only action if we have mouse pressed down
            this.redraw()
            const { x, y } = this.getCanvasCoordinates(ev)
            const ctx = this.canvas.getContext("2d")
            ctx.strokeStyle = "#ccc"
            ctx.strokeRect(this.state.start.x, this.state.start.y, x - this.state.start.x, y - this.state.start.y)
        }
    }

    getCanvasCoordinates(e) {
        if (e == null) {
            console.error("You forgot to pass the event")
            return null
        }
        let x
        let y
        if (e.pageX || e.pageY) {
            x = e.pageX
            y = e.pageY
        } else {
            x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft
            y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop
        }
        x -= this.canvas.offsetLeft
        y -= this.canvas.offsetTop

        // handle snapping to last element height / width
        if (this.props.lastWidth != null && this.props.lastHeight != null && this.state.start != null) {
            const currentWidth = Math.abs(this.state.start.x - x)
            const currentHeight = Math.abs(this.state.start.y - y)
            if (Math.abs(currentWidth - this.props.lastWidth) < SNAP_PROXIMITY) {
                // snap to last width
                x = this.state.start.x + (this.state.start.x > x ? -this.props.lastWidth : this.props.lastWidth)
            }
            if (Math.abs(currentHeight - this.props.lastHeight) < SNAP_PROXIMITY) {
                // snap to last height
                y = this.state.start.y + (this.state.start.y > y ? -this.props.lastHeight : this.props.lastHeight)
            }
        }

        if (this.state.showGuidelines === true) {
            // handle snapping to vertical and horizontal guidelines
            this.props.guideLines.vertical.forEach(gl => {
                if (Math.abs(x - gl) < SNAP_PROXIMITY) {
                    // close enough to vertical guideline
                    x = gl
                }
            })
            this.props.guideLines.horizontal.forEach(gl => {
                if (Math.abs(y - gl) < SNAP_PROXIMITY) {
                    // close enough to horizontal guideline
                    y = gl
                }
            })
        }

        return { x, y }
    }

    changeGuidelines(ev) {
        const val = ev.target.checked
        this.setState({ showGuidelines: val }, () => {
            this.redraw()
        })
    }

    redraw() {
        const ctx = this.canvas.getContext("2d")
        // clean canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        // provide defaults
        ctx.fillStyle = "#333"
        ctx.font = "12px Arial"
        ctx.textAlign = "left"

        // re-draw all guidelines
        if (this.state.showGuidelines) {
            ctx.save()
            ctx.setLineDash([4, 8]) // line, space
            ctx.beginPath()
            ctx.strokeStyle = "#cc0" // yellow for guidelines
            this.props.guideLines.vertical.forEach(x => {
                ctx.moveTo(x, 0)
                ctx.lineTo(x, this.props.height)
            })
            this.props.guideLines.horizontal.forEach(y => {
                ctx.moveTo(0, y)
                ctx.lineTo(this.props.width, y)
            })
            ctx.stroke()
            ctx.restore()
        }        

        // re-draw all components
        this.props.layer.components.forEach(comp => {
            // highlight current selected in red
            ctx.strokeStyle = comp.id === this.state.currentComponent ? "#f00" : "#333"
            // draw box
            ctx.strokeRect(comp.x, comp.y, comp.size[0], comp.size[1])
            // add label

            if (comp.size[0] < comp.id.length * 8 && comp.size[0] < comp.size[1]) {
                // rotate text to allow better display
                ctx.save()
                ctx.translate(comp.x, comp.y) // need to re-center, otherwise rotated text won't work
                ctx.rotate((-90 * Math.PI) / 180) // rotate 90 degrees back
                ctx.textAlign = "right"
                ctx.fillText(comp.id, -2, 12) // this gives sufficient padding
                ctx.restore() // reset to default translation and rotation
            } else {
                ctx.fillText(comp.id, comp.x + 2, comp.y + 13)
            }
            ctx.restore()
        })
    }

    selectComponent(component) {
        return () => {
            this.setState({ currentComponent: component }, () => {
                this.redraw()
            })
        }
    }

    updateComponentList(newList) {
        this.setState({ components: newList })
    }

    removeComponent(component) {
        // remove from layer if it has been drawn already
        this.props.removeComponent(component).then(() => {
            // redraw just in case
            this.redraw()
            // update component list
            this.setState(oldState => {
                const { currentComponent, components } = oldState
                // remove from component list
                components.splice(components.indexOf(component), 1)
                // reset to null, if current is the component to remove
                const current = currentComponent === component ? null : currentComponent
                return {
                    ...oldState,
                    currentComponent: current,
                    components,
                }
            })
        })
    }

    render() {
        return (
            <div>
                <NotificationBar
                    ref={el => {
                        this.alert = el
                    }}
                />
                <ComponentList
                    components={this.state.components}
                    selectComponent={this.selectComponent}
                    updateComponentList={this.updateComponentList}
                    selected={this.state.currentComponent}
                    removeComponent={this.removeComponent}
                    used={this.props.layer.components.map(comp => comp.id)}
                />
                <canvas
                    style={style.canvas}
                    onMouseDown={this.onMouseDown}
                    onMouseMove={this.onMouseMove}
                    onMouseUp={this.onMouseUp}
                    ref={el => {
                        this.canvas = el
                    }}
                    width={this.props.width}
                    height={this.props.height}
                />
                <div>
                    <input type="checkbox" style={mixins.checkbox} checked={this.state.showGuidelines} onChange={this.changeGuidelines} id={`show-guidelines-${this.props.layerIndex}`} />
                    <label style={mixins.label} htmlFor={`show-guidelines-${this.props.layerIndex}`}>Show Guidelines</label>
                </div>
            </div>
        )
    }
}

export default LayerEditor
