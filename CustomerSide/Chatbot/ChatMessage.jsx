import PropTypes from 'prop-types';
import denni from './denni_logo.svg'


const ChatMessage = ({chat}) => {
  return (
    !chat.hideInChat && (
    <div className={`message ${chat.role === "model" ? 'bot' : 'user'}-message ${chat.isError ? "error" : ""}`}>
        {chat.role === "model" && <img src={denni} alt="icon" />}
        <p className="message-text">{chat.text}</p>
    </div>
  ))
}

ChatMessage.propTypes = {
  chat: PropTypes.shape({
    role: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    hideInChat: PropTypes.bool,
    isError: PropTypes.bool
  }).isRequired
};

export default ChatMessage
