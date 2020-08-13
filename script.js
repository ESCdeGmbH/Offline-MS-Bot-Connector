"use strict";

const cdn_signal_r = "https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/3.1.3/signalr.min.js";
const cdn_adaptive_cards = "https://unpkg.com/adaptivecards/dist/adaptivecards.min.js";

var SignalR;
var AdaptiveCards;

// Some Constants.
let chatfieldTypes = Object.freeze({ "user": 1, "bot": 2 });
let fieldTypes = Object.freeze({ "text": "text", "value": "value" });

// The ConversationId of this Bot Instance as well as the (initial) configuration
let conversationId;
let config;

var bot_open;


//////////////////////////////////////////////////////////////////////////////////
///////////////////////// PUBLIC ENTRY FUNCTIONS /////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////

// Connect & Initialize Bot by Configuration and Bot-Element
function InitBot(cfg, botSection) {
    botSection.style.top = sessionStorage.getItem("top");
    botSection.style.left = sessionStorage.getItem("left");
    config = cfg;
    if (!cfg.use_cookie) {
        conversationId = sessionStorage.getItem("conversation_id");
    } else {
        conversationId = getCookie("conversation_id");
    }
    if (!conversationId) {
        conversationId = uuid();
        if (!cfg.use_cookie) {
            sessionStorage.setItem("conversation_id", conversationId);
        } else {
            setCookie("conversation_id", conversationId);
        }
    }
    console.log("Conversation ID: " + conversationId);

    require([cdn_adaptive_cards, cdn_signal_r], function(module_ac, module_sr) {
        AdaptiveCards = module_ac;
        SignalR = module_sr;
        SetUpBotView(botSection);
        SetUpSignalR();
    });
}

// Change the User ID (if null use #uuid())
function ChangeUserId(id) {
    if (id) {
        config.user_id = id;
    } else {
        config.user_id = uuid();
    }
    return config.user_id;
}

// Get a uuid string
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Toggle open / close chat window (also updates the text of the <span> with id "help")
function OpenCloseChat() {
    let bot = document.getElementById("bot");
    if (bot_open) {
        bot_open = 0;
        sessionStorage.setItem("bot_open", bot_open);
        bot.style.display = "none";
    } else {
        bot_open = 1;
        sessionStorage.setItem("bot_open", bot_open);
        bot.style.display = "";
    }
    let text = config.toggle_chat.split("|")[bot_open]
    let help = document.getElementById('help')
    if (help)
        help.innerHTML = text;
}

//////////////////////////////////////////////////////////////////////////////////
//////////////////////// PRIVATE HELPER FUNCTIONS ////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////
function SetUpBotView(botSection) {
    let chatContainer = document.createElement("div");
    chatContainer.id = "chat-container";

    let footer = document.createElement("div");
    footer.id = "chatbot-footer";

    let inputForm = document.createElement("form");
    inputForm.id = "inputForm";
    inputForm.addEventListener("submit", SubmitInput);

    let inputField = document.createElement("input");
    inputField.id = "inputField";
    inputField.name = "inputField";
    inputField.type = "text";
    inputField.placeholder = "Stellen Sie hier Ihre Frage";

    let submit = document.createElement("input");
    submit.type = "submit";
    submit.id = "submit";
    submit.value = "\u2B9E";

    let header = document.createElement("div");
    header.id = "chatbot-header";
    header.style.cursor = "move";

    let title = document.createElement("p");
    title.id = "title";
    title.innerText = config.bot_title;

    header.appendChild(CreateIcon());
    header.appendChild(title);
    inputForm.appendChild(inputField);
    inputForm.appendChild(submit);
    footer.appendChild(inputForm);

    botSection.appendChild(header);
    botSection.appendChild(chatContainer);
    botSection.appendChild(footer);

    bot_open = Number(sessionStorage.getItem("bot_open"));
    if (!bot_open) {
        botSection.style.display = "none";
        bot_open = 0;
        sessionStorage.setItem("bot_open", bot_open);
    }
    let text = config.toggle_chat.split("|")[bot_open]
    let help = document.getElementById('help')
    if (help)
        help.innerHTML = text;

    LoadExistingDialog();
    MakeBotDraggable(botSection, header);
}

function SetUpSignalR() {
    let connection = new SignalR.HubConnectionBuilder()
        .withUrl(config.receiver_hub)
        .configureLogging(SignalR.LogLevel.Information)
        .build();

    connection.onclose(async() => {
        await start(connection);
    });

    connection.on(conversationId, async() => {
        const resp = await fetch(config.reply_to + "v3/conversations/" + conversationId + "/poll", {
            method: 'POST'
        });
        const status = await resp.status;
        const result = await resp.json();
        if (status != 200 || !result || result.length == 0) {
            console.error("Error while parsing the response.");
            return;
        }
        if (result[0].type != "message") {
            HandleUnknownType();
            return;
        }

        if (result[0].text.length > 0) HandleMessage(result[0].text);
        HandleAdaptiveCard(result[0].attachments);
    });

    start(connection);
}

async function start(connection) {
    try {
        await connection.start();
        console.log("connected");
    } catch (err) {
        console.error(err);
        setTimeout(() => start(), 5000);
    }
};

