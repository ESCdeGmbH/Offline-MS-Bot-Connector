# Offline MS Bot Connector

This repository contains a front end for the [chatbot framework](https://github.com/ESCdeGmbH/chatbot-framework).
It aims to establish a connection to the bot without requiring cloud services.

Therefore, the bot creates a message queue, which can be polled using SignalR.

A sample for use can be found in the [EchoBot](https://github.com/ESCdeGmbH/echobot).

## Configuration

A sample configuration can be found in [Sample.html](sample.html).

It contains the following parameters:

```js
{
// The ID of the user .. can also set via #ChangeUserId(id)
"user_id": user_id, 

// The bot backend url (with "/api/messages") . may be relative or absolute
"message_backend": "/api/messages", 

// The Reply to URL for the Backend. Iff you are using the Chatbot Framework of the ESC this might be the Bot itself.
"reply_to": document.baseURI, 

// The Location of the SignalR receiverhub for registration (this might be the chatbot backend itself iff you are using the ESC Chatbot Framework)
"receiver_hub": "/receiverhub", 

// The title in the Chatbot Box
"bot_title": "ESC-Chatbot (Sample)", 

// Path to the Avatar Image of the Chatbot 
"bot_avatar": "/bot_avatar.png",      

// The alternative (text) for the Chatbot Avatar (iff no avatar possible, this text will be used)
"bot_avatar_alt": "ESC", 

// The Host of this Bot. Will be used as ChannelID
"host": window.location.href, 

// Indicates whether data like conversation id shall be stored in a domain cookie or in the session store
"use_cookie": false,

// The indicators for the minimize button (separated by '|')
"toggle_chat": "Do you need help?|Minimize Chat" 
}
```
