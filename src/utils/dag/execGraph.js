import { not, all, append, prop, isEmpty, reduce, filter, mapObjIndexed } from '@serverless/utils'
import cloneGraph from './cloneGraph'
import detectCircularDeps from './detectCircularDeps'

const getParameters = (instance) => {
  const requiredParams = filter((inputType) => !!inputType.required, prop('inputTypes', instance))
  return mapObjIndexed((num, key) => instance.inputs[key], requiredParams)
}

const reportStatus = (iteratee, node, context) => {
  const { prevInstance, nextInstance } = node

  const componentName =
    (nextInstance && nextInstance.constructor.name) ||
    (prevInstance && prevInstance.constructor.name)

  if (iteratee.name === 'deployNode') {
    const params = getParameters(nextInstance)
    context.log(
      `Deploying "${componentName}" ${
        not(isEmpty(params)) ? 'with parameters ' + JSON.stringify(params) : ''
      }`
    )
  } else if (iteratee.name === 'removeNode') {
    if (prevInstance) {
      const params = getParameters(prevInstance)
      context.log(
        `Removing "${componentName}" ${
          not(isEmpty(params)) ? 'with parameters ' + JSON.stringify(params) : ''
        }`
      )
    }
  }
}

const execNode = (iteratee, node, context) => {
  reportStatus(iteratee, node, context)

  return iteratee(node, {
    ...context,
    // replace `log` with `debug` so that component logs are hidden by default
    log: context.debug
  })
}

const execNodeIds = async (iteratee, nodeIds, graph, context) =>
  all(
    reduce(
      (accum, nodeId) => {
        const node = graph.node(nodeId)
        if (!node) {
          throw new Error(`could not find node for nodeId:${nodeId}`)
        }
        graph.removeNode(nodeId)
        return append(execNode(iteratee, node, context), accum)
      },
      [],
      nodeIds
    )
  )

const execNextNodes = async ({ iteratee, next }, graph, context) => {
  const nodeIds = next(graph)
  context.debug('checking node ids:', nodeIds)
  if (isEmpty(nodeIds)) {
    context.debug('node ids empty:', nodeIds)
    if (graph.nodeCount() > 0) {
      detectCircularDeps(graph)
      throw new Error('Graph execution did not complete')
    }
    return graph
  }

  await execNodeIds(iteratee, nodeIds, graph, context)
  return execNextNodes({ iteratee, next }, graph, context)
  //
  // // allow all executions to complete without terminating
  // const suppressErrors = (p) => p.catch(() => {})
  // await Promise.all(map(suppressErrors, executions))
  //
  // // if any executions failed, throw the error
  // await Promise.all(executions)
  //
  // return execute(graph, components, stateFile, archive, command, options, rollback)
}

const execGraph = async ({ iteratee, next }, graph, context) =>
  execNextNodes({ iteratee, next }, cloneGraph(graph), context)

export default execGraph
