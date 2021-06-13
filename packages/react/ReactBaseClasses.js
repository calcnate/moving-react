function Component(props, context, updater) {
  this.props = props
  this.context = context
  this.refs = {}
  this.updater = updater
}

Component.prototype.isReactComponent = {}

Component.prototype.setState = function (partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState')
}

export default Component
