"use strict";

const CHATFIELDTYPES = Object.freeze({ "user": 1, "bot": 2 });
const BASE = "/api/messages";
const BASE_OFFLINE = "/v3/conversations/"
const HUB = "/receiverhub"
const CONVERSATION_ID = "1";

const connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB)
    .configureLogging(signalR.LogLevel.Information)
    .build();

async function start() {
    try {
        await connection.start();
        console.log("connected");
    } catch (err) {
        console.log(err);
        setTimeout(() => start(), 5000);
    }
};

connection.onclose(async () => {
    await start();
});

connection.on(CONVERSATION_ID, async () => {
    const resp = await fetch(BASE_OFFLINE + CONVERSATION_ID + "/poll", {
        method: 'POST'
    });
    const status = await resp.status; // TODO: use status to check if result is valid
    const result = await resp.json();
    CreateAndAppendChatField(result[0].attachments[0].content, CHATFIELDTYPES.bot);
});

// Start the connection.
start();

function SetUp() {
    document.getElementById("inputForm").addEventListener("submit", SubmitInput);
}

function CreateIcon() {
    let icon = document.createElement("img"); // TODO: Bild und Name etc. per Anfrage an Backend holen...
    icon.src = "ESC.png";
    icon.alt = "ESC-Avatar";
    return icon;
}

function SubmitInput(event) {
    let input = document.getElementById("inputField").value;
    document.getElementById("inputField").value = "";
    CreateAndAppendChatField(input, CHATFIELDTYPES.user);
    event.preventDefault();  // to prevent the page to getting redirected after clicking the submit button or pressing 'Enter'
}

function CreateAndAppendChatField(content, type) {
    let chatFieldClass = "chat-field";
    let chatField = document.createElement("div");
    let renderedContent;
    switch (type) {
        case CHATFIELDTYPES.user:
            chatFieldClass += " darker right";
            renderedContent = CreateText(content);
            break;
        case CHATFIELDTYPES.bot:
            let icon = CreateIcon();
            chatField.appendChild(icon);
            // EXAMPLE:
            renderedContent = CreateAdaptveCard(content);
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
    adaptiveCard.hostConfig = new AdaptiveCards.HostConfig({
        fontFamily: document.body.fontFamily
        // More host config options
    });
    adaptiveCard.onExecuteAction = function (action) {
        let chatField = CreateChatField(action.text, CHATFIELDTYPES.user); // TODO Variable Text prüfen
        document.getElementById("chat-container").appendChild(chatField);
    }
    adaptiveCard.parse(content);
    return adaptiveCard.render();
}