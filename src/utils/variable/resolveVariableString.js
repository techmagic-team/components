import { get, toString } from '@serverless/utils'
import matchVariable from './matchVariable'

const resolveVariableString = (variableString, data) => {
  const { exact, match, preferredValue, defaultValue } = matchVariable(variableString)
  if (!match) {
    return variableString
  }
  const resolvedExpression = resolveVariableString(preferredValue, data)
  let value = get(resolvedExpression, data)
  if (!exact) {
    if (!value && defaultValue) {
      value = variableString.replace(match, toString(defaultValue))
    } else {
      value = variableString.replace(match, toString(value))
    }
  }
  return value
}

export default resolveVariableString
