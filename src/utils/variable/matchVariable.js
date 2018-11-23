import { regex } from './regexVariable'

/**
 * Accepts a string and attempts to find a variable string match
 *
 * @param {string} string The string to match
 * @returns {{
 *   expression: string, // the matching variable expression
 *   exact: boolean // whether or not this match was exact
 * }}
 */
const matchVariable = (string) => {
  const result = string.match(regex)
  let expression
  let match
  let exact
  let preferredValue
  let defaultValue
  if (result) {
    expression = result[1]
    match = result[0]
    exact = result.input === result[0]
    preferredValue = result[2]
    defaultValue = result[3].length > 0 ? result[3].replace(/\'/g, '') : null
  }
  return {
    expression,
    match,
    exact,
    preferredValue,
    defaultValue
  }
}

export default matchVariable
