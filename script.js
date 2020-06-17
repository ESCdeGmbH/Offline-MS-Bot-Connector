"use strict";

var ac;
var sr;

let chatfieldTypes = Object.freeze({ "user": 1, "bot": 2 });
let conversationId;
let config;

function InitBot(cfg, botSection) {
    config = cfg;
    conversationId = sessionStorage.getItem("conversation_id");
    if (!conversationId) {
        conversationId = uuid();
        sessionStorage.setItem("conversation_id", conversationId);
    }
    console.log("Conversation ID: " + conversationId);
    require(["https://unpkg.com/adaptivecards/dist/adaptivecards.js", "https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/3.1.3/signalr.min.js"], function (module_ac, module_sr) {
        ac = module_ac;
        sr = module_sr;
        SetUpBotView(botSection);
        SetUpSignalR();
    });
}

function SetUpBotView(botSection) {
    let chatContainer = document.createElement("div");
    chatContainer.id = "chat-container";

    let footer = document.createElement("div");
    footer.id = "footer";

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
    header.id = "header";
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
    
    LoadExistingDialog();
    MakeBotDraggable(botSection, header);
}

function SetUpSignalR() {
    let connection = new sr.HubConnectionBuilder()
        .withUrl(config.receiver_hub)
        .configureLogging(sr.LogLevel.Information)
        .build();

    connection.onclose(async () => {
        await start(connection);
    });

    connection.on(conversationId, async () => {
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
    let icon = document.createElement("img"); // TODO: Bild und Name etc. per Anfrage an Backend holen...
    icon.src = config.bot_avatar;
    icon.alt = config.bot_avatar_alt;
    return icon;
}

function SubmitInput(event) {
    let input = document.getElementById("inputField").value;
    document.getElementById("inputField").value = "";
    CreateAndAppendChatField(CreateText(input), chatfieldTypes.user);
    event.preventDefault();  // to prevent the page to getting redirected after clicking the submit button or pressing 'Enter'
    SendMessageToBot(input);
}

async function SendMessageToBot(text) {
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
        "text": text,
        "type": "message"
    }
    const resp = await fetch(config.message_backend, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const msgStatus = await resp.status;
    if (msgStatus != 200) {
        console.error("Sending message failed with status code: " + msgStatus);
    }
}

function ChangeUserId(id) {
    if (id) {
        config.user_id = id;
    } else {
        config.user_id = uuid();
    }
    return config.user_id;
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
    chatField.scrollIntoView();  // to focus the currently added chat field

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
    paragraph.innerText = content;
    return paragraph;
}

function SubmitACInput(text) {
    CreateAndAppendChatField(CreateText(text), chatfieldTypes.user);
    SendMessageToBot(text);
}

function CreateAdaptiveCard(content) {
    let adaptiveCard = new ac.AdaptiveCard();
    adaptiveCard.onExecuteAction = function (action) {
        switch (action.parent.constructor.name) {
            case "TextInput":
                SubmitACInput(action.parent.value);
                break;
            case "AdaptiveCard":
                SubmitACInput(action.data);
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

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function MakeBotDraggable(botSection, header) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

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
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        botSection.style.top = (botSection.offsetTop - pos2) + "px";
        botSection.style.left = (botSection.offsetLeft - pos1) + "px";
    }

    function CloseDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

String.prototype.ReplaceAll = function (search, replacement) {
    return this.split(search).join(replacement);
};