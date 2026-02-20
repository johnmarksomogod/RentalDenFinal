import { useRef } from 'react';
import PropTypes from 'prop-types';

function ChatForm({chatHistory, setChatHistory, generateBotResponse}) {
    const inputRef = useRef();

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const userMessage = inputRef.current.value.trim();
        if(!userMessage) return;
        inputRef.current.value = "";
        
        //UPDATE CHAT HISTORY WITH USER MESSAGES
        setChatHistory(history => [...history, {role:"user", text: userMessage}]);
        
        setTimeout(() => {
            //FOR 'THINKING' FOR CHATBOT RESPONSE
            setChatHistory((history) => [...history, {role:"model", text: "Thinking..."}])
            
            //GENERATE BOT RESPONSE with reinforced scope constraints
            generateBotResponse([
              ...chatHistory,
              {
                role:"user",
                text: `Answer ONLY if related to The Rental Den - Cebu (vehicles, rates, booking, services, policies, contact). If outside scope, refuse and provide contact details. Query: ${userMessage}`
              }
            ]);
        }, 600);
    }
  return (
    <div>
      <form action="#" className="chat-form" onSubmit={handleFormSubmit}>
            <input ref={inputRef} type="text" className="message-input" placeholder='Feel free to ask Denni!' required/>
            <button className="material-symbols-outlined"> arrow_upward</button>
    </form>
    </div>
  )
}

ChatForm.propTypes = {
  chatHistory: PropTypes.arrayOf(
    PropTypes.shape({
      role: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired
    })
  ).isRequired,
  setChatHistory: PropTypes.func.isRequired,
  generateBotResponse: PropTypes.func.isRequired
};

export default ChatForm
