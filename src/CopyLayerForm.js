import { mixins } from "quick-n-dirty-react"
import React from "react"

const style = {
    replacementForm: {
        display: "grid",
        gridTemplateColumns: "150px 150px 100px",
        gridColumnGap: "10px",
        paddingBottom: "2px",
    },
    addReplacement: {
        ...mixins.clickable,
        ...mixins.center,
        width: "292px",
        border: "1px solid #333",
        padding: "8px",
        borderRadius: "4px",
    },
    deleteReplacement: {
        ...mixins.clickable,
        display: "inline-block",
        paddingTop: "4px",
        color: "#933",
    },
}

class CopyLayerForm extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            replacements: [{ find: "", replace: "" }],
        }

        this.getReplacements = this.getReplacements.bind(this)

        this.addReplacement = this.addReplacement.bind(this)
        this.removeReplacement = this.removeReplacement.bind(this)
        this.updateReplacement = this.updateReplacement.bind(this)
    }

    getReplacements() {
        return this.state.replacements
    }

    updateReplacement(index, key) {
        return ev => {
            const val = ev.target.value
            this.setState(oldState => {
                const { replacements } = oldState
                if (replacements[index] != null && replacements[index][key] != null) {
                    replacements[index][key] = val
                }
                return {
                    ...oldState,
                    replacements,
                }
            })
        }
    }

    addReplacement() {
        this.setState(oldState => ({
            ...oldState,
            replacements: oldState.replacements.concat({ find: "", replace: "" }),
        }))
    }

    removeReplacement(index) {
        return () => {
            this.setState(oldState => {
                const { replacements } = oldState
                replacements.splice(index, 1)
                return {
                    ...oldState,
                    replacements,
                }
            })
        }
    }

    render() {
        return (
            <div>
                {this.state.replacements.length > 0 ? (
                    <div style={style.replacementForm}>
                        <div>
                            <label style={mixins.label}>Find</label>
                        </div>
                        <div>
                            <label style={mixins.label}>Replace</label>
                        </div>
                    </div>
                ) : null}
                {this.state.replacements.map((replacement, index) => (
                    <div style={style.replacementForm}>
                        <div>
                            <input
                                type="text"
                                style={mixins.textInput}
                                defaultValue={replacement.find}
                                onChange={this.updateReplacement(index, "find")}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                style={mixins.textInput}
                                defaultValue={replacement.replace}
                                onChange={this.updateReplacement(index, "replace")}
                            />
                        </div>
                        <div>
                            <span style={style.deleteReplacement} onClick={this.removeReplacement(index)}>
                                &times;
                            </span>
                        </div>
                    </div>
                ))}
                <div style={style.addReplacement} onClick={this.addReplacement}>
                    +
                </div>
            </div>
        )
    }
}

export default CopyLayerForm
