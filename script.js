"use strict";

let chatfieldTypes = Object.freeze({ "user": 1, "bot": 2 });
let conversationId;
let config;

function InitBot(cfg, botSection) {
    config = cfg;
    conversationId = uuid();
    console.log("Conversation ID: " + conversationId);
    SetUpBotView(botSection);
    SetUpSignalR();
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
    let connection = config.receiver_hub;

    connection.onclose(async () => {
        await start(connection);
    });

    connection.on(conversationId, async () => {
        const resp = await fetch(config.reply_to + conversationId + "/poll", {
            method: 'POST'
        });
        const status = await resp.status;
        const result = await resp.json();
        if (status != 200 || !result || result.length == 0) {
            Console.log("Error while parsing the response.");
            return;
        }
        switch (result[0].type) {
            case "message":
                HandleMessage(result[0].text);
                break;
            case "asasdasd":
                HandleAdaptiveCard(result[0].attachments);
                break;
            default: HandleUnknownType();
        }
    });

    start(connection);
}

async function start(connection) {
    try {
        await connection.start();
        console.log("connected");
    } catch (err) {
        console.log(err);
        setTimeout(() => start(), 5000);
    }
};

function HandleAdaptiveCard(attachments) {
    for (var at in attachments) {
        CreateAndAppendChatField(CreateAdaptiveCard(at.content), chatfieldTypes.bot);
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
}

function SendMessageToBot(text) {
    // TODO
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

function CreateAdaptveCard(content) {
    let adaptiveCard = new AdaptiveCards.AdaptiveCard();
    adaptiveCard.hostconfig = new AdaptiveCards.Hostconfig({
        fontFamily: document.body.fontFamily
        // More host config options
    });
    adaptiveCard.onExecuteAction = function (action) {
        let chatField = CreateChatField(action.text, chatfieldTypes.user); // TODO Variable Text prüfen
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