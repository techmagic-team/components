/* eslint-disable no-console */

const AWS = require('aws-sdk')
const { find, isNil, whereEq } = require('ramda')

const sns = new AWS.SNS({ region: 'us-east-1' })

const subscribe = async ({ topic, protocol, endpoint }, context) => {
  context.log(`TBD ${protocol} ${endpoint} subscription -> ${topic}`)
  return sns
    .subscribe({
      TopicArn: topic,
      Protocol: protocol,
      Endpoint: endpoint
    })
    .promise()
}

const unsubscribe = async (context) => {
  const { state } = context
  context.log(`TBD removing ${state.subscriptionArn}`)
  return sns
    .unsubscribe({
      SubscriptionArn: state.subscriptionArn
    })
    .promise()
}

const setSubscriptionAttributes = async (
  { subscriptionArn, attributeName, attributeValue },
  context
) => {
  context.log(`TBD setting ${attributeName} to ${subscriptionArn}`)
  return sns
    .setSubscriptionAttributes({
      AttributeName: attributeName,
      SubscriptionArn: subscriptionArn,
      AttributeValue: attributeValue
    })
    .promise()
}

const deleteSubscriptionAttributes = async ({ subscriptionArn, attributeName }, context) => {
  return setSubscriptionAttributes({ subscriptionArn, attributeName, attributeValue: '' }, context)
}

const waitForConfirmation = async (
  { topic, protocol, endpoint },
  interval = 5000,
  timeout = 60000
) =>
  new Promise((resolve, reject) => {
    const startTime = Date.now()
    const pollInterval = setInterval(async () => {
      if (Date.now() - startTime > timeout) {
        clearInterval(pollInterval)
        return reject('Confirmation timed out')
      }
      const subscriptions = await sns
        .listSubscriptionsByTopic({
          TopicArn: topic
        })
        .promise()
      // topic can have only one subscription with same protocol and endpoint
      const created = find(whereEq({ Protocol: protocol, Endpoint: endpoint }))(
        subscriptions.Subscriptions
      )
      if (
        !isNil(created) &&
        (created.SubscriptionArn !== 'pending confirmation' &&
          created.SubscriptionArn !== 'PendingConfirmation')
      ) {
        clearInterval(pollInterval)
        return resolve({ subscriptionArn: created.SubscriptionArn })
      }
    }, interval)
  })

module.exports = {
  subscribe,
  unsubscribe,
  setSubscriptionAttributes,
  deleteSubscriptionAttributes,
  waitForConfirmation
}
