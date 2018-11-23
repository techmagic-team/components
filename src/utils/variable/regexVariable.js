const def = '\\${(([a-zA-Z0-9_\\.[\\]]*)[\\s\\|\\|\\s]*([a-zA-Z0-9_\\.\\\'\\"]*))}'

const regex = new RegExp(def)

export { def, regex }
