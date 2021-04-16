import React from "react"
import { mixins, NotificationBar, Popup } from "quick-n-dirty-react"
import util from "quick-n-dirty-utils"

const style = {
    component: selected => ({
        ...mixins.clickable,
        marginRight: "6px",
        marginBottom: "6px",
        padding: "2px",
        border: "1px solid #666",
        background: selected ? "#bbb" : "#f3f3f3",
        borderRadius: "3px",
    }),
    componentLabel: used => ({
        color: used ? "#999" : "#333",
    }),
    textLink: {
        ...mixins.textLink,
        textDecoration: "none",
    },
    addForm: {
        border: "1px solid #ccc",
        padding: "8px",
        display: "grid",
        gridTemplateColumns: "120px 120px 160px 120px",
        width: "550px",
        gridColumnGap: "10px",
    },
    popupForm: {
        display: "grid",
        gridTemplateColumns: "200px 100px 100px",
        gridColumnGap: "10px",
    },
    removeComponent: {
        display: "inline-block",
        marginLeft: "5px",
    },
}

class ComponentList extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            showAdd: false,
            showAddPopup: false,
            zeroPad: false,
        }

        // behaviour manipulation
        this.toggleAdd = this.toggleAdd.bind(this)
        this.togglePopup = this.togglePopup.bind(this)
        this.onKeyPress = this.onKeyPress.bind(this)
        this.changeZeroPad = this.changeZeroPad.bind(this)
        // data manipulation
        this.addComponent = this.addComponent.bind(this)
        this.generateComponents = this.generateComponents.bind(this)
    }

    onKeyPress(ev) {
        // press enter in the new component form
        if (ev.which === 13) {
            this.addComponent()
        }
    }

    toggleAdd() {
        // show / hide the new component form (not the popup to generate)
        this.setState(oldState => ({
            ...oldState,
            showAdd: !oldState.showAdd,
        }))
    }

    togglePopup() {
        // show / hide the component generation form popup
        this.setState(oldState => ({
            ...oldState,
            showAddPopup: !oldState.showAddPopup,
            showAdd: false,
            zeroPad: false,
        }))
    }

    addComponent() {
        // adds a single component with an id
        const newVal = this.addForm.value.trim()
        if (newVal === "") {
            this.alert.info("Please provide an identifier for the component")
            return
        }
        if (this.props.components.includes(newVal)) {
            this.alert.info("This component already exists.")
            return
        }
        // update the list and send to parent
        const newList = [...this.props.components]
        newList.push(newVal)
        this.props.updateComponentList(newList)
        // make sure we focus again on the input to allow for quick editing
        this.addForm.focus()
    }

    generateComponents() {
        const prefix = this.prefix.value.trim()
        const start = parseInt(this.start.value, 10)
        const end = parseInt(this.end.value, 10)

        if (isNaN(start) || isNaN(end)) {
            // floats provided or nothing
            this.alert.error("Start and End need to be whole numbers.")
            return
        }

        // handle the zero padding
        const zeroPad = this.zeroPad.checked
        const padDigits = zeroPad ? parseInt(this.zeroPadNumber.value, 10) : 0
        if (isNaN(padDigits)) {
            this.alert.error("Zero Padding Digits needs to be whole number.")
            return
        }

        const result = []
        util.range(start, end).forEach(number => {
            // start composing the final component id
            let suffix = `${number}`
            if (zeroPad) {
                // for each missing digit, add a 0
                if (suffix.length < padDigits) {
                    const startLength = suffix.length // need to remember this, because suffix keeps extending
                    for (let i = 0; i < padDigits - startLength; i += 1) {
                        suffix = `0${suffix}`
                    }
                }
            }
            // combine prefix and suffix and add to list
            result.push(`${prefix}${suffix}`)
        })

        // / notify parent with updated list
        this.props.updateComponentList(this.props.components.concat(...result))
        // reset the form and close popup
        this.setState({
            zeroPad: false,
            showAdd: false,
            showAddPopup: false,
        })
    }

    changeZeroPad(ev) {
        const { checked } = ev.target
        this.setState({ zeroPad: checked })
    }

    render() {
        return (
            <div>
                <NotificationBar
                    ref={el => {
                        this.alert = el
                    }}
                />
                <div style={mixins.vSpacer(10)} />
                <div style={mixins.flexRow}>
                    {this.props.components.map(comp => (
                        <div style={style.component(this.props.selected === comp)} key={comp}>
                            <span
                                onClick={this.props.selectComponent(comp)}
                                style={style.componentLabel(this.props.used.includes(comp))}
                            >
                                {comp}
                            </span>
                            <span style={style.removeComponent} onClick={() => this.props.removeComponent(comp)}>
                                &times;
                            </span>
                        </div>
                    ))}

                    {this.state.showAdd ? null : (
                        <div>
                            <div style={mixins.vSpacer(4)} />
                            <span style={style.textLink} onClick={this.toggleAdd}>
                                + Add Components
                            </span>
                        </div>
                    )}
                </div>
                {this.state.showAdd ? (
                    <div style={style.addForm}>
                        <div>
                            <input
                                type="text"
                                style={mixins.textInput}
                                ref={el => {
                                    this.addForm = el
                                }}
                                placeholder="New component"
                                onKeyPress={this.onKeyPress}
                            />
                        </div>
                        <div>
                            <button style={mixins.button} type="button" onClick={this.addComponent}>
                                Add
                            </button>
                        </div>
                        <div style={mixins.center}>
                            <button style={mixins.inverseButton} type="button" onClick={this.togglePopup}>
                                Generate Multiple
                            </button>
                        </div>
                        <div style={mixins.center}>
                            <button style={mixins.inverseButton} type="button" onClick={this.toggleAdd}>
                                Done
                            </button>
                        </div>
                    </div>
                ) : null}
                {this.state.showAddPopup ? (
                    <Popup ok={this.generateComponents} cancel={this.togglePopup} title="Generate Components">
                        <div style={style.popupForm}>
                            <div>
                                <label style={mixins.label}>Prefix</label>
                                <input
                                    type="text"
                                    style={mixins.textInput}
                                    ref={el => {
                                        this.prefix = el
                                    }}
                                />
                            </div>
                            <div>
                                <label style={mixins.label}>Start Number</label>
                                <input
                                    type="number"
                                    style={mixins.textInput}
                                    ref={el => {
                                        this.start = el
                                    }}
                                    defaultValue="1"
                                />
                            </div>
                            <div>
                                <label style={mixins.label}>End Number</label>
                                <input
                                    type="number"
                                    style={mixins.textInput}
                                    ref={el => {
                                        this.end = el
                                    }}
                                    defaultValue="10"
                                />
                            </div>
                        </div>
                        <div style={style.popupForm}>
                            <div>
                                <div style={mixins.vSpacer(35)} />
                                <input
                                    type="checkbox"
                                    style={mixins.checkbox}
                                    ref={el => {
                                        this.zeroPad = el
                                    }}
                                    id="zero-pad"
                                    onChange={this.changeZeroPad}
                                />
                                <label htmlFor="zero-pad">Zero-pad Numbers</label>
                            </div>
                            {this.state.zeroPad ? (
                                <div>
                                    <label style={mixins.label}>Digits</label>
                                    <input
                                        type="number"
                                        style={mixins.textInput}
                                        ref={el => {
                                            this.zeroPadNumber = el
                                        }}
                                        defaultValue="3"
                                    />
                                </div>
                            ) : null}
                        </div>
                    </Popup>
                ) : null}
            </div>
        )
    }
}

export default ComponentList
