"use strict";

var ac;
var sr;

let chatfieldTypes = Object.freeze({ "user": 1, "bot": 2 });
let conversationId;
let config;

function InitBot(cfg, botSection) {
    config = cfg;
    conversationId = uuid();
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

    inputForm.appendChild(inputField);
    inputForm.appendChild(submit);
    footer.appendChild(inputForm);
    botSection.appendChild(chatContainer);
    botSection.appendChild(footer);
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
        "channelId": "ESC_Offline_Connector",
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

function CreateAndAppendChatField(renderedContent, type) {
    let chatFieldClass = "chat-field";
    let chatField = document.createElement("div");
    switch (type) {
        case chatfieldTypes.user:
            chatFieldClass += " darker right";
            break;
        case chatfieldTypes.bot:
            let icon = CreateIcon();
            chatField.appendChild(icon);
            break;
        default:
            console.log("An error occured while parsing the CHATFIELDTYPE.");
            return;
    }
    chatField.className = chatFieldClass;
    chatField.appendChild(renderedContent);
    let timeSpan = CreateTimeSpan();
    chatField.appendChild(timeSpan);
    document.getElementById("chat-container").appendChild(chatField);
    chatField.scrollIntoView();  // to focus the currently added chat field
}

function CreateTimeSpan() {
    let timeSpan = document.createElement("span");
    timeSpan.className = "time";
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
        let chatField = SubmitACInput(action.title);
        document.getElementById("chat-container").appendChild(chatField);
    }
    adaptiveCard.parse(content);
    return adaptiveCard.render();
}

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}