function HandleAdaptiveCard(attachments) {
    if (attachments) {
        for (let i = 0; i < attachments.length; i++) {
            CreateAndAppendChatField(CreateAdaptiveCard(attachments[i].content), chatfieldTypes.bot);
        }
    }
}

function HandleMessage(text) {
    CreateAndAppendChatField(CreateText(text), chatfieldTypes.bot);
}


function CreateIcon() {
    let icon = document.createElement("img");
    icon.src = config.bot_avatar;
    icon.alt = config.bot_avatar_alt;
    return icon;
}

function SubmitInput(event) {
    let input = document.getElementById("inputField").value;
    if (!input) return;
    document.getElementById("inputField").value = "";
    CreateAndAppendChatField(CreateText(input), chatfieldTypes.user);
    event.preventDefault(); // to prevent the page to getting redirected after clicking the submit button or pressing 'Enter'
    SendMessageToBot(input, fieldTypes.text);
}

async function SendMessageToBot(data, fieldtype) {
    let payload = {
        "channelId": config.host,
        "conversation": {
            "id": conversationId
        },
        "from": {
            "id": config.user_id
        },
        "id": uuid(),
        "serviceUrl": config.reply_to,
        "type": "message"
    }
    payload[fieldtype] = data;
    const resp = await fetch(config.message_backend, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    if (resp.status != 200) {
        console.error("Sending message failed with status code: " + msgStatus);
    }
}



function CreateAndAppendChatField(renderedContent, type) {
    let chatFieldClass = "chat-field";
    let chatField = document.createElement("div");
    if (type == chatfieldTypes.user) chatFieldClass += " darker right";
    chatField.className = chatFieldClass;
    chatField.appendChild(renderedContent);
    let timeSpan = CreateTimeSpan(type);
    chatField.appendChild(timeSpan);
    document.getElementById("chat-container").appendChild(chatField);
    chatField.scrollIntoView(); // to focus the currently added chat field

    StoreDialog();
}

function CreateTimeSpan(type) {
    let timeSpan = document.createElement("span");
    if (type == chatfieldTypes.bot) {
        timeSpan.className = "time left";
    } else {
        timeSpan.className = "time right";
    }
    timeSpan.innerText = ParseTime();
    return timeSpan;
}

function ParseTime() {
    let d = new Date();
    return AddLeadingZero(d.getHours()) + ":" + AddLeadingZero(d.getMinutes()) + ":" + AddLeadingZero(d.getSeconds());
}

function AddLeadingZero(number) {
    return number > 9 ? number : "0" + number;
}

function CreateText(content) {
    let paragraph = document.createElement("p");
    paragraph.className = "txt";
    paragraph.innerHTML = content;
    return paragraph;
}

function SubmitACInput(data, fieldtype, text) {
    if (text) CreateAndAppendChatField(CreateText(text), chatfieldTypes.user);
    SendMessageToBot(data, fieldtype);
}

function CreateAdaptiveCard(content) {
    let adaptiveCard = new AdaptiveCards.AdaptiveCard();
    adaptiveCard.onExecuteAction = function(action) {
        switch (action.constructor.name) {
            case "SubmitAction":
                if (typeof action.data === 'string' || action.data instanceof String)
                    SubmitACInput(action.data, fieldTypes.text, action.data);
                else
                    SubmitACInput(action.data, fieldTypes.value);
                break;
            case "OpenUrlAction":
                window.open(action.url, "_blank");
                break;
            default:
                console.error("Unknown action type.");
        }
    }
    adaptiveCard.parse(content);
    return adaptiveCard.render();
}

function StoreDialog() {
    sessionStorage.setItem("chat", document.getElementById("chat-container").innerHTML);
}

function LoadExistingDialog() {
    let chat = sessionStorage.getItem("chat");
    if (!chat) {
        console.log("No chat cached in session storage.");
        return;
    }
    let chatContainer = document.getElementById("chat-container");
    chatContainer.innerHTML = chat.ReplaceAll(/<button.*>/gm, "");
    chatContainer.lastChild.scrollIntoView();
}



function MakeBotDraggable(botSection, header) {
    var pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;

    header.onmousedown = DragMouseDown;

    function DragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = CloseDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = ElementDrag;
    }

    function ElementDrag(e) {
        let maxWidth = window.innerWidth - botSection.offsetWidth;
        let maxHeight = window.innerHeight;
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        let top = botSection.offsetTop - pos2;
        let left = botSection.offsetLeft - pos1;
        top = top < maxHeight ? (top < 0 ? 0 : top) : maxHeight;
        left = left < maxWidth ? (left < 0 ? 0 : left) : maxWidth;
        botSection.style.top = top + "px";
        botSection.style.left = left + "px";
        sessionStorage.setItem("top", top + "px");
        sessionStorage.setItem("left", left + "px");
    }

    function CloseDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}



String.prototype.ReplaceAll = function(search, replacement) {
    return this.split(search).join(replacement);
};

function getDomain() {
    var separate = (document.domain).split('.');
    separate.shift();
    return "." + separate.join('.');
}

function getCookie(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setCookie(name, value, options = {}) {
    options = {
        path: '/',
        domain: getDomain(),
        // add other defaults here if necessary
        ...options
    };

    if (options.expires instanceof Date) {
        options.expires = options.expires.toUTCString();
    }

    let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);

    for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
            updatedCookie += "=" + optionValue;
        }
    }

    document.cookie = updatedCookie;
}