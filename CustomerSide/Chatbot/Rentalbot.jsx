import { useEffect, useRef, useState } from 'react'
import { companyInfo } from './companyInfo';
import ChatForm from './ChatForm';
import ChatMessage from './ChatMessage';
import denni from './denni_logo.svg'
import * as firebaseService from '../src/lib/firebaseService'
function RentalBot() {
  const [chatHistory, setChatHistory] = useState([{
    hideInChat: true,
    role: "model",
    text: companyInfo
  }]);
  const [showChatbot, setShowChatbot] = useState(false);

  const chatBodyRef = useRef();

  //HELPER FUNCTION TO UPDATE CHAT HISTORY
  const updateHistory = (text, isError = false) => {
    setChatHistory(prev => [...prev.filter(msg => msg.text !== "Thinking..."), {role: "model", text, isError}]);
  }

  // Load live vehicle catalog from Supabase and inject as hidden system context
  useEffect(() => {
    const loadVehicleCatalog = async () => {
      try {
        const vehiclesRaw = await firebaseService.listVehicles();
        const vehicles = (vehiclesRaw || []).map((v) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          type: v.type,
          seats: v.seats,
          price_per_day: v.price_per_day,
          available: v.available,
          available_quantity: v.available_quantity,
        }));

        const variantsRaw = await firebaseService.listAllVariants();
        const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
        const variants = (variantsRaw || []).map((v) => ({
          id: v.id,
          color: v.color,
          image_url: v.image_url,
          available_quantity: v.available_quantity,
          total_quantity: v.total_quantity,
          vehicle_id: v.vehicle_id,
          vehicles: vehicleMap[v.vehicle_id] || null,
        }));

        // Build concise, structured catalog for LLM consumption
        const catalog = {
          schema: {
            id: 'number',
            make: 'string',
            model: 'string',
            year: 'number',
            type: 'string',
            seats: 'number',
            price_per_day: 'number',
            available: 'boolean',
            available_quantity: 'number'
          },
          vehicles,
          variants_schema: {
            id: 'number',
            color: 'string',
            image_url: 'string|null',
            available_quantity: 'number',
            total_quantity: 'number',
            vehicle_id: 'number',
            vehicles: 'object (make, model, year, type, seats, price_per_day, available)'
          },
          vehicle_variants: variants
        };

        const instructions = [
          'SCOPE: Only answer questions about The Rental Den - Cebu and its rentals/services. If out of scope, politely refuse and provide contact info.',
          'PRIORITY SOURCES: 1) VEHICLE_CATALOG_JSON (live), 2) COMPANY_INFO (business details). Do not invent details.',
          'VEHICLES: Use VEHICLE_CATALOG_JSON for availability, seats, and type. Filter seats by the "seats" field and type by the "type" field.',
          'AVAILABILITY: Prefer vehicles with available === true. For specific colors/stock, consult vehicle_variants and prefer available_quantity > 0.',
          'PRICING: Use price_per_day when quoting daily rates; format as ₱{amount}/day.',
          'LIST FORMAT: make, model, year, type, seats, price_per_day. Mention availability if relevant.',
          'IF NO MATCHES: Offer closest alternatives by seat range or similar type.',
          'BOOKING: Prompt for rental dates, pickup location, and contact if the user wants to proceed.'
        ].join('\n');

        const hiddenContext = `INTERNAL_INSTRUCTIONS\n${instructions}\n\nVEHICLE_CATALOG_JSON\n${JSON.stringify(catalog)}`;

        setChatHistory(prev => [
          ...prev,
          { role: 'model', text: hiddenContext, hideInChat: true }
        ]);
      } catch (e) {
        // Do not surface errors to users; keep silent if catalog fails
      }
    };

    loadVehicleCatalog();
  }, []);
  const generateBotResponse = async (history) =>{
      //FORMAT CHAT HISTORY FOR API REQUEST
      history = history.map(({role, text}) => ({role, parts: [{ text }] }));

      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({contents: history})
      };

      try{
        //API CALL FOR GETTING THE RESPONSE OF BOT
        const response = await fetch(import.meta.env.VITE_API_URL, requestOptions);
        const data = await response.json();
        
        //UPDATE CHAT HISTORY WITH BOT'S RESPONSE
        if(!response.ok) throw new Error(data.error.message || "Denni went Dizzy!");
      
          const apiResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1").trim();
          updateHistory(apiResponseText);

      }catch(error){
        updateHistory(error.message, true);
      }
  }

  useEffect(() => {
    //FOR AUTOSCROLLING
    chatBodyRef.current.scrollTo({top: chatBodyRef.current.scrollHeight, behavior: "smooth"});
  }, [chatHistory]);

  return (
    <div className={`container ${showChatbot ? 'show-chatbot' : ""}`}>
      <button onClick={() => setShowChatbot(prev => !prev)} id="chatbot-toggler">
        <span className="material-symbols-outlined"> mode_comment</span>
      </button>
      <div className="chatbot-popup">
        <div className="chat-header">
          <div className="header-info">
            <img src={denni} alt="icon" />
            <h2 className="logo-text">Denni</h2>
          </div>
          <button onClick={() => setShowChatbot(prev => !prev)} className="material-symbols-outlined"> keyboard_arrow_down</button>
        </div>

        {/*CHAT BODY*/}
        <div ref={chatBodyRef} className="chat-body">
          <div className='message bot-message'>
            <img src={denni} alt="icon" />
            <p className="message-text">Hey there! 🚗 I am Denni, your travel buddy from The Rental Den - Cebu! Need a ride? I can help you find the perfect car or van. Where are we headed today?</p>
          </div>

        {/* RENDERING CHAT HISTORY DYNAMICALLY */}
          {chatHistory.map((chat, index) =>(
            <ChatMessage key={index} chat={chat}/>
          ))}
        </div>

        {/*CHAT FOOTER*/}
        <div className="chat-footer">
          <ChatForm chatHistory={chatHistory} setChatHistory={setChatHistory} generateBotResponse={generateBotResponse}/>
        </div>
      </div>
    </div>
  )
}

export default RentalBot
