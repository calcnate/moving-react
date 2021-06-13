import React from '../packages/react/index.js'
import ReactDOM from '../packages/react-dom/index.js'

const e = React.createElement

class LikeButton extends React.Component {
  constructor(props) {
    super(props)
    this.state = { liked: false }
  }

  componentDidMount() {
    setTimeout(() => {
      this.setState({ liked: true })
    }, 3000)
  }

  render() {
    if (this.state.liked) {
      return 'You liked comment number ' + this.props.commentID
    }

    return e('button', {}, 'Like')
  }
}

// Find all DOM containers, and render Like buttons into them.
document.querySelectorAll('.like_button_container').forEach((domContainer) => {
  // Read the comment ID from a data-* attribute.
  const commentID = parseInt(domContainer.dataset.commentid, 10)
  ReactDOM.render(e(LikeButton, { commentID: commentID }), domContainer)
})
